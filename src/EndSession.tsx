import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { WorldToday } from './calendar'
import { db, type Session, type World } from './db'
import { Help } from './help'
import { createNextSession } from './sessions'
import { Ico } from './icons'
import { FlagCheckered } from '@phosphor-icons/react'
import { worldPath } from './paths'

/**
 * Wrapping up after play, in one place: transcribe the recording, write the recap with Claude,
 * show the session to players, move the world's date on, and start the next session where the
 * party left off (with the clues they didn't find and the scenes they didn't reach).
 * Shown at the top of the session page; the Lectern's "End session" button opens it.
 */
export function EndSessionChecklist({ world, session, onClose }: { world: World; session: Session; onClose: () => void }) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const later = useLiveQuery(
    () => db.sessions.where({ campaignId: session.campaignId }).filter((s) => s.number > session.number).sortBy('number'),
    [session.campaignId, session.number],
  )
  const recorded = session.recordings.length
  const transcribed = session.recordings.filter((r) => r.transcript && !r.transcript.pending).length
  const transcribing = session.recordings.some((r) => r.transcript?.pending)
  const leftClues = (session.prep?.clues ?? []).filter((c) => !c.done && c.text.trim()).length
  const leftScenes = (session.prep?.scenes ?? []).filter((c) => !c.done && c.text.trim()).length
  const next = later?.[0]
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const steps: { done: boolean; label: ReactNode; detail?: ReactNode }[] = [
    {
      done: !recorded || transcribed === recorded,
      label: recorded ? (transcribed === recorded ? `Recording transcribed${recorded > 1 ? ` (${recorded})` : ''}` : 'Transcribe the recording') : 'No recording this time',
      detail:
        recorded > transcribed &&
        (transcribing ? (
          'Transcribing now…'
        ) : (
          <button className="link" onClick={() => jump('session-recorder')}>
            Transcribe it below (on this device, or with AssemblyAI)
          </button>
        )),
    },
    {
      done: !!session.recap.trim(),
      label: session.recap.trim() ? 'Player recap written' : session.recapDraft ? 'A recap draft from Claude is waiting' : 'Write the recap with Claude',
      detail: !session.recap.trim() && (
        <button className="link" onClick={() => jump('session-recap')}>
          {session.recapDraft ? 'Review it below and use it' : transcribed ? 'Copy for Claude, or one click with your key, below' : 'Works from your GM notes too, below'}
        </button>
      ),
    },
    {
      done: session.entityIds.length > 0,
      label: session.entityIds.length ? `${session.entityIds.length} featured in this session` : 'Nobody featured yet',
      detail: !session.entityIds.length && 'People you add to the scene at the Lectern are listed automatically. Add others under “Featured in this session”.',
    },
    {
      done: session.visibility === 'players',
      label: 'Show this session to players',
      detail: (
        <label className="row small">
          <input
            type="checkbox"
            checked={session.visibility === 'players'}
            onChange={(e) => db.sessions.update(session.id, { visibility: e.target.checked ? 'players' : 'gm' })}
          />
          Players can read the recap and see who featured
        </label>
      ),
    },
  ]
  if (world.calendar?.today)
    steps.push({ done: false, label: 'Move the world’s date on, if time passed', detail: <WorldToday world={world} isGM /> })

  return (
    <section className="card end-session">
      <div className="section-header">
        <h2>
          <Ico as={FlagCheckered} /> End of session <Help topic="endSession" />
        </h2>
        <button className="ghost small" onClick={onClose}>
          Hide
        </button>
      </div>
      <ol className="end-steps">
        {steps.map((s, i) => (
          <li key={i} className={s.done ? 'done' : ''}>
            <span className="end-tick">{s.done ? '✓' : '○'}</span>
            <div>
              <strong>{s.label}</strong>
              {s.detail && <div className="small">{s.detail}</div>}
            </div>
          </li>
        ))}
        <li>
          <span className="end-tick">{next ? '✓' : '○'}</span>
          <div>
            {next ? (
              <>
                <strong>Next session is ready: </strong>
                <Link to={`${worldPath(world.id)}/s/${next.id}?tab=prep`}>
                  #{next.number} {next.title}
                </Link>
              </>
            ) : (
              <>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true)
                    const s = await createNextSession(world.id, session.campaignId)
                    navigate(`${worldPath(world.id)}/s/${s.id}?tab=prep`)
                  }}
                >
                  Start session #{session.number + 1}
                </button>
                <div className="small muted">
                  {[
                    leftClues && `${leftClues} unfound clue${leftClues > 1 ? 's' : ''}`,
                    leftScenes && `${leftScenes} unplayed scene${leftScenes > 1 ? 's' : ''}`,
                    session.lectern?.sceneId && 'the current scene and who’s there',
                  ]
                    .filter(Boolean)
                    .join(', ')
                    .replace(/, ([^,]*)$/, ' and $1') || 'A fresh session'}
                  {(leftClues || leftScenes || session.lectern?.sceneId) && ' carry over.'}
                </div>
              </>
            )}
          </div>
        </li>
      </ol>
    </section>
  )
}
