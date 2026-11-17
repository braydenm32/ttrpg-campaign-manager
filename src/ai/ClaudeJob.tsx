import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { PenNib, Sparkle } from '@phosphor-icons/react'
import { Help } from '../help'
import { Ico } from '../icons'
import { worldPath } from '../paths'
import { askClaude, dollars, estimateTokens, claudeCost, MODEL, modelName, usageCost, type ClaudeModel, type LocalTool } from './claude'
import { moveJob, startJob, stopJob, takeFinished, useJob } from './jobs'
import { useAiSettings } from './settings'
import { copyNow, OpenedNote, OpenInChat, type Opened } from './OpenInChat'

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
  /**
   * Pictures or PDFs sent with the ask (photos of hand-written notes). With “Open in Claude” the GM
   * adds them in the chat themselves, so the note under the buttons says so.
   */
  attachments?: { name: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'application/pdf'; data: string; tokens: number }[]
}

/**
 * The two ways to ask Claude for something: free with "Open in Claude" or "Open in ChatGPT" (a new
 * chat opens with everything filled in, and the GM pastes the answer back, see OpenInChat.tsx), or one click with the GM's own API key. Either way the answer comes back
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
  const [paste, setPaste] = useState<'closed' | 'open'>('closed')
  /** What the last “Open in…” or “Copy” press did, for the note above the paste box. */
  const [opened, setOpened] = useState<Opened>()
  /** How many photos the GM has to add in the chat alongside what was filled in. */
  const [toAttach, setToAttach] = useState(0)
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
    const input = estimateTokens(r.system + r.prompt) * (r.tools?.length ? 1.6 : 1) + (r.attachments ?? []).reduce((n, a) => n + a.tokens, 0)
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
        messages: [
          {
            role: 'user',
            content: r.attachments?.length
              ? [
                  ...r.attachments.map((a) =>
                    a.mediaType === 'application/pdf'
                      ? ({ type: 'document', source: { type: 'base64', media_type: a.mediaType, data: a.data } } as const)
                      : ({ type: 'image', source: { type: 'base64', media_type: a.mediaType, data: a.data } } as const),
                  ),
                  { type: 'text' as const, text: r.prompt },
                ]
              : r.prompt,
          },
        ],
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

  const whole = () => {
    const r = build()
    setToAttach(r.attachments?.length ?? 0)
    return `${r.system}\n\n${r.prompt}`
  }
  const onOpened = (o: Opened) => {
    setError('')
    setOpened(o)
    setPaste('open')
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
          <OpenInChat text={whole} onOpened={onOpened} disabled={disabled} />
          <button className="primary" onClick={run} disabled={disabled || !key} title={key ? 'Uses your Anthropic API key' : 'Add an Anthropic API key in World settings → This device first'}>
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
          “Open in Claude” and “Open in ChatGPT” are free with your own account there. For one click, add an Anthropic API key in <Link to={`${worldPath(worldId)}/settings?tab=device`}>World settings → This device</Link>.
        </p>
      )}
      {paste !== 'closed' && !writing && (
        <div className="recap-paste">
          {opened && <OpenedNote opened={opened} photos={toAttach} onCopyAgain={() => void copyNow(whole()).then((copied) => setOpened({ ...opened, copied }))} />}
          <textarea rows={5} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Paste the reply here" />
          <div className="row">
            <button
              className="primary"
              disabled={!pasted.trim()}
              onClick={() => {
                onResult(pasted)
                setPasted('')
                setPaste('closed')
                setOpened(undefined)
              }}
            >
              Use this reply
            </button>
            <button
              className="ghost"
              onClick={() => {
                setPaste('closed')
                setOpened(undefined)
              }}
            >
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
