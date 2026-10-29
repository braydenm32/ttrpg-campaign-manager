import { PreviouslyOn } from '../ai/ReadAloud'
import { useLiveQuery } from 'dexie-react-hooks'
import { Help } from '../help'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { partyOf } from '../sessions'
import { DraftText, Empty } from '../components'
import { ENTITY_LABELS, blankLectern, db, newId, type Combatant, type Entity, type LecternState } from '../db'
import { modifierFrom, roll, rollDie } from '../dice'
import { addCombatants, fieldOf, fromEntity, initiativeOrder, numberFrom } from '../encounters'
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
import { Armchair, BookOpen, CastleTurret, CloudFog, DiceFive, FlagCheckered, MapTrifold, Eye, EyeSlash, Prohibit, Shield, Sparkle, Spiral, Sword, Timer, User } from '@phosphor-icons/react'
import { pagePath, worldPath } from '../paths'
import { clockText, RollDetail, RollLog, timeLeft, useNow } from '../atTheTable'
import { setLiveSession, shareRoll, useTable } from '../cloud/table'

/**
 * The Lectern: one screen for running a session at the table.
 * Scene and who's present on the left, initiative in the middle, dice, generators and quick notes on the right.
 * Everything here is GM-only and saved on the session as you go.
 */
export default function Lectern() {
  const { worldId, world } = useWorld()
  const { sessionId = '' } = useParams()
  const { isGM } = useViewMode()
  const session = useLiveQuery(async () => (await db.sessions.get(sessionId)) ?? null, [sessionId])
  const entities = useVisibleEntities(worldId)
  // Opening the Lectern starts the live link to players' Common Room for this session.
  useEffect(() => {
    if (isGM && session && session.worldId === worldId) setLiveSession(worldId, session.id)
  }, [isGM, session?.id, session?.worldId, worldId]) // eslint-disable-line react-hooks/exhaustive-deps

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
            <Link to={`${worldPath(worldId)}/s/${session.id}`}>← Session notes</Link>
            <Link className="button" to={`${worldPath(worldId)}/s/${session.id}?end=1`} title="Recap, show players, start the next session">
              <Ico as={FlagCheckered} /> End session
            </Link>
          </div>
          <h1>
            <Ico as={BookOpen} /> The Lectern <Help topic="lectern" /> <span className="muted">· #{session.number} {session.title}</span>
          </h1>
          <div className="row wrap">
            {world && <WorldToday world={world} isGM />}
            <PreviouslyOn session={session} />
          </div>
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
          <Party entities={entities} campaignId={session.campaignId} worldId={worldId} />
          <LecternThreads lectern={lectern} entities={entities} worldId={worldId} sessionId={session.id} />
        </div>
        <div className="lectern-col">
          <LecternPrep session={session} worldId={worldId} />
          <Initiative lectern={lectern} edit={edit} entities={entities} campaignId={session.campaignId} />
          <Timers lectern={lectern} edit={edit} shared={!!world?.cloud?.enabled && !lectern.share?.off} />
          <ClocksPanel worldId={worldId} entities={entities} />
        </div>
        <div className="lectern-col">
          {world?.cloud?.enabled && <CommonRoomPanel worldId={worldId} lectern={lectern} edit={edit} />}
          {world && <ShowPanel world={world} sceneText={lectern.sceneText} />}
          <Soundboard worldId={worldId} compact />
          <Dice lectern={lectern} edit={edit} shareTo={world?.cloud?.enabled && lectern.share?.rolls && !lectern.share.off ? worldId : undefined} />
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
            <Link to={`${pagePath(worldId, place.id)}`}>Open page</Link>
            {map && <Link to={`${worldPath(worldId)}/maps/${map.id}`}><Ico as={MapTrifold} /> Open map</Link>}
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
            <Link to={`${pagePath(worldId, e.id)}`}>
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
        <Link className="small" to={`${worldPath(worldId)}/threads`}>
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

const ordered = initiativeOrder

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
              <button className="ghost" title="Remove" onClick={() =>
                  edit((l) => {
                    // Removing whoever's turn it is passes the turn on to the next one, not back to the top.
                    if (l.combat.activeId === c.id) {
                      const order = ordered(l.combat.combatants)
                      const i = order.findIndex((x) => x.id === c.id)
                      const rest = order.filter((x) => x.id !== c.id)
                      if (rest.length && i === order.length - 1) l.combat.round++
                      l.combat.activeId = rest.length ? rest[i % rest.length].id : undefined
                    }
                    l.combat.combatants = l.combat.combatants.filter((x) => x.id !== c.id)
                  })
                }>
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

function Dice({ lectern, edit, shareTo }: PanelProps & { shareTo?: string }) {
  const [expr, setExpr] = useState('')
  const [error, setError] = useState('')
  const doRoll = (text: string) => {
    try {
      const r = roll(text)
      setError('')
      edit((l) => void (l.rolls = [{ ...r, id: newId(), at: Date.now() }, ...l.rolls].slice(0, 30)))
      if (shareTo) void shareRoll(shareTo, { who: 'GM', expr: r.expr, total: r.total, detail: r.detail, crit: r.crit })
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

/** What players' Common Room shows of this session, and what they're rolling. */
function CommonRoomPanel({ worldId, lectern, edit }: PanelProps & { worldId: string }) {
  const { rolls } = useTable(worldId)
  const share = lectern.share ?? {}
  const set = (key: keyof NonNullable<LecternState['share']>, on: boolean) =>
    edit((l) => void (l.share = { ...l.share, [key]: on || undefined }))
  const theirs = rolls.filter((r) => r.who !== 'GM')
  return (
    <section className="card lectern-panel">
      <h2>
        <Ico as={Armchair} /> Players’ Common Room <Help topic="tableLink" />
      </h2>
      <label className="row small">
        <input type="checkbox" checked={!share.off} onChange={(e) => set('off', !e.target.checked)} />
        Share this session live with players
      </label>
      {share.off ? (
        <p className="muted small">Players see nothing live from this session. Their dice and signals still reach you.</p>
      ) : (
        <>
          <p className="muted small">
            They see the scene’s name (once its page is revealed), the music, and whose turn it is once you start combat. Never HP, conditions or your notes.
          </p>
          <label className="row small">
            <input type="checkbox" checked={!share.hideNames} onChange={(e) => set('hideNames', !e.target.checked)} />
            Show names of foes and allies in the turn order
          </label>
          <label className="row small">
            <input type="checkbox" checked={!share.noMusic} onChange={(e) => set('noMusic', !e.target.checked)} />
            Show what music is playing
          </label>
          <label className="row small">
            <input type="checkbox" checked={!!share.rolls} onChange={(e) => set('rolls', e.target.checked)} />
            Players see my dice rolls
          </label>
        </>
      )}
      {theirs.length > 0 ? (
        <>
          <h3 className="small">Players’ rolls</h3>
          <RollLog rolls={theirs} limit={6} />
        </>
      ) : (
        <p className="muted small">Players’ rolls show up here as they make them.</p>
      )}
    </section>
  )
}

/** The party at a glance, with inspiration to hand out. */
function Party({ entities, campaignId, worldId }: { entities: Entity[]; campaignId: string; worldId: string }) {
  const party = partyOf(entities, campaignId)
  if (!party.length) return null
  const give = (e: Entity, n: number) => db.entities.update(e.id, { inspiration: Math.max(0, (e.inspiration ?? 0) + n) || undefined, updatedAt: Date.now() })
  return (
    <section className="card lectern-panel">
      <h2>
        <Ico as={Shield} /> The party <Help topic="inspiration" />
      </h2>
      <ul className="lectern-party">
        {party.map((e) => (
          <li key={e.id} className="row spread">
            <span>
              <Link to={pagePath(worldId, e.id)}>{e.name}</Link> <StatusBadge entity={e} />
            </span>
            <span className="row inspiration-control" title="Inspiration (players can see it)">
              <button className="ghost small" aria-label={`Take inspiration from ${e.name}`} disabled={!e.inspiration} onClick={() => give(e, -1)}>
                −
              </button>
              <span className={e.inspiration ? 'inspired' : 'muted'}>
                <Ico as={Sparkle} /> {e.inspiration ?? 0}
              </span>
              <button className="ghost small" aria-label={`Give ${e.name} inspiration`} onClick={() => give(e, 1)}>
                +
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

const TIMER_MINUTES = [1, 3, 5, 10, 30]

/** A short beep when a timer runs out (quiet if the browser won't play sound yet). */
function beep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.8)
    osc.onended = () => void ctx.close()
  } catch {
    // No sound available: the timer still shows "Time's up".
  }
}

/** Countdowns for the table: a ritual finishing, a fuse burning, a time limit on a puzzle. */
function Timers({ lectern, edit, shared }: PanelProps & { shared: boolean }) {
  const timers = lectern.timers ?? []
  const running = timers.some((t) => t.endsAt !== undefined)
  const now = useNow(500, running)
  const [label, setLabel] = useState('')
  const [custom, setCustom] = useState('')
  // Beep once each time a timer runs out while the Lectern is open.
  const rang = useRef(new Set<string>())
  // (Only ones that just ran out: opening the Lectern later doesn't beep for old ones.)
  const due = timers.filter((t) => t.endsAt !== undefined && timeLeft(t, now) === 0 && now - t.endsAt < 10_000).map((t) => `${t.id}:${t.endsAt}`)
  const dueKey = due.join(',')
  useEffect(() => {
    const fresh = dueKey.split(',').filter((k) => k && !rang.current.has(k))
    if (!fresh.length) return
    fresh.forEach((k) => rang.current.add(k))
    beep()
  }, [dueKey])
  const change = (id: string, fn: (t: NonNullable<LecternState['timers']>[number]) => void) =>
    edit((l) => {
      const t = l.timers?.find((x) => x.id === id)
      if (t) fn(t)
    })
  const start = (minutes: number) => {
    if (!(minutes > 0)) return
    const name = label.trim() || `${minutes} minute${minutes === 1 ? '' : 's'}`
    edit((l) => void (l.timers = [...(l.timers ?? []), { id: newId(), label: name, endsAt: Date.now() + minutes * 60_000 }]))
    setLabel('')
    setCustom('')
  }
  return (
    <section className="card lectern-panel">
      <h2>
        <Ico as={Timer} /> Timers <Help topic="timers" />
      </h2>
      <ul className="timer-list">
        {timers.map((t) => {
          const left = timeLeft(t, now)
          const paused = t.endsAt === undefined
          return (
            <li key={t.id} className={left === 0 ? 'done' : paused ? 'paused' : ''}>
              <span>{t.label}</span>
              <b className="timer-time">{left === 0 ? 'Time’s up' : clockText(left)}</b>
              {left > 0 && (
                <button
                  className="ghost small"
                  onClick={() =>
                    change(t.id, (x) => {
                      if (x.endsAt !== undefined) {
                        x.left = Math.max(0, x.endsAt - Date.now())
                        delete x.endsAt
                      } else {
                        x.endsAt = Date.now() + (x.left ?? 0)
                        delete x.left
                      }
                    })
                  }
                >
                  {paused ? 'Resume' : 'Pause'}
                </button>
              )}
              <button
                className="ghost small"
                title="One more minute"
                onClick={() =>
                  change(t.id, (x) => {
                    if (x.endsAt !== undefined) x.endsAt = Math.max(x.endsAt, Date.now()) + 60_000
                    else x.left = (x.left ?? 0) + 60_000
                  })
                }
              >
                +1 min
              </button>
              {shared && (
                <button
                  className="ghost small"
                  title={t.hidden ? 'Players can’t see this one. Show it to them' : 'Players see this one. Hide it from them'}
                  onClick={() => change(t.id, (x) => void (x.hidden = !x.hidden || undefined))}
                >
                  <Ico as={t.hidden ? EyeSlash : Eye} />
                </button>
              )}
              <button className="ghost small" title="Remove" onClick={() => edit((l) => void (l.timers = l.timers?.filter((x) => x.id !== t.id)))}>
                ✕
              </button>
            </li>
          )
        })}
      </ul>
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="What’s it for? (optional)" aria-label="Timer name" />
      <div className="row wrap">
        {TIMER_MINUTES.map((m) => (
          <button key={m} onClick={() => start(m)}>
            {m} min
          </button>
        ))}
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault()
            start(Number(custom))
          }}
        >
          <input className="hp-input" type="number" min={1} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="min" aria-label="Minutes" />
          <button disabled={!(Number(custom) > 0)}>Start</button>
        </form>
      </div>
      {shared && timers.length > 0 && <p className="muted small">Players see timers in their Common Room unless you hide them.</p>}
    </section>
  )
}
