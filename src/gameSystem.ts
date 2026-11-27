import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Campaign, type Entity, type Session, type World } from './db'
import { usePlayingNow } from './stage'
import { isRunning, nextSessions, useCampaigns, useWorldSessions } from './threads'
import { useViewMode } from './viewMode'

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

/**
 * The game being played in a world right now (see gameSystemOf). `campaignId` names a campaign whose
 * game wins over the one on the Desk: the campaign a character plays in (reading that character's
 * sheet), or a player's own campaign (see useMyCampaignId).
 */
export function useGameSystem(world: World | null | undefined, campaignId?: string) {
  const worldId = world?.id ?? ''
  const campaigns = useCampaigns(worldId)
  const sessions = useWorldSessions(worldId)
  const playing = usePlayingNow(worldId)
  if (!world) return ''
  const own = campaignId ? campaigns.find((c) => c.id === campaignId) : undefined
  return own ? systemOf(world, own) : gameSystemOf(world, campaigns, sessions, playing)
}

/**
 * For a player in a world they joined (or the GM previewing as one): the campaign their own
 * characters play in, so the game they get is their group's, whatever the GM's Desk shows. Nothing
 * for the GM, for a reader of a public wiki link, or when their characters are in no one campaign.
 * `entities` are the pages the viewer can see.
 */
export function useMyCampaignId(world: World | null | undefined, entities: Entity[]) {
  const { isGM, previewAs } = useViewMode()
  const shared = world?.shared
  // Joined: the characters the GM has approved as theirs. Previewing: the previewed player's characters, by name.
  const claimed = shared?.memberOf ? new Set((shared.claims ?? []).filter((c) => c.userId === shared.me && c.approved !== false).map((c) => c.entityId)) : undefined
  const names = !shared && !isGM ? (previewAs?.characterNames ?? []).map((n) => n.toLowerCase()) : []
  const ids = new Set(
    entities.filter((e) => e.type === 'pc' && !!e.campaignId && (claimed ? claimed.has(e.id) : names.includes(e.name.toLowerCase()))).map((e) => e.campaignId!),
  )
  return ids.size === 1 ? [...ids][0] : undefined
}
