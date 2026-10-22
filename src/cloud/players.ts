import { db, type SharedInfo } from '../db'
import { appUrl, supabase, SUPABASE_URL } from './client'
import { storePlayerCopy, type SharedPayload } from './share'

/**
 * Players joining a world. The GM makes an invite link; a player opens it, signs in, and gets a
 * read-only copy of the player-safe parts (filtered on the server by public.member_world), plus the
 * chance to claim a player character as theirs.
 */

function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export const inviteUrl = (token: string) => `${appUrl()}#/join/${token}`

/** Local id of a joined world's copy on a player's device. */
export const memberWorldId = (cloudWorldId: string) => `member-${cloudWorldId}`

// ---- GM side ----

export async function getInviteToken(worldId: string): Promise<string | null> {
  const { data, error } = await supabase.from('cloud_worlds').select('invite_token').eq('id', worldId).maybeSingle()
  if (error) throw error
  return (data?.invite_token as string | null) ?? null
}

/** Creates a new invite link, replacing any old one. Players who already joined stay in. */
export async function createInviteLink(worldId: string) {
  const token = newToken()
  const { error } = await supabase.from('cloud_worlds').update({ invite_token: token }).eq('id', worldId)
  if (error) throw error
  return token
}

export async function revokeInviteLink(worldId: string) {
  const { error } = await supabase.from('cloud_worlds').update({ invite_token: null }).eq('id', worldId)
  if (error) throw error
}

export interface Member {
  userId: string
  name: string
  role: string
  joinedAt: string
}

export interface Claim {
  entityId: string
  userId: string
  notes: string
}

/** Who has joined, and who plays which character (for the GM). */
export async function listPlayers(worldId: string): Promise<{ members: Member[]; claims: Claim[] }> {
  const [m, c] = await Promise.all([
    supabase.from('world_members').select('user_id, display_name, role, created_at').eq('world_id', worldId).order('created_at'),
    supabase.from('character_claims').select('entity_id, user_id, player_notes').eq('world_id', worldId),
  ])
  if (m.error) throw m.error
  if (c.error) throw c.error
  return {
    members: m.data.map((r) => ({ userId: r.user_id, name: r.display_name || 'Unnamed player', role: r.role, joinedAt: r.created_at })),
    claims: c.data.map((r) => ({ entityId: r.entity_id, userId: r.user_id, notes: r.player_notes })),
  }
}

export async function removePlayer(worldId: string, userId: string) {
  const { error } = await supabase.from('world_members').delete().eq('world_id', worldId).eq('user_id', userId)
  if (error) throw error
}

// ---- Player side ----

/** Joins with an invite link. Returns the cloud world id, and whether you're actually its GM. */
export async function joinWorld(token: string, name: string) {
  const { data, error } = await supabase.rpc('join_world', { token, name })
  if (error) throw error
  if (!data) throw new Error('This invite link has been turned off or replaced. Ask your GM for a new one.')
  const cloudId = data as string
  const { data: own } = await supabase.from('cloud_worlds').select('owner').eq('id', cloudId).maybeSingle()
  const { data: auth } = await supabase.auth.getUser()
  return { cloudId, isGM: !!own && own.owner === auth.user?.id }
}

/** Fetches (or refreshes) a joined world onto this device. Returns the local world id. */
export async function loadMemberWorld(cloudId: string): Promise<string> {
  const { data, error } = await supabase.rpc('member_world', { wid: cloudId })
  if (error) throw error
  if (!data) {
    // Removed from the world by the GM (or left on another device): drop the stale copy.
    const local = await db.worlds.get(memberWorldId(cloudId))
    if (local) await deleteLocalCopy(local.id)
    throw new Error('You’re no longer a player in this world. Ask your GM for a new invite.')
  }
  const { data: session } = await supabase.auth.getSession()
  const access = session.session?.access_token
  const fetchAsset = (assetId: string) =>
    fetch(`${SUPABASE_URL}/functions/v1/shared-asset?world=${encodeURIComponent(cloudId)}&id=${encodeURIComponent(assetId)}`, {
      headers: access ? { Authorization: `Bearer ${access}` } : {},
    })
  const p = data as SharedPayload & Pick<SharedInfo, 'me' | 'members' | 'claims'>
  return storePlayerCopy(p, memberWorldId(cloudId), `@m${cloudId.slice(0, 8)}`, { memberOf: cloudId, me: p.me, members: p.members, claims: p.claims }, fetchAsset)
}

/** The GM's id for a character in a joined world (local ids carry a suffix). */
const cloudEntityId = (localId: string) => localId.replace(/@m[0-9a-f]{8}$/, '')

export async function claimCharacter(cloudId: string, localEntityId: string) {
  const { error } = await supabase.rpc('claim_character', { wid: cloudId, eid: cloudEntityId(localEntityId) })
  if (error) throw error
  await loadMemberWorld(cloudId)
}

/** Lets go of a character: the player who holds it, or the GM (pass the GM's own entity id). */
export async function releaseCharacter(cloudId: string, entityId: string, refresh = true) {
  const { error } = await supabase.rpc('release_character', { wid: cloudId, eid: cloudEntityId(entityId) })
  if (error) throw error
  if (refresh) await loadMemberWorld(cloudId)
}

export async function savePlayerNotes(cloudId: string, localEntityId: string, notes: string) {
  const { error } = await supabase.rpc('set_player_notes', { wid: cloudId, eid: cloudEntityId(localEntityId), notes })
  if (error) throw error
  // Update the local copy straight away rather than waiting for a refresh.
  const worldId = memberWorldId(cloudId)
  await db.worlds
    .where('id')
    .equals(worldId)
    .modify((w) => {
      const c = w.shared?.claims?.find((x) => x.entityId === localEntityId)
      if (c) c.notes = notes
    })
}

export async function leaveWorld(cloudId: string) {
  const { data: auth } = await supabase.auth.getUser()
  if (auth.user) await supabase.from('world_members').delete().eq('world_id', cloudId).eq('user_id', auth.user.id)
  await deleteLocalCopy(memberWorldId(cloudId))
}

async function deleteLocalCopy(worldId: string) {
  await db.transaction('rw', [db.worlds, db.campaigns, db.entities, db.maps, db.pins, db.sessions, db.assets], async () => {
    for (const t of [db.campaigns, db.entities, db.maps, db.pins, db.sessions, db.assets] as const) await t.where({ worldId }).delete()
    await db.worlds.delete(worldId)
  })
}

/** Worlds you've joined as a player (for opening them on another device). */
export async function listMyMemberships(): Promise<{ cloudId: string; name: string }[]> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return []
  const { data, error } = await supabase
    .from('world_members')
    .select('world_id, cloud_worlds(name)')
    .eq('user_id', auth.user.id)
    .eq('role', 'player')
  if (error) throw error
  return (data as unknown as { world_id: string; cloud_worlds: { name: string } | null }[]).map((r) => ({
    cloudId: r.world_id,
    name: r.cloud_worlds?.name ?? 'A world',
  }))
}

/** Remembers an invite across signing up (the confirmation email opens the app without it). */
export const pendingInvite = {
  get: () => {
    try {
      return localStorage.getItem('codex.pendingInvite')
    } catch {
      return null
    }
  },
  set: (token: string | null) => {
    try {
      if (token) localStorage.setItem('codex.pendingInvite', token)
      else localStorage.removeItem('codex.pendingInvite')
    } catch {
      // Storage blocked; the player can open the invite link again.
    }
  },
}
