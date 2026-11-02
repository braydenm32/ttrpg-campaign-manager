import type { Entity } from './db'

/** Whether a page's "reveal on" date has come (see timedReveal.tsx). */
export const revealDue = (e: Pick<Entity, 'revealAt'>, now = Date.now()) => typeof e.revealAt === 'number' && e.revealAt <= now
