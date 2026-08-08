export interface ProviderTokens {
  access_token:  string
  refresh_token: string
  expires_at:    number  // unix seconds
}

export function tokensExpired(tokens: ProviderTokens): boolean {
  // 60-second buffer so we refresh before actual expiry
  return Date.now() / 1000 > tokens.expires_at - 60
}

export function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)
}

export function toEpoch(dateStr: string): number {
  return Math.floor(new Date(dateStr).getTime() / 1000)
}

export function basicAuth(clientId: string, clientSecret: string): string {
  return 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
}

// Runtime shape guard for OAuth token-exchange responses (and stored/decrypted token
// blobs) — these are cast with `as <Shape>` at the call site with no runtime check, so a
// provider renaming a field or a partially-written stored blob would otherwise silently
// produce undefined/NaN downstream (see #197) instead of failing at the point the bad
// data was read.
export function validateTokenFields<T extends object>(
  d: unknown, fields: (keyof T & string)[], context: string
): T {
  if (typeof d !== 'object' || d === null) {
    throw new Error(`${context}: token response was not an object`)
  }
  const obj = d as Record<string, unknown>
  for (const f of fields) {
    if (obj[f] === undefined || obj[f] === null) {
      throw new Error(`${context}: token response missing required field "${f}"`)
    }
  }
  return obj as T
}
