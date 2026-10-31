import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Empty, Skeleton } from '../components'
import { answerQuestion, type CharacterRequest } from '../cloud/players'
import { db, saveEntity, type PlayerQuestion, type World } from '../db'
import { Help } from '../help'
import { useWorld } from '../hooks'
import { AskForm, pageLink, QuestionList } from '../players/Questions'
import { useViewMode } from '../viewMode'
import { DowntimeItem } from '../players/Downtime'
import { ReviewCharacter } from '../players/NewCharacters'
import { approveClaimLater, declineClaimLater, deleteDowntimeLater, deleteQuestionLater } from '../players/inboxActions'
import { useInbox } from '../Sidebar'
import { Ico } from '../icons'
import { ChatCircleDots, EyeClosed, Hourglass, MaskHappy, Question, Tray, UserCirclePlus, UsersThree } from '@phosphor-icons/react'
import { pagePath, worldPath } from '../paths'
import { toast } from '../undo'

/** Questions: the GM's Inbox (everything players sent), or a player's own questions and answers. */
export default function Questions() {
  const { world } = useWorld()
  const { isGM } = useViewMode()
  if (!world) return null
  if (world.shared?.memberOf) return <PlayerQuestions world={world} memberOf={world.shared.memberOf} />
  if (!isGM) return <Empty>Players write to you from their own copy of the world. Switch back to the GM view to read your Inbox.</Empty>
  return <GmInbox world={world} />
}

function PlayerQuestions({ world, memberOf }: { world: World; memberOf: string }) {
  const names = useLiveQuery(async () => new Map((await db.entities.where({ worldId: world.id }).toArray()).map((e) => [e.id, e.name])), [world.id])
  return (
    <div className="page">
      <h1>
        <Ico as={Question} /> Questions for your GM <Help topic="questions" />
      </h1>
      <AskForm memberOf={memberOf} entityId="" placeholder="Ask your GM anything, just between the two of you…" />
      <QuestionList questions={world.shared?.questions ?? []} memberOf={memberOf} pageName={(q) => pageLink(world.id, q.entityId, names?.get(q.entityId))} />
      {!world.shared?.questions?.length && <p className="muted">You can also ask about a particular page from the bottom of that page.</p>}
    </div>
  )
}

/** "Tue 28 Oct, 19:40": when something arrived. */
const arrived = (iso: string) => (iso ? new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '')

const KINDS = {
  question: { label: 'Question', icon: ChatCircleDots },
  downtime: { label: 'Downtime', icon: Hourglass },
  claim: { label: 'Claim', icon: MaskHappy },
  character: { label: 'New character', icon: UserCirclePlus },
}

/** The top line of an inbox item: what it is, who sent it and when. */
function ItemHead({ kind, who, at, extra }: { kind: keyof typeof KINDS; who: string; at: string; extra?: ReactNode }) {
  return (
    <div className="inbox-head">
      <span className="chip inbox-kind">
        <Ico as={KINDS[kind].icon} /> {KINDS[kind].label}
      </span>
      <strong>{who}</strong>
      {extra}
      <span className="muted small inbox-when">{arrived(at)}</span>
    </div>
  )
}

/**
 * The GM's Inbox: everything players sent that waits on you (questions, downtime, claims on a
 * character, new characters), oldest first, each answered right here. It reads the same inbox as
 * the Desk and the badges, so answering one clears it everywhere.
 */
function GmInbox({ world }: { world: World }) {
  const inbox = useInbox()
  const pages = useLiveQuery(() => db.entities.where({ worldId: world.id }).toArray(), [world.id]) ?? []
  const [reading, setReading] = useState<CharacterRequest>()
  const [params] = useSearchParams()
  const focus = params.get('item')
  useEffect(() => {
    if (!focus) return
    const el = document.getElementById(`item-${focus}`)
    el?.scrollIntoView({ block: 'center' })
    el?.querySelector<HTMLElement>('textarea, button')?.focus({ preventScroll: true })
  }, [focus, inbox.loaded])
  if (!inbox.available) return <InboxEmpty world={world} />
  if (!inbox.settled) return <Skeleton />
  const name = (id: string) => pages.find((p) => p.id === id)?.name ?? 'a character'
  const downtimeItem = (d: (typeof inbox.downtime)[number]) => (
    <DowntimeItem
      key={d.id}
      cloudId={world.id}
      d={d}
      who={inbox.nameOf(d.userId)}
      onChange={inbox.reload}
      onDelete={() => deleteDowntimeLater(world.id, d.id, inbox.reload)}
      head={<ItemHead kind="downtime" who={inbox.nameOf(d.userId)} at={d.createdAt} extra={d.character && <span className="muted">as {d.character}</span>} />}
    />
  )
  const items = [
    ...inbox.questions.map((q) => ({ at: q.createdAt, node: <QuestionItem key={q.id} world={world} q={q} who={inbox.nameOf(q.userId)} pages={pages} onChange={inbox.reload} /> })),
    ...inbox.downtime.map((d) => ({ at: d.createdAt, node: downtimeItem(d) })),
    ...inbox.claims.map((c) => ({
      at: c.createdAt,
      node: (
        <div key={c.entityId} className="card question inbox-item" data-kind="claim" id={`item-${c.entityId}`}>
          <ItemHead kind="claim" who={c.who} at={c.createdAt} />
          <p>
            Asked to play <Link to={pagePath(world.id, c.entityId)}>{name(c.entityId)}</Link>. Approving lets them edit that character’s sheet and read the passages written for them.
          </p>
          <div className="row wrap">
            <button className="primary" onClick={() => approveClaimLater(world.id, c, name(c.entityId), inbox.reload)}>
              ✓ Approve
            </button>
            <button onClick={() => declineClaimLater(world.id, c, name(c.entityId), inbox.reload)}>Decline</button>
          </div>
        </div>
      ),
    })),
    ...inbox.requests.map((r) => ({
      at: r.createdAt,
      node: (
        <div key={r.id} className="card question inbox-item" data-kind="character" id={`item-${r.id}`}>
          <ItemHead kind="character" who={inbox.nameOf(r.userId)} at={r.createdAt} />
          <p>
            <b>{r.sheet.name}</b>
            {r.sheet.summary && <span className="muted"> · {r.sheet.summary}</span>}
          </p>
          <div className="row wrap">
            <button className="primary" onClick={() => setReading(r)}>
              Read it
            </button>
          </div>
        </div>
      ),
    })),
  ].sort((a, b) => (a.at || '0').localeCompare(b.at || '0'))
  const answered = [
    ...inbox.answered.map((q) => ({ at: q.answeredAt ?? q.createdAt, node: <QuestionItem key={q.id} world={world} q={q} who={inbox.nameOf(q.userId)} pages={pages} onChange={inbox.reload} /> })),
    ...inbox.answeredDowntime.map((d) => ({ at: d.answeredAt ?? d.createdAt, node: downtimeItem(d) })),
  ].sort((a, b) => b.at.localeCompare(a.at))
  return (
    <div className="page inbox-page">
      <header className="page-header">
        <h1>
          <Ico as={Tray} /> Inbox <Help topic="inbox" />
        </h1>
        <button onClick={() => inbox.reload()}>↻ Refresh</button>
      </header>
      {inbox.error && <p className="error">{inbox.error}</p>}
      {items.length > 0 ? (
        <>
          <p className="muted inbox-lead" data-inbox-count={items.length}>
            {items.length} waiting for you, oldest first. Answer each one right here.
          </p>
          <div className="inbox-list">{items.map((i) => i.node)}</div>
        </>
      ) : (
        <div className="inbox-empty card" data-inbox-count={0}>
          <Ico as={Tray} size="2em" />
          <p>
            <b>Nothing waiting.</b> When a player asks you something, says what they do between sessions, asks to play a character or sends one they wrote up, it
            arrives here.
          </p>
        </div>
      )}
      {answered.length > 0 && (
        <details className="inbox-answered">
          <summary>Answered ({answered.length})</summary>
          {answered.map((a) => a.node)}
        </details>
      )}
      {reading && <ReviewCharacter world={world} request={reading} player={inbox.nameOf(reading.userId)} onClose={() => setReading(undefined)} onDone={inbox.reload} />}
    </div>
  )
}

/** Before any player can write in: what arrives here, and what it takes. */
function InboxEmpty({ world }: { world: World }) {
  const cloud = !!world.cloud?.enabled
  return (
    <div className="page inbox-page">
      <h1>
        <Ico as={Tray} /> Inbox <Help topic="inbox" />
      </h1>
      <div className="inbox-empty card" data-inbox-count={0}>
        <Ico as={Tray} size="2em" />
        <p>
          <b>Your players write to you here.</b> Questions about a page or anything at all, what their characters do between sessions, asking to play a
          character, and new characters they wrote up. Each one is answered right here, oldest first.
        </p>
        <p className="muted">
          {cloud ? 'Sign in on this device to see what your players have sent.' : 'It needs your players invited: turn on cloud sync for this world, then send them an invite link.'}
        </p>
        <Link className="button primary" to={`${worldPath(world.id)}/settings?tab=players`}>
          <Ico as={UsersThree} /> Players and sharing
        </Link>
      </div>
    </div>
  )
}

function QuestionItem({
  world,
  q,
  who,
  pages,
  onChange,
}: {
  world: World
  q: PlayerQuestion
  who: string
  pages: { id: string; name: string; visibility: string; revealedTo?: string[] }[]
  onChange: () => Promise<unknown>
}) {
  const [answer, setAnswer] = useState(q.answer ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const page = pages.find((p) => p.id === q.entityId)
  const hidden = page && page.visibility === 'gm' && !page.revealedTo?.includes(q.userId ?? '')
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setError('')
    try {
      await fn()
      await onChange()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="card question inbox-item" data-kind="question" id={`item-${q.id}`}>
      <ItemHead kind="question" who={who} at={q.createdAt} />
      {pageLink(world.id, q.entityId, page?.name)}
      <p>{q.body}</p>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          act(() => answerQuestion(world.id, q.id, answer))
        }}
      >
        <textarea rows={2} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={`Your answer, seen only by ${who}`} aria-label={`Answer ${who}`} />
        <div className="row wrap">
          <button className="primary" disabled={busy || answer.trim() === (q.answer ?? '')}>
            {q.answer ? 'Update answer' : 'Send answer'}
          </button>
          {hidden && q.userId && (
            <button
              type="button"
              disabled={busy}
              title="Let just this player see the page"
              onClick={() =>
                act(async () => {
                  const e = await db.entities.get(page.id)
                  if (!e) return
                  await saveEntity({ ...e, revealedTo: [...new Set([...(e.revealedTo ?? []), q.userId!])], updatedAt: Date.now() })
                  toast(`${page.name} revealed to ${who}.`, async () => {
                    const now = await db.entities.get(page.id)
                    if (now) await saveEntity({ ...now, revealedTo: e.revealedTo, updatedAt: Date.now() })
                  })
                })
              }
            >
              <Ico as={EyeClosed} /> Reveal this page to {who}
            </button>
          )}
          <button type="button" className="ghost danger" disabled={busy} onClick={() => deleteQuestionLater(world.id, q.id, onChange)}>
            Delete
          </button>
        </div>
        {error && <p className="error small">{error}</p>}
      </form>
    </div>
  )
}
