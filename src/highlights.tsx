import { useState } from 'react'
import { BookOpenText, ChatCenteredText, Sparkle, Trophy } from '@phosphor-icons/react'
import { db, newId, type Campaign, type Entity, type Session, type SessionHighlight, type World } from './db'
import { DraftText } from './components'
import { Help } from './help'
import { Ico } from './icons'
import { Markdown, stripSecrets } from './Markdown'
import { SecretNamesWarning } from './SecretNamesWarning'
import { ClaudeJob } from './ai/ClaudeJob'

/**
 * Session highlights (the moments, best lines and awards of a session) and "the story so far", a
 * catch-up of the whole campaign written from the player recaps. Both are for players: they never
 * draw on GM notes.
 */

export const HIGHLIGHTS_HEADING = '## Highlights'

export const highlightsInstructions = () => `For the players to smile at. One per line, in exactly these forms, from what happened at the table:
- Moment: <a memorable moment in one sentence> (two to four of these)
- Quote: "<a line a character said in character, close to how it was said>" — <character name> (up to three, only lines really in the transcript)
- Award: <a playful title, like "Bravest Fool" or "Silver Tongue"> — <character name>: <why, in a few words> (one to three)`

const KIND_ICONS = { moment: Sparkle, quote: ChatCenteredText, award: Trophy }
const KIND_LABELS = { moment: 'Moment', quote: 'Quote', award: 'Award' }

/** Reads highlight lines ("- Quote: "…" — Wren") from Claude's reply. */
export function parseHighlights(text: string): SessionHighlight[] {
  const out: SessionHighlight[] = []
  for (const raw of text.split('\n')) {
    const m = raw.match(/^\s*[-*]\s*(moment|quote|award)s?\s*:\s*(.+)$/i)
    if (!m) continue
    const kind = m[1].toLowerCase() as SessionHighlight['kind']
    let body = m[2].trim()
    let who: string | undefined
    if (kind !== 'moment') {
      // "… — Name" or "… - Name: why"
      const split = body.match(/^(.*?)\s+[—–-]\s+([^—–]+)$/)
      if (split) {
        body = split[1].trim()
        who = split[2].trim()
      }
      if (kind === 'quote') body = body.replace(/^["“”']+|["“”']+$/g, '')
    }
    if (body) out.push({ id: newId(), kind, text: body, who })
  }
  return out.slice(0, 12)
}

/** One highlight, as players see it. */
function HighlightLine({ h, entities, worldId }: { h: SessionHighlight; entities: Entity[]; worldId: string }) {
  return (
    <>
      <span className={`highlight-kind ${h.kind}`} title={KIND_LABELS[h.kind]}>
        <Ico as={KIND_ICONS[h.kind]} />
      </span>
      <span className="highlight-text">
        {h.kind === 'quote' ? (
          <>
            <q>{h.text}</q>
            {h.who && <span className="muted"> — {h.who}</span>}
          </>
        ) : h.kind === 'award' ? (
          <>
            <b>{h.text}</b>
            {h.who && <span> — {h.who}</span>}
          </>
        ) : (
          <Markdown text={h.text} entities={entities} worldId={worldId} showSecrets={false} />
        )}
      </span>
    </>
  )
}

/** A session's highlights: read-only for players, and for the GM with a way to add and remove them. */
export function Highlights({ session, entities, worldId, isGM }: { session: Session; entities: Entity[]; worldId: string; isGM: boolean }) {
  const list = session.highlights ?? []
  const [kind, setKind] = useState<SessionHighlight['kind']>('moment')
  const [text, setText] = useState('')
  const [who, setWho] = useState('')
  if (!isGM && !list.length) return null
  const set = (next: SessionHighlight[]) => db.sessions.update(session.id, { highlights: next.length ? next : undefined })
  return (
    <section className="highlights">
      <h2>
        <Ico as={Trophy} /> Highlights <Help topic="highlights" />
      </h2>
      {list.length > 0 && (
        <ul className="highlight-list">
          {list.map((h) => (
            <li key={h.id}>
              <HighlightLine h={h} entities={entities} worldId={worldId} />
              {isGM && (
                <button className="ghost small" title="Remove" onClick={() => set(list.filter((x) => x.id !== h.id))}>
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {isGM && (
        <form
          className="row wrap highlight-add"
          onSubmit={(e) => {
            e.preventDefault()
            if (!text.trim()) return
            set([...list, { id: newId(), kind, text: text.trim(), who: kind !== 'moment' && who.trim() ? who.trim() : undefined }])
            setText('')
            setWho('')
          }}
        >
          <select value={kind} onChange={(e) => setKind(e.target.value as SessionHighlight['kind'])} aria-label="Kind">
            <option value="moment">Moment</option>
            <option value="quote">Quote</option>
            <option value="award">Award</option>
          </select>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={kind === 'quote' ? 'What was said' : kind === 'award' ? 'The award, e.g. Bravest Fool' : 'Wren talked the bridge troll into a riddle contest'}
            aria-label="Highlight"
          />
          {kind !== 'moment' && <input className="highlight-who" value={who} onChange={(e) => setWho(e.target.value)} placeholder={kind === 'quote' ? 'Who said it' : 'Who won it'} aria-label="Who" />}
          <button disabled={!text.trim()}>Add</button>
        </form>
      )}
      {isGM && session.visibility === 'gm' && list.length > 0 && <p className="muted small">Players see these once you reveal this session.</p>}
    </section>
  )
}

/** In Claude's recap draft: the highlights it picked, to keep or drop before adding them to the session. */
export function HighlightsDraft({ session, entities, worldId }: { session: Session; entities: Entity[]; worldId: string }) {
  const draft = session.recapDraft?.highlights ?? []
  const [dropped, setDropped] = useState<string[]>([])
  const [added, setAdded] = useState(false)
  if (!draft.length) return null
  const keep = draft.filter((h) => !dropped.includes(h.id))
  return (
    <>
      <h3>
        <Ico as={Trophy} /> Highlights <Help topic="highlights" />
      </h3>
      <ul className="highlight-list">
        {draft.map((h) => (
          <li key={h.id} className={dropped.includes(h.id) ? 'muted' : ''}>
            <input
              type="checkbox"
              checked={!dropped.includes(h.id)}
              onChange={(e) => setDropped(e.target.checked ? dropped.filter((x) => x !== h.id) : [...dropped, h.id])}
              aria-label="Keep this one"
            />
            <HighlightLine h={h} entities={entities} worldId={worldId} />
          </li>
        ))}
      </ul>
      <SecretNamesWarning worldId={worldId} texts={keep.map((h) => h.text)} />
      <div className="row">
        <button
          disabled={!keep.length || added}
          onClick={async () => {
            await db.sessions.update(session.id, { highlights: [...(session.highlights ?? []), ...keep] })
            setAdded(true)
          }}
        >
          {added ? '✓ Added to the session' : `Add ${keep.length} to the session`}
        </button>
      </div>
    </>
  )
}

/** The revealed recaps of a campaign, oldest first: what players can know. */
const playerRecaps = (sessions: Session[], campaignId: string) =>
  sessions
    .filter((s) => s.campaignId === campaignId && s.visibility === 'players' && s.recap.trim())
    .sort((a, b) => a.number - b.number)

/**
 * "The story so far" for a campaign. Players read it (with every recap underneath for the full
 * tale); the GM writes it, or has Claude write it from the player recaps alone.
 */
export function StorySoFar({ world, campaign, sessions, entities, isGM, compact }: { world: World; campaign: Campaign; sessions: Session[]; entities: Entity[]; isGM: boolean; compact?: boolean }) {
  const recaps = playerRecaps(sessions, campaign.id)
  const latest = recaps[recaps.length - 1]
  const behind = !!latest && !!campaign.storySoFar?.trim() && (campaign.storySoFarUpTo ?? 0) < latest.number
  const [draft, setDraft] = useState<string>()
  if (!isGM && !campaign.storySoFar?.trim() && recaps.length < 2) return null
  const save = (text: string) => db.campaigns.update(campaign.id, { storySoFar: text.trim() || undefined, storySoFarUpTo: text.trim() ? latest?.number : undefined })
  const build = () => ({
    system: `You write "the story so far" for the players of a tabletop roleplaying campaign: a catch-up they can read before a session, or that a new player can read to join in. Use only the session recaps given, which are what the players know. Write three to six short paragraphs in a warm storyteller's voice, past tense, about the characters. Bring out the threads still open at the end. Keep the [[Name]] links as they are written in the recaps, and add no others. Answer with the story only: no heading, no preamble.`,
    prompt: `Campaign: ${campaign.name}${world.system ? ` (${world.system})` : ''}${campaign.description.trim() ? `\n${stripSecrets(campaign.description).trim()}` : ''}

${recaps.map((s) => `<session number="${s.number}" title="${s.title.replace(/"/g, "'")}">\n${stripSecrets(s.recap).trim()}\n</session>`).join('\n\n')}`,
    expectOut: 900,
  })
  return (
    <section className={`story-so-far${compact ? ' compact' : ''}`}>
      {!compact && (
        <h2>
          <Ico as={BookOpenText} /> The story so far <Help topic="storySoFar" />
        </h2>
      )}
      {isGM ? (
        <>
          <DraftText
            multiline
            rows={5}
            value={campaign.storySoFar ?? ''}
            placeholder="A catch-up of the whole campaign for players and anyone joining late. Write it yourself, or have Claude write it from the player recaps."
            onCommit={(v) => save(v)}
          />
          {behind && <p className="muted small">Written up to session {campaign.storySoFarUpTo ?? '?'}; there are newer recaps since.</p>}
          {recaps.length > 0 ? (
            <ClaudeJob
              worldId={world.id}
              jobId={`story:${campaign.id}`}
              jobTitle={`The story so far: ${campaign.name}`}
              label={campaign.storySoFar?.trim() ? 'Rewrite it with Claude' : 'Write it with Claude'}
              build={build}
              priceKey={recaps.map((s) => s.id + s.recap.length).join()}
              onResult={setDraft}
            />
          ) : (
            <p className="muted small">Once sessions have player recaps (and are shown to players), Claude can write this from them.</p>
          )}
          {draft !== undefined && (
            <div className="card story-draft">
              <Markdown text={draft} entities={entities} worldId={world.id} showSecrets={false} />
              <SecretNamesWarning worldId={world.id} texts={[draft]} />
              <div className="row">
                <button
                  className="primary"
                  onClick={async () => {
                    await save(draft)
                    setDraft(undefined)
                  }}
                >
                  Use this
                </button>
                <button className="ghost" onClick={() => setDraft(undefined)}>
                  Throw away
                </button>
              </div>
            </div>
          )}
          {campaign.visibility === 'gm' && <p className="muted small">This campaign is hidden from players, so they don’t see this yet.</p>}
        </>
      ) : (
        <>
          {campaign.storySoFar?.trim() && <Markdown text={campaign.storySoFar} entities={entities} worldId={world.id} showSecrets={false} />}
          {recaps.length > 0 && (
            <details className="small">
              <summary>Every session’s recap ({recaps.length})</summary>
              {recaps.map((s) => (
                <article key={s.id} className="wiki-recap">
                  <h4>
                    #{s.number} {s.title}
                  </h4>
                  <Markdown text={s.recap} entities={entities} worldId={world.id} showSecrets={false} />
                </article>
              ))}
            </details>
          )}
        </>
      )}
    </section>
  )
}
