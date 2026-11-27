import { baseKeymap, chainCommands, deleteSelection, exitCode, joinBackward, lift, selectNodeBackward, setBlockType, toggleMark, wrapIn } from 'prosemirror-commands'
import { redo, undo } from 'prosemirror-history'
import { InputRule, inputRules, textblockTypeInputRule, undoInputRule, wrappingInputRule } from 'prosemirror-inputrules'
import { keymap } from 'prosemirror-keymap'
import { Fragment, type MarkType, type Node as PMNode, type NodeType, type ResolvedPos, Slice } from 'prosemirror-model'
import { liftListItem, sinkListItem, splitListItem, wrapInList } from 'prosemirror-schema-list'
import { type Command, type EditorState, NodeSelection, Plugin, Selection, TextSelection, type Transaction } from 'prosemirror-state'
import { liftTarget, ReplaceAroundStep, ReplaceStep } from 'prosemirror-transform'
import { readOpener } from '../secretText.ts'
import { cleanNames, parseLoose, schema } from './markdownDoc.ts'

/**
 * What the formatted editor does with keys and buttons: formatting, lists, tables, and the rules
 * that keep a secret passage a secret (see wordsGuard). No screen code here.
 */

const N = schema.nodes
const M = schema.marks

/** A change that moves words into or out of a secret passage on purpose carries this. */
export const SECRET_OK = 'secretOk'

/** The secret passages a place in the text sits in, outermost first ("" for none). */
export function secretsAround($pos: ResolvedPos): string {
  let s = ''
  for (let d = 1; d <= $pos.depth; d++) {
    const n = $pos.node(d)
    if (n.type === N.secret) s += `/${n.attrs.kind}:${cleanNames(n.attrs.names).toLowerCase()}`
  }
  return s
}

/** Whether a change leaves any words that were there before in a different secret passage (or in none). */
function movesWords(tr: Transaction): boolean {
  // Typing and deleting inside one paragraph can't: skip the full look.
  const plain = tr.steps.every((step, i) => {
    if (!(step instanceof ReplaceStep) || step.slice.openStart || step.slice.openEnd) return false
    let inline = true
    step.slice.content.forEach((n) => {
      if (!n.isInline) inline = false
    })
    const doc = tr.docs[i]
    return inline && doc.resolve(step.from).sameParent(doc.resolve(step.to))
  })
  if (plain) return false
  const after: { from: number; to: number; sig: string }[] = []
  tr.doc.descendants((node, pos) => {
    if (!node.isTextblock) return true
    after.push({ from: pos + 1, to: pos + 1 + node.content.size, sig: secretsAround(tr.doc.resolve(pos + 1)) })
    return false
  })
  let moved = false
  tr.before.descendants((node, pos) => {
    if (moved) return false
    if (!node.isTextblock) return true
    const sig = secretsAround(tr.before.resolve(pos + 1))
    let k = 0
    for (let p = pos + 1; p < pos + 1 + node.content.size && !moved; p++) {
      const r = tr.mapping.mapResult(p, 1)
      if (r.deletedAfter) continue
      // Where that letter is now (the blocks are in order, and so are the letters).
      while (k < after.length && after[k].to <= r.pos) k++
      const b = after[k]
      if (!b || b.from > r.pos || b.sig !== sig) moved = true
    }
    return false
  })
  return moved
}

/**
 * The rule that keeps secrets secret while editing: no change may leave words that were inside a
 * GM-only passage (or a passage for some characters) outside it, or the other way round, unless the
 * GM asked for exactly that with the passage's own button (SECRET_OK) or is undoing. Backspace at a
 * passage's edge, deleting across it, a phone keyboard's own edits: all are checked here, after the
 * fact, whatever made them. New words (typed, pasted, dropped) aren't "moved": they land where the
 * GM put them, in plain sight.
 */
export function wordsGuard(onRefuse: () => void) {
  return new Plugin({
    filterTransaction(tr) {
      if (!tr.docChanged || tr.getMeta(SECRET_OK) || tr.getMeta('history$')) return true
      if (!movesWords(tr)) return true
      onRefuse()
      return false
    },
  })
}

/** Blocks the caret can't get out of by typing: an empty paragraph after one at the end gives somewhere to go on. */
export const needsLastLine = (doc: PMNode) => {
  const last = doc.lastChild
  return !!last && ((last.type === N.secret && !last.attrs.unclosed) || [N.raw_block, N.code_block, N.table, N.horizontal_rule].includes(last.type))
}

/** Keeps an empty paragraph after a GM-only block, table or plain block at the end (it isn't written to the text). */
export const lastLine = new Plugin({
  appendTransaction(trs, _old, state) {
    if (!trs.some((t) => t.docChanged) || !needsLastLine(state.doc)) return null
    return state.tr.insert(state.doc.content.size, N.paragraph.create()).setMeta('addToHistory', false)
  },
})

const PAGE_LINK = /\[\[([^\]|\n]+)(?:\|([^\]\n]+))?\]\]/g

/** Turns a typed "[[Page]]" or "[[Page|label]]" in the paragraph being written into a page link. */
export const typedPageLinks = new Plugin({
  appendTransaction(trs, _old, state) {
    if (!trs.some((t) => t.docChanged)) return null
    const { $from } = state.selection
    const block = $from.parent
    if (!block.isTextblock || block.type.spec.code || !block.textContent.includes(']]')) return null
    const found: { from: number; to: number; node: PMNode }[] = []
    block.forEach((child, offset) => {
      if (!child.isText || child.marks.some((m) => m.type === M.code)) return
      for (const m of child.text!.matchAll(PAGE_LINK)) {
        const from = $from.start() + offset + m.index
        found.push({ from, to: from + m[0].length, node: N.wikilink.create({ target: m[1], label: m[2] ?? null }, null, child.marks) })
      }
    })
    if (!found.length) return null
    const tr = state.tr
    for (const f of found.reverse()) tr.replaceWith(f.from, f.to, f.node)
    return tr
  },
})

// ---------------------------------------------------------------------------------------------
// What the caret is in
// ---------------------------------------------------------------------------------------------

export const markActive = (state: EditorState, type: MarkType) => {
  const { from, $from, to, empty } = state.selection
  return empty ? !!type.isInSet(state.storedMarks ?? $from.marks()) : state.doc.rangeHasMark(from, to, type)
}

/** The depth of the nearest block of a type around the selection's start, or -1. */
export function depthOf(state: EditorState, type: NodeType | NodeType[]): number {
  const types = [type].flat()
  const { $from } = state.selection
  for (let d = $from.depth; d > 0; d--) if (types.includes($from.node(d).type)) return d
  return -1
}

/** "0" for ordinary text, "1" to "6" for a heading, "" where there is no choice (a table, a plain block). */
export function textType(state: EditorState): string {
  const { $from } = state.selection
  const block = $from.parent
  if (block.type === N.paragraph) return '0'
  if (block.type === N.heading) return String(block.attrs.level)
  return ''
}

/** In a plain block or code, formatting has no meaning. */
export const inCode = (state: EditorState) => !!state.selection.$from.parent.type.spec.code

// ---------------------------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------------------------

export const setTextType = (level: number): Command => (level ? setBlockType(N.heading, { level }) : setBlockType(N.paragraph))

export const toggleList = (type: NodeType): Command => (state, dispatch) => {
  const d = depthOf(state, [N.bullet_list, N.ordered_list])
  if (d < 0) return wrapInList(type)(state, dispatch)
  const list = state.selection.$from.node(d)
  if (list.type === type) return liftListItem(N.list_item)(state, dispatch)
  // The other kind of list: change this one over.
  if (dispatch) dispatch(state.tr.setNodeMarkup(state.selection.$from.before(d), type, { tight: list.attrs.tight }))
  return true
}

export const toggleQuote: Command = (state, dispatch) => {
  const d = depthOf(state, N.blockquote)
  if (d < 0) return wrapIn(N.blockquote)(state, dispatch)
  const $from = state.selection.$from
  const range = state.doc.resolve($from.start(d)).blockRange(state.doc.resolve($from.end(d)))
  const target = range && liftTarget(range)
  if (!range || target == null) return false
  if (dispatch) dispatch(state.tr.lift(range, target).scrollIntoView())
  return true
}

/** The block the selection starts in that sits directly in the text or in a secret passage. */
function topBlock($pos: ResolvedPos): { depth: number; node: PMNode; before: number; after: number } | null {
  for (let d = $pos.depth; d > 0; d--) {
    const parent = $pos.node(d - 1)
    if (parent.type === N.doc || parent.type === N.secret) return { depth: d, node: $pos.node(d), before: $pos.before(d), after: $pos.after(d) }
  }
  return null
}

/** Puts a block after the one the caret is in (or in its place, if that is an empty paragraph). */
function insertBlock(state: EditorState, block: PMNode, caretInside: boolean): Transaction | null {
  const top = topBlock(state.selection.$from)
  if (!top) return null
  const empty = top.node.type === N.paragraph && top.node.content.size === 0
  const tr = state.tr
  const at = empty ? top.before : top.after
  if (empty) tr.replaceWith(top.before, top.after, block)
  else tr.insert(at, block)
  if (caretInside) tr.setSelection(Selection.near(tr.doc.resolve(at + 1), 1))
  else {
    // After a line or a picture, go on writing below it.
    const after = at + block.nodeSize
    if (after >= tr.doc.content.size) tr.insert(after, N.paragraph.create())
    tr.setSelection(Selection.near(tr.doc.resolve(after + 1), 1))
  }
  return tr.scrollIntoView()
}

export const insertRule: Command = (state, dispatch) => {
  const tr = insertBlock(state, N.horizontal_rule.create(), false)
  if (tr && dispatch) dispatch(tr)
  return !!tr
}

// ---------------------------------------------------------------------------------------------
// Tables (always a plain grid: a row of headings, then rows)
// ---------------------------------------------------------------------------------------------

const cell = (header: boolean) => N.table_cell.create({ header })
const row = (width: number, header: boolean) => N.table_row.create(null, Array.from({ length: width }, () => cell(header)))

export const insertTable: Command = (state, dispatch) => {
  if (depthOf(state, N.table) >= 0) return false
  const tr = insertBlock(state, N.table.create({ align: [null, null] }, [row(2, true), row(2, false)]), true)
  if (tr && dispatch) dispatch(tr)
  return !!tr
}

/** Where the caret is in a table: the table, its place in the text, and the row and column. */
export function tableAt(state: EditorState): { table: PMNode; pos: number; row: number; col: number } | null {
  const d = depthOf(state, N.table_cell)
  if (d < 2) return null
  const { $from } = state.selection
  return { table: $from.node(d - 2), pos: $from.before(d - 2), row: $from.index(d - 2), col: $from.index(d - 1) }
}

/** The place just inside a table's cell. */
function cellStart(table: PMNode, tablePos: number, r: number, c: number): number {
  let pos = tablePos + 1
  for (let i = 0; i < r; i++) pos += table.child(i).nodeSize
  pos += 1
  const tr = table.child(r)
  for (let i = 0; i < c; i++) pos += tr.child(i).nodeSize
  return pos + 1
}

const widthOf = (table: PMNode) => {
  let w = 0
  table.forEach((r) => (w = Math.max(w, r.childCount)))
  return w
}

export const addRow: Command = (state, dispatch) => {
  const at = tableAt(state)
  if (!at) return false
  if (dispatch) {
    let pos = at.pos + 1
    for (let i = 0; i <= at.row; i++) pos += at.table.child(i).nodeSize
    const tr = state.tr.insert(pos, row(widthOf(at.table), false))
    dispatch(tr.setSelection(TextSelection.create(tr.doc, pos + 2)).scrollIntoView())
  }
  return true
}

export const addColumn: Command = (state, dispatch) => {
  const at = tableAt(state)
  if (!at) return false
  if (dispatch) {
    const tr = state.tr
    // From the last row up, so earlier places stay where they were.
    for (let r = at.table.childCount - 1; r >= 0; r--) {
      const tableRow = at.table.child(r)
      const c = Math.min(at.col + 1, tableRow.childCount)
      tr.insert(cellStart(at.table, at.pos, r, c) - 1, cell(r === 0))
    }
    const align = [...((at.table.attrs.align as (string | null)[]) ?? [])]
    while (align.length < widthOf(at.table)) align.push(null)
    align.splice(at.col + 1, 0, null)
    tr.setNodeMarkup(at.pos, null, { ...at.table.attrs, align })
    const table = tr.doc.nodeAt(at.pos)!
    dispatch(tr.setSelection(TextSelection.create(tr.doc, cellStart(table, at.pos, at.row, Math.min(at.col + 1, table.child(at.row).childCount - 1)))).scrollIntoView())
  }
  return true
}

export const deleteTable: Command = (state, dispatch) => {
  const at = tableAt(state)
  if (!at) return false
  if (dispatch) dispatch(state.tr.replaceWith(at.pos, at.pos + at.table.nodeSize, N.paragraph.create()).scrollIntoView())
  return true
}

export const deleteRow: Command = (state, dispatch) => {
  const at = tableAt(state)
  if (!at) return false
  if (at.table.childCount <= 1) return deleteTable(state, dispatch)
  if (dispatch) {
    let pos = at.pos + 1
    for (let i = 0; i < at.row; i++) pos += at.table.child(i).nodeSize
    const tr = state.tr.delete(pos, pos + at.table.child(at.row).nodeSize)
    // The top row is always the row of headings.
    const table = tr.doc.nodeAt(at.pos)!
    let p = at.pos + 2
    table.child(0).forEach((c) => {
      if (!c.attrs.header) tr.setNodeMarkup(p, null, { header: true })
      p += c.nodeSize
    })
    const now = tr.doc.nodeAt(at.pos)!
    const r = Math.min(at.row, now.childCount - 1)
    dispatch(tr.setSelection(TextSelection.create(tr.doc, cellStart(now, at.pos, r, Math.min(at.col, now.child(r).childCount - 1)))).scrollIntoView())
  }
  return true
}

export const deleteColumn: Command = (state, dispatch) => {
  const at = tableAt(state)
  if (!at) return false
  if (widthOf(at.table) <= 1) return deleteTable(state, dispatch)
  if (dispatch) {
    const tr = state.tr
    for (let r = at.table.childCount - 1; r >= 0; r--) {
      const tableRow = at.table.child(r)
      if (at.col >= tableRow.childCount || tableRow.childCount <= 1) continue
      const start = cellStart(at.table, at.pos, r, at.col) - 1
      tr.delete(start, start + tableRow.child(at.col).nodeSize)
    }
    const align = [...((at.table.attrs.align as (string | null)[]) ?? [])]
    align.splice(at.col, 1)
    tr.setNodeMarkup(at.pos, null, { ...at.table.attrs, align })
    const now = tr.doc.nodeAt(at.pos)!
    dispatch(tr.setSelection(TextSelection.create(tr.doc, cellStart(now, at.pos, at.row, Math.min(at.col, now.child(at.row).childCount - 1)))).scrollIntoView())
  }
  return true
}

/** Tab and Shift+Tab step through a table's cells; Tab in the last cell adds a row. */
const nextCell = (dir: 1 | -1): Command => (state, dispatch) => {
  const at = tableAt(state)
  if (!at) return false
  let r = at.row
  let c = at.col + dir
  if (c < 0) {
    r--
    if (r < 0) return true
    c = at.table.child(r).childCount - 1
  } else if (c >= at.table.child(r).childCount) {
    r++
    c = 0
    if (r >= at.table.childCount) return addRow(state, dispatch)
  }
  if (dispatch) {
    const start = cellStart(at.table, at.pos, r, c)
    dispatch(state.tr.setSelection(TextSelection.create(state.doc, start, start + at.table.child(r).child(c).content.size)).scrollIntoView())
  }
  return true
}

/** Enter in a table goes down a row (a cell holds one line), adding one after the last. */
const enterInTable: Command = (state, dispatch) => {
  const at = tableAt(state)
  if (!at) return false
  if (at.row + 1 >= at.table.childCount) return addRow(state, dispatch)
  if (dispatch) {
    const below = at.table.child(at.row + 1)
    dispatch(state.tr.setSelection(TextSelection.create(state.doc, cellStart(at.table, at.pos, at.row + 1, Math.min(at.col, below.childCount - 1)))).scrollIntoView())
  }
  return true
}

// ---------------------------------------------------------------------------------------------
// Secret passages
// ---------------------------------------------------------------------------------------------

/** Whether a passage holds nothing at all (only empty paragraphs). */
const holdsNothing = (secret: PMNode) => {
  let nothing = true
  secret.forEach((k) => {
    if (k.type !== N.paragraph || k.content.size) nothing = false
  })
  return nothing
}

/**
 * Adds a GM-only passage, or a secret for some characters. With words selected, the paragraphs they
 * are in go inside it; otherwise an empty one opens below, with the caret in it. A secret for some
 * characters inside a GM-only passage would reach nobody (the outer passage hides everything in
 * it), so that one goes just after the GM-only passage instead: `moved` says so.
 */
export function insertSecret(kind: 'gm' | 'for', moved: () => void): Command {
  return (state, dispatch) => {
    const { $from, $to, empty } = state.selection
    const fresh = () => N.secret.create({ kind }, N.paragraph.create())
    if (kind === 'for') {
      for (let d = 1; d <= $from.depth; d++) {
        const n = $from.node(d)
        if (n.type !== N.secret || n.attrs.kind !== 'gm') continue
        if (dispatch) {
          const at = $from.after(d)
          const tr = state.tr.insert(at, fresh())
          // A passage never closed ran to the end: now something follows it, so it is closed here.
          if (n.attrs.unclosed) tr.setNodeMarkup($from.before(d), null, { ...n.attrs, unclosed: false })
          dispatch(tr.setSelection(Selection.near(tr.doc.resolve(at + 1), 1)).scrollIntoView())
          moved()
        }
        return true
      }
    }
    if (empty) {
      const tr = insertBlock(state, fresh(), true)
      if (tr && dispatch) dispatch(tr)
      return !!tr
    }
    const range = $from.blockRange($to, (n) => n.type === N.doc || n.type === N.secret)
    if (!range) return false
    if (dispatch) dispatch(state.tr.wrap(range, [{ type: N.secret, attrs: { kind } }]).setMeta(SECRET_OK, true).scrollIntoView())
    return true
  }
}

/** Takes a passage's markers away, leaving its words where they are: for everyone to read. */
export function unwrapSecret(pos: number): Command {
  return (state, dispatch) => {
    const node = state.doc.nodeAt(pos)
    if (node?.type !== N.secret) return false
    // The box goes and what was in it stays in place (a passage never lets its words be lifted out
    // any other way: it is "isolating", so ProseMirror's own lift refuses).
    if (dispatch) dispatch(state.tr.step(new ReplaceAroundStep(pos, pos + node.nodeSize, pos + 1, pos + node.nodeSize - 1, Slice.empty, 0, true)).setMeta(SECRET_OK, true))
    return true
  }
}

/** Changes who a ":::for" passage is for. */
export function setSecretNames(pos: number, names: string): Command {
  return (state, dispatch) => {
    const node = state.doc.nodeAt(pos)
    if (node?.type !== N.secret) return false
    if (dispatch) dispatch(state.tr.setNodeMarkup(pos, null, { ...node.attrs, names: cleanNames(names) }).setMeta(SECRET_OK, true))
    return true
  }
}

/** Gives a passage that was never closed its closing line, here. */
export function closeSecret(pos: number): Command {
  return (state, dispatch) => {
    const node = state.doc.nodeAt(pos)
    if (node?.type !== N.secret) return false
    if (dispatch) dispatch(state.tr.setNodeMarkup(pos, null, { ...node.attrs, unclosed: false }))
    return true
  }
}

/**
 * Backspace at the very start of a secret passage: nothing leaves the passage. If the passage is
 * empty it goes; otherwise nothing happens (ProseMirror's own Backspace would lift the first
 * paragraph out, which is exactly how a secret would turn into ordinary text by accident).
 */
const backspaceInSecret: Command = (state, dispatch) => {
  const { $cursor } = state.selection as TextSelection
  if (!$cursor || $cursor.parentOffset > 0 || $cursor.depth < 2) return false
  const parent = $cursor.node($cursor.depth - 1)
  if (parent.type !== N.secret || $cursor.index($cursor.depth - 1) > 0) return false
  if (holdsNothing(parent) && dispatch) {
    const from = $cursor.before($cursor.depth - 1)
    const tr = state.tr.replaceWith(from, from + parent.nodeSize, N.paragraph.create())
    dispatch(tr.setSelection(TextSelection.create(tr.doc, from + 1)).scrollIntoView())
  }
  return true
}

/**
 * Deleting a selection that starts in one secret passage and ends in another (or outside): the
 * selected words go, and what is left stays where it was, each side of the passage's edge. (Joining
 * the two leftover halves, as deleting usually does, would carry secret words out.)
 */
const deleteAcrossSecrets: Command = (state, dispatch) => {
  const { $from, $to, empty } = state.selection
  if (empty || state.selection instanceof NodeSelection || secretsAround($from) === secretsAround($to)) return false
  if (dispatch) {
    const cuts: [number, number][] = []
    state.doc.nodesBetween($from.pos, $to.pos, (node, pos) => {
      if (!node.isTextblock) return true
      const a = Math.max($from.pos, pos + 1)
      const b = Math.min($to.pos, pos + 1 + node.content.size)
      if (b > a) cuts.push([a, b])
      return false
    })
    const tr = state.tr
    for (const [a, b] of cuts.reverse()) tr.delete(a, b)
    dispatch(tr.setSelection(TextSelection.create(tr.doc, tr.mapping.map($from.pos))).scrollIntoView())
  }
  return true
}

/** Typing ":::gm" or ":::for Wren" on a line of its own and pressing Enter opens that passage. */
const typedSecret: Command = (state, dispatch) => {
  const { $cursor } = state.selection as TextSelection
  if (!$cursor || $cursor.parent.type !== N.paragraph || $cursor.parentOffset !== $cursor.parent.content.size) return false
  const top = topBlock($cursor)
  if (!top || top.depth !== $cursor.depth) return false
  const opener = readOpener($cursor.parent.textContent)
  if (!opener || opener.one !== undefined || opener.first || opener.kind === 'foryou') return false
  if (dispatch) {
    const tr = state.tr.replaceWith(top.before, top.after, N.secret.create({ kind: opener.kind, names: opener.names.join(', ') }, N.paragraph.create()))
    dispatch(tr.setSelection(TextSelection.create(tr.doc, top.before + 2)).scrollIntoView())
  }
  return true
}

// ---------------------------------------------------------------------------------------------
// Links and pictures
// ---------------------------------------------------------------------------------------------

/** The web link the caret is in (or touching): its address and where it starts and ends. */
export function linkAround(state: EditorState): { href: string; from: number; to: number } | null {
  const { $from } = state.selection
  const parent = $from.parent
  if (!parent.isTextblock) return null
  const idx = $from.index()
  const here = parent.maybeChild(idx)
  const before = $from.textOffset === 0 && idx > 0 ? parent.child(idx - 1) : null
  const mark = (here && M.link.isInSet(here.marks)) || (before && M.link.isInSet(before.marks))
  if (!mark) return null
  let first = here && mark.isInSet(here.marks) ? idx : idx - 1
  let last = first
  while (first > 0 && mark.isInSet(parent.child(first - 1).marks)) first--
  while (last < parent.childCount - 1 && mark.isInSet(parent.child(last + 1).marks)) last++
  let from = $from.start()
  for (let i = 0; i < first; i++) from += parent.child(i).nodeSize
  let to = from
  for (let i = first; i <= last; i++) to += parent.child(i).nodeSize
  return { href: String(mark.attrs.href), from, to }
}

/** Makes the selected words a web link (or, with nothing selected, writes the address as a link). */
export function setLink(href: string): Command {
  return (state, dispatch) => {
    const address = href.trim()
    if (!address || inCode(state)) return false
    const around = linkAround(state)
    const { from, to, empty } = state.selection
    if (dispatch) {
      const mark = M.link.create({ href: address })
      const tr = state.tr
      if (around) tr.removeMark(around.from, around.to, M.link).addMark(around.from, around.to, mark)
      else if (empty) tr.replaceSelectionWith(schema.text(address, [mark]), false)
      else tr.addMark(from, to, mark)
      dispatch(tr.scrollIntoView())
    }
    return true
  }
}

export const removeLink: Command = (state, dispatch) => {
  const around = linkAround(state)
  if (!around) return false
  if (dispatch) dispatch(state.tr.removeMark(around.from, around.to, M.link))
  return true
}

/** Puts pictures (or any words and pictures) in at the caret. */
export function insertInline(nodes: PMNode[]): Command {
  return (state, dispatch) => {
    if (!nodes.length || inCode(state)) return false
    if (dispatch) dispatch(state.tr.replaceSelection(new Slice(Fragment.fromArray(nodes), 0, 0)).scrollIntoView())
    return true
  }
}

/** Pasted or dropped plain text is read as Markdown, so a ":::gm" passage in it arrives as one. */
export function markdownSlice(text: string): Slice {
  const doc = parseLoose(text)
  const first = doc.firstChild!
  const last = doc.lastChild!
  // The first and last paragraphs join the line they land in; a block (a GM-only passage above all) stays whole.
  return new Slice(doc.content, first.type === N.paragraph ? 1 : 0, last.type === N.paragraph ? 1 : 0)
}

// ---------------------------------------------------------------------------------------------
// Keys and typing shortcuts
// ---------------------------------------------------------------------------------------------

const hardBreak: Command = chainCommands(exitCode, (state, dispatch) => {
  if (tableAt(state) || inCode(state)) return false
  if (dispatch) dispatch(state.tr.replaceSelectionWith(N.hard_break.create()).scrollIntoView())
  return true
})

export function editorKeys(openLink: () => void) {
  const mac = typeof navigator !== 'undefined' && /Mac|iP(hone|[oa]d)/.test(navigator.platform)
  const keys: Record<string, Command> = {
    'Mod-z': undo,
    'Shift-Mod-z': redo,
    'Mod-b': toggleMark(M.strong),
    'Mod-i': toggleMark(M.em),
    'Mod-`': toggleMark(M.code),
    'Mod-Shift-x': toggleMark(M.strike),
    'Mod-k': () => {
      openLink()
      return true
    },
    'Mod-Alt-0': setTextType(0),
    'Mod-Alt-1': setTextType(1),
    'Mod-Alt-2': setTextType(2),
    'Mod-Alt-3': setTextType(3),
    'Mod-Shift-7': toggleList(N.ordered_list),
    'Mod-Shift-8': toggleList(N.bullet_list),
    'Mod-Shift-9': toggleQuote,
    Enter: chainCommands(typedSecret, enterInTable, splitListItem(N.list_item), baseKeymap.Enter),
    'Shift-Enter': hardBreak,
    'Mod-Enter': hardBreak,
    Backspace: chainCommands(undoInputRule, deleteAcrossSecrets, backspaceInSecret, deleteSelection, joinBackward, selectNodeBackward),
    Delete: chainCommands(deleteAcrossSecrets, baseKeymap.Delete),
    Tab: chainCommands(nextCell(1), sinkListItem(N.list_item)),
    'Shift-Tab': chainCommands(nextCell(-1), liftListItem(N.list_item)),
    'Mod-[': lift,
  }
  if (!mac) keys['Mod-y'] = redo
  return [keymap(keys), keymap(baseKeymap)]
}

/**
 * A mark made by typing its Markdown: **bold**, *italic*, `code`, ~~struck~~. The pattern's first
 * group is what came before the opening marker, its second the words.
 */
function markRule(pattern: RegExp, marker: string, type: MarkType) {
  return new InputRule(pattern, (state, match, start, end) => {
    const words = match[2]
    const from = start + match[1].length
    // The closing marker's last character is the key just pressed: it never reaches the text.
    const tr = state.tr.delete(from + marker.length + words.length, end).delete(from, from + marker.length)
    return tr.addMark(from, from + words.length, type.create()).removeStoredMark(type)
  })
}

/** Typing shortcuts a GM who knows Markdown expects, and that feel natural to one who doesn't ("- " starts a list). */
export function typingRules() {
  return inputRules({
    rules: [
      textblockTypeInputRule(/^(#{1,3})\s$/, N.heading, (m) => ({ level: m[1].length })),
      wrappingInputRule(/^\s*>\s$/, N.blockquote),
      wrappingInputRule(/^\s*([-+*])\s$/, N.bullet_list),
      wrappingInputRule(/^(\d+)[.)]\s$/, N.ordered_list, (m) => ({ start: Number(m[1]) }), (m, node) => node.childCount + node.attrs.start === Number(m[1])),
      textblockTypeInputRule(/^```$/, N.code_block),
      new InputRule(/^---$/, (state, _m, start, end) => {
        const $start = state.doc.resolve(start)
        const top = topBlock($start)
        if (!top || top.depth !== $start.depth || $start.parent.type !== N.paragraph) return null
        const tr = state.tr.delete(start, end)
        tr.replaceWith(top.before, tr.mapping.map(top.after), [N.horizontal_rule.create(), N.paragraph.create()])
        return tr.setSelection(TextSelection.create(tr.doc, top.before + 2))
      }),
      markRule(/(^|[^*])\*\*([^*\s](?:[^*]*[^*\s])?)\*\*$/, '**', M.strong),
      markRule(/(^|[^*\w])\*([^*\s](?:[^*]*[^*\s])?)\*$/, '*', M.em),
      markRule(/(^|[^`])`([^`]+)`$/, '`', M.code),
      markRule(/(^|[^~])~~([^~\s](?:[^~]*[^~\s])?)~~$/, '~~', M.strike),
    ],
  })
}
