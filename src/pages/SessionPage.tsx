import { ReadAloud } from '../ai/ReadAloud'
import { binSession } from '../bin'
import { useLiveQuery } from 'dexie-react-hooks'
import { Help, HELP } from '../help'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PrepHelper } from '../ai/PrepHelper'
import { RecapPanel } from '../ai/RecapPanel'
import { Highlights } from '../highlights'
import { SpotlightPanel } from '../ai/Spotlight'
import { TranscriptPanel } from '../ai/TranscriptPanel'
import { DraftText, Empty, Skeleton } from '../components'
import { PagePicker } from '../PagePicker'
import { db, ENTITY_LABELS, THREAD_STATUS, type Campaign, type Entity, type Recording, type Session, type World } from '../db'
import { formatBytes, useAssetUrl, useVisibleEntities, useWorld } from '../hooks'
import { Markdown } from '../Markdown'
import { SecretTextarea } from '../SecretTextarea'
import { SecretNamesWarning } from '../SecretNamesWarning'
import { formatTime, recordingSupported, systemAudioSupported, type RecordSource } from '../recorder'
import { RecordingSaveWarning } from '../RecordingBar'
import { addBookmark, beginRecording, discardRecording, endRecording, recoverRecording, unsavedRecordings, useLiveRecording } from '../recordingStore'
import { canSeeSession, newThread } from '../threads'
import { useViewMode } from '../viewMode'
import { PrepSheet } from '../prep'
import { PrintButton } from '../print'
import { CalDateInput, formatDate } from '../calendar'
import { DiscordButton, forDiscord } from '../discord'
import { ShowToPlayers, useFinish, useNextSession, WrapUpChecklist } from '../EndSession'
import { Ico, TypeIcon } from '../icons'
import { BookmarkSimple, CheckCircle, Eye, FlagCheckered, ListChecks, Lock, Microphone, PencilSimple, Play, Spiral, UsersThree, Warning, X } from '@phosphor-icons/react'
import { pagePath, worldPath } from '../paths'
import { sessionFirstTab, startPlaying, type SessionStage } from '../sessions'
import { prepCounts } from '../counts'
import { StageChip, useSessionStage } from '../stage'
import { JumpRow, jumpTo, useKeepScroll } from '../jump'
import { removeWithUndo, SavedMark, saving } from '../undo'

/**
 * A session. For the GM it's two of the Session area's three stages (the third, Play, is the
 * Lectern): Prepare (?tab=prep), the plan first; and Wrap up (?tab=notes, ?tab=recap, ?end=1), the
 * after-session tools in order, ending with "Mark as played". A strip across the top shows the
 * stage, the number and title (edited in place) and the one thing to do next. Players get the
 * recap, read-only.
 */
export default function SessionPage() {
  const { worldId, world } = useWorld()
  const { sessionId = '' } = useParams()
  const { isGM } = useViewMode()
  const session = useLiveQuery(async () => (await db.sessions.get(sessionId)) ?? null, [sessionId])
  const campaign = useLiveQuery(async () => (session ? ((await db.campaigns.get(session.campaignId)) ?? null) : undefined), [session?.campaignId])
  const entities = useVisibleEntities(worldId)
  const [params] = useSearchParams()
  const stage = useSessionStage(session)
  useKeepScroll(!!session && !!world)

  if (session === undefined || (session && campaign === undefined)) return <Skeleton />
  // Players get a session only once it's revealed, and never from a campaign the GM keeps hidden.
  if (session === null || !canSeeSession(session, campaign, isGM) || (campaign && campaign.worldId !== worldId))
    return <Empty>Session not found.</Empty>
  const featured = entities.filter((e) => session.entityIds.includes(e.id))

  if (!isGM)
    return (
      <div className="page">
        {campaign && <Link to={`${worldPath(worldId)}/c/${campaign.id}`}>← {campaign.name}</Link>}
        <h1>
          #{session.number} {session.title}
        </h1>
        <div className="row spread">
          <div className="muted">
            {session.date}
            {session.worldDate && world?.calendar && ` · in the world: ${formatDate(world.calendar, session.worldDate)}`}
          </div>
          <div className="row">
            <ReadAloud text={session.recap} id={`recap-${session.id}`} className="small" />
            <PrintButton to={`${worldPath(worldId)}/print/s/${session.id}`} />
          </div>
        </div>
        {session.recap ? (
          <Markdown text={session.recap} entities={entities} worldId={worldId} showSecrets={false} />
        ) : (
          <Empty>No recap yet.</Empty>
        )}
        <Highlights session={session} entities={entities} worldId={worldId} isGM={false} />
        <FeaturedList worldId={worldId} entities={featured} />
      </div>
    )

  if (!world || !stage) return null
  const tab = params.get('tab')
  // Wrap up for its own addresses; Prepare for ?tab=prep; with no tab named, where the session is.
  const view = params.get('end') === '1' || tab === 'notes' || tab === 'recap' ? 'wrap' : tab === 'prep' ? 'prep' : sessionFirstTab(session) === 'prep' ? 'prep' : 'wrap'
  const props = { session, campaign, world, entities, stage }
  return (
    <div className={`page session-page ${view}`}>
      <SessionStrip {...props} view={view} />
      {view === 'prep' ? <PrepareView {...props} /> : <WrapUpView {...props} focus={params.get('end') === '1' ? 'finish' : tab === 'recap' ? 'recap' : undefined} />}
    </div>
  )
}

interface ViewProps {
  session: Session
  campaign: Campaign | null | undefined
  world: World
  entities: Entity[]
  stage: SessionStage
}

/**
 * The strip across the top of Prepare and Wrap up: the stage, "#1 Payday" (click to change; it
 * saves as you type), what's planned at a glance, and one button for what comes next.
 */
function SessionStrip({ session, stage, world, view }: ViewProps & { view: 'prep' | 'wrap' }) {
  const navigate = useNavigate()
  const w = worldPath(world.id)
  const update = (patch: Partial<Session>) => db.sessions.update(session.id, patch)
  const counts = prepCounts(session.prep)
  const fights = session.prep?.encounters.length ?? 0
  const next = useNextSession(session)
  const { finish, busy, blocked } = useFinish(session)
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
  const stats = [
    counts.scenes.total ? plural(counts.scenes.total, 'scene') : '',
    counts.clues.total ? plural(counts.clues.total, 'clue') : '',
    fights ? plural(fights, 'fight') : '',
    session.date ? `played ${session.date}` : 'no date set',
  ].filter(Boolean)
  const lectern = `${w}/s/${session.id}/lectern`

  let action
  if (view === 'prep' && (stage === 'planned' || stage === 'preparing'))
    action = (
      <button
        className="primary"
        title={HELP.startPlaying}
        onClick={async () => {
          await startPlaying(session.id)
          navigate(lectern)
        }}
      >
        <Ico as={Play} weight="fill" /> Start playing
      </button>
    )
  else if (stage === 'playing' && view === 'prep')
    action = (
      <Link className="button primary" to={lectern}>
        <Ico as={Play} weight="fill" /> Back to the table
      </Link>
    )
  else if (stage !== 'played')
    action = (
      <button className="primary" onClick={finish} disabled={busy || !!blocked} title={blocked ?? HELP.markPlayed}>
        <Ico as={CheckCircle} /> Mark as played
      </button>
    )
  else
    action = next ? (
      <Link className="button primary" to={`${w}/s/${next.id}?tab=prep`}>
        <Ico as={ListChecks} /> Prepare #{next.number}
      </Link>
    ) : view === 'prep' ? (
      <Link className="button" to={`${w}/s/${session.id}?tab=notes`}>
        <Ico as={FlagCheckered} /> Wrap up
      </Link>
    ) : null

  return (
    <section className="session-strip" aria-label="This session">
      <div className="strip-title">
        <StageChip stage={stage} help />
        <h1 className="session-title">
          <span className="session-hash" aria-hidden>
            #
          </span>
          <DraftText className="session-num" inputMode="numeric" aria-label="Session number" title={HELP.sessionTitle} saveOn="leave" value={String(session.number)} onCommit={(v) => update({ number: Number(v) || 0 })} />
          <DraftText className="session-name" aria-label="Session title" title={HELP.sessionTitle} value={session.title} onCommit={(title) => update({ title })} />
        </h1>
        <SavedMark />
      </div>
      <div className="strip-facts">
        <span className="statline">
          {stats.map((s) => (
            <span key={s}>{s}</span>
          ))}
          <span>{session.visibility === 'players' ? <><Ico as={Eye} /> players can read it</> : <><Ico as={Lock} /> GM only</>}</span>
        </span>
        <span className="grow" />
        {action}
      </div>
    </section>
  )
}

/** Prepare: the plan first (as readable cards), who's in it, ideas from Claude, then the session's details. */
function PrepareView({ session, campaign, world, entities }: ViewProps) {
  return (
    <>
      <JumpRow
        label="Parts of the plan"
        className="phone-only"
        targets={[
          { id: 'plan', label: 'Start' },
          { id: 'scenes', label: 'Scenes' },
          { id: 'clues', label: 'Clues' },
          { id: 'fights', label: 'Fights' },
          { id: 'gm-notes', label: 'Notes' },
          { id: 'people', label: 'People' },
          { id: 'details', label: 'Details' },
        ]}
      />
      <PrepSheet session={session} entities={entities} worldId={world.id} />
      <NotesCard session={session} entities={entities} worldId={world.id} id="gm-notes" />
      <FeaturedSection session={session} entities={entities} worldId={world.id} />
      <PrepHelper world={world} session={session} entities={entities} />
      <SessionDetails session={session} campaign={campaign} world={world} entities={entities} />
    </>
  )
}

/**
 * Wrap up: notes, the recording and its transcript, the write-up from Claude (with changes to your
 * pages), the players' recap, highlights, spotlight, threads and who featured, then the checklist
 * that ends with "Mark as played".
 */
function WrapUpView({ session, campaign, world, entities, stage, focus }: ViewProps & { focus?: 'finish' | 'recap' }) {
  const worldId = world.id
  const update = (patch: Partial<Session>) => saving(db.sessions.update(session.id, patch))
  // Arriving from "End session" or a recap link: go straight to that part.
  const jumped = useRef(false)
  useEffect(() => {
    if (!focus || jumped.current) return
    jumped.current = true
    requestAnimationFrame(() => jumpTo(focus))
  }, [focus])
  return (
    <>
      <JumpRow
        label="Parts of the wrap-up"
        className="phone-only"
        targets={[
          { id: 'notes', label: 'Notes' },
          { id: 'recording', label: 'Recording' },
          { id: 'writeup', label: 'Write-up' },
          { id: 'recap', label: 'Recap' },
          { id: 'highlights', label: 'Highlights' },
          { id: 'finish', label: 'Finish' },
        ]}
      />
      <p className="muted small wrap-intro">
        After the game, top to bottom: your notes, the recording, the write-up, the players’ recap, then mark it played. <Help topic="wrapUp" />
      </p>
      <NotesCard session={session} entities={entities} worldId={worldId} id="notes" />
      <div id="recording">
        <Recorder session={session} />
      </div>
      <div id="writeup">
        <RecapPanel world={world} session={session} entities={entities} />
      </div>
      <section className="card wrap-card" id="recap">
        <div className="plan-head">
          <h2>
            <Ico as={Eye} /> The players’ recap <Help topic="revealRecap" />
          </h2>
          <SavedMark />
        </div>
        <SecretTextarea
          worldId={worldId}
          rows={10}
          value={session.recap}
          placeholder="What the players get to read, once you show this session to them."
          onChange={(v) => update({ recap: v })}
        />
        <SecretNamesWarning worldId={worldId} texts={[session.recap]} />
        {session.recap.trim() && (
          <div className="row wrap">
            <ReadAloud text={session.recap} id={`recap-${session.id}`} className="small" />
            <DiscordButton
              worldId={worldId}
              label="💬 Post recap to Discord"
              title={`Session ${session.number}: ${session.title}`}
              text={() => forDiscord(session.recap)}
              confirmText={session.visibility === 'players' ? undefined : 'This session is still GM only. Post the player recap to Discord anyway? Secret passages are left out.'}
            />
          </div>
        )}
        {session.recap.trim() && (
          <details>
            <summary>Preview</summary>
            <Markdown text={session.recap} entities={entities} worldId={worldId} showSecrets />
          </details>
        )}
        <ShowToPlayers session={session} campaign={campaign} entities={entities} />
      </section>
      <div id="highlights">
        <Highlights session={session} entities={entities} worldId={worldId} isGM />
      </div>
      {/* Who talked and who got the spotlight only means something once it's been played. */}
      {(stage === 'playing' || stage === 'played') && <SpotlightPanel session={session} entities={entities} />}
      <SessionThreads session={session} entities={entities} worldId={worldId} />
      <FeaturedSection session={session} entities={entities} worldId={worldId} />
      <WrapUpChecklist world={world} session={session} campaign={campaign} entities={entities} played={stage === 'played'} />
    </>
  )
}

/** Notes longer than this show folded, with "Show all". */
const LONG_NOTES = 900

/**
 * The session's GM notes: read as a page (long ones folded), or edited in place with Edit. Empty
 * notes open ready to type. The same notes the Lectern's quick notes add to. Only the GM sees them.
 */
function NotesCard({ session, entities, worldId, id }: { session: Session; entities: Entity[]; worldId: string; id: string }) {
  const [editing, setEditing] = useState(!session.notes.trim())
  const [all, setAll] = useState(false)
  const long = session.notes.length > LONG_NOTES
  return (
    <section className="card wrap-card" id={id}>
      <div className="plan-head">
        <h2>
          <Ico as={Lock} /> GM notes <Help topic="gmNotes" />
        </h2>
        <SavedMark />
        {session.notes.trim() && (
          <button type="button" className={editing ? 'primary' : ''} onClick={() => setEditing(!editing)}>
            {editing ? 'Done' : <><Ico as={PencilSimple} /> Edit</>}
          </button>
        )}
      </div>
      {editing ? (
        <DraftText
          multiline
          grow
          className="notes-text"
          aria-label="GM notes"
          value={session.notes}
          placeholder="What happened, who they met, what’s left hanging… Use [[Name]] to link pages. Only you see these."
          onCommit={(notes) => saving(db.sessions.update(session.id, { notes }))}
        />
      ) : (
        <>
          <div className={`notes-view ${long && !all ? 'folded' : ''}`}>
            <Markdown text={session.notes} entities={entities} worldId={worldId} showSecrets />
          </div>
          {long && (
            <button type="button" className="link show-all" onClick={() => setAll(!all)}>
              {all ? 'Show less' : 'Show all of the notes'}
            </button>
          )}
        </>
      )}
    </section>
  )
}

/** The real date, the date in the world, who can read it, Print and Delete: at the end of Prepare. */
function SessionDetails({ session, campaign, world, entities }: Omit<ViewProps, 'stage'>) {
  const navigate = useNavigate()
  const live = useLiveRecording()
  const w = worldPath(world.id)
  const update = (patch: Partial<Session>) => saving(db.sessions.update(session.id, patch))
  return (
    <section className="card session-details" id="details">
      <h2>
        Session details <Help topic="sessionDetails" />
      </h2>
      <div className="details-grid">
        <label>
          <span>The date you play</span>
          <span className="row">
            <input type="date" value={session.date} onChange={(e) => update({ date: e.target.value })} />
            {session.date && (
              <button type="button" className="ghost" onClick={() => update({ date: '' })} aria-label="Clear the date">
                <Ico as={X} />
              </button>
            )}
          </span>
        </label>
        {world.calendar && (
          <div className="label">
            <span>
              In the world <Help topic="worldToday" />
            </span>
            <CalDateInput calendar={world.calendar} value={session.worldDate} onChange={(worldDate) => update({ worldDate })} />
            {world.calendar.today && (
              <button type="button" className="small" onClick={() => update({ worldDate: world.calendar!.today })}>
                Use today ({formatDate(world.calendar, world.calendar.today, false)})
              </button>
            )}
          </div>
        )}
        <div className="label">
          <span>Players</span>
          <ShowToPlayers session={session} campaign={campaign} entities={entities} />
        </div>
      </div>
      <div className="row wrap details-actions">
        <PrintButton to={`${w}/print/s/${session.id}`} />
        <span className="grow" />
        <button
          className="danger"
          disabled={live?.sessionId === session.id}
          title={live?.sessionId === session.id ? 'Stop the recording first' : undefined}
          onClick={async () => {
            if (!confirm('Delete this session and its recordings? You can restore it from World settings for a month.')) return
            await binSession(session.id)
            navigate(campaign ? `${w}/c/${campaign.id}` : w)
          }}
        >
          Delete session
        </button>
      </div>
    </section>
  )
}

/** How many featured pages show before "Show all". */
const FEATURED_AT_FIRST = 12

/** The pages this session is about: a dozen at first, the rest a tap away. Taking one off has Undo. */
function FeaturedSection({ session, entities, worldId }: { session: Session; entities: Entity[]; worldId: string }) {
  const [all, setAll] = useState(false)
  const featured = entities.filter((e) => session.entityIds.includes(e.id))
  const shown = all ? featured : featured.slice(0, FEATURED_AT_FIRST)
  const ids = (fn: (list: string[]) => void) =>
    db.sessions
      .where('id')
      .equals(session.id)
      .modify((s) => fn(s.entityIds))
  const remove = (id: string) => {
    const name = entities.find((e) => e.id === id)?.name ?? 'That page'
    let at = -1
    void removeWithUndo(
      `“${name}” taken off this session`,
      () =>
        ids((list) => {
          at = list.indexOf(id)
          if (at >= 0) list.splice(at, 1)
        }),
      () => ids((list) => void (list.includes(id) || list.splice(Math.max(0, at), 0, id))),
    )
  }
  return (
    <section className="card featured-card" id="people">
      <div className="plan-head">
        <h2>
          <Ico as={UsersThree} /> Featured in this session <Help topic="featured" />
        </h2>
        {featured.length > 0 && <span className="muted small">{featured.length}</span>}
      </div>
      {featured.length === 0 && <p className="muted small">Nobody yet. People you put in a scene at the Lectern are added here.</p>}
      <FeaturedList worldId={worldId} entities={shown} onRemove={remove} />
      {featured.length > FEATURED_AT_FIRST && (
        <button type="button" className="link show-all" onClick={() => setAll(!all)}>
          {all ? 'Show fewer' : `Show all ${featured.length}`}
        </button>
      )}
      <PagePicker
        entities={entities.filter((e) => !session.entityIds.includes(e.id))}
        placeholder="+ Add an NPC, place, item…"
        onPick={(id) => id && ids((list) => void (list.includes(id) || list.push(id)))}
      />
    </section>
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
    <div className="tags featured-chips">
      {entities.map((e) => (
        <span key={e.id} className="tag">
          <Link to={`${pagePath(worldId, e.id)}`}>
            <TypeIcon type={e.type} /> {e.name}
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

/** Recording the session, its recordings and their transcripts. Also folded into the Lectern. */
export function Recorder({ session }: { session: Session }) {
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
        <Ico as={Microphone} /> Recording <Help topic="recording" />
      </h2>
      {cutOff.map((r) => (
        <div key={r.recordingId} className="player-banner recover-recording">
          <span>
            <Ico as={Warning} /> A recording from {new Date(r.startedAt).toLocaleString()} wasn’t finished (the app closed while it was running). About{' '}
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
          <RecordingSaveWarning live={active} />
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault()
              addBookmark(mark)
              setMark('')
            }}
          >
            <input value={mark} onChange={(e) => setMark(e.target.value)} placeholder="Bookmark this moment (e.g. 'party meets the lich')" />
            <button><Ico as={BookmarkSimple} /> Bookmark</button>
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
          <select value={source} onChange={(e) => setSource(e.target.value as RecordSource)} aria-label="What to record">
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
  // "Heard in" on a page links here with ?play=<recording>&t=<seconds>: jump to that moment.
  const [params] = useSearchParams()
  const jumpToTime = params.get('play') === assetId ? Number(params.get('t')) : undefined
  const focus = jumpToTime !== undefined && !Number.isNaN(jumpToTime) ? jumpToTime : undefined
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (focus !== undefined) box.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [focus, onThisDevice])
  // Recordings are big, so they stay on the device that made them; the transcript travels.
  if (onThisDevice === false)
    return (
      <div className="playback" ref={box}>
        <div className="muted small">
          Recorded {new Date(startedAt).toLocaleString()} on another device, or left out of a backup. The audio isn’t on this device; its transcript is here.
        </div>
        <TranscriptPanel sessionId={sessionId} recording={recording} worldId={worldId} seek={() => {}} focus={focus} />
      </div>
    )
  if (!url) return null
  const seek = (t: number) => {
    if (!audio.current) return
    audio.current.currentTime = t
    audio.current.play()
  }
  return (
    <div className="playback" ref={box}>
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
          const start = () => {
            if (focus === undefined) return
            a.currentTime = focus
            a.play().catch(() => {})
          }
          if (a.duration === Infinity) {
            a.currentTime = 1e101
            a.addEventListener(
              'durationchange',
              () => {
                a.currentTime = 0
                start()
              },
              { once: true },
            )
          } else start()
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
      <TranscriptPanel sessionId={sessionId} recording={recording} worldId={worldId} seek={seek} focus={focus} />
    </div>
  )
}

/** Threads this session raised or tied off, one line each, plus a quick way to add one. */
function SessionThreads({ session, entities, worldId }: { session: Session; entities: Entity[]; worldId: string }) {
  const [name, setName] = useState('')
  const threads = entities.filter((e) => e.type === 'thread' && (e.raisedIn === session.id || e.tiedOffIn === session.id))
  return (
    <section className="card wrap-card" id="threads">
      <div className="plan-head">
        <h2>
          <Ico as={Spiral} /> Loose threads from this session
        </h2>
        <Link className="small" to={`${worldPath(worldId)}/threads`}>
          All threads
        </Link>
      </div>
      {threads.length > 0 ? (
        <ul className="thread-lines">
          {threads.map((t) => (
            <li key={t.id}>
              <Link to={pagePath(worldId, t.id)}>{t.name}</Link>{' '}
              <span className="muted small">
                · {t.tiedOffIn === session.id ? 'tied off here' : THREAD_STATUS[t.threadStatus ?? 'open'].label.toLowerCase()}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small">None raised or tied off in this session yet.</p>
      )}
      <form
        className="row plan-add"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!name.trim()) return
          await db.entities.add(newThread(worldId, name.trim(), session.id))
          setName('')
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a thread this session left hanging" aria-label="New loose thread" />
        <button disabled={!name.trim()}>Add</button>
      </form>
    </section>
  )
}
