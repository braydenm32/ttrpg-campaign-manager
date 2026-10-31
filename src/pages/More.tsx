import { Link } from 'react-router-dom'
import { Help } from '../help'
import { useWorld } from '../hooks'
import { Ico } from '../icons'
import { moreFor, type NavTab } from '../nav'
import { hrefFor } from '../paths'
import { ShellFoot, useFrameContext } from '../Sidebar'

/**
 * The More page: everything used now and then, in a few groups, each a tap away. The GM's groups
 * are At the table, Workshop and Keeping the world; players get what isn't on a tab of its own.
 * It only lists what the viewer can open (src/nav.ts, moreFor). On a phone it also carries what the
 * sidebar's foot has on a computer: World settings, sync and the GM / Player switch.
 */
export default function More() {
  const { world } = useWorld()
  const frame = useFrameContext()
  if (!world || !frame) return null
  const groups = moreFor(frame.facts)
  const gm = frame.facts.viewer === 'gm'
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
              <li key={t.id}>
                <MoreItem item={t} to={t.to(frame.facts)} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      <ShellFoot world={world} className="phone-only more-foot" />
    </div>
  )
}

function MoreItem({ item, to }: { item: NavTab; to?: string }) {
  const body = (
    <>
      <Ico as={item.icon} size="1.3em" />
      <span>
        <b>{item.label}</b>
        {item.blurb && <small className="muted">{item.blurb}</small>}
      </span>
    </>
  )
  // Print has no address of its own: it's on every page and session.
  if (!to) return <div className="more-item static">{body}</div>
  if (item.external)
    return (
      <a className="more-item" href={hrefFor(to)} target="_blank" rel="noopener">
        {body}
      </a>
    )
  return (
    <Link className="more-item" to={to}>
      {body}
    </Link>
  )
}
