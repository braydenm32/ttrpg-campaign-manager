import { useEffect, useState } from 'react'
import { ArrowRight } from '@phosphor-icons/react'
import { db } from './db'
import { PUBLIC_APP_URL } from './cloud/client'
import { Help } from './help'
import { Ico } from './icons'

/**
 * The web app moved from GitHub Pages to its own address. A browser keeps each site's data apart, so
 * worlds saved on the old address can't be read from the new one. This moves them across:
 *  - The old address shows a banner. Its button opens the new address, which asks for the data; the
 *    old one sends every table and the device settings (one browser, one device, so device-only
 *    things like API keys stay on this device), and the new one adds what it doesn't already have.
 *  - Once moved, or if the old address never had anything saved, it just forwards to the new
 *    address, keeping the rest of the link (invites and share links keep working).
 * Nothing on the old address is deleted, so a failed move can be tried again.
 */

const OLD_HOST = 'braydenm32.github.io'
const OLD_ORIGIN = `https://${OLD_HOST}`
const NEW_ORIGIN = new URL(PUBLIC_APP_URL).origin
const MOVED_KEY = 'codex.movedTo'

type MoveMessage =
  | { type: 'atlas-move-ready' }
  | { type: 'atlas-move-data'; tables: Record<string, unknown[]>; local: Record<string, string> }
  | { type: 'atlas-move-done'; worlds: number }
  | { type: 'atlas-move-failed'; error: string }

export const isOldHome = () => window.location.hostname === OLD_HOST

const newHome = (hash = window.location.hash) => PUBLIC_APP_URL + (hash || '')

/**
 * Whether the new address answers with the app (it may not be set up yet, may still be serving the
 * old landing page, or this device may be offline). Only the app has atlas-here.gif, and only a real
 * image loads, so a "not found" page doesn't count.
 */
function newHomeIsUp() {
  return new Promise<boolean>((resolve) => {
    const img = new Image()
    const timer = setTimeout(() => resolve(false), 5000)
    img.onload = () => {
      clearTimeout(timer)
      resolve(true)
    }
    img.onerror = () => {
      clearTimeout(timer)
      resolve(false)
    }
    img.src = `${PUBLIC_APP_URL}atlas-here.gif?${Date.now()}`
  })
}

function readLocal() {
  try {
    return localStorage.getItem(MOVED_KEY)
  } catch {
    return null
  }
}

/**
 * Runs before the app starts. Returns false when the page is leaving (forwarded to the new address,
 * or the new address is taking in a move), so the app shouldn't start.
 */
export async function startMove(): Promise<boolean> {
  if (isOldHome()) {
    if (readLocal()) {
      window.location.replace(newHome())
      return false
    }
    const empty = (await db.worlds.count()) === 0 && (await db.recordingChunks.count()) === 0
    if (empty && (await newHomeIsUp())) {
      window.location.replace(newHome())
      return false
    }
    return true
  }
  if (window.location.origin === NEW_ORIGIN && window.location.hash.startsWith('#/move-in') && window.opener) {
    receiveMove()
    return false
  }
  return true
}

/** The new address, opened by the old one: asks for the data, saves it, says how it went. */
function receiveMove() {
  const root = document.getElementById('root')!
  const say = (text: string) => {
    root.innerHTML = '<div class="move-screen"><p></p></div>'
    root.querySelector('p')!.textContent = text
  }
  say('Bringing your worlds over from the old address…')
  const reply = (m: MoveMessage) => window.opener?.postMessage(m, OLD_ORIGIN)
  let started = false
  window.addEventListener('message', async (e: MessageEvent<MoveMessage>) => {
    if (e.origin !== OLD_ORIGIN || e.data?.type !== 'atlas-move-data' || started) return
    started = true
    try {
      const worlds = await saveMoved(e.data.tables, e.data.local)
      say('Done. Your worlds are here now.')
      reply({ type: 'atlas-move-done', worlds })
    } catch (err) {
      say(`The move didn’t work: ${(err as Error).message}. Close this tab and try again from the old address.`)
      reply({ type: 'atlas-move-failed', error: (err as Error).message })
    }
  })
  // The old page is already listening, but say it a few times in case this page loaded first.
  const ask = setInterval(() => (started ? clearInterval(ask) : reply({ type: 'atlas-move-ready' })), 500)
  reply({ type: 'atlas-move-ready' })
}

/** Adds everything this address doesn't already have (same ids, so synced worlds stay linked to the cloud). */
async function saveMoved(tables: Record<string, unknown[]>, local: Record<string, string>) {
  let worlds = 0
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) {
      const rows = tables[table.name] ?? []
      if (!rows.length) continue
      const key = table.schema.primKey.keyPath as string
      const have = new Set((await table.toCollection().primaryKeys()).map(String))
      if (table.schema.primKey.auto) {
        // Recording pieces are numbered by each address on its own, so they get new numbers here.
        const recordings = new Set((await table.toArray()).map((r) => (r as { recordingId: string }).recordingId))
        const fresh = rows.filter((r) => !recordings.has((r as { recordingId: string }).recordingId))
        await table.bulkAdd(
          fresh.map((r) => {
            const { [key]: _old, ...rest } = r as Record<string, unknown>
            return rest
          }),
        )
        continue
      }
      const fresh = rows.filter((r) => !have.has(String((r as Record<string, unknown>)[key])))
      await table.bulkAdd(fresh)
      if (table.name === 'worlds') worlds = fresh.length
    }
  })
  for (const [k, v] of Object.entries(local)) {
    try {
      if (localStorage.getItem(k) === null) localStorage.setItem(k, v)
    } catch {
      // Storage blocked: settings stay as they are here.
    }
  }
  return worlds
}

/** The old address, sending: opens the new one and hands over everything once it asks. */
async function sendMove(): Promise<number> {
  const tables: Record<string, unknown[]> = {}
  for (const table of db.tables) tables[table.name] = await table.toArray()
  const local: Record<string, string> = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!
      local[k] = localStorage.getItem(k) ?? ''
    }
  } catch {
    // Storage blocked: only the worlds move.
  }
  const win = window.open(PUBLIC_APP_URL + '#/move-in', '_blank')
  if (!win) throw new Error('Your browser blocked the new tab. Allow pop-ups for this site and try again.')
  return new Promise((resolve, reject) => {
    let sent = false
    const timer = setTimeout(() => finish(() => reject(new Error('The new address didn’t answer. Check you’re online and try again.'))), 120_000)
    const finish = (then: () => void) => {
      clearTimeout(timer)
      window.removeEventListener('message', onMessage)
      then()
    }
    const onMessage = (e: MessageEvent<MoveMessage>) => {
      if (e.origin !== NEW_ORIGIN || e.source !== win) return
      if (e.data?.type === 'atlas-move-ready' && !sent) {
        sent = true
        win.postMessage({ type: 'atlas-move-data', tables, local } satisfies MoveMessage, NEW_ORIGIN)
      } else if (e.data?.type === 'atlas-move-done') {
        const worlds = e.data.worlds
        win.close()
        finish(() => resolve(worlds))
      } else if (e.data?.type === 'atlas-move-failed') {
        const error = e.data.error
        finish(() => reject(new Error(error)))
      }
    }
    window.addEventListener('message', onMessage)
  })
}

/** "The Warded Atlas has moved": shown on the old address until this device's worlds are moved. */
export function MoveBanner() {
  const [up, setUp] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (isOldHome()) void newHomeIsUp().then(setUp)
  }, [])
  if (!up) return null
  const move = async () => {
    setBusy(true)
    setError('')
    try {
      await sendMove()
      try {
        localStorage.setItem(MOVED_KEY, new Date().toISOString())
      } catch {
        // Storage blocked: the banner just shows again here.
      }
      window.location.replace(newHome('#/'))
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }
  return (
    <div className="move-banner" role="status">
      <span>
        The Warded Atlas has a new home at <strong>{new URL(PUBLIC_APP_URL).host}</strong>. Move this device’s worlds there in one click. <Help topic="moving" />
      </span>
      <button className="small primary" onClick={move} disabled={busy}>
        {busy ? 'Moving…' : 'Move my worlds'} <Ico as={ArrowRight} />
      </button>
      {error && <span className="error small">{error}</span>}
    </div>
  )
}
