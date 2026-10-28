import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Help } from '../help'
import { useAuthSession } from '../cloud/auth'
import { listGroupNotes, replyInGroupNotes, savePlayerNote, type NoteClash } from '../cloud/players'
import { cloudErrorMessage } from '../cloud/client'
import type { Entity, PlayerNote, World } from '../db'
import { Markdown } from '../Markdown'
import { Ico } from '../icons'
import { Notepad } from '@phosphor-icons/react'

/**
 * Players' own notes on a page (or, with entityId '', the world's scratchpad).
 * Players get "My notes" (only them) and "Group notes" (every player, and the GM can read them).
 * The GM sees the group's notes read-only.
 */
export function PlayerNotesBox({
  world,
  entityId,
  entities,
  big,
}: {
  world: World
  entityId: string
  entities: Entity[]
  big?: boolean
}) {
  const memberOf = world.shared?.memberOf
  if (memberOf) return <MemberNotes world={world} memberOf={memberOf} entityId={entityId} big={big} />
  if (!world.shared && world.cloud?.enabled) return <GmGroupNotes world={world} entityId={entityId} entities={entities} big={big} />
  return null
}

function MemberNotes({ world, memberOf, entityId, big }: { world: World; memberOf: string; entityId: string; big?: boolean }) {
  const [tab, setTab] = useState<'mine' | 'group'>('mine')
  const notes = world.shared?.notes ?? []
  const find = (shared: boolean) => notes.find((n) => n.entityId === entityId && n.shared === shared)
  const names = new Map((world.shared?.members ?? []).map((m) => [m.userId, m.name || 'A player']))
  const group = find(true)

  return (
    <section className={`player-notes ${big ? 'scratchpad' : ''}`}>
      {!big && (
        <h2>
          <Ico as={Notepad} /> Notes <Help topic="playerNotes" />
        </h2>
      )}
      <div className="tabs segmented">
        <button className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>
          My notes
        </button>
        <button className={tab === 'group' ? 'on' : ''} onClick={() => setTab('group')}>
          Group notes{group?.body ? ' •' : ''}
        </button>
      </div>
      {tab === 'mine' ? (
        <NoteEditor
          key={`${entityId}:mine`}
          saved={find(false)?.body ?? ''}
          hint="Only you can see these."
          placeholder={big ? 'Anything you want to remember…' : 'What you know, suspect or want to ask about this…'}
          onSave={(body) => savePlayerNote(memberOf, entityId, false, body)}
          nameOf={() => ''}
        />
      ) : (
        <NoteEditor
          key={`${entityId}:group`}
          saved={group?.body ?? ''}
          savedAt={group?.updatedAt}
          nameOf={(id) => (id === world.shared?.me ? 'You' : (names.get(id) ?? 'Another player'))}
          hint={
            <>
              Every player can read and edit these, and your GM can read them.
              {group?.updatedBy && ` Last edited by ${group.updatedBy === world.shared?.me ? 'you' : (names.get(group.updatedBy) ?? 'a player')}.`}
            </>
          }
          placeholder={big ? 'The party’s shared notes: names, clues, plans, who owes whom…' : 'Shared with the whole party…'}
          onSave={(body, expected) => savePlayerNote(memberOf, entityId, true, body, expected)}
        />
      )}
    </section>
  )
}

/** A player's own note (on a page, or '' for their scratchpad), as a small box. */
export function MyNote({ world, entityId, placeholder }: { world: World; entityId: string; placeholder: string }) {
  const memberOf = world.shared?.memberOf
  if (!memberOf) return null
  const saved = world.shared?.notes?.find((n) => n.entityId === entityId && !n.shared)?.body ?? ''
  return (
    <NoteEditor
      key={`${entityId}:mine`}
      rows={3}
      saved={saved}
      hint="Only you can see this."
      placeholder={placeholder}
      onSave={(body) => savePlayerNote(memberOf, entityId, false, body)}
      nameOf={() => ''}
    />
  )
}

/**
 * Adds a line to the party's shared scratchpad, signed with who wrote it. If someone else saved in
 * the meantime the line goes on the end of their version, so nothing is lost.
 */
export async function addToPartyNotes(world: World, who: string, line: string) {
  const memberOf = world.shared!.memberOf!
  const note = world.shared?.notes?.find((n) => n.entityId === '' && n.shared)
  const add = (body = '') => `${body.trimEnd()}${body.trim() ? '\n' : ''}- **${who}:** ${line}`
  const clash = await savePlayerNote(memberOf, '', true, add(note?.body), note?.updatedAt ?? null)
  if (clash) await savePlayerNote(memberOf, '', true, add(clash.body), null)
}

/**
 * A notes box that keeps what you're typing even if a refresh brings in a newer copy, and shows the
 * newest saved text whenever you aren't mid-edit. For group notes, if someone else saved while you
 * were typing, nothing is overwritten: you choose to keep both, use yours or use theirs.
 */
function NoteEditor({
  saved,
  savedAt,
  hint,
  placeholder,
  onSave,
  nameOf,
  rows = 6,
}: {
  rows?: number
  saved: string
  savedAt?: string
  hint: ReactNode
  placeholder: string
  onSave: (body: string, expected: string | null) => Promise<NoteClash | null>
  nameOf: (userId: string) => string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  // When the note you started from was saved, so a newer save by someone else is caught.
  const [base, setBase] = useState<string | null>(null)
  const [clash, setClash] = useState<NoteClash | null>(null)
  const [state, setState] = useState<'' | 'saving' | 'saved' | 'error'>('')
  const text = draft ?? saved
  const save = async (body = draft, expected: string | null = base ?? savedAt ?? null) => {
    if (body === null || (body === saved && !clash)) {
      setDraft(null)
      return
    }
    setState('saving')
    try {
      const theirs = await onSave(body, expected)
      if (theirs) {
        setClash(theirs)
        setState('')
        return
      }
      setDraft(null)
      setBase(null)
      setClash(null)
      setState('saved')
    } catch {
      setState('error')
    }
  }
  return (
    <>
      <textarea
        rows={rows}
        value={text}
        onChange={(e) => {
          if (draft === null) setBase(savedAt ?? null)
          setDraft(e.target.value)
          setState('')
        }}
        onBlur={() => !clash && save()}
        placeholder={placeholder}
        maxLength={50000}
      />
      {clash && draft !== null && (
        <div className="note-clash" role="alert">
          <p>
            <strong>{nameOf(clash.updatedBy)} changed these notes while you were typing.</strong> Nothing has been overwritten yet. Their version:
          </p>
          <pre className="note-clash-theirs">{clash.body}</pre>
          <div className="row wrap">
            <button className="primary" onClick={() => save(`${clash.body.trimEnd()}\n\n${draft.trim()}`, null)}>
              Keep both
            </button>
            <button onClick={() => save(draft, null)}>Use mine</button>
            <button
              onClick={() => {
                setDraft(null)
                setBase(null)
                setClash(null)
              }}
            >
              Use theirs
            </button>
          </div>
        </div>
      )}
      <span className="note-meta">
        {state === 'saving' ? 'Saving…' : state === 'saved' ? '✓ Saved. ' : state === 'error' ? 'Couldn’t save. Check your connection and click away to try again. ' : ''}
        {state !== 'saving' && hint}
        {state === '' && !clash && ' Saves when you click away.'}
      </span>
    </>
  )
}

/** The GM's read-only look at what the party has written together. */
function GmGroupNotes({ world, entityId, entities, big }: { world: World; entityId: string; entities: Entity[]; big?: boolean }) {
  const { user } = useAuthSession()
  const [notes, setNotes] = useState<PlayerNote[] | null>(null)
  const load = useCallback(async () => {
    if (!user) return
    try {
      setNotes(await listGroupNotes(world.id))
    } catch {
      // Offline: nothing to show for now.
    }
  }, [user, world.id])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const note = notes?.find((n) => n.entityId === entityId)
  if (!big && !note?.body) return null
  return (
    <section className="player-notes">
      {!big && (
        <h2>
          <Ico as={Notepad} /> Your players’ notes <Help topic="gmPlayerNotes" />
        </h2>
      )}
      <span className="note-meta">
        What your players have written here together. Only they can edit it, and their private notes stay private.{' '}
        <button className="link" onClick={load}>
          Refresh
        </button>
      </span>
      {note?.body ? (
        <div className="side-box">
          <NotesText text={note.body} entities={entities} worldId={world.id} />
        </div>
      ) : (
        <p className="muted">{notes ? 'Nothing yet.' : user ? 'Loading…' : 'Sign in to see your players’ notes.'}</p>
      )}
      {user && notes && <GmReply worldId={world.id} entityId={entityId} onSent={load} />}
    </section>
  )
}

/** The GM adds a line to the party's notes, signed "GM". */
function GmReply({ worldId, entityId, onSent }: { worldId: string; entityId: string; onSent: () => void }) {
  const [line, setLine] = useState('')
  const [state, setState] = useState('')
  return (
    <form
      className="row gm-reply"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!line.trim()) return
        setState('Sending…')
        try {
          await replyInGroupNotes(worldId, entityId, line.trim())
          setLine('')
          setState('')
          onSent()
        } catch (err) {
          setState(cloudErrorMessage(err))
        }
      }}
    >
      <input value={line} onChange={(e) => setLine(e.target.value)} placeholder="Reply in their notes (signed GM)" aria-label="Reply in the party’s notes" maxLength={2000} />
      <button disabled={!line.trim()}>Reply</button>
      <Help topic="gmReply" />
      {state && <span className="small muted">{state}</span>}
    </form>
  )
}

/** The party's notes, with the GM's replies set apart. */
export function NotesText({ text, entities, worldId }: { text: string; entities: Entity[]; worldId: string }) {
  // Runs of ordinary lines render together (so lists and paragraphs hold); each GM line stands out.
  const parts: { gm: boolean; text: string }[] = []
  for (const line of text.split('\n')) {
    const gm = GM_LINE.test(line)
    const last = parts[parts.length - 1]
    if (!gm && last && !last.gm) last.text += '\n' + line
    else parts.push({ gm, text: gm ? line.replace(GM_LINE, '') : line })
  }
  return (
    <>
      {parts.map((p, i) =>
        p.gm ? (
          <div key={i} className="gm-line">
            <b>GM:</b> <Markdown text={p.text} entities={entities} worldId={worldId} showSecrets={false} />
          </div>
        ) : (
          <Markdown key={i} text={p.text} entities={entities} worldId={worldId} showSecrets={false} />
        ),
      )}
    </>
  )
}
const GM_LINE = /^\s*[-*]\s+\*\*GM:\*\*\s*/
