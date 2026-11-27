import { db } from './db'

/**
 * The opening page while the app starts. Normally the app takes its place in a blink. If the saved
 * worlds can't be opened yet, it must not look dead: this puts a note at the top saying what is
 * happening and what to do, with a "Try again" button, and takes it away once the app is up.
 *
 * The one known cause is another tab of the Warded Atlas on this device still using an older
 * version while this one needs to bring the saved worlds up to date (the browser makes this tab
 * wait for the other to let go). The app carries on by itself as soon as that tab is closed.
 */
export function watchStart() {
  let note: HTMLElement | undefined
  const say = (text: string) => {
    if (!note) {
      note = document.createElement('div')
      note.className = 'start-note'
      note.setAttribute('role', 'status')
      const p = document.createElement('p')
      const again = document.createElement('button')
      again.type = 'button'
      again.textContent = 'Try again'
      again.addEventListener('click', () => window.location.reload())
      note.append(p, again)
      document.body.prepend(note)
    }
    note.querySelector('p')!.textContent = text
  }
  const blocked = () =>
    say(
      'The Warded Atlas has been updated, and another tab of it on this device is still open with the older version. Close the other Warded Atlas tabs and this one carries on by itself. Your worlds are safe.',
    )
  db.on('blocked', blocked)
  // No word from the browser after a while: say so anyway, with the same advice.
  const slow = window.setTimeout(
    () => say('Still opening your worlds. If this stays, close any other Warded Atlas tabs on this device, then press Try again. Your worlds are safe.'),
    6000,
  )
  return () => {
    window.clearTimeout(slow)
    db.on('blocked').unsubscribe(blocked)
    note?.remove()
  }
}
