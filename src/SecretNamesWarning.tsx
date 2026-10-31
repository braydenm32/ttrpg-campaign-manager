import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Entity } from './db'
import { Help } from './help'
import { Ico } from './icons'
import { nameIndex } from './links'
import { stripSecrets } from './Markdown'
import { Warning } from '@phosphor-icons/react'

/**
 * The names a player would read in [[links]] that point at pages they can't see. Only text outside
 * secret passages counts, since that is all they receive. A link with its own label ([[Name|label]])
 * shows only the label, so it gives nothing away. Pages are matched by any of their names.
 */
export function secretNames(texts: (string | undefined)[], pages: Entity[]) {
  const byName = nameIndex(pages)
  const found = new Map<string, string>()
  for (const t of texts) {
    if (!t) continue
    for (const m of stripSecrets(t).matchAll(/\[\[([^\]|]+)(\|[^\]]*)?\]\]/g)) {
      const name = m[1].trim()
      if (m[2] !== undefined && m[2].length > 1) continue
      const page = byName.get(name.toLowerCase())
      if (page?.visibility === 'gm' && !found.has(name.toLowerCase())) found.set(name.toLowerCase(), name)
    }
  }
  return [...found.values()]
}

/**
 * A reminder under a text box whose text players will read: lists [[links]] to GM-only pages, whose
 * names players would see. It only warns, saving is never held up. `show` is false when players
 * won't receive the text (the page or pin is still GM only).
 */
export function SecretNamesWarning({ worldId, texts, show = true }: { worldId: string; texts: (string | undefined)[]; show?: boolean }) {
  const pages = useLiveQuery(() => db.entities.where({ worldId }).filter((e) => !e.template).toArray(), [worldId])
  if (!show || !pages) return null
  const names = secretNames(texts, pages)
  if (!names.length) return null
  return (
    <p className="secret-names small" role="status">
      <Ico as={Warning} /> Players will see these names: {names.join(', ')}. <Help topic="secretNames" />
    </p>
  )
}
