import { db, newId, type ShowBoard, type World } from './db'

/**
 * The GM's named boards for showing several handouts at once, kept in the world's GM screen
 * (World.gmScreen.showBoards), which the server never sends to players. See src/showBoard.tsx.
 */

/** The world's boards, in the order they were made. The first single board (from before boards had names) counts as one. */
export function showBoardsOf(world: Pick<World, 'gmScreen'> | null | undefined): ShowBoard[] {
  const g = world?.gmScreen
  return g?.showBoards ?? (g?.board?.items.length ? [{ ...g.board, id: 'first-board', name: 'Board 1' }] : [])
}

/** The board in hand: the one on players' screens now, else the one changed last. */
export const boardInHand = (list: ShowBoard[], world: Pick<World, 'spread'>) =>
  list.find((b) => !!world.spread && b.shown === world.spread.id) ?? [...list].sort((a, b) => (b.at ?? 0) - (a.at ?? 0))[0]

/** A new, empty board, named after how many there are. */
export const blankBoard = (others: ShowBoard[]): ShowBoard => ({ id: newId(), name: freeName(others, 'Board'), items: [], auto: true })

/** "Board 3", or "Crime scene (copy)": a name no other board has. */
export function freeName(others: ShowBoard[], base: string) {
  const taken = new Set(others.map((b) => b.name.trim().toLowerCase()))
  if (base !== 'Board' && !taken.has(base.toLowerCase())) return base
  for (let n = base === 'Board' ? others.length + 1 : 2; ; n++) {
    const name = base === 'Board' ? `Board ${n}` : `${base} ${n}`
    if (!taken.has(name.toLowerCase())) return name
  }
}

function editBoards(worldId: string, fn: (list: ShowBoard[]) => ShowBoard[]) {
  return db.worlds
    .where('id')
    .equals(worldId)
    .modify((w) => {
      const list = fn(showBoardsOf(w))
      const { board: _old, ...rest } = { pages: [], rolls: [], ...w.gmScreen }
      w.gmScreen = { ...rest, showBoards: list }
      w.updatedAt = Date.now()
    })
}

/** Saves a board (adding it if it's new). */
export const saveShowBoard = (worldId: string, board: ShowBoard) =>
  editBoards(worldId, (list) => (list.some((b) => b.id === board.id) ? list.map((b) => (b.id === board.id ? board : b)) : [...list, board]))

/** Deletes a board; returns a function that brings it back (for Undo). */
export async function deleteShowBoard(worldId: string, id: string) {
  const before = showBoardsOf(await db.worlds.get(worldId))
  const at = before.findIndex((b) => b.id === id)
  await editBoards(worldId, (list) => list.filter((b) => b.id !== id))
  return async () => {
    if (at < 0) return
    await editBoards(worldId, (list) => (list.some((b) => b.id === id) ? list : [...list.slice(0, at), before[at], ...list.slice(at)]))
  }
}
