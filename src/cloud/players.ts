import { db, type Entity, type Availability, type PlayerNote, type PlayerQuestion, type SharedInfo } from '../db'
import { tellPlayers } from './sync'
import { appLink, supabase } from './client'
import { downloadFiles, storePlayerCopy, tellOtherPlayers, type SharedPayload } from './share'

/**
 * Players joining a world. The GM makes an invite link; a player opens it, signs in, and gets a
 * read-only copy of the player-safe parts (filtered on the server by public.member_world), plus the
 * chance to claim a player character as theirs.
 */

function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export const inviteUrl = (token: string) => appLink(`/join/${token}`)
/** The co-GM link opens the same join page; the server decides the role from the token. */
export const gmInviteUrl = (token: string) => appLink(`/join/${token}?as=gm`)

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
  /** False while the GM hasn't approved the claim yet. */
  approved: boolean
  /** When it was asked for ('' if the server doesn't say). */
  createdAt: string
}

/** Who has joined, and who plays which character (for the GM). */
export async function listPlayers(worldId: string): Promise<{ members: Member[]; claims: Claim[] }> {
  const [m, c] = await Promise.all([
    supabase.from('world_members').select('user_id, display_name, role, created_at').eq('world_id', worldId).order('created_at'),
    supabase.from('character_claims').select('*').eq('world_id', worldId),
  ])
  if (m.error) throw m.error
  if (c.error) throw c.error
  return {
    members: m.data.map((r) => ({ userId: r.user_id, name: r.display_name || UNNAMED, role: r.role, joinedAt: r.created_at })),
    claims: c.data.map((r) => ({ entityId: r.entity_id, userId: r.user_id, notes: r.player_notes, approved: r.approved !== false, createdAt: r.claimed_at ?? '' })),
  }
}

/** The GM lets a player play the character they asked for. */
export async function approveClaim(worldId: string, entityId: string) {
  const { error } = await supabase.from('character_claims').update({ approved: true }).eq('world_id', worldId).eq('entity_id', entityId)
  if (error) throw error
  await tellPlayers(worldId)
}

/** What someone who joined with no name (or only a link) is listed as. */
export const UNNAMED = 'Unnamed player'

/**
 * Characters a name could hide another name with: control characters, ones that don't show
 * (zero-width spaces and joiners, a soft hyphen) and ones that turn text around (a right-to-left
 * override makes "Sam" show as something else). The combining grapheme joiner (U+034F) is outside
 * the brackets only because a combining mark inside them reads as joined to the one before.
 */
const HIDDEN_CHARS = /[\p{Cc}\u00ad\u061c\u180e\u200b-\u200f\u2028-\u202e\u2060-\u2064\u2066-\u2069\ufeff]|\u034f/u

/** A name as the table tells names apart: letter case, spacing and look-alike letters ("Ｓａｍ") don't count. */
const foldName = (n: string) => n.normalize('NFKC').replace(new RegExp(HIDDEN_CHARS.source, 'gu'), '').replace(/\s+/g, ' ').trim().toLowerCase()
export const sameName = (a: string, b: string) => foldName(a) === foldName(b)

/** A name that reads as the GM's: "GM", "DM Sam", "The Game Master". */
export const soundsLikeGM = (n: string) => /^\s*(the\s+)?(gm|dm|game\s*master|dungeon\s*master)\b/i.test(n.normalize('NFKC'))

/**
 * What's wrong with a name for the table, or '' if it's fine: empty, the invite link pasted into
 * the name box (the usual slip), hidden characters, a name someone else in the world already has
 * (`taken`: the others' names), or, for a player naming themselves (`player`), one that reads as
 * the GM's. The server checks the first two (public.member_name_ok); the rest need it to as well.
 */
export function nameProblem(name: string, whose: 'your' | 'their' = 'your', { taken = [], player = false }: { taken?: string[]; player?: boolean } = {}) {
  const n = name.trim()
  if (!n) return `Type the name the table should call ${whose === 'your' ? 'you' : 'them'}.`
  if (/:\/\/|^www\.|\/join\//i.test(n)) return `That looks like the invite link. Type ${whose} name instead, e.g. Sam.`
  if (HIDDEN_CHARS.test(n)) return `That name has hidden characters in it (ones that don’t show, or that turn the text around). Type ${whose === 'your' ? 'your' : 'the'} name again by hand.`
  if (taken.some((t) => t !== UNNAMED && sameName(t, n))) return `Someone in this world is already called “${n}”. Pick a name the table can tell apart, e.g. ${n.split(/\s+/)[0]} B.`
  if (player && soundsLikeGM(n)) return `That reads like the GM’s name. Pick ${whose} own, so nobody takes ${whose === 'your' ? 'you' : 'them'} for the GM.`
  return ''
}

/** What's wrong with someone's name as it is now, for a notice by it: a link, hidden characters, or someone else's name too. */
export function nameNow(name: string, others: string[]) {
  const n = name.trim()
  if (!n || name === UNNAMED) return undefined
  if (/:\/\/|^www\.|\/join\//i.test(n)) return 'link'
  if (nameProblem(n)) return 'hidden'
  if (others.some((o) => o !== UNNAMED && sameName(o, n))) return 'taken'
  return undefined
}

/** The GM (or a co-GM) renames someone who joined: a typo, or a link where their name should be. */
export async function renamePlayer(worldId: string, userId: string, name: string) {
  const problem = nameProblem(name, 'their')
  if (problem) throw new Error(problem)
  const { error } = await supabase.rpc('rename_member', { wid: worldId, uid: userId, name: name.trim().slice(0, 60) })
  if (error) throw error
  await tellPlayers(worldId)
}

export async function removePlayer(worldId: string, userId: string) {
  const { error } = await supabase.from('world_members').delete().eq('world_id', worldId).eq('user_id', userId)
  if (error) throw error
}

// ---- Player side ----

/** A player changes the name others in the world see them by. `me` is their user id (the world's shared.me); the server checks it's really them. */
export async function renameMe(cloudId: string, me: string, name: string) {
  // The others in the world, as their copy of it last heard: two people with one name can't be told apart.
  const copy = await db.worlds.filter((w) => w.shared?.memberOf === cloudId).first()
  const taken = (copy?.shared?.members ?? []).filter((m) => m.userId !== me).map((m) => m.name)
  const problem = nameProblem(name, 'your', { taken, player: true })
  if (problem) throw new Error(problem)
  const clean = name.trim().slice(0, 60)
  const { error } = await supabase.rpc('rename_member', { wid: cloudId, uid: me, name: clean })
  if (error) throw error
  await db.worlds
    .filter((w) => w.shared?.memberOf === cloudId)
    .modify((w) => {
      const m = w.shared?.members?.find((x) => x.userId === me)
      if (m) m.name = clean
    })
  tellOtherPlayers(cloudId)
}

/** Joins with an invite link. Returns the cloud world id, and whether you're one of its GMs (its owner, or a co-GM link). */
export async function joinWorld(token: string, name: string) {
  const { data, error } = await supabase.rpc('join_world', { token, name })
  if (error) throw error
  if (!data) throw new Error('This invite link has been used, turned off or replaced. Ask your GM for a new one.')
  const cloudId = data as string
  const role = await myRole(cloudId)
  const isGM = role === 'owner' || role === 'gm'
  // GMs can read the world's row; players get its name from their list of worlds.
  const worldName = isGM
    ? (((await supabase.from('cloud_worlds').select('name').eq('id', cloudId).maybeSingle()).data?.name as string | undefined) ?? '')
    : ((await listMyMemberships()).find((m) => m.cloudId === cloudId)?.name ?? '')
  return { cloudId, isGM, name: worldName }
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
  const p = data as SharedPayload & Pick<SharedInfo, 'me' | 'members' | 'claims' | 'notes' | 'availability' | 'questions'>
  return storePlayerCopy(
    p,
    memberWorldId(cloudId),
    `@m${cloudId.slice(0, 8)}`,
    { memberOf: cloudId, me: p.me, members: p.members, claims: p.claims, notes: p.notes, availability: p.availability, questions: p.questions },
    (ids) => downloadFiles({ world: cloudId }, ids, access),
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

/** A player changes one number on their sheet (their HP, say) without opening the whole editor. Goes through the same path as the editor. */
export function setMyField(cloudId: string, entity: Entity, key: RegExp, value: string) {
  let done = false
  const fields = entity.fields.map((f) => {
    if (done || f.gm || !key.test(f.key.trim())) return f
    done = true
    return { ...f, value }
  })
  return editMyCharacter(cloudId, entity.id, { summary: entity.summary, fields, playerBody: entity.playerBody ?? '' })
}

/** A group note someone else saved while this player was typing. */
export interface NoteClash {
  body: string
  updatedBy: string
  updatedAt: string
}

/**
 * Saves a player's note on a page ('' for the scratchpad), private or for the whole group. For a group
 * note, `expected` is when the note was last saved as this player saw it: if someone else has saved
 * since, nothing is written and their version comes back. Pass null to save anyway.
 */
export async function savePlayerNote(cloudId: string, localEntityId: string, shared: boolean, body: string, expected: string | null = null): Promise<NoteClash | null> {
  const { data, error } = await supabase.rpc('save_player_note', { wid: cloudId, eid: localEntityId ? cloudEntityId(localEntityId) : '', shared, body, expected })
  if (error) throw error
  const clash = data as NoteClash | null
  await db.worlds
    .where('id')
    .equals(memberWorldId(cloudId))
    .modify((w) => {
      if (!w.shared) return
      const notes = (w.shared.notes ?? []).filter((n) => !(n.entityId === localEntityId && n.shared === shared))
      notes.push(clash ? { entityId: localEntityId, shared, ...clash } : { entityId: localEntityId, shared, body, updatedBy: w.shared.me, updatedAt: new Date().toISOString() })
      w.shared.notes = notes
    })
  if (shared && !clash) tellOtherPlayers(cloudId)
  return clash
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

/** Worlds joined with an invite that are saved on this device (read-only player copies). */
export const joinedHere = () => db.worlds.filter((w) => !!w.shared?.memberOf).toArray()

/**
 * Removes this device's copies of joined worlds (when signing out on a shared computer, say).
 * Only the copies here: you stay a member, and Home lists them to open again once you sign back in.
 */
export async function removeJoinedCopies() {
  for (const w of await joinedHere()) await deleteLocalCopy(w.id)
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
  const { data, error } = await supabase.rpc('my_memberships')
  if (error) throw error
  return ((data ?? []) as { cloudId: string; name: string | null }[]).map((r) => ({ cloudId: r.cloudId, name: r.name || 'A world' }))
}

/** Remembers an invite across signing up (the confirmation email opens the app without it). */
/**
 * An invite someone opened while signed out, so the app can bring them back to it after they sign in
 * (Google sends them to the front page) or confirm their email. Kept for a day at most, and dropped as
 * soon as a signed-in person sees the invite page: otherwise an invite opened once and left would send
 * the front page back to it every time, and the Back button could never get past it.
 */
const INVITE_KEY = 'codex.pendingInvite'
const INVITE_KEEP_MS = 24 * 3600 * 1000
export const pendingInvite = {
  get: (): string | null => {
    try {
      const raw = localStorage.getItem(INVITE_KEY)
      if (!raw) return null
      // Older versions kept the bare token with no date: treat it as stale.
      const saved = raw.startsWith('{') ? (JSON.parse(raw) as { token?: string; at?: number }) : {}
      if (saved.token && saved.at && Date.now() - saved.at < INVITE_KEEP_MS) return saved.token
      localStorage.removeItem(INVITE_KEY)
      return null
    } catch {
      return null
    }
  },
  set: (token: string | null) => {
    try {
      if (token) localStorage.setItem(INVITE_KEY, JSON.stringify({ token, at: Date.now() }))
      else localStorage.removeItem(INVITE_KEY)
    } catch {
      // Storage blocked; the player can open the invite link again.
    }
  },
}

// ---- GM replies in the party's notes ----

/** The GM adds a line, signed "GM", to the party's shared notes on a page ('' for the scratchpad). */
export async function replyInGroupNotes(worldId: string, entityId: string, line: string) {
  const { error } = await supabase.rpc('gm_note_reply', { wid: worldId, eid: entityId, line })
  if (error) throw error
  await tellPlayers(worldId)
}

// ---- Players' new characters ----

export interface CharacterSheet {
  name: string
  summary: string
  fields: { key: string; value: string }[]
  playerBody: string
}

export interface CharacterRequest {
  id: string
  userId: string
  sheet: CharacterSheet
  status: 'pending' | 'approved' | 'declined'
  gmNote: string
  createdAt: string
}

const toRequest = (r: Record<string, unknown>): CharacterRequest => ({
  id: r.id as string,
  userId: r.user_id as string,
  sheet: r.sheet as CharacterSheet,
  status: r.status as CharacterRequest['status'],
  gmNote: (r.gm_note as string) ?? '',
  createdAt: r.created_at as string,
})

/** A player sends the GM a character they've written up. */
export async function requestCharacter(cloudId: string, sheet: CharacterSheet) {
  const { error } = await supabase.rpc('request_character', { wid: cloudId, sheet })
  if (error) throw error
}

/** A player's own requests in a world (waiting or turned down; approved ones are just their character). */
export async function listMyCharacterRequests(cloudId: string): Promise<CharacterRequest[]> {
  const { data: auth } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('character_requests')
    .select('id, user_id, sheet, status, gm_note, created_at')
    .eq('world_id', cloudId)
    .eq('user_id', auth.user?.id ?? '')
    .neq('status', 'approved')
    .order('created_at')
  if (error) throw error
  return data.map(toRequest)
}

export async function withdrawCharacterRequest(id: string) {
  const { error } = await supabase.rpc('withdraw_character_request', { rid: id })
  if (error) throw error
}

/** New characters waiting for the GM. */
export async function listCharacterRequests(worldId: string): Promise<CharacterRequest[]> {
  const { data, error } = await supabase
    .from('character_requests')
    .select('id, user_id, sheet, status, gm_note, created_at')
    .eq('world_id', worldId)
    .eq('status', 'pending')
    .order('created_at')
  if (error) throw error
  return data.map(toRequest)
}

/** The GM answers. Approving needs the id of the page the GM's app made for the character. */
export async function answerCharacterRequest(worldId: string, id: string, approve: boolean, note: string, entityId = '') {
  const { error } = await supabase.rpc('answer_character_request', { rid: id, approve, note, eid: entityId })
  if (error) throw error
  await tellPlayers(worldId)
}
