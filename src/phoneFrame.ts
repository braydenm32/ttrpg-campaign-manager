import { useEffect, type RefObject } from 'react'
import { useLocation } from 'react-router-dom'

/** How far (px) a scroll must go one way before the top bar hides or comes back, so a wobble doesn't flicker it. */
const NUDGE = 12
/** Near the top of a screen the bar always shows. */
const TOP = 80

/**
 * On a phone, the top bar (the world's name, search and the area's tabs) slides away while you scroll
 * down a screen, and comes back the moment you scroll up, reach the top or open another screen.
 * The bottom bar stays put: it's the way around. Styles in src/phone.css (body.bar-tucked: on the body, so React redrawing the frame never drops it).
 */
export function useTuckingTopBar(shell: RefObject<HTMLElement | null>, ready: boolean) {
  const { pathname } = useLocation()
  useEffect(() => {
    const el = shell.current
    if (!el || typeof window.matchMedia !== 'function') return
    const phone = window.matchMedia('(max-width: 800px)')
    let tucked = false
    // The furthest point the scroll reached in the direction it's going (lowest while showing, highest while tucked).
    let mark = window.scrollY
    const set = (on: boolean) => {
      if (on === tucked) return
      tucked = on
      document.body.classList.toggle('bar-tucked', on)
    }
    set(false)
    const onScroll = () => {
      const y = window.scrollY
      if (!phone.matches || y < TOP) {
        set(false)
        mark = y
        return
      }
      // Search (or anything else in the bar) being used keeps the bar in sight.
      if (el.querySelector('.topbar')?.contains(document.activeElement)) {
        mark = y
        return
      }
      if (tucked) {
        if (y > mark) mark = y
        else if (mark - y > NUDGE) {
          set(false)
          mark = y
        }
      } else if (y < mark) mark = y
      else if (y - mark > NUDGE) {
        set(true)
        mark = y
      }
    }
    // Something in the bar getting the focus (a keyboard user tabbing to it) brings it back.
    const onFocus = (e: FocusEvent) => {
      if ((e.target as Element | null)?.closest?.('.topbar')) set(false)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    el.addEventListener('focusin', onFocus)
    phone.addEventListener?.('change', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      el.removeEventListener('focusin', onFocus)
      phone.removeEventListener?.('change', onScroll)
      document.body.classList.remove('bar-tucked')
    }
  }, [shell, pathname, ready])
}
