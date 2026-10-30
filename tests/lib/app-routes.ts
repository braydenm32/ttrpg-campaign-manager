import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Reads the <Route> tags in src/App.tsx and returns each full path pattern (a child's path joined
 * to its parents', "index" routes as the parent's own path). Kept separate so the menu check
 * (every route has a place in src/nav.ts) can use it too.
 */
export function appRoutes(file = join(import.meta.dirname, '..', '..', 'src', 'App.tsx')): string[] {
  const src = readFileSync(file, 'utf8')
  const out: string[] = []
  const stack: string[] = []
  const tag = /<Route\b|<\/Route>/g
  for (let m = tag.exec(src); m; m = tag.exec(src)) {
    if (m[0] === '</Route>') {
      stack.pop()
      continue
    }
    // Find where this tag ends: the first ">" outside any {…} (element={<Page />} has its own ">").
    let depth = 0
    let i = m.index + m[0].length
    for (; i < src.length; i++) {
      const c = src[i]
      if (c === '{') depth++
      else if (c === '}') depth--
      else if (c === '>' && depth === 0) break
    }
    const attrs = src.slice(m.index, i + 1)
    const selfClosing = src[i - 1] === '/'
    tag.lastIndex = i + 1
    const path = attrs.match(/\spath="([^"]*)"/)?.[1]
    const index = /\sindex[\s/>]/.test(attrs)
    const parent = stack[stack.length - 1] ?? ''
    const full = index ? parent : join2(parent, path ?? '')
    out.push(full)
    if (!selfClosing) stack.push(full)
  }
  return out
}

function join2(parent: string, child: string) {
  if (child.startsWith('/') || !parent) return child
  return `${parent.replace(/\/$/, '')}/${child}`
}
