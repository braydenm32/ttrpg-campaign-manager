import { useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { CheckCircle, PenNib, Warning, X } from '@phosphor-icons/react'
import { Modal } from '../components'
import { Ico } from '../icons'
import { hashRouting } from '../paths'
import { anyWriting, clearJob, stopJob, useJobs } from './jobs'
import { holdUp, setPending, usePending } from './leave'
import './jobs.css'

/**
 * Leaving a page while Claude is writing there: the GM chooses to keep it writing in the background
 * (a note in the top bar leads back to it) or to stop it. The app uses a plain BrowserRouter /
 * HashRouter, which can't hold up a move to another page, so this catches it before the router
 * does: clicks on links inside the app (caught early, before the link acts), plus the few buttons
 * that move between pages (they use useGuardedNavigate, in leave.ts). Anything else, like the browser's Back
 * button, just leaves with Claude still writing, which loses nothing.
 */

/** Where a click on this link would take the app, or nothing for links that leave it (or stay put). */
function inAppTarget(a: HTMLAnchorElement) {
  if ((a.target && a.target !== '_self') || a.hasAttribute('download')) return
  const url = new URL(a.href, window.location.href)
  if (url.origin !== window.location.origin) return
  if (hashRouting) return url.hash.startsWith('#/') ? url.hash.slice(1) : undefined
  return url.pathname + url.search + url.hash
}

/** Mounted once in the world's layout: catches leaving, warns before closing the tab, and asks. */
export function LeaveGuard() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const ask = usePending()
  const here = useRef(pathname)
  useEffect(() => {
    here.current = pathname
  }, [pathname])

  useEffect(() => {
    const click = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      const to = a && inAppTarget(a)
      if (!to || !holdUp(here.current, to)) return
      // Caught before the link (or React) sees the click; the choice below does the moving.
      e.preventDefault()
      e.stopPropagation()
    }
    // Closing or reloading the tab can't keep Claude going, so the browser asks first.
    const unload = (e: BeforeUnloadEvent) => {
      if (!anyWriting()) return
      e.preventDefault()
      e.returnValue = ''
    }
    document.addEventListener('click', click, true)
    window.addEventListener('beforeunload', unload)
    return () => {
      document.removeEventListener('click', click, true)
      window.removeEventListener('beforeunload', unload)
    }
  }, [])

  if (!ask) return null
  const stay = () => setPending(undefined)
  const go = (stop: boolean) => {
    if (stop) ask.jobs.forEach((j) => stopJob(j.id))
    setPending(undefined)
    navigate(ask.to)
  }
  const one = ask.jobs[0].title
  const what = ask.jobs.length === 1 ? one[0].toLowerCase() + one.slice(1) : 'more than one thing'
  return (
    <Modal title="Claude is still writing" onClose={stay}>
      <div className="leave-ask">
        <p>Claude is writing {what} on this page.</p>
        <p className="muted small">
          It can keep writing while you go elsewhere: a note at the top of the screen says when it’s done, and takes you back to it. (Closing the app or this tab would stop it.)
        </p>
        <div className="row wrap end">
          <button className="ghost" onClick={stay}>
            Stay here
          </button>
          <button onClick={() => go(true)}>Stop and leave</button>
          <button className="primary" onClick={() => go(false)}>
            Keep Claude writing
          </button>
        </div>
      </div>
    </Modal>
  )
}

/** In the top bar: Claude jobs of this world that are writing or finished on another page. */
export function ClaudeJobChips({ worldId }: { worldId: string }) {
  const { pathname } = useLocation()
  const jobs = useJobs().filter((j) => j.worldId === worldId && j.path !== pathname)
  if (!jobs.length) return null
  return (
    <div className="claude-chips">
      {jobs.map((j) => {
        const label = j.status === 'writing' ? 'Claude is writing…' : j.status === 'done' ? 'Claude finished' : 'Claude had a problem'
        const short = j.status === 'writing' ? 'Claude writing…' : j.status === 'done' ? 'Claude done' : 'Claude problem'
        return (
          <span key={j.id} className={`claude-chip ${j.status}`}>
            <Link to={j.href} title={`${j.title}: ${label} Click to go back to it.`}>
              <Ico as={j.status === 'writing' ? PenNib : j.status === 'done' ? CheckCircle : Warning} />
              <span className="long">{label}</span>
              <span className="short">{short}</span>
            </Link>
            {j.status !== 'writing' && (
              <button className="ghost" onClick={() => clearJob(j.id)} title={j.result ? 'Dismiss (Claude’s answer is thrown away)' : 'Dismiss'} aria-label={`Dismiss: ${j.title}`}>
                <Ico as={X} />
              </button>
            )}
          </span>
        )
      })}
    </div>
  )
}
