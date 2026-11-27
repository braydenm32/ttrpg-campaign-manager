import { db } from './db'
import { pinRevealed } from './fog'
import { splitSecrets } from './Markdown'
import { revealDue } from './revealDue'
import { unshowableImages } from './showing'

/**
 * Where each of a world's files is used: a page's picture or text, a map, the cover, a handout,
 * the soundboard, a session's recording or scene. Files shows it under each file, names the
 * example's pictures after what they're for, and finds the ones used nowhere.
 */
export async function assetUses(worldId: string) {
  const uses = new Map<string, string[]>()
  const add = (id: string | undefined | null, where: string) => {
    if (!id) return
    const list = uses.get(id) ?? []
    if (!list.includes(where)) list.push(where)
    uses.set(id, list)
  }
  const inText = (text: string | undefined, where: string) => {
    for (const m of (text ?? '').matchAll(/asset:([0-9a-fA-F-]{36})/g)) add(m[1], where)
  }
  const [world, entities, maps, pins, sounds, sessions] = await Promise.all([
    db.worlds.get(worldId),
    db.entities.where({ worldId }).toArray(),
    db.maps.where({ worldId }).toArray(),
    db.pins.where({ worldId }).toArray(),
    db.sounds.where({ worldId }).toArray(),
    db.sessions.where({ worldId }).toArray(),
  ])
  if (world) {
    add(world.coverId, 'The world’s cover')
    for (const h of world.handouts ?? []) add(h.assetId, `Handout: ${h.title}`)
    add(world.showing?.assetId, `On players’ screens: ${world.showing?.title ?? ''}`)
  }
  for (const e of entities) {
    add(e.imageId, e.name)
    for (const t of [e.body, e.gmNotes, e.playerBody]) inText(t, e.name)
  }
  for (const m of maps) {
    add(m.imageId, `Map: ${m.name}`)
    add(m.playerImageId, `Map: ${m.name} (players’ copy)`)
    add(m.fog?.imageId, `Map: ${m.name} (with fog)`)
  }
  const mapName = new Map(maps.map((m) => [m.id, m.name]))
  for (const p of pins) inText(p.note, `Pin on ${mapName.get(p.mapId) ?? 'a map'}`)
  for (const s of sounds) add(s.assetId, `Sound: ${s.name}`)
  for (const s of sessions) {
    const name = `Session ${s.number}: ${s.title}`
    for (const r of s.recordings ?? []) add(r.assetId, `${name} (recording)`)
    for (const sc of s.prep?.scenes ?? []) if (sc.show?.kind === 'image') add(sc.show.assetId, name)
    for (const t of [s.notes, s.recap]) inText(t, name)
  }
  return uses
}

/** A file named by an internal key ("sil:npc-jeb", "handout:h-tax-notice") rather than by a person. */
export const keyNamed = (name: string) => /^[a-z]+:[a-z0-9-]+$/.test(name)

/** What to call a file: its own name, or for one named by a key, what it's used for. */
export function friendlyName(name: string, uses?: string[]) {
  if (!keyNamed(name)) return name
  const first = uses?.find((u) => !u.startsWith('Map:'))
  return first ? `${first.replace(/^Handout: /, '')} (picture)` : name.replace(/^[a-z]+:/, '').replace(/-/g, ' ')
}

/** Why players get a file: what it is to them, and whether every player gets it or only some. */
export interface PlayersGet {
  /** Ways every player (and the wiki link, where it's a page or map) gets it. */
  all: string[]
  /** Ways only some players get it: a page revealed to some of them, a secret for some characters. */
  some: string[]
}

/**
 * Which files reach players, and why, worked out the way public.player_view does on the server
 * (its "assets" part), which decides what players receive: a file goes to players when it is marked
 * for players, or is the world's cover, the picture on a page they can read, the picture players
 * get of a map they can see, on their screens now, an image handout, or a picture in text they
 * receive (a page, a recap, a pin's note; GM-only passages left out). Whatever its own mark says,
 * it is never sent when it's the clean picture of a fogged map or the GM's copy of a map with
 * secrets (see unshowableImages). Keep in step with player_view. Files marked for players are not
 * listed here: their own mark says so.
 */
export async function filesForPlayers(worldId: string) {
  const out = new Map<string, PlayersGet>()
  const add = (id: string | undefined | null, why: string, some = false) => {
    if (!id) return
    const got = out.get(id) ?? { all: [], some: [] }
    const list = some ? got.some : got.all
    if (!list.includes(why)) list.push(why)
    out.set(id, got)
  }
  // Pictures in text: in the open, every reader gets them; in a ":::for" passage only those characters' players.
  const inText = (text: string | undefined, why: string, someWhy: string, some = false) => {
    const walk = (t: string, inFor: boolean) => {
      for (const seg of splitSecrets(t)) {
        if (seg.kind === 'text') for (const m of seg.body.matchAll(/asset:([0-9a-fA-F-]{36})/g)) add(m[1], inFor ? someWhy : why, inFor || some)
        else if (seg.kind === 'for') walk(seg.body, true)
      }
    }
    walk(text ?? '', false)
  }
  const [world, entities, maps, pins, sessions, campaigns] = await Promise.all([
    db.worlds.get(worldId),
    db.entities.where({ worldId }).toArray(),
    db.maps.where({ worldId }).toArray(),
    db.pins.where({ worldId }).toArray(),
    db.sessions.where({ worldId }).toArray(),
    db.campaigns.where({ worldId }).toArray(),
  ])
  if (world) {
    add(world.coverId, 'it’s the world’s cover')
    if (world.showing?.kind === 'image') add(world.showing.assetId, 'it’s on their screens now')
    for (const h of world.handouts ?? []) {
      const at = (h as { revealAt?: number }).revealAt
      if (h.kind === 'image' && (typeof at !== 'number' || revealDue({ revealAt: at }))) add(h.assetId, `it’s the handout “${h.title}”`)
    }
  }
  for (const e of entities) {
    if (e.template) continue
    const open = e.visibility === 'players' || revealDue(e)
    if (!open && !e.revealedTo?.length) continue
    const some = !open
    add(e.imageId, some ? `it’s the picture on “${e.name}”, revealed to some players` : `it’s the picture on “${e.name}”, a page they can read`, some)
    inText(e.body, `it’s in the text of “${e.name}”, a page they can read`, `it’s in a secret for some characters on “${e.name}”`, some)
  }
  const shownMaps = new Map<string, (typeof maps)[number]>()
  for (const m of maps) {
    if (m.visibility !== 'players' || (m.fog?.on && !m.fog.imageId)) continue
    shownMaps.set(m.id, m)
    add(m.fog?.on ? m.fog.imageId : m.playerImageId || m.imageId, `it’s the picture of “${m.name}”, a map they can see`)
  }
  for (const p of pins) {
    const m = shownMaps.get(p.mapId)
    if (m && p.visibility === 'players' && pinRevealed(m.fog, p)) inText(p.note, `it’s in a pin’s note on “${m.name}”`, `it’s in a secret for some characters in a pin on “${m.name}”`)
  }
  const openCampaigns = new Set(campaigns.filter((c) => (c.visibility ?? 'players') === 'players').map((c) => c.id))
  for (const s of sessions)
    if (s.visibility === 'players' && openCampaigns.has(s.campaignId))
      inText(s.recap, `it’s in the recap of #${s.number} ${s.title}`, `it’s in a secret for some characters in the recap of #${s.number} ${s.title}`)
  // Never sent, whatever else uses it.
  for (const id of (await unshowableImages(worldId)).keys()) out.delete(id)
  return out
}
