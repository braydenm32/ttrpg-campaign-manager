import { PreviouslyOn } from '../ai/ReadAloud'
import { useLiveQuery } from 'dexie-react-hooks'
import { Help } from '../help'
import { PartyGlance } from '../partyGlance'
import { GmScreenPanel } from '../gmScreen'
import { FoldingProvider, LECTERN_PANELS, LecternPanel, useFolding } from '../lecternPanel'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { partyOf } from '../sessions'
import { DraftText, Empty } from '../components'
import { PagePicker } from '../PagePicker'
import { ENTITY_LABELS, blankLectern, db, newId, type Combatant, type Entity, type LecternState, type Session, type World } from '../db'
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
import { Armchair, BookOpen, CastleTurret, CloudFog, DiceFive, FlagCheckered, Keyboard, MapTrifold, NotePencil, Eye, EyeSlash, Prohibit, Shield, Sparkle, Spiral, Sword, Timer, User } from '@phosphor-icons/react'
import { pagePath, worldPath } from '../paths'
import { clockText, GoLive, RollDetail, RollLog, timeLeft, useNow } from '../atTheTable'
import { shareRoll, useLiveSession, useTable } from '../cloud/table'

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
  // Opening the Lectern sends nothing: players see this session only once the GM goes live with it.
  const live = useLiveSession(worldId) === sessionId
  const [query, setQuery] = useState('')
  const folding = useFolding(query)

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

  const shareTo = live && world?.cloud?.enabled && lectern.share?.rolls && !lectern.share.off ? worldId : undefined

  return (
    <div className="page wide lectern-page">
      <FightBar lectern={lectern} edit={edit} />
      <LecternKeys lectern={lectern} edit={edit} shareTo={shareTo} />
      <header className="page-header">
        <div>
          <div className="row spread">
            <Link to={`${worldPath(worldId)}/s/${session.id}`}>← Session notes</Link>
            <div className="row wrap lectern-actions">
              {world && <GoLive world={world} session={session} />}
              {world?.cloud?.enabled && <Help topic="goLive" />}
              <Link className="button" to={`${worldPath(worldId)}/s/${session.id}?end=1`} title="Recap, show players, start the next session">
                <Ico as={FlagCheckered} /> End session
              </Link>
            </div>
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
      <FoldingProvider value={folding.value}>
        <div className="lectern-tools row wrap">
          <input
            type="search"
            className="lectern-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
            placeholder="Find a panel or a page… (initiative, dice, Mirela)"
            aria-label="Find a panel or a page"
          />
          <Help topic="lecternSearch" />
          <button className="ghost small" onClick={() => folding.foldAll(LECTERN_PANELS)}>
            Fold all
          </button>
          <button className="ghost small" onClick={folding.openAll}>
            Open all
          </button>
        </div>
        {query.trim() && <FoundPages query={query} entities={entities} worldId={worldId} lectern={lectern} edit={edit} />}
        <div className="lectern">
          <div className="lectern-col">
            <Scene lectern={lectern} edit={edit} entities={entities} worldId={worldId} />
            <Present lectern={lectern} edit={edit} entities={entities} worldId={worldId} />
            {world && <Party world={world} entities={entities} campaignId={session.campaignId} />}
            <LecternThreads lectern={lectern} entities={entities} worldId={worldId} sessionId={session.id} />
          </div>
          <div className="lectern-col">
            <LecternPrep session={session} worldId={worldId} />
            <SessionNotes session={session} entities={entities} worldId={worldId} />
            <Initiative lectern={lectern} edit={edit} entities={entities} campaignId={session.campaignId} />
            <Timers lectern={lectern} edit={edit} shared={!!world?.cloud?.enabled} />
            <ClocksPanel worldId={worldId} entities={entities} />
          </div>
          <div className="lectern-col">
            {world?.cloud?.enabled && <CommonRoomPanel world={world} session={session} lectern={lectern} edit={edit} live={live} />}
            {world && <ShowPanel world={world} sceneText={lectern.sceneText} />}
            <Soundboard worldId={worldId} compact />
            <Dice lectern={lectern} edit={edit} shareTo={shareTo} />
            <TablesPanel tables={entities.filter((e) => e.type === 'table')} worldId={worldId} entities={entities} />
            {world && (
              <GmScreenPanel
                world={world}
                entities={entities}
                onRoll={(expr, name) => {
                  try {
                    return rollOnLectern(edit, expr, shareTo, name)
                  } catch (err) {
                    return { error: (err as Error).message }
                  }
                }}
              />
            )}
            <QuickGenerators lectern={lectern} edit={edit} worldId={worldId} parentId={lectern.sceneId} />
          </div>
        </div>
        {query.trim() && <p className="muted small lectern-search-note">Showing the panels that match “{query.trim()}”. Clear the search to see them all.</p>}
      </FoldingProvider>
    </div>
  )
}

type Edit = (fn: (l: LecternState) => void) => unknown

interface PanelProps {
  lectern: LecternState
  edit: Edit
}

/** Pages matching the Lectern's search: their notes at a glance, and quick ways to bring them into the scene. */
function FoundPages({ query, entities, worldId, lectern, edit }: PanelProps & { query: string; entities: Entity[]; worldId: string }) {
  const q = query.trim().toLowerCase()
  const found = entities
    .filter((e) => !e.template && [e.name, ...(e.aliases ?? [])].some((n) => n.toLowerCase().includes(q)))
    .sort((a, b) => Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q)) || a.name.localeCompare(b.name))
    .slice(0, 6)
  if (!found.length) return null
  const isPlace = (e: Entity) => e.type === 'location' || e.type === 'shop'
  return (
    <section className="card lectern-found">
      <h2 className="small muted">Pages</h2>
      <div className="lectern-found-list">
        {found.map((e) => (
          <div key={e.id} className="present">
            <div className="row spread">
              <Link to={pagePath(worldId, e.id)}>
                <strong>
                  <TypeIcon type={e.type} /> {e.name}
                </strong>
              </Link>
              <StatusBadge entity={e} />
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
            {e.gmNotes && (
              <details className="present-notes small">
                <summary>GM notes</summary>
                <div className="secret small">
                  <Markdown text={e.gmNotes} entities={entities} worldId={worldId} showSecrets />
                </div>
              </details>
            )}
            <div className="row wrap small">
              {isPlace(e) ? (
                <button className="ghost small" disabled={lectern.sceneId === e.id} onClick={() => edit((l) => void (l.sceneId = e.id))}>
                  {lectern.sceneId === e.id ? '✓ The scene' : 'Set as the scene'}
                </button>
              ) : (
                <button className="ghost small" disabled={lectern.presentIds.includes(e.id)} onClick={() => edit((l) => void l.presentIds.push(e.id))}>
                  {lectern.presentIds.includes(e.id) ? '✓ Here' : '+ Who’s here'}
                </button>
              )}
              {(e.type === 'npc' || e.type === 'pc') && (
                <button className="ghost small" title="Add to initiative" onClick={() => edit((l) => addCombatants(l, [fromEntity(e)]))}>
                  <Ico as={Sword} /> Fight
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Scene({ lectern, edit, entities, worldId }: PanelProps & { entities: Entity[]; worldId: string }) {
  const place = entities.find((e) => e.id === lectern.sceneId)
  const map = useLiveQuery(
    () => (place ? db.maps.where({ locationId: place.id }).first() : undefined),
    [place?.id],
  )
  const here = place ? entities.filter((e) => e.parentId === place.id && !lectern.presentIds.includes(e.id) && e.type !== 'location') : []
  return (
    <LecternPanel id="scene" name="Scene" keywords="where place location read-aloud room" title={<><Ico as={CastleTurret} /> Scene</>}>
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
    </LecternPanel>
  )
}

function Present({ lectern, edit, entities, worldId }: PanelProps & { entities: Entity[]; worldId: string }) {
  const present = lectern.presentIds.map((id) => entities.find((e) => e.id === id)).filter((e): e is Entity => !!e)
  return (
    <LecternPanel id="present" name="Who's here" keywords="npcs present people characters" title={<><Ico as={User} /> Who's here <Help topic="pagePicker" /></>}>
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
          {e.gmNotes && (
            <details className="present-notes small">
              <summary>GM notes</summary>
              <div className="secret small">
                <Markdown text={e.gmNotes} entities={entities} worldId={worldId} showSecrets />
              </div>
            </details>
          )}
        </div>
      ))}
      <PagePicker
        entities={entities.filter((e) => ['npc', 'pc', 'faction', 'deity'].includes(e.type) && !lectern.presentIds.includes(e.id))}
        placeholder="+ Add someone… (type a name)"
        suggested={entities.filter((e) => lectern.sceneId && e.parentId === lectern.sceneId).map((e) => e.id)}
        onPick={(id) => id && edit((l) => void l.presentIds.push(id))}
      />
    </LecternPanel>
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
    <LecternPanel
      id="threads"
      name="Loose threads"
      keywords="hooks mysteries leads quests"
      title={<><Ico as={Spiral} /> Loose threads</>}
      extra={
        <Link className="small" to={`${worldPath(worldId)}/threads`}>
          All threads
        </Link>
      }
    >
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
    </LecternPanel>
  )
}

const CONDITIONS = ['Blinded', 'Charmed', 'Concentrating', 'Deafened', 'Exhausted', 'Frightened', 'Grappled', 'Hidden', 'Incapacitated', 'Invisible', 'Paralysed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious']

const field = fieldOf

const ordered = initiativeOrder

/** Passes the turn on (1) or back (-1), counting rounds; on a fight that hasn't started, starts it. */
function stepTurn(edit: Edit, dir: 1 | -1) {
  return edit((l) => {
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
}

function Initiative({ lectern, edit, entities, campaignId }: PanelProps & { entities: Entity[]; campaignId: string }) {
  const { round, activeId } = lectern.combat
  const list = ordered(lectern.combat.combatants)
  // Conditions typed in for this fight (any game's: “Burning 2”, “Marked”, “ends round 5”) are offered again for the others.
  const customConditions = [...new Set(list.flatMap((c) => c.conditions))].filter((k) => !CONDITIONS.includes(k))
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
  const step = (dir: 1 | -1) => stepTurn(edit, dir)
  const change = (id: string, fn: (c: Combatant) => void) =>
    edit((l) => {
      const c = l.combat.combatants.find((x) => x.id === id)
      if (c) fn(c)
    })

  return (
    <LecternPanel
      id="initiative"
      sectionId="lectern-initiative"
      name="Initiative"
      keywords="combat fight turn order hp conditions round"
      title={<><Ico as={Sword} /> Initiative <Help topic="initiative" /></>}
      extra={
        <>
          <span className="muted">{round > 0 ? `Round ${round}` : 'Not started'}</span>
          <button className="ghost small lectern-keys-button" title="Keyboard shortcuts (press ?)" aria-label="Keyboard shortcuts" onClick={() => window.dispatchEvent(new Event(SHOW_KEYS))}>
            <Ico as={Keyboard} />
          </button>
        </>
      }
    >
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
                saveOn="leave"
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
                  const picked = e.target.value
                  const v = picked === '__custom' ? prompt('Name the condition. You can add a note, like “Burning 2” or “Marked, ends round 5”.')?.trim() : picked
                  if (v) change(c.id, (x) => void (x.conditions = [...new Set([...x.conditions, v])]))
                }}
              >
                <option value="">+ condition</option>
                {[...CONDITIONS, ...customConditions].filter((k) => !c.conditions.includes(k)).map((k) => (
                  <option key={k}>{k}</option>
                ))}
                <option value={'__custom'}>Something else…</option>
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
    </LecternPanel>
  )
}

function HpControl({ c, onChange }: { c: Combatant; onChange: (fn: (c: Combatant) => void) => void }) {
  const [amount, setAmount] = useState('')
  // What HP was before the last change, so a slip can be taken back.
  const [was, setWas] = useState<number | null>(null)
  // "+8" heals and "-8" damages whatever button or key is used; a bare number follows the button (Enter damages).
  const apply = (button: 1 | -1) => {
    const m = amount.trim().match(/^([+\-−–])?\s*(\d+)/)
    if (!m) return
    const sign = m[1] ? (m[1] === '+' ? 1 : -1) : button
    const n = Number(m[2])
    setWas(c.hp ?? c.maxHp ?? 0)
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
        title="Amount of damage or healing. Type +5 to heal or -5 to damage; a plain number follows the button you press (Enter damages)."
        onChange={(e) => setAmount(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && apply(-1)}
      />
      <button className="ghost" title="Damage" onClick={() => apply(-1)}>
        −
      </button>
      <button className="ghost" title="Heal" onClick={() => apply(1)}>
        +
      </button>
      {was !== null && (
        <button
          className="ghost small"
          title="Put HP back to what it was before the last change"
          onClick={() => {
            onChange((x) => void (x.hp = was))
            setWas(null)
          }}
        >
          Undo (was {was})
        </button>
      )}
    </span>
  )
}

const toNumber = (v: string) => {
  const n = parseInt(v, 10)
  return Number.isNaN(n) ? null : n
}

const QUICK_DICE = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100']

/** Rolls dice on the Lectern (and for players to see, if the GM chose that). Throws on dice it can't read. */
function rollOnLectern(edit: Edit, text: string, shareTo?: string, label?: string) {
  const r = roll(text)
  const expr = label ? `${label}: ${r.expr}` : r.expr
  edit((l) => void (l.rolls = [{ ...r, expr, id: newId(), at: Date.now() }, ...l.rolls].slice(0, 30)))
  if (shareTo) void shareRoll(shareTo, { who: 'GM', expr, total: r.total, detail: r.detail, crit: r.crit })
  return r
}

function Dice({ lectern, edit, shareTo }: PanelProps & { shareTo?: string }) {
  const [expr, setExpr] = useState('')
  const [error, setError] = useState('')
  const doRoll = (text: string) => {
    try {
      rollOnLectern(edit, text, shareTo)
      setError('')
    } catch (err) {
      setError((err as Error).message)
    }
  }
  const last = lectern.rolls[0]
  return (
    <LecternPanel id="dice" name="Dice" keywords="roll d20 advantage" title={<><Ico as={DiceFive} /> Dice <Help topic="dice" /></>}>
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
    </LecternPanel>
  )
}

/**
 * The session's GM notes, in reach without leaving the Lectern: read them, edit them, or add a
 * line with the time (it goes to the end of the notes).
 */
function SessionNotes({ session, entities, worldId }: { session: Session; entities: Entity[]; worldId: string }) {
  const [text, setText] = useState('')
  const [editing, setEditing] = useState(false)
  const setNotes = (fn: (notes: string) => string) =>
    db.sessions
      .where('id')
      .equals(session.id)
      .modify((s) => void (s.notes = fn(s.notes)))
  return (
    <LecternPanel
      id="notes"
      name="GM notes"
      keywords="session notes quick note jot remember"
      title={<><Ico as={NotePencil} /> GM notes <Help topic="lecternNotes" /></>}
      extra={
        <button className="ghost small" onClick={() => setEditing(!editing)}>
          {editing ? 'Done' : 'Edit'}
        </button>
      }
    >
      <form
        className="row"
        onSubmit={async (e) => {
          e.preventDefault()
          const line = text.trim()
          if (!line) return
          const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          await setNotes((n) => `${n.trimEnd()}${n.trim() ? '\n' : ''}- ${time} ${line}`)
          setText('')
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Something to remember… (Enter to add, with the time)" aria-label="Quick note" />
        <button>Add</button>
      </form>
      {editing ? (
        <DraftText multiline rows={10} value={session.notes} onCommit={(v) => void setNotes(() => v)} placeholder="Your notes for this session…" />
      ) : session.notes.trim() ? (
        <div className="lectern-notes">
          <Markdown text={session.notes} entities={entities} worldId={worldId} showSecrets />
        </div>
      ) : (
        <p className="muted small">No notes for this session yet. Lines you add here also show on the session page.</p>
      )}
    </LecternPanel>
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
    <LecternPanel id="improvise" name="Improvise" keywords="generate npc tavern shop name random" title={<><Ico as={DiceFive} /> Improvise <Help topic="improvise" /></>}>
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
    </LecternPanel>
  )
}

/** What players' Common Room shows of this session, and what they're rolling. */
function CommonRoomPanel({ world, session, lectern, edit, live }: PanelProps & { world: World; session: Session; live: boolean }) {
  const { rolls } = useTable(world.id)
  const share = lectern.share ?? {}
  const set = (key: keyof NonNullable<LecternState['share']>, on: boolean) =>
    edit((l) => void (l.share = { ...l.share, [key]: on || undefined }))
  const theirs = rolls.filter((r) => r.who !== 'GM')
  return (
    <LecternPanel id="commonroom" name="Players’ Common Room" keywords="live players go live share rolls" title={<><Ico as={Armchair} /> Players’ Common Room <Help topic="tableLink" /></>}>
      <GoLive world={world} session={session} />
      <p className="muted small">
        {live
          ? 'They see the scene’s name (once its page is revealed), the music, your timers, and whose turn it is once you start combat. Never HP, conditions or your notes.'
          : 'Players see nothing of this session until you go live. Their dice and signals still reach you.'}
      </p>
      <label className="row small">
        <input type="checkbox" checked={!share.hideNames} onChange={(e) => set('hideNames', !e.target.checked)} />
        <span>
          Show names of foes and allies in the turn order <span className="muted">(anyone from a page players haven’t seen still shows as “Enemy 1”)</span>
        </span>
      </label>
      <label className="row small">
        <input type="checkbox" checked={!share.noMusic} onChange={(e) => set('noMusic', !e.target.checked)} />
        Show what music is playing
      </label>
      <label className="row small">
        <input type="checkbox" checked={!!share.rolls} onChange={(e) => set('rolls', e.target.checked)} />
        Players see my dice rolls
      </label>
      {theirs.length > 0 ? (
        <>
          <h3 className="small">Players’ rolls</h3>
          <RollLog rolls={theirs} limit={6} />
        </>
      ) : (
        <p className="muted small">Players’ rolls show up here as they make them.</p>
      )}
    </LecternPanel>
  )
}

/** The party at a glance (the details the GM picked), with inspiration to hand out. */
function Party({ world, entities, campaignId }: { world: World; entities: Entity[]; campaignId: string }) {
  const party = partyOf(entities, campaignId)
  if (!party.length) return null
  const give = (e: Entity, n: number) => db.entities.update(e.id, { inspiration: Math.max(0, (e.inspiration ?? 0) + n) || undefined, updatedAt: Date.now() })
  return (
    <LecternPanel id="party" name="The party" keywords="characters pcs inspiration players ac perception glance" title={<><Ico as={Shield} /> The party <Help topic="inspiration" /></>}>
      <PartyGlance
        world={world}
        party={party}
        extra={(e) => (
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
        )}
      />
    </LecternPanel>
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
    <LecternPanel id="timers" name="Timers" keywords="countdown clock minutes" title={<><Ico as={Timer} /> Timers <Help topic="timers" /></>}>
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
      {shared && timers.length > 0 && <p className="muted small">While you’re live, players see timers in their Common Room unless you hide them.</p>}
    </LecternPanel>
  )
}

/** Asks the shortcut list to open (from the keyboard button). */
const SHOW_KEYS = 'lectern-show-keys'

/** Shown to the GM on phones while a fight is on: the round, whose turn, and the buttons, always in reach. */
function FightBar({ lectern, edit }: PanelProps) {
  const { round, activeId } = lectern.combat
  const turn = lectern.combat.combatants.find((c) => c.id === activeId)
  if (!turn) return null
  const jump = () => {
    const row = document.querySelector('#lectern-initiative .combatant.active') ?? document.getElementById('lectern-initiative')
    row?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
  return (
    <div className="fight-bar" role="toolbar" aria-label="Combat">
      <button className="ghost" onClick={() => stepTurn(edit, -1)} aria-label="Back a turn" title="Back a turn">
        ◀
      </button>
      <button className="link fight-bar-turn" onClick={jump} title="Show them in the initiative list">
        <span>
          <span className="muted">Round {round} · </span>
          <b>{turn.name}</b>’s turn
        </span>
      </button>
      <Help topic="fightBar" />
      <button className="primary" onClick={() => stepTurn(edit, 1)}>
        Next ▶
      </button>
    </div>
  )
}

const KEYS: [string, string][] = [
  ['N or →', 'Next turn'],
  ['B or ←', 'Back a turn'],
  ['D', 'Roll a d20'],
  ['?', 'Show or hide this list'],
]

/**
 * Keyboard shortcuts for running a fight, ignored while typing in a box or with Ctrl, Alt or ⌘
 * held. Next and Back only work once combat has started, so a stray key can't start a fight
 * (and show it to players). Rolls made from the keyboard pop up briefly, since the dice may be
 * off screen.
 */
function LecternKeys({ lectern, edit, shareTo }: PanelProps & { shareTo?: string }) {
  const [sheet, setSheet] = useState(false)
  const [toast, setToast] = useState<{ text: string; crit?: string; at: number }>()
  const latest = useRef({ lectern, edit, shareTo })
  useEffect(() => {
    latest.current = { lectern, edit, shareTo }
  })
  useEffect(() => {
    const show = (text: string, crit?: string) => setToast({ text, crit, at: Date.now() })
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || e.defaultPrevented) return
      const el = e.target as HTMLElement | null
      if (el?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return
      const { lectern: l, edit: change, shareTo: to } = latest.current
      const key = e.key
      if (key === '?') {
        e.preventDefault()
        return setSheet((x) => !x)
      }
      if (key === 'Escape') return setSheet(false)
      if (e.shiftKey) return
      const next = key === 'n' || key === 'N' || key === 'ArrowRight'
      if (next || key === 'b' || key === 'B' || key === 'ArrowLeft') {
        e.preventDefault()
        if (!l.combat.activeId) return show('No fight running yet. Press “Start combat” first.')
        void stepTurn(change, next ? 1 : -1)
      } else if (key === 'd' || key === 'D') {
        e.preventDefault()
        const r = rollOnLectern(change, 'd20', to)
        show(`d20: ${r.total}`, r.crit)
      }
    }
    const open = () => setSheet(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener(SHOW_KEYS, open)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(SHOW_KEYS, open)
    }
  }, [])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(undefined), 2500)
    return () => clearTimeout(t)
  }, [toast])
  return (
    <>
      {toast && (
        <div key={toast.at} className={`lectern-toast ${toast.crit ?? ''}`} role="status">
          {toast.text}
        </div>
      )}
      {sheet && (
        <div className="lectern-keys card" role="dialog" aria-label="Keyboard shortcuts">
          <div className="row spread">
            <h3>
              <Ico as={Keyboard} /> Keyboard shortcuts <Help topic="lecternKeys" />
            </h3>
            <button className="ghost small" onClick={() => setSheet(false)} aria-label="Close">
              ✕
            </button>
          </div>
          <dl>
            {KEYS.map(([k, what]) => (
              <div key={k}>
                <dt>
                  <kbd>{k}</kbd>
                </dt>
                <dd>{what}</dd>
              </div>
            ))}
          </dl>
          <p className="muted small">Not while you’re typing in a box. Next and Back work once combat has started.</p>
        </div>
      )}
    </>
  )
}
