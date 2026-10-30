import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Books, DiceFive, PushPin, X } from '@phosphor-icons/react'
import { db, newId, type Entity, type GmScreen, type World } from './db'
import { AskWorld } from './ai/Archivist'
import { RollDetail } from './atTheTable'
import { Help } from './help'
import { Ico, TypeIcon } from './icons'
import { LecternPanel } from './lecternPanel'
import { Markdown } from './Markdown'
import { PagePicker } from './PagePicker'
import { pagePath } from './paths'
import { TableRoller } from './tables'

/**
 * The GM screen: a drawer at the Lectern with what the GM wants in reach every session. Pages
 * pinned for reference (house rules, a monster, a table), saved dice rolls as buttons, and a
 * question for the Archivist without leaving the table. It belongs to the world and is GM-only
 * (never sent to players).
 */

const blank = (): GmScreen => ({ pages: [], rolls: [] })

function editScreen(worldId: string, fn: (g: GmScreen) => void) {
  return db.worlds
    .where('id')
    .equals(worldId)
    .modify((w) => {
      const g = { ...blank(), ...w.gmScreen }
      fn(g)
      w.gmScreen = g
      w.updatedAt = Date.now()
    })
}

type Tab = 'pinned' | 'rolls' | 'ask'

/** Rolls on the Lectern; gives back the result, or what was wrong with the dice. */
export type OnRoll = (expr: string, name: string) => { total: number; detail: string; crit?: 'high' | 'low' } | { error: string }

export function GmScreenPanel({ world, entities, onRoll }: { world: World; entities: Entity[]; onRoll: OnRoll }) {
  const screen = { ...blank(), ...world.gmScreen }
  const [tab, setTab] = useState<Tab>('pinned')
  const sessions = useLiveQuery(() => db.sessions.where({ worldId: world.id }).toArray(), [world.id]) ?? []
  return (
    <LecternPanel id="gmscreen" name="GM screen" keywords="pinned reference rules saved rolls macros archivist ask question" title={<><Ico as={PushPin} /> GM screen <Help topic="gmScreen" /></>}>
      <div className="segmented small">
        <button className={tab === 'pinned' ? 'on' : ''} onClick={() => setTab('pinned')}>
          <Ico as={PushPin} /> Pinned
        </button>
        <button className={tab === 'rolls' ? 'on' : ''} onClick={() => setTab('rolls')}>
          <Ico as={DiceFive} /> Saved rolls
        </button>
        <button className={tab === 'ask' ? 'on' : ''} onClick={() => setTab('ask')}>
          <Ico as={Books} /> Ask
        </button>
      </div>
      {tab === 'pinned' && <Pinned world={world} entities={entities} ids={screen.pages} />}
      {tab === 'rolls' && <SavedRolls world={world} rolls={screen.rolls} onRoll={onRoll} />}
      {tab === 'ask' && <AskWorld world={world} entities={entities} sessions={sessions} />}
    </LecternPanel>
  )
}

function Pinned({ world, entities, ids }: { world: World; entities: Entity[]; ids: string[] }) {
  const pages = ids.map((id) => entities.find((e) => e.id === id)).filter((e): e is Entity => !!e)
  return (
    <div className="gm-screen-pinned">
      {pages.length === 0 && <p className="muted small">Pin pages you look up every session: house rules, a monster, the villain, a random table.</p>}
      {pages.map((e) => (
        <details key={e.id} className="gm-screen-page">
          <summary>
            <TypeIcon type={e.type} /> {e.name}
            <button
              className="ghost small"
              title="Unpin"
              aria-label={`Unpin ${e.name}`}
              onClick={(ev) => {
                ev.preventDefault()
                void editScreen(world.id, (g) => void (g.pages = g.pages.filter((x) => x !== e.id)))
              }}
            >
              <Ico as={X} />
            </button>
          </summary>
          {e.summary && <p className="muted small">{e.summary}</p>}
          {e.type === 'table' ? (
            <TableRoller tables={entities.filter((t) => t.type === 'table')} fixed={e} worldId={world.id} entities={entities} showSecrets />
          ) : (
            <>
              {e.fields.length > 0 && (
                <div className="small">
                  {e.fields.map((f, i) => (
                    <span key={i} className="field-chip">
                      <b>{f.key}</b> {f.value}
                    </span>
                  ))}
                </div>
              )}
              <Markdown text={e.body} entities={entities} worldId={world.id} showSecrets />
              {e.gmNotes && (
                <div className="secret small">
                  <Markdown text={e.gmNotes} entities={entities} worldId={world.id} showSecrets />
                </div>
              )}
            </>
          )}
          <Link className="small" to={pagePath(world.id, e.id)}>
            Open page
          </Link>
        </details>
      ))}
      <PagePicker
        entities={entities.filter((e) => !e.template && !ids.includes(e.id))}
        placeholder="+ Pin a page… (type a name)"
        onPick={(id) => id && void editScreen(world.id, (g) => void (g.pages = [...g.pages.filter((x) => x !== id), id]))}
      />
    </div>
  )
}

function SavedRolls({ world, rolls, onRoll }: { world: World; rolls: GmScreen['rolls']; onRoll: OnRoll }) {
  const [name, setName] = useState('')
  const [expr, setExpr] = useState('')
  const [last, setLast] = useState<{ name: string; total?: number; detail?: string; crit?: string; error?: string }>()
  const [editing, setEditing] = useState(false)
  return (
    <div className="gm-screen-rolls">
      {rolls.length === 0 && <p className="muted small">Save rolls you make again and again, like “Goblin attack d20+4” or “Fireball 8d6”. Each becomes a button.</p>}
      <div className="row wrap">
        {rolls.map((r) => (
          <span key={r.id} className="saved-roll">
            <button
              title={r.expr}
              onClick={() => setLast({ name: r.name, ...onRoll(r.expr, r.name) })}
            >
              <Ico as={DiceFive} /> {r.name} <span className="muted small">{r.expr}</span>
            </button>
            {editing && (
              <button
                className="ghost small"
                aria-label={`Remove ${r.name}`}
                onClick={() => void editScreen(world.id, (g) => void (g.rolls = g.rolls.filter((x) => x.id !== r.id)))}
              >
                <Ico as={X} />
              </button>
            )}
          </span>
        ))}
      </div>
      {last?.error && <p className="error small">{last.error}</p>}
      {last && last.total !== undefined && (
        <div className={`roll-result ${last.crit ?? ''}`}>
          <span className="roll-total">{last.total}</span>
          <span className="muted small">
            {last.name}: <RollDetail text={last.detail ?? ""} />
          </span>
        </div>
      )}
      <form
        className="row wrap"
        onSubmit={(e) => {
          e.preventDefault()
          if (!expr.trim()) return
          const n = name.trim() || expr.trim()
          void editScreen(world.id, (g) => void g.rolls.push({ id: newId(), name: n, expr: expr.trim() }))
          setName('')
          setExpr('')
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. Goblin attack" aria-label="Roll name" />
        <input className="hp-input wide-dice" value={expr} onChange={(e) => setExpr(e.target.value)} placeholder="d20+4" aria-label="Dice" />
        <button disabled={!expr.trim()}>Save</button>
        {rolls.length > 0 && (
          <button type="button" className="ghost small" onClick={() => setEditing(!editing)}>
            {editing ? 'Done' : 'Remove some'}
          </button>
        )}
      </form>
    </div>
  )
}
