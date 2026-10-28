import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardText, PenNib, Sparkle } from '@phosphor-icons/react'
import { Ico } from '../icons'
import { worldPath } from '../paths'
import { askClaude, dollars, estimateTokens, claudeCost, usageCost, type LocalTool } from './claude'
import { useAiSettings } from './settings'

/** What to send Claude for one job. */
export interface JobRequest {
  /** Instructions and world material (cached). */
  system: string
  /** The ask itself. */
  prompt: string
  tools?: LocalTool[]
  describe?: (name: string, input: Record<string, unknown>) => string
  effort?: 'low' | 'medium' | 'high'
  maxTokens?: number
  /** Roughly how long the answer will be, for the price shown on the button. */
  expectOut?: number
}

/**
 * The two ways to ask Claude for something: free with "Copy for Claude" (paste into claude.ai and
 * paste the answer back), or one click with the GM's own API key. Either way the answer comes back
 * to `onResult` for the GM to look over; nothing changes in the world on its own.
 */
export function ClaudeJob({
  worldId,
  label,
  build,
  onResult,
  disabled,
  extra,
  priceKey,
}: {
  worldId: string
  /** The button, e.g. "Suggest prep". */
  label: string
  build: () => JobRequest
  onResult: (text: string) => void
  disabled?: boolean
  /** Shown beside the buttons, e.g. a scope picker. */
  extra?: ReactNode
  /** Changes when what would be sent changes, so the price on the button is worked out again. */
  priceKey?: string
}) {
  const settings = useAiSettings()
  const key = settings.anthropicKey.trim()
  const [writing, setWriting] = useState<{ text: string; step: string; abort: AbortController }>()
  const [paste, setPaste] = useState<'closed' | 'open' | 'copied'>('closed')
  const [pasted, setPasted] = useState('')
  const [error, setError] = useState('')
  const [cost, setCost] = useState('')
  const running = useRef<AbortController>(undefined)
  useEffect(() => () => running.current?.abort(), [])

  const price = useMemo(() => {
    if (disabled) return 0
    const r = build()
    // Tools read more pages as they go: allow for a few more rounds of reading.
    const input = estimateTokens(r.system + r.prompt) * (r.tools?.length ? 1.6 : 1)
    return claudeCost(input, r.expectOut ?? 1500)
    // Building the request can mean writing out the whole world, so only redo it when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceKey, disabled])

  const run = async () => {
    setError('')
    setCost('')
    const abort = new AbortController()
    running.current = abort
    const r = build()
    setWriting({ text: '', step: '', abort })
    try {
      const res = await askClaude({
        apiKey: key,
        system: r.system,
        messages: [{ role: 'user', content: r.prompt }],
        tools: r.tools,
        describe: r.describe,
        effort: r.effort,
        maxTokens: r.maxTokens,
        signal: abort.signal,
        onText: (text) => setWriting((w) => w && { ...w, text }),
        onStep: (step) => setWriting((w) => w && { ...w, step, text: '' }),
      })
      onResult(res.text)
      setCost(`That cost about ${dollars(usageCost(res.usage))}.`)
    } catch (err) {
      if ((err as Error).name !== 'AbortError' && !abort.signal.aborted) setError((err as Error).message || 'Something went wrong.')
    } finally {
      running.current = undefined
      setWriting(undefined)
    }
  }

  const copy = async () => {
    setError('')
    const r = build()
    try {
      await navigator.clipboard.writeText(`${r.system}\n\n${r.prompt}`)
      setPaste('copied')
    } catch {
      setError('Couldn’t copy. Your browser may have blocked the clipboard.')
    }
  }

  return (
    <div className="claude-job">
      {writing ? (
        <div className="recap-writing">
          <div className="row spread">
            <span className="small">
              <Ico as={PenNib} /> {writing.step && !writing.text ? `${writing.step}…` : 'Claude is writing…'}
            </span>
            <button className="ghost small" onClick={() => writing.abort.abort()}>
              Stop
            </button>
          </div>
          {writing.text ? <pre className="recap-stream">{writing.text}</pre> : <progress />}
        </div>
      ) : (
        <div className="row wrap">
          {extra}
          <button onClick={copy} disabled={disabled} title="Copies everything Claude needs. Paste it into claude.ai, then paste the answer back here.">
            <Ico as={ClipboardText} /> Copy for Claude
          </button>
          <button className="primary" onClick={run} disabled={disabled || !key} title={key ? 'Uses your Anthropic API key' : 'Add an Anthropic API key in World settings first'}>
            <Ico as={Sparkle} /> {label}
            {price ? ` (about ${dollars(price)})` : ''}
          </button>
          {paste === 'closed' && (
            <button className="ghost small" onClick={() => setPaste('open')}>
              Paste a reply
            </button>
          )}
        </div>
      )}
      {!key && !writing && (
        <p className="muted small">
          “Copy for Claude” is free with your Claude subscription. For one click, add an Anthropic API key in <Link to={`${worldPath(worldId)}/settings`}>World settings → AI tools</Link>.
        </p>
      )}
      {paste !== 'closed' && !writing && (
        <div className="recap-paste">
          {paste === 'copied' && (
            <p className="small">
              ✓ Copied. Open{' '}
              <a href="https://claude.ai/new" target="_blank" rel="noreferrer">
                claude.ai
              </a>
              , paste it in and send. When Claude answers, copy its reply and paste it below.
            </p>
          )}
          <textarea rows={5} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Paste Claude’s reply here" />
          <div className="row">
            <button
              className="primary"
              disabled={!pasted.trim()}
              onClick={() => {
                onResult(pasted)
                setPasted('')
                setPaste('closed')
              }}
            >
              Use this reply
            </button>
            <button className="ghost" onClick={() => setPaste('closed')}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && <p className="error small">{error}</p>}
      {cost && <p className="muted small">{cost}</p>}
    </div>
  )
}
