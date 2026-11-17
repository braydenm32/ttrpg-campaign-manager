import type { MouseEvent } from 'react'
import { ArrowSquareOut, ClipboardText } from '@phosphor-icons/react'
import { Help } from '../help'
import { Ico } from '../icons'

/**
 * The free way to use Claude (or ChatGPT): open a new chat with everything already typed in.
 *
 * Both sites take the message in the address (claude.ai/new?q=…, chatgpt.com/?q=…), and on a phone
 * those addresses open the Claude or ChatGPT app when it's installed. World material can be far
 * longer than an address should carry, so above MAX_FILLED the chat opens empty and the GM pastes.
 * The text is always copied as well, in case the box comes up empty (signed out, an old app).
 */

export type ChatApp = 'claude' | 'chatgpt'

export const CHAT_APPS: Record<ChatApp, { name: string; home: string; fill: (q: string) => string }> = {
  claude: { name: 'Claude', home: 'https://claude.ai/new', fill: (q) => `https://claude.ai/new?q=${q}` },
  chatgpt: { name: 'ChatGPT', home: 'https://chatgpt.com/', fill: (q) => `https://chatgpt.com/?q=${q}` },
}

/**
 * The longest message (once written into an address) that is filled in for the GM. Both sites take
 * far longer addresses, but sign-in pages, phone apps and some browsers cut long ones short, so
 * this stays well under them: about 12,000 letters of plain English, less with lots of punctuation.
 */
export const MAX_FILLED = 16_000

/** Where to send the GM: the chat with the message filled in, or an empty one when it's too long. */
export function chatLink(app: ChatApp, text: string): { href: string; filled: boolean } {
  const q = encodeURIComponent(text)
  return q.length <= MAX_FILLED ? { href: CHAT_APPS[app].fill(q), filled: true } : { href: CHAT_APPS[app].home, filled: false }
}

/**
 * Copies right away, before the new tab takes the focus (the newer clipboard call waits, and a page
 * that has lost the focus can no longer copy). Falls back to the newer call where this one is gone.
 */
export function copyNow(text: string): Promise<boolean> {
  try {
    const box = document.createElement('textarea')
    box.value = text
    box.setAttribute('readonly', '')
    box.style.position = 'fixed'
    box.style.top = '0'
    box.style.opacity = '0'
    document.body.appendChild(box)
    box.select()
    box.setSelectionRange(0, text.length)
    const done = document.execCommand('copy')
    box.remove()
    if (done) return Promise.resolve(true)
  } catch {
    // Use the newer call below.
  }
  return navigator.clipboard.writeText(text).then(
    () => true,
    () => false,
  )
}

/** What happened when the GM pressed one of the buttons, for the note under them. */
export interface Opened {
  /** Undefined for plain “Copy”. */
  app?: ChatApp
  filled: boolean
  copied: boolean
}

/**
 * “Open in Claude”, “Open in ChatGPT” and “Copy”. They are real links, so a phone hands them to the
 * app; the address is worked out on the press, since building the message can mean writing out the
 * whole world.
 */
export function OpenInChat({ text, onOpened, disabled, help = true }: { text: () => string; onOpened: (o: Opened) => void; disabled?: boolean; help?: boolean }) {
  const open = (app: ChatApp) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (disabled) {
      e.preventDefault()
      return
    }
    const t = text()
    const { href, filled } = chatLink(app, t)
    // Changed before the browser follows the link, so it opens the filled-in chat.
    e.currentTarget.href = href
    void copyNow(t).then((copied) => onOpened({ app, filled, copied }))
  }
  const link = (app: ChatApp) => (
    <a
      className={`button chat-open${disabled ? ' disabled' : ''}`}
      data-chat={app}
      href={CHAT_APPS[app].home}
      target="_blank"
      rel="noreferrer"
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : undefined}
      onClick={open(app)}
      title={`Opens a new ${CHAT_APPS[app].name} chat with everything filled in (the ${CHAT_APPS[app].name} app on a phone). Free with your ${CHAT_APPS[app].name} account.`}
    >
      <Ico as={ArrowSquareOut} /> Open in {CHAT_APPS[app].name}
    </a>
  )
  return (
    <>
      {link('claude')}
      {link('chatgpt')}
      <button
        type="button"
        className="ghost chat-open"
        disabled={disabled}
        title="Copies everything, to paste into any AI chat yourself"
        onClick={() => void copyNow(text()).then((copied) => onOpened({ filled: false, copied }))}
      >
        <Ico as={ClipboardText} /> Copy
      </button>
      {help && <Help topic="openInChat" />}
    </>
  )
}

/**
 * The note after a press: what to do in the chat, and how to bring the answer back.
 * `photos` is how many pictures the GM still has to add there themselves.
 */
export function OpenedNote({ opened, photos = 0, back = 'copy its whole reply and paste it below', onCopyAgain }: { opened: Opened; photos?: number; back?: string; onCopyAgain?: () => void }) {
  const name = opened.app ? CHAT_APPS[opened.app].name : undefined
  const addPhotos = photos > 0 && (
    <>
      {' '}
      Add your <strong>{photos === 1 ? 'photo' : `${photos} photos`}</strong> there too (the + or paperclip button).
    </>
  )
  const copyAgain = onCopyAgain && (
    <button type="button" className="ghost small" onClick={onCopyAgain}>
      <Ico as={ClipboardText} /> Copy again
    </button>
  )
  if (name && opened.filled)
    return (
      <p className="small">
        ✓ Opened {name} in a new chat with everything filled in.{addPhotos} Send it (if it hasn’t sent already), then {back}. If the box was empty, paste it in: it’s copied too.{' '}
        {!opened.copied && copyAgain}
      </p>
    )
  if (!opened.copied)
    return (
      <p className="small">
        {name ? `Opened ${name}, but this` : 'This'} is too long to fill in for you and the browser wouldn’t let the app copy it. Press Copy again, then paste it into the chat yourself. {copyAgain}
      </p>
    )
  return (
    <p className="small">
      ✓ Copied.{' '}
      {name
        ? `It’s too long to fill in for you, so ${name} opened in a new chat: paste it into the message box (Ctrl+V, or press and hold, then Paste) and send.`
        : 'Paste it into Claude, ChatGPT or another AI chat and send.'}
      {addPhotos} Then {back}.
    </p>
  )
}
