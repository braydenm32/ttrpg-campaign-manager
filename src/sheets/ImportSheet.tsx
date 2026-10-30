import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { FileArrowUp, LinkSimple, TextAa } from '@phosphor-icons/react'
import { ClaudeJob } from '../ai/ClaudeJob'
import { Modal } from '../components'
import { db, type Entity } from '../db'
import { Help } from '../help'
import { Ico } from '../icons'
import { pagePath } from '../paths'
import { applySheet } from './apply'
import { sheetFromReply, sheetRequest } from './claude'
import { ddbDataUrl, parseSheetJson, pathbuilderDataUrl, type Sheet } from './parse'

/**
 * "Import character sheet": a file (Foundry VTT, D&D Beyond, Pathbuilder or a fillable PDF), a share
 * link (D&D Beyond, Pathbuilder) or a sheet's text for Claude to sort. Shows what it found before
 * anything changes. The GM makes a new character or updates one; a player gets it in their own editor.
 */
export function ImportSheet({
  worldId,
  system,
  into,
  onSheet,
  onClose,
}: {
  worldId: string
  /** The world's game, to help Claude read pasted text. */
  system: string
  /** The character to update (from its page, or the player's own). */
  into?: Entity
  /** Players: hand the sheet to their editor instead of saving it here. */
  onSheet?: (sheet: Sheet) => void
  onClose: () => void
}) {
  const [sheet, setSheet] = useState<Sheet>()
  const [link, setLink] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [blocked, setBlocked] = useState('')

  const attempt = async (what: string, fn: () => Promise<Sheet> | Sheet) => {
    setBusy(what)
    setError('')
    setBlocked('')
    try {
      setSheet(await fn())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy('')
    }
  }

  const readFile = (f: File) =>
    attempt('Reading the sheet…', async () => {
      if (/\.pdf$/i.test(f.name) || f.type === 'application/pdf') return (await import('./pdf')).readPdfSheet(f, f.name)
      return parseSheetJson(await f.text())
    })

  const readLink = () => {
    const url = ddbDataUrl(link) || pathbuilderDataUrl(link)
    if (!url) return setError('That isn’t a D&D Beyond or Pathbuilder link. For Foundry, Roll20 and others, use a file or paste the sheet’s text.')
    attempt('Fetching the character…', async () => {
      let res: Response
      try {
        res = await fetch(url)
      } catch {
        // The other site doesn't let web apps read it directly; the saved file works just the same.
        setBlocked(url)
        throw new Error('')
      }
      if (res.status === 403 || res.status === 404)
        throw new Error('That character is private or doesn’t exist. Make it public in its sharing settings, then try again.')
      if (!res.ok) throw new Error(`The other site answered “${res.status}”. Try again in a minute, or save the file and pick it instead.`)
      return parseSheetJson(await res.text())
    })
  }

  return (
    <Modal title={into ? `Import a sheet for ${into.name}` : 'Import a character sheet'} onClose={onClose}>
      {!sheet ? (
        <div className="form sheet-import">
          <p className="muted small">
            <Help topic="importSheet" /> Nothing changes until you’ve looked over what was found.
          </p>

          <div className="sheet-way">
            <h3>
              <Ico as={FileArrowUp} /> A file
            </h3>
            <label className="button">
              Pick a file
              <input
                type="file"
                hidden
                accept=".json,.pdf,.txt,.htm,.html,application/json,application/pdf"
                onChange={(e) => (e.target.files?.[0] && readFile(e.target.files[0]), (e.target.value = ''))}
              />
            </label>
            <ul className="muted small">
              <li>
                <strong>Foundry VTT</strong> (any game): right-click the character in the Actors list, Export Data.
              </li>
              <li>
                <strong>Fillable PDF</strong>: the official D&D sheet, D&D Beyond’s “Export to PDF”, and most publishers’ sheets.
              </li>
              <li>
                <strong>D&D Beyond</strong> or <strong>Pathbuilder</strong> data saved from the link below.
              </li>
            </ul>
          </div>

          <div className="sheet-way">
            <h3>
              <Ico as={LinkSimple} /> A share link
            </h3>
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault()
                readLink()
              }}
            >
              <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="dndbeyond.com/characters/… or Pathbuilder’s JSON link" />
              <button disabled={!link.trim() || !!busy}>Fetch</button>
            </form>
            <p className="muted small">
              D&D Beyond: the character must be public (its sharing setting). Pathbuilder: Menu, Export JSON, then copy the link it gives.
            </p>
            {blocked && (
              <p className="notice small">
                That site won’t let the app read it directly, so take one more step: open{' '}
                <a href={blocked} target="_blank" rel="noreferrer">
                  the character’s data
                </a>
                , select all of it and copy it, then paste it into the box at the bottom.
              </p>
            )}
          </div>

          <div className="sheet-way">
            <h3>
              <Ico as={TextAa} /> Any other sheet
            </h3>
            <textarea
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste the sheet’s text: from Roll20, Demiplane, a PDF, a website or your own notes. Claude sorts it into the page. Pasted D&D Beyond, Pathbuilder or Foundry data is read here, free."
            />
            {text.trim().startsWith('{') ? (
              <button className="primary" onClick={() => attempt('Reading the sheet…', () => parseSheetJson(text))}>
                Read it
              </button>
            ) : (
              text.trim() && (
                <ClaudeJob
                  worldId={worldId}
                  jobId={`sheet:${worldId}:${into?.id ?? 'new'}`}
                  jobTitle="Reading a character sheet"
                  label="Read it with Claude"
                  build={() => sheetRequest(text, system)}
                  priceKey={text}
                  onResult={(reply) => attempt('Reading Claude’s answer…', () => sheetFromReply(reply))}
                />
              )
            )}
          </div>
        </div>
      ) : (
        <SheetPreview worldId={worldId} sheet={sheet} into={into} onSheet={onSheet} onBack={() => setSheet(undefined)} onClose={onClose} />
      )}
      {busy && <p className="muted small">{busy}</p>}
      {error && <p className="error small">{error}</p>}
    </Modal>
  )
}

/** What was found, and where it goes. */
function SheetPreview({
  worldId,
  sheet,
  into,
  onSheet,
  onBack,
  onClose,
}: {
  worldId: string
  sheet: Sheet
  into?: Entity
  onSheet?: (s: Sheet) => void
  onBack: () => void
  onClose: () => void
}) {
  const navigate = useNavigate()
  const characters =
    useLiveQuery(
      () =>
        db.entities
          .where({ worldId, type: 'pc' })
          .filter((e) => !e.template)
          .sortBy('name'),
      [worldId],
    ) ?? []
  const same = characters.find((c) => c.name.trim().toLowerCase() === sheet.name.trim().toLowerCase())
  const [target, setTarget] = useState<string>()
  const chosen = target ?? into?.id ?? same?.id ?? ''
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    if (onSheet) return (onSheet(sheet), onClose())
    setBusy(true)
    try {
      const id = await applySheet(worldId, sheet, chosen || undefined)
      onClose()
      if (id !== into?.id) navigate(pagePath(worldId, id))
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="form">
      <p>
        <strong>{sheet.name}</strong>
        {sheet.summary && <> · {sheet.summary}</>} <span className="muted small">from {sheet.source}</span>
      </p>
      {sheet.fields.length > 0 && (
        <dl className="sheet-fields">
          {sheet.fields.map((f) => (
            <div key={f.key}>
              <dt>{f.key}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {sheet.worked && (
        <p className="muted small">
          {sheet.source} leaves {sheet.worked.join(' and ')} to its own app, so the app worked them out. Check them against the sheet.
        </p>
      )}
      {sheet.body && (
        <details>
          <summary className="small">The rest of the sheet (features, spells, gear, backstory)</summary>
          <pre className="sheet-body">{sheet.body}</pre>
        </details>
      )}
      {onSheet ? (
        <p className="muted small">This goes into your editor for you to look over. Your GM’s own description and secrets stay as they are.</p>
      ) : (
        <label>
          Put it on
          <select value={chosen} onChange={(e) => setTarget(e.target.value)}>
            <option value="">A new character page (🔒 GM only until you reveal it)</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>
                Update {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {chosen && !onSheet && (
        <p className="muted small">
          The sheet’s numbers and its “Character sheet” section are replaced. GM notes, secrets and anything else you wrote stay as they are.
        </p>
      )}
      {error && <p className="error small">{error}</p>}
      <div className="row end">
        <button type="button" onClick={onBack}>
          Back
        </button>
        <button className="primary" disabled={busy} onClick={save}>
          {onSheet ? 'Put it in my editor' : chosen ? 'Update the character' : 'Add the character'}
        </button>
      </div>
    </div>
  )
}

/** The button that opens it. */
export function ImportSheetButton({
  worldId,
  system,
  into,
  className,
  label = 'Import character sheet',
}: {
  worldId: string
  system: string
  into?: Entity
  className?: string
  label?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        className={className}
        onClick={() => setOpen(true)}
        title="Bring in a character from D&D Beyond, Foundry VTT, Pathbuilder, a PDF or any sheet’s text"
      >
        <Ico as={FileArrowUp} /> {label}
      </button>
      {open && <ImportSheet worldId={worldId} system={system} into={into} onClose={() => setOpen(false)} />}
    </>
  )
}
