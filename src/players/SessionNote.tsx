import type { World } from '../db'
import { Help } from '../help'
import { MyNote } from './Notes'
import { useBetweenSessions } from './StarsWishes'

/**
 * "My notes on this session": a player's own notes under a recap, kept with their other notes
 * (public.player_notes, under the session's id) and seen by nobody else. Hidden until the world's
 * server has the between-sessions update, which lets a note sit on a session.
 */
export function MySessionNote({ world, sessionId }: { world: World; sessionId: string }) {
  const { ready } = useBetweenSessions(world)
  if (!world.shared?.memberOf || !ready) return null
  return (
    <details className="my-session-note" open={!!world.shared.notes?.some((n) => n.entityId === sessionId && !n.shared && n.body.trim())}>
      <summary className="small">
        My notes on this session <Help topic="sessionNotes" />
      </summary>
      <MyNote world={world} entityId={sessionId} placeholder="What you want to remember from this one. Only you can see this." />
    </details>
  )
}
