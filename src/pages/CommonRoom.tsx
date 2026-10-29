import { ReadAloud } from '../ai/ReadAloud'
import { useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Empty } from '../components'
import { type Campaign, type Entity, type World } from '../db'
import { Help } from '../help'
import { useAssetUrl, useVisibleEntities } from '../hooks'
import { Markdown, splitSecrets } from '../Markdown'
import { useCharacterOwners } from '../players/owners'
import { addToPartyNotes, MyNote, NotesText, PlayerNotesBox } from '../players/Notes'
import { MyNewCharacters } from '../players/NewCharacters'
import { SessionScheduler, showDate, upcoming } from '../players/Schedule'
import { searchWorld, useSearchable } from '../search'
import { plainLinks, initials } from '../text'
import { latestSession, useCampaigns, useWorldSessions } from '../threads'
import { partyOf } from '../sessions'
import { StatusBadge } from '../status'
import { WorldToday } from '../calendar'
import { ClockFace, useAllClocks } from '../clocks'
import { ShowingView } from '../showing'
import { XCardButton } from './Safety'
import { SignalButtons, TableDice, TimerInline, TimerList, TurnOrder, useMe } from '../atTheTable'
import { gmIdOf, localIdOf, sendSignal, useTable, type TableState } from '../cloud/table'
import { useViewMode } from '../viewMode'
import { Ico } from '../icons'
import { Backpack, CastleTurret, ChatCircleDots, MusicNotes, Notepad, Scroll, Shield, Sparkle, Spiral, Sword, Television, UsersThree } from '@phosphor-icons/react'
import { pagePath, worldPath } from '../paths'

/**
 * The Common Room: the players' front page for a world, and their seat at the table. Tabs keep it
 * short on a phone: an overview of everything, then the scene, your character, the party, leads
 * and notes in full. While the GM runs a session it also shows the scene, the music and whose turn
 * it is, and players can roll dice everyone sees and quietly signal the GM.
 */

const TABS = [
  { id: 'overview', long: 'Overview', short: 'Overview' },
  { id: 'scene', long: 'The scene', short: 'Scene' },
  { id: 'me', long: 'My character', short: 'Me' },
  { id: 'party', long: 'The party', short: 'Party' },
  { id: 'leads', long: 'Leads and quests', short: 'Leads' },
  { id: 'notes', long: 'Notes', short: 'Notes' },
] as const
type Tab = (typeof TABS)[number]['id']

export default function CommonRoom({ world }: { world: World }) {
  const worldId = world.id
  const memberOf = world.shared?.memberOf
  // The GM previewing their own synced world sees the live table their Lectern is sending.
  const cloudId = memberOf ?? (!world.shared && world.cloud?.enabled ? world.id : undefined)
  const { previewAs } = useViewMode()
  const { table: anyTable } = useTable(cloudId)
  const entities = useVisibleEntities(worldId)
  const sessions = useWorldSessions(worldId)
  const campaigns = useCampaigns(worldId)
  const { owners } = useCharacterOwners(world)
  const me = useMe(world)
  const [params, setParams] = useSearchParams()
  const tab: Tab = TABS.some((t) => t.id === params.get('tab')) ? (params.get('tab') as Tab) : 'overview'
  const go = (t: Tab) => setParams(t === 'overview' ? {} : { tab: t }, { replace: true })

  // Your characters: the ones you play, or (previewing as a player) theirs.
  const mine = memberOf
    ? me.characters.map((c) => entities.find((e) => e.id === c.id) ?? c)
    : entities.filter((e) => e.type === 'pc' && previewAs?.characterNames.some((n) => n.toLowerCase() === e.name.toLowerCase()))
  const mineIds = new Set(mine.map((c) => gmIdOf(c.id)))
  const who = memberOf ? me.who : 'GM'
  // A world with several groups: another campaign's session isn't yours to see as "playing now".
  const table =
    anyTable && (!mine.length || mine.some((c) => !c.campaignId || gmIdOf(c.campaignId) === anyTable.session.campaignId)) ? anyTable : null

  const liveCampaign = table && campaigns.find((c) => gmIdOf(c.id) === table.session.campaignId)
  const campaign = liveCampaign ?? campaigns.find((c) => upcoming(c)) ?? (campaigns.length === 1 ? campaigns[0] : undefined)
  const party = partyOf(entities, campaign?.id)
  const ctx: RoomContext = { world, worldId, memberOf, cloudId, table, entities, mine, mineIds, who, party, owners }

  return (
    <div className="page common-room">
      <RoomHeader world={world} table={table} campaign={campaign} memberOf={memberOf} />
      {table && <LiveStrip ctx={ctx} onScene={() => go('scene')} />}
      <nav className="room-tabs" aria-label="Common Room">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => go(t.id)}>
            <span className="long">{t.long}</span>
            <span className="short">{t.short}</span>
          </button>
        ))}
      </nav>
      {tab === 'overview' && <Overview ctx={ctx} campaigns={campaigns} sessions={sessions} go={go} />}
      {tab === 'scene' && <SceneTab ctx={ctx} />}
      {tab === 'me' && <MeTab ctx={ctx} />}
      {tab === 'party' && <PartyTab ctx={ctx} />}
      {tab === 'leads' && <LeadsTab ctx={ctx} />}
      {tab === 'notes' && (
        <section>
          <h2>
            <Ico as={Notepad} /> Notes <Help topic="scratchpad" />
          </h2>
          {memberOf || world.cloud?.enabled ? (
            <PlayerNotesBox world={world} entityId="" entities={entities} big />
          ) : (
            <Empty>Notes are for players who have joined this world.</Empty>
          )}
        </section>
      )}
    </div>
  )
}

interface RoomContext {
  world: World
  worldId: string
  memberOf?: string
  cloudId?: string
  table: TableState | null
  entities: Entity[]
  mine: Entity[]
  /** The GM's ids of your characters. */
  mineIds: Set<string>
  who: string
  party: Entity[]
  owners: Map<string, { name: string; mine: boolean }>
}

/** "in 3 days", "in 2 hours", "starting now". */
function until(t: number) {
  const ms = t - Date.now()
  if (ms <= 15 * 60_000) return 'starting now'
  const h = ms / 3_600_000
  if (h < 1) return `in ${Math.round(ms / 60_000)} minutes`
  if (h < 36) return `in ${Math.round(h)} hour${Math.round(h) === 1 ? '' : 's'}`
  const d = Math.round(h / 24)
  return `in ${d} day${d === 1 ? '' : 's'}`
}

/** "just now", "5 minutes ago"… */
function ago(t: number) {
  const m = Math.round((Date.now() - t) / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

function RoomHeader({ world, table, campaign, memberOf }: { world: World; table: TableState | null; campaign?: Campaign; memberOf?: string }) {
  const booked = campaign && upcoming(campaign)
  const s = table?.session
  const title = s ? (/^session \d+$/i.test(s.title) ? s.title : `Session ${s.number}: ${s.title}`) : world.name
  return (
    <header className="room-header">
      <div>
        <div className="eyebrow">
          {s ? world.name : 'The Common Room'}
          {campaign && ` · ${campaign.name}`}
        </div>
        <h1>
          {title} <Help topic="commonRoom" />
        </h1>
        <div className="room-status">
          {s ? (
            <span className="playing-now">Playing now</span>
          ) : booked ? (
            <span>
              Next session {showDate(booked)} · <b>{until(new Date(booked.utc ?? booked.at).getTime())}</b>
            </span>
          ) : null}
          <WorldToday world={world} isGM={false} />
        </div>
      </div>
      {memberOf && (
        <div className="row wrap room-actions">
          <Link className="button" to={`${worldPath(world.id)}/questions`}>
            <Ico as={ChatCircleDots} /> Ask the GM
          </Link>
          {world.safety?.xcard && <XCardButton cloudId={memberOf} small />}
        </div>
      )}
    </header>
  )
}

/** One line on what's happening at the table right now. */
function LiveStrip({ ctx, onScene }: { ctx: RoomContext; onScene: () => void }) {
  const t = ctx.table!
  const turn = t.combat?.order.find((x) => x.id === t.combat?.turnId)
  const yours = !!turn?.entityId && ctx.mineIds.has(turn.entityId)
  return (
    <button className={`live-strip ${yours ? 'yours' : ''}`} onClick={onScene} title="Open the scene">
      {t.scene && (
        <span>
          <Ico as={CastleTurret} /> {t.scene.name}
        </span>
      )}
      {t.music && (
        <span>
          <Ico as={MusicNotes} /> {t.music.join(', ')}
        </span>
      )}
      {turn && (
        <span>
          <Ico as={Sword} /> Round {t.combat!.round}: {yours ? <b>your turn</b> : `${turn.name}’s turn`}
        </span>
      )}
      {t.timers && <TimerInline timers={t.timers} />}
      {!t.scene && !t.music && !turn && !t.timers && <span>Your GM is running the session.</span>}
    </button>
  )
}

function Card({ title, icon, to, onOpen, className = '', children, help }: { title: string; icon?: Parameters<typeof Ico>[0]['as']; to?: string; onOpen?: () => void; className?: string; children: ReactNode; help?: Parameters<typeof Help>[0]['topic'] }) {
  return (
    <section className={`card room-card ${className}`}>
      <div className="room-card-head">
        <h2>
          {icon && <Ico as={icon} />} {title} {help && <Help topic={help} />}
        </h2>
        {to ? (
          <Link className="small" to={to}>
            Open
          </Link>
        ) : onOpen ? (
          <button className="link small" onClick={onOpen}>
            Open
          </button>
        ) : null}
      </div>
      {children}
    </section>
  )
}

function Overview({ ctx, campaigns, sessions, go }: { ctx: RoomContext; campaigns: Campaign[]; sessions: ReturnType<typeof useWorldSessions>; go: (t: Tab) => void }) {
  const { world, worldId, entities, memberOf } = ctx
  const [query, setQuery] = useState('')
  const searchable = useSearchable(worldId)
  const results = searchWorld(query, { worldId, world, ...searchable })
  const last = latestSession(sessions.filter((s) => s.recap.trim()))
  const voting = campaigns.filter((c) => c.schedule?.length)
  const leads = openLeads(entities)
  const clocks = useAllClocks(entities).filter(({ clock }) => clock.filled < clock.segments)
  const loot = entities.filter((e) => e.type === 'item' && e.heldBy === 'party')
  const coin = (world.partyCoin ?? []).filter((c) => c.amount)

  return (
    <>
      <input className="search" placeholder="Search what you know…" value={query} onChange={(e) => setQuery(e.target.value)} />
      {query.trim() && (
        <ul className="entity-list">
          {results.map((h) => (
            <li key={h.key}>
              <Link to={h.to}>
                {h.icon} {h.title}
              </Link>
              {h.snippet && <span className="muted"> · {h.snippet}</span>}
            </li>
          ))}
          {results.length === 0 && <li className="muted">Nothing matches.</li>}
        </ul>
      )}
      {voting.map((c) => (
        <SessionScheduler key={c.id} world={world} campaign={c} isGM={false} onBook={async () => {}} />
      ))}
      <div className="room-grid">
        <OnTheTable world={world} className="wide" />
        <Card title="You" icon={Shield} onOpen={() => go('me')}>
          {ctx.mine.length ? <CharacterCard ctx={ctx} c={ctx.mine[0]} /> : <NoCharacter ctx={ctx} />}
          {ctx.mine.length > 1 && (
            <p className="small muted">
              Also playing: {ctx.mine.slice(1).map((c) => c.name).join(', ')}
            </p>
          )}
          {memberOf && <MyNote world={world} entityId="" placeholder="Jot something only you will see…" />}
        </Card>
        <Card title="The party" icon={UsersThree} onOpen={() => go('party')}>
          {ctx.party.length ? <PartyList ctx={ctx} /> : <p className="muted small">No player characters revealed yet.</p>}
        </Card>
        <Card title="Leads and quests" icon={Spiral} onOpen={() => go('leads')}>
          {leads.length ? <LeadList leads={leads.slice(0, 4)} worldId={worldId} /> : <p className="muted small">No open leads yet.</p>}
          {clocks.length > 0 && (
            <div className="room-clocks">
              <div className="muted small">Clocks the party knows about</div>
              {clocks.slice(0, 3).map(({ clock, owner }) => (
                <Link key={clock.id} className="room-clock" to={pagePath(worldId, owner.id)}>
                  <span>{clock.name}</span>
                  <ClockFace clock={clock} size={28} />
                </Link>
              ))}
            </div>
          )}
        </Card>
        {memberOf && (
          <Card title="Party notes" icon={Notepad} onOpen={() => go('notes')}>
            <PartyNotesPeek ctx={ctx} />
          </Card>
        )}
        <Card title="Previously on…" icon={Scroll} className="wide" to={last ? `${worldPath(worldId)}/s/${last.id}` : undefined}>
          {last ? (
            <>
              <div className="row spread muted small">
                <span>
                  #{last.number} {last.title}
                </span>
                <ReadAloud text={last.recap} id={`room-${last.id}`} />
              </div>
              <div className="recap-peek">
                <Markdown text={last.recap} entities={entities} worldId={worldId} showSecrets={false} />
              </div>
            </>
          ) : (
            <p className="muted small">No recaps yet. Your GM’s write-up of each session lands here.</p>
          )}
        </Card>
        {(loot.length > 0 || coin.length > 0) && (
          <Card title="Party loot" icon={Backpack} to={`${worldPath(worldId)}/loot`}>
            {coin.length > 0 && (
              <div className="small">
                Purse: <b>{coin.map((c) => `${c.amount} ${c.name}`).join(', ')}</b>
              </div>
            )}
            <ul className="small room-list">
              {loot.slice(0, 5).map((i) => (
                <li key={i.id}>
                  <Link to={pagePath(worldId, i.id)}>{i.name}</Link>
                  {(i.quantity ?? 1) > 1 && ` ×${i.quantity}`}
                </li>
              ))}
              {loot.length > 5 && <li className="muted">and {loot.length - 5} more</li>}
            </ul>
          </Card>
        )}
      </div>
      {memberOf && (
        <Link className="button block room-ask" to={`${worldPath(worldId)}/questions`}>
          <Ico as={ChatCircleDots} /> Ask the GM privately
        </Link>
      )}
    </>
  )
}

/** What the GM is showing now, and the handouts from before. */
function OnTheTable({ world, className = '', big }: { world: World; className?: string; big?: boolean }) {
  const showing = world.showing
  const earlier = (world.handouts ?? []).filter((h) => h.id !== showing?.id).slice(0, 3)
  return (
    <section className={`card room-card on-the-table ${className}`}>
      <div className="room-card-head">
        <h2>
          <Ico as={Television} /> On the table now
        </h2>
        {showing && <span className="muted small">Shown by the GM {ago(showing.at)}</span>}
      </div>
      {showing ? (
        <div className="handout-paper">
          <div className="handout-title">{showing.title}</div>
          <ShowingView showing={showing} worldId={world.id} big={big} />
        </div>
      ) : (
        <p className="muted small">Nothing right now. When your GM shows a picture, a page or a note, it appears here.</p>
      )}
      {earlier.length > 0 && (
        <div className="row wrap small earlier">
          <span className="muted">Earlier:</span>
          {earlier.map((h) => (
            <Link key={h.id} className="tag" to={`${worldPath(world.id)}/handouts`}>
              {h.title}
            </Link>
          ))}
          <Link to={`${worldPath(world.id)}/handouts`}>All handouts</Link>
        </div>
      )}
    </section>
  )
}

function Avatar({ e, size = 40 }: { e: Entity; size?: number }) {
  const image = useAssetUrl(e.imageId)
  return image ? (
    <img className="avatar" src={image} alt="" style={{ width: size, height: size }} />
  ) : (
    <span className="avatar" aria-hidden="true" style={{ width: size, height: size }}>
      {initials(e.name)}
    </span>
  )
}

/** Passages written just for this player (":::for" their character), wherever they are. */
function onlyYouKnow(entities: Entity[]) {
  return entities.flatMap((e) =>
    [e.body, e.playerBody ?? '']
      .flatMap((t) => splitSecrets(t))
      .filter((seg) => seg.kind === 'foryou' && seg.body.trim())
      .map((seg) => ({ page: e, text: seg.body.trim() })),
  )
}

function CharacterCard({ ctx, c, full }: { ctx: RoomContext; c: Entity; full?: boolean }) {
  const { worldId, entities, memberOf, cloudId } = ctx
  const [asked, setAsked] = useState('')
  const facts = c.fields.filter((f) => !f.gm && f.value.trim())
  const secrets = onlyYouKnow(full ? entities : entities.filter((e) => e.id === c.id || e.secretForYou)).slice(0, full ? 50 : 1)
  const revealed = entities.filter((e) => e.secretForYou)
  const items = entities.filter((e) => e.type === 'item' && e.heldBy === c.id)
  return (
    <div className="room-character">
      <div className="row">
        <Avatar e={c} size={full ? 88 : 64} />
        <div>
          <Link className="room-name" to={pagePath(worldId, c.id)}>
            {c.name}
          </Link>
          <div className="muted small">
            {plainLinks(c.summary)} <StatusBadge entity={c} showAlive />
          </div>
        </div>
      </div>
      <div className="row wrap inspiration-row">
        <span className={c.inspiration ? 'inspired' : 'muted'} title="Inspiration from your GM">
          <Ico as={Sparkle} /> {c.inspiration ? `Inspiration: ${c.inspiration}` : 'No inspiration'}
        </span>
        {memberOf && cloudId && !!c.inspiration && (
          <button
            className="small"
            disabled={!!asked}
            onClick={async () => setAsked((await sendSignal(cloudId, 'inspiration', c.name.split(' ')[0], gmIdOf(c.id))) ? 'Asked your GM.' : 'Couldn’t reach your GM.')}
          >
            Use one
          </button>
        )}
        {asked && <span className="small">{asked}</span>}
        <Help topic="inspiration" />
      </div>
      {facts.length > 0 && (
        <dl className="room-facts">
          {facts.slice(0, full ? undefined : 4).map((f, i) => (
            <div key={i}>
              <dt>{f.key}</dt>
              <dd>{plainLinks(f.value)}</dd>
            </div>
          ))}
        </dl>
      )}
      {secrets.map((s, i) => (
        <div key={i} className="secret for-you small">
          <b>Only you know{s.page.id === c.id ? '' : ` (${s.page.name})`}:</b> {plainLinks(s.text)}{' '}
          <Link to={pagePath(worldId, s.page.id)}>Read</Link>
        </div>
      ))}
      {full && revealed.length > 0 && (
        <div className="small">
          <span className="muted">Revealed just to you: </span>
          {revealed.map((e, i) => (
            <span key={e.id}>
              {i > 0 && ', '}
              <Link to={pagePath(worldId, e.id)}>{e.name}</Link>
            </span>
          ))}
        </div>
      )}
      {full && items.length > 0 && (
        <div className="small">
          <span className="muted">Carrying: </span>
          {items.map((e, i) => (
            <span key={e.id}>
              {i > 0 && ', '}
              <Link to={pagePath(worldId, e.id)}>{e.name}</Link>
              {(e.quantity ?? 1) > 1 && ` ×${e.quantity}`}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function NoCharacter({ ctx }: { ctx: RoomContext }) {
  return (
    <p className="muted small">
      {ctx.memberOf
        ? 'Once your GM approves the character you play, it shows here. Pick yours from the banner at the top.'
        : ctx.world.cloud?.enabled
          ? 'Previewing as a player? Choose one in the yellow banner at the top of the page to see their character here.'
          : 'Invite players in World settings to preview the world as one of them.'}
    </p>
  )
}

function PartyList({ ctx, full }: { ctx: RoomContext; full?: boolean }) {
  return (
    <ul className={`room-party ${full ? 'full' : ''}`}>
      {ctx.party.map((e) => {
        const owner = ctx.owners.get(e.id)
        return (
          <li key={e.id}>
            <Avatar e={e} size={full ? 56 : 36} />
            <div>
              <Link to={pagePath(ctx.worldId, e.id)}>{e.name}</Link> <StatusBadge entity={e} />
              {!!e.inspiration && (
                <span className="inspired small" title="Inspiration">
                  {' '}
                  <Ico as={Sparkle} /> {e.inspiration}
                </span>
              )}
              <div className="muted small">
                {e.summary ? plainLinks(e.summary) : ''}
                {owner && `${e.summary ? ' · ' : ''}${owner.mine ? 'you' : `played by ${owner.name}`}`}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

const openLeads = (entities: Entity[]) => [
  ...entities.filter((e) => e.type === 'quest' && (e.questStatus === 'open' || e.questStatus === 'active')),
  ...entities
    .filter((e) => e.type === 'thread' && (e.threadStatus === 'open' || e.threadStatus === 'active'))
    .sort((a, b) => Number(b.threadUrgency === 'high') - Number(a.threadUrgency === 'high')),
]

function LeadList({ leads, worldId, full }: { leads: Entity[]; worldId: string; full?: boolean }) {
  return (
    <ul className="room-list">
      {leads.map((e) => (
        <li key={e.id}>
          <Link to={pagePath(worldId, e.id)}>{e.name}</Link>
          {e.threadUrgency === 'high' && <span className="pressing small"> · pressing</span>}
          {e.type === 'quest' && <span className="muted small"> · quest{e.questStatus === 'active' ? ', active' : ''}</span>}
          {full && e.summary && <div className="muted small">{plainLinks(e.summary)}</div>}
        </li>
      ))}
    </ul>
  )
}

/** The end of the party's shared notes, and a line to add to them. */
function PartyNotesPeek({ ctx }: { ctx: RoomContext }) {
  const { world, entities, who } = ctx
  const [line, setLine] = useState('')
  const [state, setState] = useState('')
  const body = world.shared?.notes?.find((n) => n.entityId === '' && n.shared)?.body ?? ''
  const lines = body.trim() ? body.trimEnd().split('\n').slice(-6).join('\n') : ''
  return (
    <>
      {lines ? (
        <div className="notes-peek small">
          <NotesText text={lines} entities={entities} worldId={world.id} />
        </div>
      ) : (
        <p className="muted small">Nothing yet. Clues, names, plans: anything the party wants to remember.</p>
      )}
      <form
        className="row"
        onSubmit={async (e) => {
          e.preventDefault()
          const text = line.trim()
          if (!text) return
          setState('Saving…')
          try {
            await addToPartyNotes(world, who, text)
            setLine('')
            setState('')
          } catch {
            setState('Couldn’t save. Check your connection.')
          }
        }}
      >
        <input value={line} onChange={(e) => setLine(e.target.value)} placeholder="Add to the party notes" aria-label="Add to the party notes" maxLength={500} />
        <button disabled={!line.trim()}>Add</button>
      </form>
      {state && <span className="small muted">{state}</span>}
    </>
  )
}

function SceneTab({ ctx }: { ctx: RoomContext }) {
  const { table, world, memberOf, cloudId, entities } = ctx
  const sceneId = table?.scene?.entityId && localIdOf(memberOf, table.scene.entityId)
  const scenePage = sceneId ? entities.find((e) => e.id === sceneId) : undefined
  return (
    <div className="room-scene">
      <div className="room-grid">
        <section className="card room-card wide">
          {table ? (
            <>
              <div className="room-card-head">
                <h2>
                  <Ico as={CastleTurret} /> {scenePage ? <Link to={pagePath(world.id, scenePage.id)}>{scenePage.name}</Link> : (table.scene?.name ?? 'Somewhere')}
                </h2>
                <span className="playing-now small">Playing now</span>
              </div>
              {scenePage?.summary && <p>{plainLinks(scenePage.summary)}</p>}
              {table.music && (
                <p className="small">
                  <Ico as={MusicNotes} /> {table.music.join(', ')}
                </p>
              )}
              {table.timers && <TimerList timers={table.timers} />}
              {table.combat ? <TurnOrder combat={table.combat} mine={ctx.mineIds} /> : <p className="muted small">No fight on right now.</p>}
            </>
          ) : (
            <>
              <h2>
                <Ico as={CastleTurret} /> The scene
              </h2>
              <p className="muted">
                Your GM isn’t running a session right now. When they open the Lectern, where you are, the music and whose turn it is show up here.
              </p>
            </>
          )}
        </section>
        <Card title="Tell your GM" icon={ChatCircleDots} help="tableSignals">
          <SignalButtons cloudId={memberOf ? cloudId : undefined} who={ctx.who} />
        </Card>
        <Card title="Dice" icon={Sparkle} help="tableDice">
          <TableDice cloudId={memberOf ? cloudId : undefined} who={ctx.who} />
        </Card>
        <OnTheTable world={world} className="wide" big />
      </div>
    </div>
  )
}

function MeTab({ ctx }: { ctx: RoomContext }) {
  if (!ctx.mine.length)
    return (
      <>
        <Empty>{ctx.memberOf ? 'Once your GM approves the character you play, it shows here.' : 'Preview as a player to see their character here.'}</Empty>
        <MyNewCharacters world={ctx.world} />
      </>
    )
  return (
    <div className="room-grid">
      {ctx.mine.map((c) => (
        <Card key={c.id} title={c.name} icon={Shield} to={pagePath(ctx.worldId, c.id)} className="wide">
          <CharacterCard ctx={ctx} c={c} full />
          {ctx.memberOf && (
            <>
              <h3 className="small">My notes on {c.name.split(' ')[0]}</h3>
              <MyNote world={ctx.world} entityId={c.id} placeholder="Plans, goals, things to bring up…" />
            </>
          )}
        </Card>
      ))}
      {ctx.memberOf && (
        <section className="card room-card">
          <p className="muted small">Your character died, retired or left? Write up the next one for your GM.</p>
          <MyNewCharacters world={ctx.world} />
        </section>
      )}
    </div>
  )
}

function PartyTab({ ctx }: { ctx: RoomContext }) {
  const { world, worldId, entities } = ctx
  const coin = (world.partyCoin ?? []).filter((c) => c.amount)
  const stash = entities.filter((e) => e.type === 'item' && e.heldBy === 'party')
  return (
    <div className="room-grid">
      <Card title="The party" icon={UsersThree} className="wide">
        {ctx.party.length ? <PartyList ctx={ctx} full /> : <p className="muted small">No player characters revealed yet.</p>}
      </Card>
      <Card title="Party loot" icon={Backpack} to={`${worldPath(worldId)}/loot`}>
        {coin.length > 0 && (
          <div className="small">
            Purse: <b>{coin.map((c) => `${c.amount} ${c.name}`).join(', ')}</b>
          </div>
        )}
        {stash.length ? (
          <ul className="small room-list">
            {stash.map((i) => (
              <li key={i.id}>
                <Link to={pagePath(worldId, i.id)}>{i.name}</Link>
                {(i.quantity ?? 1) > 1 && ` ×${i.quantity}`}
              </li>
            ))}
          </ul>
        ) : (
          !coin.length && <p className="muted small">Nothing in the party’s stash yet.</p>
        )}
      </Card>
    </div>
  )
}

function LeadsTab({ ctx }: { ctx: RoomContext }) {
  const { entities, worldId, world } = ctx
  const leads = openLeads(entities)
  const clocks = useAllClocks(entities).filter(({ clock }) => clock.filled < clock.segments)
  return (
    <div className="room-grid">
      <Card title="Leads and quests" icon={Spiral} to={`${worldPath(worldId)}/threads`} className="wide">
        {leads.length ? <LeadList leads={leads} worldId={worldId} full /> : <p className="muted small">No open leads yet.</p>}
      </Card>
      {clocks.length > 0 && (
        <Card title="Clocks" icon={Sword} to={`${worldPath(worldId)}/clocks`}>
          <div className="room-clocks">
            {clocks.map(({ clock, owner }) => (
              <Link key={clock.id} className="room-clock" to={pagePath(worldId, owner.id)}>
                <span>
                  {clock.name}
                  <small className="muted"> · {owner.name}</small>
                </span>
                <ClockFace clock={clock} size={36} />
              </Link>
            ))}
          </div>
        </Card>
      )}
      {!world.shared && <p className="muted small">Players see the leads, quests and clocks you’ve revealed.</p>}
    </div>
  )
}

