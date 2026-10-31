import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { useBin } from '../bin'
import { db } from '../db'
import { Help } from '../help'
import { formatBytes, useTemplates, useWorld } from '../hooks'
import { Ico } from '../icons'
import { moreFor, type NavTab } from '../nav'
import { hrefFor } from '../paths'
import { ShellFoot, useFrameContext } from '../Sidebar'
import '../more.css'

/**
 * The More page: everything used now and then, in a few groups, each a tap away. The GM's groups
 * are At the table, Workshop and Keeping the world; players get what isn't on a tab of its own.
 * It only lists what the viewer can open (src/nav.ts, moreFor). On a phone it also carries what the
 * sidebar's foot has on a computer: World settings, sync and the GM / Player switch.
 */
export default function More() {
  const { worldId, world } = useWorld()
  const frame = useFrameContext()
  const gm = frame?.facts.viewer === 'gm'
  const counts = useCounts(worldId, gm)
  if (!world || !frame) return null
  const groups = moreFor(frame.facts)
  if (frame.facts.handouts) counts.handouts = `${frame.facts.handouts}`
  return (
    <div className="page more-page">
      <header className="page-header">
        <div>
          <h1>
            More <Help topic="more" />
          </h1>
          <p className="lead">{gm ? 'Tools and settings you need now and then.' : 'Everything else the party can open.'}</p>
        </div>
      </header>
      {groups.map((g) => (
        <section key={g.id} className="more-group">
          <h2>{g.label}</h2>
          <p className="muted small">{g.blurb}</p>
          <ul className="more-list">
            {g.items.map((t) => (
              <li key={t.id} className={t.to(frame.facts) ? undefined : 'more-wide'}>
                <MoreItem item={t} to={t.to(frame.facts)} count={counts[t.id]} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      <ShellFoot world={world} className="phone-only more-foot" />
    </div>
  )
}

/** The GM's counts beside More items: boards, files and their size, sounds, tables, templates and the bin. */
function useCounts(worldId: string, gm: boolean): Record<string, string | undefined> {
  const facts = useLiveQuery(async () => {
    if (!gm) return
    const [boards, assets, sounds, tables] = await Promise.all([
      db.boards.where({ worldId }).count(),
      db.assets.where({ worldId }).toArray(),
      db.sounds.where({ worldId }).count(),
      db.entities
        .where({ worldId })
        .filter((e) => e.type === 'table' && !e.template)
        .count(),
    ])
    return { boards, files: assets.length, bytes: assets.reduce((n, a) => n + (a.size ?? 0), 0), sounds, tables }
  }, [worldId, gm])
  const templates = useTemplates(worldId).length
  const bin = useBin(worldId).length
  if (!gm || !facts) return {}
  const n = (x: number) => (x ? `${x}` : undefined)
  return {
    sounds: n(facts.sounds),
    tables: n(facts.tables),
    boards: n(facts.boards),
    assets: facts.files ? `${facts.files} · ${formatBytes(facts.bytes)}` : undefined,
    templates: n(templates),
    deleted: n(bin),
  }
}

function MoreItem({ item, to, count }: { item: NavTab; to?: string; count?: string }) {
  // Print has no address of its own: it's a button on every page and session, so this is a note, not a button.
  if (!to)
    return (
      <p className="more-note">
        <Ico as={item.icon} /> <span>{item.blurb}</span>
      </p>
    )
  const body = (
    <>
      <Ico as={item.icon} size="1.3em" />
      <span className="more-text">
        <b>{item.label}</b>
        {item.blurb && <small className="muted">{item.blurb}</small>}
      </span>
      {count && <span className="more-count">{count}</span>}
    </>
  )
  if (item.external)
    return (
      <a className="more-item" data-id={item.id} href={hrefFor(to)} target="_blank" rel="noopener">
        {body}
      </a>
    )
  return (
    <Link className="more-item" data-id={item.id} to={to}>
      {body}
    </Link>
  )
}
