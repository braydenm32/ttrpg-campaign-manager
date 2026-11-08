import { useState } from 'react'
import { cloudErrorMessage } from '../cloud/client'
import { nameNow, nameProblem, renameMe, UNNAMED } from '../cloud/players'
import type { World } from '../db'
import { Help } from '../help'

/**
 * A "Rename" button that turns into a name box with Save and Cancel. `onSave` does the saving and
 * throws to show an error; `whose` words the hints for yourself or for someone else. `taken` is
 * everyone else's name in the world (two people can't share one), and `player` is set for a player
 * naming themselves (who can't take a name that reads as the GM's).
 */
export function RenameButton({
  current,
  onSave,
  whose = 'their',
  label = 'Rename',
  taken = [],
  player = false,
}: {
  current: string
  onSave: (name: string) => Promise<unknown>
  whose?: 'your' | 'their'
  label?: string
  taken?: string[]
  player?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const problem = nameProblem(name, whose, { taken, player })

  if (!editing)
    return (
      <button
        type="button"
        className="ghost small"
        onClick={() => {
          // A pasted link (or a name with hidden characters) starts empty rather than making them delete it.
          setName(nameProblem(current) || current === UNNAMED ? '' : current)
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
  const others = (shared.members ?? []).filter((m) => m.userId !== shared.me).map((m) => m.name)
  const wrong = nameNow(name, others)
  return (
    <section className="card room-card">
      <h2 className="room-card-title">
        Your name at this table <Help topic="myName" />
      </h2>
      <div className="row wrap member-actions">
        <span>
          Everyone here sees you as <strong className="member-name">{name || 'Unnamed player'}</strong>.
        </span>
        <RenameButton current={name} whose="your" label="Change my name" taken={others} player onSave={(n) => renameMe(shared.memberOf!, shared.me!, n)} />
      </div>
      {wrong === 'link' && <p className="notice small">That’s the invite link, not a name. Change it so the table knows who you are.</p>}
      {wrong === 'hidden' && <p className="notice small">Your name has hidden characters in it. Change it so everyone sees the name you meant.</p>}
      {wrong === 'taken' && <p className="notice small">Someone else here has this name too. Change yours a little so the table can tell you apart.</p>}
    </section>
  )
}
