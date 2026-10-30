import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { db, type Entity, type World } from './db'
import { Help } from './help'
import { pagePath } from './paths'
import { StatusBadge } from './status'

/**
 * The party at a glance: one row per character, with the details the GM picked as columns (AC,
 * passive Perception, languages, darkvision…). The columns are the world's, so they follow the GM
 * from the campaign page to the Lectern. Details are matched by name, ignoring case.
 */

const norm = (k: string) => k.trim().toLowerCase()

/** A character's value for a detail, by name. */
export function detailOf(e: Entity, key: string) {
  return e.fields.find((f) => norm(f.key) === norm(key))?.value ?? ''
}

/** Every detail name the party has, most common first. */
function partyKeys(party: Entity[]) {
  const count = new Map<string, { key: string; n: number }>()
  for (const e of party)
    for (const f of e.fields) {
      const k = norm(f.key)
      if (!k) continue
      const c = count.get(k) ?? { key: f.key.trim(), n: 0 }
      c.n++
      count.set(k, c)
    }
  return [...count.values()].sort((a, b) => b.n - a.n || a.key.localeCompare(b.key)).map((c) => c.key)
}

/** The columns to show: the GM's choice, or (until they choose) up to four details most of the party has. */
export function glanceColumns(world: World, party: Entity[]) {
  if (world.partyFields) return world.partyFields
  const keys = partyKeys(party)
  return keys.filter((k) => party.filter((e) => detailOf(e, k)).length >= Math.max(1, Math.ceil(party.length / 2))).slice(0, 4)
}

export function PartyGlance({ world, party, extra }: { world: World; party: Entity[]; extra?: (e: Entity) => ReactNode }) {
  const [choosing, setChoosing] = useState(false)
  const columns = glanceColumns(world, party)
  const keys = partyKeys(party)
  const setColumns = (next: string[]) => db.worlds.update(world.id, { partyFields: next, updatedAt: Date.now() })
  return (
    <div className="party-glance">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Character</th>
              {columns.map((k) => (
                <th key={k}>{k}</th>
              ))}
              {extra && <th aria-label="More" />}
            </tr>
          </thead>
          <tbody>
            {party.map((e) => (
              <tr key={e.id}>
                <td>
                  <Link to={pagePath(world.id, e.id)}>{e.name}</Link> <StatusBadge entity={e} />
                </td>
                {columns.map((k) => (
                  <td key={k}>{detailOf(e, k) || <span className="muted">–</span>}</td>
                ))}
                {extra && <td className="party-glance-extra">{extra(e)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row wrap small">
        <button className="link" onClick={() => setChoosing(!choosing)} aria-expanded={choosing}>
          {choosing ? 'Done' : 'Choose columns'}
        </button>
        <Help topic="partyGlance" />
      </div>
      {choosing && (
        <div className="party-glance-choose small">
          {keys.length === 0 && <p className="muted">The characters have no details yet. Add some (AC, Passive Perception, Languages…) on their pages.</p>}
          {keys.map((k) => {
            const on = columns.some((c) => norm(c) === norm(k))
            return (
              <label key={k} className="row">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => setColumns(on ? columns.filter((c) => norm(c) !== norm(k)) : [...columns, k])}
                />
                {k}
              </label>
            )
          })}
          <AddColumn onAdd={(k) => !columns.some((c) => norm(c) === norm(k)) && setColumns([...columns, k])} />
        </div>
      )}
    </div>
  )
}

/** A column for a detail no character has yet, so the GM can see who's missing it. */
function AddColumn({ onAdd }: { onAdd: (k: string) => void }) {
  const [k, setK] = useState('')
  return (
    <form
      className="row"
      onSubmit={(e) => {
        e.preventDefault()
        if (!k.trim()) return
        onAdd(k.trim())
        setK('')
      }}
    >
      <input value={k} onChange={(e) => setK(e.target.value)} placeholder="Another detail, e.g. Darkvision" aria-label="Add a column" />
      <button disabled={!k.trim()}>Add</button>
    </form>
  )
}
