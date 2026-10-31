import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DraftText } from './components'
import { PagePicker } from './PagePicker'
import { blankLectern, blankPrep, db, newId, type CheckItem, type Encounter, type Entity, type Session, type SessionPrep, type World } from './db'
import { addCombatants, encounterCombatants, foeCount, foeFromEntity, numberFrom } from './encounters'
import { Help } from './help'
import { cardSummary, hasCard, SceneCardEditor } from './sceneCards'
import { LecternPanel } from './lecternPanel'
import { StatusBadge } from './status'
import { Ico, TypeIcon } from './icons'
import { ArrowUp, FilmSlate, MagnifyingGlass, PencilSimple, Plus, Sword, X } from '@phosphor-icons/react'
import { removeWithUndo } from './undo'
import { pagePath, worldPath } from './paths'
import { prepCounts } from './counts'

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
 * The plan on Prepare: a strong start, the scenes you expect, secrets and clues to drop wherever
 * they fit, and fights ready to run, as cards you can read at a glance (and edit in place). All
 * GM-only. On a computer it's two columns: the opening and the scenes, then clues and fights.
 */
export function PrepSheet({ session, entities, worldId }: { session: Session; entities: Entity[]; worldId: string }) {
  const prep = { ...blankPrep(), ...session.prep }
  const edit = (fn: (p: SessionPrep) => void) => editPrep(session.id, fn)
  return (
    <div className="prep-plan">
      <div className="prep-col">
        <section className="card plan-card" id="plan">
          <div className="plan-head">
            <h2>
              Strong start <Help topic="strongStart" />
            </h2>
          </div>
          <DraftText
            multiline
            grow
            className="read-text"
            aria-label="Strong start"
            value={prep.strongStart}
            placeholder="How the session opens: drop the players straight into something happening."
            onCommit={(v) => edit((p) => void (p.strongStart = v))}
          />
        </section>
        <section className="card plan-card" id="scenes">
          <div className="plan-head">
            <h2>
              <Ico as={FilmSlate} /> Scenes <Help topic="prep" />
            </h2>
            {prep.scenes.length > 0 && <span className="muted small">{prepCounts(prep).scenes.total}</span>}
          </div>
          <PlanList
            kind="scene"
            items={prep.scenes}
            placeholder="Add a scene that might happen, e.g. ‘Ambush at the ford’"
            doneLabel="Played"
            onEdit={(fn) => edit((p) => fn(p.scenes))}
            extra={{
              label: (x) => (hasCard(x) ? 'Scene card ✓' : 'Scene card'),
              title: 'Give this scene its place, read-aloud text, people, sounds, fight, handout and reveals, to start them all at once at the Lectern',
              summary: (x) => (hasCard(x) ? cardSummary(x, entities, session) : ''),
              render: (x, change) => <SceneCardEditor scene={x} session={session} entities={entities} onChange={change} />,
            }}
          />
        </section>
      </div>
      <div className="prep-col">
        <section className="card plan-card" id="clues">
          <div className="plan-head">
            <h2>
              <Ico as={MagnifyingGlass} /> Secrets and clues <Help topic="clues" />
            </h2>
            {prep.clues.length > 0 && <span className="muted small">{prepCounts(prep).clues.total}</span>}
          </div>
          <PlanList kind="clue" items={prep.clues} placeholder="Add something the players could learn, e.g. ‘The mayor paid the bandits’" doneLabel="Found" onEdit={(fn) => edit((p) => fn(p.clues))} />
        </section>
        <section className="card plan-card" id="fights">
          <div className="plan-head">
            <h2>
              <Ico as={Sword} /> Encounters <Help topic="encounters" />
            </h2>
          </div>
          <Encounters session={session} prep={prep} entities={entities} worldId={worldId} />
        </section>
      </div>
    </div>
  )
}

/**
 * Scenes or clues: each one a line of text you can read in full and edit where it is, ticked off
 * once played or found. Removing one happens at once, with Undo.
 */
function PlanList<T extends CheckItem>({
  kind,
  items,
  placeholder,
  doneLabel,
  onEdit,
  extra,
}: {
  kind: 'scene' | 'clue'
  items: T[]
  placeholder: string
  doneLabel: string
  onEdit: (fn: (list: T[]) => void) => unknown
  /** More to each item, behind a button (scene cards). */
  extra?: { label: (x: T) => string; title: string; summary: (x: T) => string; render: (x: T, change: (fn: (x: T) => void) => void) => ReactNode }
}) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState<string>()
  const word = kind === 'scene' ? 'Scene' : 'Clue'
  const change = (id: string, fn: (x: T) => void) =>
    onEdit((list) => {
      const x = list.find((i) => i.id === id)
      if (x) fn(x)
    })
  const remove = (x: T) => {
    let at = -1
    void removeWithUndo(
      `${word} “${shorten(x.text)}” removed`,
      () =>
        onEdit((list) => {
          // A second click finds nothing to remove (and must not remove the last one instead).
          at = list.findIndex((y) => y.id === x.id)
          if (at >= 0) list.splice(at, 1)
        }),
      () => onEdit((list) => void (list.some((y) => y.id === x.id) || list.splice(Math.max(0, at), 0, x))),
    )
  }
  return (
    <div className="plan-list-wrap">
      {items.length > 0 && (
        <ol className={`plan-list ${kind}s`}>
          {items.map((x, i) => {
            const summary = extra?.summary(x)
            return (
              <li key={x.id} className={`plan-item ${x.done ? 'done' : ''}`}>
                <button
                  type="button"
                  className="plan-tick"
                  aria-pressed={x.done}
                  aria-label={`${doneLabel}: ${shorten(x.text)}`}
                  title={x.done ? `${doneLabel}. Click to untick` : `Tick when ${kind === 'scene' ? 'played' : 'found'}`}
                  onClick={() => change(x.id, (y) => void (y.done = !y.done))}
                >
                  <span>{x.done ? '✓' : kind === 'scene' ? i + 1 : ''}</span>
                </button>
                <div className="plan-body">
                  <DraftText multiline grow className="plan-text" aria-label={`${word} ${i + 1}`} value={x.text} onCommit={(v) => change(x.id, (y) => void (y.text = v))} />
                  {summary && <div className="muted small plan-summary">{summary}</div>}
                </div>
                <div className="plan-actions">
                  <button
                    type="button"
                    className="ghost"
                    title="Move up"
                    aria-label={`Move ${word.toLowerCase()} ${i + 1} up`}
                    disabled={i === 0}
                    onClick={() =>
                      onEdit((list) => {
                        const j = list.findIndex((y) => y.id === x.id)
                        if (j > 0) list.splice(j - 1, 0, ...list.splice(j, 1))
                      })
                    }
                  >
                    <Ico as={ArrowUp} />
                  </button>
                  {extra && (
                    <button type="button" className={`ghost ${open === x.id ? 'on' : ''}`} title={extra.title} aria-expanded={open === x.id} onClick={() => setOpen(open === x.id ? undefined : x.id)}>
                      <Ico as={FilmSlate} /> <span className="not-phone">{extra.label(x)}</span>
                    </button>
                  )}
                  <button type="button" className="ghost" title="Remove" aria-label={`Remove ${word.toLowerCase()} ${i + 1}`} onClick={() => remove(x)}>
                    <Ico as={X} />
                  </button>
                </div>
                {extra && open === x.id && <div className="plan-card-editor">{extra.render(x, (fn) => change(x.id, fn))}</div>}
              </li>
            )
          })}
        </ol>
      )}
      <form
        className="row plan-add"
        onSubmit={(e) => {
          e.preventDefault()
          const t = text.trim()
          if (!t) return
          onEdit((list) => void list.push({ id: newId(), text: t, done: false } as T))
          setText('')
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label={`New ${word.toLowerCase()}`} />
        <button disabled={!text.trim()}>
          <Ico as={Plus} /> Add
        </button>
      </form>
    </div>
  )
}

/** The first few words of a line, for notes like “Scene “Ambush at the…” removed”. */
const shorten = (text: string, n = 40) => (text.length > n ? `${text.slice(0, n).trimEnd()}…` : text)

/** Who's in a fight, in one line: “Dannic Rook 22 hp · 2 × Ash-drowned 11 hp · Gerda Hollin (ally)”. */
export const foeLine = (enc: Encounter) =>
  enc.foes.map((f) => `${f.count > 1 ? `${f.count} × ` : ''}${f.name}${f.hp ? ` ${f.hp} hp` : ''}${f.side !== 'foe' ? ` (${f.side === 'pc' ? 'PC' : 'ally'})` : ''}`).join(' · ')

function Encounters({ session, prep, entities, worldId }: { session: Session; prep: SessionPrep; entities: Entity[]; worldId: string }) {
  const [name, setName] = useState('')
  const [open, setOpen] = useState<string>()
  const navigate = useNavigate()
  const edit = (fn: (p: SessionPrep) => void) => editPrep(session.id, fn)
  const change = (id: string, fn: (e: Encounter) => void) =>
    edit((p) => {
      const x = p.encounters.find((e) => e.id === id)
      if (x) fn(x)
    })
  return (
    <div className="encounters">
      {prep.encounters.length === 0 && <p className="muted small">No fights planned. Add one to have it ready at the Lectern.</p>}
      {prep.encounters.map((enc) => {
        const editing = open === enc.id
        return (
          <div key={enc.id} className={`encounter ${editing ? 'open' : ''}`}>
            <div className="encounter-head">
              <DraftText className="encounter-name" value={enc.name} aria-label="Encounter name" onCommit={(v) => change(enc.id, (x) => void (x.name = v))} />
              <span className="muted small">
                {foeCount(enc)} in the fight
              </span>
            </div>
            {enc.foes.length > 0 && <div className="small encounter-foes">{foeLine(enc)}</div>}
            {!editing && enc.notes && <p className="muted small encounter-notes">{enc.notes}</p>}
            <div className="row wrap encounter-actions">
              <button type="button" className={editing ? 'on' : ''} aria-expanded={editing} onClick={() => setOpen(editing ? undefined : enc.id)}>
                <Ico as={PencilSimple} /> {editing ? 'Done' : 'Edit'}
              </button>
              <button
                type="button"
                disabled={!enc.foes.length}
                title="Add everyone in this fight to the Lectern’s initiative list and open the Lectern"
                onClick={async () => {
                  await runEncounter(session.id, enc)
                  navigate(`${worldPath(worldId)}/s/${session.id}/lectern?at=fight`)
                }}
              >
                <Ico as={Sword} /> Fight it at the Lectern
              </button>
              <button
                type="button"
                className="ghost"
                title="Remove this encounter"
                aria-label={`Remove encounter ${enc.name}`}
                onClick={() => {
                  let at = -1
                  void removeWithUndo(
                    `Encounter “${shorten(enc.name)}” removed`,
                    () =>
                      edit((p) => {
                        at = p.encounters.findIndex((x) => x.id === enc.id)
                        if (at >= 0) p.encounters.splice(at, 1)
                      }),
                    () => edit((p) => void (p.encounters.some((x) => x.id === enc.id) || p.encounters.splice(Math.max(0, at), 0, enc))),
                  )
                }}
              >
                <Ico as={X} />
              </button>
            </div>
            {editing && (
              <>
                <FoeTable enc={enc} entities={entities} worldId={worldId} onChange={(fn) => change(enc.id, fn)} />
                <DraftText
                  multiline
                  grow
                  aria-label="Tactics and notes"
                  value={enc.notes}
                  placeholder="Tactics, terrain, what they want, when they flee…"
                  onCommit={(v) => change(enc.id, (x) => void (x.notes = v))}
                />
              </>
            )}
          </div>
        )
      })}
      <form
        className="row plan-add"
        onSubmit={(e) => {
          e.preventDefault()
          const n = name.trim()
          if (!n) return
          const id = newId()
          edit((p) => void p.encounters.push({ id, name: n, notes: '', foes: [] }))
          setOpen(id)
          setName('')
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New encounter, e.g. ‘Bandits at the ford’" aria-label="New encounter" />
        <button disabled={!name.trim()}>
          <Ico as={Plus} /> Add
        </button>
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
                    <button
                      className="ghost"
                      title="Remove"
                      aria-label={`Remove ${f.name}`}
                      onClick={() => {
                        let at = -1
                        void removeWithUndo(
                          `“${f.name}” taken out of the fight`,
                          () =>
                            onChange((e) => {
                              at = e.foes.findIndex((x) => x.id === f.id)
                              if (at >= 0) e.foes.splice(at, 1)
                            }),
                          () => onChange((e) => void (e.foes.some((x) => x.id === f.id) || e.foes.splice(Math.max(0, at), 0, f))),
                        )
                      }}
                    >
                      <Ico as={X} />
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

/**
 * The plan at the Lectern, besides the scenes (which are in the Scene panel, with Next scene): the
 * secrets and clues to tick off as the players find them, and the planned fights to start.
 */
export function LecternPrep({ session, world }: { session: Session; world: World; entities: Entity[] }) {
  const worldId = world.id
  const prep = { ...blankPrep(), ...session.prep }
  // Fights already added to the initiative list from here, so a second tap asks first instead of doubling them.
  const [loaded, setLoaded] = useState<string[]>([])
  const edit = (fn: (p: SessionPrep) => void) => editPrep(session.id, fn)
  const empty = !prep.clues.length && !prep.encounters.length
  const counts = prepCounts(prep)
  return (
    <LecternPanel
      id="prep"
      sectionId="lectern-prep"
      name="Clues and fights"
      keywords="prep scenes clues secrets encounters plan fights"
      title={<><Ico as={MagnifyingGlass} /> Clues and fights <Help topic="clues" /></>}
      extra={
        <Link className="small" to={`${worldPath(worldId)}/s/${session.id}?tab=prep`}>
          Edit the plan
        </Link>
      }
    >
      {empty && <p className="muted small">No clues or fights planned. Add them on Prepare.</p>}
      {prep.clues.length > 0 && (
        <details open>
          <summary className="small">
            Secrets and clues ({counts.clues.done}/{counts.clues.total} found)
          </summary>
          <div className="check-list lectern-clues">
            {prep.clues.map((x) => (
              <label key={x.id} className={`check-item ${x.done ? 'done' : ''}`}>
                <input
                  type="checkbox"
                  checked={x.done}
                  onChange={(e) => {
                    const v = e.target.checked
                    edit((p) => {
                      const y = p.clues.find((i) => i.id === x.id)
                      if (y) y.done = v
                    })
                  }}
                />{' '}
                {x.text}
              </label>
            ))}
          </div>
        </details>
      )}
      {prep.encounters.length > 0 && (
        <div className="small">
          <div className="muted"><Ico as={Sword} /> Planned fights</div>
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
          {loaded.length > 0 && <div className="muted">Added to the fight. Tap again to add another set.</div>}
        </div>
      )}
    </LecternPanel>
  )
}
