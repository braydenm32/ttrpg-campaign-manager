import type { Page } from '@playwright/test'

/**
 * Reading and putting back single records of the app's database, straight in the page. Tests that
 * change the example world use these to put it back as it was, since tests in one worker share it.
 * The app doesn't notice changes made this way until the page is opened again.
 */

export type Row = Record<string, unknown> & { id: string }

/** One record of the app's database, read in the page. */
export function getRecord(page: Page, table: string, id: string) {
  return page.evaluate(
    ({ table, id }) =>
      new Promise<Row | undefined>((resolve, reject) => {
        const req = indexedDB.open('ttrpg-campaign-manager')
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const idb = req.result
          const get = idb.transaction(table, 'readonly').objectStore(table).get(id)
          get.onsuccess = () => {
            idb.close()
            resolve(get.result)
          }
          get.onerror = () => reject(get.error)
        }
      }),
    { table, id },
  )
}

/** Puts records back as they were, or (for null) deletes them. */
export function putBack(page: Page, table: string, rows: [string, Row | null | undefined][]) {
  return page.evaluate(
    ({ table, rows }) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('ttrpg-campaign-manager')
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const idb = req.result
          const tx = idb.transaction(table, 'readwrite')
          const store = tx.objectStore(table)
          for (const [id, row] of rows) {
            if (row) store.put(row)
            else store.delete(id)
          }
          tx.oncomplete = () => {
            idb.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
    { table, rows },
  )
}

/** Changes one record (a shallow merge) and gives back how it was, for putBack. */
export async function patchRecord(page: Page, table: string, id: string, changes: Record<string, unknown>) {
  const before = await getRecord(page, table, id)
  if (!before) throw new Error(`No ${table} record ${id}`)
  const after: Row = { ...before, ...changes }
  for (const [k, v] of Object.entries(changes)) if (v === undefined) delete after[k]
  await putBack(page, table, [[id, after]])
  return before
}
