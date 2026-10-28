import { ENTITY_LABELS, type Entity, type Session, type World } from '../db'
import { formatDate } from '../calendar'
import { transcriptText } from './transcript'
import { parseUpdates, UPDATES_HEADING, updatesInstructions } from './worldUpdates'
import { MODEL } from './claude'

export const GM_HEADING = '## GM summary'
export const PLAYER_HEADING = '## Player recap'

/**
 * The instructions and material for a recap. The same text is used for one-click recaps
 * and for "Copy for Claude", so both give the same kind of result.
 */
export function buildRecapPrompt(world: World, session: Session, entities: Entity[]) {
  const transcripts = session.recordings
    .filter((r) => r.transcript && !r.transcript.pending)
    .map((r, i, all) => {
      const t = r.transcript!
      const head = all.length > 1 ? `Recording ${i + 1} (started ${new Date(r.startedAt).toLocaleTimeString()})\n` : ''
      return head + transcriptText(t)
    })
  const bookmarks = session.recordings.flatMap((r) => r.bookmarks.map((b) => `- ${b.text}`))
  // Every page with its nicknames and one-line summary, so Claude can match misheard names and
  // tell what's new. Secret pages are marked so the player recap leaves them alone.
  const names = entities
    .filter((e) => e.type !== 'thread' && e.type !== 'table' && !e.template)
    .map((e) => {
      const about = [
        e.type === 'custom' ? 'page' : ENTITY_LABELS[e.type].one.toLowerCase(),
        e.aliases?.length ? `also called ${e.aliases.map((a) => `"${a}"`).join(', ')}` : '',
        e.questStatus ? `quest ${e.questStatus}` : '',
        e.status && e.status !== 'alive' ? e.status : '',
        e.type === 'event' ? formatDate(world.calendar, e.eventWhen, false) || e.eventDate || '' : '',
        e.visibility === 'gm' ? 'secret' : '',
      ].filter(Boolean)
      const summary = e.summary.replace(/\s+/g, ' ').trim().slice(0, 140)
      return `- ${e.name} (${about.join('; ')})${summary ? `: ${summary}` : ''}`
    })
  // The GM's plan: which scenes were reached and which clues were found (or not), for the GM summary.
  const prep = session.prep
  const planned = prep
    ? [
        ...(prep.strongStart.trim() ? [`Planned opening: ${prep.strongStart.trim()}`] : []),
        ...prep.scenes.filter((x) => x.text.trim()).map((x) => `- Scene ${x.done ? '(played)' : '(not reached)'}: ${x.text}`),
        ...prep.clues.filter((x) => x.text.trim()).map((x) => `- Clue ${x.done ? '(found)' : '(not found yet)'}: ${x.text}`),
        ...prep.encounters.map((x) => `- Fight planned: ${x.name}`),
      ]
    : []
  const threads = entities
    .filter((e) => e.type === 'thread' && (e.threadStatus === 'open' || e.threadStatus === 'active'))
    .map((e) => `- ${e.name}`)

  return `You are helping the game master of a tabletop roleplaying campaign write up a session.

World: ${world.name}${world.system ? ` (${world.system})` : ''}
Session ${session.number}: ${session.title}${session.date ? `, played ${session.date}` : ''}${session.worldDate && world.calendar ? `\nIn-world date at the start of the session: ${formatDate(world.calendar, session.worldDate, false)}` : ''}

Below is a transcript of the session recorded at the table. It was made automatically, so expect misheard words, cross-talk and out-of-character chatter. Speaker names may be generic labels. Read it for what actually happened in the story.

Write three things, using exactly these three headings and nothing before the first one:

${GM_HEADING}
For the GM's own notes. A concise account of what happened, in order, as bullet points grouped under short scene headings (use ### for those). Note decisions the players made, NPCs met, items gained or lost, promises and threats, and anything the GM said would happen later. Finish with a short "Left hanging" list of unresolved hooks and questions the players raised.

${PLAYER_HEADING}
For the players to read before next session. Two to five short paragraphs in a warm "previously on…" voice, past tense, about the characters rather than the players. Only include what happened at the table. Do not use anything from the GM's notes below, which may contain secrets.

${UPDATES_HEADING}
${updatesInstructions()}

When you mention a person, place, faction or thing from the list of known pages in the GM summary or the player recap, write it exactly as listed inside double square brackets, like [[Name]], so it links to its page. Only link names from the list. Use Markdown. Pages marked "secret" are hidden from the players: leave them out of the player recap unless the players actually met or learned about them at the table.
${names.length ? `\nKnown pages in the world (name, kind, other names, summary):\n${names.join('\n')}\n` : ''}${threads.length ? `\nLoose threads the GM is tracking (mention any that moved):\n${threads.join('\n')}\n` : ''}${bookmarks.length ? `\nMoments the GM bookmarked while recording:\n${bookmarks.join('\n')}\n` : ''}${planned.length ? `\nThe GM's prep for this session (secret, for the GM summary only; say which unfound clues are still in play):\n<gm_prep>\n${planned.join('\n')}\n</gm_prep>\n` : ''}${session.notes.trim() ? `\nThe GM's own notes for this session (secret, for the GM summary only):\n<gm_notes>\n${session.notes.trim()}\n</gm_notes>\n` : ''}
<transcript>
${transcripts.join('\n\n') || '(No transcript. Work from the GM notes.)'}
</transcript>`
}

/** Splits Claude's reply into the GM summary, the player recap and the suggested world updates. */
export function parseRecap(text: string) {
  const t = text.replace(/\r\n/g, '\n').trim()
  const heads = [
    { key: 'gm', at: t.search(/^#{1,3}\s*GM summary\s*$/im) },
    { key: 'players', at: t.search(/^#{1,3}\s*Player recap\s*$/im) },
    { key: 'updates', at: t.search(/^#{1,3}\s*World updates\s*$/im) },
  ]
    .filter((h) => h.at >= 0)
    .sort((a, b) => a.at - b.at)
  const part: Record<string, string> = {}
  heads.forEach((h, i) => (part[h.key] = t.slice(h.at, heads[i + 1]?.at ?? t.length).replace(/^.*\n?/, '').trim()))
  // Without headings, the whole reply is the GM's: nothing reaches players by accident.
  if (!heads.length) part.gm = t
  else if (heads[0].at > 0 && !part.gm) part.gm = t.slice(0, heads[0].at).trim()
  return { gm: part.gm ?? '', players: part.players ?? '', updates: parseUpdates(part.updates ?? '') }
}

/** Writes the recap with the GM's own Anthropic API key, streaming text as it arrives. */
export async function recapWithClaude(prompt: string, apiKey: string, onText: (soFar: string) => void, signal: AbortSignal) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  // The key belongs to the person using this device and is only ever sent to Anthropic.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
  let soFar = ''
  try {
    const stream = client.beta.messages.stream(
      {
        model: MODEL,
        max_tokens: 32000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        messages: [{ role: 'user', content: prompt }],
      },
      { signal },
    )
    stream.on('text', (delta) => {
      soFar += delta
      onText(soFar)
    })
    const message = await stream.finalMessage()
    if (message.stop_reason === 'refusal') throw new Error('Claude declined to write this recap. You can still use "Copy for Claude" instead.')
    const text = message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
    return { text, inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens }
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new Error('Anthropic didn’t accept the API key. Check it in World settings → AI tools.')
    if (err instanceof Anthropic.RateLimitError) throw new Error('Anthropic says you’re over your limit for now. Wait a minute and try again.')
    if (err instanceof Anthropic.APIError && /credit/i.test(err.message))
      throw new Error('Your Anthropic account is out of credit. Add some at console.anthropic.com → Billing.')
    if (err instanceof Anthropic.APIConnectionError) throw new Error('Could not reach Anthropic. Check your internet connection.')
    throw err
  }
}

/** Rough cost in US dollars at Claude Opus 5.5 prices ($4 in / $20 out per million tokens). */
export const recapCost = (input: number, output: number) => (input * 4 + output * 20) / 1e6

/** About four characters per token for English text. */
export const estimateTokens = (text: string) => Math.ceil(text.length / 4)
