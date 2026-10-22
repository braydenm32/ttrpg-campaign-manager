import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Empty, Modal } from './components'
import { db, saveEntity, typeLabel, type Entity, type PageVersion } from './db'
import { Help } from './help'
import { useWorld } from './hooks'

/**
 * Page history: every save keeps the version it replaced, on this device. Changes that arrive from
 * another device are kept too, and so are deleted pages, so nothing is ever more than a click away.
 */

const REASON: Record<PageVersion['reason'], string> = {
  edit: 'Before an edit',
  synced: 'Before a change from another device',
  deleted: 'When it was deleted',
}

const when = (t: number) => new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

/** What changed between an old version and the page now, in a few words. */
function changes(old: Entity, now: Entity | undefined) {
  if (!now) return ''
  const out: string[] = []
  if (old.name !== now.name) out.push(`name was “${old.name}”`)
  if (old.summary !== now.summary) out.push('summary')
  if (old.body !== now.body) out.push(`description (${old.body.length} → ${now.body.length} letters)`)
  if (old.gmNotes !== now.gmNotes) out.push('GM notes')
  if (old.visibility !== now.visibility) out.push(old.visibility === 'gm' ? 'was GM only' : 'was revealed')
  if (JSON.stringify(old.fields) !== JSON.stringify(now.fields)) out.push('details')
  if (JSON.stringify(old.entries) !== JSON.stringify(now.entries)) out.push('table entries')
  if (JSON.stringify(old.tags) !== JSON.stringify(now.tags)) out.push('tags')
  return out.length ? `Different: ${out.join(', ')}` : 'Same text as now'
}

export function HistoryButton({ entity }: { entity: Entity }) {
  const [open, setOpen] = useState(false)
  const count = useLiveQuery(() => db.history.where({ entityId: entity.id }).count(), [entity.id]) ?? 0
  if (!count) return null
  return (
    <>
      <button className="ghost" title="Earlier versions of this page" onClick={() => setOpen(true)}>
        🕘 History
      </button>
      {open && <HistoryModal entity={entity} onClose={() => setOpen(false)} />}
    </>
  )
}

function HistoryModal({ entity, onClose }: { entity: Entity; onClose: () => void }) {
  const versions = useLiveQuery(() => db.history.where({ entityId: entity.id }).reverse().sortBy('at'), [entity.id]) ?? []
  const [peek, setPeek] = useState<string>()
  return (
    <Modal title={`History of ${entity.name}`} onClose={onClose}>
      <p className="muted small">
        Earlier versions, newest first, kept on this device. Restoring one keeps the current version here too, so you can always go
        back. <Help topic="history" />
      </p>
      <ul className="history-list">
        {versions.map((v) => (
          <li key={v.id}>
            <div className="row spread">
              <div>
                <strong>{when(v.at)}</strong> <span className="muted small">· {REASON[v.reason]}</span>
                <div className="muted small">{changes(v.entity, entity)}</div>
              </div>
              <div className="row">
                <button className="ghost small" onClick={() => setPeek(peek === v.id ? undefined : v.id)}>
                  {peek === v.id ? 'Hide' : 'Look'}
                </button>
                <button
                  className="small"
                  onClick={async () => {
                    if (!confirm(`Put ${entity.name} back the way it was on ${when(v.at)}?`)) return
                    await saveEntity({ ...v.entity, updatedAt: Date.now() })
                    onClose()
                  }}
                >
                  Restore
                </button>
              </div>
            </div>
            {peek === v.id && (
              <pre className="history-peek">
                {v.entity.name}
                {v.entity.summary && `\n${v.entity.summary}`}
                {'\n\n'}
                {v.entity.body || '(no description)'}
                {v.entity.entries?.length ? `\n\n${v.entity.entries.join('\n')}` : ''}
                {v.entity.gmNotes && `\n\nGM notes:\n${v.entity.gmNotes}`}
              </pre>
            )}
          </li>
        ))}
      </ul>
    </Modal>
  )
}

/** World settings: pages deleted on this device, with a way to bring them back. */
export function RecentlyDeleted() {
  const { worldId, world } = useWorld()
  const deleted =
    useLiveQuery(async () => {
      const vs = await db.history.where({ worldId }).filter((v) => v.reason === 'deleted').reverse().sortBy('at')
      const still = new Set((await db.entities.bulkGet(vs.map((v) => v.entityId))).flatMap((e) => (e ? [e.id] : [])))
      const seen = new Set<string>()
      // Newest deletion of each page that hasn't come back since.
      return vs.filter((v) => !still.has(v.entityId) && !seen.has(v.entityId) && seen.add(v.entityId))
    }, [worldId]) ?? []
  return (
    <section>
      <h2>
        🗑️ Recently deleted <Help topic="recentlyDeleted" />
      </h2>
      {deleted.length === 0 ? (
        <Empty>Nothing deleted on this device.</Empty>
      ) : (
        <ul className="entity-list">
          {deleted.slice(0, 30).map((v) => (
            <li key={v.id} className="row spread">
              <span>
                {typeLabel(v.entity, world).icon} {v.entity.name} <span className="muted small">· deleted {when(v.at)}</span>
              </span>
              <button
                className="small"
                onClick={async () => {
                  await db.entities.put({ ...v.entity, updatedAt: Date.now() })
                }}
              >
                Restore
              </button>
            </li>
          ))}
        </ul>
      )}
      {deleted.length > 0 && (
        <p className="muted small">
          Restored pages come back where they were, but pins on maps need adding again.
        </p>
      )}
    </section>
  )
}
