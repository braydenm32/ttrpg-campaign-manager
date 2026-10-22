import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Entity } from './db'
import { roll, rollDie } from './dice'
import { Help } from './help'
import { Markdown } from './Markdown'

/**
 * Random tables the GM writes: one entry per line, rolled on with one click.
 *  - "3x Goblins" makes an entry three times as likely (so does writing it three times).
 *  - "{2d6}" inside an entry rolls dice: "{2d6} goblins" gives "7 goblins".
 *  - "{Weather}" rolls on the table called Weather, so tables can build on each other.
 *  - Blank lines and lines starting with # are ignored.
 */

interface Entry {
  text: string
  weight: number
}

export function tableEntries(t: Entity): Entry[] {
  return (t.entries ?? [])
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const m = line.match(/^(\d+)\s*[x×]\s+(.+)$/i)
      return m ? { text: m[2], weight: Math.max(1, Math.min(1000, Number(m[1]))) } : { text: line, weight: 1 }
    })
}

/** Rolls on a table. Other tables are looked up by name for "{Table name}". */
export function rollOnTable(t: Entity, tables: Entity[], depth = 0): string {
  const entries = tableEntries(t)
  if (!entries.length) return '*(this table has no entries yet)*'
  const total = entries.reduce((s, e) => s + e.weight, 0)
  let pick = rollDie(total) - 1
  const entry = entries.find((e) => (pick -= e.weight) < 0) ?? entries[0]
  return entry.text.replace(/\{([^{}]+)\}/g, (whole, inner: string) => {
    const name = inner.trim().toLowerCase()
    const sub = tables.find((x) => x.name.trim().toLowerCase() === name)
    if (sub) return depth < 6 ? rollOnTable(sub, tables, depth + 1) : whole
    try {
      return String(roll(inner).total)
    } catch {
      return whole
    }
  })
}

/** Pick a table (or use the one given) and roll on it. Used on table pages, the Generators page and the Lectern. */
export function TableRoller({ tables, worldId, entities, fixed, showSecrets }: { tables: Entity[]; worldId: string; entities: Entity[]; fixed?: Entity; showSecrets: boolean }) {
  const [chosen, setChosen] = useState('')
  const [results, setResults] = useState<{ table: string; text: string }[]>([])
  const table = fixed ?? tables.find((t) => t.id === chosen) ?? tables[0]
  if (!table) return null
  const go = () => setResults((r) => [{ table: table.name, text: rollOnTable(table, tables) }, ...r].slice(0, 5))
  return (
    <div className="table-roller">
      <div className="row wrap">
        {!fixed && (
          <select value={table.id} onChange={(e) => setChosen(e.target.value)}>
            {tables.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
        <button className="primary" onClick={go}>
          🎲 Roll{fixed ? ` on ${table.name}` : ''}
        </button>
        {!fixed && (
          <Link className="small" to={`/w/${worldId}/e/${table.id}`}>
            Open table
          </Link>
        )}
      </div>
      {results.map((r, i) => (
        <div key={results.length - i} className={`table-result ${i ? 'old' : ''}`}>
          {!fixed && <span className="muted small">{r.table}: </span>}
          <Markdown text={r.text} entities={entities} worldId={worldId} showSecrets={showSecrets} />
        </div>
      ))}
    </div>
  )
}

/** The Lectern and Generators panel: roll on any of your tables. */
export function TablesPanel({ tables, worldId, entities }: { tables: Entity[]; worldId: string; entities: Entity[] }) {
  return (
    <section className="card lectern-panel">
      <h2>
        🎲 Random tables <Help topic="randomTables" />
      </h2>
      {tables.length ? (
        <TableRoller tables={tables} worldId={worldId} entities={entities} showSecrets />
      ) : (
        <p className="muted small">
          No tables yet. <Link to={`/w/${worldId}/type/table`}>Make one</Link>, like “What’s in the sewer?” or “Tavern rumours”.
        </p>
      )}
    </section>
  )
}
