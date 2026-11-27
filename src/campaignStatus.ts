import { db, type Campaign } from './db'
import { toast } from './undo'

/**
 * A campaign's status, and what each one does (the rule itself is isRunning in src/threads.ts):
 * Planning and Active are both run from the Desk; Paused and Finished are off it until changed back.
 */
export const STATUS_WORDS: Record<Campaign['status'], string> = {
  planning: 'Not played yet. It becomes Active by itself when you start its first session.',
  active: 'Being played. Its next session is on the Desk, and comes first when two campaigns tie.',
  paused: 'Off the Desk, the Session area and players’ “next session” until you carry on.',
  finished: 'Done. Off the Desk and the Session area; its sessions and recaps stay.',
}

/** Changes a campaign's status, saying what that does, with Undo. */
export async function setCampaignStatus(c: Pick<Campaign, 'id' | 'name' | 'status'>, status: Campaign['status']) {
  const was = c.status
  if (was === status) return
  await db.campaigns.update(c.id, { status })
  const say =
    status === 'paused'
      ? `“${c.name}” is paused: it’s off the Desk until you carry on.`
      : status === 'finished'
        ? `“${c.name}” is finished: it’s off the Desk.`
        : was === 'paused' || was === 'finished'
          ? `“${c.name}” is back on the Desk.`
          : `“${c.name}” is ${status === 'active' ? 'Active' : 'in Planning'}.`
  toast(say, () => db.campaigns.update(c.id, { status: was }))
}

