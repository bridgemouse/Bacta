import { generateText, generateObject, stepCountIs } from 'ai'
import { getModel } from './provider'
import { getSetting } from '../settings'
import { SECTIONS } from './sections'
import { readAllWikiPagesSync, loadHeartbeat } from './wiki'
import { queryDb, readVault, readAllWikiPages } from './tools'
import { BriefingResultSchema, type BriefingResult } from './types'
import db from '../../db/client'
import fs from 'fs'
import path from 'path'

const SYSTEM_PROMPT_PATH = path.join(process.cwd(), 'mx4', 'system-prompt.md')

function loadSystemPrompt(): string {
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
): Promise<BriefingResult> {
  const systemPrompt = loadSystemPrompt()
  const model = getModel('briefing')
  const modelId = (model as unknown as { modelId?: string }).modelId ?? getSetting('mx4_briefing_model') ?? 'unknown'

  const systemWithContext = [
    systemPrompt,
    heartbeat ? `\n\n## Standing Orders\n${heartbeat}` : '',
    `\n\n## Wiki Knowledge\n${wikiContext}`,
  ].join('')

  const sectionPrompt = `You are generating MX-4's ${sectionName} briefing.

Section focus: ${promptAddendum}

Use queryDb to pull the last 30 days of relevant metrics. Use readVault if you need personal context from the Obsidian vault. Use readAllWikiPages if you need to review accumulated knowledge.

Produce a complete analysis in your voice. Cover: what the data shows today, how it compares to the 30-day trend, what it means for Ethan's current training block, and one specific recommendation.`

  const { text: fullAnalysis } = await generateText({
    model,
    system: systemWithContext,
    prompt: sectionPrompt,
    tools: { queryDb, readVault, readAllWikiPages },
    stopWhen: stepCountIs(8),
  })

  const { object } = await generateObject({
    model,
    schema: BriefingResultSchema,
    prompt: `Extract a structured briefing from this analysis. Preserve MX-4's voice in the body field.\n\nAnalysis:\n\n${fullAnalysis}`,
  })

  const briefing: BriefingResult = object

  db.prepare(
    'INSERT OR REPLACE INTO mx4_briefings (section, content_json, generated_at, model) VALUES (?, ?, ?, ?)'
  ).run(sectionId, JSON.stringify(briefing), new Date().toISOString(), modelId)

  return briefing
}

export async function runOrchestrator(): Promise<void> {
  console.log('[mx4] orchestrator run started', new Date().toISOString())

  const wikiContext = readAllWikiPagesSync()
  const heartbeat   = loadHeartbeat()

  const errors: { section: string; error: string }[] = []

  for (const section of SECTIONS) {
    let attempts = 0
    while (attempts < 3) {
      try {
        await runSection(section.id, section.name, section.promptAddendum, wikiContext, heartbeat)
        console.log(`[mx4] ${section.id} briefing written`)
        break
      } catch (e: unknown) {
        attempts++
        const message = e instanceof Error ? e.message : String(e)
        if (message.includes('quota') || message.includes('rate') || message.includes('429')) {
          console.error(`[mx4] ${section.id} usage limit error — aborting run`)
          errors.push({ section: section.id, error: message })
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
  }

  if (errors.length > 0) {
    console.error('[mx4] run completed with errors:', errors)
  } else {
    console.log('[mx4] orchestrator run complete')
  }
}
