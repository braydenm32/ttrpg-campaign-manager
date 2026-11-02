import { db } from './db'

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
