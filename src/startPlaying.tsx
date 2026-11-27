import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate } from 'react-router-dom'
import { Play } from '@phosphor-icons/react'
import { goLiveWith, liveSessionOf, setLiveSession, useLiveSession } from './cloud/table'
import { Modal } from './components'
import { db, type Session, type World } from './db'
import { HELP, Help } from './help'
import { Ico } from './icons'
import { worldPath } from './paths'
import { recordingSupported } from './recorder'
import { recordingStore, useLiveRecording } from './recordingStore'
import { startPlaying } from './sessions'
import { toast } from './undo'
import './startPlaying.css'

/**
 * "Start playing", one way everywhere (the Desk, Prepare, All sessions and the Lectern): the button
 * opens a small box with two ticks, "Go live to players" and "Record", and one "Start playing". The
 * ticks are remembered on this device. Afterwards the note at the bottom has "Not started after all",
 * which takes back the start and the live link. A session already under way shows "Continue" instead,
 * with no box.
 */

/** What the box was ticked with. */
export interface StartChoice {
  live: boolean
  record: boolean
}

const KEY = 'codex.startPlaying'

/** The ticks as the GM last left them on this device: live to players to begin with, not recording. */
function lastChoice(): StartChoice {
  try {
    const kept = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<StartChoice> | null
    return { live: kept?.live !== false, record: kept?.record === true }
  } catch {
    return { live: true, record: false }
  }
}

function rememberChoice(choice: StartChoice) {
  try {
    localStorage.setItem(KEY, JSON.stringify(choice))
  } catch {
    // Not remembered this time.
  }
}

/**
 * Starts a session as the box was ticked: marks it as being played, goes live to players if asked,
 * and says so in the note at the bottom. "Not started after all" there takes back the start and the
 * live link (whatever was live before is live again). A recording is never started or stopped from
 * here: the Record tick only opens the recording panel, where the GM asks everyone and presses Start;
 * one that is running when the start is taken back carries on, and the note says so. Mentions another
 * session of the campaign that is still being played, since two at once is nearly always a slip.
 * Gives back false if the session was already under way.
 */
async function startWith(session: Pick<Session, 'id' | 'number' | 'title' | 'campaignId' | 'lectern' | 'liveAt'>, world: Pick<World, 'id' | 'cloud'>, choice: StartChoice) {
  const undoStart = await startPlaying(session.id)
  if (!undoStart) return false
  const liveBefore = liveSessionOf(world.id)
  const goLive = choice.live && !!world.cloud?.enabled && liveBefore !== session.id
  const shareOff = session.lectern?.share?.off
  if (goLive) await goLiveWith(world.id, session)
  const other = (await db.sessions.where({ campaignId: session.campaignId }).toArray()).find((s) => s.id !== session.id && s.startedAt && !s.playedAt)
  const name = `#${session.number} ${session.title}`
  toast(
    `${name} is being played${goLive ? ', live to players' : ''}.${other ? ` #${other.number} ${other.title} is still being played too.` : ''}${choice.record ? ' Ask everyone before you press Start recording.' : ''}`,
    async () => {
      await undoStart()
      if (goLive && liveSessionOf(world.id) === session.id) {
        setLiveSession(world.id, liveBefore)
        await db.sessions
          .where('id')
          .equals(session.id)
          .modify((s) => {
            if (session.liveAt) s.liveAt = session.liveAt
            else delete s.liveAt
            if (shareOff && s.lectern) s.lectern.share = { ...s.lectern.share, off: true }
          })
      }
      // A recording is people's voices: it is never thrown away or cut short by an Undo.
      if (recordingStore.get()?.sessionId === session.id) toast(`${name} is not started any more. Its recording is still running: press “Stop & save” when you want it to end.`)
    },
    'Not started after all',
  )
  return true
}

/**
 * The "Start playing" button and its box. `onStarted` runs instead of opening the Lectern (the
 * Lectern itself uses it, since it's already there). A session already under way gets "Continue".
 */
export function StartPlayingButton({
  session,
  className = 'primary',
  dataNext,
  onStarted,
}: {
  session: Session
  className?: string
  /** The Desk marks its main button with what it does next. */
  dataNext?: string
  onStarted?: (choice: StartChoice) => void
}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const world = useLiveQuery(() => db.worlds.get(session.worldId), [session.worldId])
  const lectern = `${worldPath(session.worldId)}/s/${session.id}/lectern`
  if (session.startedAt && !session.playedAt)
    return (
      <Link className={`button ${className}`} data-next={dataNext} to={lectern} title={HELP.continuePlaying}>
        <Ico as={Play} weight="fill" /> Continue
      </Link>
    )
  return (
    <>
      <button type="button" className={className} data-next={dataNext} title={HELP.startPlaying} onClick={() => setOpen(true)}>
        <Ico as={Play} weight="fill" /> Start playing
      </button>
      {open && world && (
        <StartBox
          session={session}
          world={world}
          onClose={() => setOpen(false)}
          here={!!onStarted}
          onStart={async (choice) => {
            setOpen(false)
            if (!(await startWith(session, world, choice))) return
            if (onStarted) onStarted(choice)
            // With Record ticked the Lectern opens at its recording panel, where the consent note and Start are.
            else navigate(choice.record ? `${lectern}?at=lectern-recording` : lectern)
          }}
        />
      )}
    </>
  )
}

/** The box itself: the two ticks, each with what it does, then Start playing. */
function StartBox({ session, world, here, onClose, onStart }: { session: Session; world: World; here: boolean; onClose: () => void; onStart: (choice: StartChoice) => void }) {
  const [choice, setChoice] = useState(lastChoice)
  const liveNow = useLiveSession(world.id)
  const recording = useLiveRecording()
  const other = useLiveQuery(async () => (liveNow && liveNow !== session.id ? ((await db.sessions.get(liveNow)) ?? null) : null), [liveNow, session.id])
  const canGoLive = !!world.cloud?.enabled
  const canRecord = recordingSupported()
  const set = (patch: Partial<StartChoice>) => setChoice((c) => ({ ...c, ...patch }))
  const start = () => {
    // A tick that wasn't offered keeps what it was, for the next world or device where it is.
    const kept = lastChoice()
    rememberChoice({ live: canGoLive ? choice.live : kept.live, record: canRecord ? choice.record : kept.record })
    onStart({ live: canGoLive && choice.live, record: canRecord && choice.record })
  }
  return (
    <Modal title={`Start playing #${session.number} ${session.title}`} onClose={onClose}>
      <div className="start-box">
        <p className="small muted">
          {here ? 'Marks the session as being played.' : 'Marks the session as being played and opens Play: the Lectern.'} <Help topic="startPlaying" />
        </p>
        {!canGoLive ? (
          <p className="small muted start-absent">
            “Go live to players” isn’t offered: this world isn’t shared with players yet (<Link to={`${worldPath(world.id)}/settings?tab=players`}>Players and sharing</Link>).
          </p>
        ) : liveNow === session.id ? (
          <p className="small start-absent">
            <span className="live-dot" /> Already live to players.
          </p>
        ) : (
          <label className="start-tick">
            <input type="checkbox" checked={choice.live} onChange={(e) => set({ live: e.target.checked })} />
            <span>
              <strong>Go live to players</strong>
              <span className="small muted">
                Their Common Room shows this session as being played: the scene’s name, music, timers and whose turn it is. Never your notes.
                {other && ` #${other.number} ${other.title} is live now; this one takes its place.`}
              </span>
            </span>
          </label>
        )}
        {!canRecord ? (
          <p className="small muted start-absent">“Record” isn’t offered: this device or browser can’t record.</p>
        ) : recording?.sessionId === session.id ? (
          <p className="small start-absent">
            <span className="rec-dot" /> Already recording.
          </p>
        ) : (
          <label className="start-tick">
            <input type="checkbox" checked={choice.record} onChange={(e) => set({ record: e.target.checked })} />
            <span>
              <strong>Record</strong>
              <span className="small muted">Opens the recording panel. Nothing is recorded until you’ve asked everyone at the table and pressed “Start recording” there.</span>
            </span>
          </label>
        )}
        <div className="row end wrap start-buttons">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary" autoFocus onClick={start}>
            <Ico as={Play} weight="fill" /> Start playing
          </button>
        </div>
        <p className="small muted">Your ticks are remembered on this device. Both can be switched on or off at the Lectern while you play.</p>
      </div>
    </Modal>
  )
}
