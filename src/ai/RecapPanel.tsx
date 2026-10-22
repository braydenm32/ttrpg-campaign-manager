import { useEffect, useRef, useState } from 'react'
import { Help } from '../help'
import { Link } from 'react-router-dom'
import { db, type Entity, type Session, type World } from '../db'
import { Markdown } from '../Markdown'
import { buildRecapPrompt, estimateTokens, parseRecap, recapCost, recapWithClaude } from './recap'
import { useAiSettings } from './settings'

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
  const [writing, setWriting] = useState<{ text: string; abort: AbortController }>()
  const [error, setError] = useState('')
  const [cost, setCost] = useState('')
  const running = useRef<AbortController>(undefined)
  useEffect(() => () => running.current?.abort(), [])

  const transcribed = session.recordings.filter((r) => r.transcript && !r.transcript.pending).length
  const hasMaterial = transcribed > 0 || session.notes.trim().length > 0
  const prompt = () => buildRecapPrompt(world, session, entities)
  const estimate = hasMaterial ? recapCost(estimateTokens(prompt()), 2500) : 0

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

  const write = async () => {
    setError('')
    setCost('')
    const abort = new AbortController()
    running.current = abort
    setWriting({ text: '', abort })
    try {
      const res = await recapWithClaude(prompt(), settings.anthropicKey.trim(), (text) => setWriting({ text, abort }), abort.signal)
      await saveDraft(res.text, 'claude-api')
      setCost(`That recap cost about US$${recapCost(res.inputTokens, res.outputTokens).toFixed(2)}.`)
    } catch (err) {
      if ((err as Error).name !== 'AbortError' && !abort.signal.aborted) setError((err as Error).message || 'Something went wrong.')
    } finally {
      running.current = undefined
      setWriting(undefined)
    }
  }

  if (session.recapDraft) return <RecapDraftReview session={session} entities={entities} worldId={world.id} note={cost} />

  return (
    <section className="recap-panel">
      <h2>
        ✨ Write up this session <Help topic="recap" />
      </h2>
      <p className="muted small">
        {transcribed
          ? `Claude reads the transcript${transcribed > 1 ? 's' : ''} and your GM notes, then drafts a GM summary and a player recap for you to check.`
          : session.recordings.length
            ? 'Transcribe a recording above first (or write some GM notes), then Claude can draft a GM summary and a player recap.'
            : 'Record the session, or write GM notes, and Claude can draft a GM summary and a player recap from them.'}
      </p>

      {writing ? (
        <div className="recap-writing">
          <div className="row spread">
            <span className="small">✍️ Claude is writing…</span>
            <button className="ghost small" onClick={() => writing.abort.abort()}>
              Stop
            </button>
          </div>
          {writing.text ? <pre className="recap-stream">{writing.text}</pre> : <progress />}
        </div>
      ) : (
        <div className="row wrap">
          <button onClick={copy} disabled={!hasMaterial} title="Copies everything Claude needs. Paste it into claude.ai, then paste the answer back here.">
            📋 Copy for Claude
          </button>
          <button
            className="primary"
            onClick={write}
            disabled={!hasMaterial || !settings.anthropicKey.trim()}
            title={settings.anthropicKey.trim() ? 'Uses your Anthropic API key' : 'Add an Anthropic API key in World settings first'}
          >
            ✨ Write it now{estimate ? ` (about US$${Math.max(0.01, estimate).toFixed(2)})` : ''}
          </button>
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
          <Link to={`/w/${world.id}/settings`}>World settings → AI tools</Link>.
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
function RecapDraftReview({ session, entities, worldId, note }: { session: Session; entities: Entity[]; worldId: string; note: string }) {
  const draft = session.recapDraft!
  const [gm, setGm] = useState(draft.gm)
  const [players, setPlayers] = useState(draft.players)
  const [preview, setPreview] = useState(false)
  const [done, setDone] = useState<{ gm?: boolean; players?: boolean }>({})

  const append = (existing: string, text: string) => (existing.trim() ? `${existing.trimEnd()}\n\n${text}` : text)
  const finish = () => {
    if (!done.gm && !done.players && !confirm('Throw this draft away?')) return
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
        <h2>✨ Claude’s draft</h2>
        <label className="row small">
          <input type="checkbox" checked={preview} onChange={(e) => setPreview(e.target.checked)} /> Preview
        </label>
      </div>
      {note && <p className="muted small">{note}</p>}
      <p className="muted small">Check it over and fix anything Claude misheard. Nothing is saved to the session until you choose below.</p>

      <h3>🔒 GM summary</h3>
      {preview ? (
        <Markdown text={gm} entities={entities} worldId={worldId} showSecrets />
      ) : (
        <textarea rows={10} value={gm} onChange={(e) => setGm(e.target.value)} />
      )}
      <div className="row">
        <button onClick={useGm} disabled={!gm.trim() || done.gm}>
          {done.gm ? '✓ Added to GM notes' : 'Add to GM notes'}
        </button>
      </div>

      <h3>👁 Player recap</h3>
      {preview ? (
        <Markdown text={players} entities={entities} worldId={worldId} showSecrets={false} />
      ) : (
        <textarea rows={8} value={players} onChange={(e) => setPlayers(e.target.value)} />
      )}
      <div className="row">
        <button onClick={usePlayers} disabled={!players.trim() || done.players}>
          {done.players ? '✓ Saved as the player recap' : 'Use as the player recap'}
        </button>
        {session.visibility === 'gm' && done.players && (
          <span className="muted small">Players will see it once you reveal this session.</span>
        )}
      </div>

      <div className="row end">
        <button className={done.gm || done.players ? 'primary' : 'ghost'} onClick={finish}>
          {done.gm || done.players ? 'Done' : 'Discard draft'}
        </button>
      </div>
    </section>
  )
}
