import { ReadAloud } from '../ai/ReadAloud'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { type Campaign, type Entity, type World } from '../db'
import { Help, type HelpTopic } from '../help'
import { useAssetUrl, useVisibleEntities } from '../hooks'
import { Markdown, splitSecrets, stripSecrets } from '../Markdown'
import { useCharacterOwners } from '../players/owners'
import { addToPartyNotes, MyNote, NotesText, PlayerNotesBox } from '../players/Notes'
import { MyNewCharacters } from '../players/NewCharacters'
import { ChooseCharacter, EditMyCharacter } from '../players/Characters'
import { SessionScheduler, showDate } from '../players/Schedule'
import { AskForm, pageLink, QuestionList } from '../players/Questions'
import { LeadRow, LeadsView } from '../players/Leads'
import { lastTime, liveSeenAt, markLiveSeen, nextSession, roomStage, type NextSession, type RoomStage } from '../players/roomStage'
import { plainLinks, initials } from '../text'
import { useCampaigns, useWorldSessions } from '../threads'
import { partyOf } from '../sessions'
import { StatusBadge } from '../status'
import { formatDate } from '../calendar'
import { hasSafety, openLeads, partyLoot, quantityLabel, useVisibleHandouts } from '../counts'
import { ShowingView } from '../showing'
import { XCardButton } from './Safety'
import { SignalButtons, TableDice, TimerList, TurnOrder, useMe } from '../atTheTable'
import { gmIdOf, localIdOf, sendSignal, useTable, type TableState } from '../cloud/table'
import { characterNames, useViewMode } from '../viewMode'
import { Ico } from '../icons'
import {
  Backpack,
  BookOpenText,
  CalendarBlank,
  CastleTurret,
  ChatCircleDots,
  Coins,
  HandPalm,
  Hourglass,
  Lock,
  MusicNotes,
  Newspaper,
  Notepad,
  Question,
  Scroll,
  Shield,
  Sparkle,
  Spiral,
  Sword,
  Television,
  UsersThree,
} from '@phosphor-icons/react'
import { pagePath, worldPath } from '../paths'
import { PlayerDowntime } from '../players/Downtime'
import { Highlights, StorySoFar } from '../highlights'

/**
 * The Common Room: the players' home in a world, made for a phone in one hand. Its tabs (Now, Me,
 * Party, Leads, Notes) are in the world's frame (src/nav.ts); on a phone they're the bottom bar,
 * with Notes inside Me.
 *
 * Now answers what every player asks first, in this order: when do we play next, what happened last
 * time, what are we doing. It changes with the stage (src/players/roomStage.ts): while the GM runs
 * a session live, the scene, whose turn it is, dice and the X-card come first; just after a game
 * night, the recap does.
 */

const TABS = ['now', 'me', 'party', 'leads', 'notes'] as const
type Tab = (typeof TABS)[number]

export default function CommonRoom({ world }: { world: World }) {
  const worldId = world.id
  const memberOf = world.shared?.memberOf
  // The GM previewing their own synced world sees the live table their Lectern is sending.
  const cloudId = memberOf ?? (!world.shared && world.cloud?.enabled ? world.id : undefined)
  const { previewAs } = useViewMode()
  const { table: anyTable } = useTable(cloudId)
  const entities = useVisibleEntities(worldId)
  const sessions = useWorldSessions(worldId)
  const allCampaigns = useCampaigns(worldId)
  const { owners } = useCharacterOwners(world)
  const me = useMe(world)
  const [params] = useSearchParams()
  // Old addresses: the overview and the scene are both Now.
  const tab: Tab = TABS.find((t) => t === params.get('tab')) ?? 'now'

  // Your characters: the ones you play, or (previewing as a player) theirs.
  const mine = memberOf
    ? me.characters.map((c) => entities.find((e) => e.id === c.id) ?? c)
    : entities.filter((e) => e.type === 'pc' && previewAs?.characterNames.some((n) => n.toLowerCase() === e.name.toLowerCase()))
  const mineIds = new Set(mine.map((c) => gmIdOf(c.id)))
  const who = memberOf ? me.who : mine.length ? mine.map((c) => c.name.split(' ')[0]).join(' & ') : 'You'
  // A world with several groups: another campaign's session isn't yours to see as "playing now".
  // (One in a campaign the GM keeps hidden comes with no campaign: it's for players whose campaign they can't see.)
  const ours = (campaignId?: string) =>
    !campaignId || (anyTable!.session.campaignId ? gmIdOf(campaignId) === anyTable!.session.campaignId : !allCampaigns.some((k) => k.id === campaignId))
  const table = anyTable && (!mine.length || mine.some((c) => ours(c.campaignId))) ? anyTable : null

  // The campaigns that matter to this player: the one being played, else their characters', else all they can see.
  const liveCampaign = table ? allCampaigns.find((c) => gmIdOf(c.id) === table.session.campaignId) : undefined
  const theirs = allCampaigns.filter((c) => mine.some((m) => m.campaignId === c.id))
  const campaigns = liveCampaign ? [liveCampaign] : theirs.length ? theirs : allCampaigns
  const next = nextSession(campaigns, sessions)
  const ids = new Set(campaigns.map((c) => c.id))
  const last = lastTime(sessions.filter((s) => !ids.size || ids.has(s.campaignId)))
  const campaign = liveCampaign ?? (next.kind === 'booked' || next.kind === 'poll' ? next.campaign : undefined) ?? campaigns.find((c) => c.id === last?.campaignId) ?? campaigns[0]

  // "Just played": remembered on this device from the live link, for the day and a half after.
  const live = !!table
  useEffect(() => {
    if (live) markLiveSeen(worldId)
  }, [live, worldId, table])
  const stage = roomStage({ live, next, last, liveSeenAt: liveSeenAt(worldId) })

  const party = partyOf(entities, campaign?.id)
  const ctx: RoomContext = { world, worldId, memberOf, cloudId, table, entities, mine, mineIds, who, party, owners, campaign, campaigns, sessions, next, last, stage, previewNames: memberOf ? [] : (previewAs?.characterNames ?? []) }

  return (
    <div className={`page common-room stage-${stage}`}>
      {tab === 'now' && <NowTab ctx={ctx} />}
      {tab === 'me' && <MeTab ctx={ctx} />}
      {tab === 'party' && <PartyTab ctx={ctx} />}
      {tab === 'leads' && <LeadsTab ctx={ctx} />}
      {tab === 'notes' && <NotesTab ctx={ctx} />}
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
  /** The name your rolls and notes are signed with. */
  who: string
  party: Entity[]
  owners: Map<string, { name: string; mine: boolean; pending?: boolean }>
  campaign?: Campaign
  campaigns: Campaign[]
  sessions: ReturnType<typeof useWorldSessions>
  next: NextSession
  last?: ReturnType<typeof useWorldSessions>[number]
  stage: RoomStage
  /** Previewing as one player: their characters' names. */
  previewNames: string[]
}

const roomLink = (worldId: string, tab: Tab) => (tab === 'now' ? worldPath(worldId) : `${worldPath(worldId)}?tab=${tab}`)

/** "in 2 hours", "tomorrow", "in 3 days" (counted in days on the calendar, so Saturday evening is "in 3 days" all Wednesday). */
function until(t: number) {
  const ms = t - Date.now()
  if (ms <= 15 * 60_000) return 'starting now'
  const h = ms / 3_600_000
  if (h < 1) return `in ${Math.round(ms / 60_000)} minutes`
  const days = Math.round((new Date(t).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000)
  if (days < 1) return `in ${Math.round(h)} hour${Math.round(h) === 1 ? '' : 's'}`
  return days === 1 ? 'tomorrow' : `in ${days} days`
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

/** A session's name as players know it: "Session 3: The Ford", without saying "Session 3" twice. */
const sessionName = (s: { number: number; title: string }) => (/^session \d+$/i.test(s.title.trim()) ? s.title : `Session ${s.number}: ${s.title}`)

/** A tab's heading, with its help tip and anything that goes on the right. */
function TabHead({ title, help, children }: { title: ReactNode; help: HelpTopic; children?: ReactNode }) {
  return (
    <header className="room-head">
      <h1>
        {title} <Help topic={help} />
      </h1>
      {children}
    </header>
  )
}

function Card({ title, icon, to, more, className = '', children, help }: { title: string; icon?: Parameters<typeof Ico>[0]['as']; to?: string; more?: string; className?: string; children: ReactNode; help?: HelpTopic }) {
  return (
    <section className={`card room-card ${className}`}>
      <div className="room-card-head">
        <h2>
          {icon && <Ico as={icon} />} {title} {help && <Help topic={help} />}
        </h2>
        {to && (
          <Link className="room-more" to={to}>
            {more ?? 'Open'}
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

// ——— Now ———

function NowTab({ ctx }: { ctx: RoomContext }) {
  const { world, worldId, stage, campaign, memberOf } = ctx
  const voting = ctx.campaigns.filter((c) => c.schedule?.length)
  const today = world.calendar?.today ? formatDate(world.calendar, world.calendar.today) : ''
  const scheduler = voting.length > 0 && (
    <div id="when" className="room-when">
      {voting.map((c) => (
        <SessionScheduler key={c.id} world={world} campaign={c} isGM={false} onBook={async () => {}} heading={voting.length > 1 ? `Next session: ${c.name}` : 'When can you play?'} />
      ))}
    </div>
  )
  const showing = world.showing ? <OnTheTable world={world} entities={ctx.entities} big={stage === 'during'} /> : null

  return (
    <>
      <TabHead title={stage === 'during' ? 'Playing now' : stage === 'after' ? 'After the game' : 'Before next session'} help="roomNow">
        <span className="room-sub muted small">
          {campaign?.name}
          {today && <span className="phone-only">{`${campaign ? ' · ' : ''}${today}`}</span>}
        </span>
      </TabHead>
      {stage === 'during' && (
        <>
          <LiveTable ctx={ctx} />
          {showing}
        </>
      )}
      <div className="room-now">
        <div className="room-main">
          {stage === 'after' && <LastTimeFull ctx={ctx} />}
          {stage !== 'during' && showing}
          <Answers ctx={ctx} />
          {stage !== 'during' && scheduler}
          <DoingCard ctx={ctx} />
          {stage === 'after' && <AfterLoot ctx={ctx} />}
          {stage === 'after' && memberOf && (
            <Card title="Party notes" icon={Notepad} to={roomLink(worldId, 'notes')} more="All notes">
              <PartyNotesPeek ctx={ctx} />
            </Card>
          )}
        </div>
        <aside className="room-side">
          <YouCard ctx={ctx} />
          {stage !== 'during' && memberOf && <TellYourGm ctx={ctx} />}
        </aside>
      </div>
      {stage === 'during' && scheduler}
      {ctx.party.length > 0 && <PartyStrip ctx={ctx} />}
      {campaign && stage === 'before' && <StoryCard ctx={ctx} campaign={campaign} />}
      <RoomFoot ctx={ctx} />
    </>
  )
}

/** The three answers: when we play next, what happened last time (and, with no recap yet, saying so). */
function Answers({ ctx }: { ctx: RoomContext }) {
  const { next, last, worldId, stage, memberOf } = ctx
  const scrollToWhen = () => document.getElementById('when')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  return (
    <section className="card room-answers" aria-label="Next session and last time">
      <div className="answer-row">
        <span className={`stage-chip ${next.kind === 'unset' ? 'warn' : ''}`}>
          <Ico as={CalendarBlank} /> Next session
        </span>
        <div className="answer-text">
          {next.kind === 'booked' ? (
            <>
              <b>{showDate(next.at)}</b> <span className="muted small">· {until(next.time)}</span>
              {next.at.note && <div className="muted small">{next.at.note}</div>}
            </>
          ) : next.kind === 'dated' ? (
            <>
              <b>{new Date(next.time).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</b>{' '}
              <span className="muted small">· {sessionName(next.session)}</span>
            </>
          ) : next.kind === 'poll' ? (
            <>
              <b>Not booked yet</b>{' '}
              <span className="muted small">
                · your GM suggested {next.count === 1 ? 'a date' : `${next.count} dates`}
              </span>
            </>
          ) : (
            <>
              <b>Not set yet</b> <span className="muted small">· your GM hasn’t picked a date</span>
            </>
          )}
        </div>
        {next.kind === 'poll' && (
          <button className="small answer-action" onClick={scrollToWhen}>
            {memberOf ? 'Say when you’re free' : 'See the dates'}
          </button>
        )}
      </div>
      {stage !== 'after' && (
        <div className="answer-row">
          <span className="stage-chip">
            <Ico as={Scroll} /> Last time
          </span>
          <div className="answer-text">
            {last ? (
              <>
                <b>{sessionName(last)}</b>
                <div className="recap-short">
                  <Markdown text={last.recap} entities={ctx.entities} worldId={worldId} showSecrets={false} />
                </div>
                <Link className="answer-link" to={`${worldPath(worldId)}/s/${last.id}`}>
                  Read it all
                </Link>
              </>
            ) : (
              <span className="muted">Nothing yet. Your GM’s write-up of each session lands here.</span>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

/** Just after a game night: the recap, in full, first. */
function LastTimeFull({ ctx }: { ctx: RoomContext }) {
  const { last, worldId, entities, sessions, table } = ctx
  // A session played after the newest recap: the write-up isn't in yet.
  const newer = !last || (!!table && table.session.number > last.number)
  return (
    <section className="card room-card room-recap">
      <div className="room-card-head">
        <h2>
          <Ico as={Scroll} /> Last time
        </h2>
        {last && <ReadAloud text={last.recap} id={`room-${last.id}`} />}
      </div>
      {last && !newer ? (
        <>
          <div className="muted small">{sessionName(last)}</div>
          <div className="recap-peek">
            <Markdown text={last.recap} entities={entities} worldId={worldId} showSecrets={false} />
          </div>
          <Link className="answer-link" to={`${worldPath(worldId)}/s/${last.id}`}>
            Read it all
          </Link>
          <Highlights session={sessions.find((s) => s.id === last.id)!} entities={entities} worldId={worldId} isGM={false} />
        </>
      ) : (
        <p className="muted">Your GM hasn’t written up the last session yet. Their recap lands here.</p>
      )}
    </section>
  )
}

/** What we're doing: the leads under way first, three of them, and how many more there are. */
function DoingCard({ ctx }: { ctx: RoomContext }) {
  const { entities, worldId } = ctx
  const leads = openLeads(entities)
  return (
    <Card title="What we’re doing" icon={Spiral} to={leads.length ? roomLink(worldId, 'leads') : undefined} more={leads.length > 3 ? `All ${leads.length} leads` : 'Leads'} className="room-doing">
      {leads.length ? (
        <ul className="lead-list">
          {leads.slice(0, 3).map((e) => (
            <LeadRow key={e.id} e={e} worldId={worldId} />
          ))}
        </ul>
      ) : (
        <p className="muted small">No open leads yet. When your GM shares a quest or a rumour, it shows here.</p>
      )}
    </Card>
  )
}

/** After a game night: what the party carries now (the purse is on the Party tab). */
function AfterLoot({ ctx }: { ctx: RoomContext }) {
  const { items } = partyLoot(ctx.entities, ctx.world)
  if (!items.length) return null
  const newest = [...items].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3)
  return (
    <Card title="Loot" icon={Backpack} to={roomLink(ctx.worldId, 'party')} more="Who carries what">
      <p className="small">
        The party carries {items.length} thing{items.length === 1 ? '' : 's'}. Lately:{' '}
        {newest.map((i, n) => (
          <span key={i.id}>
            {n > 0 && ', '}
            <Link to={pagePath(ctx.worldId, i.id)}>{i.name}</Link>
          </span>
        ))}
        .
      </p>
    </Card>
  )
}

/** While the GM runs a session live: where we are, the music, timers, whose turn, then dice and a word to the GM. */
function LiveTable({ ctx }: { ctx: RoomContext }) {
  const { table, world, memberOf, cloudId, entities } = ctx
  const t = table!
  const sceneId = t.scene?.entityId && localIdOf(memberOf, t.scene.entityId)
  const scenePage = sceneId ? entities.find((e) => e.id === sceneId) : undefined
  const turn = t.combat?.order.find((x) => x.id === t.combat?.turnId)
  const yours = !!turn?.entityId && ctx.mineIds.has(turn.entityId)
  return (
    <>
      <section className={`card room-card room-live ${yours ? 'yours' : ''}`}>
        <div className="room-card-head">
          <span className="stage-chip good">
            <span className="live-dot" /> Playing now
          </span>
          <span className="muted small">{sessionName(t.session)}</span>
        </div>
        <h2 className="room-scene">
          <Ico as={CastleTurret} /> {scenePage ? <Link to={pagePath(world.id, scenePage.id)}>{scenePage.name}</Link> : (t.scene?.name ?? 'Your GM is setting the scene')}
        </h2>
        {scenePage?.summary && <p>{plainLinks(scenePage.summary)}</p>}
        {t.music && (
          <p className="small">
            <Ico as={MusicNotes} /> {t.music.join(', ')}
          </p>
        )}
        {t.timers && <TimerList timers={t.timers} />}
        {turn && (
          <p className={`room-turn ${yours ? 'yours' : ''}`}>
            <Ico as={Sword} /> {yours ? <b>Your turn!</b> : <>{turn.name}’s turn</>} <span className="muted small">· round {t.combat!.round}</span>
          </p>
        )}
        {t.combat ? <TurnOrder combat={t.combat} mine={ctx.mineIds} /> : <p className="muted small">No fight on right now.</p>}
      </section>
      <div className="room-live-tools">
        <Card title="Dice" icon={Sparkle} help="tableDice">
          <TableDice cloudId={memberOf ? cloudId : undefined} who={ctx.who} />
        </Card>
        <Card title="Tell your GM" icon={ChatCircleDots} help="tableSignals">
          <SignalButtons cloudId={memberOf ? cloudId : undefined} who={ctx.who} />
          {memberOf && world.safety?.xcard && <XCardButton cloudId={memberOf} />}
          {memberOf && (
            <Link className="room-more" to={`${worldPath(world.id)}/questions`}>
              Ask your GM something privately
            </Link>
          )}
        </Card>
      </div>
    </>
  )
}

/** What the GM is showing now, and a way to the handouts from before. Only there when something is shown. */
function OnTheTable({ world, entities, big }: { world: World; entities: Entity[]; big?: boolean }) {
  const showing = world.showing!
  const earlier = useVisibleHandouts(world, entities).filter((h) => h.id !== showing.id).length
  return (
    <section className="card room-card on-the-table">
      <div className="room-card-head">
        <h2>
          <Ico as={Television} /> On the table now
        </h2>
        <span className="muted small">Shown {ago(showing.at)}</span>
      </div>
      <div className="handout-paper">
        <div className="handout-title">{showing.title}</div>
        <ShowingView showing={showing} worldId={world.id} big={big} />
      </div>
      {earlier > 0 && (
        <Link className="small" to={`${worldPath(world.id)}/handouts`}>
          Earlier handouts ({earlier})
        </Link>
      )}
    </section>
  )
}

/** Up to three numbers worth seeing at a glance: armour, hit points, level or class first. */
function keyNumbers(c: Entity) {
  const facts = c.fields.filter((f) => !f.gm && f.key.trim() && f.value.trim())
  const want = [/^(ac|armou?r)/i, /^(hp|hit points|health)/i, /^(level|lvl)/i, /^class/i]
  const picked = want.flatMap((re) => facts.filter((f) => re.test(f.key.trim())).slice(0, 1))
  for (const f of facts) if (picked.length < 3 && !picked.includes(f)) picked.push(f)
  return picked.slice(0, 3)
}

/** You: your character at a glance, or how to get one. */
function YouCard({ ctx }: { ctx: RoomContext }) {
  const { mine, worldId, entities } = ctx
  const c = mine[0]
  if (!c)
    return (
      <Card title="You" icon={Shield} to={roomLink(worldId, 'me')} more="Me">
        <NoCharacter ctx={ctx} />
      </Card>
    )
  const secrets = onlyYouKnow(entities, ctx.previewNames).length + entities.filter((e) => e.secretForYou).length
  return (
    <Card title="You" icon={Shield} to={roomLink(worldId, 'me')} more="Your character">
      <CharacterHead ctx={ctx} c={c} />
      <NumberTiles c={c} />
      {secrets > 0 && (
        <Link className="secret-chip small" to={roomLink(worldId, 'me')}>
          <Ico as={Lock} /> {secrets === 1 ? '1 secret just for you' : `${secrets} secrets just for you`}
        </Link>
      )}
      {mine.length > 1 && <p className="small muted">Also playing: {mine.slice(1).map((x) => x.name).join(', ')}</p>}
    </Card>
  )
}

function NumberTiles({ c }: { c: Entity }) {
  const tiles = keyNumbers(c)
  if (!tiles.length) return null
  return (
    <dl className="number-tiles">
      {tiles.map((f, i) => (
        <div key={i}>
          <dt>{f.key}</dt>
          <dd>{plainLinks(f.value)}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Ask a question or say what you do between sessions: both just between you and your GM. */
function TellYourGm({ ctx }: { ctx: RoomContext }) {
  return (
    <Card title="Tell your GM" icon={ChatCircleDots}>
      <div className="row two-buttons">
        <Link className="button" to={`${worldPath(ctx.worldId)}/questions`}>
          <Ico as={Question} /> Ask a question
        </Link>
        {ctx.mine.length > 0 && (
          <Link className="button" to={`${roomLink(ctx.worldId, 'notes')}#downtime`}>
            <Ico as={Hourglass} /> Downtime
          </Link>
        )}
      </div>
    </Card>
  )
}

/** The party in one line: faces and first names, to the Party tab. */
function PartyStrip({ ctx }: { ctx: RoomContext }) {
  return (
    <section className="card room-card party-strip">
      <div className="room-card-head">
        <h2>
          <Ico as={UsersThree} /> The party
        </h2>
        <Link className="room-more" to={roomLink(ctx.worldId, 'party')}>
          Who carries what
        </Link>
      </div>
      <ul className="party-faces">
        {ctx.party.map((e) => (
          <li key={e.id}>
            <Link to={pagePath(ctx.worldId, e.id)}>
              <Avatar e={e} size={36} />
              <span>
                {e.name.split(' ')[0]}
                {ctx.mineIds.has(gmIdOf(e.id)) && <small className="muted"> (you)</small>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function StoryCard({ ctx, campaign }: { ctx: RoomContext; campaign: Campaign }) {
  const { world, sessions, entities } = ctx
  if (!campaign.storySoFar?.trim() && sessions.filter((s) => s.campaignId === campaign.id && s.recap.trim()).length < 2) return null
  return (
    <Card title="The story so far" icon={BookOpenText} help="storySoFar" className="room-story">
      <StorySoFar world={world} campaign={campaign} sessions={sessions} entities={entities} isGM={false} compact />
    </Card>
  )
}

/** The foot of Now: table rules, handouts, past sessions. */
function RoomFoot({ ctx }: { ctx: RoomContext }) {
  const { world, worldId, campaign } = ctx
  const handouts = useVisibleHandouts(world, ctx.entities).length
  return (
    <nav className="room-foot" aria-label="More in the Common Room">
      {hasSafety(world) && !world.shared?.token && (
        <Link to={`${worldPath(worldId)}/safety`}>
          <Ico as={HandPalm} /> Table rules
        </Link>
      )}
      {handouts > 0 && (
        <Link to={`${worldPath(worldId)}/handouts`}>
          <Ico as={Newspaper} /> Handouts ({handouts})
        </Link>
      )}
      {campaign && (
        <Link to={`${worldPath(worldId)}/c/${campaign.id}`}>
          <Ico as={Scroll} /> Past sessions
        </Link>
      )}
      {/* Live, the X-card is in the session's own card. */}
      {ctx.memberOf && world.safety?.xcard && ctx.stage !== 'during' && <XCardButton cloudId={ctx.memberOf} small />}
    </nav>
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

/**
 * Passages written just for this player (":::for" their character), wherever they are. A player's
 * copy has them already picked out by the server; the GM previewing as a player matches them here.
 */
function onlyYouKnow(entities: Entity[], previewNames: string[] = []) {
  const names = new Set(characterNames(previewNames))
  return entities.flatMap((e) =>
    [e.body, e.playerBody ?? '']
      .flatMap((t) => splitSecrets(t))
      .filter((seg) => (seg.kind === 'foryou' || (seg.kind === 'for' && seg.names.some((n) => names.has(n.toLowerCase())))) && seg.body.trim())
      .map((seg) => ({ page: e, text: stripSecrets(seg.body).trim() }))
      .filter((x) => x.text),
  )
}

/** A character's picture, name, one-line summary and inspiration. */
function CharacterHead({ ctx, c, big }: { ctx: RoomContext; c: Entity; big?: boolean }) {
  const { worldId, memberOf, cloudId } = ctx
  const [asked, setAsked] = useState('')
  return (
    <div className="room-character">
      <div className="row">
        <Avatar e={c} size={big ? 88 : 56} />
        <div>
          <Link className="room-name" to={pagePath(worldId, c.id)}>
            {c.name}
          </Link>
          <div className="muted small">
            {plainLinks(c.summary)} <StatusBadge entity={c} showAlive />
          </div>
        </div>
      </div>
      {(!!c.inspiration || big) && (
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
      )}
    </div>
  )
}

function NoCharacter({ ctx }: { ctx: RoomContext }) {
  const { memberOf, owners, worldId } = ctx
  const pending = [...owners.values()].some((o) => o.mine && o.pending)
  if (memberOf)
    return pending ? (
      <p className="muted small">You’ve asked to play a character. Once your GM approves it, it shows here.</p>
    ) : (
      <>
        <p className="muted small">Which character are you playing? Pick yours and your GM approves it.</p>
        <Link className="button" to={roomLink(worldId, 'me')}>
          <Ico as={Shield} /> Choose your character
        </Link>
      </>
    )
  return <p className="muted small">Previewing as every player, so there’s no “you” here. Choose a character in the Player view bar above to see the Common Room as them.</p>
}

// ——— Me ———

function MeTab({ ctx }: { ctx: RoomContext }) {
  const { world, worldId, memberOf, mine, entities } = ctx
  if (!mine.length)
    return (
      <>
        <TabHead title="Me" help="roomMe" />
        {memberOf ? (
          <section className="card room-card">
            <ChooseCharacter world={world} />
          </section>
        ) : (
          <section className="card room-card">
            <NoCharacter ctx={ctx} />
          </section>
        )}
        {memberOf && (
          <section className="card room-card">
            <h2 className="room-card-title">My private notes</h2>
            <MyNote world={world} entityId="" placeholder="Anything you want to remember. Only you can see this." />
          </section>
        )}
      </>
    )
  const revealed = entities.filter((e) => e.secretForYou)
  const secrets = onlyYouKnow(entities, ctx.previewNames)
  return (
    <>
      <TabHead title="Me" help="roomMe" />
      {mine.map((c) => {
        // The rest of the sheet, without the numbers already in the tiles.
        const tiles = keyNumbers(c)
        const facts = c.fields.filter((f) => !f.gm && f.value.trim() && !tiles.includes(f))
        const items = entities.filter((e) => e.type === 'item' && e.heldBy === c.id)
        const owned = ctx.owners.get(c.id)
        return (
          <section key={c.id} className="card room-card room-me">
            <CharacterHead ctx={ctx} c={c} big />
            <NumberTiles c={c} />
            <div className="row wrap me-actions">
              {memberOf && owned?.mine && !owned.pending && <EditMyCharacter entity={c} cloudId={memberOf} system={world.system} />}
              <Link className="button" to={pagePath(worldId, c.id)}>
                <Ico as={BookOpenText} /> {memberOf ? 'My character’s page' : 'Their page'}
              </Link>
            </div>
            {facts.length > 0 && (
              <dl className="room-facts">
                {facts.map((f, i) => (
                  <div key={i}>
                    <dt>{f.key}</dt>
                    <dd>{plainLinks(f.value)}</dd>
                  </div>
                ))}
              </dl>
            )}
            {items.length > 0 && (
              <div className="small">
                <span className="muted">Carrying: </span>
                {items.map((e, i) => (
                  <span key={e.id}>
                    {i > 0 && ', '}
                    <Link to={pagePath(worldId, e.id)}>{e.name}</Link>
                    {quantityLabel(e) && ` ${quantityLabel(e)}`}
                  </span>
                ))}
              </div>
            )}
            {memberOf && (
              <>
                <h3 className="small">My notes on {c.name.split(' ')[0]}</h3>
                <MyNote world={world} entityId={c.id} placeholder="Plans, goals, things to bring up…" />
              </>
            )}
          </section>
        )
      })}
      {secrets.length > 0 && (
        <section className="card room-card">
          <h2 className="room-card-title">
            <Ico as={Lock} /> Only you know
          </h2>
          {secrets.map((s, i) => (
            <div key={i} className="secret for-you small">
              <Link to={pagePath(worldId, s.page.id)}>{s.page.name}</Link>
              <Markdown text={s.text} entities={entities} worldId={worldId} showSecrets={false} />
            </div>
          ))}
        </section>
      )}
      {revealed.length > 0 && (
        <section className="card room-card">
          <h2 className="room-card-title">Revealed just to you</h2>
          <ul className="room-list">
            {revealed.map((e) => (
              <li key={e.id}>
                <Link to={pagePath(worldId, e.id)}>{e.name}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {memberOf && (
        <section className="card room-card">
          <h2 className="room-card-title">My private notes</h2>
          <MyNote world={world} entityId="" placeholder="Anything you want to remember. Only you can see this." />
        </section>
      )}
      {memberOf && (
        <section className="card room-card">
          <p className="muted small">Your character died, retired or left? Write up the next one for your GM.</p>
          <MyNewCharacters world={world} />
        </section>
      )}
      <p className="room-foot-note muted small">
        Group notes, questions for your GM and downtime are under <Link to={roomLink(worldId, 'notes')}>Notes</Link>.
      </p>
    </>
  )
}

// ——— Party ———

function PartyTab({ ctx }: { ctx: RoomContext }) {
  const { world, worldId, entities } = ctx
  const loot = partyLoot(entities, world)
  const carried = new Map(loot.members.map((m) => [m.holder.id, m.items]))
  return (
    <>
      <TabHead title="The party" help="roomParty">
        {loot.any && (
          <Link className="room-more" to={`${worldPath(worldId)}/loot`}>
            The full loot list
          </Link>
        )}
      </TabHead>
      {(loot.coin.length > 0 || loot.stash.length > 0) && (
        <section className="card room-card party-shared">
          {loot.coin.length > 0 && (
            <div className="purse">
              <Ico as={Coins} /> <span className="muted">Purse</span> <b>{loot.coin.map((c) => `${c.amount} ${c.name}`).join(' · ')}</b>
            </div>
          )}
          {loot.stash.length > 0 && (
            <div className="small">
              <span className="muted">Party stash: </span>
              <ItemLinks items={loot.stash} worldId={worldId} />
            </div>
          )}
          {!loot.items.length && <span className="muted small">Nobody carries anything yet.</span>}
        </section>
      )}
      {ctx.party.length ? (
        <ul className="party-list">
          {ctx.party.map((e) => {
            const owner = ctx.owners.get(e.id)
            const items = carried.get(e.id) ?? []
            const you = ctx.mineIds.has(gmIdOf(e.id))
            return (
              <li key={e.id} className={`card room-card ${you ? 'you' : ''}`}>
                <div className="row">
                  <Avatar e={e} size={52} />
                  <div className="grow">
                    <Link className="room-name" to={pagePath(worldId, e.id)}>
                      {e.name}
                    </Link>{' '}
                    <StatusBadge entity={e} />
                    {!!e.inspiration && (
                      <span className="inspired small" title="Inspiration">
                        {' '}
                        <Ico as={Sparkle} /> {e.inspiration}
                      </span>
                    )}
                    <div className="muted small clamp-2">
                      {you ? 'You' : owner && !owner.pending ? `Played by ${owner.name}` : ''}
                      {(you || (owner && !owner.pending)) && e.summary ? ' · ' : ''}
                      {plainLinks(e.summary)}
                    </div>
                  </div>
                </div>
                {items.length > 0 && (
                  <div className="small carries">
                    <Ico as={Backpack} /> <ItemLinks items={items} worldId={worldId} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="muted">No player characters revealed yet.</p>
      )}
    </>
  )
}

function ItemLinks({ items, worldId }: { items: Entity[]; worldId: string }) {
  return (
    <>
      {items.map((e, i) => (
        <span key={e.id}>
          {i > 0 && ', '}
          <Link to={pagePath(worldId, e.id)}>{e.name}</Link>
          {quantityLabel(e) && ` ${quantityLabel(e)}`}
        </span>
      ))}
    </>
  )
}

// ——— Leads ———

function LeadsTab({ ctx }: { ctx: RoomContext }) {
  return (
    <>
      <TabHead title="Leads" help="leads" />
      <p className="muted small room-lead-in">What the party knows about and is working on.</p>
      <LeadsView worldId={ctx.worldId} entities={ctx.entities} />
      {!ctx.world.shared && <p className="muted small">Players see the leads, quests and clocks you’ve revealed.</p>}
    </>
  )
}

// ——— Notes ———

function NotesTab({ ctx }: { ctx: RoomContext }) {
  const { world, worldId, memberOf, entities, mine } = ctx
  const questions = world.shared?.questions ?? []
  return (
    <>
      <TabHead title="Notes" help="scratchpad" />
      <section className="card room-card">
        {memberOf || world.cloud?.enabled ? (
          <PlayerNotesBox world={world} entityId="" entities={entities} big start="group" />
        ) : (
          <p className="muted">Group notes are for players who have joined this world: every player can read and add to them.</p>
        )}
      </section>
      <section className="card room-card" id="questions">
        <h2 className="room-card-title">
          <Ico as={Question} /> Questions for your GM <Help topic="questions" />
        </h2>
        {memberOf ? (
          <>
            <AskForm memberOf={memberOf} entityId="" placeholder="Ask your GM anything, just between the two of you…" />
            <QuestionList questions={questions} memberOf={memberOf} pageName={(q) => pageLink(worldId, q.entityId, entities.find((e) => e.id === q.entityId)?.name)} />
          </>
        ) : (
          <p className="muted small">Players ask their GM questions here, just between the two of them.</p>
        )}
      </section>
      <div id="downtime">
        {memberOf && mine.length > 0 ? (
          <PlayerDowntime world={world} mine={mine} />
        ) : (
          <section className="card room-card">
            <h2 className="room-card-title">
              <Ico as={Hourglass} /> Between sessions <Help topic="downtime" />
            </h2>
            <p className="muted small">{memberOf ? 'Once you have a character, tell your GM here what they do between sessions.' : 'Players tell their GM here what their character does between sessions.'}</p>
          </section>
        )}
      </div>
    </>
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
