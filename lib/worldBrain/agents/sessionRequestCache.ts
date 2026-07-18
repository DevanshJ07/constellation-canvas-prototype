/**
 * Client-side request dedupe + session cache for agent calls (Phase 8D).
 * In-memory only — not persisted across reloads.
 */

export type InFlightEntry<T> = {
  promise: Promise<T>;
  startedAt: number;
};

export class SessionRequestCache<T> {
  private readonly results = new Map<string, T>();
  private readonly inFlight = new Map<string, InFlightEntry<T>>();

  getCached(key: string): T | undefined {
    return this.results.get(key);
  }

  hasCached(key: string): boolean {
    return this.results.has(key);
  }

  getInFlight(key: string): Promise<T> | undefined {
    return this.inFlight.get(key)?.promise;
  }

  isInFlight(key: string): boolean {
    return this.inFlight.has(key);
  }

  setCached(key: string, value: T): void {
    this.results.set(key, value);
  }

  async runDeduped(
    key: string,
    factory: () => Promise<T>,
    options?: { cachePredicate?: (value: T) => boolean },
  ): Promise<T> {
    const cached = this.results.get(key);
    if (cached !== undefined) return cached;

    const existing = this.inFlight.get(key);
    if (existing) return existing.promise;

    const shouldCache = options?.cachePredicate ?? (() => true);

    const promise = factory()
      .then((value) => {
        if (shouldCache(value)) {
          this.results.set(key, value);
        }
        return value;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, { promise, startedAt: Date.now() });
    return promise;
  }

  clear(): void {
    this.results.clear();
    this.inFlight.clear();
  }
}
