import "server-only";
import { monitorEventLoopDelay, performance, type EventLoopUtilization } from "node:perf_hooks";

declare global {
  var __noiseLoop: { delay: ReturnType<typeof monitorEventLoopDelay>; last: EventLoopUtilization } | undefined;
}

const loop = (globalThis.__noiseLoop ??= (() => {
  const delay = monitorEventLoopDelay({ resolution: 20 });
  delay.enable();
  return { delay, last: performance.eventLoopUtilization() };
})());

export function eventLoopStats() {
  const now = performance.eventLoopUtilization();
  const since = performance.eventLoopUtilization(now, loop.last);
  loop.last = now;
  const stats = {
    utilization: Math.round(since.utilization * 100) / 100,
    delayP99Ms: Math.round(loop.delay.percentile(99) / 1e6),
    delayMaxMs: Math.round(loop.delay.max / 1e6),
  };
  loop.delay.reset();
  return stats;
}
