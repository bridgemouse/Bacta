export function getChatSessionId(): string {
  return `chat-${new Date().toISOString().slice(0, 10)}`
}
