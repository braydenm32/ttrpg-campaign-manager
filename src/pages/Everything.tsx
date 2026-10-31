import { Link } from 'react-router-dom'
import { ENTITY_LABELS, ENTITY_TYPES } from '../db'
import { Help } from '../help'
import { useVisibleEntities, useWorld } from '../hooks'
import { TypeIcon } from '../icons'
import { countByType } from '../counts'
import { useViewMode } from '../viewMode'
import { typePath } from '../paths'

/**
 * Everything: every kind of page in the world, with how many there are, including the GM's own
 * types. It's the last tab of the Atlas (players: The World), for the kinds without a tab of their
 * own (items, events, your own types…). Players see only kinds they have pages of.
 */
export default function Everything() {
  const { worldId, world } = useWorld()
  const { isGM } = useViewMode()
  const entities = useVisibleEntities(worldId)
  const counts = countByType(entities, world)
  const n = (key: string) => counts.get(key) ?? 0
  const kinds = [
    ...ENTITY_TYPES.filter((t) => t !== 'custom').map((t) => ({ key: t, to: typePath(worldId, t), label: ENTITY_LABELS[t].many, icon: <TypeIcon type={t} size="1.4em" /> })),
    ...(world?.customTypes ?? []).map((c) => ({ key: `custom:${c.id}`, to: typePath(worldId, 'custom', c.id), label: c.many, icon: <TypeIcon type="custom" custom={c} size="1.4em" /> })),
    { key: 'other', to: typePath(worldId, 'custom'), label: ENTITY_LABELS.custom.many, icon: <TypeIcon type="custom" size="1.4em" /> },
  ].filter((k) => n(k.key) > 0 || (isGM && k.key !== 'other'))
  return (
    <div className="page everything-page">
      <header className="page-header">
        <div>
          <h1>
            Everything <Help topic="everything" />
          </h1>
          <p className="lead">{entities.length} pages, by kind.</p>
        </div>
      </header>
      <ul className="everything-grid">
        {kinds.map((k) => (
          <li key={k.key}>
            <Link className={`card everything-card ${n(k.key) ? '' : 'empty-kind'}`} to={k.to}>
              {k.icon}
              <b>{k.label}</b>
              <span className="count">{n(k.key)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
