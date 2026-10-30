import { after } from "next/server";
import { addIdentifier, currentUser, removeIdentifier } from "@/server/auth/account";
import { checkUser } from "@/server/jobs/monitor";
import { detectIdentifier } from "@/lib/identifiers";
import { readProof } from "@/server/auth/verification";
import { readJson, unauthorized } from "@/server/utils/http";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();
  const body = await readJson<{ proofs?: unknown }>(request);
  const proofs = Array.isArray(body?.proofs) ? body.proofs.slice(0, 20) : [];
  let added = 0;
  let emails = 0;
  for (const proof of proofs) {
    const identifier = readProof(proof);
    if (!identifier) continue;
    await addIdentifier(user.id, identifier);
    added += 1;
    if (identifier.kind === "email") emails += 1;
  }
  if (emails) after(() => checkUser(user).catch((e) => console.error("[noise] baseline check failed", e)));
  return Response.json({ added });
}

export async function DELETE(request: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();
  const body = await readJson<{ value?: unknown }>(request);
  const detection = detectIdentifier(typeof body?.value === "string" ? body.value : "");
  if (!detection.ok) return Response.json({ error: detection.error }, { status: 400 });
  if (detection.identifier.kind === "email" && detection.identifier.value === user.email) {
    return Response.json({ error: "This is your sign-in email. Delete your account to remove it." }, { status: 400 });
  }
  await removeIdentifier(user.id, detection.identifier);
  return Response.json({ ok: true });
}
