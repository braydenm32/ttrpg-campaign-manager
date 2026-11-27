import { ArrowUUpLeft, ArrowUUpRight, At, EyeClosed, Image, Link, ListBullets, ListNumbers, Lock, Minus, Quotes, Shield, Table, TextB, TextItalic } from '@phosphor-icons/react'
import { toggleMark } from 'prosemirror-commands'
import { dropCursor } from 'prosemirror-dropcursor'
import { gapCursor } from 'prosemirror-gapcursor'
import { history, redo, redoDepth, undo, undoDepth } from 'prosemirror-history'
import type { Node as PMNode } from 'prosemirror-model'
import { type Command, EditorState, NodeSelection, Plugin } from 'prosemirror-state'
import { EditorView, type NodeView, type ViewMutationRecord } from 'prosemirror-view'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { db } from '../db'
import { Help } from '../help'
import { saveFileAsAsset } from '../hooks'
import { Ico, TypeIcon } from '../icons'
import { findLinkPages, shortNames, useLinkPages, type LinkPage } from '../linkPages'
import { forNames } from '../secretText'
import { saveFailed, toast } from '../undo'
import {
  addColumn,
  addRow,
  closeSecret,
  deleteColumn,
  deleteRow,
  deleteTable,
  depthOf,
  editorKeys,
  inCode,
  insertInline,
  insertRule,
  insertSecret,
  insertTable,
  lastLine,
  linkAround,
  markActive,
  markdownSlice,
  needsLastLine,
  removeLink,
  setLink,
  setSecretNames,
  setTextType,
  tableAt,
  textType,
  toggleList,
  toggleQuote,
  typedPageLinks,
  typingRules,
  unwrapSecret,
  wordsGuard,
} from './commands'
import './editor.css'
import { fragmentMarkdown, parseMarkdown, schema, serializeMarkdown, type Sources } from './markdownDoc'

const N = schema.nodes
const M = schema.marks

export interface FormattedEditorProps {
  worldId: string
  value: string
  onChange: (v: string) => void
  /** What the box is, for screen readers ("Description"). */
  label: string
  /** The least height, in lines (as the plain text box's rows). */
  rows?: number
  placeholder?: string
  /** False for GM notes: every word there is GM only already, so no secret-passage buttons. */
  secrets?: boolean
}

/** What the blocks inside the text need from the screen around them. */
interface Around {
  pcs: LinkPage[]
  secrets: boolean
  listeners: Set<() => void>
}

/**
 * The formatted editor: the GM writes the page as it will look, with a toolbar, and the page is
 * still saved as the same Markdown text (see markdownDoc.ts for how nothing is lost). GM-only
 * passages and secrets for some characters are boxes with their own heading; page links and
 * pictures sit in the text as they will on the page.
 *
 * Loaded only when an editor opens (src/TextEditor.tsx), so the rest of the app stays light.
 */
export default function FormattedEditor({ worldId, value, onChange, label, rows = 10, placeholder, secrets = true }: FormattedEditorProps) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const sources = useRef<Sources | null>(null)
  /** The text last read in or handed out: a `value` that differs came from somewhere else. */
  const current = useRef(value)
  /** `value` has caught up with what was handed out (it can lag where saving takes a moment). */
  const caught = useRef(true)
  const change = useRef(onChange)
  change.current = onChange
  const [, redraw] = useState(0)
  const [linkDraft, setLinkDraft] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(-1)
  const [active, setActive] = useState(0)
  const pages = useLinkPages(worldId)
  const around = useRef<Around>({ pcs: [], secrets, listeners: new Set() })
  const pcs = pages.filter((p) => p.type === 'pc')
  const pcKey = pcs.map((p) => p.id + p.name).join('|')
  useEffect(() => {
    around.current.pcs = pcs
    around.current.listeners.forEach((l) => l())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pcKey])

  /** What the suggestion keys act on (set on every draw, read by the key handler). */
  const suggest = useRef<{ hits: ReturnType<typeof findLinkPages>; from: number; to: number; pick: (name: string) => void } | null>(null)
  const openLink = useRef(() => {})

  /** What a document is written as (kept for the document it was worked out for: the check and the hand-over use the same one). */
  const written = useRef(new WeakMap<PMNode, ReturnType<typeof serializeMarkdown>>())
  const writeOut = (doc: PMNode) => {
    let out = written.current.get(doc)
    if (!out) {
      out = serializeMarkdown(doc, sources.current)
      written.current.set(doc, out)
    }
    return out
  }

  const read = (text: string) => {
    written.current = new WeakMap()
    const { doc, sources: s } = parseMarkdown(text)
    sources.current = s
    return needsLastLine(doc) ? doc.copy(doc.content.addToEnd(N.paragraph.create())) : doc
  }

  useEffect(() => {
    let refusedAt = 0
    const plugins = [
      typingRules(),
      ...editorKeys(() => openLink.current()),
      history(),
      gapCursor(),
      dropCursor({ color: 'var(--accent)' }),
      wordsGuard(() => {
        if (Date.now() - refusedAt < 4000) return
        refusedAt = Date.now()
        toast('That would have moved words into or out of a GM-only block, so nothing was changed. Cut and paste them, or use the block’s own button.')
      }),
      // The last word on secrets: a change whose text wouldn't keep every line in the block it's shown
      // in (see serializeMarkdown) isn't made at all, so the editor never holds text it can't save.
      new Plugin({
        filterTransaction(tr) {
          if (!tr.docChanged || writeOut(tr.doc).safe) return true
          if (Date.now() - refusedAt >= 4000) {
            refusedAt = Date.now()
            toast('That change would have moved the edge of a GM-only block, so it wasn’t made. Nothing you wrote was lost. To make it anyway, switch to Markdown.')
          }
          return false
        },
      }),
      lastLine,
      typedPageLinks,
    ]
    const v = new EditorView(host.current!, {
      state: EditorState.create({ doc: read(current.current), plugins }),
      attributes: { class: 'pm-text markdown', role: 'textbox', 'aria-multiline': 'true', 'aria-label': label },
      nodeViews: {
        secret: (node, pmView, getPos) => new SecretView(node, pmView, getPos, around.current),
        image: (node) => new PictureView(node),
      },
      dispatchTransaction(tr) {
        const state = v.state.apply(tr)
        v.updateState(state)
        if (tr.docChanged) {
          const out = writeOut(state.doc)
          // A text that wouldn't keep its secrets as shown is never handed on (see serializeMarkdown);
          // the check above means there is none, but this stays as a second lock.
          if (out.safe && out.text !== current.current) {
            current.current = out.text
            caught.current = false
            change.current(out.text)
          }
        }
        redraw((n) => n + 1)
      },
      // Plain text that is pasted or dropped is Markdown: a ":::gm" passage in it stays one.
      clipboardTextParser: (text) => markdownSlice(text),
      clipboardTextSerializer: (slice) => fragmentMarkdown(slice.content),
      handlePaste(_v, ev) {
        const files = [...(ev.clipboardData?.files ?? [])]
        if (!files.some((f) => f.type.startsWith('image/'))) return false
        void addPictures(files)
        return true
      },
      handleDrop(_v, ev) {
        const files = [...((ev as DragEvent).dataTransfer?.files ?? [])]
        if (!files.some((f) => f.type.startsWith('image/'))) return false
        ev.preventDefault()
        void addPictures(files)
        return true
      },
      handleKeyDown(_v, ev) {
        const s = suggest.current
        if (!s?.hits.length) return false
        const n = s.hits.length
        if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') setActive((a) => (Math.min(a, n - 1) + (ev.key === 'ArrowDown' ? 1 : n - 1)) % n)
        else if (ev.key === 'Enter' || ev.key === 'Tab') s.pick(s.hits[Math.min(activeNow.current, n - 1)].link)
        else if (ev.key === 'Escape') setDismissed(s.from)
        else return false
        ev.preventDefault()
        return true
      },
      // A ticked or empty box at the start of a list line: a click on it ticks or clears it.
      handleClickOn(pmView, _pos, node, nodePos, ev, direct) {
        if (!direct || node.type !== N.list_item || node.attrs.checked === null) return false
        const li = pmView.nodeDOM(nodePos) as HTMLElement | null
        if (!li || ev.clientX > li.getBoundingClientRect().left + 4) return false
        pmView.dispatch(pmView.state.tr.setNodeMarkup(nodePos, null, { checked: !node.attrs.checked }))
        return true
      },
    })
    view.current = v
    redraw((n) => n + 1)
    return () => {
      v.destroy()
      view.current = null
    }
    // Made once: later changes to the text come in through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The text changed somewhere else (a prompt's answer, a restored draft, another device): read it in afresh.
  useEffect(() => {
    if (value === current.current) {
      caught.current = true
      return
    }
    // Still on its way back from being saved: what's here is newer.
    if (!caught.current) return
    current.current = value
    const v = view.current
    if (!v) return
    v.updateState(EditorState.create({ doc: read(value), plugins: v.state.plugins }))
    redraw((n) => n + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  useEffect(() => {
    around.current.secrets = secrets
  }, [secrets])

  const activeNow = useRef(0)
  activeNow.current = active

  /** Runs a command and gives the text back the caret. */
  const run = (command: Command) => {
    const v = view.current
    if (!v) return
    command(v.state, v.dispatch, v)
    v.focus()
  }
  const can = (command: Command) => !!view.current && command(view.current.state)

  /** Pictures pasted, dropped or picked go into the world's files and into the text where the caret is. */
  const addPictures = async (files: File[]) => {
    const nodes: PMNode[] = []
    for (const f of files.filter((x) => x.type.startsWith('image/'))) {
      const name = f.name && f.name !== 'image.png' ? f.name.replace(/\.[^.]+$/, '') : 'Picture'
      try {
        nodes.push(N.image.create({ src: `asset:${await saveFileAsAsset(worldId, f, f.name || 'Pasted picture.png', ['in text'])}`, alt: name.replace(/[[\]]/g, '') }))
      } catch (err) {
        saveFailed(`the picture “${name}”`, err)
      }
    }
    run(insertInline(nodes))
  }

  const state = view.current?.state
  const code = !state || inCode(state)
  const table = state ? tableAt(state) : null
  const link = state ? linkAround(state) : null
  const picked = state?.selection instanceof NodeSelection ? state.selection : null
  const pageLink = picked?.node.type === N.wikilink ? picked : null
  openLink.current = () => setLinkDraft(link?.href ?? '')

  // "@Bro" or "[[Bro" just before the caret: suggest pages to link to.
  suggest.current = null
  if (state && state.selection.empty && !code) {
    const { $from } = state.selection
    const before = $from.parent.textBetween(Math.max(0, $from.parentOffset - 60), $from.parentOffset, undefined, '￼')
    const m = before.match(/(?:^|[\s(])(@|\[\[)([^@\n[\]|￼]{1,40})$/)
    if (m) {
      const from = $from.pos - m[1].length - m[2].length
      const hits = dismissed === from ? [] : findLinkPages(pages, m[2].toLowerCase())
      const pick = (name: string) => {
        const v = view.current!
        // "[[" may already have its closing "]]" after the caret.
        const closed = m[1] === '[[' && v.state.doc.textBetween($from.pos, Math.min($from.pos + 2, $from.end())) === ']]' ? 2 : 0
        v.dispatch(v.state.tr.replaceWith(from, $from.pos + closed, N.wikilink.create({ target: name })).scrollIntoView())
        v.focus()
        setActive(0)
      }
      suggest.current = { hits, from, to: $from.pos, pick }
    }
  }
  const hits = suggest.current?.hits ?? []
  const empty = !!state && state.doc.childCount === 1 && state.doc.firstChild!.type === N.paragraph && state.doc.firstChild!.content.size === 0

  const applyLink = () => {
    run((linkDraft ?? '').trim() ? setLink(linkDraft!) : removeLink)
    setLinkDraft(null)
  }
  // A toolbar button keeps the text's selection: pressing it mustn't take the caret away.
  const keep = { onMouseDown: (ev: React.MouseEvent) => ev.preventDefault() }
  const tool = (name: string, icon: React.ReactNode, command: Command, on = false, keys = '') => (
    <button type="button" className={`pm-tool ${on ? 'on' : ''}`} title={keys ? `${name} (${keys})` : name} aria-label={name} aria-pressed={on} disabled={!can(command)} {...keep} onClick={() => run(command)}>
      {icon}
    </button>
  )
  const mod = typeof navigator !== 'undefined' && /Mac|iP(hone|[oa]d)/.test(navigator.platform) ? '⌘' : 'Ctrl+'

  return (
    <div className="pm-editor">
      {/* The buttons, and whatever they open, stay in sight while a long text scrolls under them. */}
      <div className="pm-top">
      <div className="pm-toolbar" role="toolbar" aria-label={`Formatting for ${label}`}>
        {tool('Undo', <Ico as={ArrowUUpLeft} />, state && undoDepth(state) ? undo : () => false, false, `${mod}Z`)}
        {tool('Redo', <Ico as={ArrowUUpRight} />, state && redoDepth(state) ? redo : () => false, false, `${mod}Y`)}
        <select
          className="pm-type"
          aria-label="Kind of text"
          title="Ordinary text or a heading"
          value={state ? textType(state) : '0'}
          disabled={!state || textType(state) === ''}
          onChange={(ev) => run(setTextType(Number(ev.target.value)))}
        >
          <option value="0">Text</option>
          <option value="1">Heading 1</option>
          <option value="2">Heading 2</option>
          <option value="3">Heading 3</option>
          {state && Number(textType(state)) > 3 && <option value={textType(state)}>Heading {textType(state)}</option>}
        </select>
        {tool('Bold', <Ico as={TextB} weight="bold" />, code ? () => false : toggleMark(M.strong), !!state && markActive(state, M.strong), `${mod}B`)}
        {tool('Italic', <Ico as={TextItalic} />, code ? () => false : toggleMark(M.em), !!state && markActive(state, M.em), `${mod}I`)}
        {tool('Bulleted list', <Ico as={ListBullets} />, toggleList(N.bullet_list), !!state && depthOf(state, [N.bullet_list, N.ordered_list]) >= 0 && state.selection.$from.node(depthOf(state, [N.bullet_list, N.ordered_list])).type === N.bullet_list)}
        {tool('Numbered list', <Ico as={ListNumbers} />, toggleList(N.ordered_list), !!state && depthOf(state, [N.bullet_list, N.ordered_list]) >= 0 && state.selection.$from.node(depthOf(state, [N.bullet_list, N.ordered_list])).type === N.ordered_list)}
        {tool('Quote', <Ico as={Quotes} />, toggleQuote, !!state && depthOf(state, N.blockquote) >= 0)}
        <button type="button" className={`pm-tool ${link ? 'on' : ''}`} title={`Web link (${mod}K)`} aria-label="Web link" aria-pressed={!!link} disabled={code} {...keep} onClick={() => setLinkDraft(linkDraft === null ? (link?.href ?? '') : null)}>
          <Ico as={Link} />
        </button>
        <button
          type="button"
          className="pm-tool"
          title="Link to a page of this world (or type @ and its name)"
          aria-label="Link to a page"
          disabled={code}
          {...keep}
          onClick={() =>
            run((s, dispatch) => {
              // "@" needs a space before it to count, as when it is typed.
              const lead = s.selection.$from.parentOffset > 0 && !/[\s(]$/.test(s.selection.$from.parent.textBetween(0, s.selection.$from.parentOffset, undefined, '￼')) ? ' ' : ''
              if (dispatch) dispatch(s.tr.insertText(`${lead}@`))
              return true
            })
          }
        >
          <Ico as={At} />
        </button>
        {tool('Table', <Ico as={Table} />, insertTable)}
        {tool('Line across the page', <Ico as={Minus} />, insertRule)}
        <label className={`button pm-tool ${code ? 'disabled' : ''}`} title="Put a picture in the text (you can also paste or drop one)">
          <Ico as={Image} />
          <span className="sr-only">Picture</span>
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            disabled={code}
            onChange={(e) => {
              void addPictures([...(e.target.files ?? [])])
              e.target.value = ''
            }}
          />
        </label>
        <Help topic="pictures" />
        {secrets && (
          <>
            <button type="button" className="pm-tool wide" title="Hide a passage from every player" {...keep} onClick={() => run(insertSecret('gm', () => {}))}>
              <Ico as={Lock} /> GM-only passage
            </button>
            <button
              type="button"
              className="pm-tool wide"
              title="A passage only the players of the characters you name will see"
              {...keep}
              onClick={() => run(insertSecret('for', () => toast('A secret inside a GM-only passage would reach no one, so it starts just after that passage.')))}
            >
              <Ico as={EyeClosed} /> Secret for…
            </button>
          </>
        )}
      </div>
      {table && (
        <div className="pm-bar" role="group" aria-label="Table">
          <span className="small muted">Table:</span>
          <button type="button" className="small" {...keep} onClick={() => run(addRow)}>
            + Row
          </button>
          <button type="button" className="small" {...keep} onClick={() => run(addColumn)}>
            + Column
          </button>
          <button type="button" className="small" {...keep} onClick={() => run(deleteRow)}>
            Remove row
          </button>
          <button type="button" className="small" {...keep} onClick={() => run(deleteColumn)}>
            Remove column
          </button>
          <button type="button" className="small" {...keep} onClick={() => run(deleteTable)}>
            Remove table
          </button>
        </div>
      )}
      {linkDraft !== null ? (
        // Not a <form>: the editor sits inside the page's own form, and Enter here mustn't save the page.
        <div className="pm-bar" role="group" aria-label="Web link">
          <label className="small muted" htmlFor="pm-link-address">
            Web address
          </label>
          <input
            id="pm-link-address"
            type="url"
            inputMode="url"
            autoFocus
            value={linkDraft}
            placeholder="https://…"
            onChange={(ev) => setLinkDraft(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key !== 'Enter' && ev.key !== 'Escape') return
              ev.preventDefault()
              if (ev.key === 'Enter') applyLink()
              else {
                setLinkDraft(null)
                view.current?.focus()
              }
            }}
          />
          <button type="button" className="small primary" onClick={applyLink}>
            {link ? 'Change link' : 'Add link'}
          </button>
          {link && (
            <button
              type="button"
              className="small"
              onClick={() => {
                run(removeLink)
                setLinkDraft(null)
              }}
            >
              Remove link
            </button>
          )}
        </div>
      ) : link ? (
        <div className="pm-bar">
          <span className="small muted">Web link:</span>
          <span className="small pm-address">{link.href}</span>
          <button type="button" className="small" {...keep} onClick={() => setLinkDraft(link.href)}>
            Change
          </button>
          <button type="button" className="small" {...keep} onClick={() => run(removeLink)}>
            Remove link
          </button>
        </div>
      ) : null}
      {pageLink && (
        <div className="pm-bar">
          <span className="small muted">Links to the page “{pageLink.node.attrs.target}”. Shown as:</span>
          <input
            aria-label="The words shown for this link"
            value={pageLink.node.attrs.label ?? ''}
            placeholder={pageLink.node.attrs.target}
            onKeyDown={(ev) => {
              if (ev.key !== 'Enter') return
              ev.preventDefault()
              view.current?.focus()
            }}
            onChange={(ev) => {
              const v = view.current!
              const tr = v.state.tr.setNodeMarkup(pageLink.from, null, { ...pageLink.node.attrs, label: ev.target.value.replace(/[\]|\n]/g, '') || null })
              v.dispatch(tr.setSelection(NodeSelection.create(tr.doc, pageLink.from)))
            }}
          />
        </div>
      )}
      {hits.length > 0 && (
        <div className="name-suggestions page-suggestions" role="listbox" aria-label="Link to a page">
          <span className="small muted">Link to:</span>
          {hits.map((p, i) => (
            <button key={p.id} type="button" role="option" aria-selected={i === Math.min(active, hits.length - 1)} className={`chip ${i === Math.min(active, hits.length - 1) ? 'on' : ''}`} {...keep} onClick={() => suggest.current?.pick(p.link)}>
              <TypeIcon type={p.type} /> {p.name}
              {/* Found by another name: say which. */}
              {p.alias && <span className="muted"> ({p.alias})</span>}
            </button>
          ))}
          <span className="small muted">↑↓ to choose, Enter to link, Esc to close</span>
        </div>
      )}
      </div>
      <div className="pm-page" style={{ minHeight: `${rows * 1.5 + 1.2}em` }} onMouseDown={(ev) => ev.target === ev.currentTarget && (ev.preventDefault(), view.current?.focus())}>
        {empty && placeholder && (
          <span className="pm-placeholder" aria-hidden="true">
            {placeholder}
          </span>
        )}
        <div ref={host} className="pm-host" />
      </div>
    </div>
  )
}

/**
 * A secret passage in the text: a box with a heading that says who reads it, and its own buttons.
 * The heading is the app's, not the GM's text: it can't be typed in or deleted by Backspace.
 */
class SecretView implements NodeView {
  dom: HTMLElement
  contentDOM: HTMLElement
  private head: HTMLElement
  private root: Root
  private node: PMNode
  private view: EditorView
  private getPos: () => number | undefined
  private around: Around

  constructor(node: PMNode, view: EditorView, getPos: () => number | undefined, around: Around) {
    this.node = node
    this.view = view
    this.getPos = getPos
    this.around = around
    this.dom = document.createElement('div')
    this.head = this.dom.appendChild(document.createElement('div'))
    this.head.className = 'pm-secret-head'
    this.head.contentEditable = 'false'
    this.contentDOM = this.dom.appendChild(document.createElement('div'))
    this.contentDOM.className = 'pm-secret-body'
    this.root = createRoot(this.head)
    this.draw()
  }

  private draw() {
    const { kind, names } = this.node.attrs
    this.dom.className = `pm-secret ${kind}`
    this.dom.dataset.secret = kind
    this.dom.dataset.names = names
    const pos = this.getPos()
    // A secret for some characters inside a GM-only passage reaches nobody.
    let inGm = false
    if (pos !== undefined) {
      const $pos = this.view.state.doc.resolve(Math.min(pos, this.view.state.doc.content.size))
      for (let d = 1; d <= $pos.depth; d++) if ($pos.node(d).type === N.secret && $pos.node(d).attrs.kind === 'gm') inGm = true
    }
    const act = (command: (pos: number) => Command) => {
      const at = this.getPos()
      if (at === undefined) return
      command(at)(this.view.state, this.view.dispatch)
      this.view.focus()
    }
    this.root.render(
      <SecretHead
        kind={kind}
        names={names}
        unclosed={!!this.node.attrs.unclosed}
        inGm={inGm}
        around={this.around}
        onNames={(n) => act((p) => setSecretNames(p, n))}
        onClose={() => act(closeSecret)}
        onShow={() => {
          act(unwrapSecret)
          toast(this.around.secrets ? (kind === 'gm' ? 'Revealed: that passage is no longer GM only, so players can read it once the page is revealed. Undo, above the text, puts the block back.' : 'Revealed to all players: that passage is no longer for some characters only. Undo, above the text, puts the block back.') : 'The block is gone; its words stay in your notes.')
        }}
      />,
    )
  }

  update(node: PMNode) {
    if (node.type !== N.secret) return false
    this.node = node
    this.draw()
    return true
  }
  /** Clicks and typing in the heading are the heading's own business. */
  stopEvent(ev: Event) {
    return this.head.contains(ev.target as Node)
  }
  ignoreMutation(m: ViewMutationRecord) {
    return m.type === 'selection' ? false : !this.contentDOM.contains(m.target) || m.target === this.dom
  }
  destroy() {
    // Not in the middle of React's own drawing.
    setTimeout(() => this.root.unmount())
  }
}

function SecretHead({
  kind,
  names,
  unclosed,
  inGm,
  around,
  onNames,
  onClose,
  onShow,
}: {
  kind: string
  names: string
  unclosed: boolean
  inGm: boolean
  around: Around
  onNames: (names: string) => void
  onClose: () => void
  onShow: () => void
}) {
  const pcs = useSyncExternalStore(
    (l) => {
      around.listeners.add(l)
      return () => around.listeners.delete(l)
    },
    () => around.pcs,
  )
  const keep = { onMouseDown: (ev: React.MouseEvent) => ev.preventDefault() }
  const listed = forNames(names)
  const shorts = shortNames(pcs)
  const has = (i: number) => listed.some((n) => [shorts[i], pcs[i].name.trim()].some((x) => x.toLowerCase() === n.toLowerCase()))
  // Names on the line that aren't a player character's (a typo, or a character not made yet).
  const others = listed.filter((n) => !pcs.some((p, i) => [shorts[i], p.name.trim()].some((x) => x.toLowerCase() === n.toLowerCase())))
  const toggle = (i: number) => onNames((has(i) ? listed.filter((n) => ![shorts[i], pcs[i].name.trim()].some((x) => x.toLowerCase() === n.toLowerCase())) : [...listed, shorts[i]]).join(', '))
  return (
    <>
      <div className="pm-secret-title">
        {kind === 'gm' ? (
          <>
            <Ico as={Lock} /> <strong>GM only</strong> <span className="pm-secret-note">players never see this</span>
          </>
        ) : kind === 'for' ? (
          <>
            <Ico as={EyeClosed} /> <strong>Only for</strong>
            {pcs.map((p, i) => (
              <button key={p.id} type="button" className={`chip ${has(i) ? 'on' : ''}`} aria-pressed={has(i)} {...keep} onClick={() => toggle(i)}>
                <Ico as={Shield} /> {p.name}
              </button>
            ))}
            {others.map((n) => (
              <button key={n} type="button" className="chip on" aria-pressed="true" title="No player character has this name. Press to take it off." {...keep} onClick={() => onNames(listed.filter((x) => x !== n).join(', '))}>
                {n} ×
              </button>
            ))}
            {!pcs.length && !others.length && <span className="pm-secret-note">Add your players’ characters as Player Character pages to pick them here.</span>}
          </>
        ) : (
          <>
            <Ico as={EyeClosed} /> <strong>Just for the player reading</strong>
          </>
        )}
        <button type="button" className="ghost small pm-secret-show" title="Take the block away and keep its words, for everyone to read" {...keep} onClick={onShow}>
          {around.secrets ? (kind === 'gm' ? 'Reveal to players' : 'Reveal to all players') : 'Remove block'}
        </button>
      </div>
      {kind === 'for' && inGm ? (
        <div className="pm-secret-warn">This secret is inside a GM-only block, so no player sees it. Move it out of the GM-only block to share it.</div>
      ) : kind === 'for' && !listed.length ? (
        <div className="pm-secret-warn">Nobody is picked yet, so no player sees this.</div>
      ) : null}
      {unclosed && (
        <div className="pm-secret-warn">
          This block has no closing line (:::) in the text, so it runs to the end: everything after it is hidden too.{' '}
          <button type="button" className="small" {...keep} onClick={onClose}>
            Close it here
          </button>
        </div>
      )}
    </>
  )
}

/** A picture in the text: one of the world's files (read from this device) or one from the web. */
class PictureView implements NodeView {
  dom: HTMLElement
  private url?: string
  private gone = false

  constructor(node: PMNode) {
    const src = String(node.attrs.src)
    const alt = String(node.attrs.alt ?? '')
    const asset = src.match(/^asset:([0-9a-fA-F-]{36})$/)
    // As on the page: a picture from the web shows only from an https address.
    if (!asset && !/^(https:\/\/|data:image\/)/i.test(src)) {
      this.dom = document.createElement('span')
      this.dom.className = 'pm-picture-missing'
      this.dom.textContent = alt || 'picture'
      return
    }
    const img = document.createElement('img')
    this.dom = img
    img.className = 'inline-picture pm-picture'
    img.alt = alt
    if (node.attrs.title) img.title = node.attrs.title
    if (!asset) {
      img.src = src
      return
    }
    void db.assets.get(asset[1]).then((a) => {
      if (this.gone) return
      if (!a) return void (img.alt = alt ? `${alt} (picture not on this device yet)` : 'Picture not on this device yet')
      this.url = URL.createObjectURL(a.blob)
      img.src = this.url
    })
  }
  destroy() {
    this.gone = true
    if (this.url) URL.revokeObjectURL(this.url)
  }
}
