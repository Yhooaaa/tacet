import "server-only";

export type Release = () => void;

type Waiter = { grant: (release: Release) => void };

export class FairSemaphore {
  private used = 0;
  private queues = new Map<string, Waiter[]>();
  private waiting = 0;

  constructor(readonly capacity: number) {}

  get active() {
    return this.used;
  }

  get queued() {
    return this.waiting;
  }

  acquire(owner = "", signal?: AbortSignal, timeoutMs?: number): Promise<Release> {
    if (signal?.aborted) return Promise.reject(signal.reason);
    if (this.used < this.capacity && !this.waiting) {
      this.used += 1;
      return Promise.resolve(this.releaser());
    }
    return new Promise<Release>((resolve, reject) => {
      const leave = (reason: unknown) => {
        const queue = this.queues.get(owner);
        const at = queue?.indexOf(waiter) ?? -1;
        if (at < 0) return;
        queue!.splice(at, 1);
        if (!queue!.length) this.queues.delete(owner);
        this.waiting -= 1;
        if (timer) clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        reject(reason);
      };
      const onAbort = () => leave(signal!.reason);
      const timer = timeoutMs ? setTimeout(() => leave(new SlotTimeout()), timeoutMs) : null;
      const waiter: Waiter = {
        grant: (release) => {
          if (timer) clearTimeout(timer);
          signal?.removeEventListener("abort", onAbort);
          resolve(release);
        },
      };
      signal?.addEventListener("abort", onAbort, { once: true });
      const queue = this.queues.get(owner);
      if (queue) queue.push(waiter);
      else this.queues.set(owner, [waiter]);
      this.waiting += 1;
    });
  }

  private releaser(): Release {
    let done = false;
    return () => {
      if (done) return;
      done = true;
      this.used -= 1;
      this.pump();
    };
  }

  private pump() {
    while (this.used < this.capacity && this.waiting) {
      const [owner, queue] = this.queues.entries().next().value!;
      const waiter = queue.shift()!;
      this.queues.delete(owner);
      if (queue.length) this.queues.set(owner, queue);
      this.waiting -= 1;
      this.used += 1;
      waiter.grant(this.releaser());
    }
  }
}

class SlotTimeout extends Error {
  readonly code = "EBUSY";
  constructor() {
    super("No free slot in time");
  }
}

export class KeyedLimiter {
  private limits = new Map<string, FairSemaphore>();

  constructor(readonly perKey: number) {}

  async acquire(key: string, owner?: string, signal?: AbortSignal, timeoutMs?: number): Promise<Release> {
    let limit = this.limits.get(key);
    if (!limit) this.limits.set(key, (limit = new FairSemaphore(this.perKey)));
    let release: Release;
    try {
      release = await limit.acquire(owner, signal, timeoutMs);
    } catch (error) {
      this.dropIfIdle(key, limit);
      throw error;
    }
    return () => {
      release();
      this.dropIfIdle(key, limit);
    };
  }

  get size() {
    return this.limits.size;
  }

  private dropIfIdle(key: string, limit: FairSemaphore) {
    if (!limit.active && !limit.queued && this.limits.get(key) === limit) this.limits.delete(key);
  }
}

export function singleFlight<V>() {
  const inFlight = new Map<string, Promise<V>>();
  return (key: string, fn: () => Promise<V>): Promise<V> => {
    const running = inFlight.get(key);
    if (running) return running;
    const promise = fn().finally(() => inFlight.delete(key));
    inFlight.set(key, promise);
    return promise;
  };
}

export class BoundedMap<K, V> extends Map<K, V> {
  constructor(readonly max: number) {
    super();
  }

  override set(key: K, value: V) {
    if (this.has(key)) this.delete(key);
    super.set(key, value);
    if (this.size > this.max) {
      for (const oldest of this.keys()) {
        this.delete(oldest);
        if (this.size <= this.max * 0.9) break;
      }
    }
    return this;
  }
}

export function envInt(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
