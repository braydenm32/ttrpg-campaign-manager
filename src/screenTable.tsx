import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef } from 'react'
import { TimerList, timeLeft, TurnOrder, useNow } from './atTheTable'
import { linkAsPlayer, tableStateFor, useLiveSession, useTable, type TableState } from './cloud/table'
import { db, type Entity, type World } from './db'
import './liveMap.css'

/**
 * Turn order and timers on the players' screen (the TV): exactly what players' phones show in the
 * Common Room, never more. On the GM's own device it's read from the session being run on the
 * Lectern through the same filter that feeds players' phones (tableStateFor: a fighter made from a
 * page players can't see is "Enemy 2", timers hidden with the eye stay hidden, nothing of a fight
 * until it starts), and needs no cloud. On a joined player's device it's what the GM's app sends
 * while the session is live.
 */

const NO_ONE = new Set<string>()
/** A timer that ran out stays up this long ("Time's up"), then leaves the screen. */
const DONE_FOR = 60_000

type Table = Pick<TableState, 'combat' | 'timers'>

/**
 * The session whose fight or timers go on this device's players' screen: the one the GM is running
 * live, as players' phones get it, when there is one; else one not marked played, the one started last.
 */
function useOwnTable(world: World): Table | null {
  const liveId = useLiveSession(world.id)
  const found = useLiveQuery(async () => {
    if (world.shared) return null
    const sessions = (await db.sessions.where({ worldId: world.id }).toArray())
      .filter((s) => !s.playedAt && !!s.lectern && ((!!s.lectern.combat?.activeId && !!s.lectern.combat.combatants?.some((c) => !c.defeated)) || !!s.lectern.timers?.some((t) => !t.hidden)))
      .sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0) || b.number - a.number)
    const live = liveId ? await db.sessions.get(liveId) : undefined
    const session = live && live.worldId === world.id && !live.playedAt && live.lectern ? live : sessions[0]
    if (!session) return null
    const ids = (session.lectern!.combat?.combatants ?? []).flatMap((c) => (c.entityId ? [c.entityId] : []))
    const pages = new Map((await db.entities.bulkGet(ids)).filter((e): e is Entity => !!e).map((e) => [e.id, e]))
    const campaign = await db.campaigns.get(session.campaignId)
    const state = tableStateFor(session, pages, [], [], campaign)
    return state ? { combat: state.combat, timers: state.timers } : null
  }, [world.id, !!world.shared, liveId])
  return found ?? null
}

/** What goes on the players' screen of the table: from this device's own world, or (a joined world) from the GM's app. */
function useScreenTable(world: World): Table | null {
  const cloudId = world.shared?.memberOf
  useEffect(() => (cloudId ? linkAsPlayer(cloudId) : undefined), [cloudId])
  const { table } = useTable(cloudId)
  const own = useOwnTable(world)
  const from = cloudId ? table : own
  // Counted every second only while a timer could leave the screen.
  const timers = from?.timers ?? []
  const now = useNow(1000, timers.length > 0)
  const running = timers.filter((t) => timeLeft(t, now) > 0 || (t.endsAt !== undefined && now - t.endsAt < DONE_FOR))
  if (!from?.combat && !running.length) return null
  return { combat: from?.combat, timers: running.length ? running : undefined }
}

/**
 * The panel on the players' screen: timers on top, the turn order under them, and nothing at all
 * when there's no fight and no timer. `alone` when nothing else is on the screen (it takes the middle).
 */
export function ScreenTable({ world, alone }: { world: World; alone?: boolean }) {
  const table = useScreenTable(world)
  const box = useRef<HTMLDivElement>(null)
  const turn = table?.combat?.turnId
  // In a long fight, whoever's turn it is stays in view.
  useEffect(() => {
    box.current?.querySelector('.turn-order li.active')?.scrollIntoView({ block: 'nearest' })
  }, [turn])
  if (!table) return null
  return (
    <aside className={`screen-table ${alone ? 'alone' : ''}`} ref={box} aria-label="At the table">
      {table.timers && <TimerList timers={table.timers} />}
      {table.combat && (
        <>
          <h2>
            Turn order <span>Round {table.combat.round}</span>
          </h2>
          <TurnOrder combat={table.combat} mine={NO_ONE} />
        </>
      )}
    </aside>
  )
}
