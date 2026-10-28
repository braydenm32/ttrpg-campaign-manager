import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Flashlight } from '@phosphor-icons/react'
import { db, type Entity, type Session } from '../db'
import { Help } from '../help'
import { Ico } from '../icons'
import { formatTime } from '../recorder'
import { partyOf } from '../sessions'
import { stripSecrets } from '../Markdown'
import { speakerName } from './transcript'

/**
 * Spotlight: who got time at the table. Worked out on this device from the transcripts (how long
 * each speaker talked, when the transcript tells speakers apart) and from how often each character
 * comes up. No AI and nothing sent anywhere.
 */

interface Bar {
  name: string
  value: number
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Every name a character might be called by: full name, first name and nicknames. */
function callNames(e: Entity) {
  const first = e.name.replace(/^(the|sir|lady|lord|brother|sister)\s+/i, '').split(/\s+/)[0]
  return [...new Set([e.name, first, ...(e.aliases ?? [])].filter((n) => n.length >= 3))]
}

export function spotlight(sessions: Session[], party: Entity[]) {
  const talk = new Map<string, number>()
  let transcribed = 0
  const said: string[] = []
  for (const s of sessions)
    for (const r of s.recordings) {
      const t = r.transcript
      if (!t || t.pending) continue
      transcribed++
      for (const l of t.lines) {
        said.push(l.text)
        const who = speakerName(t, l.speaker)
        if (who) talk.set(who, (talk.get(who) ?? 0) + Math.max(0, l.end - l.start))
      }
    }
  // Without a transcript, what the GM wrote about the session is the next best thing.
  const text = transcribed ? said.join('\n') : sessions.map((s) => `${stripSecrets(s.recap)}\n${s.notes}`).join('\n')
  const mentions: Bar[] = party.map((e) => {
    const re = new RegExp(`\\b(?:${callNames(e).map(escape).join('|')})\\b`, 'gi')
    return { name: e.name, value: text.match(re)?.length ?? 0 }
  })
  return {
    transcribed,
    talk: [...talk].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    mentions: mentions.sort((a, b) => b.value - a.value),
    fromNotes: !transcribed,
  }
}

function Bars({ bars, format }: { bars: Bar[]; format: (v: number) => string }) {
  const total = bars.reduce((n, b) => n + b.value, 0) || 1
  const top = Math.max(...bars.map((b) => b.value), 1)
  return (
    <ul className="spotlight-bars">
      {bars.map((b) => (
        <li key={b.name}>
          <span className="spotlight-name">{b.name}</span>
          <span className="spotlight-track">
            <span className="spotlight-fill" style={{ width: `${(b.value / top) * 100}%` }} />
          </span>
          <span className="spotlight-value small">
            {format(b.value)} · {Math.round((b.value / total) * 100)}%
          </span>
        </li>
      ))}
    </ul>
  )
}

export function SpotlightPanel({ session, entities }: { session: Session; entities: Entity[] }) {
  const [scope, setScope] = useState<'session' | 'campaign'>('session')
  const campaign = useLiveQuery(() => db.sessions.where({ worldId: session.worldId }).filter((s) => s.campaignId === session.campaignId).toArray(), [session.worldId, session.campaignId]) ?? []
  const sessions = scope === 'session' ? [session] : campaign
  const party = partyOf(entities, session.campaignId)
  const stats = spotlight(sessions, party)
  const hasAnything = stats.transcribed > 0 || sessions.some((s) => s.recap.trim() || s.notes.trim())
  if (!party.length || !hasAnything) return null
  const counted = stats.mentions.filter((m) => m.value > 0)
  const avg = stats.mentions.reduce((n, m) => n + m.value, 0) / Math.max(1, stats.mentions.length)
  const quiet = stats.mentions.length >= 3 && avg > 3 ? stats.mentions.filter((m) => m.value < avg * 0.5) : []
  return (
    <section className="card spotlight">
      <div className="row spread">
        <h2>
          <Ico as={Flashlight} /> Spotlight <Help topic="spotlight" />
        </h2>
        <div className="segmented small">
          <button className={scope === 'session' ? 'on' : ''} onClick={() => setScope('session')}>
            This session
          </button>
          <button className={scope === 'campaign' ? 'on' : ''} onClick={() => setScope('campaign')}>
            Whole campaign
          </button>
        </div>
      </div>
      {stats.talk.length > 0 && (
        <>
          <h3 className="small">Who talked</h3>
          <Bars bars={stats.talk} format={formatTime} />
        </>
      )}
      <h3 className="small">How often each character came up {stats.fromNotes ? '(in your notes and recap)' : '(in the transcript)'}</h3>
      {counted.length ? <Bars bars={stats.mentions} format={(v) => `${v}×`} /> : <p className="muted small">None of the party’s names came up yet.</p>}
      {quiet.length > 0 && (
        <p className="small">
          <b>{quiet.map((q) => q.name).join(' and ')}</b> got less of the spotlight. Maybe give {quiet.length > 1 ? 'them' : 'them a'} scene{quiet.length > 1 ? 's' : ''} next time: a clue from their past, an NPC who wants something from them.
        </p>
      )}
    </section>
  )
}
