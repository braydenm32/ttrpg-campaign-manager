import { blankEntity, db, saveEntity, type Entity } from '../db'
import { saveFileAsAsset } from '../hooks'
import type { Gear, Sheet } from './parse'

/**
 * Putting an imported sheet on a character page. Importing again (after a level-up) updates the same
 * page: the sheet's own section and its numbers change, and nothing else does. GM notes, secrets,
 * GM-only fields and anything written outside the sheet section stay as they were.
 *
 * Gear becomes item pages carried by the character (for the GM), or a list in the sheet section (for
 * a player, who can't make pages).
 */

const HEADING = '## Character sheet'

/** The sheet as a section of a page, with where and when it came from. */
export function sheetSection(sheet: Sheet, gearAsList = false) {
  const when = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  // Headings inside stay below the section's own, so the next import knows where the section ends.
  const list =
    gearAsList && sheet.gear?.length
      ? `\n\n### Gear\n\n${gearOf(sheet)
          .map((g) => `- ${gearLine(g)}`)
          .join('\n')}`
      : ''
  const body = (sheet.body + list).trim().replace(/^#{1,2} /gm, '### ')
  return `${HEADING}\n\n*Imported from ${sheet.source} on ${when}.*\n\n${body}`.trim()
}

/** Puts the sheet section in a page's text, replacing the one from the last import. */
export function withSheet(text: string, sheet: Sheet, gearAsList = false) {
  const section = sheetSection(sheet, gearAsList)
  const start = text.indexOf(HEADING)
  if (start < 0) return text.trim() ? `${text.trim()}\n\n${section}` : section
  const rest = text.slice(start + HEADING.length)
  const next = rest.search(/\n## /)
  const after = next < 0 ? '' : rest.slice(next).trim()
  return `${text.slice(0, start)}${section}${after ? `\n\n${after}` : ''}`.trim()
}

/** The sheet's fields over a page's: same names get the new value, new ones go on the end, GM-only ones are left alone. */
export function mergeFields(old: Entity['fields'], incoming: Sheet['fields']) {
  const out = old.filter((f) => f.key.trim() || f.value.trim()).map((f) => ({ ...f }))
  for (const f of incoming) {
    const same = out.find((o) => o.key.trim().toLowerCase() === f.key.toLowerCase())
    if (!same) out.push({ key: f.key, value: f.value })
    else if (!same.gm) same.value = f.value
  }
  return out
}

/** The sheet's gear with repeats added together ("Dagger" twice is 2 daggers). */
export function gearOf(sheet: Sheet): Gear[] {
  const out = new Map<string, Gear>()
  for (const g of sheet.gear ?? []) {
    const k = g.name.toLowerCase()
    const had = out.get(k)
    out.set(k, had ? { ...had, quantity: had.quantity + g.quantity, equipped: had.equipped || g.equipped } : { ...g })
  }
  return [...out.values()]
}

const WORN = 'Worn or in hand'

/** "Rope (2) ✓" (✓: worn or in hand). */
export const gearLine = (g: Gear) => `${g.name}${g.quantity > 1 ? ` (${g.quantity})` : ''}${g.equipped ? ' ✓' : ''}`

/**
 * Each piece of gear as an item page carried by the character. Items they already carry with the same
 * name are updated (how many, worn or not) rather than made twice; anything they carry that the sheet
 * no longer lists is left alone, since it may have been handed over or written by the GM. New items
 * are as visible as the character: a revealed character's gear is revealed too.
 */
async function applyGear(character: Entity, sheet: Sheet) {
  const gear = gearOf(sheet)
  if (!gear.length) return
  const carried = await db.entities
    .where({ worldId: character.worldId, type: 'item' })
    .filter((i) => i.heldBy === character.id)
    .toArray()
  const now = Date.now()
  const added: Entity[] = []
  for (const [n, g] of gear.entries()) {
    const had = carried.find((i) => i.name.trim().toLowerCase() === g.name.toLowerCase())
    const summary = g.equipped ? WORN : ''
    if (had) {
      // Their own summary stays; only the one the import wrote changes with the sheet.
      const next = { quantity: g.quantity, summary: had.summary && had.summary !== WORN ? had.summary : summary, body: had.body || g.description || '' }
      if (next.quantity !== had.quantity || next.summary !== had.summary || next.body !== had.body) await saveEntity({ ...had, ...next, updatedAt: now })
    } else {
      const item = blankEntity(character.worldId, 'item', g.name)
      added.push({
        ...item,
        summary,
        body: g.description ?? '',
        heldBy: character.id,
        quantity: g.quantity,
        visibility: character.visibility,
        createdAt: now + n,
        updatedAt: now + n,
      })
    }
  }
  if (added.length) await db.entities.bulkAdd(added)
}

/** A portrait from the web, when the other site lets the app fetch it. */
async function fetchPortrait(worldId: string, url: string, name: string) {
  try {
    const res = await fetch(url)
    if (!res.ok) return undefined
    const blob = await res.blob()
    if (!blob.type.startsWith('image/')) return undefined
    return await saveFileAsAsset(worldId, blob, `${name} portrait`, [name])
  } catch {
    return undefined
  }
}

/** The GM's import: a new character page (GM only, like every import), or an update to one. Returns its id. */
export async function applySheet(worldId: string, sheet: Sheet, intoId?: string): Promise<string> {
  const existing = intoId ? await db.entities.get(intoId) : undefined
  const e: Entity = existing ? structuredClone(existing) : blankEntity(worldId, 'pc', sheet.name)
  e.summary = sheet.summary || e.summary
  e.fields = mergeFields(e.fields, sheet.fields)
  e.body = withSheet(e.body, sheet)
  if (!e.imageId && sheet.portraitUrl) e.imageId = await fetchPortrait(worldId, sheet.portraitUrl, sheet.name)
  e.updatedAt = Date.now()
  if (existing) await saveEntity(e)
  else await db.entities.add(e)
  await applyGear(e, sheet)
  return e.id
}

/** A player's import onto the character they play: what goes into their own editor to look over and save. */
export function playerSheet(entity: Entity, sheet: Sheet) {
  return {
    summary: sheet.summary || entity.summary,
    fields: mergeFields(entity.fields, sheet.fields).filter((f) => !f.gm),
    playerBody: withSheet(entity.playerBody ?? '', sheet, true),
  }
}
