import { useState } from 'react'
import { cloudErrorMessage } from '../cloud/client'
import { nameProblem, renameMe } from '../cloud/players'
import type { World } from '../db'
import { Help } from '../help'

/**
 * A "Rename" button that turns into a name box with Save and Cancel. `onSave` does the saving and
 * throws to show an error; `whose` words the hints for yourself or for someone else.
 */
export function RenameButton({ current, onSave, whose = 'their', label = 'Rename' }: { current: string; onSave: (name: string) => Promise<unknown>; whose?: 'your' | 'their'; label?: string }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const problem = nameProblem(name, whose)

  if (!editing)
    return (
      <button
        type="button"
        className="ghost small"
        onClick={() => {
          // A pasted link starts empty rather than making them delete it.
          setName(nameProblem(current) ? '' : current)
          setError('')
          setEditing(true)
        }}
      >
        {label}
      </button>
    )

  return (
    <form
      className="rename-form"
      onSubmit={async (e) => {
        e.preventDefault()
        if (problem) return setError(problem)
        setBusy(true)
        setError('')
        try {
          await onSave(name.trim())
          setEditing(false)
        } catch (err) {
          setError(cloudErrorMessage(err))
        } finally {
          setBusy(false)
        }
      }}
    >
      <input
        autoFocus
        aria-label={whose === 'your' ? 'Your name' : 'New name'}
        value={name}
        maxLength={60}
        placeholder="e.g. Sam"
        onChange={(e) => {
          setName(e.target.value)
          setError('')
        }}
        onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
      />
      <button className="primary small" disabled={busy || !name.trim()}>
        {busy ? 'Saving…' : 'Save'}
      </button>
      <button type="button" className="ghost small" disabled={busy} onClick={() => setEditing(false)}>
        Cancel
      </button>
      {error && (
        <p className="error small" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}

/** For a player in a joined world: the name everyone else sees them by, and a way to change it. */
export function MyTableName({ world }: { world: World }) {
  const shared = world.shared
  if (!shared?.memberOf || !shared.me) return null
  const me = shared.members?.find((m) => m.userId === shared.me)
  const name = me?.name ?? ''
  const wrong = !!nameProblem(name)
  return (
    <section className="card room-card">
      <h2 className="room-card-title">
        Your name at this table <Help topic="myName" />
      </h2>
      <div className="row wrap member-actions">
        <span>
          Everyone here sees you as <strong className="member-name">{name || 'Unnamed player'}</strong>.
        </span>
        <RenameButton current={name} whose="your" label="Change my name" onSave={(n) => renameMe(shared.memberOf!, shared.me!, n)} />
      </div>
      {wrong && name && <p className="notice small">That’s the invite link, not a name. Change it so the table knows who you are.</p>}
    </section>
  )
}
