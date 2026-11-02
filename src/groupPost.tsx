import { useState, useSyncExternalStore } from 'react'
import { ShareNetwork, X } from '@phosphor-icons/react'
import { appLink } from './cloud/client'
import type { World } from './db'
import { getWebhook, postToDiscord } from './discord'
import { Help } from './help'
import { Ico } from './icons'
import { worldPath } from './paths'

/**
 * "Post a link for the group": nothing reaches a player's phone unless they come looking, so when
 * the GM puts something out for players (a recap, an answer, a handout) a small card offers to tell
 * the group chat. It copies a short line and the Common Room's link, or opens the phone's Share sheet
 * (WhatsApp, Messages…), and posts to Discord too when the world has a webhook (ticked by default
 * then). Only plain words go out: never the recap's text, an answer or a page.
 */

interface Offer {
  id: number
  worldId: string
  /** "The recap of #4 The Drowned Man is up." */
  text: string
}

let current: Offer | null = null
let next = 1
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** Offers the card, for a world players can reach (synced) or with a Discord webhook. */
export function offerGroupPost(world: Pick<World, 'id' | 'cloud' | 'shared'> | null | undefined, text: string) {
  if (!world || world.shared) return
  if (!world.cloud?.enabled && !getWebhook(world.id)) return
  current = { id: next++, worldId: world.id, text }
  emit()
}

const close = () => {
  current = null
  emit()
}

/** The Common Room's address on the web, for the group chat. */
export const commonRoomLink = (worldId: string) => appLink(worldPath(worldId))

/** The card itself, shown once in the world's frame. */
export function GroupPostOffer() {
  const offer = useSyncExternalStore(subscribe, () => current)
  return offer ? <OfferCard key={offer.id} offer={offer} /> : null
}

function OfferCard({ offer }: { offer: Offer }) {
  const webhook = !!getWebhook(offer.worldId)
  const [discord, setDiscord] = useState(webhook)
  const [said, setSaid] = useState('')
  const link = commonRoomLink(offer.worldId)
  const message = `${offer.text} ${link}`
  const canShare = typeof navigator !== 'undefined' && !!navigator.share
  const alsoDiscord = async () => {
    if (!discord) return ''
    try {
      await postToDiscord(offer.worldId, offer.text, link)
      return ' Posted to Discord too.'
    } catch (e) {
      return ` Discord didn’t take it: ${(e as Error).message}`
    }
  }
  const copy = async () => {
    let copied = true
    try {
      await navigator.clipboard.writeText(message)
    } catch {
      copied = false
    }
    const extra = await alsoDiscord()
    setSaid(copied ? `Copied. Paste it in the group chat.${extra}` : `Couldn’t copy here; select the line above instead.${extra}`)
  }
  const share = async () => {
    try {
      await navigator.share({ text: offer.text, url: link })
    } catch {
      // Closed the Share sheet: nothing to say.
      return
    }
    setSaid(`Shared.${await alsoDiscord()}`)
  }
  return (
    <aside className="group-post card" aria-label="Post a link for the group">
      <div className="row spread">
        <strong>
          <Ico as={ShareNetwork} /> Post a link for the group <Help topic="groupPost" />
        </strong>
        <button className="ghost small group-post-close" aria-label="Close" onClick={close}>
          <Ico as={X} />
        </button>
      </div>
      <p className="small group-post-text">
        {offer.text} <span className="muted">{link}</span>
      </p>
      <div className="row wrap">
        {canShare && (
          <button className="primary small" onClick={share}>
            Share…
          </button>
        )}
        <button className={`small ${canShare ? '' : 'primary'}`} onClick={copy}>
          Copy text and link
        </button>
        {webhook && (
          <label className="inline-check small">
            <input type="checkbox" checked={discord} onChange={(e) => setDiscord(e.target.checked)} /> Post to Discord too
          </label>
        )}
        {webhook && !canShare && discord && (
          <button className="small ghost" onClick={async () => setSaid((await alsoDiscord()).trim() || 'Posted.')}>
            Only Discord
          </button>
        )}
      </div>
      {said && (
        <p className="small muted" role="status">
          {said}
        </p>
      )}
    </aside>
  )
}
