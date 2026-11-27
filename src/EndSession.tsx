import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { WorldToday } from './calendar'
import { db, type Campaign, type Entity, type Session, type World } from './db'
import { Help } from './help'
import { featuredInPlay, markPlayed, notesFromPlay, unmarkPlayed } from './sessions'
import { Ico } from './icons'
import { CheckCircle, Eye, EyeSlash, FlagCheckered, ListChecks } from '@phosphor-icons/react'
import { worldPath } from './paths'
import { setLiveSession, useLiveSession } from './cloud/table'
import { useLiveRecording } from './recordingStore'
import { prepCounts } from './counts'
import { stripSecrets } from './Markdown'
import { toast } from './undo'
import { showDay } from './text'
import { jumpTo } from './jump'
import { WhoWasThere } from './attendance'
import { offerGroupPost } from './groupPost'
import { pauseGameClock } from './gameClock'
import { clearPlayersScreens } from './showing'
import { ResetButton } from './oneShotPanel'
import { oneShotOf } from './oneShot'

/**
 * "Wrap up" while this session is live: the live link to players ends and what's on their screens
 * (the in-game clock too) comes off, with Undo. The same from the Desk and the Lectern.
 */
export async function endLiveSession(worldId: string, sessionId: string) {
  setLiveSession(worldId, undefined)
  const unclear = await clearPlayersScreens(worldId)
  toast(`The live session has ended.${unclear ? ' Players’ screens are clear.' : ''}`, async () => {
    setLiveSession(worldId, sessionId)
    await unclear?.()
  })
}

/**
 * Finishing a session: "Mark as played" ends the live link to players, clears their screens (the
 * in-game clock too), marks it played and gets the next session ready (see markPlayed), with Undo. Shared by the strip at the top of Wrap up and the
 * checklist at its end. Blocked while this session is still recording.
 */
export function useFinish(session: Session) {
  const live = useLiveSession(session.worldId)
  const recording = useLiveRecording()
  const [busy, setBusy] = useState(false)
  const blocked = recording?.sessionId === session.id ? 'Stop the recording first' : undefined
  /** `sure`: the GM has just said they played it (the Desk's "Did you play it?"), so there's nothing to ask. */
  const finish = async ({ sure = false } = {}) => {
    if (blocked || busy) return
    if (!sure && !session.startedAt && live !== session.id && !confirm('You haven’t started playing this one. Mark it played anyway?')) return
    setBusy(true)
    try {
      // Players' Common Room stops showing this session as being played.
      if (live === session.id) setLiveSession(session.worldId, undefined)
      const { next, undo, carried } = await markPlayed(session)
      // The in-game clock stops with the session, so it hasn't run on for days by next time.
      const paused = await pauseGameClock(session.worldId)
      // The table is over: the last handout and the clock come off players' screens (Undo puts them back).
      const unclear = await clearPlayersScreens(session.worldId)
      const n = (count: number, one: string) => `${count} ${one}${count === 1 ? '' : 's'}`
      const brought = [carried.clues ? n(carried.clues, 'unfound clue') : '', carried.scenes ? n(carried.scenes, 'unplayed scene') : ''].filter(Boolean).join(' and ')
      toast(`#${session.number} marked played. Next up: #${next.number} ${next.title}${brought ? `, with ${brought} carried over` : ''}.${unclear ? ' Players’ screens are clear.' : ''}${paused ? ' The in-game clock is paused.' : ''}`, async () => {
        await undo()
        await unclear?.()
      })
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
 * Every "Show to players" goes through this review, the Desk's too.
 */
export function ShowToPlayers({
  session,
  campaign,
  entities,
  startOpen = false,
}: {
  session: Session
  campaign: Campaign | null | undefined
  entities: Entity[]
  /** Open with the review already showing (the Desk's "Show to players…" lands here). */
  startOpen?: boolean
}) {
  const [review, setReview] = useState(startOpen)
  const set = (visibility: Session['visibility']) => db.sessions.update(session.id, { visibility })
  if (session.visibility === 'players')
    return (
      <div className="row wrap show-players">
        <span className="chip shown-chip">
          <Ico as={Eye} /> Players can see this
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
          the title “#{session.number} {session.title}”{session.date && `, ${session.playedAt ? 'played' : 'on'} ${showDay(session.date)}`}
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
            offerGroupPost(await db.worlds.get(session.worldId), `The recap of #${session.number} ${session.title} is up in the Common Room.`)
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

type WrapStep = { done: boolean; label: ReactNode; detail?: ReactNode; optional?: boolean }
type WrapProps = { world: World; session: Session; campaign: Campaign | null | undefined; entities: Entity[] }

/** What's done and what's left at the end of a session, and what carries over to the next. */
function wrapSteps({ world, session, campaign, entities }: WrapProps) {
  const recorded = session.recordings.length
  const transcribed = session.recordings.filter((r) => r.transcript && !r.transcript.pending).length
  const transcribing = session.recordings.some((r) => r.transcript?.pending)
  const { clues: { left: leftClues }, scenes: { left: leftScenes } } = prepCounts(session.prep)
  // Pages that came up in play (not just the ones linked while planning), and only ones still there: a page deleted since keeps its id in the session.
  const inPlay = new Set(featuredInPlay(session))
  const featured = entities.filter((e) => inPlay.has(e.id)).length
  const linked = entities.filter((e) => session.entityIds.includes(e.id)).length
  // What was written once play began: the prep script in the notes doesn't count.
  const notes = notesFromPlay(session).trim()
  const jump = (id: string, text: ReactNode) => (
    <button type="button" className="link" onClick={() => jumpTo(id)}>
      {text}
    </button>
  )
  const steps: WrapStep[] = [
    {
      done: !!notes,
      label: notes ? 'GM notes written' : 'Jot down what happened',
      detail: !notes && jump('notes', 'Your notes, at the top'),
    },
    {
      // Nothing recorded is nothing to do: it isn't counted as a step done.
      done: recorded > 0 && transcribed === recorded,
      optional: !recorded,
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
      // A check, not a job: unticked, the whole party counts as there.
      done: !!session.present,
      optional: true,
      label: 'Who was there',
      detail: <WhoWasThere session={session} entities={entities} />,
    },
    {
      done: featured > 0,
      label: featured ? `${featured} came up in play` : 'Nobody has come up in play yet',
      detail:
        !featured &&
        `${linked ? `The ${linked} under “Featured in this session” ${linked === 1 ? 'was' : 'were'} linked while planning, so ${linked === 1 ? 'it isn’t' : 'they aren’t'} counted here. ` : ''}People you put in a scene at the Lectern are added by themselves. Add others under “Featured in this session”.`,
    },
    {
      done: session.visibility === 'players',
      label: session.visibility === 'players' ? 'Players can read the recap' : 'Show the recap to players',
      detail: <ShowToPlayers session={session} campaign={campaign} entities={entities} />,
    },
  ]
  if (world.calendar?.today) steps.push({ done: false, optional: true, label: 'Move the world’s date on, if time passed', detail: <WorldToday world={world} isGM /> })
  const carry =
    [
      leftClues && `${leftClues} unfound clue${leftClues > 1 ? 's' : ''}`,
      leftScenes && `${leftScenes} unplayed scene${leftScenes > 1 ? 's' : ''}`,
      session.lectern?.sceneId && 'the current scene and who’s there',
    ]
      .filter(Boolean)
      .join(', ')
      .replace(/, ([^,]*)$/, ' and $1')

  return { steps, carry }
}

/** “3 of 7 done” and what's next, as a slim line beside the title; the checklist itself is at the end. */
export function WrapProgress(props: WrapProps) {
  const steps = wrapSteps(props).steps.filter((s) => !s.optional)
  const done = steps.filter((s) => s.done).length
  const left = steps.find((s) => !s.done)
  return (
    <p className="wrap-progress small" role="status">
      <Ico as={ListChecks} /> <strong>Before you finish:</strong> {done} of {steps.length} done
      {left ? <> · next: {left.label}</> : ' · ready to mark it played'}{' '}
      <button type="button" className="link" onClick={() => jumpTo('finish')}>
        See the list
      </button>
    </p>
  )
}

/**
 * The end of Wrap up: what's done and what's left (each with a jump to its part of the page), then
 * "Mark as played", after which it shows the next session.
 */
export function WrapUpChecklist(props: WrapProps & { played: boolean }) {
  const { world, session, played } = props
  const { finish, busy, blocked } = useFinish(session)
  const next = useNextSession(session)
  const w = worldPath(world.id)
  const { steps, carry } = wrapSteps(props)

  return (
    <section className="card end-session" id="finish">
      <h2>
        <Ico as={FlagCheckered} /> Before you finish <Help topic="endSession" />
      </h2>
      <ol className="end-steps">
        {steps.map((s, i) => (
          <li key={i} className={s.done ? 'done' : ''}>
            <span className="end-tick" aria-hidden>
              {s.done ? '✓' : s.optional ? '·' : '○'}
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
              {oneShotOf(world) && <ResetButton world={world} className="primary" />}
              {session.playedAt && (
                <button
                  type="button"
                  onClick={async () => {
                    const undo = await unmarkPlayed(session)
                    toast(`#${session.number} is not played yet.`, undo)
                  }}
                >
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
            <button type="button" className="primary big" disabled={busy || !!blocked} title={blocked} onClick={() => finish()}>
              <Ico as={CheckCircle} /> Mark as played
            </button>
            <Help topic="markPlayed" />
          </>
        )}
      </div>
    </section>
  )
}
