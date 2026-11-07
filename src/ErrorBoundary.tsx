import { Component, useState, type MouseEvent, type ReactNode } from 'react'
import { db } from './db'
import { exportWorld } from './backup'
import { hashRouting, hrefFor } from './paths'

type Props = { children: ReactNode; resetKey?: string; whole?: boolean; quiet?: boolean; fallback?: ReactNode }

/**
 * Catches a screen that crashes, so the whole app doesn't go blank. It shows what happened in plain
 * words, offers a reload, and (so nothing is stranded) a download of every world on this device.
 * Pass a new `resetKey` (the address, say) to try again after the person goes somewhere else.
 * `quiet` is for a piece of the world's frame (the date in the top bar, a banner): if it crashes it
 * is simply left out, so one odd value in a world can't stop the whole world from opening. With a
 * `fallback`, that is shown in its place instead (for a piece that mustn't vanish unnoticed).
 */
export class ErrorBoundary extends Component<Props, { error: Error | null; key?: string }> {
  state: { error: Error | null; key?: string } = { error: null, key: this.props.resetKey }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  static getDerivedStateFromProps(props: Props, state: { error: Error | null; key?: string }) {
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null
  }
  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return this.props.quiet ? (this.props.fallback ?? null) : <Crashed error={error} whole={this.props.whole} />
  }
}

/**
 * Leaves a crash for the list of worlds. A plain link starts the app afresh there; with "#/"
 * addresses (the desktop app) changing the address alone wouldn't, so the page is reloaded on it.
 */
function goHome(e: MouseEvent) {
  if (!hashRouting) return
  e.preventDefault()
  location.hash = '/'
  location.reload()
}

function Crashed({ error, whole }: { error: Error; whole?: boolean }) {
  const closed = /DatabaseClosed|VersionChange|blocked/i.test(`${error.name} ${error.message}`)
  const text = `${error.name}: ${error.message}`
  const [withAudio, setWithAudio] = useState(false)
  return (
    <div className={whole ? 'loading error-screen' : 'page error-screen'}>
      <h1>Something went wrong{whole ? '' : ' with this page'}</h1>
      <p>
        {closed
          ? 'Your worlds are saved on this device, but another window of the Warded Atlas has updated them. Close any other Warded Atlas windows or tabs, then reload.'
          : 'Your worlds are safe on this device. Reloading usually fixes it. If it keeps happening, download a backup first, then tell whoever looks after the app what the message below says.'}
      </p>
      <p className="row">
        <button className="primary" onClick={() => location.reload()}>
          Reload
        </button>
        {/* A world that crashes every time it opens mustn't trap anyone in it. */}
        {whole && (
          <a className="button" href={hrefFor('/')} onClick={goHome}>
            Go to your worlds
          </a>
        )}
        <button
          onClick={async () => {
            try {
              for (const w of await db.worlds.toArray()) if (!w.shared) await exportWorld(w.id, undefined, { recordings: withAudio })
            } catch (e) {
              alert(`Couldn’t make a backup: ${e instanceof Error ? e.message : String(e)}`)
            }
          }}
        >
          Download a backup of every world
        </button>
        <button onClick={() => navigator.clipboard?.writeText(text).catch(() => {})}>Copy the message</button>
        <label className="row small">
          <input type="checkbox" checked={withAudio} onChange={(e) => setWithAudio(e.target.checked)} />
          Include session recordings (much bigger)
        </label>
      </p>
      <pre className="small muted">{text}</pre>
    </div>
  )
}
