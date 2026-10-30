import { randomUUID } from "node:crypto";
import { detectIdentifier, identifierKey, type Identifier } from "@/lib/identifiers";
import type { ScanEvent } from "@/types/scan";
import { currentUser } from "@/server/auth/account";
import { config } from "@/server/config";
import { clientIp, rateLimit } from "@/server/security/rate-limit";
import { claimScan } from "@/server/scan/quota";
import { admit, AdmissionTimeout, availability, expectedWaitSeconds, weightFor } from "@/server/scan/admission";
import { runInScan } from "@/server/scan/context";
import { runScan } from "@/server/scan/run";
import { readProof } from "@/server/auth/verification";
import { readJson } from "@/server/utils/http";
import { countStep } from "@/server/analytics/funnel";

const MAX_IDENTIFIERS = 18;

const HEARTBEAT_MS = 15_000;

const BUSY: Record<"full" | "draining", string> = {
  full: "Tacet is at capacity right now. Try again in a few minutes. This scan hasn't been counted.",
  draining: "Tacet is restarting for an update. Try again in a minute. This scan hasn't been counted.",
};

export async function POST(request: Request) {
  const ip = clientIp(request);
  if (!rateLimit(`scan:${ip}`, 6, 10 * 60)) {
    return Response.json({ error: "You've run several scans in a row. Wait a few minutes and try again." }, { status: 429 });
  }

  const body = await readJson<{ proofs?: unknown; usernames?: unknown }>(request);
  const proofs = Array.isArray(body?.proofs) ? body.proofs.slice(0, MAX_IDENTIFIERS) : [];
  const rawUsernames = Array.isArray(body?.usernames) ? body.usernames : [];

  const identifiers = new Map<string, Identifier>();
  for (const proof of proofs) {
    const id = readProof(proof);
    if (id) identifiers.set(identifierKey(id), id);
  }
  for (const raw of rawUsernames) {
    if (typeof raw !== "string") continue;
    const detection = detectIdentifier(raw);
    if (detection.ok && detection.identifier.kind === "username") {
      identifiers.set(identifierKey(detection.identifier), detection.identifier);
    }
  }
  if (!identifiers.size) {
    return Response.json({ error: "Verify at least one detail before scanning." }, { status: 401 });
  }

  const list = [...identifiers.values()];
  const weight = weightFor(list.filter((i) => i.kind === "username").length);
  const open = availability(weight);
  if (open !== "open") {
    const retry = open === "full" ? Math.min(900, Math.max(60, expectedWaitSeconds(weight))) : 30;
    return Response.json({ error: BUSY[open], busy: true }, { status: 503, headers: { "retry-after": String(retry) } });
  }

  const user = await currentUser();
  const claim = await claimScan(ip, list, user);
  if (!claim.ok) return Response.json({ error: claim.error, quota: claim.status === 402 }, { status: claim.status });

  const cancel = new AbortController();
  request.signal?.addEventListener("abort", () => cancel.abort(), { once: true });

  const encoder = new TextEncoder();
  let heartbeat: NodeJS.Timeout | undefined;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const write = (text: string) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          open = false;
          cancel.abort();
        }
      };
      const emit = (event: ScanEvent) => write(`${JSON.stringify(event)}\n`);
      heartbeat = setInterval(() => write("\n"), HEARTBEAT_MS);

      let release: (() => void) | undefined;
      try {
        release = await admit(weight, cancel.signal, (position, etaSeconds) =>
          emit({ type: "queue", position, etaSeconds }),
        );
      } catch (error) {
        await claim.release().catch((e) => console.error("[noise] couldn't return the free scan", e));
        if (error instanceof AdmissionTimeout) emit({ type: "error", message: "Tacet is very busy and your scan didn't get a turn in time. This scan hasn't been counted, so try again soon." });
      }

      if (release) {
        try {
          await countStep("scan_started");
          await runInScan({ id: randomUUID(), signal: cancel.signal }, () => runScan(list, emit, { deep: config.demoMode || user?.plan === "pro" }));
          if (!cancel.signal.aborted) await countStep("scan_finished");
        } catch (error) {
          if (!cancel.signal.aborted) {
            console.error("[noise] scan failed", error);
            await claim.release().catch((e) => console.error("[noise] couldn't return the free scan", e));
            emit({ type: "error", message: "The scan stopped unexpectedly. This scan hasn't been counted, so try again." });
          }
        } finally {
          release();
        }
      }

      clearInterval(heartbeat);
      if (open) {
        open = false;
        try {
          controller.close();
        } catch {}
      }
    },
    cancel() {
      clearInterval(heartbeat);
      cancel.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}
