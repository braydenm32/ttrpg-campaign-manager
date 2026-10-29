import { useEffect, useRef, useState } from 'react'
import { Help } from '../help'
import { Link, useLocation } from 'react-router-dom'
import { db, type Entity, type Session, type World } from '../db'
import { Markdown } from '../Markdown'
import { SecretNamesWarning } from '../SecretNamesWarning'
import { buildRecapPrompt, estimateTokens, parseRecap, RECAP_MODEL, recapCost, recapWithClaude } from './recap'
import { useAiSettings } from './settings'
import { Ico } from '../icons'
import { ClipboardText, Eye, Lock, PenNib, Sparkle } from '@phosphor-icons/react'
import { worldPath } from '../paths'
import { WorldUpdatesReview } from './WorldUpdatesReview'
import { dollars, modelName } from './claude'
import { ModelTag } from './ClaudeJob'
import { moveJob, startJob, stopJob, takeFinished, useJob } from './jobs'

/**
 * Turns a session's transcript (and GM notes) into a GM summary and a player recap.
 * Two ways: copy everything to paste into claude.ai (free with a Claude subscription),
 * or one click with the GM's own Anthropic API key. Either way, the GM reviews before anything is saved.
 */
export function RecapPanel({ world, session, entities }: { world: World; session: Session; entities: Entity[] }) {
  const settings = useAiSettings()
  const [mode, setMode] = useState<'idle' | 'paste'>('idle')
  const [pasted, setPasted] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [cost, setCost] = useState('')
  // The recap keeps writing if the GM leaves the page, and saves its draft when it's done (see jobs.ts).
  const jobId = `recap:${session.id}`
  const job = useJob(jobId)
  const writing = job?.status === 'writing' ? job : undefined
  const { pathname, search } = useLocation()
  useEffect(() => {
    if (!job) return
    if (job.status === 'writing') return moveJob(job.id, pathname, pathname + search)
    takeFinished(job, undefined, setError, setCost)
  }, [job, pathname, search])

  const transcribed = session.recordings.filter((r) => r.transcript && !r.transcript.pending).length
  const hasMaterial = transcribed > 0 || session.notes.trim().length > 0
  const prompt = () => buildRecapPrompt(world, session, entities)
  const estimate = hasMaterial ? recapCost(estimateTokens(prompt()), 6000) : 0

  const saveDraft = (text: string, source: 'claude-api' | 'pasted') =>
    db.sessions.update(session.id, { recapDraft: { ...parseRecap(text), source, createdAt: Date.now() } })

  const copy = async () => {
    setError('')
    try {
      await navigator.clipboard.writeText(prompt())
      setCopied(true)
      setMode('paste')
    } catch {
      setError('Couldn’t copy. Your browser may have blocked the clipboard.')
    }
  }

  const write = () => {
    setError('')
    setCost('')
    const key = settings.anthropicKey.trim()
    const text = prompt()
    const title = `The write-up of session ${session.number}`
    startJob(
      { id: jobId, worldId: world.id, title, path: pathname, href: `${pathname}${search}`, model: RECAP_MODEL },
      async ({ signal, onText }) => {
        const res = await recapWithClaude(text, key, onText, signal)
        // Saved as soon as it's done, wherever the GM is by then.
        await saveDraft(res.text, 'claude-api')
        return { note: `That recap cost about ${dollars(recapCost(res.inputTokens, res.outputTokens))} with ${modelName(RECAP_MODEL)}.`, warning: res.warning }
      },
    )
  }

  if (session.recapDraft) return <RecapDraftReview world={world} session={session} entities={entities} note={[error, cost].filter(Boolean).join(' ')} />

  return (
    <section className="recap-panel">
      <h2>
        <Ico as={Sparkle} /> Write up this session <Help topic="recap" />
      </h2>
      <p className="muted small">
        {transcribed
          ? `Claude reads the transcript${transcribed > 1 ? 's' : ''} and your GM notes, then drafts a GM summary, a player recap and updates for your pages, for you to check.`
          : session.recordings.length
            ? 'Transcribe a recording above first (or write some GM notes), then Claude can draft a GM summary and a player recap.'
            : 'Record the session, or write GM notes, and Claude can draft a GM summary and a player recap from them.'}
      </p>

      {writing ? (
        <div className="recap-writing">
          <div className="row spread">
            <span className="small"><Ico as={PenNib} /> Claude is writing…</span>
            <button className="ghost small" onClick={() => stopJob(jobId)}>
              Stop
            </button>
          </div>
          {writing.text ? <pre className="recap-stream">{writing.text}</pre> : <progress />}
        </div>
      ) : (
        <div className="row wrap">
          <button onClick={copy} disabled={!hasMaterial} title="Copies everything Claude needs. Paste it into claude.ai, then paste the answer back here.">
            <Ico as={ClipboardText} /> Copy for Claude
          </button>
          <button
            className="primary"
            onClick={write}
            disabled={!hasMaterial || !settings.anthropicKey.trim()}
            title={settings.anthropicKey.trim() ? 'Uses your Anthropic API key' : 'Add an Anthropic API key in World settings first'}
          >
            <Ico as={Sparkle} /> Write it now{estimate ? ` (about ${dollars(estimate)})` : ''}
          </button>
          {hasMaterial && settings.anthropicKey.trim() && <ModelTag model={RECAP_MODEL} />}
          {mode === 'idle' && (
            <button className="ghost small" onClick={() => setMode('paste')}>
              Paste a reply
            </button>
          )}
        </div>
      )}
      {!settings.anthropicKey.trim() && !writing && (
        <p className="muted small">
          “Copy for Claude” is free with your Claude subscription. For one click, add an Anthropic API key in{' '}
          <Link to={`${worldPath(world.id)}/settings?tab=device`}>World settings → AI tools</Link>.
        </p>
      )}

      {mode === 'paste' && !writing && (
        <div className="recap-paste">
          {copied && (
            <p className="small">
              ✓ Copied. Open{' '}
              <a href="https://claude.ai/new" target="_blank" rel="noreferrer">
                claude.ai
              </a>
              , paste it in and send. When Claude answers, copy its reply and paste it below.
            </p>
          )}
          <textarea rows={6} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Paste Claude’s reply here" />
          <div className="row">
            <button
              className="primary"
              disabled={!pasted.trim()}
              onClick={async () => {
                await saveDraft(pasted, 'pasted')
                setPasted('')
                setMode('idle')
              }}
            >
              Check the draft
            </button>
            <button className="ghost" onClick={() => setMode('idle')}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && <p className="error small">{error}</p>}
    </section>
  )
}

/** The GM checks and edits both drafts, then chooses where each one goes. Nothing reaches players until then. */
function RecapDraftReview({ world, session, entities, note }: { world: World; session: Session; entities: Entity[]; note: string }) {
  const worldId = world.id
  const draft = session.recapDraft!
  const [gm, setGm] = useState(draft.gm)
  const [players, setPlayers] = useState(draft.players)
  const [preview, setPreview] = useState(false)
  const [done, setDone] = useState<{ gm?: boolean; players?: boolean }>({})
  // Edits are kept with the draft (checked every second), so following a link and coming back doesn't lose them.
  const latest = useRef({ gm, players, changed: false })
  const sessionId = session.id
  useEffect(() => {
    const keep = () => {
      if (!latest.current.changed) return
      latest.current.changed = false
      const { gm, players } = latest.current
      void db.sessions
        .where('id')
        .equals(sessionId)
        .modify((s) => {
          if (s.recapDraft) Object.assign(s.recapDraft, { gm, players })
        })
    }
    const timer = setInterval(keep, 1000)
    return () => {
      clearInterval(timer)
      keep()
    }
  }, [sessionId])
  const editGm = (v: string) => {
    latest.current = { gm: v, players, changed: true }
    setGm(v)
  }
  const editPlayers = (v: string) => {
    latest.current = { gm, players: v, changed: true }
    setPlayers(v)
  }

  const append = (existing: string, text: string) => (existing.trim() ? `${existing.trimEnd()}\n\n${text}` : text)
  const updatesLeft = !!draft.updates?.length && !draft.updatesDone
  const finish = () => {
    if (!done.gm && !done.players && !confirm('Throw this draft away?')) return
    if ((done.gm || done.players) && updatesLeft && !confirm('You haven’t added the suggested world updates yet. Close the draft anyway?')) return
    db.sessions.update(session.id, { recapDraft: undefined })
  }

  const useGm = async () => {
    await db.sessions.update(session.id, { notes: append(session.notes, `## Summary\n\n${gm.trim()}`) })
    setDone((d) => ({ ...d, gm: true }))
  }
  const usePlayers = async () => {
    if (session.recap.trim() && !confirm('Replace the player recap you already have? (Cancel adds this underneath instead.)'))
      await db.sessions.update(session.id, { recap: append(session.recap, players.trim()) })
    else await db.sessions.update(session.id, { recap: players.trim() })
    setDone((d) => ({ ...d, players: true }))
  }

  return (
    <section className="recap-panel recap-review">
      <div className="row spread">
        <h2><Ico as={Sparkle} /> Claude’s draft</h2>
        <label className="row small">
          <input type="checkbox" checked={preview} onChange={(e) => setPreview(e.target.checked)} /> Preview
        </label>
      </div>
      {note && <p className="muted small">{note}</p>}
      <p className="muted small">Check it over and fix anything Claude misheard. Nothing is saved to the session until you choose below.</p>

      <h3><Ico as={Lock} /> GM summary</h3>
      {preview ? (
        <Markdown text={gm} entities={entities} worldId={worldId} showSecrets />
      ) : (
        <textarea rows={10} value={gm} onChange={(e) => editGm(e.target.value)} />
      )}
      <div className="row">
        <button onClick={useGm} disabled={!gm.trim() || done.gm}>
          {done.gm ? '✓ Added to GM notes' : 'Add to GM notes'}
        </button>
      </div>

      <h3><Ico as={Eye} /> Player recap</h3>
      {preview ? (
        <Markdown text={players} entities={entities} worldId={worldId} showSecrets={false} />
      ) : (
        <textarea rows={8} value={players} onChange={(e) => editPlayers(e.target.value)} />
      )}
      <SecretNamesWarning worldId={worldId} texts={[players]} />
      <div className="row">
        <button onClick={usePlayers} disabled={!players.trim() || done.players}>
          {done.players ? '✓ Saved as the player recap' : 'Use as the player recap'}
        </button>
        {session.visibility === 'gm' && done.players && (
          <span className="muted small">Players will see it once you reveal this session.</span>
        )}
      </div>

      <WorldUpdatesReview world={world} session={session} entities={entities} />

      <div className="row end">
        <button className={done.gm || done.players ? 'primary' : 'ghost'} onClick={finish}>
          {done.gm || done.players ? 'Done' : 'Discard draft'}
        </button>
      </div>
    </section>
  )
}
