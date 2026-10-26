import { binSession } from '../bin'
import { useLiveQuery } from 'dexie-react-hooks'
import { Help } from '../help'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { RecapPanel } from '../ai/RecapPanel'
import { TranscriptPanel } from '../ai/TranscriptPanel'
import { Empty, VisibilityToggle } from '../components'
import { db, ENTITY_LABELS, type Entity, type Recording, type Session } from '../db'
import { formatBytes, useAssetUrl, useVisibleEntities, useWorld } from '../hooks'
import { Markdown } from '../Markdown'
import { SecretTextarea } from '../SecretTextarea'
import { formatTime, recordingSupported, systemAudioSupported, type RecordSource } from '../recorder'
import { addBookmark, beginRecording, discardRecording, endRecording, recoverRecording, unsavedRecordings, useLiveRecording } from '../recordingStore'
import { ThreadCard } from '../ThreadCard'
import { newThread, useWorldSessions } from '../threads'
import { useViewMode } from '../viewMode'
import { PrepSheet } from '../prep'
import { PrintButton } from '../print'
import { CalDateInput, formatDate } from '../calendar'
import { DiscordButton, forDiscord } from '../discord'
import { EndSessionChecklist } from '../EndSession'

export default function SessionPage() {
  const { worldId, world } = useWorld()
  const { sessionId = '' } = useParams()
  const { isGM, canSee } = useViewMode()
  const navigate = useNavigate()
  const session = useLiveQuery(() => db.sessions.get(sessionId), [sessionId])
  const campaign = useLiveQuery(() => (session ? db.campaigns.get(session.campaignId) : undefined), [session?.campaignId])
  const entities = useVisibleEntities(worldId)
  const [params, setParams] = useSearchParams()
  const tab = (['notes', 'recap', 'prep'] as const).find((t) => t === params.get('tab')) ?? 'notes'
  const setTab = (t: 'notes' | 'recap' | 'prep') => setParams(t === 'notes' ? {} : { tab: t }, { replace: true })

  if (session === undefined) return null
  if (session === null || !canSee(session.visibility) || (campaign && campaign.worldId !== worldId))
    return <Empty>Session not found.</Empty>
  const update = (patch: Partial<Session>) => db.sessions.update(session.id, patch)
  const featured = entities.filter((e) => session.entityIds.includes(e.id))

  if (!isGM)
    return (
      <div className="page">
        {campaign && <Link to={`/w/${worldId}/c/${campaign.id}`}>← {campaign.name}</Link>}
        <h1>
          #{session.number} {session.title}
        </h1>
        <div className="row spread">
          <div className="muted">
            {session.date}
            {session.worldDate && world?.calendar && ` · in the world: ${formatDate(world.calendar, session.worldDate)}`}
          </div>
          <PrintButton to={`/w/${worldId}/print/s/${session.id}`} />
        </div>
        {session.recap ? (
          <Markdown text={session.recap} entities={entities} worldId={worldId} showSecrets={false} />
        ) : (
          <Empty>No recap yet.</Empty>
        )}
        <FeaturedList worldId={worldId} entities={featured} />
      </div>
    )

  return (
    <div className="page">
      {campaign && <Link to={`/w/${worldId}/c/${campaign.id}`}>← {campaign.name}</Link>}
      <header className="page-header">
        <div className="row">
          <span className="session-number">#</span>
          <input
            className="num-input"
            type="number"
            value={session.number}
            onChange={(e) => update({ number: Number(e.target.value) || 0 })}
          />
          <input className="title-input" value={session.title} onChange={(e) => update({ title: e.target.value })} />
        </div>
        <div className="row">
          <input type="date" value={session.date} onChange={(e) => update({ date: e.target.value })} />
          <VisibilityToggle value={session.visibility} onChange={(v) => update({ visibility: v })} />
          <PrintButton to={`/w/${worldId}/print/s/${session.id}`} />
          <Link className="button primary" to={`/w/${worldId}/s/${session.id}/lectern`}>
            📖 Run at the Lectern
          </Link>
          {params.get('end') !== '1' && (
            <button title="Recap, show players, next session" onClick={() => setParams({ end: '1' }, { replace: true })}>
              🏁 Wrap up
            </button>
          )}
        </div>
      </header>

      {world?.calendar && (
        <div className="row wrap small">
          <span>
            📅 In the world <Help topic="worldToday" />
          </span>
          <CalDateInput calendar={world.calendar} value={session.worldDate} onChange={(worldDate) => update({ worldDate })} />
          {world.calendar.today && (
            <button className="small" onClick={() => update({ worldDate: world.calendar!.today })}>
              Use today ({formatDate(world.calendar, world.calendar.today, false)})
            </button>
          )}
        </div>
      )}
      {world && params.get('end') === '1' && (
        <EndSessionChecklist world={world} session={session} onClose={() => setParams({}, { replace: true })} />
      )}
      <div id="session-recorder">
        <Recorder session={session} />
      </div>
      <div id="session-recap">{world && <RecapPanel world={world} session={session} entities={entities} />}</div>

      <div className="segmented tabs">
        <button className={tab === 'prep' ? 'on' : ''} onClick={() => setTab('prep')}>
          📋 Prep
        </button>
        <button className={tab === 'notes' ? 'on' : ''} onClick={() => setTab('notes')}>
          🔒 GM notes
        </button>
        <button className={tab === 'recap' ? 'on' : ''} onClick={() => setTab('recap')}>
          👁 Player recap
        </button>
      </div>
      <Help topic="session" />
      {tab === 'prep' ? (
        <PrepSheet session={session} entities={entities} worldId={worldId} />
      ) : tab === 'notes' ? (
        <textarea
          rows={14}
          value={session.notes}
          placeholder="Prep, what happened, loose threads… Use [[Name]] to link pages."
          onChange={(e) => update({ notes: e.target.value })}
        />
      ) : (
        <SecretTextarea
          worldId={worldId}
          rows={14}
          value={session.recap}
          placeholder="What the players get to read. Shown in the player view once this session is revealed."
          onChange={(v) => update({ recap: v })}
        />
      )}
      {tab === 'recap' && session.recap.trim() && (
        <DiscordButton
          worldId={worldId}
          label="💬 Post recap to Discord"
          title={`Session ${session.number}: ${session.title}`}
          text={() => forDiscord(session.recap)}
          confirmText={
            session.visibility === 'players'
              ? undefined
              : 'This session is still GM only. Post the player recap to Discord anyway? Secret passages are left out.'
          }
        />
      )}
      {tab !== 'prep' && (
        <details>
          <summary>Preview</summary>
          <Markdown text={tab === 'notes' ? session.notes : session.recap} entities={entities} worldId={worldId} showSecrets />
        </details>
      )}

      <section>
        <h2>Featured in this session</h2>
        <FeaturedList
          worldId={worldId}
          entities={featured}
          onRemove={(id) => update({ entityIds: session.entityIds.filter((x) => x !== id) })}
        />
        <select
          value=""
          onChange={(e) => e.target.value && update({ entityIds: [...session.entityIds, e.target.value] })}
        >
          <option value="">+ Add an NPC, place, item…</option>
          {entities
            .filter((e) => !session.entityIds.includes(e.id))
            .map((e) => (
              <option key={e.id} value={e.id}>
                {ENTITY_LABELS[e.type].icon} {e.name}
              </option>
            ))}
        </select>
      </section>

      <SessionThreads sessionId={session.id} entities={entities} worldId={worldId} />

      <div className="row end">
        <button
          className="danger"
          onClick={async () => {
            if (!confirm('Delete this session and its recordings? You can restore it from World settings for a month.')) return
            await binSession(session.id)
            navigate(campaign ? `/w/${worldId}/c/${campaign.id}` : `/w/${worldId}`)
          }}
        >
          Delete session
        </button>
      </div>
    </div>
  )
}

function FeaturedList({
  worldId,
  entities,
  onRemove,
}: {
  worldId: string
  entities: { id: string; name: string; type: keyof typeof ENTITY_LABELS }[]
  onRemove?: (id: string) => void
}) {
  if (!entities.length) return null
  return (
    <div className="tags">
      {entities.map((e) => (
        <span key={e.id} className="tag">
          <Link to={`/w/${worldId}/e/${e.id}`}>
            {ENTITY_LABELS[e.type].icon} {e.name}
          </Link>
          {onRemove && (
            <button onClick={() => onRemove(e.id)} aria-label={`Remove ${e.name}`}>
              ×
            </button>
          )}
        </span>
      ))}
    </div>
  )
}

function Recorder({ session }: { session: Session }) {
  const [source, setSource] = useState<RecordSource>('mic')
  const live = useLiveRecording()
  const active = live?.sessionId === session.id ? live : undefined
  const [elapsed, setElapsed] = useState(0)
  const [mark, setMark] = useState('')
  const [error, setError] = useState('')
  // Recordings cut off by a crash or a closed tab, waiting to be put back together.
  const cutOff = useLiveQuery(() => unsavedRecordings(session.id), [session.id, live?.recordingId]) ?? []

  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setElapsed((Date.now() - active.rec.startedAt) / 1000), 500)
    return () => clearInterval(t)
  }, [active])

  const start = async () => {
    setError('')
    try {
      setElapsed(0)
      await beginRecording(session, source)
    } catch (err) {
      setError((err as Error).message || 'Could not start recording.')
    }
  }
  const stop = () => endRecording().catch((err) => setError((err as Error).message))
  const bookmarks = active?.bookmarks ?? []

  return (
    <section className="recorder">
      <h2>
        🎙️ Recording <Help topic="recording" />
      </h2>
      {cutOff.map((r) => (
        <div key={r.recordingId} className="player-banner recover-recording">
          <span>
            ⚠️ A recording from {new Date(r.startedAt).toLocaleString()} wasn’t finished (the app closed while it was running). About{' '}
            {formatTime(r.seconds)} ({formatBytes(r.bytes)}) was saved as it went.
          </span>
          <button className="primary small" onClick={() => recoverRecording(session.id, r.recordingId, session.number)}>
            Recover it
          </button>
          <button className="small ghost" onClick={() => confirm('Throw this recording away?') && discardRecording(r.recordingId)}>
            Discard
          </button>
        </div>
      ))}
      {live && !active && (
        <p className="muted small">Session #{live.sessionNumber} is being recorded. Stop it there before starting another.</p>
      )}
      {!recordingSupported() ? (
        <p className="muted">Recording isn't supported on this device or browser.</p>
      ) : active ? (
        <>
          <div className="row">
            <span className="rec-dot" /> <strong>{formatTime(elapsed)}</strong>
            <span className="muted">{formatBytes(active.bytes)}</span>
            <button className="danger" onClick={stop}>
              ■ Stop & save
            </button>
          </div>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault()
              addBookmark(mark)
              setMark('')
            }}
          >
            <input value={mark} onChange={(e) => setMark(e.target.value)} placeholder="Bookmark this moment (e.g. 'party meets the lich')" />
            <button>🔖 Bookmark</button>
          </form>
          {bookmarks.length > 0 && (
            <ul className="bookmarks">
              {bookmarks.map((b) => (
                <li key={b.id}>
                  <code>{formatTime(b.t)}</code> {b.text}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <div className="row wrap">
          <p className="notice small">
            Ask everyone at the table before you record, and record only if they agree. In several Australian states it’s an offence to
            record a private conversation without everyone’s consent.
          </p>
          <span className="muted small">Keeps recording while you use the rest of the app, and saves as it goes.</span>
          <select value={source} onChange={(e) => setSource(e.target.value as RecordSource)}>
            <option value="mic">In person: this device's microphone</option>
            {systemAudioSupported() && <option value="mic+system">Online: microphone + call audio (Discord, Zoom…)</option>}
          </select>
          <button className="primary" onClick={start} disabled={!!live}>
            ● Start recording
          </button>
        </div>
      )}
      {source === 'mic+system' && !active && (
        <p className="muted small">
          You'll be asked what to share. Pick the browser tab or screen with your call, and turn on "Share audio".
        </p>
      )}
      {error && <p className="error">{error}</p>}
      {session.recordings.map((r) => (
        <Playback key={r.assetId} sessionId={session.id} recording={r} />
      ))}
    </section>
  )
}

function Playback({ sessionId, recording }: { sessionId: string; recording: Recording }) {
  const { worldId } = useWorld()
  const { assetId, bookmarks, startedAt } = recording
  const url = useAssetUrl(assetId)
  const onThisDevice = useLiveQuery(() => db.assets.get(assetId).then((a) => !!a), [assetId])
  const audio = useRef<HTMLAudioElement>(null)
  // Recordings are big, so they stay on the device that made them; the transcript travels.
  if (onThisDevice === false)
    return (
      <div className="playback">
        <div className="muted small">
          Recorded {new Date(startedAt).toLocaleString()} on another device. The audio stays there; its transcript is here.
        </div>
        <TranscriptPanel sessionId={sessionId} recording={recording} worldId={worldId} seek={() => {}} />
      </div>
    )
  if (!url) return null
  const seek = (t: number) => {
    if (!audio.current) return
    audio.current.currentTime = t
    audio.current.play()
  }
  return (
    <div className="playback">
      <div className="muted small">Recorded {new Date(startedAt).toLocaleString()}</div>
      <audio
        ref={audio}
        controls
        src={url}
        preload="metadata"
        onLoadedMetadata={(e) => {
          // Browser-made WebM files have no duration header, which breaks seeking.
          // Jumping to the end forces the browser to work it out.
          const a = e.currentTarget
          if (a.duration === Infinity) {
            a.currentTime = 1e101
            a.addEventListener('durationchange', () => (a.currentTime = 0), { once: true })
          }
        }}
      />
      {bookmarks.length > 0 && (
        <ul className="bookmarks">
          {bookmarks.map((b) => (
            <li key={b.id}>
              <button
                className="link"
                onClick={() => seek(b.t)}
              >
                <code>{formatTime(b.t)}</code>
              </button>{' '}
              {b.text}
            </li>
          ))}
        </ul>
      )}
      <TranscriptPanel sessionId={sessionId} recording={recording} worldId={worldId} seek={seek} />
    </div>
  )
}

/** Threads this session raised or tied off, plus a quick way to add one. */
function SessionThreads({ sessionId, entities, worldId }: { sessionId: string; entities: Entity[]; worldId: string }) {
  const sessions = useWorldSessions(worldId)
  const [name, setName] = useState('')
  const threads = entities.filter((e) => e.type === 'thread' && (e.raisedIn === sessionId || e.tiedOffIn === sessionId))
  return (
    <section>
      <h2>🧵 Loose threads from this session</h2>
      {threads.map((t) => (
        <ThreadCard key={t.id} thread={t} entities={entities} sessions={sessions} worldId={worldId} currentSessionId={sessionId} />
      ))}
      <form
        className="row"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim()) return
          await db.entities.add(newThread(worldId, name.trim(), sessionId))
          setName('')
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a thread this session left hanging" />
        <button disabled={!name.trim()}>Add</button>
      </form>
      <Link className="small" to={`/w/${worldId}/threads`}>
        See all loose threads
      </Link>
    </section>
  )
}
