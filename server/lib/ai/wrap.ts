import { generateText } from 'ai'
import { getModel } from './provider'
import { listWikiPagesSync, archiveWikiPageSync, writeWikiPageSync, readAllWikiPagesSync } from './wiki'

const SYNTHESIS_PROMPT = (name: string, content: string) =>
  `The following wiki page has grown too long. Synthesize it into a denser version that preserves all established patterns and key findings but removes redundancy. Keep it under 1200 words. Write in a factual, analytical register.\n\nPage: ${name}\n\n${content}`

export async function wrapSession(): Promise<void> {
  const pages = listWikiPagesSync()

  for (const page of pages) {
    if (page.tokenEstimate > 2000) {
      try {
        const wikiContext = readAllWikiPagesSync()
        archiveWikiPageSync(page.name)

        const { text: synthesis } = await generateText({
          model:  getModel('briefing'),
          prompt: SYNTHESIS_PROMPT(page.name, wikiContext),
        })

        writeWikiPageSync(page.name, synthesis)
        console.log(`[mx4:wrap] synthesized ${page.name} (was ${page.tokenEstimate} tokens)`)
      } catch (e: unknown) {
        console.error(`[mx4:wrap] failed to synthesize ${page.name}:`, e instanceof Error ? e.message : e)
      }
    }
  }
}
