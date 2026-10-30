import { useCallback, useEffect, useState } from 'react'
import { cloudErrorMessage } from '../cloud/client'
import { listAvailability, listPlayers, setAvailability, type Member } from '../cloud/players'
import { db, newId, type Availability, type Campaign, type DateOption, type SharedInfo, type World } from '../db'
import { Help } from '../help'
import { DiscordButton, getWebhook, postToDiscord } from '../discord'
import { Ico } from '../icons'
import { CalendarBlank, PushPin } from '@phosphor-icons/react'

/**
 * Picking the next session date. The GM proposes a few dates on the campaign; players who joined
 * the world answer yes, maybe or no for each, and the GM books the one that works.
 */

const ANSWERS: { value: Availability; icon: string; label: string }[] = [
  { value: 'yes', icon: '✅', label: 'Can make it' },
  { value: 'maybe', icon: '🤔', label: 'Maybe' },
  { value: 'no', icon: '❌', label: 'Can’t make it' },
]

/**
 * A suggested date in the viewer's own time. Dates saved with a full timestamp show in each
 * person's time zone (with the zone named), so an online group spread across zones agrees on the hour.
 */
export const showDate = (o: DateOption) => {
  const d = new Date(o.utc ?? o.at)
  if (isNaN(d.getTime())) return o.at
  return d.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', ...(o.utc ? { timeZoneName: 'short' } : {}) })
}

/** The booked date of a campaign's next session, while it's still ahead (or today). */
export function upcoming(campaign: Campaign) {
  const b = campaign.booked
  if (!b) return undefined
  const t = new Date(b.utc ?? b.at).getTime()
  return t > Date.now() - 12 * 3_600_000 ? b : undefined
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
      setError(cloudErrorMessage(e))
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

  if (!isGM && !options.length && !upcoming(campaign)) return null
  return (
    <section className="card scheduler">
      <div className="section-header">
        <h2>
          <Ico as={CalendarBlank} /> Next session <Help topic="schedule" />
        </h2>
        {isGM && synced && (
          <button className="ghost small" onClick={load}>
            Refresh answers
          </button>
        )}
      </div>
      {isGM && !synced && <p className="muted small">Turn on cloud sync and invite your players (World settings) so they can answer. You can still jot dates down here.</p>}
      {shared && !shared.memberOf && options.length > 0 && <p className="muted small">Ask your GM for an invite link to answer.</p>}
      {upcoming(campaign) && (
        <p>
          <Ico as={PushPin} /> Booked: <strong>{showDate(upcoming(campaign)!)}</strong>
          {upcoming(campaign)!.note && <span className="muted small"> · {upcoming(campaign)!.note}</span>}
        </p>
      )}
      {options.length === 0 && <p className="muted small">{isGM ? 'No dates suggested yet. Suggest a few and your players answer which they can make.' : 'No other dates suggested.'}</p>}
      <ul className="date-options">
        {options.map((o) => {
          const here = all.filter((a) => a.optionId === o.id)
          const mine = shared?.me ? here.find((a) => a.userId === shared.me)?.answer : undefined
          // Only players still in the group count, so it never reads "4 of 3".
          const yes = here.filter((a) => a.answer === 'yes' && people.some((p) => p.userId === a.userId)).length
          return (
            <li key={o.id}>
              <div className="row spread wrap">
                <div>
                  <strong>{showDate(o)}</strong>
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
                        if (!confirm(`Book ${showDate(o)}? This makes the next session with that date and clears the other suggestions.`)) return
                        await onBook(o.at.slice(0, 10))
                        await db.campaigns.update(campaign.id, { schedule: [], booked: o })
                        if (getWebhook(world.id) && confirm('Tell everyone on Discord?'))
                          postToDiscord(world.id, `📅 Next session: ${showDate(o)}`, `${campaign.name}${o.note ? `\n${o.note}` : ''}`).catch((e) =>
                            setError((e as Error).message),
                          )
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
                          setAvailability(shared.memberOf!, o.id, mine === a.value ? null : a.value).catch((e) => setError(cloudErrorMessage(e)))
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
      {isGM && options.length > 0 && (
        <DiscordButton
          worldId={world.id}
          title={`📅 When can you play? (${campaign.name})`}
          label="💬 Ask on Discord"
          text={() =>
            [
              ...options.map((o) => `• **${showDate(o)}**${o.note ? ` (${o.note})` : ''}`),
              '',
              synced ? 'Answer yes, maybe or no in the Warded Atlas.' : 'Reply with the dates you can make.',
            ].join('\n')
          }
        />
      )}
      {isGM && (
        <form
          className="row wrap"
          onSubmit={(e) => {
            e.preventDefault()
            if (!draft) return
            save([...options, { id: newId(), at: draft, utc: new Date(draft).toISOString(), ...(note.trim() ? { note: note.trim() } : {}) }])
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
