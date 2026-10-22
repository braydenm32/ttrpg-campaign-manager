/**
 * In-app map drawings. A drawing is a list of vector shapes; it is rendered to an SVG image
 * which is stored as the map's image asset, so drawn maps get pins, regions, player view and
 * nested maps exactly like uploaded ones.
 */

export const TERRAINS = {
  land: { label: 'Land', fill: '#cdbb8b', edge: '#8a7650' },
  grass: { label: 'Grassland', fill: '#a9b56e', edge: '#6f7a3f' },
  forest: { label: 'Forest', fill: 'url(#p-forest)', edge: '#3f6131' },
  mountains: { label: 'Mountains', fill: 'url(#p-mountains)', edge: '#6b604d' },
  hills: { label: 'Hills', fill: 'url(#p-hills)', edge: '#8a7650' },
  swamp: { label: 'Swamp', fill: 'url(#p-swamp)', edge: '#4f5a33' },
  desert: { label: 'Desert', fill: 'url(#p-desert)', edge: '#b0904f' },
  snow: { label: 'Snow / ice', fill: '#e9eef2', edge: '#a6b4bf' },
  water: { label: 'Water', fill: 'url(#p-water)', edge: '#1f4a5c' },
  floor: { label: 'Stone floor', fill: 'url(#p-floor)', edge: '#1a1a1f' },
  wood: { label: 'Wood floor', fill: 'url(#p-wood)', edge: '#3d2a17' },
} as const
export type Terrain = keyof typeof TERRAINS

export const LINE_STYLES = {
  road: { label: 'Road', color: '#7a5a33', width: 5, dash: '14 10' },
  path: { label: 'Trail', color: '#7a5a33', width: 3, dash: '4 8' },
  river: { label: 'River', color: '#3f7f9e', width: 8, dash: '' },
  wall: { label: 'Wall', color: '#1a1a1f', width: 10, dash: '' },
  border: { label: 'Border', color: '#8b2f3c', width: 4, dash: '18 6 4 6' },
  ink: { label: 'Ink', color: '#3a2e1c', width: 3, dash: '' },
} as const
export type LineStyle = keyof typeof LINE_STYLES

export const STAMPS = {
  city: 'City',
  town: 'Town',
  village: 'Village',
  castle: 'Castle',
  tower: 'Tower',
  ruins: 'Ruins',
  temple: 'Temple',
  inn: 'Inn',
  cave: 'Cave',
  dungeon: 'Dungeon',
  camp: 'Camp',
  ship: 'Ship',
  tree: 'Tree',
  peak: 'Mountain',
  door: 'Door',
  chest: 'Chest',
  stairs: 'Stairs',
  skull: 'Danger',
  star: 'Point of interest',
  compass: 'Compass',
} as const
export type StampKind = keyof typeof STAMPS

export type Point = [number, number]

export type Shape =
  | { id: string; kind: 'area'; terrain: Terrain; points: Point[]; smooth: boolean }
  | { id: string; kind: 'line'; style: LineStyle; points: Point[]; smooth: boolean }
  | { id: string; kind: 'stamp'; stamp: StampKind; at: Point; size: number }
  | { id: string; kind: 'label'; text: string; at: Point; size: number; color: string; italic: boolean }

export const BACKGROUNDS = {
  sea: { label: 'Open sea (draw land on it)', fill: 'url(#p-sea)' },
  parchment: { label: 'Parchment', fill: '#e8dcb8' },
  grass: { label: 'Grassland', fill: '#a9b56e' },
  stone: { label: 'Dark stone (dungeons)', fill: '#24222a' },
} as const
export type Background = keyof typeof BACKGROUNDS

export interface Drawing {
  background: Background
  grid: 'none' | 'square' | 'hex'
  gridSize: number
  shapes: Shape[]
}

export const emptyDrawing = (background: Background): Drawing => ({
  background,
  grid: background === 'stone' ? 'square' : 'none',
  gridSize: 70,
  shapes: [],
})

/** Smooth closed or open path through the points (Catmull-Rom converted to Béziers). */
export function pathFor(points: Point[], closed: boolean, smooth: boolean) {
  if (points.length < 2) return ''
  const f = (n: number) => Math.round(n * 10) / 10
  if (!smooth || points.length < 3) {
    return `M${points.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L')}${closed ? ' Z' : ''}`
  }
  const p = (i: number) => (closed ? points[(i + points.length) % points.length] : points[Math.max(0, Math.min(points.length - 1, i))])
  let d = `M${f(points[0][0])} ${f(points[0][1])}`
  const n = closed ? points.length : points.length - 1
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [p(i - 1), p(i), p(i + 1), p(i + 2)]
    const c1: Point = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2: Point = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`
  }
  return d + (closed ? ' Z' : '')
}

/** Ramer–Douglas–Peucker: drops points that barely change the shape, so freehand strokes stay light. */
export function simplify(points: Point[], tolerance: number): Point[] {
  if (points.length < 3) return points
  const dist = ([x, y]: Point, [x1, y1]: Point, [x2, y2]: Point) => {
    const dx = x2 - x1
    const dy = y2 - y1
    const len = dx * dx + dy * dy
    const t = len ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len)) : 0
    return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))
  }
  let max = 0
  let idx = 0
  for (let i = 1; i < points.length - 1; i++) {
    const d = dist(points[i], points[0], points[points.length - 1])
    if (d > max) {
      max = d
      idx = i
    }
  }
  if (max <= tolerance) return [points[0], points[points.length - 1]]
  return [...simplify(points.slice(0, idx + 1), tolerance).slice(0, -1), ...simplify(points.slice(idx), tolerance)]
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

const DEFS = `<defs>
<pattern id="p-sea" width="80" height="40" patternUnits="userSpaceOnUse"><rect width="80" height="40" fill="#2d5f73"/><path d="M0 20 q20 -10 40 0 t40 0" fill="none" stroke="#fff" stroke-opacity=".08" stroke-width="2"/></pattern>
<pattern id="p-water" width="60" height="30" patternUnits="userSpaceOnUse"><rect width="60" height="30" fill="#3d7590"/><path d="M0 15 q15 -8 30 0 t30 0" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="2"/></pattern>
<pattern id="p-forest" width="36" height="36" patternUnits="userSpaceOnUse"><rect width="36" height="36" fill="#6f8f4e"/><path d="M9 4 l8 18 h-16 z M27 20 l8 16 h-16 z" fill="#3f6131"/><path d="M9 22 v4 M27 36 v0" stroke="#5a3d22" stroke-width="2"/></pattern>
<pattern id="p-mountains" width="70" height="56" patternUnits="userSpaceOnUse"><rect width="70" height="56" fill="#b5a78a"/><path d="M4 50 l22 -40 l22 40 z" fill="#8c8270" stroke="#5a5244" stroke-width="2.5"/><path d="M18 24 l8 -14 l8 14 z" fill="#f2efe6"/><path d="M40 54 l15 -26 l15 26 z" fill="#9a907c" stroke="#5a5244" stroke-width="2"/></pattern>
<pattern id="p-hills" width="60" height="40" patternUnits="userSpaceOnUse"><rect width="60" height="40" fill="#c2b27e"/><path d="M4 32 q14 -22 28 0 M30 18 q12 -16 24 0" fill="none" stroke="#7d6a40" stroke-width="2.5"/></pattern>
<pattern id="p-swamp" width="40" height="30" patternUnits="userSpaceOnUse"><rect width="40" height="30" fill="#7d8a55"/><path d="M6 24 h14 M10 24 v-8 M14 24 v-11 M18 24 v-7 M24 10 h12" stroke="#3f4a26" stroke-width="2" fill="none"/></pattern>
<pattern id="p-desert" width="30" height="30" patternUnits="userSpaceOnUse"><rect width="30" height="30" fill="#e3c98c"/><circle cx="6" cy="8" r="1.5" fill="#b0904f"/><circle cx="20" cy="22" r="1.5" fill="#b0904f"/><path d="M14 12 q5 -4 10 0" fill="none" stroke="#c4a764" stroke-width="1.5"/></pattern>
<pattern id="p-floor" width="70" height="70" patternUnits="userSpaceOnUse"><rect width="70" height="70" fill="#8d8a86"/><path d="M0 0 h70 v70 M35 0 v35 M0 35 h70 M17 35 v35 M52 35 v35" fill="none" stroke="#6c6965" stroke-width="2"/></pattern>
<pattern id="p-wood" width="70" height="28" patternUnits="userSpaceOnUse"><rect width="70" height="28" fill="#9c7146"/><path d="M0 14 h70 M0 28 h70 M30 0 v14 M55 14 v14" stroke="#6e4d2c" stroke-width="2"/></pattern>
${symbols()}
</defs>`

function symbols() {
  const s = (id: string, body: string) => `<symbol id="s-${id}" viewBox="-50 -50 100 100" overflow="visible">${body}</symbol>`
  const ink = 'stroke="#2a2116" stroke-width="4" stroke-linejoin="round"'
  const house = (x: number, y: number, w = 22, h = 18, roof = '#9c5b3c') =>
    `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" fill="#e8dcb8" ${ink}/><path d="M${x - w / 2 - 4} ${y - h / 2} L${x} ${y - h / 2 - 14} L${x + w / 2 + 4} ${y - h / 2} Z" fill="${roof}" ${ink}/>`
  return [
    s('city', `<circle r="44" fill="#e8dcb8" fill-opacity=".6" ${ink}/>${house(-16, 4)}${house(16, 8)}${house(0, -14, 26, 20, '#7a3b2e')}${house(4, 26, 18, 14)}`),
    s('town', `${house(-14, 8)}${house(14, 10)}${house(0, -10, 24, 18, '#7a3b2e')}`),
    s('village', `${house(-10, 6, 20, 16)}${house(12, 10, 18, 14)}`),
    s('castle', `<path d="M-34 36 V-14 h10 v-10 h10 v10 h8 V-30 h12 v16 h8 v-10 h10 v10 h10 V36 Z" fill="#b8b2a5" ${ink}/><path d="M-6 36 v-18 a6 6 0 0 1 12 0 v18" fill="#2a2116"/><path d="M0 -30 v-16 l14 6 l-14 6" fill="#8b2f3c" ${ink}/>`),
    s('tower', `<path d="M-14 38 V-20 h-4 v-12 h8 v6 h6 v-6 h8 v6 h6 v-6 h8 v12 h-4 V38 Z" fill="#b8b2a5" ${ink}/><rect x="-4" y="-8" width="8" height="12" fill="#2a2116"/>`),
    s('ruins', `<path d="M-34 36 V-6 h10 v14 h8 V-20 h10 v56 Z" fill="#b8b2a5" ${ink}/><path d="M10 36 V4 h8 v-12 h10 v44 Z" fill="#a39d90" ${ink}/><path d="M-40 36 h80" ${ink}/>`),
    s('temple', `<path d="M-36 -10 L0 -36 L36 -10 Z" fill="#d9d2bf" ${ink}/><rect x="-30" y="-10" width="60" height="6" fill="#d9d2bf" ${ink}/>${[-22, -8, 8, 22].map((x) => `<rect x="${x - 3}" y="-4" width="6" height="34" fill="#e8e2d0" ${ink}/>`).join('')}<rect x="-36" y="30" width="72" height="8" fill="#d9d2bf" ${ink}/>`),
    s('inn', `${house(0, 6, 40, 28, '#7a3b2e')}<rect x="20" y="-26" width="18" height="14" fill="#e0b354" ${ink}/><path d="M20 -26 v-8" ${ink}/>`),
    s('cave', `<path d="M-40 34 Q-36 -30 0 -34 Q36 -30 40 34 Z" fill="#8c8270" ${ink}/><path d="M-18 34 Q-16 -6 0 -8 Q16 -6 18 34 Z" fill="#1b1714"/>`),
    s('dungeon', `<rect x="-30" y="-30" width="60" height="64" rx="4" fill="#6c6965" ${ink}/><path d="M-16 34 V-4 a16 16 0 0 1 32 0 V34 Z" fill="#1b1714"/><path d="M-8 34 V-2 M0 34 V-6 M8 34 V-2" stroke="#6c6965" stroke-width="3"/>`),
    s('camp', `<path d="M-34 30 L0 -30 L34 30 Z" fill="#c9a86a" ${ink}/><path d="M0 -30 L-10 30 M0 -30 L10 30" ${ink}/><path d="M-6 30 L0 8 L6 30 Z" fill="#2a2116"/>`),
    s('ship', `<path d="M-38 10 H38 L26 30 H-26 Z" fill="#7a5a33" ${ink}/><path d="M0 10 V-38" ${ink}/><path d="M2 -34 L28 2 H2 Z" fill="#f2efe6" ${ink}/><path d="M-2 -28 L-24 2 H-2 Z" fill="#f2efe6" ${ink}/>`),
    s('tree', `<path d="M0 -40 L24 10 H-24 Z" fill="#3f6131" ${ink}/><path d="M0 -14 L28 30 H-28 Z" fill="#4c7a3a" ${ink}/><rect x="-5" y="30" width="10" height="12" fill="#5a3d22"/>`),
    s('peak', `<path d="M-44 36 L-6 -36 L32 36 Z" fill="#8c8270" ${ink}/><path d="M-18 -12 L-6 -36 L6 -12 L0 -16 L-6 -10 Z" fill="#f2efe6"/><path d="M10 36 L28 2 L46 36 Z" fill="#9a907c" ${ink}/>`),
    s('door', `<rect x="-24" y="-10" width="48" height="20" fill="#9c7146" ${ink}/><path d="M0 -10 v20" ${ink}/>`),
    s('chest', `<rect x="-26" y="-12" width="52" height="30" rx="3" fill="#9c7146" ${ink}/><path d="M-26 -2 H26" ${ink}/><rect x="-5" y="-6" width="10" height="10" fill="#e0b354" ${ink}/>`),
    s('stairs', `<rect x="-30" y="-30" width="60" height="60" fill="#b8b2a5" ${ink}/>${[-18, -6, 6, 18].map((y) => `<path d="M-30 ${y} H30" ${ink}/>`).join('')}`),
    s('skull', `<path d="M-26 -4 a26 26 0 0 1 52 0 v14 h-10 v12 h-32 v-12 h-10 Z" fill="#f2efe6" ${ink}/><circle cx="-10" cy="0" r="7" fill="#2a2116"/><circle cx="10" cy="0" r="7" fill="#2a2116"/>`),
    s('star', `<circle r="34" fill="#e0b354" fill-opacity=".25"/><path d="M0 -30 L8 -8 L30 -8 L12 6 L18 28 L0 14 L-18 28 L-12 6 L-30 -8 L-8 -8 Z" fill="#e0b354" ${ink}/>`),
    s('compass', `<circle r="40" fill="none" stroke="#2a2116" stroke-width="3"/><path d="M0 -48 L9 0 L0 48 L-9 0 Z" fill="#2a2116"/><path d="M-48 0 L0 -7 L48 0 L0 7 Z" fill="#7a6a50"/><text y="-54" text-anchor="middle" font-family="Georgia, serif" font-size="20" fill="#2a2116">N</text>`),
  ].join('')
}

/** One shape as SVG markup. `data-id` lets the editor tell which shape was clicked. */
export function shapeSvg(sh: Shape) {
  const id = `data-id="${sh.id}"`
  switch (sh.kind) {
    case 'area': {
      const t = TERRAINS[sh.terrain]
      const d = pathFor(sh.points, true, sh.smooth)
      const shore = sh.terrain === 'water' || sh.terrain === 'floor' || sh.terrain === 'wood' ? '' : `<path d="${d}" fill="none" stroke="#e8f1f3" stroke-opacity=".35" stroke-width="16" stroke-linejoin="round"/>`
      const edgeWidth = sh.terrain === 'floor' || sh.terrain === 'wood' ? 10 : 3
      return `<g ${id}>${shore}<path d="${d}" fill="${t.fill}" stroke="${t.edge}" stroke-width="${edgeWidth}" stroke-linejoin="round"/></g>`
    }
    case 'line': {
      const l = LINE_STYLES[sh.style]
      const d = pathFor(sh.points, false, sh.smooth)
      // A wide invisible stroke makes thin lines easy to click in the editor.
      return `<g ${id}><path d="${d}" fill="none" stroke="transparent" stroke-width="${l.width + 16}"/><path d="${d}" fill="none" stroke="${l.color}" stroke-width="${l.width}" stroke-linecap="round" stroke-linejoin="round"${l.dash ? ` stroke-dasharray="${l.dash}"` : ''}/></g>`
    }
    case 'stamp':
      return `<use ${id} href="#s-${sh.stamp}" x="${sh.at[0] - sh.size / 2}" y="${sh.at[1] - sh.size / 2}" width="${sh.size}" height="${sh.size}"/>`
    case 'label':
      return `<text ${id} x="${sh.at[0]}" y="${sh.at[1]}" text-anchor="middle" dominant-baseline="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${sh.size}" fill="${sh.color}"${sh.italic ? ' font-style="italic"' : ''} letter-spacing="${sh.size > 40 ? sh.size * 0.12 : 1}" stroke="#f3ead2" stroke-opacity=".7" stroke-width="${Math.max(2, sh.size / 10)}" paint-order="stroke">${esc(sh.text)}</text>`
  }
}

function gridSvg(d: Drawing, w: number, h: number) {
  if (d.grid === 'none') return ''
  const g = d.gridSize
  const color = d.background === 'stone' ? '#ffffff' : '#2a2116'
  if (d.grid === 'square')
    return `<g pointer-events="none"><defs><pattern id="p-grid" width="${g}" height="${g}" patternUnits="userSpaceOnUse"><path d="M${g} 0 V${g} H0" fill="none" stroke="${color}" stroke-opacity=".25" stroke-width="1.5"/></pattern></defs><rect width="${w}" height="${h}" fill="url(#p-grid)"/></g>`
  // Flat-topped hexes.
  const r = g / 2
  const hw = r * 1.5
  const hh = r * Math.sqrt(3)
  const hex = (cx: number, cy: number) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i
      return `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`
    }).join(' L')
  let path = ''
  for (let col = 0; col * hw < w + r; col++)
    for (let row = 0; row * hh < h + hh; row++) path += `M${hex(col * hw, row * hh + (col % 2 ? hh / 2 : 0))} Z`
  return `<path d="${path}" fill="none" stroke="${color}" stroke-opacity=".25" stroke-width="1.5" pointer-events="none"/>`
}

/** Shapes drawn in a sensible order: terrain, then lines, then stamps, then labels on top. */
const LAYER: Record<Shape['kind'], number> = { area: 0, line: 1, stamp: 2, label: 3 }
export const ordered = (shapes: Shape[]) =>
  shapes.map((s, i) => [s, i] as const).sort((a, b) => LAYER[a[0].kind] - LAYER[b[0].kind] || a[1] - b[1]).map(([s]) => s)

export function drawingInnerSvg(d: Drawing, w: number, h: number) {
  const shapes = ordered(d.shapes)
  return `${DEFS}<rect width="${w}" height="${h}" fill="${BACKGROUNDS[d.background].fill}"/>${shapes.map(shapeSvg).join('')}${gridSvg(d, w, h)}`
}

export function renderDrawing(d: Drawing, w: number, h: number) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${drawingInnerSvg(d, w, h)}</svg>`
}
