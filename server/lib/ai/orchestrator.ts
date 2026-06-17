import { generateText, generateObject, stepCountIs, type ToolSet } from 'ai'
import { getModel } from './provider'
import { getSetting } from '../settings'
import { SECTIONS } from './sections'
import { readAllWikiPagesSync, loadHeartbeat } from './wiki'
import { assembleSystemPrompt } from './prompt'
import { queryDb, readAllWikiPages } from './tools'
import { research } from './research'
import { getVaultTools, isVaultEnabled } from './vaultClient'
import { BriefingResultSchema, type BriefingResult } from './types'
import { wrapSession } from './wrap'
import { notifyFailure } from '../notify'
import db from '../../db/client'
import fs from 'fs'
import path from 'path'

const SYSTEM_PROMPT_PATH = path.join(process.cwd(), 'mx4', 'system-prompt.md')

export function loadSystemPrompt(): string {
  try {
    return fs.readFileSync(SYSTEM_PROMPT_PATH, 'utf-8')
  } catch {
    return 'You are MX-4, a data analysis droid. Analyze Ethan\'s biometric data and provide insights.'
  }
}

async function runSection(
  sectionId: string,
  sectionName: string,
  promptAddendum: string,
  wikiContext: string,
  heartbeat: string,
  systemPrompt: string,
): Promise<BriefingResult> {
  const model = getModel('briefing')
  const modelId = (model as unknown as { modelId?: string }).modelId ?? getSetting('mx4_briefing_model') ?? 'unknown'

  const systemWithContext = assembleSystemPrompt(systemPrompt, heartbeat, wikiContext)

  const sectionPrompt = `You are generating MX-4's ${sectionName} briefing.

Section focus: ${promptAddendum}

Use queryDb to pull the last 30 days of relevant metrics. ${isVaultEnabled() ? 'Use get_wiki_index then read_wiki_page or search_wiki to pull personal context from the connected vault.' : ''} Use readAllWikiPages if you need to review accumulated MX-4 knowledge.

Produce a complete analysis in your voice. Cover: what the data shows today, how it compares to the 30-day trend, what it means for Ethan's current training block, and one specific recommendation.`

  const { text: fullAnalysis } = await generateText({
    model,
    system: systemWithContext,
    prompt: sectionPrompt,
    // Briefing generation is READ-ONLY: analysis only. Giving the model write
    // tools here made it end with wiki-update meta ("briefing generated, wiki
    // updated") or exhaust its steps. Wiki curation is a separate concern (the
    // SYNC WIKI chat skill / wrap synthesis), keeping briefings clean.
    tools: {
      queryDb,
      readAllWikiPages,
      research,
      ...(isVaultEnabled() ? await getVaultTools() : {}),
    } as ToolSet,
    stopWhen: stepCountIs(12),
  })

  // If the model exhausted its step budget on tool calls without emitting prose,
  // fullAnalysis is empty. Throw so the orchestrator's retry loop re-runs the
  // section instead of writing an empty/meta "no analysis" briefing.
  if (!fullAnalysis || !fullAnalysis.trim()) {
    throw new Error(`empty analysis for ${sectionName} — model produced no text (likely exhausted tool steps)`)
  }

  // No tools — avoids Gemini structured-output + tools conflict
  const { object } = await generateObject({
    model,
    schema: BriefingResultSchema,
    prompt: `Extract a structured briefing from this analysis.\n\n- summary: 3–5 punchy prose sentences (no headers) — key finding, implication, directive. This is what appears on the card.\n- body: full structured markdown. Each section MUST start on its own line. Format:\n\n## SECTION HEADER\nContent here.\n\n## NEXT SECTION\nContent here.\n\nBold all metric values: **60ms**, **452**. Bullet lists with - prefix. End with ## DIRECTIVE.\n- Preserve MX-4's voice throughout.\n\nAnalysis:\n\n${fullAnalysis}`,
  })

  const briefing: BriefingResult = object

  db.prepare(
    'INSERT OR REPLACE INTO mx4_briefings (section, content_json, generated_at, model) VALUES (?, ?, ?, ?)'
  ).run(sectionId, JSON.stringify(briefing), new Date().toISOString(), modelId)

  return briefing
}

export async function runSectionById(sectionId: string): Promise<void> {
  const section = SECTIONS.find(s => s.id === sectionId)
  if (!section) throw new Error(`Unknown section: ${sectionId}`)

  const systemPrompt = loadSystemPrompt()
  const wikiContext  = readAllWikiPagesSync()
  const heartbeat    = loadHeartbeat()

  await runSection(section.id, section.name, section.promptAddendum, wikiContext, heartbeat, systemPrompt)
  console.log(`[mx4] ${sectionId} briefing written`)
}

export async function runOrchestrator(): Promise<void> {
  console.log('[mx4] orchestrator run started', new Date().toISOString())

  const systemPrompt = loadSystemPrompt()
  const wikiContext  = readAllWikiPagesSync()
  const heartbeat    = loadHeartbeat()

  const errors: { section: string; error: string }[] = []
  let rateLimitHit = false

  for (const section of SECTIONS) {
    let attempts = 0
    while (attempts < 3) {
      try {
        await runSection(section.id, section.name, section.promptAddendum, wikiContext, heartbeat, systemPrompt)
        console.log(`[mx4] ${section.id} briefing written`)
        break
      } catch (e: unknown) {
        attempts++
        const message = e instanceof Error ? e.message : String(e)
        if (message.includes('quota') || message.includes('rate') || message.includes('429')) {
          console.error(`[mx4] ${section.id} usage limit error — aborting run`)
          errors.push({ section: section.id, error: message })
          rateLimitHit = true
          break
        }
        if (attempts >= 3) {
          console.error(`[mx4] ${section.id} failed after 3 attempts: ${message}`)
          errors.push({ section: section.id, error: message })
        } else {
          await new Promise(r => setTimeout(r, 30_000))
        }
      }
    }
    if (rateLimitHit) break
  }

  if (errors.length > 0) {
    console.error('[mx4] run completed with errors:', errors)
    await notifyFailure(
      'nightly MX-4 run failed',
      errors.map(e => `${e.section}: ${e.error}`).join('; ') + (rateLimitHit ? ' (usage limit)' : ''),
    )
  } else {
    console.log('[mx4] orchestrator run complete')
  }

  // Compact any wiki pages that have grown past the token limit.
  // Runs after briefings so it doesn't delay them, and only synthesizes —
  // no knowledge is dropped, just expressed more densely.
  try {
    await wrapSession()
  } catch (e: unknown) {
    console.error('[mx4] wrapSession failed:', e instanceof Error ? e.message : e)
  }
}
