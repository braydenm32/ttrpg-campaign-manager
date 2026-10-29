import { useSyncExternalStore } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { writingOn, type ClaudeJobState } from './jobs'

/** The question "Claude is still writing: leave anyway?", waiting for the GM's answer (asked by LeaveGuard). */
let pending: { to: string; jobs: ClaudeJobState[] } | undefined
const listeners = new Set<() => void>()
export const setPending = (p: typeof pending) => {
  pending = p
  listeners.forEach((l) => l())
}
export const usePending = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => pending,
  )

const pathOf = (to: string) => new URL(to, 'https://x').pathname

/** Asks first when going to `to` would leave a page where Claude is writing. True when it's asking. */
export function holdUp(from: string, to: string) {
  const writing = writingOn(from)
  if (!writing.length || pathOf(to) === from) return false
  setPending({ to, jobs: writing })
  return true
}

/** useNavigate for buttons that go to another page: asks first if Claude is writing on this one. */
export function useGuardedNavigate() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  return (to: string) => {
    if (!holdUp(pathname, to)) navigate(to)
  }
}
