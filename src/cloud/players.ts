import { db, type Availability, type PlayerNote, type PlayerQuestion, type SharedInfo } from '../db'
import { tellPlayers } from './sync'
import { appUrl, supabase, SUPABASE_URL } from './client'
import { storePlayerCopy, tellOtherPlayers, type SharedPayload } from './share'

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
/** The co-GM link opens the same join page; the server decides the role from the token. */
export const gmInviteUrl = (token: string) => `${appUrl()}#/join/${token}?as=gm`

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

// ---- Co-GMs (owner only) ----

export async function getGmInviteToken(worldId: string): Promise<string | null> {
  const { data, error } = await supabase.from('gm_invites').select('token').eq('world_id', worldId).maybeSingle()
  if (error) throw error
  return (data?.token as string | null) ?? null
}

/** Creates a new co-GM link, replacing any old one. Co-GMs who already joined stay in. */
export async function createGmInviteLink(worldId: string) {
  const token = newToken()
  const { error } = await supabase.from('gm_invites').upsert({ world_id: worldId, token }, { onConflict: 'world_id' })
  if (error) throw error
  return token
}

export async function revokeGmInviteLink(worldId: string) {
  const { error } = await supabase.from('gm_invites').delete().eq('world_id', worldId)
  if (error) throw error
}

/** Your part in a cloud world: its owner, a co-GM, a player, or nothing. */
export async function myRole(worldId: string): Promise<'owner' | 'gm' | 'player' | null> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return null
  const { data: w } = await supabase.from('cloud_worlds').select('owner').eq('id', worldId).maybeSingle()
  if (w?.owner === auth.user.id) return 'owner'
  const { data: m } = await supabase.from('world_members').select('role').eq('world_id', worldId).eq('user_id', auth.user.id).maybeSingle()
  return (m?.role as 'gm' | 'player' | undefined) ?? null
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

/** Joins with an invite link. Returns the cloud world id, and whether you're one of its GMs (its owner, or a co-GM link). */
export async function joinWorld(token: string, name: string) {
  const { data, error } = await supabase.rpc('join_world', { token, name })
  if (error) throw error
  if (!data) throw new Error('This invite link has been turned off or replaced. Ask your GM for a new one.')
  const cloudId = data as string
  const role = await myRole(cloudId)
  const { data: w } = await supabase.from('cloud_worlds').select('name').eq('id', cloudId).maybeSingle()
  return { cloudId, isGM: role === 'owner' || role === 'gm', name: (w?.name as string | undefined) ?? '' }
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
  const p = data as SharedPayload & Pick<SharedInfo, 'me' | 'members' | 'claims' | 'notes' | 'availability' | 'questions'>
  return storePlayerCopy(
    p,
    memberWorldId(cloudId),
    `@m${cloudId.slice(0, 8)}`,
    { memberOf: cloudId, me: p.me, members: p.members, claims: p.claims, notes: p.notes, availability: p.availability, questions: p.questions },
    fetchAsset,
  )
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

/** A player updates the character they play: summary, details and their own write-up. Never touches the GM's text or secrets. */
export async function editMyCharacter(cloudId: string, localEntityId: string, sheet: { summary: string; fields: { key: string; value: string }[]; playerBody: string }) {
  const { error } = await supabase.rpc('edit_my_character', {
    wid: cloudId,
    eid: cloudEntityId(localEntityId),
    summary: sheet.summary,
    fields: sheet.fields.filter((f) => f.key.trim() || f.value.trim()),
    player_body: sheet.playerBody,
  })
  if (error) throw error
  await loadMemberWorld(cloudId)
  tellOtherPlayers(cloudId)
}

/** Saves a player's note on a page ('' for the scratchpad), private or for the whole group. */
export async function savePlayerNote(cloudId: string, localEntityId: string, shared: boolean, body: string) {
  const { error } = await supabase.rpc('save_player_note', { wid: cloudId, eid: localEntityId ? cloudEntityId(localEntityId) : '', shared, body })
  if (error) throw error
  await db.worlds
    .where('id')
    .equals(memberWorldId(cloudId))
    .modify((w) => {
      if (!w.shared) return
      const notes = (w.shared.notes ?? []).filter((n) => !(n.entityId === localEntityId && n.shared === shared))
      notes.push({ entityId: localEntityId, shared, body, updatedBy: w.shared.me, updatedAt: new Date().toISOString() })
      w.shared.notes = notes
    })
  if (shared) tellOtherPlayers(cloudId)
}

/** The group's notes in a world (for the GM). entityId is the GM's own page id, or '' for the scratchpad. */
export async function listGroupNotes(worldId: string): Promise<PlayerNote[]> {
  const { data, error } = await supabase.from('player_notes').select('entity_id, body, updated_by, updated_at').eq('world_id', worldId).eq('scope', 'group')
  if (error) throw error
  return data.map((r) => ({ entityId: r.entity_id, shared: true, body: r.body, updatedBy: r.updated_by, updatedAt: r.updated_at }))
}

/** Everyone's answers to proposed session dates (for the GM). */
export async function listAvailability(worldId: string): Promise<NonNullable<SharedInfo['availability']>> {
  const { data, error } = await supabase.from('availability').select('option_id, user_id, answer').eq('world_id', worldId)
  if (error) throw error
  return data.map((r) => ({ optionId: r.option_id, userId: r.user_id, answer: r.answer }))
}

/** A player says whether they can make a proposed date (null takes the answer back). */
export async function setAvailability(cloudId: string, optionId: string, answer: Availability | null) {
  const { error } = await supabase.rpc('set_availability', { wid: cloudId, option_id: optionId, answer })
  if (error) throw error
  await db.worlds
    .where('id')
    .equals(memberWorldId(cloudId))
    .modify((w) => {
      if (!w.shared?.me) return
      const me = w.shared.me
      const rest = (w.shared.availability ?? []).filter((a) => !(a.optionId === optionId && a.userId === me))
      w.shared.availability = answer ? [...rest, { optionId, userId: me, answer }] : rest
    })
  tellOtherPlayers(cloudId)
}

// ---- Questions to the GM ----

/** A player asks the GM something about a page ('' for anything else). */
export async function askQuestion(cloudId: string, localEntityId: string, body: string) {
  const { data, error } = await supabase.rpc('ask_question', { wid: cloudId, eid: localEntityId ? cloudEntityId(localEntityId) : '', body })
  if (error) throw error
  await db.worlds
    .where('id')
    .equals(memberWorldId(cloudId))
    .modify((w) => {
      if (!w.shared) return
      w.shared.questions = [...(w.shared.questions ?? []), { id: data as string, entityId: localEntityId, body, createdAt: new Date().toISOString() }]
    })
}

/** A player takes back a question they asked. */
export async function withdrawQuestion(cloudId: string, questionId: string) {
  const { error } = await supabase.rpc('withdraw_question', { qid: questionId })
  if (error) throw error
  await db.worlds
    .where('id')
    .equals(memberWorldId(cloudId))
    .modify((w) => {
      if (w.shared) w.shared.questions = (w.shared.questions ?? []).filter((q) => q.id !== questionId)
    })
}

/** Every player's questions in a world (for the GM), newest first. entityId is the GM's own page id. */
export async function listQuestions(worldId: string): Promise<PlayerQuestion[]> {
  const { data, error } = await supabase
    .from('player_questions')
    .select('id, entity_id, user_id, body, answer, answered_at, created_at')
    .eq('world_id', worldId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.map((r) => ({ id: r.id, entityId: r.entity_id, userId: r.user_id, body: r.body, answer: r.answer, answeredAt: r.answered_at, createdAt: r.created_at }))
}

/** The GM answers (or changes an answer); an empty answer marks it unanswered again. */
export async function answerQuestion(worldId: string, questionId: string, answer: string) {
  const a = answer.trim()
  const { error } = await supabase
    .from('player_questions')
    .update({ answer: a || null, answered_at: a ? new Date().toISOString() : null })
    .eq('world_id', worldId)
    .eq('id', questionId)
  if (error) throw error
  await tellPlayers(worldId)
}

export async function deleteQuestion(worldId: string, questionId: string) {
  const { error } = await supabase.from('player_questions').delete().eq('world_id', worldId).eq('id', questionId)
  if (error) throw error
  await tellPlayers(worldId)
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
