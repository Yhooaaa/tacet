import "server-only";
import { envInt, type Release } from "@/server/utils/limiter";

const CAPACITY = envInt("NOISE_SCAN_SLOTS", 96);
const MAX_QUEUE = envInt("NOISE_SCAN_QUEUE", 500);
const MAX_WAIT_MS = envInt("NOISE_SCAN_MAX_WAIT_SECONDS", 600) * 1000;

type Ticket = {
  weight: number;
  grant: () => void;
  notify?: (position: number, etaSeconds: number) => void;
  lastPosition?: number;
};

declare global {
  var __noiseAdmission: { used: number; queue: Ticket[]; avgMs: number; draining: boolean; started: number; finished: number } | undefined;
}

const state = (globalThis.__noiseAdmission ??= { used: 0, queue: [], avgMs: 45_000, draining: false, started: 0, finished: 0 });

export const weightFor = (usernames: number) => Math.min(CAPACITY, Math.max(1, usernames));

export type Availability = "open" | "full" | "draining";

function eta(ahead: number) {
  return Math.max(5, Math.round(((ahead / CAPACITY) * state.avgMs) / 1000));
}

const queuedSlots = () => state.queue.reduce((n, t) => n + t.weight, 0);

export function availability(weight = 1): Availability {
  if (state.draining) return "draining";
  if (state.queue.length >= MAX_QUEUE) return "full";
  const mustWait = state.queue.length > 0 || state.used + weight > CAPACITY;
  return mustWait && eta(queuedSlots() + weight) * 1000 > MAX_WAIT_MS * 0.8 ? "full" : "open";
}

export const expectedWaitSeconds = (weight = 1) => eta(queuedSlots() + weight);

function announce() {
  let ahead = 0;
  state.queue.forEach((ticket, i) => {
    ahead += ticket.weight;
    if (ticket.lastPosition !== i + 1) {
      ticket.lastPosition = i + 1;
      ticket.notify?.(i + 1, eta(ahead));
    }
  });
}

function pump() {
  while (state.queue.length && state.used + state.queue[0].weight <= CAPACITY) {
    const ticket = state.queue.shift()!;
    state.used += ticket.weight;
    ticket.grant();
  }
  announce();
}

function releaser(weight: number): Release {
  const started = Date.now();
  state.started += 1;
  let done = false;
  return () => {
    if (done) return;
    done = true;
    state.used -= weight;
    state.finished += 1;
    state.avgMs = state.avgMs * 0.8 + (Date.now() - started) * 0.2;
    pump();
  };
}

export function admit(weight: number, signal: AbortSignal, notify?: Ticket["notify"]): Promise<Release> {
  if (signal.aborted) return Promise.reject(signal.reason);
  if (!state.queue.length && state.used + weight <= CAPACITY) {
    state.used += weight;
    return Promise.resolve(releaser(weight));
  }
  return new Promise<Release>((resolve, reject) => {
    const leave = (reason: unknown) => {
      const at = state.queue.indexOf(ticket);
      if (at < 0) return;
      state.queue.splice(at, 1);
      clearTimeout(timer);
      reject(reason);
      pump();
    };
    const onAbort = () => leave(signal.reason);
    const timer = setTimeout(() => leave(new AdmissionTimeout()), MAX_WAIT_MS);
    const ticket: Ticket = {
      weight,
      notify,
      grant: () => {
        clearTimeout(timer);
        signal.removeEventListener("abort", onAbort);
        resolve(releaser(weight));
      },
    };
    signal.addEventListener("abort", onAbort, { once: true });
    state.queue.push(ticket);
    announce();
  });
}

export class AdmissionTimeout extends Error {
  constructor() {
    super("Waited too long for a scan slot");
  }
}

export function startDraining() {
  state.draining = true;
}

export const admissionStats = () => ({
  capacity: CAPACITY,
  used: state.used,
  queued: state.queue.length,
  queuedSlots: queuedSlots(),
  maxQueue: MAX_QUEUE,
  avgScanSeconds: Math.round(state.avgMs / 1000),
  started: state.started,
  finished: state.finished,
  draining: state.draining,
});
