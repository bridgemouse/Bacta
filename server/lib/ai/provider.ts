import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'
import { getSetting } from '../settings'

// The models the Settings screens (web and Android) offer, per provider. The settings validator still accepts any
// regex-matching model ID so users can enter a newer one, but this list is what they choose from, so keep it current.
// Google: https://aistudio.google.com/docs/deprecations (gemini-2.5-flash and -pro are deprecated, shutdown 2026-12-01 at the
// earliest). The OpenAI ids have not been re-checked since they were first listed.
export const SUPPORTED_MODELS: Record<string, string[]> = {
  google:    ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'],
  anthropic: ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5', 'claude-fable-5-1'],
  openai:    ['gpt-4o-mini', 'gpt-4o', 'o3'],
}

export const DEFAULT_MODEL = 'gemini-3.8-flash'

export function getModel(purpose: 'briefing' | 'chat'): LanguageModel {
  const provider = getSetting('ai_provider') ?? 'google'
  const apiKey   = getSetting('ai_api_key')  ?? ''
  const modelId  = purpose === 'briefing'
    ? (getSetting('mx4_briefing_model') ?? DEFAULT_MODEL)
    : (getSetting('mx4_chat_model')     ?? DEFAULT_MODEL)

  switch (provider) {
    case 'anthropic': {
      const anthropic = createAnthropic({ apiKey })
      return anthropic(modelId)
    }
    case 'openai': {
      const openai = createOpenAI({ apiKey })
      return openai(modelId)
    }
    case 'google':
    default: {
      const google = createGoogleGenerativeAI({ apiKey })
      return google(modelId)
    }
  }
}

export async function testConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    const { generateText } = await import('ai')
    const model = getModel('chat')
    await generateText({ model, prompt: 'Reply with only: ok', maxOutputTokens: 5 })
    return { ok: true }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
