import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ClockCounterClockwise, Trophy } from '@phosphor-icons/react'
import { db, type Entity, type Session } from './db'
import { Help } from './help'
import { HighlightLine } from './highlights'
import { Ico } from './icons'
import { Markdown } from './Markdown'
import { worldPath } from './paths'
import { isPlayed, notesFromPlay, sessionsBefore } from './sessions'
import { showDay } from './text'
import { useViewMode } from './viewMode'

/**
 * "Last time", at the top of a session's Prepare: the recap of the session before this one in the
 * same campaign (see sessionsBefore), and the awards given at the end of it, to read while planning.
 * With no recap written yet, the GM's own "What happened" notes from that session show instead.
 * A long recap shows its first lines with "Show all of the recap" (it grows in place; nothing
 * scrolls inside the page). Only the GM gets it: Prepare is a GM screen, and this draws nothing in
 * the player view.
 */
export function LastTime({ session, entities, worldId }: { session: Session; entities: Entity[]; worldId: string }) {
  const { isGM } = useViewMode()
  const last = useLiveQuery(
    async () => sessionsBefore(await db.sessions.where({ campaignId: session.campaignId }).toArray(), session)[0] ?? null,
    [session.campaignId, session.number],
  )
  if (!isGM || last === undefined) return null
  const to = last && `${worldPath(worldId)}/s/${last.id}`
  const name = last && `#${last.number} ${last.title}`.trim()
  const highlights = last?.highlights ?? []
  const awards = highlights.filter((h) => h.kind === 'award')
  const others = highlights.filter((h) => h.kind !== 'award')
  // Made ahead and not played yet, with nothing written on it: one line says so.
  // With no recap written, the GM's own notes on what happened are the next best thing to read.
  const happened = last ? notesFromPlay(last).trim() : ''
  const notYet = !!last && !isPlayed(last) && !last.startedAt && !last.recap.trim() && !highlights.length && !happened
  return (
    <section className="card wrap-card last-time" id="last-time">
      <div className="plan-head">
        <h2>
          <Ico as={ClockCounterClockwise} /> Last time <Help topic="lastTime" />
        </h2>
        {last && (
          <Link className="button small last-open" to={to!}>
            Open #{last.number}
          </Link>
        )}
      </div>
      {!last ? (
        <p className="muted last-none">This is the first session, so there is no last time yet.</p>
      ) : notYet ? (
        <p className="muted last-none">{name} has not been played yet. Its recap and awards will show here once it has.</p>
      ) : (
        <>
          <p className="muted small last-which">
            {name}
            {last.date && ` · ${showDay(last.date)}`}
          </p>
          <h3>Recap</h3>
          {last.recap.trim() ? (
            <LastRecap text={last.recap} entities={entities} worldId={worldId} />
          ) : (
            <>
              <p className="muted last-none">{name} has no recap yet.</p>
              <Link className="last-write" to={`${to}?tab=recap`}>
                Write it in #{last.number}’s Wrap up
              </Link>
              {happened && (
                <>
                  <h3>What happened (your notes)</h3>
                  <LastRecap text={happened} entities={entities} worldId={worldId} what="your notes" />
                </>
              )}
            </>
          )}
          <h3>
            <Ico as={Trophy} /> Awards
          </h3>
          {awards.length > 0 ? (
            <ul className="highlight-list last-awards">
              {awards.map((h) => (
                <li key={h.id}>
                  <HighlightLine h={h} entities={entities} worldId={worldId} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted last-none">No awards were given last time.</p>
          )}
          {others.length > 0 && (
            <details className="last-others">
              <summary>Moments and quotes ({others.length})</summary>
              <ul className="highlight-list">
                {others.map((h) => (
                  <li key={h.id}>
                    <HighlightLine h={h} entities={entities} worldId={worldId} />
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  )
}

/**
 * Last session's recap, read in place. One taller than a few lines is cut short (and faded out)
 * with "Show all of the recap" under it; a short one shows whole, with no button. It's measured as
 * drawn, so the same recap can be short on a laptop and folded on a phone.
 */
function LastRecap({ text, entities, worldId, what = 'the recap' }: { text: string; entities: Entity[]; worldId: string; what?: string }) {
  const [all, setAll] = useState(false)
  const [tall, setTall] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = box.current
    if (!el || all) return
    // Told once when it starts watching, and again whenever the box changes size (a turned phone, a picture loading).
    const watch = new ResizeObserver(() => setTall(el.scrollHeight > el.clientHeight + 8))
    watch.observe(el)
    return () => watch.disconnect()
  }, [all, text])
  return (
    <>
      {/* The GM reads it with its GM-only passages, as in the recap's Preview in Wrap up. */}
      <div ref={box} className={`last-recap ${all ? '' : 'folded'} ${tall && !all ? 'tall' : ''}`}>
        <Markdown text={text} entities={entities} worldId={worldId} showSecrets />
      </div>
      {tall && (
        <button type="button" className="link show-all" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? `Show less of ${what}` : `Show all of ${what}`}
        </button>
      )}
    </>
  )
}
