/* Shared helpers for the Warded Atlas asset recipes. Asset files must not edit this file. */
window.Atlas = window.Atlas || {}
;(function (A) {
  A.assets = A.assets || {}
  /** Register an asset. def = { label, category, kind: 'recipe' | 'fixed', view: 'side' | 'top' | 'furniture', draw(ctx, x, y, s, r, style, variant) } */
  A.register = (name, def) => { A.assets[name] = def }

  A.rng = (a) => function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
  A.R = (r, a, b) => a + r() * (b - a)
  A.pick = (r, arr) => arr[Math.floor(r() * arr.length)]

  /* Biome tints, used only in colour mode (ink lines stay the same in both modes). */
  A.BIOMES = {
    temperate: { label: 'Temperate', land: '#e6d6a8', grass: '#b7b77a', forest: '#7f8f55', forestDark: '#55653a', rock: '#a89a80', snow: '#f4f1e8', water: '#8fae9c', roof: '#a2523a', sand: '#e3cf98' },
    autumn: { label: 'Autumn', land: '#e4cf9c', grass: '#c2a868', forest: '#b07a3c', forestDark: '#7f4f28', rock: '#a69782', snow: '#f4f1e8', water: '#8aa69a', roof: '#8e4630', sand: '#e0c890' },
    winter: { label: 'Winter', land: '#ece9e0', grass: '#d6d8d0', forest: '#7d9088', forestDark: '#4f6660', rock: '#9fa4a6', snow: '#fbfbf8', water: '#a3bcc4', roof: '#7a5a4e', sand: '#e2ddd0' },
    desert: { label: 'Desert', land: '#ead09a', grass: '#d2b878', forest: '#98955a', forestDark: '#6e6c3c', rock: '#c09468', snow: '#f4ece0', water: '#88b0a8', roof: '#b0643c', sand: '#efd8a0' },
    swamp: { label: 'Swamp', land: '#d2c896', grass: '#9a9a62', forest: '#6c7448', forestDark: '#45502e', rock: '#8e8a76', snow: '#eeeee4', water: '#8a9a7c', roof: '#7a5236', sand: '#cfc290' },
    tropical: { label: 'Tropical', land: '#e2d8a0', grass: '#a6bc6a', forest: '#5f9a50', forestDark: '#3a6c38', rock: '#a29a86', snow: '#f4f1e8', water: '#7fb6ae', roof: '#b0503c', sand: '#efdca6' },
  }
  /* style = { mode: 'ink' | 'colour', ink, paper, tint (a BIOMES entry), shadows: bool, line: 1 (line weight multiplier) } */
  A.style = (mode, biome = 'temperate', shadows = true) => ({
    mode, shadows, line: 1,
    ink: mode === 'ink' ? '#231a10' : '#2e2115',
    paper: mode === 'ink' ? '#f3ead2' : '#efe1be',
    tint: A.BIOMES[biome],
  })

  /** Wobble a polyline: inserts points every `step` px and nudges them sideways by up to `amp`. */
  A.wobble = (pts, r, amp = 0.8, step = 6) => {
    const out = []
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(d / step))
      const nx = -(y1 - y0) / (d || 1), ny = (x1 - x0) / (d || 1)
      for (let k = 0; k < n; k++) { const t = k / n, j = k === 0 ? 0 : A.R(r, -amp, amp); out.push([x0 + (x1 - x0) * t + nx * j, y0 + (y1 - y0) * t + ny * j]) }
    }
    out.push(pts[pts.length - 1])
    return out
  }
  /** Hand-inked stroke: a filled ribbon whose width swells in the middle and tapers at the ends (taper 0..1). */
  A.inkStroke = (ctx, pts, r, { w = 1.4, wob = 0.6, taper = 0.7, color } = {}) => {
    if (pts.length < 2) return
    const p = A.wobble(pts, r, wob)
    let total = 0; const acc = [0]
    for (let i = 1; i < p.length; i++) { total += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); acc.push(total) }
    const L = [], Rr = []
    for (let i = 0; i < p.length; i++) {
      const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)], d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
      const nx = -(b[1] - a[1]) / d, ny = (b[0] - a[0]) / d, t = total ? acc[i] / total : 0
      const hw = (w / 2) * (1 - taper + taper * Math.sin(Math.PI * t))
      L.push([p[i][0] + nx * hw, p[i][1] + ny * hw]); Rr.push([p[i][0] - nx * hw, p[i][1] - ny * hw])
    }
    ctx.beginPath(); L.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); for (let i = Rr.length - 1; i >= 0; i--) ctx.lineTo(Rr[i][0], Rr[i][1]); ctx.closePath()
    ctx.fillStyle = color || ctx.strokeStyle; ctx.fill()
  }
  /** Path helper: trace a closed polygon. */
  A.poly = (ctx, pts) => { ctx.beginPath(); pts.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath() }
  /** Parallel hatching inside a clip path. clip() must build a path; lines run at `angle` radians, `gap` px apart. */
  A.hatch = (ctx, clip, box, r, { angle = 1.0, gap = 3, w = 0.8, wob = 0.4, color, jitter = 0.3 } = {}) => {
    ctx.save(); clip(); ctx.clip()
    const [x0, y0, x1, y1] = box, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, len = Math.hypot(x1 - x0, y1 - y0)
    const dx = Math.cos(angle), dy = Math.sin(angle)
    for (let t = -len / 2; t < len / 2; t += gap * (1 + A.R(r, -jitter, jitter))) {
      const ox = cx - dy * t, oy = cy + dx * t
      A.inkStroke(ctx, [[ox - dx * len / 2, oy - dy * len / 2], [ox + dx * len / 2, oy + dy * len / 2]], r, { w, wob, taper: 0.2, color })
    }
    ctx.restore()
  }
  /** Stipple dots inside a clip path. */
  A.stipple = (ctx, clip, box, r, { n = 60, size = 0.8, color } = {}) => {
    ctx.save(); clip(); ctx.clip(); ctx.fillStyle = color
    const [x0, y0, x1, y1] = box
    for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.arc(A.R(r, x0, x1), A.R(r, y0, y1), size * A.R(r, .6, 1.3), 0, 6.283); ctx.fill() }
    ctx.restore()
  }
  /** Watercolour-like wash for colour mode: translucent fill, laid twice with a slight offset, and a darker pooled edge. */
  A.wash = (ctx, path, color, r, alpha = 0.55) => {
    ctx.save(); ctx.globalAlpha = alpha * 0.6; ctx.fillStyle = color
    path(); ctx.fill()
    ctx.translate(A.R(r, -0.8, 0.8), A.R(r, -0.8, 0.8)); path(); ctx.fill()
    ctx.globalAlpha = alpha * 0.35; ctx.strokeStyle = color; ctx.lineWidth = 1.6; path(); ctx.stroke()
    ctx.restore()
  }
  /** Draw lower things in front: sort [{y, draw}] and run. */
  A.drawSorted = (items) => items.sort((a, b) => a.y - b.y).forEach((i) => i.draw())
  /** Rejection-sample up to n points; inside(r) returns [x, y] or null. */
  A.scatter = (r, n, inside, minD) => {
    const out = []
    for (let k = 0; out.length < n && k < n * 50; k++) { const p = inside(r); if (p && out.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) > minD)) out.push(p) }
    return out
  }
})(window.Atlas)
