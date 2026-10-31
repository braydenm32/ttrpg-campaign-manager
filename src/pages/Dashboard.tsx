import { Help, HELP } from '../help'
import { WorldCover } from '../WorldCover'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Modal } from '../components'
import { db, ENTITY_LABELS, GAME_SYSTEMS, newId, PICKER_TYPES, typeLabel, type Campaign, type Entity, type Session, type World } from '../db'
import { useCreatePage } from '../NewPage'
import { useAssetUrl, useVisibleEntities, useWorld } from '../hooks'
import { initials } from '../text'
import { nextSessions, useCampaigns, useWorldSessions } from '../threads'
import { WantedPages, wantedPages } from '../wanted'
import { useViewMode } from '../viewMode'
import { BackupButton, useBackupDue } from '../BackupReminder'
import WikiHome from './WikiHome'
import CommonRoom, { ago } from './CommonRoom'
import { showDate, upcoming } from '../players/Schedule'
import { ClockFace } from '../clocks'
import { approveClaimLater } from '../players/inboxActions'
import { ReviewCharacter } from '../players/NewCharacters'
import type { CharacterRequest } from '../cloud/players'
import { useInbox } from '../Sidebar'
import { clockSize, isOpenQuest, isOpenThread, prepCounts, tickingClocks } from '../counts'
import { Ico, TypeIcon } from '../icons'
import {
  CalendarBlank,
  ChatCircleDots,
  CheckCircle,
  Eye,
  FloppyDisk,
  Flame,
  Hourglass,
  ListChecks,
  LockSimple,
  MaskHappy,
  NotePencil,
  Play,
  Plus,
  UserCirclePlus,
  UsersThree,
  FlagCheckered,
  ArrowCounterClockwise,
  type Icon,
} from '@phosphor-icons/react'
import { pagePath, worldPath } from '../paths'
import { createNextSession, isPlayed, localDate, partyOf, sessionStage, startPlaying, type SessionStage } from '../sessions'
import { StageChip, usePlayingNow } from '../stage'
import { detailOf } from '../partyGlance'
import { toast } from '../undo'
import '../desk.css'

/**
 * The GM's Desk, Today tab (`/w/<world>`): what's next and what needs you, laptop first. One strip
 * with the session in hand and the one button for its stage; "Needs you before #N" with everything
 * waiting (the Inbox's items first, the same count as its badge); then clocks, the party, the
 * sessions coming up and what changed lately, each kept short. Players get the Common Room here,
 * and a public wiki link its front page.
 */
export default function Dashboard() {
  const { world } = useWorld()
  const { isGM } = useViewMode()
  if (!world) return null
  // Opened from a public wiki link: a tidy front page for readers instead of the GM's overview.
  if (world.shared?.token) return <WikiHome world={world} />
  // Players (and the GM previewing as one) get the Common Room.
  if (!isGM) return <CommonRoom world={world} />
  return <Today world={world} />
}

/** The session in hand and its campaign, as the Desk and the Session area pick it (see nextSessions). */
type InHand = ReturnType<typeof nextSessions>[number]

function Today({ world }: { world: World }) {
  const worldId = world.id
  const navigate = useNavigate()
  const entities = useVisibleEntities(worldId)
  const campaigns = useCampaigns(worldId)
  const sessions = useWorldSessions(worldId)
  const playing = usePlayingNow(worldId)
  const [newCampaign, setNewCampaign] = useState(false)
  const cards = nextSessions(campaigns, sessions, playing)
  const inHand = cards[0]
  const stage = inHand && sessionStage(inHand.session, playing.includes(inHand.session.id))
  const fresh = entities.length < 3 && campaigns.length === 0

  return (
    <div className="page home-page desk-today">
      <WorldCover world={world} compact>
        <NewPageMenu world={world} />
      </WorldCover>
      {fresh && <GettingStarted world={world} onNewCampaign={() => setNewCampaign(true)} />}
      <SessionStrip world={world} inHand={inHand} stage={stage} campaigns={campaigns} onNewCampaign={() => setNewCampaign(true)} />
      <div className="desk-cols">
        <NeedsYou world={world} entities={entities} sessions={sessions} inHand={inHand} stage={stage} />
        <DeskClocks world={world} entities={entities} />
      </div>
      <div className="desk-cols">
        <DeskParty world={world} entities={entities} campaignId={inHand?.campaign.id ?? campaigns[0]?.id} />
        <ComingUp world={world} campaigns={campaigns} sessions={sessions} playing={playing} onNewCampaign={() => setNewCampaign(true)} />
      </div>
      <RecentlyChanged world={world} entities={entities} />
      <StatLine world={world} entities={entities} sessions={sessions} />
      {newCampaign && (
        <NewCampaign worldId={worldId} defaultSystem={world.system} onClose={() => setNewCampaign(false)} onCreated={(id) => navigate(`${worldPath(worldId)}/c/${id}`)} />
      )}
    </div>
  )
}

/** "New page": one button with every page type, instead of a row of quick-add buttons. */
function NewPageMenu({ world }: { world: World }) {
  const create = useCreatePage(world)
  const [open, setOpen] = useState(false)
  return (
    <span className="menu-wrap new-page-menu">
      <button className="primary" aria-expanded={open} onClick={() => setOpen(!open)} title={HELP.quickAdd}>
        <Ico as={Plus} /> New page
      </button>
      {open && (
        <span className="menu" onMouseLeave={() => setOpen(false)}>
          {PICKER_TYPES.map((t) => (
            <button key={t} onClick={() => create(t)}>
              <TypeIcon type={t} /> {ENTITY_LABELS[t].one}
            </button>
          ))}
          {world.customTypes?.map((c) => (
            <button key={c.id} onClick={() => create('custom', c.id)}>
              <TypeIcon type="custom" custom={c} /> {c.one}
            </button>
          ))}
        </span>
      )}
    </span>
  )
}

/** A session's date in words: the booked time if there is one, else its day, else nothing. */
function whenOf(campaign: Campaign, session: Session) {
  const booked = upcoming(campaign)
  if (booked) return showDate(booked)
  if (!session.date) return ''
  const d = new Date(`${session.date}T12:00`)
  return isNaN(d.getTime()) ? session.date : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

/** The one thing to do next for a session at each stage: what the strip's main button does. */
const NEXT: Record<SessionStage, { id: string; label: string }> = {
  planned: { id: 'prep', label: 'Start prep' },
  preparing: { id: 'play', label: 'Start playing' },
  playing: { id: 'wrap', label: 'Wrap up' },
  played: { id: 'plan', label: 'Plan the next session' },
}

/**
 * The summary strip: the session in hand with its stage, title and date, and one main button for
 * what comes next (prep it, start playing, wrap it up, or plan the one after). The quieter button
 * beside it is the step before.
 */
function SessionStrip({
  world,
  inHand,
  stage,
  campaigns,
  onNewCampaign,
}: {
  world: World
  inHand?: InHand
  stage?: SessionStage
  campaigns: Campaign[]
  onNewCampaign: () => void
}) {
  const navigate = useNavigate()
  const w = worldPath(world.id)
  if (!inHand || !stage) {
    // No session yet: a campaign to make, or a first session to plan.
    const first = campaigns.find((c) => c.status !== 'finished')
    return (
      <section className="desk-strip next-sessions" aria-label="Next session">
        <div className="strip-title">
          <span className="desk-strip-name">{first ? 'No session planned yet' : 'No campaign yet'}</span>
          <Help topic="nextSession" />
        </div>
        <span className="muted small">{first ? `${first.name} has no sessions.` : 'A campaign is one group’s story in this world. Make one, then plan its first session.'}</span>
        <span className="grow" />
        {first ? (
          <button
            className="primary"
            data-next="plan"
            onClick={async () => {
              const n = await createNextSession(world.id, first.id)
              navigate(`${w}/s/${n.id}?tab=prep`)
            }}
          >
            <Ico as={ListChecks} /> Plan the first session
          </button>
        ) : (
          <button className="primary" data-next="campaign" onClick={onNewCampaign}>
            <Ico as={Plus} /> Make a campaign
          </button>
        )}
      </section>
    )
  }
  const { campaign: c, session: s } = inHand
  const prep = prepCounts(s.prep)
  const when = whenOf(c, s)
  const planned = prep.scenes.total || prep.clues.total ? `${prep.scenes.total} scene${prep.scenes.total === 1 ? '' : 's'} and ${prep.clues.total} clue${prep.clues.total === 1 ? '' : 's'} written` : ''
  const facts = [c.name, stage === 'played' ? 'last played' : when || 'no date set', stage === 'played' ? '' : planned].filter(Boolean)
  const next = NEXT[stage]
  const main: Record<SessionStage, ReactNode> = {
    planned: (
      <Link className="button primary" data-next={next.id} to={`${w}/s/${s.id}?tab=prep`}>
        <Ico as={ListChecks} /> {next.label}
      </Link>
    ),
    preparing: (
      <button
        className="primary"
        data-next={next.id}
        title={HELP.startPlaying}
        onClick={async () => {
          await startPlaying(s.id)
          navigate(`${w}/s/${s.id}/lectern`)
        }}
      >
        <Ico as={Play} weight="fill" /> {next.label}
      </button>
    ),
    playing: (
      <Link className="button primary" data-next={next.id} to={`${w}/s/${s.id}?end=1`}>
        <Ico as={FlagCheckered} /> {next.label}
      </Link>
    ),
    played: (
      <button
        className="primary"
        data-next={next.id}
        title="Start the next session, carrying over the clues and scenes you didn’t reach"
        onClick={async () => {
          const n = await createNextSession(world.id, c.id, '')
          navigate(`${w}/s/${n.id}?tab=prep`)
        }}
      >
        <Ico as={ListChecks} /> Plan session #{s.number + 1}
      </button>
    ),
  }
  const quiet: Record<SessionStage, ReactNode> = {
    planned: null,
    preparing: (
      <Link className="button" to={`${w}/s/${s.id}?tab=prep`}>
        <Ico as={NotePencil} /> Continue prep
      </Link>
    ),
    playing: (
      <Link className="button" to={`${w}/s/${s.id}/lectern`} title={HELP.lectern}>
        <Ico as={Play} /> Back to the table
      </Link>
    ),
    played: (
      <Link className="button" to={`${w}/s/${s.id}/lectern`} title={HELP.lectern}>
        <Ico as={ArrowCounterClockwise} /> Re-open #{s.number}
      </Link>
    ),
  }
  return (
    <section className="desk-strip next-sessions" aria-label="Next session" data-session={s.id}>
      <div className="strip-title">
        <StageChip stage={stage} />
        <Link className="desk-strip-name" to={`${w}/s/${s.id}`}>
          #{s.number} {s.title}
        </Link>
        <Help topic="nextSession" />
      </div>
      <span className="muted small desk-strip-facts">{facts.join(' · ')}</span>
      <span className="grow" />
      <span className="desk-strip-actions">
        {quiet[stage]}
        {main[stage]}
      </span>
    </section>
  )
}

/** One line of "Needs you": a chip saying what kind of thing, the thing itself, and its one action. */
interface Need {
  key: string
  chip: string
  icon: Icon
  tone?: 'warn' | 'bad' | 'quiet'
  text: ReactNode
  action?: ReactNode
  /** One of the Inbox's items (what the badge counts). */
  inbox?: boolean
}

/** How many of the Inbox's items "Needs you" lists before "…and N more in the Inbox". */
const INBOX_ROWS = 5

const clip = (text: string, n = 90) => (text.length > n ? `${text.slice(0, n)}…` : text)

/**
 * Everything waiting on the GM before the next session, each with one action: what players sent
 * (the Inbox's items, oldest first), a session with no date or no plan, pressing threads, a backup
 * that's due, characters nobody plays, players not invited yet, and pages linked but not written.
 */
function NeedsYou({ world, entities, sessions, inHand, stage }: { world: World; entities: Entity[]; sessions: Session[]; inHand?: InHand; stage?: SessionStage }) {
  const inbox = useInbox()
  const backup = useBackupDue(world)
  const [reading, setReading] = useState<CharacterRequest>()
  const [wantedOpen, setWantedOpen] = useState(false)
  const w = worldPath(world.id)
  const nameOf = (id: string) => entities.find((e) => e.id === id)?.name ?? 'a character'
  const ask = (id: string) => `${w}/questions?item=${id}`
  const s = inHand?.session
  const upcomingStage = stage === 'planned' || stage === 'preparing'

  const fromPlayers: (Need & { at: string })[] = [
    ...inbox.questions.map((q) => ({
      key: q.id,
      at: q.createdAt,
      chip: 'Question',
      icon: ChatCircleDots,
      text: (
        <>
          <b>{inbox.nameOf(q.userId)}:</b> {clip(q.body)}
        </>
      ),
      action: (
        <Link className="button small" to={ask(q.id)}>
          Answer
        </Link>
      ),
    })),
    ...inbox.downtime.map((d) => ({
      key: d.id,
      at: d.createdAt,
      chip: 'Downtime',
      icon: Hourglass,
      text: (
        <>
          <b>{d.character || inbox.nameOf(d.userId)}:</b> {clip(d.body)}
        </>
      ),
      action: (
        <Link className="button small" to={ask(d.id)}>
          Answer
        </Link>
      ),
    })),
    ...inbox.claims.map((c) => ({
      key: `claim:${c.entityId}`,
      at: c.createdAt,
      chip: 'Claim',
      icon: MaskHappy,
      text: (
        <>
          <b>{c.who}</b> asked to play <Link to={pagePath(world.id, c.entityId)}>{nameOf(c.entityId)}</Link>
        </>
      ),
      action: (
        <button className="small" onClick={() => approveClaimLater(world.id, c, nameOf(c.entityId), inbox.reload)}>
          Approve
        </button>
      ),
    })),
    ...inbox.requests.map((r) => ({
      key: r.id,
      at: r.createdAt,
      chip: 'New character',
      icon: UserCirclePlus,
      text: (
        <>
          <b>{inbox.nameOf(r.userId)}</b> sent you {r.sheet.name}
        </>
      ),
      action: (
        <button className="small" onClick={() => setReading(r)}>
          Read it
        </button>
      ),
    })),
  ]
    .sort((a, b) => (a.at || '0').localeCompare(b.at || '0'))
    .map((n) => ({ ...n, inbox: true }))

  const needs: Need[] = fromPlayers.slice(0, INBOX_ROWS)
  if (s && upcomingStage && !s.date && inHand && !upcoming(inHand.campaign))
    needs.push({ key: 'date', chip: 'No date', icon: CalendarBlank, tone: 'warn', text: <>#{s.number} {s.title} has no date yet</>, action: <SetDate session={s} /> })
  if (s && stage === 'planned')
    needs.push({
      key: 'prep',
      chip: 'Prep',
      icon: NotePencil,
      tone: 'warn',
      text: <>Nothing planned for #{s.number} yet</>,
      action: (
        <Link className="button small" to={`${w}/s/${s.id}?tab=prep`}>
          Prepare
        </Link>
      ),
    })
  for (const t of entities.filter((e) => isOpenThread(e) && e.threadUrgency === 'high'))
    needs.push({
      key: t.id,
      chip: 'Pressing',
      icon: Flame,
      tone: 'bad',
      text: <span className="clip">{t.name}</span>,
      action: (
        <Link className="button small" to={pagePath(world.id, t.id)}>
          Open
        </Link>
      ),
    })
  if (backup.due)
    needs.push({
      key: 'backup',
      chip: 'Backup',
      icon: FloppyDisk,
      text: (
        <>
          {backup.text}. <span className="muted">{backup.why}</span> <Help topic="backupReminder" />
        </>
      ),
      action: (
        <span className="row">
          <BackupButton worldId={world.id} className="small" label="Back up now" onDone={backup.done} />
          <button className="small ghost" onClick={backup.later}>
            Later
          </button>
        </span>
      ),
    })
  const party = partyOf(entities, inHand?.campaign.id, { activeOnly: true })
  const players = `${w}/settings?tab=players`
  if (inbox.available && inbox.loaded && inbox.members.length) {
    const nobody = party.filter((pc) => !inbox.claimed.has(pc.id))
    if (nobody.length)
      needs.push({
        key: 'unclaimed',
        chip: 'Players',
        icon: UsersThree,
        text: <>Nobody plays {nobody.map((e) => e.name.split(' ')[0]).join(', ')} yet</>,
        action: (
          <Link className="button small" to={players}>
            Invite
          </Link>
        ),
      })
  } else if (!world.cloud?.enabled || (inbox.loaded && !inbox.members.length))
    needs.push({
      key: 'invite',
      chip: 'Players',
      icon: UsersThree,
      tone: 'quiet',
      text: <span className="muted">Nobody invited yet, so nobody’s waiting on you</span>,
      action: (
        <Link className="button small ghost" to={players}>
          Invite
        </Link>
      ),
    })
  const wanted = wantedPages(entities, sessions).length
  if (wanted)
    needs.push({
      key: 'wanted',
      chip: 'Pages',
      icon: NotePencil,
      tone: 'quiet',
      text: (
        <>
          {wanted} name{wanted === 1 ? '' : 's'} linked with [[ ]] but no page yet
        </>
      ),
      action: (
        <button className="small ghost" aria-expanded={wantedOpen} onClick={() => setWantedOpen(!wantedOpen)}>
          {wantedOpen ? 'Hide' : 'See them'}
        </button>
      ),
    })
  const more = fromPlayers.length - INBOX_ROWS
  const waiting = needs.filter((n) => n.tone !== 'quiet').length + Math.max(0, more)

  return (
    <section className="card needs-you" data-inbox-total={inbox.total}>
      <div className="card-head">
        <h2>
          Needs you{s && stage !== 'played' ? ` before #${s.number}` : ''} {waiting > 0 && <span className="count alert">{waiting}</span>} <Help topic="needsYou" />
        </h2>
        <Link className="small" to={`${w}/questions`}>
          Inbox{inbox.total ? ` · ${inbox.total}` : ''}
        </Link>
      </div>
      {waiting === 0 && (
        <p className="muted small all-caught-up">
          <Ico as={CheckCircle} /> All caught up.
        </p>
      )}
      <ul className="needs">
        {needs.map((n) => (
          <li key={n.key} className={`need ${n.tone ?? ''}`} {...(n.inbox ? { 'data-inbox-item': '' } : {})}>
            <span className={`chip need-chip ${n.tone ?? ''}`}>
              <Ico as={n.icon} /> {n.chip}
            </span>
            <span className="need-text">{n.text}</span>
            {n.action && <span className="need-action">{n.action}</span>}
          </li>
        ))}
        {more > 0 && (
          <li className="need" data-inbox-more={more}>
            <Link to={`${w}/questions`}>…and {more} more in the Inbox</Link>
          </li>
        )}
      </ul>
      {wantedOpen && <WantedPages worldId={world.id} entities={entities} sessions={sessions} />}
      {reading && <ReviewCharacter world={world} request={reading} player={inbox.nameOf(reading.userId)} onClose={() => setReading(undefined)} onDone={inbox.reload} />}
    </section>
  )
}

/** "Set a date": a date box in place; the session takes the day you pick (today or later). */
function SetDate({ session }: { session: Session }) {
  const [open, setOpen] = useState(false)
  const [min] = useState(() => localDate())
  if (!open)
    return (
      <button className="small" onClick={() => setOpen(true)}>
        Set a date
      </button>
    )
  return (
    <input
      type="date"
      autoFocus
      min={min}
      aria-label={`Date of #${session.number}`}
      onChange={async (e) => {
        const date = e.target.value
        if (!date || date < min) return
        await db.sessions.update(session.id, { date })
        toast(`#${session.number} is on ${new Date(`${date}T12:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}.`, () => db.sessions.update(session.id, { date: '' }))
      }}
    />
  )
}

/** The clocks still ticking, most of them at a glance; the Clocks tab has them all. */
function DeskClocks({ world, entities }: { world: World; entities: Entity[] }) {
  const clocks = tickingClocks(entities)
  if (!clocks.length) return null
  return (
    <section className="card desk-clocks">
      <div className="card-head">
        <h2>
          Clocks <Help topic="clocks" />
        </h2>
        <Link className="small" to={`${worldPath(world.id)}/clocks`}>
          All {clocks.length}
        </Link>
      </div>
      <ul className="desk-clock-list">
        {clocks.slice(0, 4).map(({ clock, owner }) => (
          <li key={clock.id}>
            <Link className="desk-clock" to={pagePath(world.id, owner.id)} title={owner.name}>
              <ClockFace clock={clock} size={28} />
              <span className="desk-clock-name">{clock.name}</span>
              <span className="muted small">
                {clock.filled} of {clockSize(clock)}
              </span>
              {clock.known ? (
                <span className="chip need-chip good">
                  <Ico as={Eye} /> Players know
                </span>
              ) : (
                <span className="chip need-chip">
                  <Ico as={LockSimple} /> Secret
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** The party at a glance: portraits, armour and hit points. */
function DeskParty({ world, entities, campaignId }: { world: World; entities: Entity[]; campaignId?: string }) {
  const party = partyOf(entities, campaignId, { activeOnly: true })
  if (!party.length) return null
  return (
    <section className="card desk-party">
      <div className="card-head">
        <h2>
          The party <Help topic="deskParty" />
        </h2>
        {campaignId && (
          <Link className="small" to={`${worldPath(world.id)}/c/${campaignId}`}>
            Campaign
          </Link>
        )}
      </div>
      <ul className="desk-party-list">
        {party.map((pc) => (
          <PartyMember key={pc.id} world={world} pc={pc} />
        ))}
      </ul>
    </section>
  )
}

function PartyMember({ world, pc }: { world: World; pc: Entity }) {
  const image = useAssetUrl(pc.imageId)
  const ac = detailOf(pc, 'AC')
  const hp = detailOf(pc, 'HP')
  return (
    <li>
      <Link className="desk-pc" to={pagePath(world.id, pc.id)}>
        <span className="desk-pc-picture">{image ? <img src={image} alt="" /> : <span aria-hidden="true">{initials(pc.name)}</span>}</span>
        <span className="desk-pc-text">
          <b>{pc.name.split(' ')[0]}</b>
          <small className="muted">{[ac && `AC ${ac}`, hp && `HP ${hp}`].filter(Boolean).join(' · ') || typeLabel(pc, world).one}</small>
        </span>
      </Link>
    </li>
  )
}

/** The next few sessions of each running campaign, with their stage, and the campaigns themselves. */
function ComingUp({
  world,
  campaigns,
  sessions,
  playing,
  onNewCampaign,
}: {
  world: World
  campaigns: Campaign[]
  sessions: Session[]
  playing: string[]
  onNewCampaign: () => void
}) {
  const w = worldPath(world.id)
  const running = campaigns.filter((c) => c.status !== 'finished')
  const next = sessions
    .filter((s) => running.some((c) => c.id === s.campaignId) && (!isPlayed(s) || playing.includes(s.id)))
    .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || a.number - b.number)
    .slice(0, 4)
  const booked = running.filter((c) => upcoming(c) && !next.some((s) => s.campaignId === c.id))
  return (
    <section className="card coming-up">
      <div className="card-head">
        <h2>
          Coming up <Help topic="comingUp" />
        </h2>
        <button className="small" onClick={onNewCampaign}>
          <Ico as={Plus} /> Campaign
        </button>
      </div>
      {!next.length && !booked.length && <p className="muted small">{campaigns.length ? 'No sessions planned.' : 'A campaign is one group’s story in this world. You can run several in the same world.'}</p>}
      <ul className="coming-list">
        {next.map((s) => (
          <li key={s.id}>
            <Link to={`${w}/s/${s.id}`}>
              <span className="coming-name">
                #{s.number} {s.title}
              </span>
              {running.length > 1 && <small className="muted">{running.find((c) => c.id === s.campaignId)?.name}</small>}
            </Link>
            <StageChip stage={sessionStage(s, playing.includes(s.id))} />
          </li>
        ))}
        {booked.map((c) => (
          <li key={c.id}>
            <Link to={`${w}/c/${c.id}`}>
              <span className="coming-name">{c.name}</span>
              <small className="muted">{showDate(upcoming(c)!)}</small>
            </Link>
          </li>
        ))}
      </ul>
      {campaigns.length > 0 && (
        <p className="small coming-campaigns">
          {campaigns.map((c, i) => (
            <span key={c.id}>
              {i > 0 && ' · '}
              <Link to={`${w}/c/${c.id}`}>{c.name}</Link>
              {c.status !== 'active' && <span className="muted"> ({c.status})</span>}
            </span>
          ))}
        </p>
      )}
    </section>
  )
}

/** The pages changed most lately, one line each. */
function RecentlyChanged({ world, entities }: { world: World; entities: Entity[] }) {
  // The example's pages all carry the same time; "lately" then means nothing, so it waits for a real change.
  const recent = [...entities].filter((e) => e.type !== 'thread').sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6)
  const same = recent.length > 1 && recent.every((e) => e.updatedAt === recent[0].updatedAt)
  if (!recent.length || same) return null
  return (
    <section className="card recently-changed">
      <h2>Recently changed</h2>
      <ul className="recent-list">
        {recent.map((e) => (
          <li key={e.id}>
            <Link to={pagePath(world.id, e.id)}>
              <TypeIcon type={e.type} custom={world.customTypes?.find((c) => c.id === e.customType)} size="1em" /> {e.name}
            </Link>
            <span className="muted small">
              {typeLabel(e, world).one} · {ago(e.updatedAt)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** The world in numbers, each one a way into its list. */
function StatLine({ world, entities, sessions }: { world: World; entities: Entity[]; sessions: Session[] }) {
  const w = worldPath(world.id)
  const maps = useLiveQuery(() => db.maps.where({ worldId: world.id }).count(), [world.id]) ?? 0
  const threads = entities.filter(isOpenThread).length
  const quests = entities.filter(isOpenQuest).length
  const planned = sessions.filter((s) => !isPlayed(s)).length
  const pages = entities.filter((e) => !e.template).length
  return (
    <p className="statline desk-statline">
      <Link to={`${w}/everything`}>
        <b>{pages}</b> page{pages === 1 ? '' : 's'}
      </Link>
      <Link to={`${w}/maps`}>
        <b>{maps}</b> map{maps === 1 ? '' : 's'}
      </Link>
      <Link to={`${w}/threads`}>
        <b>{threads}</b> open thread{threads === 1 ? '' : 's'}
      </Link>
      <Link to={`${w}/quests`}>
        <b>{quests}</b> open quest{quests === 1 ? '' : 's'}
      </Link>
      <Link to={`${w}/session`}>
        <b>{planned}</b> session{planned === 1 ? '' : 's'} to play
      </Link>
    </p>
  )
}

export function NewCampaign({
  worldId,
  defaultSystem,
  onClose,
  onCreated,
}: {
  worldId: string
  defaultSystem: string
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [name, setName] = useState('')
  const [system, setSystem] = useState(defaultSystem)
  return (
    <Modal title="New campaign" onClose={onClose}>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim()) return
          const id = newId()
          await db.campaigns.add({
            id,
            worldId,
            name: name.trim(),
            system,
            description: '',
            status: 'planning',
            // Like pages, a new campaign starts GM only: players see it once it's revealed.
            visibility: 'gm',
            createdAt: Date.now(),
          })
          onCreated(id)
        }}
      >
        <label>
          Name
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Game system
          <select value={system} onChange={(e) => setSystem(e.target.value)}>
            {GAME_SYSTEMS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <p className="muted small">It starts 🔒 GM only, like a new page. Reveal it to players on its page when you’re ready.</p>
        <div className="row end">
          <button type="button" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={!name.trim()}>Create</button>
        </div>
      </form>
    </Modal>
  )
}

const hideKey = (worldId: string) => `gettingStarted.hidden.${worldId}`

/** First steps for a new, nearly empty world, each with its button. Hide puts it away for good on this device. */
function GettingStarted({ world, onNewCampaign }: { world: World; onNewCampaign: () => void }) {
  const create = useCreatePage(world)
  const w = worldPath(world.id)
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(hideKey(world.id)) === '1'
    } catch {
      return false
    }
  })
  if (hidden) return null
  const steps: [string, string, string, ReactNode][] = [
    ['🎲', 'Make a campaign', 'One group’s story in this world.', <button key="campaign" className="small" onClick={onNewCampaign}>Make a campaign</button>],
    [
      '🧑',
      'Add a few people and places',
      'Link pages to each other by writing [[Name]].',
      <span key="pages" className="row">
        <button className="small" onClick={() => create('npc')}>New NPC</button>
        <button className="small" onClick={() => create('location')}>New place</button>
      </span>,
    ],
    ['🗺️', 'Add a map', 'Upload one or draw it, then pin your places on it.', <Link key="maps" className="button small" to={`${w}/maps`}>Maps</Link>],
    ['🔒', 'Keep secrets', 'Pages start GM only. Reveal them when the players find out.', null],
    ['☁️', 'Invite your players (optional)', 'Turn on cloud sync, then send invite links.', <Link key="players" className="button small" to={`${w}/settings?tab=players`}>Players</Link>],
  ]
  return (
    <section className="card getting-started">
      <div className="card-head">
        <h2>
          Getting started <Help topic="gettingStarted" />
        </h2>
        <button
          className="small ghost"
          onClick={() => {
            try {
              localStorage.setItem(hideKey(world.id), '1')
            } catch {
              // Private window: it hides for now.
            }
            setHidden(true)
          }}
        >
          Hide
        </button>
      </div>
      <ol>
        {steps.map(([icon, title, text, action]) => (
          <li key={title}>
            <span>
              {icon} <strong>{title}.</strong> <span className="muted">{text}</span>
            </span>
            {action}
          </li>
        ))}
      </ol>
      <p className="small muted">
        Every ? button explains the thing next to it. <Link to={`${w}/settings`}>World settings</Link> can turn them off.
      </p>
    </section>
  )
}
