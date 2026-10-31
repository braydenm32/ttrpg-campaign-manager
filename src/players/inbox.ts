import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useAuthSession } from '../cloud/auth'
import { listCharacterRequests, listPlayers, type CharacterRequest, type Claim, type Member } from '../cloud/players'
import type { PlayerQuestion, World } from '../db'
import { needsAnswer } from '../counts'
import { useDowntime, type DowntimeAction } from './Downtime'
import { useGmQuestions } from './Questions'

/**
 * What's waiting on the GM from the players: questions and downtime to answer, character claims
 * to approve and new characters to read. The world's frame loads it once (useFrame) and every
 * screen reads that copy (the Desk and Inbox badges, the Desk's "Needs you", the Inbox itself and
 * the claim banners), so the number is the same everywhere and answering in one place clears it
 * in all of them. Pass no world to skip loading (the frame does, in the player view).
 */

export interface PendingClaim {
  entityId: string
  userId: string
  /** The player's name. */
  who: string
  createdAt: string
}

export interface GmInbox {
  /** Unanswered questions, oldest first. */
  questions: PlayerQuestion[]
  answered: PlayerQuestion[]
  /** Downtime still to answer, oldest first. */
  downtime: DowntimeAction[]
  answeredDowntime: DowntimeAction[]
  /** Players asking to play a character. */
  claims: PendingClaim[]
  /** New characters players wrote up and sent. */
  requests: CharacterRequest[]
  /** Everyone who has joined (for "nobody invited yet"). */
  members: Member[]
  /** Characters someone plays or has asked for, by page id. */
  claimed: Set<string>
  /** A player's name by their id. */
  nameOf: (userId: string | undefined) => string
  /** Whether anything can arrive at all (cloud sync on and signed in). */
  available: boolean
  /** Whether the first look at the server has come back. */
  loaded: boolean
  error: string
  /** Everything waiting, each thing once: the one number on the Desk and the Inbox. */
  total: number
  reload: () => Promise<void>
}

// Things answered with Undo still on offer: kept off every list until the Undo note goes.
const held = new Set<string>()
const heldListeners = new Set<() => void>()
let heldVersion = 0
const tellHeld = () => {
  heldVersion++
  heldListeners.forEach((l) => l())
}
/** Keeps something off the inbox while its Undo note is up (see afterUndo in src/undo.tsx). */
export function holdBack(id: string, on: boolean) {
  if (on) held.add(id)
  else held.delete(id)
  tellHeld()
}

/** An inbox with nothing in it (outside a world's frame). */
export const EMPTY_INBOX: GmInbox = {
  questions: [],
  answered: [],
  downtime: [],
  answeredDowntime: [],
  claims: [],
  requests: [],
  members: [],
  claimed: new Set(),
  nameOf: () => 'A player',
  available: false,
  loaded: false,
  error: '',
  total: 0,
  reload: async () => {},
}

const byAge = <T extends { createdAt: string }>(list: T[]) => [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt))

export function useGmInbox(world: World | null | undefined): GmInbox {
  // Only the GM's own world has an inbox; a joined world's downtime is the player's own.
  const own = world && !world.shared ? world : undefined
  const { user } = useAuthSession()
  const cloudId = own?.cloud?.enabled && user ? own.id : undefined
  const q = useGmQuestions(own)
  const d = useDowntime(cloudId ? own : undefined)
  const [players, setPlayers] = useState<{ members: Member[]; claims: Claim[]; requests: CharacterRequest[] }>()
  useSyncExternalStore(
    (l) => {
      heldListeners.add(l)
      return () => void heldListeners.delete(l)
    },
    () => heldVersion,
  )

  const loadPlayers = useCallback(async () => {
    if (!cloudId) return
    try {
      const [{ members, claims }, requests] = await Promise.all([
        listPlayers(cloudId),
        // Before the server knew about new characters there are none to list.
        listCharacterRequests(cloudId).catch(() => [] as CharacterRequest[]),
      ])
      setPlayers({ members, claims, requests })
    } catch {
      // Offline: keep what we had.
    }
  }, [cloudId])
  useEffect(() => {
    if (!cloudId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPlayers()
    const t = setInterval(() => !document.hidden && loadPlayers(), 2 * 60_000)
    const onVisible = () => !document.hidden && loadPlayers()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [cloudId, loadPlayers])

  const reloadQuestions = q.reload
  const reloadDowntime = d.reload
  const reload = useCallback(async () => {
    await Promise.all([reloadQuestions(), reloadDowntime(), loadPlayers()])
  }, [reloadQuestions, reloadDowntime, loadPlayers])

  const p = cloudId ? players : undefined
  const members = p?.members ?? []
  const names = new Map(members.map((m) => [m.userId, m.name]))
  const nameOf = (id: string | undefined) => (id && names.get(id)) || 'A player'
  const shown = <T extends { id: string }>(list: T[]) => list.filter((x) => !held.has(x.id))
  const questions = shown(byAge(q.questions))
  const downtime = shown(byAge(d.list))
  const claims = (p?.claims ?? []).filter((c) => !c.approved && !held.has(`claim:${c.entityId}`)).map((c) => ({ entityId: c.entityId, userId: c.userId, who: nameOf(c.userId), createdAt: c.createdAt }))
  const requests = shown(byAge(p?.requests ?? []))
  const waiting = questions.filter(needsAnswer)
  const waitingDowntime = downtime.filter(needsAnswer)
  return {
    questions: waiting,
    answered: questions.filter((x) => !needsAnswer(x)).reverse(),
    downtime: waitingDowntime,
    answeredDowntime: downtime.filter((x) => !needsAnswer(x)).reverse(),
    claims,
    requests,
    members,
    claimed: new Set((p?.claims ?? []).map((c) => c.entityId)),
    nameOf,
    available: q.available,
    loaded: !!p,
    error: q.error || d.error,
    total: waiting.length + waitingDowntime.length + claims.length + requests.length,
    reload,
  }
}
