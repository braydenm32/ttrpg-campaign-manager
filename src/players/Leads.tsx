import { Link, useSearchParams } from 'react-router-dom'
import type { Entity } from '../db'
import { closedLeads, isActiveLead, openLeads, tickingClocks } from '../counts'
import { ClockFace } from '../clocks'
import { PagePicker } from '../PagePicker'
import { questProgress } from '../quests'
import { threadLinks } from '../threads'
import { plainLinks } from '../text'
import { pagePath, worldPath } from '../paths'

/**
 * The party's leads, one list everywhere: the open quests and loose threads the players know about
 * (the ones under way first), then the clocks that are ticking. The Common Room's Leads tab and the
 * players' /threads page both show this, so "Leads" means one thing and one number.
 */

/** The marks beside a lead: under way, a quest, pressing. */
export function LeadChips({ e }: { e: Entity }) {
  return (
    <>
      {isActiveLead(e) && <span className="lead-chip on">{e.type === 'quest' ? 'Active' : 'In play'}</span>}
      {e.type === 'quest' && !isActiveLead(e) && <span className="lead-chip">Quest</span>}
      {e.threadUrgency === 'high' && <span className="lead-chip warn">Pressing</span>}
    </>
  )
}

/** One lead on a line: its marks, its name and (with `full`) its summary and progress. */
export function LeadRow({ e, worldId, full }: { e: Entity; worldId: string; full?: boolean }) {
  const progress = e.type === 'quest' ? questProgress(e) : ''
  return (
    <li className="lead-row">
      <div className="lead-chips">
        <LeadChips e={e} />
      </div>
      <div className="lead-text">
        <Link className="lead-name" to={pagePath(worldId, e.id)}>
          {e.name}
        </Link>
        {(e.summary || progress) && (
          <div className={`muted small ${full ? '' : 'clamp-2'}`}>
            {e.summary && plainLinks(e.summary)}
            {progress && `${e.summary ? ' · ' : ''}${progress}`}
          </div>
        )}
      </div>
    </li>
  )
}

/** Clocks the party knows about, with how far each has run. */
export function ClockList({ entities, worldId, size = 36 }: { entities: Entity[]; worldId: string; size?: number }) {
  const clocks = tickingClocks(entities)
  if (!clocks.length) return null
  return (
    <ul className="room-clocks">
      {clocks.map(({ clock, owner }) => (
        <li key={clock.id}>
          <Link className="room-clock" to={pagePath(worldId, owner.id)}>
            <ClockFace clock={clock} size={size} />
            <span>
              {clock.name}
              <small className="muted">
                {' '}
                · {clock.filled} of {Math.max(1, clock.segments)} · {owner.name}
              </small>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

/** The whole list, with a search and an "involving" filter once there are enough leads to need them. */
export function LeadsView({ worldId, entities }: { worldId: string; entities: Entity[] }) {
  const [params, setParams] = useSearchParams()
  const q = (params.get('q') ?? '').trim().toLowerCase()
  const involving = params.get('involving') ?? ''
  // Typing replaces the address; it doesn't add a step to Back for each letter.
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }
  const all = openLeads(entities)
  const done = closedLeads(entities)
  const match = (e: Entity) =>
    (!q || e.name.toLowerCase().includes(q) || e.summary.toLowerCase().includes(q)) && (!involving || threadLinks(e, entities, false).some((x) => x.id === involving))
  const shown = all.filter(match)
  const others = entities.filter((e) => e.type !== 'thread' && e.type !== 'quest')
  const clocks = tickingClocks(entities)

  return (
    <div className="leads-view">
      {all.length > 6 && (
        <div className="row wrap leads-filters">
          <input type="search" value={params.get('q') ?? ''} onChange={(e) => set('q', e.target.value)} placeholder="Find a lead" aria-label="Find a lead" />
          <PagePicker entities={others} value={involving} onPick={(id) => set('involving', id)} placeholder="Involving anyone or anywhere" />
        </div>
      )}
      {all.length === 0 ? (
        <p className="muted">No open leads yet. When your GM shares a quest, a rumour or a mystery, it shows here.</p>
      ) : shown.length === 0 ? (
        <p className="muted">No lead matches.</p>
      ) : (
        <ul className="lead-list">
          {shown.map((e) => (
            <LeadRow key={e.id} e={e} worldId={worldId} full />
          ))}
        </ul>
      )}
      {clocks.length > 0 && (
        <section className="leads-clocks">
          <h2>Ticking</h2>
          <ClockList entities={entities} worldId={worldId} />
          <Link className="small" to={`${worldPath(worldId)}/clocks`}>
            All clocks, with the ones that ran out
          </Link>
        </section>
      )}
      {done.length > 0 && (
        <details className="leads-done">
          <summary>Done and tied off ({done.length})</summary>
          <ul className="lead-list">
            {done.map((e) => (
              <li key={e.id} className="lead-row">
                <div className="lead-chips">
                  <span className="lead-chip">{e.type === 'quest' ? (e.questStatus === 'failed' ? 'Failed' : 'Done') : 'Tied off'}</span>
                </div>
                <div className="lead-text">
                  <Link className="lead-name" to={pagePath(worldId, e.id)}>
                    {e.name}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
