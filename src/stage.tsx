import { BookOpenText, CheckCircle, NotePencil, Play } from '@phosphor-icons/react'
import type { Session } from './db'
import { Help } from './help'
import { Ico } from './icons'
import { useLiveSession } from './cloud/table'
import { useLiveRecording } from './recordingStore'
import { sessionStage, STAGES, type SessionStage } from './sessions'

/**
 * A session's stage on screen: the chip (Planned, Preparing, Playing, Played) shown on Prepare,
 * Play, Wrap up, All sessions and the Desk. The rules are in src/sessions.ts (sessionStage).
 */

/** The sessions being played right now in a world: live to players, or recording on this device. */
export function usePlayingNow(worldId: string) {
  const live = useLiveSession(worldId)
  const recording = useLiveRecording()
  const ids: string[] = []
  if (live) ids.push(live)
  if (recording?.worldId === worldId && recording.sessionId !== live) ids.push(recording.sessionId)
  return ids
}

/** A session's stage, counting it as playing while it's live or recording. */
export function useSessionStage(session: Session | null | undefined): SessionStage | undefined {
  const playing = usePlayingNow(session?.worldId ?? '')
  return session ? sessionStage(session, playing.includes(session.id)) : undefined
}

const ICONS = { planned: NotePencil, preparing: BookOpenText, playing: Play, played: CheckCircle }

/** The chip itself. `help` adds the "?" that explains the stages. */
export function StageChip({ stage, help = false }: { stage: SessionStage; help?: boolean }) {
  const { label, tone } = STAGES[stage]
  return (
    <span className="stage-wrap">
      <span className={`chip stage-chip ${tone}`} data-stage={stage}>
        <Ico as={ICONS[stage]} weight={stage === 'playing' ? 'fill' : 'regular'} /> {label}
      </span>
      {help && <Help topic="stages" />}
    </span>
  )
}
