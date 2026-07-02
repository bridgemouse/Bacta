const cache = new Map<string, unknown>()

export function getCachedData<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined
}

export function setCachedData<T>(key: string, value: T): void {
  cache.set(key, value)
}

export function clearCachedData(): void {
  cache.clear()
}
