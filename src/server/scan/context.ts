import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

export type ScanContext = { id: string; signal: AbortSignal };

const storage = new AsyncLocalStorage<ScanContext>();

export const runInScan = <T,>(context: ScanContext, fn: () => Promise<T>) => storage.run(context, fn);

export const currentScan = () => storage.getStore();

export const outsideScan = <T,>(fn: () => Promise<T>) => storage.exit(fn);

export function requestSignal(timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  const scan = currentScan()?.signal;
  return scan ? AbortSignal.any([timeout, scan]) : timeout;
}

export const scanCancelled = () => currentScan()?.signal.aborted ?? false;
