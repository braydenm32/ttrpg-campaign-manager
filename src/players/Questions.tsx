import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuthSession } from '../cloud/auth'
import { askQuestion, listQuestions, withdrawQuestion } from '../cloud/players'
import type { PlayerQuestion, World } from '../db'
import { Help } from '../help'
import { Ico } from '../icons'
import { Question } from '@phosphor-icons/react'
import { pagePath } from '../paths'

/**
 * Players' questions to the GM. A player asks about a page (or anything, from the Questions page);
 * only the GM sees it, and only that player sees the answer.
 */

/** For players, under a page: ask the GM about it, and read the answers to what you asked. */
export function AskGmBox({ world, entityId }: { world: World; entityId: string }) {
  const memberOf = world.shared?.memberOf
  if (!memberOf) return null
  const mine = (world.shared?.questions ?? []).filter((q) => q.entityId === entityId)
  return (
    <section className="ask-gm">
      <h2>
        <Ico as={Question} /> Ask your GM <Help topic="questions" />
      </h2>
      <QuestionList questions={mine} memberOf={memberOf} />
      <AskForm memberOf={memberOf} entityId={entityId} placeholder="Something you want to know about this, just between you and your GM…" />
    </section>
  )
}

export function AskForm({ memberOf, entityId, placeholder }: { memberOf: string; entityId: string; placeholder: string }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <form
      className="form"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!text.trim()) return
        setBusy(true)
        setError('')
        try {
          await askQuestion(memberOf, entityId, text.trim())
          setText('')
        } catch (err) {
          setError((err as Error).message)
        } finally {
          setBusy(false)
        }
      }}
    >
      <textarea rows={2} value={text} maxLength={4000} onChange={(e) => setText(e.target.value)} placeholder={placeholder} />
      <div className="row end">
        <span className="muted small">Only your GM sees this.</span>
        <button className="primary" disabled={busy || !text.trim()}>
          {busy ? 'Sending…' : 'Ask'}
        </button>
      </div>
      {error && <p className="error small">{error}</p>}
    </form>
  )
}

export function QuestionList({ questions, memberOf, pageName }: { questions: PlayerQuestion[]; memberOf: string; pageName?: (q: PlayerQuestion) => ReactNode }) {
  if (!questions.length) return null
  return (
    <ul className="questions">
      {[...questions]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((q) => (
          <li key={q.id} className="question card">
            {pageName?.(q)}
            <div>
              <b>You asked:</b> {q.body}
            </div>
            {q.answer ? (
              <div className="answer">
                <b>Your GM:</b> {q.answer}
              </div>
            ) : (
              <div className="muted small row spread">
                Waiting for an answer.
                <button className="link small" onClick={() => confirm('Take this question back?') && withdrawQuestion(memberOf, q.id)}>
                  Take it back
                </button>
              </div>
            )}
          </li>
        ))}
    </ul>
  )
}

/** For the GM: the players' questions in their synced world, refreshed every few minutes while open. */
export function useGmQuestions(world: World | null | undefined) {
  const { user } = useAuthSession()
  const cloudId = world && !world.shared && world.cloud?.enabled && user ? world.id : undefined
  const [questions, setQuestions] = useState<PlayerQuestion[]>()
  const [error, setError] = useState('')
  const reload = useCallback(async () => {
    if (!cloudId) return
    try {
      setQuestions(await listQuestions(cloudId))
      setError('')
    } catch (e) {
      setError((e as Error).message)
    }
  }, [cloudId])
  useEffect(() => {
    if (!cloudId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload()
    const t = setInterval(() => !document.hidden && reload(), 2 * 60_000)
    const onVisible = () => !document.hidden && reload()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [cloudId, reload])
  return { questions: cloudId ? (questions ?? []) : [], reload, error, available: !!cloudId }
}

export const pageLink = (worldId: string, entityId: string, name: string | undefined) =>
  entityId ? (
    <div className="small muted">
      About <Link to={`${pagePath(worldId, entityId)}`}>{name ?? 'a page'}</Link>
    </div>
  ) : (
    <div className="small muted">General question</div>
  )
