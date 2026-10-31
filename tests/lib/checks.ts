import type { Page } from '@playwright/test'
import type { Found } from './baseline'

/** Messages the app shows when an address leads nowhere (EntityList, EntityPage, MapView, App.tsx NotFound…). */
export const NOT_FOUND =
  /There’s nothing at this address|doesn't exist or hasn't been revealed|Unknown category\.|This page type has been removed|Map not found\.|Session not found\.|Campaign not found\.|Board not found\.|World not found\.|Page not found\.|is GM only, so a player copy would be empty/

/** An error message boiled down to something that stays the same between runs (no ids, numbers or addresses). */
export function tidyError(message: string) {
  return message
    .split('\n')[0]
    .replace(/https?:\/\/\S+/g, '<url>')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<id>')
    .replace(/\d+/g, 'N')
    .slice(0, 120)
}

/**
 * Looks over the screen as it is now: crashed, "not found", wider than the window, and (on a
 * phone) buttons and links too small to tap. `notFound` says whether "not found" is expected.
 */
export async function checkScreen(page: Page, { phone, notFound, errors }: { phone: boolean; notFound: boolean; errors: string[] }): Promise<Found> {
  const problems = new Set(errors.map((e) => `page error: ${tidyError(e)}`))
  const text = await page.locator('body').innerText()
  if (/Something went wrong/.test(text)) problems.add('crashed (Something went wrong)')
  const nf = NOT_FOUND.test(text)
  if (nf && !notFound) problems.add('says not found')
  if (!nf && notFound) problems.add('expected a not-found message')
  const wide = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement
    return el.scrollWidth - el.clientWidth
  })
  if (wide > 1) problems.add('sideways scroll')
  const found: Found = { problems: [...problems] }
  if (phone) {
    const small = await smallTargets(page)
    found.smallTargets = small.length
    found.smallExamples = small.slice(0, 6)
  }
  return found
}

/**
 * Buttons, links and form controls on screen that are smaller than 44×44 px, the size of a
 * fingertip. Links inside a sentence are left out (they can't be bigger than the text).
 */
export async function smallTargets(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = []
    const sel = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=link], [role=checkbox], [role=switch], [tabindex="0"]'
    const seen = new Set<Element>()
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      // A control inside another control counts once (the outer one).
      if (el.parentElement?.closest(sel) && seen.has(el.parentElement.closest(sel)!)) continue
      seen.add(el)
      if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue
      if ((el as HTMLButtonElement).disabled) continue
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) continue
      if (r.right <= 0 || r.left >= window.innerWidth) continue // off screen, e.g. the closed phone menu
      if (r.width >= 44 && r.height >= 44) continue
      const style = getComputedStyle(el)
      if (style.display === 'inline') {
        const block = el.parentElement
        if (block && (block.textContent ?? '').trim().length > (el.textContent ?? '').trim().length + 15) continue
      }
      // Checkboxes and radios usually sit inside a bigger label you can tap instead.
      if (el instanceof HTMLInputElement && /checkbox|radio/.test(el.type)) {
        const label = el.closest('label')
        if (label) {
          const lr = label.getBoundingClientRect()
          if (lr.width >= 44 && lr.height >= 44) continue
        }
      }
      const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || el.getAttribute('placeholder') || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 30)
      out.push(`“${name}” ${Math.round(r.width)}×${Math.round(r.height)}`)
    }
    return out
  })
}

/**
 * All the text a person could get at on the screen: every text node (hidden ones too, since a
 * secret hidden by CSS is still in the page), plus tooltips, labels, alt text and form values.
 */
export async function allText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const parts: string[] = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const p = n.parentElement
      if (p && (p.tagName === 'SCRIPT' || p.tagName === 'STYLE')) continue
      parts.push(n.nodeValue ?? '')
    }
    for (const el of document.querySelectorAll('[title], [aria-label], [alt], [placeholder]'))
      for (const a of ['title', 'aria-label', 'alt', 'placeholder']) {
        const v = el.getAttribute(a)
        if (v) parts.push(v)
      }
    for (const el of document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')) if (el.value) parts.push(el.value)
    parts.push(document.title)
    return parts.join(' \n ')
  })
}
