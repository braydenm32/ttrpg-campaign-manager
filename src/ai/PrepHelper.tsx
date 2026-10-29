import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Sparkle } from '@phosphor-icons/react'
import { blankPrep, db, newId, type Entity, type Session, type World } from '../db'
import { Help } from '../help'
import { Ico } from '../icons'
import { Markdown } from '../Markdown'
import { editPrep } from '../prep'
import { partyOf } from '../sessions'
import { MODEL } from './claude'
import { ClaudeJob } from './ClaudeJob'
import { useKept } from './kept'
import { describeStep, MARKUP_NOTE, pageByName, pageText, sessionIndex, sessionText, worldHeader, worldIndex, worldTools } from './worldText'

/**
 * The prep helper: Claude reads the last sessions, the open threads and the party, then suggests a
 * strong start, scenes, secrets and clues, and who to have ready. The GM ticks what they want and it
 * goes onto the prep sheet.
 */

interface Suggestion {
  strongStart: string
  scenes: string[]
  clues: string[]
  ready: string[]
  /** Claude's answer as written, when it didn't use the headings the app reads. */
  raw?: string
}

const HEADS = { strongStart: /^#{1,3}\s*Strong start/i, scenes: /^#{1,3}\s*Scenes/i, clues: /^#{1,3}\s*Secrets/i, ready: /^#{1,3}\s*Have ready/i }

export function parsePrep(text: string): Suggestion {
  const out: Suggestion = { strongStart: '', scenes: [], clues: [], ready: [] }
  let part: keyof typeof HEADS | undefined
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    const head = (Object.keys(HEADS) as (keyof typeof HEADS)[]).find((k) => HEADS[k].test(line))
    if (head) {
      part = head
      continue
    }
    if (!part || /^#/.test(line)) continue
    if (part === 'strongStart') out.strongStart += (out.strongStart ? '\n' : '') + line
    else if (/^\s*([-*]|\d+[.)])\s+/.test(line)) out[part].push(line.replace(/^\s*([-*]|\d+[.)])\s+/, '').trim())
    else if (line.trim() && out[part].length) out[part][out[part].length - 1] += ` ${line.trim()}`
  }
  out.strongStart = out.strongStart.trim()
  // Nothing in the usual headings: keep the answer as it came, so it isn't lost.
  if (!out.strongStart && !out.scenes.length && !out.clues.length && !out.ready.length) out.raw = text.trim()
  return out
}

export function PrepHelper({ world, session, entities }: { world: World; session: Session; entities: Entity[] }) {
  const sessions = useLiveQuery(() => db.sessions.where({ worldId: world.id }).toArray(), [world.id]) ?? []
  // Kept outside the panel, so the suggestion is still here after a look at another page (see kept.ts).
  const kept = `prep:${session.id}`
  const [suggestion, setSuggestion] = useKept<Suggestion | undefined>(kept, undefined)
  const [skipped, setSkipped] = useKept<string[]>(`${kept}:skip`, [])
  const skip = new Set(skipped)
  const [added, setAdded] = useState(false)

  const build = () => {
    const earlier = sessions
      .filter((s) => s.campaignId === session.campaignId && s.number < session.number)
      .sort((a, b) => b.number - a.number)
      .slice(0, 2)
      .reverse()
    const party = partyOf(entities, session.campaignId, { activeOnly: true })
    const open = entities.filter((e) => (e.type === 'thread' && (e.threadStatus === 'open' || e.threadStatus === 'active')) || e.questStatus === 'open' || e.questStatus === 'active')
    const clocks = entities.flatMap((e) => (e.clocks ?? []).filter((c) => c.filled < c.segments).map((c) => `- ${c.name} (on [[${e.name}]]): ${c.filled} of ${c.segments}`))
    const prep = { ...blankPrep(), ...session.prep }
    const planned = [
      prep.strongStart.trim() && `Strong start: ${prep.strongStart.trim()}`,
      ...prep.scenes.map((x) => `- Scene: ${x.text}`),
      ...prep.clues.map((x) => `- Clue: ${x.text}`),
    ].filter(Boolean)
    const system = `You help a tabletop roleplaying game master prepare their next session, in the style of "Return of the Lazy Dungeon Master": a strong start, a few likely scenes, secrets and clues that could be found in many ways, and the people to have ready.

Build on what has actually happened and on threads that are open. Prefer what's already in the world over inventing; when you do invent, keep it small and say so. Read any page you need with read_pages.

Answer with exactly these four headings and nothing before the first:
## Strong start
One short paragraph: the session opens in the middle of something happening.
## Scenes
3 to 5 bullets, one likely scene each, one line each.
## Secrets and clues
6 to 10 bullets, each one secret or clue the players could learn, written as a fact, one line each. Don't repeat clues already found.
## Have ready
3 to 6 bullets: "[[Name]]: why they matter this session".

Write the name of any page you mention exactly as written, inside double square brackets like [[Name]].

${worldHeader(world)}
${MARKUP_NOTE}

Every page in the world:
${worldIndex(world, entities)}

Sessions:
${sessionIndex(sessions)}`
    const prompt = `Help me prepare session ${session.number}${session.title ? `: ${session.title}` : ''}.

${earlier.length ? `The last sessions:\n\n${earlier.map((s) => sessionText(s, world)).join('\n\n---\n\n')}` : 'This is the first session of the campaign.'}

${party.length ? `The party:\n\n${party.map((e) => pageText(e, world, entities)).join('\n\n---\n\n')}` : ''}

${open.length ? `Open quests and loose threads:\n${open.map((e) => `- [[${e.name}]]${e.summary ? `: ${e.summary}` : ''}`).join('\n')}` : ''}

${clocks.length ? `Clocks still running:\n${clocks.join('\n')}` : ''}

${planned.length ? `What I've planned so far (add to it, don't repeat it):\n${planned.join('\n')}` : ''}`.replace(/\n{3,}/g, '\n\n')
    // Planning a session from what's happened is a bigger job, so it gets the most capable model.
    return { system, prompt, tools: worldTools(world, entities, sessions), describe: describeStep, model: MODEL, expectOut: 2500 }
  }

  const add = async () => {
    if (!suggestion) return
    const keep = (part: string, list: string[]) => list.filter((_, i) => !skip.has(`${part}${i}`))
    const scenes = keep('s', suggestion.scenes)
    const clues = keep('c', suggestion.clues)
    await editPrep(session.id, (p) => {
      if (suggestion.strongStart && !skip.has('start')) p.strongStart = p.strongStart.trim() ? `${p.strongStart.trim()}\n\n${suggestion.strongStart}` : suggestion.strongStart
      p.scenes.push(...scenes.map((text) => ({ id: newId(), text, done: false })))
      p.clues.push(...clues.map((text) => ({ id: newId(), text, done: false })))
    })
    // The people to have ready join the pages linked to this session, so they're at hand in the Lectern.
    const ready = keep('r', suggestion.ready)
      .map((line) => pageByName(line.match(/\[\[([^\]|]+)/)?.[1] ?? '', entities)?.id)
      .filter((id): id is string => !!id && !session.entityIds.includes(id))
    if (ready.length) await db.sessions.update(session.id, { entityIds: [...session.entityIds, ...new Set(ready)] })
    setAdded(true)
    setSuggestion(undefined)
  }

  const tick = (k: string) => (
    <input
      type="checkbox"
      checked={!skip.has(k)}
      onChange={() => setSkipped((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))}
    />
  )

  return (
    <section className="card prep-helper">
      <h3>
        <Ico as={Sparkle} /> Prep with Claude <Help topic="prepHelper" />
      </h3>
      {!suggestion || added ? (
        <>
          <p className="muted small">
            {added
              ? '✓ Added to your prep sheet. Ask again for more ideas.'
              : 'Claude reads the last two sessions, the party, open threads and clocks, and suggests a strong start, scenes, secrets and clues, and who to have ready.'}
          </p>
          <ClaudeJob
            worldId={world.id}
            jobId={kept}
            jobTitle={`Prep ideas for session ${session.number}`}
            label="Suggest prep"
            build={build}
            priceKey={`${session.id}:${sessions.length}:${entities.length}`}
            onResult={(text) => {
              setSuggestion(parsePrep(text))
              setSkipped([])
              setAdded(false)
            }}
          />
        </>
      ) : (
        <div className="prep-suggestion">
          {suggestion.raw !== undefined && (
            <div className="notice small">
              <p>Claude’s answer didn’t come in the shape the app can read, so nothing can be added from it here. This is what it wrote:</p>
              {suggestion.raw ? <Markdown text={suggestion.raw} entities={entities} worldId={world.id} showSecrets /> : <p className="muted">(Nothing.)</p>}
            </div>
          )}
          {suggestion.raw === undefined && <p className="muted small">Untick anything you don’t want, then add the rest to your prep sheet.</p>}
          {suggestion.strongStart && (
            <label className="suggest-item">
              {tick('start')}
              <span>
                <b>Strong start:</b> <Markdown text={suggestion.strongStart} entities={entities} worldId={world.id} showSecrets />
              </span>
            </label>
          )}
          {(
            [
              ['s', 'Scenes', suggestion.scenes],
              ['c', 'Secrets and clues', suggestion.clues],
              ['r', 'Have ready (linked to this session)', suggestion.ready],
            ] as const
          ).map(
            ([k, title, list]) =>
              list.length > 0 && (
                <div key={k}>
                  <h4>{title}</h4>
                  {list.map((text, i) => (
                    <label key={i} className="suggest-item">
                      {tick(`${k}${i}`)}
                      <span>
                        <Markdown text={text} entities={entities} worldId={world.id} showSecrets />
                      </span>
                    </label>
                  ))}
                </div>
              ),
          )}
          <div className="row">
            {suggestion.raw === undefined && (
              <button className="primary" onClick={add}>
                Add to my prep
              </button>
            )}
            <button className="ghost" onClick={() => setSuggestion(undefined)}>
              Throw these away
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
