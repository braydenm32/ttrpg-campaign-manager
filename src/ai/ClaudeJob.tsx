import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ClipboardText, PenNib, Sparkle } from '@phosphor-icons/react'
import { Help } from '../help'
import { Ico } from '../icons'
import { worldPath } from '../paths'
import { askClaude, dollars, estimateTokens, claudeCost, MODEL, modelName, usageCost, type ClaudeModel, type LocalTool } from './claude'
import { moveJob, startJob, stopJob, takeFinished, useJob } from './jobs'
import { useAiSettings } from './settings'

/** What to send Claude for one job. */
export interface JobRequest {
  /** Instructions and world material (cached). */
  system: string
  /** The ask itself. */
  prompt: string
  tools?: LocalTool[]
  describe?: (name: string, input: Record<string, unknown>) => string
  /** Which Claude: the big one unless the job is small. */
  model?: ClaudeModel
  effort?: 'low' | 'medium' | 'high'
  maxTokens?: number
  /** Roughly how long the answer will be, for the price shown on the button. */
  expectOut?: number
}

/**
 * The two ways to ask Claude for something: free with "Copy for Claude" (paste into claude.ai and
 * paste the answer back), or one click with the GM's own API key. Either way the answer comes back
 * to `onResult` for the GM to look over; nothing changes in the world on its own.
 *
 * The one-click job keeps going if the GM leaves the page (see jobs.ts): coming back shows it still
 * writing, or hands over the answer it finished meanwhile.
 */
export function ClaudeJob({
  worldId,
  jobId,
  jobTitle,
  label,
  build,
  onResult,
  disabled,
  extra,
  priceKey,
}: {
  worldId: string
  /** Stays the same for the same job, e.g. "prep:<session id>", so the panel finds it again. */
  jobId: string
  /** What it is, for the note in the top bar while the GM is elsewhere: "Prep for session 4". */
  jobTitle: string
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
  const job = useJob(jobId)
  const writing = job?.status === 'writing' ? job : undefined
  const [paste, setPaste] = useState<'closed' | 'open' | 'copied'>('closed')
  const [pasted, setPasted] = useState('')
  const [error, setError] = useState('')
  const [cost, setCost] = useState('')
  const { pathname, search } = useLocation()
  // A finished job (now, or while the GM was on another page) hands its answer over, then goes.
  const deliver = useRef(onResult)
  deliver.current = onResult
  useEffect(() => {
    if (!job) return
    if (job.status === 'writing') return moveJob(job.id, pathname, pathname + search)
    takeFinished(job, deliver.current, setError, setCost)
  }, [job, pathname, search])

  const price = useMemo(() => {
    if (disabled) return undefined
    const r = build()
    // Tools read more pages as they go: allow for a few more rounds of reading.
    const input = estimateTokens(r.system + r.prompt) * (r.tools?.length ? 1.6 : 1)
    const model = r.model ?? MODEL
    return { usd: claudeCost(model, input, r.expectOut ?? 1500), model }
    // Building the request can mean writing out the whole world, so only redo it when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceKey, disabled])

  const run = () => {
    setError('')
    setCost('')
    const r = build()
    const model = r.model ?? MODEL
    startJob({ id: jobId, worldId, title: jobTitle, path: pathname, href: pathname + search, model }, async ({ signal, onText, onStep }) => {
      const res = await askClaude({
        apiKey: key,
        model,
        system: r.system,
        messages: [{ role: 'user', content: r.prompt }],
        tools: r.tools,
        describe: r.describe,
        effort: r.effort,
        maxTokens: r.maxTokens,
        signal,
        onText,
        onStep,
      })
      return { text: res.text, note: `That cost about ${dollars(usageCost(model, res.usage))} with ${modelName(model)}.`, warning: res.warning }
    })
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
            <button className="ghost small" onClick={() => stopJob(jobId)}>
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
            {price ? ` (about ${dollars(price.usd)})` : ''}
          </button>
          {price && key && <ModelTag model={price.model} />}
          {paste === 'closed' && (
            <button className="ghost small" onClick={() => setPaste('open')}>
              Paste a reply
            </button>
          )}
        </div>
      )}
      {!key && !writing && (
        <p className="muted small">
          “Copy for Claude” is free with your Claude subscription. For one click, add an Anthropic API key in <Link to={`${worldPath(worldId)}/settings?tab=device`}>World settings → AI tools</Link>.
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

/** Which Claude a job uses, beside its price. */
export function ModelTag({ model }: { model: ClaudeModel }) {
  return (
    <span className="muted small model-tag" title={model === MODEL ? 'The most capable model, for bigger jobs' : 'Quicker and half the price, for small jobs'}>
      Uses {modelName(model)} <Help topic="claudeJobs" />
    </span>
  )
}
