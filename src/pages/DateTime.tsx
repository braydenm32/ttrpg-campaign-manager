import { Link } from 'react-router-dom'
import { CalendarBlank } from '@phosphor-icons/react'
import { cleanCalendar, MonthGrid, WorldToday } from '../calendar'
import { Empty, Skeleton } from '../components'
import { GameClockCard, GameTimeBar } from '../gameClock'
import { Help } from '../help'
import { useVisibleEntities, useWorld } from '../hooks'
import { Ico } from '../icons'
import { worldPath } from '../paths'
import { useWorldSessions } from '../threads'
import { useViewMode } from '../viewMode'
import '../desk.css'

/**
 * Date and time (`/w/<world>/date`), opened from the date in the top bar: the world's date with
 * "move the date on", today's weather, the in-game time with all its controls, and this month of the
 * calendar, with a link to set the calendar up. Players get what they already see elsewhere: the
 * date, season, moons and weather, the in-game time only while the GM shows it, and a month with the
 * events and sessions they can see (never GM-only ones). The Lectern keeps its own In-game time panel
 * for play.
 */
export default function DateTime() {
  const { worldId, world } = useWorld()
  const { isGM } = useViewMode()
  const entities = useVisibleEntities(worldId)
  const sessions = useWorldSessions(worldId)
  if (!world) return <Skeleton />
  const gm = isGM && !world.shared
  const cal = cleanCalendar(world.calendar)
  const w = worldPath(worldId)
  const events = entities.filter((e) => e.type === 'event')
  return (
    <div className="page date-time">
      <header className="page-header">
        <div>
          <h1>
            <Ico as={CalendarBlank} /> Date and time <Help topic={gm ? 'dateAndTime' : 'dateAndTimePlayers'} />
          </h1>
          <p className="lead">{gm ? 'The world’s date, its weather and the time of day, in one place.' : 'The date in the world, its weather and the time of day.'}</p>
        </div>
      </header>
      {cal?.today ? (
        <section className="card date-today">
          <WorldToday world={world} isGM={gm} />
        </section>
      ) : (
        <Empty>
          {gm ? (
            <>
              This world has no calendar yet. <Link to={`${w}/settings?at=calendar`}>Set up the calendar</Link> to keep its date, seasons and weather.
            </>
          ) : (
            'Your GM hasn’t set a date for this world.'
          )}
        </Empty>
      )}
      {gm ? <GameClockCard world={world} /> : <GameTimeBar world={world} />}
      {cal?.today && (
        <section className="card date-month">
          <div className="section-header">
            <h2>This month</h2>
            <span className="row wrap small">
              <Link to={`${w}/timeline?view=month`}>On the Timeline</Link>
              {gm && <Link to={`${w}/settings?at=calendar`}>Set up the calendar</Link>}
            </span>
          </div>
          {/* Keyed by today's month, so moving the date on into a new month shows that month. */}
          <MonthGrid key={`${cal.today.year}-${cal.today.month}`} world={{ ...world, calendar: cal }} events={events} sessions={sessions} />
        </section>
      )}
    </div>
  )
}
