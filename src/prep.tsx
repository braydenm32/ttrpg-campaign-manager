import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DraftText } from './components'
import { PagePicker } from './PagePicker'
import { blankLectern, blankPrep, db, newId, type CheckItem, type Encounter, type Entity, type Session, type SessionPrep } from './db'
import { addCombatants, encounterCombatants, foeCount, foeFromEntity, numberFrom } from './encounters'
import { Help } from './help'
import { LecternPanel } from './lecternPanel'
import { StatusBadge } from './status'
import { Ico, TypeIcon } from './icons'
import { ClipboardText, FilmSlate, MagnifyingGlass, Sword } from '@phosphor-icons/react'
import { pagePath, worldPath } from './paths'

/** Changes a session's prep sheet atomically, starting from what's saved. */
export const editPrep = (sessionId: string, fn: (p: SessionPrep) => void) =>
  db.sessions
    .where('id')
    .equals(sessionId)
    .modify((s) => {
      s.prep = { ...blankPrep(), ...s.prep }
      fn(s.prep)
    })

/** Loads a planned encounter into the session's initiative tracker (adding to any fight already there). */
export const runEncounter = (sessionId: string, enc: Encounter) =>
  db.sessions
    .where('id')
    .equals(sessionId)
    .modify((s) => {
      s.lectern = { ...blankLectern(), ...s.lectern }
      addCombatants(s.lectern, encounterCombatants(enc))
    })

/**
 * The prep sheet on a session page: a strong start, the scenes you expect, secrets and clues to drop
 * wherever they fit, and fights ready to run. All GM-only.
 */
export function PrepSheet({ session, entities, worldId }: { session: Session; entities: Entity[]; worldId: string }) {
  const prep = { ...blankPrep(), ...session.prep }
  const edit = (fn: (p: SessionPrep) => void) => editPrep(session.id, fn)
  return (
    <div className="prep">
      <p className="muted small">
        Plan the session here, then run it from the Lectern, where you can tick off scenes and clues as they happen. <Help topic="prep" />
      </p>
      <label>
        <span>
          Strong start <Help topic="strongStart" />
        </span>
        <DraftText
          multiline
          rows={3}
          value={prep.strongStart}
          placeholder="How the session opens: drop the players straight into something happening."
          onCommit={(v) => edit((p) => void (p.strongStart = v))}
        />
      </label>
      <h3><Ico as={FilmSlate} /> Scenes you expect</h3>
      <CheckList items={prep.scenes} placeholder="A scene that might happen, e.g. ‘Ambush at the ford’" doneLabel="Played" onEdit={(fn) => edit((p) => fn(p.scenes))} />
      <h3>
        <Ico as={MagnifyingGlass} /> Secrets and clues <Help topic="clues" />
      </h3>
      <CheckList items={prep.clues} placeholder="Something the players could learn, e.g. ‘The mayor paid the bandits’" doneLabel="Found" onEdit={(fn) => edit((p) => fn(p.clues))} />
      <h3>
        <Ico as={Sword} /> Encounters <Help topic="encounters" />
      </h3>
      <Encounters session={session} prep={prep} entities={entities} worldId={worldId} />
    </div>
  )
}

function CheckList({
  items,
  placeholder,
  doneLabel,
  onEdit,
}: {
  items: CheckItem[]
  placeholder: string
  doneLabel: string
  onEdit: (fn: (list: CheckItem[]) => void) => void
}) {
  const [text, setText] = useState('')
  const change = (id: string, fn: (x: CheckItem) => void) =>
    onEdit((list) => {
      const x = list.find((i) => i.id === id)
      if (x) fn(x)
    })
  return (
    <div className="check-list">
      {items.map((x, i) => (
        <div key={x.id} className={`row check-item ${x.done ? 'done' : ''}`}>
          <input type="checkbox" checked={x.done} title={doneLabel} onChange={(e) => {
              // Read it now: the box springs back to the saved value before the change is saved.
              const v = e.target.checked
              change(x.id, (y) => void (y.done = v))
            }} />
          <DraftText value={x.text} onCommit={(v) => change(x.id, (y) => void (y.text = v))} />
          <button
            className="ghost"
            title="Move up"
            disabled={i === 0}
            onClick={() =>
              onEdit((list) => {
                const j = list.findIndex((y) => y.id === x.id)
                if (j > 0) list.splice(j - 1, 0, ...list.splice(j, 1))
              })
            }
          >
            ↑
          </button>
          <button className="ghost" title="Remove" onClick={() =>
              onEdit((list) => {
                // A second click finds nothing to remove (and must not remove the last one instead).
                const j = list.findIndex((y) => y.id === x.id)
                if (j >= 0) list.splice(j, 1)
              })
            }>
            ✕
          </button>
        </div>
      ))}
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault()
          const t = text.trim()
          if (!t) return
          onEdit((list) => void list.push({ id: newId(), text: t, done: false }))
          setText('')
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} />
        <button disabled={!text.trim()}>Add</button>
      </form>
    </div>
  )
}

function Encounters({ session, prep, entities, worldId }: { session: Session; prep: SessionPrep; entities: Entity[]; worldId: string }) {
  const [name, setName] = useState('')
  const navigate = useNavigate()
  const edit = (fn: (p: SessionPrep) => void) => editPrep(session.id, fn)
  const change = (id: string, fn: (e: Encounter) => void) =>
    edit((p) => {
      const x = p.encounters.find((e) => e.id === id)
      if (x) fn(x)
    })
  return (
    <div className="encounters">
      {prep.encounters.map((enc) => (
        <div key={enc.id} className="card encounter">
          <div className="row">
            <DraftText className="encounter-name" value={enc.name} title="Name" onCommit={(v) => change(enc.id, (x) => void (x.name = v))} />
            <span className="muted small">
              {foeCount(enc)} combatant{foeCount(enc) === 1 ? '' : 's'}
            </span>
            <button
              className="primary"
              disabled={!enc.foes.length}
              title="Add everyone in this fight to the Lectern’s initiative tracker"
              onClick={async () => {
                await runEncounter(session.id, enc)
                navigate(`${worldPath(worldId)}/s/${session.id}/lectern`)
              }}
            >
              <Ico as={Sword} /> Run at the Lectern
            </button>
            <button className="ghost" title="Delete encounter" onClick={() => confirm(`Delete “${enc.name}”?`) && edit((p) => void (p.encounters = p.encounters.filter((x) => x.id !== enc.id)))}>
              ✕
            </button>
          </div>
          <FoeTable enc={enc} entities={entities} worldId={worldId} onChange={(fn) => change(enc.id, fn)} />
          <DraftText
            multiline
            rows={2}
            value={enc.notes}
            placeholder="Tactics, terrain, what they want, when they flee…"
            onCommit={(v) => change(enc.id, (x) => void (x.notes = v))}
          />
        </div>
      ))}
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault()
          const n = name.trim()
          if (!n) return
          edit((p) => void p.encounters.push({ id: newId(), name: n, notes: '', foes: [] }))
          setName('')
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New encounter, e.g. ‘Bandits at the ford’" />
        <button disabled={!name.trim()}>Add encounter</button>
      </form>
    </div>
  )
}

function FoeTable({ enc, entities, worldId, onChange }: { enc: Encounter; entities: Entity[]; worldId: string; onChange: (fn: (e: Encounter) => void) => void }) {
  const [name, setName] = useState('')
  const [count, setCount] = useState(1)
  const [hp, setHp] = useState('')
  const [ac, setAc] = useState('')
  const foe = (id: string, fn: (f: Encounter['foes'][number]) => void) =>
    onChange((e) => {
      const f = e.foes.find((x) => x.id === id)
      if (f) fn(f)
    })
  const byId = new Map(entities.map((e) => [e.id, e]))
  return (
    <div className="foes">
      {enc.foes.length > 0 && (
        <table className="foe-table">
          <thead>
            <tr>
              <th>Who</th>
              <th title="How many">#</th>
              <th>HP</th>
              <th title="Armour class / defence">AC</th>
              <th>Side</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {enc.foes.map((f) => {
              const page = f.entityId ? byId.get(f.entityId) : undefined
              return (
                <tr key={f.id}>
                  <td>
                    {page ? (
                      <Link to={`${pagePath(worldId, page.id)}`}>
                        <TypeIcon type={page.type} /> {f.name}
                      </Link>
                    ) : (
                      <DraftText value={f.name} onCommit={(v) => foe(f.id, (x) => void (x.name = v))} />
                    )}
                    {page && <StatusBadge entity={page} />}
                  </td>
                  <td>
                    <DraftText className="num-cell" inputMode="numeric" value={String(f.count)} onCommit={(v) => foe(f.id, (x) => void (x.count = Math.max(1, Math.min(30, numberFrom(v) ?? 1))))} />
                  </td>
                  <td>
                    <DraftText className="num-cell" inputMode="numeric" value={f.hp?.toString() ?? ''} onCommit={(v) => foe(f.id, (x) => void (x.hp = numberFrom(v)))} />
                  </td>
                  <td>
                    <DraftText className="num-cell" value={f.ac ?? ''} onCommit={(v) => foe(f.id, (x) => void (x.ac = v || undefined))} />
                  </td>
                  <td>
                    <select value={f.side} onChange={(e) => {
                        const v = e.target.value as typeof f.side
                        foe(f.id, (x) => void (x.side = v))
                      }}>
                      <option value="foe">Foe</option>
                      <option value="ally">Ally</option>
                      <option value="pc">PC</option>
                    </select>
                  </td>
                  <td>
                    <button className="ghost" title="Remove" onClick={() => onChange((e) => void (e.foes = e.foes.filter((x) => x.id !== f.id)))}>
                      ✕
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <form
        className="add-combatant"
        onSubmit={(e) => {
          e.preventDefault()
          const n = name.trim()
          if (!n) return
          onChange((x) => void x.foes.push({ id: newId(), name: n, count: Math.max(1, Math.min(30, count)), hp: numberFrom(hp), ac: ac.trim() || undefined, side: 'foe' }))
          setName('')
          setHp('')
          setAc('')
          setCount(1)
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Foe, e.g. Bandit" />
        <input type="number" min={1} max={30} value={count} onChange={(e) => setCount(Number(e.target.value) || 1)} title="How many" />
        <input value={hp} onChange={(e) => setHp(e.target.value)} placeholder="HP" />
        <input value={ac} onChange={(e) => setAc(e.target.value)} placeholder="AC" />
        <button disabled={!name.trim()}>Add</button>
      </form>
      <PagePicker
        entities={entities.filter((e) => ['npc', 'pc', 'faction', 'deity', 'custom'].includes(e.type))}
        placeholder="+ Add from a page (reads HP and AC from its details)…"
        onPick={(id) => {
          const page = byId.get(id)
          if (page) onChange((x) => void x.foes.push(foeFromEntity(page)))
        }}
      />
    </div>
  )
}

/** The prep sheet at the Lectern: the opening, scenes and clues to tick off, and fights to start. */
export function LecternPrep({ session, worldId }: { session: Session; worldId: string }) {
  const prep = { ...blankPrep(), ...session.prep }
  // Fights already added to the initiative list from here, so a second tap asks first instead of doubling them.
  const [loaded, setLoaded] = useState<string[]>([])
  const edit = (fn: (p: SessionPrep) => void) => editPrep(session.id, fn)
  const empty = !prep.strongStart && !prep.scenes.length && !prep.clues.length && !prep.encounters.length
  const tick = (list: 'scenes' | 'clues', x: CheckItem) => (
    <label key={x.id} className={`check-item ${x.done ? 'done' : ''}`}>
      <input
        type="checkbox"
        checked={x.done}
        onChange={(e) => {
          const v = e.target.checked
          edit((p) => {
            const y = p[list].find((i) => i.id === x.id)
            if (y) y.done = v
          })
        }}
      />{' '}
      {x.text}
    </label>
  )
  const found = prep.clues.filter((c) => c.done).length
  return (
    <LecternPanel
      id="prep"
      name="Prep"
      keywords="scenes clues secrets encounters strong start plan"
      title={<><Ico as={ClipboardText} /> Prep <Help topic="prep" /></>}
      extra={
        <Link className="small" to={`${worldPath(worldId)}/s/${session.id}?tab=prep`}>
          Edit prep
        </Link>
      }
    >
      {empty && <p className="muted small">No prep for this session yet. Plan scenes, clues and fights from the session page.</p>}
      {prep.strongStart && (
        <div className="small">
          <b>Strong start:</b> {prep.strongStart}
        </div>
      )}
      {prep.scenes.length > 0 && (
        <details open>
          <summary className="small"><Ico as={FilmSlate} /> Scenes ({prep.scenes.filter((s) => s.done).length}/{prep.scenes.length} played)</summary>
          <div className="check-list">{prep.scenes.map((x) => tick('scenes', x))}</div>
        </details>
      )}
      {prep.clues.length > 0 && (
        <details open>
          <summary className="small">
            <Ico as={MagnifyingGlass} /> Secrets and clues ({found}/{prep.clues.length} found)
          </summary>
          <div className="check-list">{prep.clues.map((x) => tick('clues', x))}</div>
        </details>
      )}
      {prep.encounters.length > 0 && (
        <div className="small">
          <div className="muted"><Ico as={Sword} /> Encounters</div>
          <div className="row wrap">
            {prep.encounters.map((enc) => (
              <button
                key={enc.id}
                disabled={!enc.foes.length}
                title={enc.notes || 'Add to initiative'}
                onClick={() => {
                  if (loaded.includes(enc.id) && !confirm(`“${enc.name}” is already in the initiative list. Add it again?`)) return
                  runEncounter(session.id, enc)
                  setLoaded([...loaded, enc.id])
                }}
              >
                <Ico as={Sword} /> {enc.name} ({foeCount(enc)}){loaded.includes(enc.id) && ' ✓ added'}
              </button>
            ))}
          </div>
          {loaded.length > 0 && <div className="muted">Added to the Initiative list. Tap again to add another set.</div>}
        </div>
      )}
    </LecternPanel>
  )
}
