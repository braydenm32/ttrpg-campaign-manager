import type { BetaContentBlock, BetaMessageParam, BetaTextBlockParam, BetaTool, BetaToolResultBlockParam } from '@anthropic-ai/sdk/resources/beta/messages'

/**
 * Talking to Claude with the GM's own Anthropic API key, straight from the browser. Every AI tool in
 * the app goes through here, so they all handle errors, refusals and costs the same way.
 */

/**
 * The two Claude models the app uses, with their prices in US dollars per million tokens. Big jobs
 * (recaps with world updates, continuity checks, prep) get the most capable one; small ones (flavour,
 * NPC lines, Archivist questions) a quicker one at half the price.
 */
export const MODELS = {
  'claude-opus-5-5': { name: 'Claude Opus 5.5', input: 4, output: 20, cachedRead: 0.2, cacheWrite: 5 },
  'claude-sonnet-5-5': { name: 'Claude Sonnet 5.5', input: 2, output: 10, cachedRead: 0.2, cacheWrite: 2.5 },
} as const
export type ClaudeModel = keyof typeof MODELS

/** For big jobs, and anything that doesn't say. */
export const MODEL: ClaudeModel = 'claude-opus-5-5'
/** For small, quick jobs. */
export const QUICK_MODEL: ClaudeModel = 'claude-sonnet-5-5'

/** "Claude Sonnet 5.5". */
export const modelName = (model: ClaudeModel) => MODELS[model].name

/** Rough cost in US dollars of a job on that model. */
export const claudeCost = (model: ClaudeModel, input: number, output: number, cachedRead = 0, cacheWrite = 0) => {
  const p = MODELS[model]
  return (input * p.input + output * p.output + cachedRead * p.cachedRead + cacheWrite * p.cacheWrite) / 1e6
}

/** About four characters per token for English text. */
export const estimateTokens = (text: string) => Math.ceil(text.length / 4)

/** "about US$0.12", never "US$0.00". */
export const dollars = (usd: number) => `US$${Math.max(0.01, usd).toFixed(2)}`

export interface ClaudeUsage {
  input: number
  output: number
  cachedRead: number
  cacheWrite: number
}
export const usageCost = (model: ClaudeModel, u: ClaudeUsage) => claudeCost(model, u.input, u.output, u.cachedRead, u.cacheWrite)

export type { BetaMessageParam as ClaudeMessage, BetaContentBlock as ClaudeBlock }

/** A tool Claude can call, run here on this device (reading pages from the GM's own world). */
export interface LocalTool {
  name: string
  description: string
  input_schema: BetaTool['input_schema']
  run: (input: Record<string, unknown>) => Promise<string> | string
}

export interface AskOptions {
  apiKey: string
  /** Which Claude; the big one unless the job is small. */
  model?: ClaudeModel
  /** Instructions and material that stay the same between questions; cached so follow-ups are cheap. */
  system: string
  messages: BetaMessageParam[]
  tools?: LocalTool[]
  /** Shorter, quicker answers for small jobs. */
  effort?: 'low' | 'medium' | 'high'
  maxTokens?: number
  /** Called with the text written so far in this answer. */
  onText?: (soFar: string) => void
  /** Called when Claude reads something with a tool, e.g. "Reading Cinderford". */
  onStep?: (what: string) => void
  /** Describes a tool call for onStep. */
  describe?: (name: string, input: Record<string, unknown>) => string
  signal?: AbortSignal
}

/**
 * Asks Claude, running any tools it calls until it answers. Returns the final text, the whole
 * exchange (to carry on the conversation) and what it used.
 */
export async function askClaude(opts: AskOptions) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  // The key belongs to the person using this device and is only ever sent to Anthropic.
  const client = new Anthropic({ apiKey: opts.apiKey, dangerouslyAllowBrowser: true })
  const system: BetaTextBlockParam[] = [{ type: 'text', text: opts.system, cache_control: { type: 'ephemeral' } }]
  const tools = opts.tools?.map(({ name, description, input_schema }) => ({ name, description, input_schema }))
  const messages = [...opts.messages]
  const usage: ClaudeUsage = { input: 0, output: 0, cachedRead: 0, cacheWrite: 0 }
  let text = ''
  /** Said alongside the answer when it isn't the whole of it. */
  let warning: string | undefined
  try {
    for (let round = 0; ; round++) {
      if (round === MAX_ROUNDS) {
        warning = 'Claude was still reading pages when it had to stop, so this answer may be unfinished. Try asking about something narrower.'
        break
      }
      const stream = client.beta.messages.stream(
        {
          model: opts.model ?? MODEL,
          max_tokens: opts.maxTokens ?? 16000,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          system,
          ...(tools?.length ? { tools } : {}),
          ...(opts.effort ? { output_config: { effort: opts.effort } } : {}),
          // The conversation so far is cached too, so each follow-up only pays for what's new.
          cache_control: { type: 'ephemeral' },
          messages,
        },
        { signal: opts.signal },
      )
      let soFar = ''
      stream.on('text', (delta) => {
        soFar += delta
        opts.onText?.(soFar)
      })
      const message = await stream.finalMessage()
      usage.input += message.usage.input_tokens
      usage.output += message.usage.output_tokens
      usage.cachedRead += message.usage.cache_read_input_tokens ?? 0
      usage.cacheWrite += message.usage.cache_creation_input_tokens ?? 0
      if (message.stop_reason === 'refusal') throw new Error('Claude declined to answer that one.')
      if (message.stop_reason === 'max_tokens' || message.stop_reason === 'model_context_window_exceeded') warning = CUT_OFF
      messages.push({ role: 'assistant', content: message.content })
      text = message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
      const calls = message.content.filter((b) => b.type === 'tool_use')
      if (message.stop_reason === 'pause_turn') continue
      if (message.stop_reason !== 'tool_use' || !calls.length) break
      const results: BetaToolResultBlockParam[] = []
      for (const call of calls) {
        const tool = opts.tools?.find((t) => t.name === call.name)
        const input = call.input && typeof call.input === 'object' ? (call.input as Record<string, unknown>) : {}
        opts.onStep?.(opts.describe?.(call.name, input) ?? call.name)
        try {
          results.push({ type: 'tool_result', tool_use_id: call.id, content: tool ? await tool.run(input) : `There is no tool called ${call.name}.`, is_error: !tool })
        } catch (err) {
          results.push({ type: 'tool_result', tool_use_id: call.id, content: (err as Error).message || 'That didn’t work.', is_error: true })
        }
      }
      messages.push({ role: 'user', content: results })
    }
    return { text, messages, usage, warning }
  } catch (err) {
    throw friendly(err, Anthropic)
  }
}

/** Rounds of reading pages with tools before Claude has to answer. */
const MAX_ROUNDS = 12

/** When Claude stops because the answer hit its length limit. */
export const CUT_OFF = 'Claude ran out of room before it finished, so the end of this answer is missing. Try a smaller job, or use “Copy for Claude” instead.'

/** Turns the SDK's errors into something a GM can act on. */
export function friendly(err: unknown, Anthropic: typeof import('@anthropic-ai/sdk').default) {
  if (err instanceof Anthropic.AuthenticationError) return new Error('Anthropic didn’t accept the API key. Check it in World settings → AI tools.')
  if (err instanceof Anthropic.RateLimitError) return new Error('Anthropic says you’re over your limit for now. Wait a minute and try again.')
  if (err instanceof Anthropic.APIError && /credit/i.test(err.message)) return new Error('Your Anthropic account is out of credit. Add some at console.anthropic.com → Billing.')
  if (err instanceof Anthropic.APIConnectionError) return new Error('Could not reach Anthropic. Check your internet connection.')
  if (err instanceof Anthropic.APIError && (err.status === 413 || (err.status === 400 && /too long|too many tokens|context (window|length)/i.test(err.message))))
    return new Error('That’s more than Claude can read in one go. Try a smaller job (one page, or one recording), or use “Copy for Claude” instead.')
  if (err instanceof Anthropic.APIError && (err.status === 529 || (err.status ?? 0) >= 500))
    return new Error('Anthropic is busy or having trouble right now. Wait a few minutes and try again.')
  return err
}
