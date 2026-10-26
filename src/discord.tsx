import { useState } from 'react'
import { Help } from './help'
import { stripSecrets } from './Markdown'
import { plainLinks } from './text'

/**
 * Posting to the group's Discord channel through a webhook link. The link works like a password
 * for posting to that channel, so it's kept on this device only (never synced or backed up).
 * Only player-safe text is ever posted: secret passages are stripped first.
 */

const key = (worldId: string) => `codex.discord.${worldId}`
const WEBHOOK = /^https:\/\/(?:[a-z]+\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/

export function getWebhook(worldId: string) {
  try {
    return localStorage.getItem(key(worldId)) ?? ''
  } catch {
    return ''
  }
}

function setWebhook(worldId: string, url: string) {
  try {
    if (url) localStorage.setItem(key(worldId), url)
    else localStorage.removeItem(key(worldId))
  } catch {
    // Storage blocked: nothing to remember it in.
  }
}

/** Turns app Markdown into what Discord shows well: no secrets, [[links]] as plain names. */
export const forDiscord = (text: string) => plainLinks(stripSecrets(text)).trim()

/**
 * Posts a titled message. Long text is split across several embeds (Discord allows 4,096
 * characters in each, and 6,000 across all the embeds in one message), sent as several messages.
 */
export async function postToDiscord(worldId: string, title: string, text: string) {
  const url = getWebhook(worldId)
  if (!url) throw new Error('Add your Discord webhook link in World settings first.')
  const chunks: string[] = []
  let rest = text || ' '
  while (rest.length) {
    let cut = rest.length > 4000 ? rest.lastIndexOf('\n', 4000) : rest.length
    if (cut < 2000) cut = Math.min(4000, rest.length)
    chunks.push(rest.slice(0, cut))
    rest = rest.slice(cut).replace(/^\n+/, '')
  }
  const messages: { title?: string; description: string; color: number }[][] = []
  let size = Infinity
  chunks.forEach((description, i) => {
    const embed = { ...(i === 0 ? { title: title.slice(0, 256) } : {}), description, color: 0xb3261e }
    const length = description.length + (embed.title?.length ?? 0)
    if (size + length > 5900 || messages[messages.length - 1].length >= 10) {
      messages.push([])
      size = 0
    }
    messages[messages.length - 1].push(embed)
    size += length
  })
  for (const embeds of messages) {
    // Sent as a form, which browsers send without a preflight check, with ?wait so Discord says whether it worked.
    const body = new FormData()
    body.append('payload_json', JSON.stringify({ username: 'The Warded Atlas', embeds, allowed_mentions: { parse: [] } }))
    const res = await fetch(`${url}?wait=true`, { method: 'POST', body })
    if (!res.ok) throw new Error(`Discord said no (${res.status}). Check the webhook link in World settings.`)
  }
}

/** World settings: the webhook link, with a test button. */
export function DiscordSettings({ worldId }: { worldId: string }) {
  const [url, setUrl] = useState(() => getWebhook(worldId))
  const [state, setState] = useState('')
  const valid = !url || WEBHOOK.test(url.trim())
  return (
    <section>
      <h2>
        💬 Discord <Help topic="discord" />
      </h2>
      <p className="muted">Post recaps and session dates to your group’s channel. The link stays on this device.</p>
      <div className="row wrap">
        <input
          className="grow"
          type="password"
          autoComplete="off"
          value={url}
          placeholder="https://discord.com/api/webhooks/…"
          onChange={(e) => {
            setUrl(e.target.value)
            setState('')
            if (!e.target.value.trim() || WEBHOOK.test(e.target.value.trim())) setWebhook(worldId, e.target.value.trim())
          }}
        />
        <button
          disabled={!url || !valid}
          onClick={async () => {
            setState('Sending…')
            try {
              await postToDiscord(worldId, '👋 Hello from the Warded Atlas', 'Recaps and session dates will appear here.')
              setState('✓ Sent. Check your channel.')
            } catch (e) {
              setState((e as Error).message)
            }
          }}
        >
          Send a test
        </button>
      </div>
      {!valid && <p className="error small">That doesn’t look like a Discord webhook link.</p>}
      {state && <p className="small">{state}</p>}
    </section>
  )
}

/** A "post to Discord" button that only appears once a webhook is set up on this device. */
export function DiscordButton({ worldId, title, text, label = '💬 Post to Discord', confirmText }: { worldId: string; title: string; text: () => string; label?: string; confirmText?: string }) {
  const [state, setState] = useState('')
  if (!getWebhook(worldId)) return null
  return (
    <span className="row">
      <button
        type="button"
        disabled={state === 'Posting…'}
        onClick={async () => {
          if (confirmText && !confirm(confirmText)) return
          setState('Posting…')
          try {
            await postToDiscord(worldId, title, text())
            setState('✓ Posted')
          } catch (e) {
            setState((e as Error).message)
          }
        }}
      >
        {label}
      </button>
      {state && <span className="small muted">{state}</span>}
    </span>
  )
}
