import { db, type Campaign } from './db'
import { isPlayed } from './sessions'
import { toast } from './undo'

/**
 * A campaign's status, and what each one does (the rule itself is isRunning in src/threads.ts):
 * Planning and Active are both run from the Desk; Paused and Finished are off it until changed back
 * (a session of theirs that is still being played stays there until it's wrapped up).
 */
export const STATUS_WORDS: Record<Campaign['status'], string> = {
  planning: 'Not played yet. It becomes Active by itself when you start or play its first session.',
  active: 'Being played. Its next session is on the Desk, and comes first when two campaigns are level.',
  paused: 'Off the Desk, the Session area and players’ “next session” until you carry on.',
  finished: 'Done. Off the Desk and the Session area until you put it back; its sessions and recaps stay.',
}

/** Changes a campaign's status, saying what that does, with Undo. */
export async function setCampaignStatus(c: Pick<Campaign, 'id' | 'name' | 'status'>, status: Campaign['status']) {
  const was = c.status
  if (was === status) return
  await db.campaigns.update(c.id, { status })
  const off = status === 'paused' || status === 'finished'
  // A session that was started and never marked played keeps the campaign on the Desk until it's wrapped up.
  const open = off ? (await db.sessions.where({ campaignId: c.id }).toArray()).find((s) => !!s.startedAt && !isPlayed(s)) : undefined
  const word = status === 'paused' ? 'paused' : 'finished'
  const say = off
    ? open
      ? `“${c.name}” is ${word}. #${open.number} ${open.title} is still being played, so it stays on the Desk until you wrap it up.`
      : `“${c.name}” is ${word}: it’s off the Desk${status === 'paused' ? ' until you carry on' : ''}.`
    : was === 'paused' || was === 'finished'
      ? `“${c.name}” is back on the Desk.`
      : `“${c.name}” is ${status === 'active' ? 'Active' : 'in Planning'}.`
  toast(say, () => db.campaigns.update(c.id, { status: was }))
}
