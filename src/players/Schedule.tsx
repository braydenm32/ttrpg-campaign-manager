import { useCallback, useEffect, useState } from 'react'
import { listAvailability, listPlayers, setAvailability, type Member } from '../cloud/players'
import { db, newId, type Availability, type Campaign, type SharedInfo, type World } from '../db'
import { Help } from '../help'

/**
 * Picking the next session date. The GM proposes a few dates on the campaign; players who joined
 * the world answer yes, maybe or no for each, and the GM books the one that works.
 */

const ANSWERS: { value: Availability; icon: string; label: string }[] = [
  { value: 'yes', icon: '✅', label: 'Can make it' },
  { value: 'maybe', icon: '🤔', label: 'Maybe' },
  { value: 'no', icon: '❌', label: 'Can’t make it' },
]

const showDate = (at: string) => {
  const d = new Date(at)
  return isNaN(d.getTime()) ? at : d.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

type Answers = NonNullable<SharedInfo['availability']>

export function SessionScheduler({ world, campaign, isGM, onBook }: { world: World; campaign: Campaign; isGM: boolean; onBook: (date: string) => Promise<void> }) {
  const options = [...(campaign.schedule ?? [])].sort((a, b) => a.at.localeCompare(b.at))
  const synced = !!world.cloud?.enabled && !world.shared
  const [members, setMembers] = useState<Member[]>([])
  const [answers, setAnswers] = useState<Answers>([])
  const [draft, setDraft] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!synced) return
    try {
      const [p, a] = await Promise.all([listPlayers(world.id), listAvailability(world.id)])
      setMembers(p.members.filter((m) => m.role === 'player'))
      setAnswers(a)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [synced, world.id])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  // Players see the answers that came with their copy of the world.
  const shared = world.shared
  const people: { userId: string; name: string }[] = shared ? (shared.members ?? []).filter((m) => m.role === 'player') : members
  const all: Answers = shared ? (shared.availability ?? []) : answers
  const save = (schedule: Campaign['schedule']) => db.campaigns.update(campaign.id, { schedule })

  if (!isGM && !options.length) return null
  return (
    <section className="card scheduler">
      <div className="section-header">
        <h2>
          📅 Next session <Help topic="schedule" />
        </h2>
        {isGM && synced && (
          <button className="ghost small" onClick={load}>
            Refresh answers
          </button>
        )}
      </div>
      {isGM && !synced && <p className="muted small">Turn on cloud sync and invite your players (World settings) so they can answer. You can still jot dates down here.</p>}
      {shared && !shared.memberOf && options.length > 0 && <p className="muted small">Ask your GM for an invite link to answer.</p>}
      {options.length === 0 && <p className="muted small">No dates suggested yet.</p>}
      <ul className="date-options">
        {options.map((o) => {
          const here = all.filter((a) => a.optionId === o.id)
          const mine = shared?.me ? here.find((a) => a.userId === shared.me)?.answer : undefined
          const yes = here.filter((a) => a.answer === 'yes').length
          return (
            <li key={o.id}>
              <div className="row spread wrap">
                <div>
                  <strong>{showDate(o.at)}</strong>
                  {o.note && <span className="muted small"> · {o.note}</span>}
                  {people.length > 0 && (
                    <span className="muted small">
                      {' '}
                      · {yes} of {people.length} can make it
                    </span>
                  )}
                </div>
                {isGM ? (
                  <div className="row">
                    <button
                      className="small primary"
                      onClick={async () => {
                        if (!confirm(`Book ${showDate(o.at)}? This makes the next session with that date and clears the other suggestions.`)) return
                        await onBook(o.at.slice(0, 10))
                        await save([])
                      }}
                    >
                      Book it
                    </button>
                    <button className="ghost small" aria-label="Remove this date" onClick={() => save(options.filter((x) => x.id !== o.id))}>
                      ×
                    </button>
                  </div>
                ) : shared?.memberOf ? (
                  <div className="segmented">
                    {ANSWERS.map((a) => (
                      <button
                        key={a.value}
                        className={mine === a.value ? 'on' : ''}
                        title={a.label}
                        onClick={() =>
                          setAvailability(shared.memberOf!, o.id, mine === a.value ? null : a.value).catch((e) => setError((e as Error).message))
                        }
                      >
                        {a.icon}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              {people.length > 0 && (
                <div className="answers small">
                  {people.map((p) => {
                    const a = here.find((x) => x.userId === p.userId)?.answer
                    return (
                      <span key={p.userId} className={`answer ${a ?? 'none'}`} title={a ? ANSWERS.find((x) => x.value === a)!.label : 'Hasn’t answered'}>
                        {a ? ANSWERS.find((x) => x.value === a)!.icon : '⏳'} {p.name}
                      </span>
                    )
                  })}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {isGM && (
        <form
          className="row wrap"
          onSubmit={(e) => {
            e.preventDefault()
            if (!draft) return
            save([...options, { id: newId(), at: draft, ...(note.trim() ? { note: note.trim() } : {}) }])
            setDraft('')
            setNote('')
          }}
        >
          <input type="datetime-local" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Date and time" />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional), e.g. online" />
          <button disabled={!draft}>+ Suggest date</button>
        </form>
      )}
      {error && <p className="error small">{error}</p>}
    </section>
  )
}
