import { Help, HELP } from '../help'
import { WorldCover } from '../WorldCover'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Modal } from '../components'
import { db, ENTITY_LABELS, GAME_SYSTEMS, newId, PICKER_TYPES, typeLabel, type Entity, type World } from '../db'
import { useCreatePage } from '../NewPage'
import { useAssetUrl, useVisibleEntities, useWorld } from '../hooks'
import { initials } from '../text'
import { nextSessions, URGENCY, useCampaigns } from '../threads'
import { useViewMode } from '../viewMode'
import { BackupReminder } from '../BackupReminder'
import WikiHome from './WikiHome'
import PlayerHome from './PlayerHome'
import { showDate, upcoming } from '../players/Schedule'
import { useLiveQuery } from 'dexie-react-hooks'
import { ClockFace, useAllClocks } from '../clocks'
import { useGmQuestions } from '../players/Questions'
import { useCharacterOwners } from '../players/owners'
import { Ico, TypeIcon } from '../icons'
import { ChatCircleDots, ListChecks, Play, Plus, Spiral, UserCirclePlus } from '@phosphor-icons/react'

export default function Dashboard() {
  const { worldId, world } = useWorld()
  const { isGM } = useViewMode()
  const navigate = useNavigate()
  const entities = useVisibleEntities(worldId)
  const campaigns = useCampaigns(worldId)
  const [newCampaign, setNewCampaign] = useState(false)

  const recent = [...entities].filter((e) => e.type !== 'thread').sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8)
  const urgencyRank = { high: 0, normal: 1, low: 2 }
  const openThreads = entities
    .filter((e) => e.type === 'thread' && (e.threadStatus === 'open' || e.threadStatus === 'active'))
    .sort((a, b) => urgencyRank[a.threadUrgency ?? 'normal'] - urgencyRank[b.threadUrgency ?? 'normal'] || b.updatedAt - a.updatedAt)
  const openQuests = entities.filter((e) => e.type === 'quest' && (e.questStatus === 'open' || e.questStatus === 'active'))
  const clocks = useAllClocks(entities).filter(({ clock }) => clock.filled < clock.segments)

  if (!world) return null
  // Opened from a public wiki link: a tidy front page for readers instead of the GM's overview.
  if (world.shared?.token) return <WikiHome world={world} />
  // Players (and the GM previewing as one) get their own front page.
  if (!isGM) return <PlayerHome world={world} />
  return (
    <div className="page home-page">
      <WorldCover world={world}>
        <NewPageMenu world={world} />
      </WorldCover>
      <BackupReminder world={world} />
      {entities.length < 3 && campaigns.length === 0 && <GettingStarted worldId={worldId} />}

      <div className="home-grid">
        <NextSessions worldId={worldId} onNewCampaign={() => setNewCampaign(true)} />
        <NeedsYou world={world} threads={openThreads.filter((t) => t.threadUrgency === 'high')} />
        <section className="card">
          <h3>
            <Link to={`/w/${worldId}/clocks`}>Clocks</Link> <Help topic="clocks" />
          </h3>
          {clocks.length === 0 ? (
            <p className="muted small">No clocks ticking. Add one to a faction or loose thread to track a plan or a threat.</p>
          ) : (
            <div className="home-clocks">
              {clocks.slice(0, 4).map(({ clock, owner }) => (
                <Link key={clock.id} className="home-clock" to={`/w/${worldId}/e/${owner.id}`}>
                  <ClockFace clock={clock} size={34} />
                  <span>
                    {clock.name}
                    <small className="muted">
                      {clock.filled} of {clock.segments} · {owner.name}
                    </small>
                  </span>
                </Link>
              ))}
              {clocks.length > 4 && <Link to={`/w/${worldId}/clocks`}>All {clocks.length} clocks…</Link>}
            </div>
          )}
        </section>
      </div>

      <section className="card">
        <h3>Recently changed</h3>
        {recent.length === 0 ? (
          <p className="muted small">Nothing here yet. Use New page to start your world.</p>
        ) : (
          <div className="tiles">
            {recent.map((e) => (
              <PageTile key={e.id} entity={e} world={world} />
            ))}
          </div>
        )}
      </section>

      <div className="home-grid">
        <section className="card">
          <div className="section-header">
            <h3>
              Campaigns <Help topic="campaign" />
            </h3>
            <button className="small" onClick={() => setNewCampaign(true)}>+ Campaign</button>
          </div>
          {campaigns.length === 0 ? (
            <p className="muted small">A campaign is one group's story in this world. You can run several in the same world.</p>
          ) : (
            <ul className="entity-list">
              {campaigns.map((c) => (
                <li key={c.id}>
                  <Link to={`/w/${worldId}/c/${c.id}`}>{c.name}</Link>
                  <span className="muted"> · {c.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card">
          <h3>Open quests</h3>
          {openQuests.length === 0 ? (
            <p className="muted small">No open quests.</p>
          ) : (
            <ul className="entity-list">
              {openQuests.map((e) => (
                <li key={e.id}>
                  <Link to={`/w/${worldId}/e/${e.id}`}>{e.name}</Link>
                  <span className="muted"> · {e.questStatus}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card">
          <h3>
            <Link to={`/w/${worldId}/threads`}>Loose threads</Link>
          </h3>
          {openThreads.length === 0 ? (
            <p className="muted small">No loose threads.</p>
          ) : (
            <ul className="entity-list">
              {openThreads.slice(0, 5).map((e) => (
                <li key={e.id}>
                  <Link to={`/w/${worldId}/e/${e.id}`}>
                    {e.threadUrgency && URGENCY[e.threadUrgency].icon} {e.name}
                  </Link>
                </li>
              ))}
              {openThreads.length > 5 && (
                <li>
                  <Link to={`/w/${worldId}/threads`}>…and {openThreads.length - 5} more</Link>
                </li>
              )}
            </ul>
          )}
        </section>
      </div>
      {newCampaign && (
        <NewCampaign
          worldId={worldId}
          defaultSystem={world.system}
          onClose={() => setNewCampaign(false)}
          onCreated={(id) => navigate(`/w/${worldId}/c/${id}`)}
        />
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

/** A page as a little card with its picture, or its initials when it has none. */
function PageTile({ entity: e, world }: { entity: Entity; world: World }) {
  const image = useAssetUrl(e.imageId)
  return (
    <Link className="tile" to={`/w/${world.id}/e/${e.id}`}>
      <span className="tile-picture">{image ? <img src={image} alt="" /> : <span aria-hidden="true">{initials(e.name)}</span>}</span>
      <span className="tile-text">
        {e.name}
        <small>
          <TypeIcon type={e.type} custom={world.customTypes?.find((c) => c.id === e.customType)} size="1em" /> {typeLabel(e, world).one}
        </small>
      </span>
    </Link>
  )
}

/** What's waiting on the GM: questions, character claims and urgent threads. */
function NeedsYou({ world, threads }: { world: World; threads: Entity[] }) {
  const questions = useGmQuestions(world)
  const waiting = questions.questions.filter((q) => !q.answer)
  const { owners } = useCharacterOwners(world.cloud?.enabled ? world : undefined)
  const claims = [...owners.values()].filter((o) => o.pending).length
  const count = waiting.length + claims + threads.length
  return (
    <section className="card needs-you">
      <h3>
        Needs you {count > 0 && <span className="count alert">{count}</span>} <Help topic="needsYou" />
      </h3>
      {count === 0 && <p className="muted small">All caught up.</p>}
      <ul className="entity-list">
        {waiting.slice(0, 4).map((q) => (
          <li key={q.id}>
            <Link to={`/w/${world.id}/questions`}>
              <Ico as={ChatCircleDots} /> {q.body.length > 70 ? `${q.body.slice(0, 70)}…` : q.body}
            </Link>
          </li>
        ))}
        {waiting.length > 4 && (
          <li>
            <Link to={`/w/${world.id}/questions`}>…and {waiting.length - 4} more questions</Link>
          </li>
        )}
        {claims > 0 && (
          <li>
            <Link to={`/w/${world.id}/settings?tab=players`}>
              <Ico as={UserCirclePlus} /> {claims} character claim{claims === 1 ? '' : 's'} to approve
            </Link>
          </li>
        )}
        {threads.map((t) => (
          <li key={t.id}>
            <Link to={`/w/${world.id}/e/${t.id}`}>
              <Ico as={Spiral} /> {t.name}
            </Link>
            <span className="muted small"> · urgent thread</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function NewCampaign({
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
        <div className="row end">
          <button type="button" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={!name.trim()}>Create</button>
        </div>
      </form>
    </Modal>
  )
}

/** The GM's "what's next" card: each campaign's coming session, with its prep and the Lectern a click away. */
function NextSessions({ worldId, onNewCampaign }: { worldId: string; onNewCampaign: () => void }) {
  const campaigns = useCampaigns(worldId)
  const sessions = useLiveQuery(() => db.sessions.where({ worldId }).toArray(), [worldId]) ?? []
  const cards = nextSessions(campaigns, sessions)
  const booked = campaigns.filter((c) => c.status !== 'finished' && upcoming(c) && !cards.some((x) => x.campaign.id === c.id))
  return (
    <section className="card next-sessions">
      <h3>
        Next session <Help topic="nextSession" />
      </h3>
      {!cards.length && !booked.length && (
        <p className="muted small">
          No sessions yet. <button className="link" onClick={onNewCampaign}>Make a campaign</button>, then add its first session.
        </p>
      )}
      {cards.map(({ campaign: c, session: next }) => {
        const clues = next.prep?.clues.filter((x) => !x.done && x.text.trim()).length ?? 0
        const scenes = next.prep?.scenes.filter((x) => !x.done && x.text.trim()).length ?? 0
        const when = upcoming(c)
        return (
          <div key={c.id} className="next-session">
            <div className="kicker">{c.name}</div>
            <Link className="next-title" to={`/w/${worldId}/s/${next.id}`}>
              #{next.number} {next.title}
            </Link>
            <div className="muted small">
              {when ? showDate(when) : next.date}
              {clues || scenes ? ` · ${scenes} scene${scenes === 1 ? '' : 's'}, ${clues} clue${clues === 1 ? '' : 's'} ready` : ''}
            </div>
            <div className="row wrap">
              <Link className="button primary" to={`/w/${worldId}/s/${next.id}/lectern`} title={HELP.lectern}>
                <Ico as={Play} weight="fill" /> Run session
              </Link>
              <Link className="button" to={`/w/${worldId}/s/${next.id}?tab=prep`}>
                <Ico as={ListChecks} /> Prep
              </Link>
            </div>
          </div>
        )
      })}
      {booked.map((c) => (
        <div key={c.id} className="next-session">
          <div className="kicker">{c.name}</div>
          <Link to={`/w/${worldId}/c/${c.id}`}>No session yet</Link>
          <div className="muted small">{showDate(upcoming(c)!)}</div>
        </div>
      ))}
    </section>
  )
}

/** A short first-steps list for a new, nearly empty world. */
function GettingStarted({ worldId }: { worldId: string }) {
  const steps: [string, string, string][] = [
    ['🎲', 'Make a campaign', 'One group’s story in this world. Use “+ Campaign” below.'],
    ['🧑', 'Add a few people and places', 'Use Quick add. Link pages to each other by writing [[Name]].'],
    ['🗺️', 'Add a map', 'Upload one or draw it, then pin your places on it.'],
    ['🔒', 'Keep secrets', 'Pages start GM only. Reveal them when the players find out, and hide passages with the 🔒 buttons.'],
    ['☁️', 'Invite your players (optional)', 'Turn on cloud sync in World settings, then send invite links.'],
  ]
  return (
    <section className="card getting-started">
      <h2>
        Getting started <Help topic="gettingStarted" />
      </h2>
      <ol>
        {steps.map(([icon, title, text]) => (
          <li key={title}>
            {icon} <strong>{title}.</strong> <span className="muted">{text}</span>
          </li>
        ))}
      </ol>
      <p className="small muted">
        Every ? button explains the thing next to it. <Link to={`/w/${worldId}/settings`}>World settings</Link> can turn them off.
      </p>
    </section>
  )
}
