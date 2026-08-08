const cache = new Map<string, unknown>()

export function getCachedData<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined
}

export function setCachedData<T>(key: string, value: T): void {
  cache.set(key, value)
}

// No production caller (#196, investigated) — not a missing-invalidation gap. Every
// section hook already overwrites its cache entry via setCachedData() on each successful
// load, including on the 'bacta:sync-complete' refetch, so the cache never needs an
// explicit clear in the app itself. This exists purely as test-isolation infrastructure —
// module-level `cache` persists across test files, and every section-hook test file calls
// this in beforeEach() to reset it.
export function clearCachedData(): void {
  cache.clear()
}
