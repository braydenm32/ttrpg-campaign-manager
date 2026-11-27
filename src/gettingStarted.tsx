import { useEffect, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { CheckCircle } from '@phosphor-icons/react'
import { db, type Campaign, type Entity, type World } from './db'
import { Help } from './help'
import { Ico } from './icons'
import { ImportPages } from './ImportPages'
import { useCreatePage } from './NewPage'
import { pagePath, worldPath } from './paths'
import { SeeTheExampleButton } from './firstSteps'
import { getInviteToken } from './cloud/players'

/**
 * The Desk's "Getting started" card: seven first steps for a new world, each with a button to the
 * place where it's done, each ticking itself once it is. It stays until every step is ticked or the
 * GM presses Hide, and More › Getting started brings it back. All of this is remembered on this
 * device, per world (localStorage), like the Hide it always had.
 *
 * It starts by itself only for a world that was new and nearly empty when the Desk first showed it
 * (fewer than 3 pages, no campaign), so worlds made before it and the example worlds aren't nagged;
 * More › Getting started shows it in any world.
 */

const key = (what: 'hidden' | 'started' | 'skipped', worldId: string) => `gettingStarted.${what}.${worldId}`

function read(k: string) {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}

function write(k: string, v: string | null) {
  try {
    if (v === null) localStorage.removeItem(k)
    else localStorage.setItem(k, v)
  } catch {
    // Private window or storage blocked: it lasts until the page closes.
  }
}

/** The steps, each with whether it's done. Optional steps can be skipped instead. */
interface Step {
  id: string
  icon: string
  title: string
  text: string
  action: ReactNode
  done: boolean
  optional?: boolean
}

/**
 * The card, for the Desk. `entities` and `campaigns` are what the Desk already has (the GM sees
 * everything). Gives nothing back while it's hidden, finished, or not started for this world.
 */
export function GettingStarted({ world, entities, campaigns, onNewCampaign }: { world: World; entities: Entity[]; campaigns: Campaign[]; onNewCampaign: () => void }) {
  const create = useCreatePage(world)
  const w = worldPath(world.id)
  const [search, setSearch] = useSearchParams()
  // "Start from an export…" in the New world dialog lands here with ?import=1: the importer open.
  const [importing, setImporting] = useState(() => search.get('import') === '1')
  useEffect(() => {
    if (search.get('import') === '1') document.getElementById('getting-started-import')?.scrollIntoView({ block: 'center' })
  }, [search])
  const pages = entities.filter((e) => !e.template)
  const fresh = pages.length < 3 && campaigns.length === 0
  const [hidden, setHidden] = useState(() => read(key('hidden', world.id)) === '1')
  const [started, setStarted] = useState(() => read(key('started', world.id)) === '1')
  const [skipped, setSkipped] = useState<string[]>(() => (read(key('skipped', world.id)) ?? '').split(',').filter(Boolean))
  // More › Getting started (?start=1): back on, whatever it was.
  const bringBack = search.get('start') === '1'
  useEffect(() => {
    if (!bringBack) return
    write(key('hidden', world.id), null)
    write(key('started', world.id), '1')
    setHidden(false)
    setStarted(true)
    const next = new URLSearchParams(search)
    next.delete('start')
    setSearch(next, { replace: true })
    document.querySelector('.getting-started')?.scrollIntoView({ block: 'center' })
  }, [bringBack, search, setSearch, world.id])
  // A new world: the card starts, and stays started (remembered) after its first pages and campaign.
  const on = started || fresh
  useEffect(() => {
    if (fresh && !hidden) write(key('started', world.id), '1')
  }, [fresh, hidden, world.id])

  const maps = useLiveQuery(() => db.maps.where({ worldId: world.id }).count(), [world.id])
  const hasExample = useLiveQuery(async () => (await db.worlds.toArray()).some((x) => x.example && !x.shared), [])
  // Invite links live in the cloud: asked only once sync is on.
  const cloud = !!world.cloud?.enabled
  const [invited, setInvited] = useState(false)
  useEffect(() => {
    if (!cloud) return
    let gone = false
    getInviteToken(world.id).then((t) => !gone && setInvited(!!t), () => undefined)
    return () => void (gone = true)
  }, [cloud, world.id])

  const newest = [...pages].sort((a, b) => b.updatedAt - a.updatedAt)[0]
  const steps: Step[] = [
    {
      id: 'import',
      icon: '📥',
      title: 'Already have notes? Bring them in',
      text: 'Photos of your notebook, Obsidian or a Markdown folder, Kanka or World Anvil. Everything comes in GM only.',
      action: (
        <button className="small" aria-expanded={importing} onClick={() => setImporting(!importing)}>
          {importing ? 'Close' : 'Import notes'}
        </button>
      ),
      // Ticked once the world has pages, brought in or written by hand: either way it's past an empty start.
      done: pages.length > 0,
      optional: true,
    },
    {
      id: 'campaign',
      icon: '🎲',
      title: 'Make a campaign',
      text: 'One group’s story in this world.',
      action: <button className="small" onClick={onNewCampaign}>Make a campaign</button>,
      done: campaigns.length > 0,
    },
    {
      id: 'pages',
      icon: '🧑',
      title: 'Add a few people and places',
      text: 'Link pages to each other by writing [[Name]].',
      action: (
        <span className="row">
          <button className="small" onClick={() => create('npc')}>+ New person</button>
          <button className="small" onClick={() => create('location')}>+ New place</button>
        </span>
      ),
      done: pages.some((e) => e.type === 'npc' || e.type === 'pc') && pages.some((e) => e.type === 'location' || e.type === 'shop'),
    },
    {
      id: 'map',
      icon: '🗺️',
      title: 'Add a map',
      text: 'Upload one or draw it, then pin your places on it.',
      action: <Link className="button small" to={`${w}/maps`}>Maps</Link>,
      done: !!maps,
    },
    {
      id: 'reveal',
      icon: '🔒',
      title: 'Keep secrets, reveal the rest',
      text: 'Pages start GM only. Open one and press Reveal when the players find out.',
      action: newest ? <Link className="button small" to={pagePath(world.id, newest.id)}>Open {newest.name}</Link> : null,
      done: pages.some((e) => e.visibility === 'players' || !!e.revealedTo?.length),
    },
    {
      id: 'invite',
      icon: '☁️',
      title: 'Invite your players (optional)',
      text: 'Turn on cloud sync, then make an invite link and send it.',
      action: <Link className="button small" to={`${w}/settings?tab=players`}>Players</Link>,
      done: invited,
      optional: true,
    },
    {
      id: 'example',
      icon: '📖',
      title: 'See how a finished campaign looks',
      text: 'Vael Ardith, the full example, starting at its Start Here guide.',
      action: <SeeTheExampleButton />,
      done: !!hasExample || !!world.example,
    },
  ]
  const ticked = (s: Step) => s.done || (!!s.optional && skipped.includes(s.id))
  const left = steps.filter((s) => !ticked(s)).length
  if (hidden || !on || left === 0 || maps === undefined) return null

  const skip = (id: string, on: boolean) => {
    const next = on ? [...new Set([...skipped, id])] : skipped.filter((x) => x !== id)
    write(key('skipped', world.id), next.join(',') || null)
    setSkipped(next)
  }
  return (
    <section className="card getting-started">
      <div className="card-head">
        <h2>
          Getting started <Help topic="gettingStarted" />
        </h2>
        <span className="small muted">
          {steps.length - left} of {steps.length} done
        </span>
        <span className="grow" />
        <button
          className="small ghost"
          title="Put it away. More › Getting started brings it back."
          onClick={() => {
            write(key('hidden', world.id), '1')
            setHidden(true)
          }}
        >
          Hide
        </button>
      </div>
      <ol>
        {steps.map((s) => {
          const isTicked = ticked(s)
          return (
            <li key={s.id} className={isTicked ? 'done' : undefined} data-step={s.id} data-done={isTicked ? 'yes' : 'no'}>
              <span>
                {isTicked ? <><Ico as={CheckCircle} weight="fill" className="icon step-tick" /><span className="sr-only">Done:</span></> : s.icon} <strong>{s.title}.</strong>{' '}
                <span className="muted">{s.done || !isTicked ? s.text : 'Skipped.'}</span>
              </span>
              {!isTicked && (
                <span className="row">
                  {s.action}
                  {s.optional && (
                    <button className="small ghost" onClick={() => skip(s.id, true)}>
                      Skip
                    </button>
                  )}
                </span>
              )}
              {isTicked && !s.done && (
                <button className="small ghost" onClick={() => skip(s.id, false)}>
                  Undo skip
                </button>
              )}
              {s.id === 'import' && importing && (
                <div className="getting-started-import" id="getting-started-import">
                  <ImportPages worldId={world.id} system={world.system} compact />
                </div>
              )}
            </li>
          )
        })}
      </ol>
      <p className="small muted">
        Each step ticks itself when it’s done. Every ? button explains the thing next to it; World settings › This device can turn them off.
      </p>
    </section>
  )
}
