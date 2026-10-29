import { useEffect, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Books, ChatCircleText, Check, ClipboardText, PaperPlaneRight, PenNib, Scales, Sparkle, X } from '@phosphor-icons/react'
import { db, type Entity, type Session, type World } from '../db'
import { Help } from '../help'
import { useVisibleEntities, useWorld } from '../hooks'
import { Ico } from '../icons'
import { Markdown, findBacklinks } from '../Markdown'
import { useViewMode } from '../viewMode'
import { Empty } from '../components'
import { askClaude, dollars, estimateTokens, claudeCost, MODEL, modelName, QUICK_MODEL, usageCost, type ClaudeMessage } from './claude'
import { ClaudeJob, ModelTag } from './ClaudeJob'
import { moveJob, startJob, stopJob, takeFinished, useJob } from './jobs'
import { getKept, setKept, useKept } from './kept'
import { useAiSettings } from './settings'
import { describeStep, findPages, MARKUP_NOTE, pageByName, pageText, sessionIndex, sessionText, worldHeader, worldIndex, worldTools } from './worldText'

/**
 * The Archivist: Claude, reading the GM's own world. Ask it anything about your notes, or have it
 * look for places where the notes disagree with each other. GM only.
 */
export default function Archivist() {
  const { worldId, world } = useWorld()
  const { isGM } = useViewMode()
  const entities = useVisibleEntities(worldId)
  const sessions = useLiveQuery(() => db.sessions.where({ worldId }).toArray(), [worldId]) ?? []
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'check' ? 'check' : 'ask'
  if (!world) return null
  if (!isGM) return <Empty>The Archivist is for the GM.</Empty>
  return (
    <div className="page archivist">
      <header className="page-header">
        <h1>
          <Ico as={Books} /> The Archivist <Help topic="archivist" />
        </h1>
      </header>
      <p className="muted">Claude, reading your own world. It answers from your pages and sessions (secrets included), and links what it mentions. Nothing changes in your world unless you change it.</p>
      <div className="segmented tabs">
        <button className={tab === 'ask' ? 'on' : ''} onClick={() => setParams({}, { replace: true })}>
          <Ico as={ChatCircleText} /> Ask your world
        </button>
        <button className={tab === 'check' ? 'on' : ''} onClick={() => setParams({ tab: 'check' }, { replace: true })}>
          <Ico as={Scales} /> Check for contradictions
        </button>
      </div>
      {tab === 'ask' ? <Ask world={world} entities={entities} sessions={sessions} /> : <Continuity world={world} entities={entities} sessions={sessions} />}
    </div>
  )
}

// ---------- Ask your world ----------

function askSystem(world: World, entities: Entity[], sessions: Session[], copy?: { question: string }) {
  const found = copy ? findPages(copy.question, entities, 20) : []
  return `You are the Archivist for a tabletop roleplaying game master's world. The GM asks you questions about their own notes.

How to answer:
- Answer only from what is written in this world.${copy ? ' The pages most likely to matter are written out in full below.' : ' The index below lists every page; read the pages you need with read_pages (and search_world when the index doesn’t show where something is) before you answer. Don’t answer from the index alone.'}
- If the notes don't say, say so plainly. You may then offer an idea that fits, clearly labelled as a suggestion.
- Give the short answer first, then any detail. Keep it brief. Use Markdown.
- Write the name of any page you mention exactly as listed, inside double square brackets like [[Name]], so it links.
- Say when something is a secret the players don't know.

${worldHeader(world)}
${MARKUP_NOTE}

Every page in the world (name, kind, other names, summary):
${worldIndex(world, entities)}
${sessions.length ? `\nSessions played:\n${sessionIndex(sessions)}\n` : ''}${found.length ? `\nPages that may matter, in full:\n\n${found.map((e) => pageText(e, world, entities)).join('\n\n---\n\n')}\n` : ''}`
}

interface Turn {
  q: string
  a: string
  note?: string
}

const STARTERS = ['Who in the world would want the party dead, and why?', 'What do the players know about the main villain so far?', 'Which clues haven’t the players found yet?', 'What’s happening in the place the party is heading to?']

/** One conversation with the Archivist: what's shown, and the exchange as Claude saw it (with the pages it read), so follow-ups know what came before. */
interface Conversation {
  turns: Turn[]
  history: ClaudeMessage[]
  spent: number
}
const NEW_CONVERSATION: Conversation = { turns: [], history: [], spent: 0 }

/** Questions are short jobs, so they use the quicker model. */
const ASK_MODEL = QUICK_MODEL

function Ask({ world, entities, sessions }: { world: World; entities: Entity[]; sessions: Session[] }) {
  const settings = useAiSettings()
  const key = settings.anthropicKey.trim()
  // The conversation and the question being typed outlive this panel, and so does a question
  // Claude is still answering (see jobs.ts), so going to read a page and coming back loses nothing.
  const talkKey = `ask:${world.id}`
  const [{ turns }, setTalk] = useKept<Conversation>(talkKey, NEW_CONVERSATION)
  const [question, setQuestion] = useKept(`${talkKey}:draft`, '')
  const job = useJob(talkKey)
  const writing = job?.status === 'writing' ? job : undefined
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string>()
  const [pasted, setPasted] = useState('')
  const { pathname, search } = useLocation()
  useEffect(() => {
    if (!job) return
    if (job.status === 'writing') return moveJob(job.id, pathname, pathname + search)
    takeFinished(job, undefined, setError)
  }, [job, pathname, search])

  const ask = (q: string) => {
    if (!q.trim() || writing) return
    setError('')
    const talk = getKept<Conversation>(talkKey) ?? NEW_CONVERSATION
    const short = q.length > 40 ? `${q.slice(0, 40).trimEnd()}…` : q
    startJob(
      { id: talkKey, worldId: world.id, title: `An answer to “${short}”`, path: pathname, href: pathname + search, model: ASK_MODEL, asked: q },
      async ({ signal, onText, onStep }) => {
        const res = await askClaude({
          apiKey: key,
          model: ASK_MODEL,
          system: askSystem(world, entities, sessions),
          messages: [...talk.history, { role: 'user', content: q }],
          tools: worldTools(world, entities, sessions),
          describe: describeStep,
          signal,
          onText,
          onStep,
        })
        // Added to the conversation as soon as it's done, wherever the GM is by then.
        const cost = usageCost(ASK_MODEL, res.usage)
        const now = getKept<Conversation>(talkKey) ?? NEW_CONVERSATION
        const spent = now.spent + cost
        const note = `${res.warning ? `${res.warning} ` : ''}About ${dollars(cost)}${now.turns.length ? `, ${dollars(spent)} so far` : ''}, with ${modelName(ASK_MODEL)}.`
        setKept<Conversation>(talkKey, { turns: [...now.turns, { q, a: res.text, note }], history: res.messages, spent })
        if (getKept(`${talkKey}:draft`) === q) setKept(`${talkKey}:draft`, '')
        return {}
      },
    )
  }

  const copy = async () => {
    const q = question.trim()
    if (!q) return
    setError('')
    try {
      await navigator.clipboard.writeText(`${askSystem(world, entities, sessions, { question: q })}\n\nThe GM asks: ${q}`)
      setCopied(q)
    } catch {
      setError('Couldn’t copy. Your browser may have blocked the clipboard.')
    }
  }

  const firstCost = claudeCost(ASK_MODEL, estimateTokens(askSystem(world, entities, sessions)) * 1.4, 800)

  return (
    <section className="ask-world">
      {turns.length === 0 && !writing && (
        <div className="ask-starters">
          <span className="muted small">Try:</span>
          {STARTERS.map((s) => (
            <button key={s} className="chip" onClick={() => setQuestion(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
      {turns.map((t, i) => (
        <div key={i} className="ask-turn">
          <p className="ask-q">{t.q}</p>
          <div className="card ask-a">
            <Markdown text={t.a} entities={entities} worldId={world.id} showSecrets />
            <div className="row spread small muted">
              <span>{t.note}</span>
              <button className="ghost small" onClick={() => navigator.clipboard.writeText(t.a).catch(() => undefined)}>
                <Ico as={ClipboardText} /> Copy
              </button>
            </div>
          </div>
        </div>
      ))}
      {writing && (
        <div className="ask-turn">
          <p className="ask-q">{writing.asked}</p>
          <div className="card ask-a">
            <div className="row spread small">
              <span>
                <Ico as={PenNib} /> {writing.step && !writing.text ? `${writing.step}…` : writing.text ? 'Writing…' : 'Looking through your world…'}
              </span>
              <button className="ghost small" onClick={() => stopJob(talkKey)}>
                Stop
              </button>
            </div>
            {writing.text ? <Markdown text={writing.text} entities={entities} worldId={world.id} showSecrets /> : <progress />}
          </div>
        </div>
      )}
      <form
        className="ask-box"
        onSubmit={(e) => {
          e.preventDefault()
          if (key) ask(question)
          else copy()
        }}
      >
        <textarea
          rows={2}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              e.currentTarget.form?.requestSubmit()
            }
          }}
          placeholder={turns.length ? 'Ask a follow-up…' : 'Ask anything about your world'}
          disabled={!!writing}
          aria-label="Your question"
        />
        <div className="row wrap">
          <button className="primary" disabled={!question.trim() || !!writing || !key} title={key ? 'Uses your Anthropic API key' : 'Add an Anthropic API key in World settings first'}>
            <Ico as={PaperPlaneRight} /> Ask{!turns.length && question.trim() ? ` (about ${dollars(firstCost)})` : ''}
          </button>
          {key && !turns.length && question.trim() && <ModelTag model={ASK_MODEL} />}
          <button type="button" onClick={copy} disabled={!question.trim() || !!writing} title="Copies your question with the pages that matter. Paste it into claude.ai.">
            <Ico as={ClipboardText} /> Copy for Claude
          </button>
          {turns.length > 0 && !writing && (
            <button
              type="button"
              className="ghost"
              onClick={() => setTalk(NEW_CONVERSATION)}
            >
              New conversation
            </button>
          )}
        </div>
      </form>
      {!key && <p className="muted small">“Copy for Claude” is free with your Claude subscription: it copies your question with the pages most likely to matter. For answers right here, add an Anthropic API key in World settings → AI tools.</p>}
      {copied && (
        <div className="recap-paste">
          <p className="small">
            ✓ Copied. Open{' '}
            <a href="https://claude.ai/new" target="_blank" rel="noreferrer">
              claude.ai
            </a>
            , paste it in and send. Paste the answer here to keep it with its links.
          </p>
          <textarea rows={4} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Paste Claude’s answer here" />
          <div className="row">
            <button
              className="primary"
              disabled={!pasted.trim()}
              onClick={() => {
                setTalk((t) => ({ ...t, turns: [...t.turns, { q: copied, a: pasted, note: 'From claude.ai.' }] }))
                setPasted('')
                setCopied(undefined)
                setQuestion('')
              }}
            >
              Show it here
            </button>
            <button className="ghost" onClick={() => setCopied(undefined)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && <p className="error small">{error}</p>}
    </section>
  )
}

// ---------- Continuity check ----------

interface Issue {
  id: string
  title: string
  text: string
}
interface CheckResult {
  at: number
  scope: string
  issues: Issue[]
  dismissed: string[]
}

const NONE = 'No contradictions found.'

/** Splits Claude's list into one problem per bullet: "- **Title**: what's wrong…". */
export function parseIssues(text: string): Issue[] {
  const items: string[] = []
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (/^([-*]|\d+[.)])\s+/.test(line)) items.push(line.replace(/^([-*]|\d+[.)])\s+/, ''))
    else if (items.length && line.trim() && !/^#/.test(line)) items[items.length - 1] += `\n${line.trim()}`
  }
  return items.map((raw) => {
    const m = raw.match(/^\*\*(.+?)\*\*[:.\s—–-]*([\s\S]*)$/)
    const title = (m ? m[1] : raw.split(/[.:]/)[0]).replace(/[:.]$/, '').trim()
    const body = (m ? m[2] : raw).trim()
    // The same problem found twice keeps the same id, so a dismissed one stays dismissed.
    let h = 0
    for (const c of title.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) | 0
    return { id: `i${(h >>> 0).toString(36)}`, title, text: body }
  })
}

/** Only Claude's exact "none found" counts as an all-clear: an answer in another shape (an apology, say) is shown as it came. */
function readIssues(text: string): Issue[] {
  const issues = parseIssues(text)
  if (issues.length || !text.trim()) return issues
  return [{ id: 'unlisted', title: 'Claude’s answer (not in the usual list)', text: text.trim() }]
}

const storeKey = (worldId: string) => `codex.continuity.${worldId}`
function loadCheck(worldId: string): CheckResult | undefined {
  try {
    return JSON.parse(localStorage.getItem(storeKey(worldId)) ?? 'null') ?? undefined
  } catch {
    return undefined
  }
}
function saveCheck(worldId: string, r: CheckResult) {
  try {
    // Kept on this device only: it quotes secrets.
    localStorage.setItem(storeKey(worldId), JSON.stringify(r))
  } catch {
    // Storage full or blocked: the result lasts until the page closes.
  }
}

/** A page plus everything it links to, links to it, sits in or holds. */
function neighbours(page: Entity, entities: Entity[]) {
  const ids = new Set([page.id])
  if (page.parentId) ids.add(page.parentId)
  page.relations?.forEach((r) => ids.add(r.to))
  for (const m of page.body.matchAll(/\[\[([^\]|]+)/g)) {
    const e = pageByName(m[1], entities)
    if (e) ids.add(e.id)
  }
  entities.filter((e) => e.parentId === page.id || e.relations?.some((r) => r.to === page.id)).forEach((e) => ids.add(e.id))
  findBacklinks(page, entities).forEach((e) => ids.add(e.id))
  return entities.filter((e) => ids.has(e.id))
}

function Continuity({ world, entities, sessions }: { world: World; entities: Entity[]; sessions: Session[] }) {
  const [result, setResult] = useState<CheckResult | undefined>(() => loadCheck(world.id))
  const [scope, setScope] = useState<'all' | 'page'>('all')
  const [pageName, setPageName] = useState('')
  const page = scope === 'page' ? pageByName(pageName, entities) : undefined
  const update = (r: CheckResult) => {
    setResult(r)
    saveCheck(world.id, r)
  }

  const build = () => {
    const pages = page ? neighbours(page, entities) : entities.filter((e) => !e.template && e.type !== 'table')
    const system = `You check a tabletop roleplaying game master's world for continuity problems: places where the notes contradict each other.

Look for things like: a character who is dead in one place and active in another; dates, ages or distances that don't add up; someone in two places at once; names spelled two ways for the same thing; relationships described differently on each side; a recap or session note that disagrees with a page; a quest or status that doesn't match what happened. Ignore things that are simply unknown or unwritten, deliberate mysteries, and rumours or lies that a page marks as untrue.

Write each problem as one bullet starting with a short bold title, then say what disagrees and where, then suggest a fix, e.g.
- **Brannoc's age**: [[Brannoc Saltash]] says he is 40, but [[The Burning of Saltmere]] has him fighting there 50 years ago. Make him older, or move the battle.

Write the name of every page you mention inside double square brackets exactly as written, so it links. Put the most serious problems first. Write nothing before or after the list. If you find none, write exactly: ${NONE}

${worldHeader(world)}
${MARKUP_NOTE}`
    const prompt = page
      ? `Check ${page.name} against the pages around it.\n\n${pages.map((e) => pageText(e, world, entities)).join('\n\n---\n\n')}\n\nThe rest of the world, for reference (read any of it with read_pages if you need to):\n${worldIndex(world, entities)}`
      : `Here is the whole world.\n\n${pages.map((e) => pageText(e, world, entities)).join('\n\n---\n\n')}${sessions.length ? `\n\n---\n\nSessions:\n\n${[...sessions].sort((a, b) => a.number - b.number).map((s) => sessionText(s, world)).join('\n\n---\n\n')}` : ''}`
    return {
      system,
      prompt,
      tools: page ? worldTools(world, entities, sessions) : undefined,
      describe: describeStep,
      // Reading the whole world for contradictions is a big job: the most capable model.
      model: MODEL,
      maxTokens: 32000,
      expectOut: 4000,
    }
  }

  const shown = result?.issues.filter((i) => !result.dismissed.includes(i.id)) ?? []
  return (
    <section className="continuity">
      <p className="muted small">
        Claude reads {scope === 'all' ? 'every page and session' : 'one page and every page around it'} and lists where your notes disagree with each other, with a suggested fix. <Help topic="continuity" />
      </p>
      <ClaudeJob
        worldId={world.id}
        jobId={`continuity:${world.id}`}
        jobTitle="A check for contradictions"
        label="Check now"
        build={build}
        disabled={scope === 'page' && !page}
        priceKey={`${scope}:${page?.id ?? ''}:${entities.length}`}
        extra={
          <>
            <select value={scope} onChange={(e) => setScope(e.target.value as 'all' | 'page')} aria-label="What to check">
              <option value="all">The whole world</option>
              <option value="page">One page and its neighbours</option>
            </select>
            {scope === 'page' && (
              <>
                <input list="continuity-pages" value={pageName} onChange={(e) => setPageName(e.target.value)} placeholder="Which page?" aria-label="Page to check" />
                <datalist id="continuity-pages">
                  {entities.map((e) => (
                    <option key={e.id} value={e.name} />
                  ))}
                </datalist>
              </>
            )}
          </>
        }
        onResult={(text) =>
          update({
            at: Date.now(),
            scope: page ? page.name : 'The whole world',
            issues: text.includes(NONE) ? [] : readIssues(text),
            dismissed: result?.dismissed ?? [],
          })
        }
      />
      {result && (
        <div className="continuity-results">
          <h3>
            {result.scope}, checked {new Date(result.at).toLocaleDateString()}
          </h3>
          {shown.length === 0 ? (
            <p className="muted">
              <Ico as={Check} /> {result.issues.length ? 'You’ve dealt with everything it found.' : 'No contradictions found.'}
            </p>
          ) : (
            shown.map((i) => (
              <div key={i.id} className="card continuity-issue">
                <div className="row spread">
                  <strong>
                    <Ico as={Sparkle} /> {i.title}
                  </strong>
                  <button className="ghost small" title="Fixed, or not a problem: hide it" onClick={() => update({ ...result, dismissed: [...result.dismissed, i.id] })}>
                    <Ico as={X} /> Done
                  </button>
                </div>
                <Markdown text={i.text} entities={entities} worldId={world.id} showSecrets />
              </div>
            ))
          )}
          {result.dismissed.length > 0 && (
            <button className="link small" onClick={() => update({ ...result, dismissed: [] })}>
              Show the {result.dismissed.length} you hid
            </button>
          )}
        </div>
      )}
    </section>
  )
}
