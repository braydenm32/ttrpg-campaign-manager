import { useCallback, useEffect, useState } from 'react'
import { useAuthSession } from '../cloud/auth'
import { listPlayers } from '../cloud/players'
import type { World } from '../db'

export interface Owner {
  userId: string
  name: string
  notes: string
  mine: boolean
}

/**
 * Who plays which character. In a world you joined as a player this comes with the world;
 * in your own synced world it's fetched from the cloud.
 */
export function useCharacterOwners(world: World | undefined | null) {
  const { user } = useAuthSession()
  const [fetched, setFetched] = useState<Map<string, Owner>>()
  const memberOf = world?.shared?.memberOf
  const gmCloud = !world?.shared && world?.cloud?.enabled && user ? world.id : undefined

  const reload = useCallback(async () => {
    if (!gmCloud) return
    try {
      const { members, claims } = await listPlayers(gmCloud)
      const names = new Map(members.map((m) => [m.userId, m.name]))
      setFetched(new Map(claims.map((c) => [c.entityId, { userId: c.userId, name: names.get(c.userId) ?? 'A player', notes: c.notes, mine: false }])))
    } catch {
      // Offline: no ownership info for now.
    }
  }, [gmCloud])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload()
  }, [reload])

  if (memberOf) {
    const s = world!.shared!
    const names = new Map((s.members ?? []).map((m) => [m.userId, m.name || 'A player']))
    const owners = new Map(
      (s.claims ?? []).map((c) => [c.entityId, { userId: c.userId, name: names.get(c.userId) ?? 'A player', notes: c.notes, mine: c.userId === s.me }]),
    )
    return { owners, memberOf, reload: async () => {} }
  }
  return { owners: fetched ?? new Map<string, Owner>(), memberOf: undefined, reload }
}

