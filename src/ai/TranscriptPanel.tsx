import { useEffect, useRef, useState } from 'react'
import { Help } from '../help'
import { Link } from 'react-router-dom'
import { db, type Recording, type Transcript, type TranscriptLine } from '../db'
import { useLiveQuery } from 'dexie-react-hooks'
import { formatTime } from '../recorder'
import { DEVICE_MODELS, useAiSettings } from './settings'
import { saveTranscript, speakerLabels, speakerName } from './transcript'
import { Ico } from '../icons'
import { Cloud, Desktop, Scroll } from '@phosphor-icons/react'
import { worldPath } from '../paths'

type Engine = 'device' | 'cloud'

/**
 * Under each recording: turn it into text (on this device, or in the cloud with speaker labels),
 * then read it, search it, click a line to hear it, and name the speakers.
 */
export function TranscriptPanel({
  sessionId,
  recording,
  worldId,
  seek,
  focus,
}: {
  sessionId: string
  recording: Recording
  worldId: string
  seek: (t: number) => void
  /** A moment (in seconds) to open the transcript at and highlight. */
  focus?: number
}) {
  const t = recording.transcript
  const [job, setJob] = useState<{ engine: Engine; detail: string; fraction: number; abort: AbortController }>()
  const [error, setError] = useState('')
  const settings = useAiSettings()

  const running = useRef<AbortController>(undefined)
  const busy = !!job

  // Leaving the page would stop on-device transcription; ask first. (It can carry on later.)
  useEffect(() => {
    if (!busy) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [busy])
  // Moving to another page in the app stops the job too; progress so far is already saved.
  useEffect(() => () => running.current?.abort(), [])

  const run = async (engine: Engine) => {
    setError('')
    const asset = await db.assets.get(recording.assetId)
    if (!asset) return setError('The audio file for this recording is missing.')
    const abort = new AbortController()
    running.current = abort
    const progress = (detail: string, fraction = 0) => setJob({ engine, detail, fraction, abort })
    progress('Starting…')
    try {
      if (engine === 'device') await runDevice(asset.blob, abort.signal, progress)
      else await runCloud(asset.blob, abort.signal, progress)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError((err as Error).message || 'Transcription failed.')
    } finally {
      running.current = undefined
      setJob(undefined)
    }
  }

  const runDevice = async (blob: Blob, signal: AbortSignal, progress: (d: string, f?: number) => void) => {
    const { transcribeOnDevice, recordingDuration } = await import('./device')
    const model = DEVICE_MODELS[settings.deviceModel].id
    // Carry on from an earlier, unfinished on-device run with the same model.
    const resume = t?.engine === 'device' && t.pending && t.model === model ? t : undefined
    const duration = resume?.pending?.duration || (await recordingDuration(blob))
    let lines: TranscriptLine[] = resume?.lines ?? []
    const base: Transcript = { engine: 'device', model, lines, speakers: t?.speakers, createdAt: Date.now() }
    await transcribeOnDevice({
      blob,
      model,
      language: settings.language === 'en' ? 'en' : undefined,
      from: resume?.pending?.doneUntil ?? 0,
      duration,
      signal,
      onProgress: (p) => progress(p.detail, p.fraction),
      onLines: async (more, doneUntil) => {
        lines = [...lines, ...more]
        await saveTranscript(sessionId, recording.assetId, { ...base, lines, pending: { doneUntil, duration } })
      },
    })
    await saveTranscript(sessionId, recording.assetId, { ...base, lines })
  }

  const runCloud = async (blob: Blob, signal: AbortSignal, progress: (d: string, f?: number) => void) => {
    const { startCloudJob, waitForCloudJob } = await import('./cloud')
    const key = settings.assemblyKey.trim()
    // A job started earlier may still be running at AssemblyAI; pick it up instead of paying twice.
    let jobId = t?.engine === 'cloud' ? t.pending?.jobId : undefined
    if (!jobId) {
      progress(`Uploading ${Math.round(blob.size / 1e6)} MB to AssemblyAI…`)
      jobId = await startCloudJob(blob, key, settings.language, signal)
      await saveTranscript(sessionId, recording.assetId, {
        engine: 'cloud',
        lines: [],
        speakers: t?.speakers,
        pending: { jobId },
        createdAt: Date.now(),
      })
    }
    progress('AssemblyAI is transcribing. This usually takes a few minutes; you can leave this page and come back.', 0.5)
    const lines = await waitForCloudJob(jobId, key, signal)
    await saveTranscript(sessionId, recording.assetId, { engine: 'cloud', model: 'AssemblyAI', lines, speakers: t?.speakers, createdAt: Date.now() })
  }

  if (job)
    return (
      <div className="transcript-job">
        <div className="row spread">
          <span className="small">
            {job.engine === 'device' ? '💻' : '☁️'} {job.detail}
          </span>
          <button className="ghost small" onClick={() => job.abort.abort()}>
            {job.engine === 'cloud' ? 'Stop waiting' : 'Pause'}
          </button>
        </div>
        <progress value={job.fraction || undefined} max={1} />
        {job.engine === 'device' && (
          <p className="muted small">Keep this page open. If you leave or pause, it will carry on from where it got to next time.</p>
        )}
      </div>
    )

  if (!t || t.pending)
    return (
      <div className="transcript-start">
        {t?.pending && (
          <p className="small">
            {t.engine === 'cloud'
              ? '☁️ A cloud transcript was started for this recording.'
              : `💻 Transcribed ${formatTime(t.pending.doneUntil ?? 0)} so far.`}
          </p>
        )}
        <div className="row wrap">
          <button onClick={() => run('device')} title="Free and private. Slower, no speaker names.">
            <Ico as={Desktop} /> {t?.pending && t.engine === 'device' ? 'Carry on transcribing' : 'Transcribe on this device'}
          </button>
          <button
            onClick={() => run('cloud')}
            disabled={!settings.assemblyKey.trim()}
            title={settings.assemblyKey.trim() ? 'Uses your AssemblyAI account. Faster, and tells speakers apart.' : 'Add an AssemblyAI key in World settings first.'}
          >
            <Ico as={Cloud} /> {t?.pending && t.engine === 'cloud' ? 'Check on cloud transcript' : 'Transcribe in the cloud'}
          </button>
          <Help topic="transcript" />
          {t?.pending && (
            <button className="ghost small" onClick={() => saveTranscript(sessionId, recording.assetId, undefined)}>
              Start over
            </button>
          )}
        </div>
        <p className="muted small">
          On this device: free and private, but slow (roughly real time) and doesn’t tell voices apart. In the cloud: a few
          minutes, names each speaker, and costs well under a dollar for a long session on your own{' '}
          <Link to={`${worldPath(worldId)}/settings`}>AssemblyAI key</Link>.
        </p>
        {error && <p className="error small">{error}</p>}
      </div>
    )

  return (
    <TranscriptView
      sessionId={sessionId}
      worldId={worldId}
      recording={recording}
      transcript={t}
      seek={seek}
      focus={focus}
      onRedo={() => saveTranscript(sessionId, recording.assetId, undefined)}
    />
  )
}

function TranscriptView({
  sessionId,
  worldId,
  recording,
  transcript: t,
  seek,
  focus,
  onRedo,
}: {
  sessionId: string
  worldId: string
  recording: Recording
  transcript: Transcript
  seek: (t: number) => void
  focus?: number
  onRedo: () => void
}) {
  const [q, setQ] = useState('')
  const [naming, setNaming] = useState(false)
  // Scroll to the linked line once per link, not every time the session changes.
  const scrolledTo = useRef<number>(undefined)
  const scrollOnce = (el: HTMLLIElement | null) => {
    if (!el || scrolledTo.current === focus) return
    scrolledTo.current = focus
    el.scrollIntoView({ block: 'center' })
  }
  const known = useKnownSpeakers(worldId, sessionId, recording.assetId)
  const labels = speakerLabels(t)
  const query = q.trim().toLowerCase()
  const shown = query ? t.lines.filter((l) => l.text.toLowerCase().includes(query) || speakerName(t, l.speaker).toLowerCase().includes(query)) : t.lines

  const rename = (label: string, name: string) =>
    db.sessions
      .where('id')
      .equals(sessionId)
      .modify((s) => {
        const tr = s.recordings.find((r) => r.assetId === recording.assetId)?.transcript
        if (tr) tr.speakers = { ...tr.speakers, [label]: name }
      })

  return (
    <details className="transcript" open={focus !== undefined || undefined}>
      <summary>
        <Ico as={Scroll} /> Transcript <span className="muted small">({t.lines.length} lines, {t.engine === 'cloud' ? 'cloud' : 'this device'})</span>
      </summary>
      <div className="row wrap transcript-tools">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the transcript" />
        {labels.length > 0 && (
          <button className="ghost small" onClick={() => setNaming(!naming)}>
            🗣️ Name speakers
          </button>
        )}
        <button
          className="ghost small"
          onClick={() => {
            if (confirm('Throw away this transcript and make a new one?')) onRedo()
          }}
        >
          Redo
        </button>
      </div>
      {naming && (
        <div className="speaker-names" key={JSON.stringify(t.speakers ?? {})}>
          {known.last && (
            <p className="small">
              <button className="small" onClick={() => setSpeakers(sessionId, recording.assetId, labels, known.last!)}>
                Same as last time
              </button>{' '}
              <span className="muted">
                Fills in {Object.values(known.last).filter(Boolean).slice(0, 4).join(', ')}
                {Object.values(known.last).filter(Boolean).length > 4 ? '…' : ''} by speaker letter. AssemblyAI letters people in the order they first speak, so
                check each one against what they first say.
              </span>
            </p>
          )}
          <datalist id={`speakers-${recording.assetId}`}>
            {known.names.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          {labels.map((l) => (
            <label key={l} className="row small">
              <span className="speaker-chip">{l}</span>
              <input
                defaultValue={t.speakers?.[l] ?? ''}
                list={`speakers-${recording.assetId}`}
                placeholder={`Who is speaker ${l}? e.g. "Sam (Wren)"`}
                onBlur={(e) => rename(l, e.target.value)}
              />
              <span className="muted">first says “{t.lines.find((x) => x.speaker === l)?.text.slice(0, 60)}…”</span>
            </label>
          ))}
        </div>
      )}
      {t.lines.length === 0 ? (
        <p className="muted small">No speech was found in this recording.</p>
      ) : (
        <ol className="transcript-lines">
          {shown.slice(0, query ? 300 : undefined).map((l, i) => (
            <li
              key={`${l.start}-${i}`}
              className={focus !== undefined && Math.floor(l.start) === focus ? 'focus' : undefined}
              ref={focus !== undefined && Math.floor(l.start) === focus ? scrollOnce : undefined}
            >
              <button className="link" onClick={() => seek(l.start)} title="Play from here">
                <code>{formatTime(l.start)}</code>
              </button>
              {l.speaker && <strong className={`speaker speaker-${labels.indexOf(l.speaker) % 6}`}>{speakerName(t, l.speaker)}</strong>}
              <span>{l.text}</span>
            </li>
          ))}
        </ol>
      )}
    </details>
  )
}

/**
 * Speaker names used before in this world: every name given in any transcript (for the name boxes'
 * suggestions), and the names from the latest other transcript that has them ("Same as last time").
 */
function useKnownSpeakers(worldId: string, sessionId: string, assetId: string) {
  return (
    useLiveQuery(async () => {
      const sessions = await db.sessions.where({ worldId }).toArray()
      const named = sessions
        .flatMap((s) => s.recordings.map((r) => ({ s, r })))
        .filter(({ r }) => r.assetId !== assetId && r.transcript?.speakers && Object.values(r.transcript.speakers).some((n) => n.trim()))
        .sort((a, b) => b.r.startedAt - a.r.startedAt)
      const names = [...new Set(named.flatMap(({ r }) => Object.values(r.transcript!.speakers!).map((n) => n.trim()).filter(Boolean)))].sort()
      const last = named.find(({ s }) => s.id !== sessionId)?.r.transcript?.speakers ?? named[0]?.r.transcript?.speakers
      return { names, last }
    }, [worldId, sessionId, assetId]) ?? { names: [] as string[], last: undefined as Record<string, string> | undefined }
  )
}

/** Copies names onto this transcript's speakers by letter, keeping any already given. */
function setSpeakers(sessionId: string, assetId: string, labels: string[], from: Record<string, string>) {
  return db.sessions
    .where('id')
    .equals(sessionId)
    .modify((s) => {
      const tr = s.recordings.find((r) => r.assetId === assetId)?.transcript
      if (!tr) return
      const next = { ...tr.speakers }
      for (const l of labels) if (!next[l]?.trim() && from[l]?.trim()) next[l] = from[l]
      tr.speakers = next
    })
}
