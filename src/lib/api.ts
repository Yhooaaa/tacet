import type { Identifier } from "./identifiers";
import type { ScanEvent } from "@/types/scan";

export type StartResponse = {
  identifier: Identifier;
  note?: string;
  token: string;
  method: "email" | "sms" | "bio" | "telegram";
  code?: string;
  devCode?: string;
  link?: string;
  dev?: boolean;
};

async function post<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new Error("You seem to be offline. Check your connection and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Something went wrong. Try again.");
  return data as T;
}

export const startVerification = (value: string, purpose: "scan" | "signin" = "scan") => post<StartResponse>("/api/verify/start", { value, purpose });

export const confirmVerification = (token: string, code: string) =>
  post<{ proof: string; identifier: Identifier }>("/api/verify/confirm", { token, code });

export const checkTelegram = (token: string) => post<{ pending?: true; proof?: string; identifier?: Identifier }>("/api/verify/telegram", { token });

const DROPPED = "The connection dropped before the scan finished. Check your connection and run the scan again.";

export async function streamScan(proofs: string[], onEvent: (event: ScanEvent) => void, signal?: AbortSignal, usernames: string[] = []) {
  let res: Response;
  try {
    res = await fetch("/api/scan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ proofs, usernames }),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error("You seem to be offline. Check your connection and try again.");
  }
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? "The scan couldn't start. Try again.");
  }

  let finished = false;
  const handle = (raw: string) => {
    const line = raw.trim();
    if (!line) return;
    let event: ScanEvent;
    try {
      event = JSON.parse(line) as ScanEvent;
    } catch {
      return;
    }
    if (event.type === "done" || event.type === "error") finished = true;
    onEvent(event);
  };

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let newline = buffer.indexOf("\n");
      while (newline !== -1) {
        handle(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");
      }
    }
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(DROPPED);
  }
  handle(buffer);
  if (!finished && !signal?.aborted) throw new Error(DROPPED);
}

export class RequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function api<T>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: init?.method ?? "GET",
      headers: init?.body === undefined ? undefined : { "content-type": "application/json" },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new RequestError("You seem to be offline. Check your connection and try again.", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new RequestError((data as { error?: string }).error ?? "Something went wrong. Try again.", res.status);
  return data as T;
}

const PENDING_PROOFS = "tacet:pending-proofs";

export function holdProofs(proofs: string[]) {
  try {
    sessionStorage.setItem(PENDING_PROOFS, JSON.stringify(proofs));
  } catch {}
}

export function takeProofs(): string[] {
  try {
    const raw = sessionStorage.getItem(PENDING_PROOFS);
    sessionStorage.removeItem(PENDING_PROOFS);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}