import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Empty } from '../components'
import { answerQuestion, deleteQuestion, listPlayers, type Member } from '../cloud/players'
import { db, saveEntity, type PlayerQuestion, type World } from '../db'
import { Help } from '../help'
import { useWorld } from '../hooks'
import { AskForm, pageLink, QuestionList, useGmQuestions } from '../players/Questions'
import { useViewMode } from '../viewMode'
import { Ico } from '../icons'
import { EyeClosed, Question } from '@phosphor-icons/react'

/** Questions: the GM's inbox of players' questions, or a player's own questions and answers. */
export default function Questions() {
  const { world } = useWorld()
  const { isGM } = useViewMode()
  if (!world) return null
  if (world.shared?.memberOf) return <PlayerQuestions world={world} memberOf={world.shared.memberOf} />
  if (!isGM) return <Empty>Players ask you questions from their own copy of the world. Switch back to the GM view to read them.</Empty>
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

function GmInbox({ world }: { world: World }) {
  const { questions, reload, error, available } = useGmQuestions(world)
  const [members, setMembers] = useState<Member[]>([])
  const pages = useLiveQuery(() => db.entities.where({ worldId: world.id }).toArray(), [world.id]) ?? []
  useEffect(() => {
    if (available) listPlayers(world.id).then((r) => setMembers(r.members)).catch(() => {})
  }, [available, world.id])
  if (!available) return <Empty>Turn on cloud sync and invite your players (World settings) so they can send you questions.</Empty>
  const open = questions.filter((q) => !q.answer)
  const done = questions.filter((q) => q.answer)
  const card = (q: PlayerQuestion) => (
    <InboxItem key={q.id} world={world} q={q} who={members.find((m) => m.userId === q.userId)?.name ?? 'A player'} pages={pages} onChange={reload} />
  )
  return (
    <div className="page">
      <header className="page-header">
        <h1>
          <Ico as={Question} /> Players’ questions <Help topic="questionsGm" />
        </h1>
        <button onClick={reload}>↻ Refresh</button>
      </header>
      {error && <p className="error">{error}</p>}
      {questions.length === 0 && <Empty>No questions yet. Players can ask you about any page they can see, or anything at all.</Empty>}
      {open.length > 0 && <h2>Waiting for you ({open.length})</h2>}
      {open.map(card)}
      {done.length > 0 && (
        <details>
          <summary>Answered ({done.length})</summary>
          {done.map(card)}
        </details>
      )}
    </div>
  )
}

function InboxItem({ world, q, who, pages, onChange }: { world: World; q: PlayerQuestion; who: string; pages: { id: string; name: string; visibility: string; revealedTo?: string[] }[]; onChange: () => void }) {
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
      onChange()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="card question">
      <div className="row spread">
        <strong>{who}</strong>
        <span className="muted small">{new Date(q.createdAt).toLocaleString()}</span>
      </div>
      {pageLink(world.id, q.entityId, page?.name)}
      <p>{q.body}</p>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          act(() => answerQuestion(world.id, q.id, answer))
        }}
      >
        <textarea rows={2} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={`Your answer, seen only by ${who}`} />
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
                  if (e) await saveEntity({ ...e, revealedTo: [...new Set([...(e.revealedTo ?? []), q.userId!])], updatedAt: Date.now() })
                })
              }
            >
              <Ico as={EyeClosed} /> Reveal this page to {who}
            </button>
          )}
          <button type="button" className="ghost danger" disabled={busy} onClick={() => confirm('Delete this question?') && act(() => deleteQuestion(world.id, q.id))}>
            Delete
          </button>
        </div>
        {error && <p className="error small">{error}</p>}
      </form>
    </div>
  )
}
