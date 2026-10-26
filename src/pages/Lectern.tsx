import { useLiveQuery } from 'dexie-react-hooks'
import { Help } from '../help'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { partyOf } from '../sessions'
import { DraftText, Empty } from '../components'
import { ENTITY_LABELS, blankLectern, db, newId, type Combatant, type Entity, type LecternState } from '../db'
import { modifierFrom, roll, rollDie } from '../dice'
import { addCombatants, fieldOf, fromEntity, numberFrom } from '../encounters'
import {
  generateNpc,
  generateShop,
  generateTavern,
  npcGreeting,
  npcToEntity,
  placeToEntities,
  SHOP_KIND_NAMES,
  type GeneratedNpc,
  type GeneratedPlace,
} from '../generators'
import { useVisibleEntities, useWorld } from '../hooks'
import { Markdown } from '../Markdown'
import { plainLinks } from '../text'
import { TablesPanel } from '../tables'
import { ThreadCard } from '../ThreadCard'
import { newThread, threadLinks, useWorldSessions } from '../threads'
import { useViewMode } from '../viewMode'
import { LecternPrep } from '../prep'
import { Soundboard } from '../sound/Soundboard'
import { StatusBadge } from '../status'
import { ShowPanel } from '../showing'
import { WorldToday } from '../calendar'
import { ClocksPanel } from '../clocks'
import { Ico, TypeIcon } from '../icons'
import { BookOpen, CastleTurret, CloudFog, DiceFive, FlagCheckered, MapTrifold, Prohibit, Shield, Spiral, Sword, User } from '@phosphor-icons/react'

/**
 * The Lectern: one screen for running a session at the table.
 * Scene and who's present on the left, initiative in the middle, dice, generators and quick notes on the right.
 * Everything here is GM-only and saved on the session as you go.
 */
export default function Lectern() {
  const { worldId, world } = useWorld()
  const { sessionId = '' } = useParams()
  const { isGM } = useViewMode()
  const session = useLiveQuery(() => db.sessions.get(sessionId), [sessionId])
  const entities = useVisibleEntities(worldId)

  if (session === undefined) return null
  if (!isGM) return <Empty>The Lectern is a GM tool. Switch back to the GM view to use it.</Empty>
  if (session === null || session.worldId !== worldId) return <Empty>Session not found.</Empty>

  const lectern: LecternState = { ...blankLectern(), ...session.lectern }
  /**
   * Changes the Lectern atomically, starting from what's saved, so quick clicks never overwrite each
   * other. Anyone who turns up in a scene is also listed as featured in the session.
   */
  const edit = (fn: (l: LecternState) => void) =>
    db.sessions
      .where('id')
      .equals(session.id)
      .modify((s) => {
        s.lectern = { ...blankLectern(), ...s.lectern }
        fn(s.lectern)
        const fresh = s.lectern.presentIds.filter((id) => !s.entityIds.includes(id))
        if (fresh.length) s.entityIds = [...s.entityIds, ...fresh]
      })

  return (
    <div className="page wide lectern-page">
      <header className="page-header">
        <div>
          <div className="row spread">
            <Link to={`/w/${worldId}/s/${session.id}`}>← Session notes</Link>
            <Link className="button" to={`/w/${worldId}/s/${session.id}?end=1`} title="Recap, show players, start the next session">
              <Ico as={FlagCheckered} /> End session
            </Link>
          </div>
          <h1>
            <Ico as={BookOpen} /> The Lectern <Help topic="lectern" /> <span className="muted">· #{session.number} {session.title}</span>
          </h1>
          {world && <WorldToday world={world} isGM />}
          {!!(world?.safety?.lines.length || world?.safety?.veils.length) && (
            <details className="small safety-reminder">
              <summary><Ico as={Shield} /> Lines and veils</summary>
              {world!.safety!.lines.length > 0 && <div><Ico as={Prohibit} /> Lines: {world!.safety!.lines.join(' · ')}</div>}
              {world!.safety!.veils.length > 0 && <div><Ico as={CloudFog} /> Veils: {world!.safety!.veils.join(' · ')}</div>}
            </details>
          )}
        </div>
      </header>
      <div className="lectern">
        <div className="lectern-col">
          <Scene lectern={lectern} edit={edit} entities={entities} worldId={worldId} />
          <Present lectern={lectern} edit={edit} entities={entities} worldId={worldId} />
          <LecternThreads lectern={lectern} entities={entities} worldId={worldId} sessionId={session.id} />
        </div>
        <div className="lectern-col">
          <LecternPrep session={session} worldId={worldId} />
          <Initiative lectern={lectern} edit={edit} entities={entities} campaignId={session.campaignId} />
          <ClocksPanel worldId={worldId} entities={entities} />
        </div>
        <div className="lectern-col">
          {world && <ShowPanel world={world} sceneText={lectern.sceneText} />}
          <Soundboard worldId={worldId} compact />
          <Dice lectern={lectern} edit={edit} />
          <TablesPanel tables={entities.filter((e) => e.type === 'table')} worldId={worldId} entities={entities} />
          <QuickNote sessionId={session.id} />
          <QuickGenerators lectern={lectern} edit={edit} worldId={worldId} parentId={lectern.sceneId} />
        </div>
      </div>
    </div>
  )
}

interface PanelProps {
  lectern: LecternState
  edit: (fn: (l: LecternState) => void) => unknown
}

function Scene({ lectern, edit, entities, worldId }: PanelProps & { entities: Entity[]; worldId: string }) {
  const place = entities.find((e) => e.id === lectern.sceneId)
  const map = useLiveQuery(
    () => (place ? db.maps.where({ locationId: place.id }).first() : undefined),
    [place?.id],
  )
  const here = place ? entities.filter((e) => e.parentId === place.id && !lectern.presentIds.includes(e.id) && e.type !== 'location') : []
  return (
    <section className="card lectern-panel">
      <h2><Ico as={CastleTurret} /> Scene</h2>
      <select
        value={lectern.sceneId ?? ''}
        onChange={(e) => {
          const v = e.target.value || undefined
          edit((l) => void (l.sceneId = v))
        }}
      >
        <option value="">Where is the party?</option>
        {entities
          .filter((e) => e.type === 'location' || e.type === 'shop')
          .map((e) => (
            <option key={e.id} value={e.id}>
              {ENTITY_LABELS[e.type].icon} {e.name}
            </option>
          ))}
      </select>
      {place && (
        <>
          <div className="row wrap small">
            <Link to={`/w/${worldId}/e/${place.id}`}>Open page</Link>
            {map && <Link to={`/w/${worldId}/maps/${map.id}`}><Ico as={MapTrifold} /> Open map</Link>}
          </div>
          {place.summary && <p className="muted">{place.summary}</p>}
          <details>
            <summary>Page text</summary>
            <Markdown text={place.body} entities={entities} worldId={worldId} showSecrets />
            {place.gmNotes && <div className="secret">{place.gmNotes}</div>}
          </details>
          {here.length > 0 && (
            <div className="small">
              <span className="muted">Found here: </span>
              <span className="tags">
                {here.map((e) => (
                  <button key={e.id} className="tag" title="Add to who's present" onClick={() => edit((l) => void l.presentIds.push(e.id))}>
                    + <TypeIcon type={e.type} /> {e.name}
                  </button>
                ))}
              </span>
            </div>
          )}
        </>
      )}
      <DraftText
        multiline
        rows={5}
        value={lectern.sceneText}
        placeholder="Read-aloud text, what's in the room, what happens next…"
        onCommit={(v) => edit((l) => void (l.sceneText = v))}
      />
    </section>
  )
}

function Present({ lectern, edit, entities, worldId }: PanelProps & { entities: Entity[]; worldId: string }) {
  const present = lectern.presentIds.map((id) => entities.find((e) => e.id === id)).filter((e): e is Entity => !!e)
  return (
    <section className="card lectern-panel">
      <h2><Ico as={User} /> Who's here</h2>
      {present.length === 0 && <p className="muted small">Add the NPCs and others in this scene to keep their notes in reach.</p>}
      {present.map((e) => (
        <div key={e.id} className="present">
          <div className="row spread">
            <Link to={`/w/${worldId}/e/${e.id}`}>
              <strong>
                <TypeIcon type={e.type} /> {e.name}
              </strong>
            </Link>
            <StatusBadge entity={e} />
            <div className="row">
              <button className="ghost" title="Add to initiative" onClick={() => edit((l) => addCombatants(l, [fromEntity(e)]))}>
                <Ico as={Sword} />
              </button>
              <button className="ghost" title="Remove from scene" onClick={() => edit((l) => void (l.presentIds = l.presentIds.filter((x) => x !== e.id)))}>
                ✕
              </button>
            </div>
          </div>
          {e.summary && <div className="muted small">{e.summary}</div>}
          {e.fields.length > 0 && (
            <div className="small">
              {e.fields.slice(0, 6).map((f, i) => (
                <span key={i} className="field-chip">
                  <b>{f.key}</b> {f.value}
                </span>
              ))}
            </div>
          )}
          {e.gmNotes && <div className="secret small">{plainLinks(e.gmNotes)}</div>}
        </div>
      ))}
      <select
        value=""
        onChange={(e) => {
          const v = e.target.value
          if (v) edit((l) => void l.presentIds.push(v))
        }}
      >
        <option value="">+ Add someone…</option>
        {entities
          .filter((e) => ['npc', 'pc', 'faction', 'deity'].includes(e.type) && !lectern.presentIds.includes(e.id))
          .map((e) => (
            <option key={e.id} value={e.id}>
              {ENTITY_LABELS[e.type].icon} {e.name}
            </option>
          ))}
      </select>
    </section>
  )
}

/** Open threads, with the ones touching this scene first, and a quick way to note a new one. */
function LecternThreads({ lectern, entities, worldId, sessionId }: { lectern: LecternState; entities: Entity[]; worldId: string; sessionId: string }) {
  const sessions = useWorldSessions(worldId)
  const [name, setName] = useState('')
  const inScene = new Set([lectern.sceneId, ...lectern.presentIds].filter(Boolean))
  const open = entities.filter((e) => e.type === 'thread' && (e.threadStatus === 'open' || e.threadStatus === 'active'))
  const touching = (t: Entity) => threadLinks(t, entities, true).filter((e) => inScene.has(e.id))
  const here = open.filter((t) => touching(t).length > 0)
  const rest = open.filter((t) => touching(t).length === 0)
  const card = (t: Entity, highlight?: string) => (
    <ThreadCard key={t.id} thread={t} entities={entities} sessions={sessions} worldId={worldId} currentSessionId={sessionId} highlight={highlight} />
  )
  return (
    <section className="card lectern-panel">
      <div className="row spread">
        <h2><Ico as={Spiral} /> Loose threads</h2>
        <Link className="small" to={`/w/${worldId}/threads`}>
          All threads
        </Link>
      </div>
      <form
        className="row"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim()) return
          await db.entities.add(newThread(worldId, name.trim(), sessionId))
          setName('')
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Something left hanging… (Enter to add)" />
        <button disabled={!name.trim()}>Add</button>
      </form>
      {here.map((t) => card(t, `Here: ${touching(t).map((e) => e.name).join(', ')}`))}
      {open.length === 0 && <p className="muted small">No open threads. Add one when the players leave something unresolved.</p>}
      {rest.length > 0 && (
        <details open={here.length === 0}>
          <summary className="small">
            {here.length ? 'Other open threads' : 'Open threads'} ({rest.length})
          </summary>
          {rest.map((t) => card(t))}
        </details>
      )}
    </section>
  )
}

const CONDITIONS = ['Blinded', 'Charmed', 'Concentrating', 'Deafened', 'Frightened', 'Grappled', 'Hidden', 'Invisible', 'Paralysed', 'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious']

const field = fieldOf

/** Initiative order: highest first, unrolled at the bottom, ties keep the order they were added. */
const ordered = (cs: Combatant[]) => [...cs].sort((a, b) => (b.init ?? -Infinity) - (a.init ?? -Infinity))

function Initiative({ lectern, edit, entities, campaignId }: PanelProps & { entities: Entity[]; campaignId: string }) {
  const { round, activeId } = lectern.combat
  const list = ordered(lectern.combat.combatants)
  const [name, setName] = useState('')
  const [count, setCount] = useState(1)
  const [hp, setHp] = useState('')
  const [init, setInit] = useState('')
  // This campaign's party, leaving out anyone dead, missing or captured.
  const pcs = partyOf(entities, campaignId, { activeOnly: true }).filter((e) => !lectern.combat.combatants.some((c) => c.entityId === e.id))
  const initMod = (c: Combatant) => {
    const e = entities.find((x) => x.id === c.entityId)
    return e ? modifierFrom(field(e, /^(init|initiative)/i)) : 0
  }
  const step = (dir: 1 | -1) =>
    edit((l) => {
      const order = ordered(l.combat.combatants)
      if (!order.length) return
      const i = order.findIndex((c) => c.id === l.combat.activeId)
      if (i < 0) {
        l.combat.activeId = order[0].id
        l.combat.round = Math.max(1, l.combat.round)
        return
      }
      let j = i + dir
      if (j >= order.length) {
        j = 0
        l.combat.round++
      } else if (j < 0) {
        if (l.combat.round <= 1) return
        j = order.length - 1
        l.combat.round--
      }
      l.combat.activeId = order[j].id
    })
  const change = (id: string, fn: (c: Combatant) => void) =>
    edit((l) => {
      const c = l.combat.combatants.find((x) => x.id === id)
      if (c) fn(c)
    })

  return (
    <section className="card lectern-panel">
      <div className="row spread">
        <h2>
          <Ico as={Sword} /> Initiative <Help topic="initiative" />
        </h2>
        <span className="muted">{round > 0 ? `Round ${round}` : 'Not started'}</span>
      </div>
      <div className="row wrap">
        <button onClick={() => step(-1)} disabled={!activeId}>◀ Back</button>
        <button className="primary" onClick={() => step(1)} disabled={!list.length}>
          {activeId ? 'Next turn ▶' : 'Start combat ▶'}
        </button>
        <button
          title="Roll for everyone without a number yet (not player characters)"
          onClick={() =>
            edit((l) => {
              for (const c of l.combat.combatants) if (c.init === null && c.side !== 'pc') c.init = rollDie(20) + initMod(c)
            })
          }
        >
          <Ico as={DiceFive} /> Roll for NPCs
        </button>
        <button
          className="danger"
          disabled={!list.length}
          onClick={() => confirm('End this combat and clear the list?') && edit((l) => void (l.combat = { round: 0, combatants: [] }))}
        >
          End
        </button>
      </div>

      {list.length === 0 && <p className="muted small">Add the party and the opposition, type or roll initiative, then start.</p>}
      <ol className="initiative">
        {list.map((c) => (
          <li key={c.id} className={`combatant side-${c.side} ${c.id === activeId ? 'active' : ''} ${c.hp === 0 ? 'down' : ''}`}>
            <div className="row">
              <DraftText
                className="init-input"
                inputMode="numeric"
                value={c.init?.toString() ?? ''}
                placeholder="–"
                title="Initiative"
                onCommit={(v) => change(c.id, (x) => void (x.init = toNumber(v)))}
              />
              <button className="ghost" title={`Roll d20${initMod(c) ? ` ${initMod(c) > 0 ? '+' : ''}${initMod(c)}` : ''}`} onClick={() => change(c.id, (x) => void (x.init = rollDie(20) + initMod(c)))}>
                <Ico as={DiceFive} />
              </button>
              <strong className="combatant-name">{c.name}</strong>
              {c.ac && <span className="field-chip" title="Armour class / defence"><Ico as={Shield} /> {c.ac}</span>}
              <select
                className="side-select"
                value={c.side}
                title="Side"
                onChange={(e) => {
                  const v = e.target.value as Combatant['side']
                  change(c.id, (x) => void (x.side = v))
                }}
              >
                <option value="pc">PC</option>
                <option value="ally">Ally</option>
                <option value="foe">Foe</option>
              </select>
              <button className="ghost" title="Remove" onClick={() => edit((l) => void (l.combat.combatants = l.combat.combatants.filter((x) => x.id !== c.id)))}>
                ✕
              </button>
            </div>
            <div className="row wrap">
              <HpControl c={c} onChange={(fn) => change(c.id, fn)} />
              <span className="tags">
                {c.conditions.map((k) => (
                  <span key={k} className="tag">
                    {k}
                    <button title="Remove" onClick={() => change(c.id, (x) => void (x.conditions = x.conditions.filter((y) => y !== k)))}>
                      ✕
                    </button>
                  </span>
                ))}
              </span>
              <select
                className="condition-select"
                value=""
                onChange={(e) => {
                  const v = e.target.value
                  if (v) change(c.id, (x) => void (x.conditions = [...new Set([...x.conditions, v])]))
                }}
              >
                <option value="">+ condition</option>
                {CONDITIONS.filter((k) => !c.conditions.includes(k)).map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </div>
          </li>
        ))}
      </ol>

      <form
        className="add-combatant"
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return
          const max = numberFrom(hp)
          const n = Math.min(Math.max(1, count), 20)
          edit((l) =>
            addCombatants(
              l,
              Array.from({ length: n }, () => ({
                name: name.trim(),
                init: init === '' ? null : Number(init),
                hp: max,
                maxHp: max,
                side: 'foe' as const,
                conditions: [],
              })),
            ),
          )
          setName('')
          setInit('')
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. Goblin" />
        <input type="number" value={init} onChange={(e) => setInit(e.target.value)} placeholder="Init" title="Initiative (leave blank to roll later)" />
        <input value={hp} onChange={(e) => setHp(e.target.value)} placeholder="HP" title="Hit points (optional)" />
        <input type="number" min={1} max={20} value={count} onChange={(e) => setCount(Number(e.target.value) || 1)} title="How many" />
        <button disabled={!name.trim()}>Add</button>
      </form>
      {pcs.length > 0 && (
        <button onClick={() => edit((l) => addCombatants(l, pcs.map(fromEntity)))}>
          <Ico as={Shield} /> Add the party ({pcs.length})
        </button>
      )}
    </section>
  )
}

function HpControl({ c, onChange }: { c: Combatant; onChange: (fn: (c: Combatant) => void) => void }) {
  const [amount, setAmount] = useState('')
  const apply = (sign: 1 | -1) => {
    const n = numberFrom(amount)
    if (n === null) return
    onChange((x) => {
      const now = (x.hp ?? x.maxHp ?? 0) + sign * n
      x.hp = Math.max(0, x.maxHp ? Math.min(now, x.maxHp) : now)
    })
    setAmount('')
  }
  if (c.hp == null && c.maxHp == null)
    return (
      <button className="ghost small" onClick={() => onChange((x) => void ((x.hp = 10), (x.maxHp = 10)))}>
        + track HP
      </button>
    )
  const pct = c.maxHp ? Math.max(0, Math.min(1, (c.hp ?? 0) / c.maxHp)) : 1
  return (
    <span className="hp">
      <span className="hp-bar" title={`${c.hp} / ${c.maxHp ?? '?'}`}>
        <span style={{ width: `${pct * 100}%` }} className={pct <= 0.25 ? 'low' : pct <= 0.5 ? 'mid' : ''} />
      </span>
      <DraftText
        className="hp-input"
        inputMode="numeric"
        value={c.hp?.toString() ?? ''}
        title="Current HP"
        onCommit={(v) => onChange((x) => void (x.hp = toNumber(v)))}
      />
      <span className="muted">/</span>
      <DraftText
        className="hp-input"
        inputMode="numeric"
        value={c.maxHp?.toString() ?? ''}
        title="Max HP"
        onCommit={(v) => onChange((x) => void (x.maxHp = toNumber(v)))}
      />
      <input
        className="hp-input"
        value={amount}
        placeholder="±"
        title="Amount of damage or healing"
        onChange={(e) => setAmount(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && apply(-1)}
      />
      <button className="ghost" title="Damage" onClick={() => apply(-1)}>
        −
      </button>
      <button className="ghost" title="Heal" onClick={() => apply(1)}>
        +
      </button>
    </span>
  )
}

const toNumber = (v: string) => {
  const n = parseInt(v, 10)
  return Number.isNaN(n) ? null : n
}

const QUICK_DICE = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']

function Dice({ lectern, edit }: PanelProps) {
  const [expr, setExpr] = useState('')
  const [error, setError] = useState('')
  const doRoll = (text: string) => {
    try {
      const r = roll(text)
      setError('')
      edit((l) => void (l.rolls = [{ ...r, id: newId(), at: Date.now() }, ...l.rolls].slice(0, 30)))
    } catch (err) {
      setError((err as Error).message)
    }
  }
  const last = lectern.rolls[0]
  return (
    <section className="card lectern-panel">
      <h2>
        <Ico as={DiceFive} /> Dice <Help topic="dice" />
      </h2>
      <div className="row wrap dice-buttons">
        {QUICK_DICE.map((d) => (
          <button key={d} onClick={() => doRoll(d)}>
            {d}
          </button>
        ))}
        <button title="Advantage: roll 2d20, keep the higher" onClick={() => doRoll('2d20kh1')}>
          Adv
        </button>
        <button title="Disadvantage: roll 2d20, keep the lower" onClick={() => doRoll('2d20kl1')}>
          Dis
        </button>
      </div>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault()
          doRoll(expr)
        }}
      >
        <input value={expr} onChange={(e) => setExpr(e.target.value)} placeholder="e.g. 2d6+3, 4d6kh3, d20-1" />
        <button className="primary">Roll</button>
      </form>
      {error && <p className="error small">{error}</p>}
      {last && (
        <div className={`roll-result ${last.crit ?? ''}`}>
          <span className="roll-total">{last.total}</span>
          <span className="muted small">
            {last.expr}: <RollDetail text={last.detail} />
          </span>
        </div>
      )}
      {lectern.rolls.length > 1 && (
        <details>
          <summary className="small">Earlier rolls</summary>
          <ul className="roll-log small">
            {lectern.rolls.slice(1).map((r) => (
              <li key={r.id}>
                <b>{r.total}</b> <span className="muted">{r.expr}: <RollDetail text={r.detail} /></span>
              </li>
            ))}
          </ul>
          <button className="ghost small" onClick={() => edit((l) => void (l.rolls = []))}>
            Clear
          </button>
        </details>
      )}
    </section>
  )
}

/** Shows dropped dice (from "keep highest/lowest") struck through. */
function RollDetail({ text }: { text: string }) {
  return (
    <>
      {text.split(/~~(\d+)~~/).map((part, i) => (i % 2 ? <s key={i}>{part}</s> : <span key={i}>{part}</span>))}
    </>
  )
}

function QuickNote({ sessionId }: { sessionId: string }) {
  const [text, setText] = useState('')
  const [saved, setSaved] = useState('')
  return (
    <section className="card lectern-panel">
      <h2>
        ✒️ Quick note <Help topic="quickNote" />
      </h2>
      <form
        className="row"
        onSubmit={async (e) => {
          e.preventDefault()
          const line = text.trim()
          if (!line) return
          const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          await db.sessions
            .where('id')
            .equals(sessionId)
            .modify((s) => void (s.notes = `${s.notes.trimEnd()}${s.notes.trim() ? '\n' : ''}- ${time} ${line}`))
          setText('')
          setSaved(line)
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Something to remember… (Enter to save)" />
        <button>Save</button>
      </form>
      <p className="muted small">{saved ? `Added to the session notes: “${saved}”` : 'Notes go to the end of this session’s GM notes, with the time.'}</p>
    </section>
  )
}

type GenKind = 'npc' | 'tavern' | 'shop'

function QuickGenerators({ edit, worldId, parentId }: PanelProps & { worldId: string; parentId?: string }) {
  const [kind, setKind] = useState<GenKind>('npc')
  const [shopKind, setShopKind] = useState(SHOP_KIND_NAMES[0])
  const [npc, setNpc] = useState<GeneratedNpc>(() => generateNpc())
  const [place, setPlace] = useState<GeneratedPlace>(() => generateTavern())
  const [greeting, setGreeting] = useState(() => npcGreeting(npc))
  const [savedName, setSavedName] = useState('')
  const reroll = (k: GenKind, sk = shopKind) => {
    setSavedName('')
    if (k === 'npc') {
      const n = generateNpc()
      setNpc(n)
      setGreeting(npcGreeting(n))
    } else {
      const p = k === 'tavern' ? generateTavern() : generateShop(sk)
      setPlace(p)
      setGreeting(npcGreeting(p.keeper))
    }
  }
  const save = async () => {
    const created = kind === 'npc' ? [npcToEntity(worldId, npc, parentId)] : placeToEntities(worldId, place, parentId)
    await db.entities.bulkAdd(created)
    // A new NPC joins the scene; a new place becomes where the party is.
    edit((l) => {
      if (kind === 'npc') l.presentIds.push(created[0].id)
      else l.sceneId = created[0].id
    })
    setSavedName(created[0].name)
  }
  return (
    <section className="card lectern-panel">
      <h2>
        <Ico as={DiceFive} /> Improvise <Help topic="improvise" />
      </h2>
      <div className="row wrap">
        <div className="segmented">
          {(['npc', 'tavern', 'shop'] as const).map((k) => (
            <button
              key={k}
              className={kind === k ? 'on' : ''}
              onClick={() => {
                setKind(k)
                reroll(k)
              }}
            >
              {k === 'npc' ? '🧙 NPC' : k === 'tavern' ? '🍺 Tavern' : '⚒️ Shop'}
            </button>
          ))}
        </div>
        {kind === 'shop' && (
          <select
            value={shopKind}
            onChange={(e) => {
              setShopKind(e.target.value)
              reroll('shop', e.target.value)
            }}
          >
            {SHOP_KIND_NAMES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        )}
      </div>
      {kind === 'npc' ? (
        <div className="small">
          <strong>{npc.name}</strong>, a {npc.manner} {npc.ancestry} {npc.role} with {npc.look}.
          <div>
            <b>Wants:</b> {npc.wants}.
          </div>
          <div className="secret">
            <b>Secret:</b> {npc.secret}.
          </div>
        </div>
      ) : (
        <div className="small">
          <strong>{place.name}</strong>: {place.summary}. Run by {place.keeper.name}, {place.keeper.manner}.
        </div>
      )}
      <blockquote className="small">{greeting}</blockquote>
      <div className="row wrap">
        <button onClick={() => reroll(kind)}><Ico as={DiceFive} /> Reroll</button>
        <button className="primary" onClick={save} disabled={!!savedName}>
          {savedName ? '✓ Saved' : kind === 'npc' ? 'Save and add to scene' : 'Save and set as scene'}
        </button>
      </div>
    </section>
  )
}
