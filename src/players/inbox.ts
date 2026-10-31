import type { Entity, World } from '../db'
import { needsAnswer, openThreads } from '../counts'
import { useDowntime } from './Downtime'
import { useCharacterOwners } from './owners'
import { useGmQuestions } from './Questions'

/**
 * What's waiting on the GM: players' questions and downtime to answer, character claims to approve,
 * and pressing loose threads. The Desk and Inbox badges and Home's "Needs you" all pick from this, so
 * a claim is never counted twice and the totals can't drift. Pass no world to skip loading (the
 * frame does, in the player view).
 */
export function useGmInbox(world: World | null | undefined, entities: Entity[]) {
  // Only the GM's own world has an inbox; a joined world's downtime is the player's own.
  const own = world && !world.shared ? world : undefined
  const synced = own?.cloud?.enabled ? own : undefined
  const questions = useGmQuestions(own)
  const downtime = useDowntime(synced).list.filter(needsAnswer).length
  const { owners } = useCharacterOwners(synced)
  const claims = [...owners.values()].filter((o) => o.pending).length
  const waiting = questions.questions.filter(needsAnswer)
  const urgentThreads = own ? openThreads(entities).filter((t) => t.threadUrgency === 'high') : []
  return {
    /** Unanswered questions, oldest first as they came. */
    questions: waiting,
    downtime,
    claims,
    urgentThreads,
    /** Whether questions can arrive at all (cloud sync on and signed in). */
    available: questions.available,
    /** Everything waiting, each thing once. */
    total: waiting.length + downtime + claims + urgentThreads.length,
  }
}
