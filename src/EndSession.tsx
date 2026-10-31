import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { WorldToday } from './calendar'
import { db, type Campaign, type Entity, type Session, type World } from './db'
import { Help } from './help'
import { markPlayed } from './sessions'
import { Ico } from './icons'
import { CheckCircle, Eye, EyeSlash, FlagCheckered, ListChecks } from '@phosphor-icons/react'
import { worldPath } from './paths'
import { setLiveSession, useLiveSession } from './cloud/table'
import { useLiveRecording } from './recordingStore'
import { prepCounts } from './counts'
import { stripSecrets } from './Markdown'
import { toast } from './undo'
import { jumpTo } from './jump'

/**
 * Finishing a session: "Mark as played" ends the live link to players, marks it played and gets the
 * next session ready (see markPlayed), with Undo. Shared by the strip at the top of Wrap up and the
 * checklist at its end. Blocked while this session is still recording.
 */
export function useFinish(session: Session) {
  const live = useLiveSession(session.worldId)
  const recording = useLiveRecording()
  const [busy, setBusy] = useState(false)
  const blocked = recording?.sessionId === session.id ? 'Stop the recording first' : undefined
  const finish = async () => {
    if (blocked || busy) return
    setBusy(true)
    try {
      // Players' Common Room stops showing this session as being played.
      if (live === session.id) setLiveSession(session.worldId, undefined)
      const { next, undo } = await markPlayed(session)
      toast(`#${session.number} marked played. Next up: #${next.number} ${next.title}.`, undo)
    } finally {
      setBusy(false)
    }
  }
  return { finish, busy, blocked }
}

/** The session after this one in its campaign, if there is one yet. */
export function useNextSession(session: Session) {
  return useLiveQuery(
    async () => (await db.sessions.where({ campaignId: session.campaignId }).filter((s) => s.number > session.number).sortBy('number'))[0] ?? null,
    [session.campaignId, session.number],
  )
}

const words = (text: string) => text.split(/\s+/).filter(Boolean).length

/**
 * Showing a session to players, with a short look at what they'll get first: the title, the recap
 * (secret passages left out), highlights and who featured. Hiding it again is one tap, with Undo.
 */
export function ShowToPlayers({ session, campaign, entities }: { session: Session; campaign: Campaign | null | undefined; entities: Entity[] }) {
  const [review, setReview] = useState(false)
  const set = (visibility: Session['visibility']) => db.sessions.update(session.id, { visibility })
  if (session.visibility === 'players')
    return (
      <div className="row wrap show-players">
        <span className="chip shown-chip">
          <Ico as={Eye} /> Players can read it
        </span>
        <button
          type="button"
          onClick={async () => {
            await set('gm')
            toast(`#${session.number} is hidden from players again.`, () => set('players'))
          }}
        >
          <Ico as={EyeSlash} /> Hide from players
        </button>
      </div>
    )
  if (!review)
    return (
      <div className="row wrap show-players">
        <span className="chip">🔒 GM only</span>
        <button type="button" onClick={() => setReview(true)}>
          <Ico as={Eye} /> Show to players…
        </button>
      </div>
    )
  const recap = stripSecrets(session.recap).trim()
  const featured = entities.filter((e) => session.entityIds.includes(e.id) && e.visibility === 'players')
  const highlights = session.highlights?.length ?? 0
  return (
    <div className="reveal-review" role="group" aria-label="What players will see">
      <strong>
        Players will see <Help topic="revealRecap" />
      </strong>
      <ul>
        <li>
          the title “#{session.number} {session.title}”{session.date && `, played ${session.date}`}
        </li>
        <li>{recap ? `the recap, ${words(recap)} words (secret passages left out)` : 'no recap yet: it shows here once you write one'}</li>
        {highlights > 0 && <li>{highlights === 1 ? '1 highlight' : `${highlights} highlights`}</li>}
        {featured.length > 0 && <li>who featured, only pages they can already see: {featured.slice(0, 6).map((e) => e.name).join(', ')}{featured.length > 6 && ` and ${featured.length - 6} more`}</li>}
      </ul>
      <p className="muted small">Your GM notes, the plan, the recording and its transcript stay yours.</p>
      {campaign?.visibility === 'gm' && (
        <p className="notice small">The campaign “{campaign.name}” is still GM only, so players won’t see this session until you reveal the campaign too (on All sessions).</p>
      )}
      <div className="row wrap">
        <button
          type="button"
          className="primary"
          onClick={async () => {
            await set('players')
            setReview(false)
            toast(`Players can read #${session.number} now.`, () => set('gm'))
          }}
        >
          <Ico as={Eye} /> Show it to players
        </button>
        <button type="button" onClick={() => setReview(false)}>
          Not yet
        </button>
      </div>
    </div>
  )
}

/**
 * The end of Wrap up: what's done and what's left (each with a jump to its part of the page), then
 * "Mark as played", after which it shows the next session.
 */
export function WrapUpChecklist({ world, session, campaign, entities, played }: { world: World; session: Session; campaign: Campaign | null | undefined; entities: Entity[]; played: boolean }) {
  const { finish, busy, blocked } = useFinish(session)
  const next = useNextSession(session)
  const recorded = session.recordings.length
  const transcribed = session.recordings.filter((r) => r.transcript && !r.transcript.pending).length
  const transcribing = session.recordings.some((r) => r.transcript?.pending)
  const { clues: { left: leftClues }, scenes: { left: leftScenes } } = prepCounts(session.prep)
  // Only pages that are still there: a page deleted since keeps its id in the session.
  const featured = entities.filter((e) => session.entityIds.includes(e.id)).length
  const jump = (id: string, text: ReactNode) => (
    <button type="button" className="link" onClick={() => jumpTo(id)}>
      {text}
    </button>
  )
  const w = worldPath(world.id)

  const steps: { done: boolean; label: ReactNode; detail?: ReactNode }[] = [
    {
      done: !!session.notes.trim(),
      label: session.notes.trim() ? 'GM notes written' : 'Jot down what happened',
      detail: !session.notes.trim() && jump('notes', 'Your notes, at the top'),
    },
    {
      done: !recorded || transcribed === recorded,
      label: recorded ? (transcribed === recorded ? `Recording transcribed${recorded > 1 ? ` (${recorded})` : ''}` : 'Transcribe the recording') : 'No recording this time',
      detail: recorded > transcribed && (transcribing ? 'Transcribing now…' : jump('recording', 'Transcribe it (on this device, or with AssemblyAI)')),
    },
    {
      done: !!session.recap.trim(),
      label: session.recap.trim() ? 'Player recap written' : session.recapDraft ? 'A recap draft from Claude is waiting' : 'Write the players’ recap',
      detail: !session.recap.trim() && jump(session.recapDraft ? 'writeup' : 'recap', session.recapDraft ? 'Review the draft and use it' : 'Yourself, or with Claude from your notes or the transcript'),
    },
    {
      done: !!session.ledger?.length,
      label: session.ledger?.length
        ? `${session.ledger.length} change${session.ledger.length === 1 ? '' : 's'} made to the world`
        : session.recapDraft?.updates?.length && !session.recapDraft.updatesDone
          ? `Claude suggested ${session.recapDraft.updates.length} updates to your pages`
          : 'Update your pages from the session',
      detail: !session.ledger?.length && jump('writeup', session.recapDraft?.updates?.length ? 'Tick the ones you want' : 'Claude suggests them along with the write-up'),
    },
    {
      done: featured > 0,
      label: featured ? `${featured} featured in this session` : 'Nobody featured yet',
      detail: !featured && 'People you put in a scene at the Lectern are added by themselves. Add others under “Featured in this session”.',
    },
    {
      done: session.visibility === 'players',
      label: session.visibility === 'players' ? 'Players can read the recap' : 'Show the recap to players',
      detail: <ShowToPlayers session={session} campaign={campaign} entities={entities} />,
    },
  ]
  if (world.calendar?.today) steps.push({ done: false, label: 'Move the world’s date on, if time passed', detail: <WorldToday world={world} isGM /> })
  const carry =
    [
      leftClues && `${leftClues} unfound clue${leftClues > 1 ? 's' : ''}`,
      leftScenes && `${leftScenes} unplayed scene${leftScenes > 1 ? 's' : ''}`,
      session.lectern?.sceneId && 'the current scene and who’s there',
    ]
      .filter(Boolean)
      .join(', ')
      .replace(/, ([^,]*)$/, ' and $1')

  return (
    <section className="card end-session" id="finish">
      <h2>
        <Ico as={FlagCheckered} /> Before you finish <Help topic="endSession" />
      </h2>
      <ol className="end-steps">
        {steps.map((s, i) => (
          <li key={i} className={s.done ? 'done' : ''}>
            <span className="end-tick" aria-hidden>
              {s.done ? '✓' : '○'}
            </span>
            <div>
              <strong>{s.label}</strong>
              {s.detail && <div className="small">{s.detail}</div>}
            </div>
          </li>
        ))}
      </ol>
      <div className="finish-row">
        {played ? (
          <>
            <p>
              <Ico as={CheckCircle} /> <strong>#{session.number} is played.</strong>{' '}
              {next ? (
                <>
                  Next up: <Link to={`${w}/s/${next.id}?tab=prep`}>#{next.number} {next.title}</Link>.
                </>
              ) : (
                'There’s no next session yet.'
              )}
            </p>
            <div className="row wrap">
              {next && (
                <Link className="button primary" to={`${w}/s/${next.id}?tab=prep`}>
                  <Ico as={ListChecks} /> Prepare #{next.number}
                </Link>
              )}
              {session.playedAt && (
                <button type="button" onClick={() => db.sessions.update(session.id, { playedAt: undefined })}>
                  Not played yet
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="small muted">
              {next ? `Then #${next.number} ${next.title} becomes the next session.` : `Then session #${session.number + 1} is made, ready to prepare.`}{' '}
              {!next && carry && `${carry[0].toUpperCase()}${carry.slice(1)} carry over.`}
            </p>
            <button type="button" className="primary big" disabled={busy || !!blocked} title={blocked} onClick={finish}>
              <Ico as={CheckCircle} /> Mark as played
            </button>
            <Help topic="markPlayed" />
          </>
        )}
      </div>
    </section>
  )
}
