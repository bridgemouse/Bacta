import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'
import { getSetting } from '../settings'

export const SUPPORTED_MODELS: Record<string, string[]> = {
  google:    ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3.5-flash'],
  anthropic: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6', 'claude-opus-4-8'],
  openai:    ['gpt-4o-mini', 'gpt-4o', 'o3'],
}

export function getModel(purpose: 'briefing' | 'chat'): LanguageModel {
  const provider = getSetting('ai_provider') ?? 'google'
  const apiKey   = getSetting('ai_api_key')  ?? ''
  const modelId  = purpose === 'briefing'
    ? (getSetting('mx4_briefing_model') ?? 'gemini-2.5-flash')
    : (getSetting('mx4_chat_model')     ?? 'gemini-2.5-flash')

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
