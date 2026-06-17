// Best-effort failure notification for unattended jobs (nightly orchestrator,
// poller). Posts to a Discord webhook if DISCORD_WEBHOOK_URL is set; otherwise
// a no-op. Never throws — notification failure must not break the caller.
// Send only operational context, never biometric/PHI values.
export async function notifyFailure(context: string, detail: string): Promise<void> {
  const url = process.env.DISCORD_WEBHOOK_URL
  if (!url) return
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: `⚠️ Bacta — ${context}\n${detail}`.slice(0, 1800) }),
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    // swallow — notification is best-effort
  }
}
