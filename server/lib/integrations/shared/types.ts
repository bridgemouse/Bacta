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
