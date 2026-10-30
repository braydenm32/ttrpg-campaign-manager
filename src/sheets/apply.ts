import { blankEntity, db, saveEntity, type Entity } from '../db'
import { saveFileAsAsset } from '../hooks'
import type { Sheet } from './parse'

/**
 * Putting an imported sheet on a character page. Importing again (after a level-up) updates the same
 * page: the sheet's own section and its numbers change, and nothing else does. GM notes, secrets,
 * GM-only fields and anything written outside the sheet section stay as they were.
 */

const HEADING = '## Character sheet'

/** The sheet as a section of a page, with where and when it came from. */
export function sheetSection(sheet: Sheet) {
  const when = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  // Headings inside stay below the section's own, so the next import knows where the section ends.
  const body = sheet.body.replace(/^#{1,2} /gm, '### ')
  return `${HEADING}\n\n*Imported from ${sheet.source} on ${when}.*\n\n${body}`.trim()
}

/** Puts the sheet section in a page's text, replacing the one from the last import. */
export function withSheet(text: string, sheet: Sheet) {
  const section = sheetSection(sheet)
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
  return e.id
}

/** A player's import onto the character they play: what goes into their own editor to look over and save. */
export function playerSheet(entity: Entity, sheet: Sheet) {
  return {
    summary: sheet.summary || entity.summary,
    fields: mergeFields(entity.fields, sheet.fields).filter((f) => !f.gm),
    playerBody: withSheet(entity.playerBody ?? '', sheet),
  }
}
