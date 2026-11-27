import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Campaign, type Session, type World } from './db'
import { usePlayingNow } from './stage'
import { isRunning, nextSessions, useCampaigns, useWorldSessions } from './threads'

/**
 * Which game is being played, as one answer for everything that asks (Look it up, reading a
 * character sheet, what Claude is told): the game system of the campaign in hand (the one the Desk
 * shows, see nextSessions), else of the only campaign being run, else the world's default game
 * system. A campaign's own choice always wins over the world's.
 */
export function gameSystemOf(world: Pick<World, 'system'>, campaigns: Campaign[], sessions: Session[], playing: string[] = []) {
  const running = campaigns.filter(isRunning)
  const campaign = nextSessions(campaigns, sessions, playing)[0]?.campaign ?? (running.length === 1 ? running[0] : undefined)
  return systemOf(world, campaign)
}

/** A given campaign's game, or the world's when it has none of its own. */
export const systemOf = (world: Pick<World, 'system'>, campaign?: Pick<Campaign, 'system'> | null) => campaign?.system?.trim() || world.system

/** The game of one session: its campaign's, else the world's. */
export function useSessionSystem(world: World, session: Pick<Session, 'campaignId'>) {
  const campaign = useLiveQuery(() => db.campaigns.get(session.campaignId), [session.campaignId])
  return systemOf(world, campaign)
}

/** The game being played in a world right now (see gameSystemOf). */
export function useGameSystem(world: World | null | undefined) {
  const worldId = world?.id ?? ''
  const campaigns = useCampaigns(worldId)
  const sessions = useWorldSessions(worldId)
  const playing = usePlayingNow(worldId)
  return world ? gameSystemOf(world, campaigns, sessions, playing) : ''
}
