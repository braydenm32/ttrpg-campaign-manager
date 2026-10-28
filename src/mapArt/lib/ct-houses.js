/* Town-plan houses, seen from directly above (view 'top'), for town and city maps: blocks of attached houses, manor houses,
   guildhalls and market squares. The helper layer is the one bm-buildings.js uses, trimmed, so the pieces match the battle-map
   buildings stroke for stroke; the difference is scale. A town map draws a foot at about 1.4 px, so a block of houses is only
   140 px across and a single house 35 px: at small sizes the roofs are clean shapes with a ridge line, a hatch tone on the
   planes that face away from the light and a crisp outline; tiles, thatch, chimneys and yard details only come in as the
   piece grows. Every piece is drawn in a design space where the LONG side is 100 units (scaled by s/100), centred on (x, y).
   Light comes from the upper left: roof planes sloping down to the lower right are shaded, and with st.shadows a cast
   shadow falls down and to the right. All pieces are fixed, with 8 hand-designed versions; r() only adds hand-jitter. */
;(function (A) {
  'use strict'
  const PI = Math.PI, TAU = PI * 2, sin = Math.sin, cos = Math.cos, hyp = Math.hypot
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
  let LX = 0.62, LY = 0.78 // direction the shade and the cast shadows run (down and to the right); turned() rotates it
  let ctx, r, st, INK, PAPER, COL, T, SH, u, det, LW, ROW, TW, THA, EFF
  let KOV = {} // per-variant colour overrides by roof kind
  // Bird's-eye look: UP is the way up the screen in the piece's own (turned) frame; buildings stand up along it, BH times as tall
  let UP = null, BH = 1
  const rr = (a, b) => a + r() * (b - a)
  const jt = (a) => (r() - 0.5) * 2 * a
  const K = (px) => px / u // screen pixels to design units
  const W = (b) => (b * LW) / u // pen weight (about b pixels at line weight 1) in design units

  /** fs = how big the piece's typical roof is next to the whole piece: detail follows that, not the overall size. */
  function open(c, x, y, s, rg, style, fs) {
    ctx = c; r = rg; st = style; INK = st.ink; PAPER = st.paper; COL = st.mode === 'colour'; T = st.tint; SH = !!st.shadows
    u = s / 100; KOV = {}; LX = A.light ? A.light[0] : 0.62; LY = A.light ? A.light[1] : 0.78
    UP = A.bird ? A.up || [0, -1] : null; BH = A.bird || 1
    // seen from the side, light from the upper left would leave every wall that faces you in shade: it comes from the left instead
    if (UP) { const L = A.sideLight || [0.95, 0.3]; LX = L[0]; LY = L[1] }
    EFF = s * (fs || 1)
    det = EFF >= 210 ? 3 : EFF >= 120 ? 2 : EFF >= 52 ? 1 : 0
    LW = st.line * clamp(0.6 + EFF / 300, 0.75, 1.6)
    const grow = Math.max(0, EFF - 60)
    ROW = K(2.5 + grow * 0.017); TW = ROW * 1.5; THA = K(2.0 + grow * 0.006)
    ctx.save(); ctx.translate(x, y); ctx.scale(u, u); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.setLineDash([])
  }

  /* ---------- colour ---------- */
  const hx = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]
  const mix = (a, b, t) => { const p = hx(a), q = hx(b); let s = '#'; for (let i = 0; i < 3; i++) s += Math.round(p[i] + (q[i] - p[i]) * t).toString(16).padStart(2, '0'); return s }
  const darker = (c, t) => mix(c, '#2b1f12', t)
  const lighter = (c, t) => mix(c, '#fbf3dc', t)
  const WOOD = () => mix(T.land, '#5f4026', 0.6)
  const STONE = () => mix(T.rock, '#8f9094', 0.42)
  const PAVE = () => mix(mix(T.sand, T.rock, 0.4), PAPER, 0.1)
  const GREEN = () => mix(T.forest, T.forestDark, 0.25)
  const kindCol = (k) => KOV[k] ? KOV[k] : k === 'tile' ? T.roof : k === 'tile2' ? mix(T.roof, '#6e4a3a', 0.4) : k === 'tile3' ? mix(T.roof, '#b8744a', 0.4)
    : k === 'thatch' ? mix(T.sand, '#7b6330', 0.42) : k === 'thatch2' ? mix(mix(T.sand, '#7b6330', 0.42), '#6a5f50', 0.35)
    : k === 'slate' ? mix(T.rock, '#5a5f68', 0.34) : k === 'slate2' ? mix(T.rock, '#4f5a66', 0.5)
    : k === 'plank' ? WOOD() : k === 'shingle' ? mix(T.rock, '#6d4e34', 0.5) : k === 'stone' ? T.rock : T.sand
  const texOf = (k) => (k || 'tile').replace(/\d+$/, '')

  /* ---------- paths and paint ---------- */
  function path(pts) { ctx.beginPath(); for (let i = 0; i < pts.length; i++) i ? ctx.lineTo(pts[i][0], pts[i][1]) : ctx.moveTo(pts[i][0], pts[i][1]); ctx.closePath() }
  function fillPoly(pts, col) { path(pts); ctx.fillStyle = col; ctx.fill() }
  const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
  const orient = (pts) => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1] } return a >= 0 ? 1 : -1 }
  const bbox = (pts) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const p of pts) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1] } return [x0, y0, x1, y1] }
  /** Translucent paint laid twice with a slight offset and a darker pooled edge (colour mode). */
  function wash(pts, col, a) {
    a = a == null ? 0.55 : a
    ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = col
    ctx.globalAlpha = a * 0.62; path(pts); ctx.fill()
    ctx.translate(jt(0.5 / u), jt(0.5 / u)); path(pts); ctx.fill()
    ctx.globalAlpha = a * 0.35; ctx.lineWidth = 1.2 / u; ctx.stroke()
    ctx.restore()
  }
  /** Opaque base under a footprint, then (colour mode) a hand-painted wash with a few uneven blooms. shade 0..1 darkens. */
  function paint(pts, col, shade, a) {
    if (!COL) { fillPoly(pts, PAPER); return }
    const c = darker(col, (shade || 0) * 0.3 + rr(0, 0.04))
    fillPoly(pts, mix(c, PAPER, 0.42))
    wash(pts, c, a == null ? 0.7 : a)
    if (det >= 1) bloom(pts, c)
  }
  /** Uneven pigment: a few soft darker and lighter patches inside the shape, as a wash dries. */
  function bloom(pts, c) {
    const [x0, y0, x1, y1] = bbox(pts), area = (x1 - x0) * (y1 - y0)
    if (area < 90) return
    const n = Math.min(5, 1 + Math.floor(area / 500))
    ctx.save(); path(pts); ctx.clip()
    for (let i = 0; i < n; i++) {
      const rad = Math.min(x1 - x0, y1 - y0) * rr(0.25, 0.6) + 2, cx = rr(x0, x1), cy = rr(y0, y1), dark = r() < 0.6
      ctx.globalAlpha = rr(0.05, 0.11); ctx.fillStyle = dark ? darker(c, 0.35) : lighter(c, 0.45)
      path(oval(cx, cy, rad * rr(0.8, 1.5), rad * rr(0.6, 1), 10, 0.12)); ctx.fill()
    }
    ctx.restore()
  }
  /** Soft bands of shade on the lower right of a round shape (colour mode). */
  function shadeBands(pts, cx, cy, rad, n) {
    if (!COL) return
    ctx.save(); path(pts); ctx.clip()
    const px = -LY, py = LX, big = rad * 3
    for (let i = 0; i < (n || 3); i++) {
      const c = -0.15 + i * 0.38, ox = cx + LX * rad * c, oy = cy + LY * rad * c
      ctx.beginPath(); ctx.moveTo(ox + px * big, oy + py * big); ctx.lineTo(ox - px * big, oy - py * big)
      ctx.lineTo(ox - px * big + LX * big, oy - py * big + LY * big); ctx.lineTo(ox + px * big + LX * big, oy + py * big + LY * big); ctx.closePath()
      ctx.fillStyle = 'rgba(48,34,18,.11)'; ctx.fill()
    }
    ctx.restore()
  }

  /* ---------- pen work ---------- */
  const SG = []
  function sg(x0, y0, x1, y1) { SG.push(x0, y0, x1, y1) }
  function flush(w, col) {
    if (!SG.length) return
    ctx.beginPath(); for (let i = 0; i < SG.length; i += 4) { ctx.moveTo(SG[i], SG[i + 1]); ctx.lineTo(SG[i + 2], SG[i + 3]) }
    ctx.lineWidth = W(w || 0.6); ctx.strokeStyle = col || INK; ctx.stroke(); SG.length = 0
  }
  /** A single hand-inked tapered stroke along a polyline. */
  function pl(pts, w, o) {
    o = o || {}
    A.inkStroke(ctx, pts, r, { w: W(w || 1.2), wob: W(o.wob == null ? 0.28 : o.wob), taper: o.taper == null ? 0.55 : o.taper, color: o.color || INK })
  }
  const ln = (a, b, w, o) => pl([a, b], w, o)
  /** Closed outline whose weight swells on edges that face down-right (the shade side) and eases off facing the light. */
  function outline(pts, w, o) {
    o = o || {}
    const n = pts.length, sgn = orient(pts)
    if (det < 2) {
      const hv = [], lt = []
      for (let i = 0; i < n; i++) {
        const p = pts[i], q = pts[(i + 1) % n], dx = q[0] - p[0], dy = q[1] - p[1], L = hyp(dx, dy) || 1
        ;((((dy / L) * sgn) * LX + ((-dx / L) * sgn) * LY) > 0.25 && !o.flat ? hv : lt).push(p, q)
      }
      for (const [arr, k] of [[lt, 0.82], [hv, 1.22]]) {
        if (!arr.length) continue
        ctx.beginPath(); for (let i = 0; i < arr.length; i += 2) { ctx.moveTo(arr[i][0], arr[i][1]); ctx.lineTo(arr[i + 1][0], arr[i + 1][1]) }
        ctx.lineWidth = W(w * (o.flat ? 1 : k)); ctx.strokeStyle = INK; ctx.stroke()
      }
      return
    }
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n], dx = q[0] - p[0], dy = q[1] - p[1], L = hyp(dx, dy)
      if (L < 0.05) continue
      const ux = dx / L, uy = dy / L, nx = uy * sgn, ny = -ux * sgn
      const f = clamp(nx * LX + ny * LY, -1, 1), ww = w * (o.flat ? 1 : 0.86 + 0.46 * f)
      const e = o.noext ? 0 : W(0.45) * rr(0.3, 1.4)
      A.inkStroke(ctx, [[p[0] - ux * e, p[1] - uy * e], [q[0] + ux * e, q[1] + uy * e]], r, { w: W(ww), wob: W(o.wob == null ? 0.5 : o.wob), taper: o.taper == null ? 0.38 : o.taper, color: INK })
    }
  }
  /** Smooth closed ink loop (round things) with the same lighting-weighted weight. */
  function loop(pts, w, o) {
    o = o || {}
    const n = pts.length, sgn = orient(pts), outer = [], inner = []
    if (det < 2) {
      ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath()
      ctx.lineWidth = W(w * (o.flat ? 1 : 0.85)); ctx.strokeStyle = INK; ctx.stroke()
      if (!o.flat) {
        ctx.beginPath(); let on = false
        for (let i = 0; i <= n; i++) {
          const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n], c = pts[i % n], tx = b[0] - a[0], ty = b[1] - a[1], L = hyp(tx, ty) || 1
          const f = ((ty / L) * sgn) * LX + ((-tx / L) * sgn) * LY
          if (f > 0.35) { on ? ctx.lineTo(c[0], c[1]) : ctx.moveTo(c[0], c[1]); on = true } else on = false
        }
        ctx.lineWidth = W(w * 1.3); ctx.stroke()
      }
      return
    }
    for (let i = 0; i < n; i++) {
      const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n], tx = b[0] - a[0], ty = b[1] - a[1], L = hyp(tx, ty) || 1
      const nx = (ty / L) * sgn, ny = (-tx / L) * sgn, f = clamp(nx * LX + ny * LY, -1, 1)
      const hw = (W(w) / 2) * (o.flat ? 1 : 0.86 + 0.46 * f) * (1 + jt(0.1))
      outer.push([pts[i][0] + nx * hw, pts[i][1] + ny * hw]); inner.push([pts[i][0] - nx * hw, pts[i][1] - ny * hw])
    }
    ctx.beginPath(); outer.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath()
    inner.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath()
    ctx.fillStyle = INK; ctx.fill('evenodd')
  }
  /** Points of a slightly irregular ellipse. */
  function oval(cx, cy, rx, ry, n, wob, a0, a1) {
    a0 = a0 == null ? 0 : a0; a1 = a1 == null ? TAU : a1
    n = n || clamp(Math.round(Math.max(rx, ry) * u * 0.8), 12, 80)
    const full = a1 - a0 >= TAU - 0.001, out = [], ph = r() * 6, w = wob == null ? 0.006 : wob
    const m = full ? n : n + 1
    for (let i = 0; i < m; i++) { const a = a0 + (a1 - a0) * i / n, k = 1 + w * sin(a * 3 + ph) + jt(w * 0.5); out.push([cx + cos(a) * rx * k, cy + sin(a) * ry * k]) }
    return out
  }
  /** An ellipse turned by ang. */
  function ovalR(cx, cy, rx, ry, ang, n) {
    const out = [], c = cos(ang), s = sin(ang); n = n || 10
    for (let i = 0; i < n; i++) { const a = (TAU * i) / n, x = cos(a) * rx * (1 + jt(0.03)), y = sin(a) * ry * (1 + jt(0.03)); out.push([cx + x * c - y * s, cy + x * s + y * c]) }
    return out
  }
  /** Lumpy round canopy. */
  function blob(cx, cy, R, n) {
    n = n || clamp(Math.round(R * u * 1.2), 14, 40)
    const out = [], ph = r() * 6, ph2 = r() * 6
    for (let i = 0; i < n; i++) { const a = (TAU * i) / n, k = 1 + 0.07 * sin(a * 5 + ph) + 0.05 * sin(a * 9 + ph2) + jt(0.015); out.push([cx + cos(a) * R * k, cy + sin(a) * R * 0.94 * k]) }
    return out
  }
  function octagon(cx, cy, R) { const o = []; for (let i = 0; i < 8; i++) { const a = PI / 8 + (TAU * i) / 8; o.push([cx + cos(a) * R, cy + sin(a) * R]) } return o }

  /** Hatching inside a polygon: lines at `ang`, `gap` apart, broken here and there like pen work. */
  function hatchIn(pts, ang, gap, w, o) {
    o = o || {}
    const [x0, y0, x1, y1] = bbox(pts)
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, L = hyp(x1 - x0, y1 - y0), dx = cos(ang), dy = sin(ang), nx = -dy, ny = dx
    ctx.save(); path(pts); ctx.clip()
    const g = Math.max(gap, K(2.1))
    for (let t = -L / 2; t < L / 2; t += g * rr(0.82, 1.22)) {
      const ox = cx + nx * t, oy = cy + ny * t
      let s0 = -L / 2 - rr(0, 3)
      while (s0 < L / 2) {
        const e = Math.min(s0 + rr(L * 0.25, L), L / 2)
        if (r() < (o.keep == null ? 0.96 : o.keep)) sg(ox + dx * s0, oy + dy * s0, ox + dx * e + nx * jt(0.25), oy + dy * e + ny * jt(0.25))
        s0 = e + rr(0.4, 1.8)
      }
    }
    flush(w || 0.5, o.color)
    ctx.restore()
  }
  function stippleIn(pts, dens, size, col) {
    const [x0, y0, x1, y1] = bbox(pts)
    const n = Math.min(900, Math.round(((x1 - x0) * (y1 - y0) * dens) / 100))
    ctx.save(); path(pts); ctx.clip(); ctx.beginPath()
    const rad = Math.max(K(0.55), size || 0.5)
    for (let i = 0; i < n; i++) { const x = rr(x0, x1), y = rr(y0, y1); ctx.moveTo(x + rad, y); ctx.arc(x, y, rad * rr(0.6, 1.3), 0, TAU) }
    ctx.fillStyle = col || INK; ctx.fill(); ctx.restore()
  }
  /** Tiny dots anywhere (no clip). */
  function dots(n, x0, y0, x1, y1, size) {
    ctx.beginPath(); const rad = Math.max(K(0.5), size || 0.5)
    for (let i = 0; i < n; i++) { const x = rr(x0, x1), y = rr(y0, y1); ctx.moveTo(x + rad, y); ctx.arc(x, y, rad * rr(0.6, 1.3), 0, TAU) }
    ctx.fillStyle = INK; ctx.fill()
  }
  const tuft = (x, y, s) => { s = s || 1; sg(x - 0.7 * s, y, x - 1.5 * s, y - 2.1 * s); sg(x, y, x + 0.1 * s, y - 2.7 * s); sg(x + 0.7 * s, y, x + 1.6 * s, y - 2 * s) }
  /** Run fn with the drawing turned by ang about (x, y); the light is turned with it so shade and shadows still fall the right way. */
  function turned(x, y, ang, fn) {
    const lx = LX, ly = LY, up = UP, c = cos(ang || 0), s = sin(ang || 0)
    ctx.save(); ctx.translate(x, y); if (ang) ctx.rotate(ang)
    LX = c * lx + s * ly; LY = -s * lx + c * ly
    if (up) UP = [c * up[0] + s * up[1], -s * up[0] + c * up[1]]
    try { fn() } finally { ctx.restore(); LX = lx; LY = ly; UP = up }
  }
  /** Run fn clipped to everything except `hole`. */
  function clipOut(hole, fn) {
    ctx.save(); ctx.beginPath(); ctx.rect(-1e4, -1e4, 2e4, 2e4); for (let i = 0; i < hole.length; i++) i ? ctx.lineTo(hole[i][0], hole[i][1]) : ctx.moveTo(hole[i][0], hole[i][1]); ctx.closePath(); ctx.clip('evenodd')
    try { fn() } finally { ctx.restore() }
  }

  /* ---------- cast shadow ---------- */
  /** Shadow of one or more footprints thrown down-right by `len` units: hatching in ink, a translucent wash in colour. */
  function castShadow(polys, len) {
    if (!SH || len <= 0) return
    const dx = len * LX, dy = len * LY, n = Math.max(2, Math.min(7, Math.ceil(len / 2.5)))
    ctx.save(); ctx.beginPath()
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
    for (const pl0 of polys) {
      const P = orient(pl0) > 0 ? pl0 : pl0.slice().reverse()
      for (let k = 0; k <= n; k++) {
        const t = k / n
        P.forEach((p, i) => {
          const x = p[0] + dx * t, y = p[1] + dy * t
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
        })
        ctx.closePath()
      }
    }
    if (COL) { ctx.fillStyle = 'rgba(40,30,15,.25)'; ctx.fill() } else {
      ctx.clip()
      const nl = hyp(dx, dy), nx = dx / nl, ny = dy / nl, vx = -ny, vy = nx
      let tmin = 1e9, tmax = -1e9, vmin = 1e9, vmax = -1e9
      for (const [px, py] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) { const t = px * nx + py * ny, v = px * vx + py * vy; if (t < tmin) tmin = t; if (t > tmax) tmax = t; if (v < vmin) vmin = v; if (v > vmax) vmax = v }
      const g = K(2.7)
      for (let t = tmin; t < tmax; t += g * rr(0.8, 1.25)) {
        let v = vmin - rr(0, 4)
        while (v < vmax) {
          const e = Math.min(v + rr(10, 60), vmax)
          sg(t * nx + v * vx, t * ny + v * vy, (t + jt(0.7)) * nx + e * vx, (t + jt(0.7)) * ny + e * vy); v = e + rr(0.4, 1.6)
        }
      }
      flush(0.5)
    }
    ctx.restore()
  }

  /* ---------- roof planes ---------- */
  const shadeOf = (d) => clamp(0.5 + 0.55 * (d[0] * LX + d[1] * LY), 0, 1)
  /** A coordinate frame for a plane sloping down along unit vector d: a runs along the eave, b down the slope. */
  function frame(pts, d) {
    const e = [-d[1], d[0]]
    let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9
    for (const p of pts) { const a = p[0] * e[0] + p[1] * e[1], b = p[0] * d[0] + p[1] * d[1]; if (a < a0) a0 = a; if (a > a1) a1 = a; if (b < b0) b0 = b; if (b > b1) b1 = b }
    return { a0, a1, b0, b1, at: (a, b) => [a * e[0] + b * d[0], a * e[1] + b * d[1]] }
  }
  /** Courses of shingles / slates: rows parallel to the eave, with staggered joints and the odd weathered shingle. */
  function rowsTex(pts, d, o) {
    const F = frame(pts, d), at = F.at, sc = clamp((F.b1 - F.b0) / 30, 1, 1.8), g = (o.g || ROW) * sc, tw = (o.tw || TW) * Math.sqrt(sc), irr = o.irr == null ? 0.16 : o.irr
    ctx.save(); path(pts); ctx.clip()
    let i = 0
    for (let b = F.b1 - g * 0.4; b > F.b0 - g * 0.3; b -= g * (1 + jt(irr * 0.5)), i++) {
      let a = F.a0 - rr(0, 10)
      while (a < F.a1) {
        const e = Math.min(a + rr(12, 38), F.a1 + 3), m = (a + e) / 2, bw = jt(0.3), p = at(a, b + jt(0.2)), q = at(e, b + jt(0.2)), mm = at(m, b + bw)
        sg(p[0], p[1], mm[0], mm[1]); sg(mm[0], mm[1], q[0], q[1]); a = e + rr(0.3, 1.4)
      }
      if (o.joints !== false) {
        const off = (i % 2) * tw * 0.5 + jt(0.2), full = o.full, len = full ? 1.0 : 0.66
        for (let aa = F.a0 - tw + off; aa < F.a1 + tw; aa += tw * (o.irregular ? rr(0.55, 1.75) : rr(0.8, 1.2))) {
          if (r() < (full ? 0.93 : 0.78)) { const p = at(aa, b), q = at(aa + jt(0.3), b - g * rr(0.85, 1.08) * len); sg(p[0], p[1], q[0], q[1]) }
          else if (det >= 2 && r() < 0.35) { const p = at(aa + tw * 0.15, b - g * 0.15), q = at(aa + tw * 0.4, b - g * 0.8), p2 = at(aa + tw * 0.4, b - g * 0.15), q2 = at(aa + tw * 0.65, b - g * 0.8); sg(p[0], p[1], q[0], q[1]); sg(p2[0], p2[1], q2[0], q2[1]) }
        }
      }
    }
    flush(o.w || 0.62)
    ctx.restore()
  }
  /** Clay tiles: each row a chain of scallops, one per tile, with the joints running up between them. */
  function tileTex(pts, d, o) {
    const F = frame(pts, d), at = F.at, sc = clamp((F.b1 - F.b0) / 30, 1, 1.7), g = (o.g || ROW * 1.15) * sc, tw = (o.tw || TW * 0.85) * Math.sqrt(sc)
    ctx.save(); path(pts); ctx.clip(); ctx.beginPath()
    let i = 0
    for (let b = F.b1 - g * 0.15; b > F.b0 - g; b -= g * (1 + jt(0.04)), i++) {
      const off = (i % 2) * tw * 0.5 + jt(0.15)
      let a = F.a0 - tw + off, pen = false
      for (; a < F.a1 + tw; a += tw * rr(0.94, 1.06)) {
        const p = at(a, b + jt(0.1)), c = at(a + tw * 0.5, b + g * 0.85 + jt(0.15)), q = at(a + tw, b + jt(0.1))
        if (!pen) { ctx.moveTo(p[0], p[1]); pen = true }
        ctx.quadraticCurveTo(c[0], c[1], q[0], q[1])
        if (r() < 0.04) pen = false
        const j0 = at(a + tw, b), j1 = at(a + tw + jt(0.2), b - g * rr(0.8, 1.02))
        if (r() < 0.96) sg(j0[0], j0[1], j1[0], j1[1])
      }
    }
    ctx.lineWidth = W(o.w || 0.6); ctx.strokeStyle = INK; ctx.stroke()
    flush(o.w || 0.55)
    ctx.restore()
  }
  /** Boards running down the slope: butt joints staggered from board to board, grain and the odd darker board. */
  function plankTex(pts, d, o) {
    const F = frame(pts, d), at = F.at, pw = o.pw || Math.max(ROW * 1.75, 3.4)
    ctx.save(); path(pts); ctx.clip()
    for (let a = F.a0 + pw * 0.5; a < F.a1; a += pw * rr(0.94, 1.06)) {
      let b = F.b0 - rr(0, 4)
      while (b < F.b1) { const e = Math.min(b + rr(40, 90), F.b1 + 2), p = at(a + jt(0.12), b), q = at(a + jt(0.12), e); sg(p[0], p[1], q[0], q[1]); b = e + rr(0.2, 0.9) }
      for (let b2 = F.b0 + rr(4, 20); b2 < F.b1; b2 += rr(20, 38)) { const m = at(a - pw * 0.5, b2), n2 = at(a + pw * 0.5, b2); sg(m[0], m[1], n2[0], n2[1]) }
      if (det >= 3 && r() < 0.18) { const hg = Math.max(K(2.4), 1.4); for (let a2 = a - pw * 0.4; a2 < a + pw * 0.4; a2 += hg) { const p = at(a2, F.b0), q = at(a2 + jt(0.2), F.b1); sg(p[0], p[1], q[0], q[1]) } }
    }
    flush(o.w || 0.6)
    ctx.restore()
  }
  /** Thatch: many short overlapping strokes running down the slope, denser on the shaded side, with bundle lines across. */
  function thatchTex(pts, d, sh, o) {
    const F = frame(pts, d), at = F.at, dense = 0.55 + sh * 0.95, ga = THA / dense
    ctx.save(); path(pts); ctx.clip()
    for (let a = F.a0 - ga; a < F.a1 + ga; a += ga * rr(0.65, 1.45)) {
      let b = F.b0 - rr(0, 6)
      while (b < F.b1) {
        const L = rr(5, 13) * (o.len || 1), p = at(a, b), q = at(a + jt(0.7), b + L)
        sg(p[0], p[1], q[0], q[1]); b += L * rr(0.5, 0.95) + (r() < 0.14 ? rr(0.5, 2.5) : 0)
      }
    }
    flush(o.w || 0.5)
    for (let b = F.b1 - rr(6, 10); b > F.b0 + 4; b -= rr(9, 15)) {
      let a = F.a0 - 2
      while (a < F.a1) {
        const L = rr(7, 20), p = at(a, b + jt(0.5)), q = at(a + L, b + jt(0.5)), m = at(a + L / 2, b + jt(0.7))
        ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.quadraticCurveTo(m[0], m[1], q[0], q[1]); ctx.lineWidth = W(0.55); ctx.strokeStyle = INK; ctx.stroke()
        a += L + rr(0.6, 2.4)
      }
    }
    ctx.restore()
  }
  /** Slanted hatching on the shaded side of a textured roof plane (large sizes). */
  function slopeHatch(pts, d, sh, o) {
    if (sh < 0.58) return
    const F = frame(pts, d), at = F.at, hg = ROW * (sh > 0.8 ? 1.25 : 2.3) * ((o && o.hg) || 1), span = F.b1 - F.b0
    ctx.save(); path(pts); ctx.clip()
    for (let a = F.a0 - span * 0.4; a < F.a1; a += hg * rr(0.8, 1.25)) {
      const L = span * rr(0.28, 0.85) * (sh > 0.8 ? 1 : 0.7), p = at(a, F.b1 + 1), q = at(a + L * 0.42 + jt(0.3), F.b1 - L)
      sg(p[0], p[1], q[0], q[1])
    }
    flush(0.45)
    ctx.restore()
  }
  /** Small sizes: one even tone of pen hatching, running with the light, on a plane that faces away from it. */
  function shadeHatch(pts, d, sh, kind) {
    if (kind === 'thatch') { // thatch reads by its strokes even when small: sparse on the lit side, dense in the shade
      hatchIn(pts, Math.atan2(d[1], d[0]), K(sh > 0.58 ? 2.2 : 3.4), 0.42, { keep: sh > 0.58 ? 0.85 : 0.45 })
      return
    }
    if (sh < 0.58) return
    hatchIn(pts, 0.9, K(sh > 0.8 ? 2.4 : 3.6), 0.45, { keep: 0.92 })
  }
  /** One roof plane: opaque paint, texture by kind (or a hatch tone when small), shade. d = unit vector pointing down the slope. */
  function plane(pts, d, o) {
    o = o || {}
    const kind = o.kind || 'tile', tex = texOf(kind), sh = o.shade != null ? o.shade : shadeOf(d)
    paint(pts, o.col || kindCol(kind), sh)
    if (det < 2) { shadeHatch(pts, d, sh, tex); return }
    if (tex === 'thatch') thatchTex(pts, d, sh, o)
    else if (tex === 'plank') { plankTex(pts, d, o); slopeHatch(pts, d, sh, o) }
    else { if (tex === 'tile') tileTex(pts, d, { w: o.w }); else rowsTex(pts, d, tex === 'slate' ? { g: ROW * 1.25, tw: TW * 1.5, irregular: true, irr: 0.25, w: o.w, full: true } : { irregular: o.irregular !== false, w: o.w }); slopeHatch(pts, d, sh, o) }
  }
  const N = [0, -1], S = [0, 1], WD = [-1, 0], E = [1, 0]
  /** Gable (or hipped, with hip0 / hip1) roof over a rectangle; ridge runs along ax ('x' or 'y'). Returns the ridge ends. */
  function gable(x0, y0, x1, y1, ax, o) {
    o = o || {}
    const sw = ax === 'y', M = sw ? (p) => [p[1], p[0]] : (p) => p, m = (a) => a.map(M)
    const L0 = sw ? y0 : x0, L1 = sw ? y1 : x1, D0 = sw ? x0 : y0, D1 = sw ? x1 : y1, Dm = (D0 + D1) / 2, hd = (D1 - D0) / 2
    const h0 = o.hip0 ? Math.min(hd, (L1 - L0) / 2) : 0, h1 = o.hip1 ? Math.min(hd, (L1 - L0) / 2) : 0, R0 = [L0 + h0, Dm], R1 = [L1 - h1, Dm]
    const dN = sw ? WD : N, dS = sw ? E : S, dL = sw ? N : WD, dH = sw ? S : E
    plane(m([[L0, D0], [L1, D0], R1, R0]), dN, o)
    plane(m([[L0, D1], [L1, D1], R1, R0]), dS, o)
    if (h0) plane(m([[L0, D0], [L0, D1], R0]), dL, o)
    if (h1) plane(m([[L1, D0], [L1, D1], R1]), dH, o)
    if (h0) { crease(M([L0, D0]), M(R0)); crease(M([L0, D1]), M(R0)) }
    if (h1) { crease(M([L1, D0]), M(R1)); crease(M([L1, D1]), M(R1)) }
    ridge(M(R0), M(R1), texOf(o.kind))
    return { a: M(R0), b: M(R1) }
  }
  function crease(a, b, w, o) { ln(a, b, w || 1, o || { taper: 0.4 }) }
  /** Ridge line. Thatch gets a bound roll along the top when large; small sizes a single firm line. */
  function ridge(a, b, kind) {
    const L = hyp(b[0] - a[0], b[1] - a[1]); if (L < 1) return
    if (det < 2) { ln(a, b, kind === 'thatch' ? 1.1 : 1.35, { taper: 0.35 }); return }
    const vx = (b[0] - a[0]) / L, vy = (b[1] - a[1]) / L, nx = -vy, ny = vx
    if (kind === 'thatch') {
      const hw = Math.max(K(2.2), 1.4)
      const band = [[a[0] + nx * hw, a[1] + ny * hw], [b[0] + nx * hw, b[1] + ny * hw], [b[0] - nx * hw, b[1] - ny * hw], [a[0] - nx * hw, a[1] - ny * hw]]
      paint(band, kindCol('thatch'), 0.15)
      const g = Math.max(K(2.6), 2.2); for (let t = g * 0.5; t < L - 1; t += g * rr(0.85, 1.2)) sg(a[0] + vx * t - nx * hw * 0.9, a[1] + vy * t - ny * hw * 0.9, a[0] + vx * (t + hw * 0.7) + nx * hw * 0.9, a[1] + vy * (t + hw * 0.7) + ny * hw * 0.9); flush(0.5)
      ln([a[0] + nx * hw, a[1] + ny * hw], [b[0] + nx * hw, b[1] + ny * hw], 0.8, { taper: 0.3 }); ln([a[0] - nx * hw, a[1] - ny * hw], [b[0] - nx * hw, b[1] - ny * hw], 1.15, { taper: 0.3 })
    } else {
      ln(a, b, 1.5, { taper: 0.35 })
      if (det >= 3) { const g = Math.max(K(4), 3); for (let t = g * 0.5; t < L - 1; t += g * rr(0.9, 1.15)) sg(a[0] + vx * t - nx * 1.1, a[1] + vy * t - ny * 1.1, a[0] + vx * t + nx * 1.1, a[1] + vy * t + ny * 1.1); flush(0.5) }
    }
  }
  /** Pyramid (hipped) roof over a rectangle. */
  function pyramid(x0, y0, x1, y1, o) {
    const c = [(x0 + x1) / 2, (y0 + y1) / 2]
    plane([[x0, y0], [x1, y0], c], N, o); plane([[x0, y1], [x1, y1], c], S, o); plane([[x0, y0], [x0, y1], c], WD, o); plane([[x1, y0], [x1, y1], c], E, o)
    for (const p of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) crease(p, c, 1)
    return c
  }
  /** A single sloping plane (lean-to, shed). wall = the edge where it meets the building, drawn as a firm line. */
  function shed(pts, d, o, wall) {
    plane(pts, d, o)
    if (wall) ln(wall[0], wall[1], 1.5, { taper: 0.3 })
  }
  /** Conical roof, apex (cx, cy), radius rad, from angle a0 to a1. o: kind, sides (0 = round), seams. */
  function fan(cx, cy, rad, a0, a1, o) {
    o = o || {}
    const kind = texOf(o.kind || 'slate'), full = a1 - a0 >= TAU - 0.01, sides = o.sides || 0
    const n = sides ? Math.max(1, Math.round(((a1 - a0) / TAU) * sides)) : clamp(Math.round(rad * u * 0.8), 12, 80)
    const rim = []
    for (let k = 0; k <= n; k++) { const a = a0 + ((a1 - a0) * k) / n; rim.push([cx + cos(a) * rad * (sides ? 1 : 1 + jt(0.004)), cy + sin(a) * rad * (sides ? 1 : 1 + jt(0.004))]) }
    const pts = full ? rim.slice(0, -1) : [[cx, cy], ...rim]
    const mid = (a0 + a1) / 2, sh0 = full ? 0.5 : shadeOf([cos(mid), sin(mid)])
    paint(pts, o.col || kindCol(o.kind || 'slate'), full ? 0.35 : sh0 * 0.7)
    shadeBands(pts, cx, cy, rad, 3)
    ctx.save(); path(pts); ctx.clip()
    if (det >= 2) {
      if (kind === 'thatch') {
        for (let ρ = rad; ρ > 5;) {
          const step = rr(8, 12), dθ = Math.min(0.3, Math.max(THA, 1) / ρ), from = Math.max(2, ρ - step - rr(1.5, 4))
          for (let a = a0; a < a1; a += dθ * rr(0.7, 1.4)) { const ang = a + jt(0.003); sg(cx + cos(ang) * ρ, cy + sin(ang) * ρ, cx + cos(ang + jt(0.012)) * from, cy + sin(ang + jt(0.012)) * from) }
          ρ -= step
        }
        flush(0.5)
      } else {
        const g = o.g || ROW * 1.7, tw = o.tw || TW * 1.35
        let i = 0
        for (let ρ = rad - g * 0.5; ρ > g * 0.6; ρ -= g * (1 + jt(0.05)), i++) {
          let a = a0 - 0.01
          while (a < a1) {
            const e = Math.min(a + rr(0.3, 0.9), a1 + 0.01)
            const pcs = 4; ctx.beginPath(); for (let k = 0; k <= pcs; k++) { const ang = a + ((e - a) * k) / pcs; ctx[k ? 'lineTo' : 'moveTo'](cx + cos(ang) * ρ, cy + sin(ang) * ρ) }
            ctx.lineWidth = W(0.6); ctx.strokeStyle = INK; ctx.stroke(); a = e + rr(0.05, 0.17)
          }
          const cnt = Math.max(1, Math.round(((a1 - a0) * ρ) / tw))
          for (let k = 0; k < cnt; k++) {
            const ang = a0 + (a1 - a0) * ((k + (i % 2) * 0.5 + jt(0.22)) / cnt)
            if (r() < 0.8) sg(cx + cos(ang) * ρ, cy + sin(ang) * ρ, cx + cos(ang) * (ρ - g * rr(0.6, 1.02)), cy + sin(ang) * (ρ - g * rr(0.6, 1.02)))
          }
        }
        flush(0.6)
      }
    }
    // radial hatching on the shaded side
    const base = det >= 2 ? ROW * 1.9 : Math.max(K(2.6), 1.2)
    const nHat = Math.round(((a1 - a0) * rad) / base)
    for (let k = 0; k < nHat; k++) {
      const ang = a0 + ((a1 - a0) * (k + r() * 0.6)) / nHat, dk = cos(ang) * LX + sin(ang) * LY
      if (dk < 0.15) continue
      if (r() > dk * 1.15) continue
      const f0 = rr(0.05, 0.4), f1 = rr(0.7, 0.99)
      sg(cx + cos(ang) * rad * f1, cy + sin(ang) * rad * f1, cx + cos(ang + 0.01) * rad * f0, cy + sin(ang + 0.01) * rad * f0)
    }
    flush(0.45)
    if (o.seams && det >= 1) {
      const ns = Math.max(3, Math.round(((a1 - a0) / TAU) * o.seams))
      for (let k = full ? 0 : 1; k < ns; k++) { const ang = a0 + ((a1 - a0) * k) / ns; sg(cx, cy, cx + cos(ang) * rad, cy + sin(ang) * rad) }
      flush(0.7)
    }
    ctx.restore()
    return pts
  }
  /** Inner line along the shaded eaves (down and to the right) of a silhouette. Large sizes only. */
  function eaveBand(sil, inset) {
    if (det < 2) return
    const n = sil.length, sgn = orient(sil), e = inset || clamp(K(3.4), 1.5, 2.4)
    for (let i = 0; i < n; i++) {
      const p = sil[i], q = sil[(i + 1) % n], dx = q[0] - p[0], dy = q[1] - p[1], L = hyp(dx, dy)
      if (L < 12) continue
      const ux = dx / L, uy = dy / L, nx = uy * sgn, ny = -ux * sgn, f = nx * LX + ny * LY
      if (f < 0.35) continue
      const a = [p[0] - nx * e + ux * e * 1.5, p[1] - ny * e + uy * e * 1.5], b = [q[0] - nx * e - ux * e * 1.5, q[1] - ny * e - uy * e * 1.5]
      ln(a, b, 0.7, { taper: 0.6, wob: 0.15 })
      if (det >= 3) { const g = K(3.6); for (let t = e * 1.5; t < L - e * 1.5; t += g * rr(0.8, 1.2)) sg(p[0] + ux * t, p[1] + uy * t, p[0] + ux * t - nx * e * 0.85, p[1] + uy * t - ny * e * 0.85); flush(0.4) }
    }
  }
  /** Ragged straw ends along the eaves of a thatched silhouette. */
  function ragged(sil) {
    if (det < 2) return
    const n = sil.length, sgn = orient(sil)
    for (let i = 0; i < n; i++) {
      const p = sil[i], q = sil[(i + 1) % n], dx = q[0] - p[0], dy = q[1] - p[1], L = hyp(dx, dy)
      if (L < 4) continue
      const ux = dx / L, uy = dy / L, nx = uy * sgn, ny = -ux * sgn, g = Math.max(K(3.2), 1.6)
      for (let t = g * 0.4; t < L; t += g * rr(0.6, 1.4)) { const l = rr(0.5, 1.7), a = rr(-0.5, 0.5); sg(p[0] + ux * t, p[1] + uy * t, p[0] + ux * t + nx * l + ux * a, p[1] + uy * t + ny * l + uy * a) }
    }
    flush(0.5)
  }

  /* ---------- bird's-eye ---------- */
  /* The town plan stays where it is on the ground; walls rise from it straight up the screen and roofs sit on top, so a
     building shows its roof and the walls that face you, the way old engraved town views do. In 3D terms the viewer looks
     along (-UP, 1) scaled: a face shows when its outward normal turns towards that. */
  const lift = (p, z) => [p[0] + UP[0] * z, p[1] + UP[1] * z]
  const near = (p) => -(p[0] * UP[0] + p[1] * UP[1]) // how far down the screen: bigger is nearer, so drawn later
  const centre = (pts) => { let x = 0, y = 0; for (const p of pts) { x += p[0]; y += p[1] } return [x / pts.length, y / pts.length] }
  const faces = (n) => -(n[0] * UP[0] + n[1] * UP[1]) // > 0: a wall with this outward normal turns towards you
  const wallCol = (kind) => { const t = texOf(kind); return t === 'slate' || t === 'stone' ? mix(STONE(), PAPER, 0.3) : t === 'shingle' || t === 'plank' ? mix(WOOD(), PAPER, 0.45) : mix(PAPER, T.sand, t === 'thatch' ? 0.4 : 0.22) }
  /** One wall standing on the ground edge a-b (outward normal n), H tall, with a gable point `apex` above it if it's a gable end. */
  function birdWall(a, b, n, H, apex, kind, o) {
    const poly = apex ? [a, b, lift(b, H), apex, lift(a, H)] : [a, b, lift(b, H), lift(a, H)]
    const away = n[0] * LX + n[1] * LY // > 0: turned away from the light
    paint(poly, o.wall || wallCol(kind), clamp(0.3 + 0.6 * away, 0, 1), 0.6)
    // shade by hatching up the wall; in ink even the lit walls get a few strokes, the way an engraver tones plaster
    if (away > 0.35 || !COL) hatchIn(poly, Math.atan2(UP[1], UP[0]), K(away > 0.7 ? 2.0 : away > 0.35 ? 3.2 : 3.8), away > 0.35 ? 0.45 : 0.55, { keep: away > 0.35 ? 0.9 : away > 0 ? 0.6 : 0.4 })
    const L = hyp(b[0] - a[0], b[1] - a[1])
    if (det >= 1 && L > 5 && H > 4 && !o.blind) {
      const e = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], rows = H > 10 ? [0.3, 0.7] : [0.55], ww = clamp(L * 0.07, 1.1, 2.0), wh = clamp(H * 0.13, 1.3, 2.4)
      const m = Math.max(1, Math.floor(L / 7.5)), door = o.door !== false && faces(n) > 0.6 ? Math.floor(rr(0, m)) : -1
      const quad = (c, hw, z0, z1) => path([lift([c[0] - e[0] * hw, c[1] - e[1] * hw], z0), lift([c[0] + e[0] * hw, c[1] + e[1] * hw], z0), lift([c[0] + e[0] * hw, c[1] + e[1] * hw], z1), lift([c[0] - e[0] * hw, c[1] - e[1] * hw], z1)])
      ctx.fillStyle = INK
      for (let j = 0; j < m; j++) {
        const t = (j + 0.5) / m, c = [a[0] + (b[0] - a[0]) * t + e[0] * jt(0.4), a[1] + (b[1] - a[1]) * t + e[1] * jt(0.4)]
        for (let k = 0; k < rows.length; k++) {
          if (j === door && k === 0) { ctx.globalAlpha = 0.85; quad(c, ww, 0, Math.min(H * 0.48, 4.2)); ctx.fill(); continue }
          if (r() < 0.12) continue
          const z = H * rows[k]
          ctx.globalAlpha = 0.7; quad(c, ww * 0.75, z - wh / 2, z + wh / 2); ctx.fill()
        }
      }
      ctx.globalAlpha = 1
      if (det >= 2 && texOf(kind) !== 'slate' && texOf(kind) !== 'stone' && H > 6) { // timber frame: posts, and a rail between the storeys
        const n2 = Math.max(1, Math.round(L / 6))
        for (let j = 0; j <= n2; j++) { const p = [a[0] + e[0] * (L * j) / n2, a[1] + e[1] * (L * j) / n2], q = lift(p, H); sg(p[0], p[1], q[0], q[1]) }
        if (rows.length > 1) { const p = lift(a, H * 0.5), q = lift(b, H * 0.5); sg(p[0], p[1], q[0], q[1]) }
        flush(0.4)
      }
    }
    outline(poly, 1.05, { noext: true })
  }
  /** Roof planes, back ones first, the ones that turn away skipped. Each: pts (on screen), d (the way down the slope on the
     ground plan), run (how far that slope runs on the plan), eave (its lower edge) and top (its upper edge or point). */
  function birdRoof(planes, rise, kind, o) {
    const shown = planes.filter((pl) => rise * -(pl.d[0] * UP[0] + pl.d[1] * UP[1]) + pl.run > 0.01)
    shown.sort((p, q) => near(centre(p.pts)) - near(centre(q.pts)))
    for (const pl of shown) {
      const [ex, ey] = centre(pl.eave), [rx, ry] = centre(pl.top), L = hyp(ex - rx, ey - ry) || 1
      plane(pl.pts, [(ex - rx) / L, (ey - ry) / L], { ...o, kind, shade: shadeOf(pl.d) })
    }
    return shown
  }
  /** Roof height at a ground point, for a gable roof (ridge along ax) of the given box. */
  function roofZ(b, p) {
    const across = Math.abs((b.sw ? p[0] : p[1]) - b.Dm), along = b.sw ? p[1] : p[0]
    let f = 1 - across / b.hd
    if (b.h0) f = Math.min(f, (along - b.L0) / b.h0)
    if (b.h1) f = Math.min(f, (b.L1 - along) / b.h1)
    return b.H + b.RH * clamp(f, 0, 1)
  }
  /** A roofed house standing up: its near walls (gable ends where the ridge meets them), then its roof, then its chimneys.
     o.v0 / o.v1: that end runs into a bigger roof, so it has no gable and its ridge carries on in a valley (true: as far as a
     roof of the same pitch needs). o.open: a roof on posts, no walls (o.posts draws the corner posts). o.pitch: rise per run. */
  function birdHouse(x0, y0, x1, y1, ax, o) {
    o = o || {}
    const kind = o.kind || 'tile', tex = texOf(kind), sw = ax === 'y', M = sw ? (p) => [p[1], p[0]] : (p) => p
    const L0 = sw ? y0 : x0, L1 = sw ? y1 : x1, D0 = sw ? x0 : y0, D1 = sw ? x1 : y1, Dm = (D0 + D1) / 2, hd = (D1 - D0) / 2
    const h0 = o.hip0 ? Math.min(hd, (L1 - L0) / 2) : 0, h1 = o.hip1 ? Math.min(hd, (L1 - L0) / 2) : 0
    const v0 = o.v0 === true ? hd : o.v0 || 0, v1 = o.v1 === true ? hd : o.v1 || 0
    const H = (o.sh || 7) * 1.25 * BH, RH = hd * (o.pitch || (tex === 'thatch' ? 0.95 : 0.75)), Z = H + RH
    const r0 = lift(M([L0 + h0 - v0, Dm]), Z), r1 = lift(M([L1 - h1 + v1, Dm]), Z)
    const C = rect(x0, y0, x1, y1), NRM = [N, E, S, WD]
    const end = (i) => (sw ? (i === 0 && !h0 ? r0 : i === 2 && !h1 ? r1 : null) : i === 3 && !h0 ? r0 : i === 1 && !h1 ? r1 : null)
    const inside = (i) => (sw ? (i === 0 && v0) || (i === 2 && v1) : (i === 3 && v0) || (i === 1 && v1))
    if (o.posts) for (const p of C.slice().sort((a, b) => near(a) - near(b))) pole(p, 0, H, K(1.4))
    if (!o.open) for (let i = 0; i < 4; i++) if (faces(NRM[i]) > 0.02 && !inside(i)) birdWall(C[i], C[(i + 1) % 4], NRM[i], H, end(i), kind, o)
    const E0 = lift(M([L0, D0]), H), E1 = lift(M([L1, D0]), H), E2 = lift(M([L1, D1]), H), E3 = lift(M([L0, D1]), H)
    const planes = [
      { pts: [E0, E1, r1, r0], eave: [E0, E1], top: [r0, r1], d: sw ? WD : N, run: hd },
      { pts: [E3, E2, r1, r0], eave: [E3, E2], top: [r0, r1], d: sw ? E : S, run: hd },
    ]
    if (h0) planes.push({ pts: [E0, E3, r0], eave: [E0, E3], top: [r0], d: sw ? N : WD, run: h0 })
    if (h1) planes.push({ pts: [E1, E2, r1], eave: [E1, E2], top: [r1], d: sw ? S : E, run: h1 })
    birdRoof(planes, RH, kind, o)
    if (h0 || v0) { crease(E0, r0, 1); crease(E3, r0, 1) }
    if (h1 || v1) { crease(E1, r1, 1); crease(E2, r1, 1) }
    ridge(r0, r1, tex)
    if (v0 || v1) { // the eaves, leaving out the ends that run into the other roof
      for (const [a, b, keep] of [[E0, E1, 1], [E1, E2, !v1], [E2, E3, 1], [E3, E0, !v0]]) if (keep) ln(a, b, 1.3, { taper: 0.3 })
    } else outline([E0, E1, E2, E3], 1.25, { noext: true })
    if (tex === 'thatch') ragged([E0, E1, E2, E3])
    const box = { sw, L0, L1, Dm, hd, h0, h1, H, RH }
    if (o.ch) for (const c of o.ch) birdStack(c[0], c[1], c[2], roofZ(box, [c[0], c[1]]))
    return box
  }
  /** A chimney stack standing on the roof at height z. */
  function birdStack(cx, cy, w, z) {
    if (det < 1) return
    w = w || 3.4
    const sq = rect(cx - w / 2, cy - w / 2, cx + w / 2, cy + w / 2), zt = z + w * 1.5, NRM = [N, E, S, WD]
    for (let i = 0; i < 4; i++) {
      if (faces(NRM[i]) <= 0.02) continue
      const a = sq[i], b = sq[(i + 1) % 4], f = [lift(a, z - w * 0.6), lift(b, z - w * 0.6), lift(b, zt), lift(a, zt)]
      paint(f, STONE(), clamp(0.3 + 0.6 * (NRM[i][0] * LX + NRM[i][1] * LY), 0, 1)); outline(f, 0.9, { noext: true })
    }
    const top = sq.map((p) => lift(p, zt))
    paint(top, lighter(STONE(), 0.15), 0.1); outline(top, 0.9, { noext: true })
    if (det >= 2) { const c = lift([cx, cy], zt); fillPoly(rect(c[0] - w * 0.2, c[1] - w * 0.2, c[0] + w * 0.2, c[1] + w * 0.2), INK) }
  }
  /** A square tower under a pyramid roof, standing up. */
  function birdTower(x0, y0, x1, y1, kind, H) {
    const C = rect(x0, y0, x1, y1), NRM = [N, E, S, WD]
    for (let i = 0; i < 4; i++) if (faces(NRM[i]) > 0.02) birdWall(C[i], C[(i + 1) % 4], NRM[i], H, null, 'stone', { door: false })
    const run = Math.min(x1 - x0, y1 - y0) / 2, top = lift([(x0 + x1) / 2, (y0 + y1) / 2], H + run * 1.6), E4 = C.map((p) => lift(p, H))
    birdRoof(NRM.map((d, i) => ({ pts: [E4[i], E4[(i + 1) % 4], top], eave: [E4[i], E4[(i + 1) % 4]], top: [top], d, run })), run * 1.6, kind, {})
    for (const p of E4) crease(p, top, 1)
    outline(E4, 1.3, { noext: true })
    return top
  }
  /** A round tower: a stone drum with a cone on top (or a flat top behind battlements when kind is 'flat'). */
  function birdRound(cx, cy, R, kind, H) {
    const up = Math.atan2(UP[1], UP[0]), hz = [-UP[1], UP[0]]
    const arc = (c, rad, from, to, n) => { const o = []; for (let k = 0; k <= n; k++) { const a = from + ((to - from) * k) / n; o.push([c[0] + cos(a) * rad, c[1] + sin(a) * rad]) } return o }
    const g = [cx, cy], top = lift(g, H)
    const drum = [...arc(g, R, up + PI / 2, up + PI * 1.5, 20), ...arc(top, R, up + PI * 1.5, up + PI / 2, 20)]
    paint(drum, STONE(), 0.3)
    const sgn = Math.sign(hz[0] * LX + hz[1] * LY) || 1, far = [hz[0] * sgn * R * 2, hz[1] * sgn * R * 2]
    const shade = [lift([cx + hz[0] * sgn * R * 0.15, cy + hz[1] * sgn * R * 0.15], -R), lift([cx + hz[0] * sgn * R * 0.15, cy + hz[1] * sgn * R * 0.15], H + R)]
    ctx.save(); path(drum); ctx.clip()
    hatchIn([shade[0], shade[1], [shade[1][0] + far[0], shade[1][1] + far[1]], [shade[0][0] + far[0], shade[0][1] + far[1]]], up, K(2.4), 0.45, { keep: 0.9 })
    ctx.restore()
    if (det >= 1 && H > 8) {
      ctx.fillStyle = INK; ctx.globalAlpha = 0.75
      for (const [f, z] of [[-0.25, 0.42], [0.2, 0.72]]) { const a = up + PI + f, p = lift([cx + cos(a) * R, cy + sin(a) * R], H * z); path(rect(p[0] - 0.7, p[1] - 1.3, p[0] + 0.7, p[1] + 1.3)); ctx.fill() }
      ctx.globalAlpha = 1
    }
    outline(drum, 1.3, { noext: true })
    if (kind === 'flat') {
      const rim = oval(top[0], top[1], R * 1.06, R * 1.06, 28)
      paint(rim, lighter(STONE(), 0.1), 0.15); loop(rim, 1.2)
      if (det >= 1) { const inner = oval(top[0], top[1], R * 0.7, R * 0.7, 20); paint(inner, darker(STONE(), 0.1), 0.4); loop(inner, 0.8) }
      return top
    }
    // the cone in gores, each toned by the light, with a slight overhang at the eaves
    return birdCone(cx, cy, R * 1.12, H, R * 2.3, 12, 0, (pts, k, f) => {
      paint(pts, kindCol(kind || 'slate'), clamp(0.25 + 0.5 * f, 0, 1))
      if (f > 0.2 || !COL) hatchIn(pts, up, K(f > 0.55 ? 2.2 : 3.4), 0.45, { keep: f > 0.2 ? 0.85 : 0.4 })
    })
  }

  /* Standing things wait in a queue while the piece lays its flat ground, then draw far to near. Each keeps the drawing frame
     (and the turned light and up) it was queued in, and sorts by how far down the screen its ground point lands. */
  let Q = null, SEQ = 0, LIFT = 0
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
  /** Draw fn standing at ground point p, in turn; nudge moves it nearer (+) or further (-) in the order. */
  function later(p, fn, nudge) {
    if (!Q) { fn(); return }
    const m = ctx.getTransform(), k = nudge || 0, x = p[0] - UP[0] * k, y = p[1] - UP[1] * k
    Q.push({ key: m.b * x + m.d * y + m.f, seq: SEQ++, fn, m, up: UP, lx: LX, ly: LY })
  }
  function flushQ() {
    const q = Q, up = UP, lx = LX, ly = LY
    Q = null
    q.sort((a, b) => a.key - b.key || a.seq - b.seq)
    for (const it of q) { ctx.save(); ctx.setTransform(it.m); UP = it.up; LX = it.lx; LY = it.ly; try { it.fn() } finally { ctx.restore() } }
    UP = up; LX = lx; LY = ly
  }
  /** Run a top-down drawing raised z up the screen (the top of something standing), with no cast shadow. */
  function lifted(z, fn) {
    const sh = SH, lf = LIFT
    ctx.save(); ctx.translate(UP[0] * z, UP[1] * z); SH = false; LIFT = 1
    try { fn() } finally { ctx.restore(); SH = sh; LIFT = lf }
  }
  /** True when a helper should stand its thing up rather than draw it flat (bird's-eye, and not already drawing a raised top). */
  const standing = () => !!UP && !LIFT
  /** The sides of a solid on a convex footprint, from height z0 to z1: the faces that turn towards you, toned by the light. Up to
     eight sides each face gets its own tone (a box, a step); a round footprint is one band, hatched on the side away from the light. */
  function sides(base, z0, z1, col, o) {
    o = o || {}
    const n = base.length, sgn = orient(base), f = [], up = Math.atan2(UP[1], UP[0])
    for (let i = 0; i < n; i++) {
      const p = base[i], q = base[(i + 1) % n], L = hyp(q[0] - p[0], q[1] - p[1]) || 1, nx = ((q[1] - p[1]) / L) * sgn, ny = (-(q[0] - p[0]) / L) * sgn
      f.push(faces([nx, ny]) > 0.001 ? nx * LX + ny * LY : null)
    }
    const quad = (i) => { const p = base[i], q = base[(i + 1) % n]; return [lift(p, z0), lift(q, z0), lift(q, z1), lift(p, z1)] }
    const tone = (pts, k, band) => {
      if (o.leaf) stippleIn(pts, k > 0.35 ? 3.2 : 1.6, K(0.5))
      else if (band || k > 0.35 || !COL) hatchIn(pts, up, K(band ? 2.4 : k > 0.7 ? 2.0 : k > 0.35 ? 3.0 : 3.8), 0.45, { keep: band || k > 0.35 ? 0.88 : 0.5 })
    }
    if (n <= 8) {
      for (let i = 0; i < n; i++) {
        if (f[i] == null) continue
        const qd = quad(i)
        if (o.leaf) fillPoly(qd, COL ? darker(mix(col, PAPER, 0.12), 0.12 + 0.2 * f[i]) : PAPER); else paint(qd, col, clamp(0.3 + 0.6 * f[i], 0, 1), 0.6)
        tone(qd, f[i])
        if (o.leaf) ln(qd[0], qd[1], 0.8, { taper: 0.3, wob: 0.3 }); else outline(qd, o.w || 0.9, { noext: true }) // a hedge shows no joins
      }
      return
    }
    let s = -1
    for (let i = 0; i < n; i++) if (f[i] != null && f[(i + n - 1) % n] == null) { s = i; break }
    if (s < 0) return
    const chain = [base[s]]
    for (let k = 0; k < n; k++) { const i = (s + k) % n; if (f[i] == null) break; chain.push(base[(i + 1) % n]) }
    const band = [...chain.map((p) => lift(p, z0)), ...chain.slice().reverse().map((p) => lift(p, z1))]
    paint(band, col, 0.3, 0.6)
    ctx.save(); ctx.beginPath()
    for (let i = 0; i < n; i++) if (f[i] != null && f[i] > 0.3) { quad(i).forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath() }
    ctx.clip(); tone(band, 1, true); ctx.restore()
    outline(band, o.w || 1, { noext: true })
  }
  /** A small solid standing on `base`: its shadow on the ground now, then in turn its sides h tall and top() drawn on them. */
  function standUp(at, base, h, col, top, sh, nudge) {
    if (sh) castShadow([base], sh)
    later(at, () => { sides(base, 0, h, col); lifted(h, top) }, nudge)
  }
  /** A straight run of wall t thick and h tall on a-b: its sides, then top() drawn lifted onto it. */
  function slab(a, b, t, h, col, top, o) {
    const L = hyp(b[0] - a[0], b[1] - a[1]) || 1, nx = (-(b[1] - a[1]) / L) * t / 2, ny = ((b[0] - a[0]) / L) * t / 2
    sides([[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]], 0, h, col, o)
    lifted(h, top)
  }
  /** A run from a to b cut into pieces about `step` long (so each sorts with what stands beside it), the ends pushed out by `ext`. */
  function pieces(a, b, step, ext, fn) {
    const L = hyp(b[0] - a[0], b[1] - a[1]) || 1, k = Math.max(1, Math.ceil(L / step)), v = [(b[0] - a[0]) / L, (b[1] - a[1]) / L]
    for (let i = 0; i < k; i++) {
      const p = lerp(a, b, i / k), q = lerp(a, b, (i + 1) / k)
      if (i === 0) { p[0] -= v[0] * ext; p[1] -= v[1] * ext }
      if (i === k - 1) { q[0] += v[0] * ext; q[1] += v[1] * ext }
      fn(p, q, lerp(p, q, 0.5))
    }
  }
  /** A pole from height z0 to z1 at ground point p, w thick. */
  function pole(p, z0, z1, w) {
    const a = lift(p, z0), b = lift(p, z1)
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineWidth = Math.max(w || 1, K(1)); ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.stroke()
  }
  /** A cone or spire of n gores on a ring of radius R at height z0, hc tall: the gores that face you, far ones first, each
     coloured by gore(pts, k, f) where f > 0 means it turns away from the light. flat: straight-sided (a spire) rather than round. */
  function birdCone(cx, cy, R, z0, hc, n, a0, gore, flat) {
    const apex = lift([cx, cy], z0 + hc), out = [], tilt = hc / (R * (flat ? cos(PI / n) : 1))
    for (let k = 0; k < n; k++) {
      const g0 = a0 + (TAU * k) / n, g1 = a0 + (TAU * (k + 1)) / n, mid = (g0 + g1) / 2
      if (1 - tilt * (cos(mid) * UP[0] + sin(mid) * UP[1]) <= 0.01) continue
      const pts = [apex], m = flat ? 1 : 4
      for (let q = 0; q <= m; q++) { const a = g0 + ((g1 - g0) * q) / m; pts.push(lift([cx + cos(a) * R, cy + sin(a) * R], z0)) }
      out.push({ pts, k, f: cos(mid) * LX + sin(mid) * LY, d: near([cx + cos(mid) * R, cy + sin(mid) * R]) })
    }
    out.sort((p, q) => p.d - q.d)
    for (const g of out) { gore(g.pts, g.k, g.f); outline(g.pts, 0.8, { noext: true }) }
    return apex
  }
  /** A dark doorway (arched when round) in the wall standing on a-b with outward normal nrm, h tall; only if that wall faces you. */
  function doorIn(a, b, nrm, h, round) {
    if (!UP) return
    later(lerp(a, b, 0.5), () => {
      if (faces(nrm) <= 0.02) return
      const w = hyp(b[0] - a[0], b[1] - a[1]) || 1, e = [(b[0] - a[0]) / w, (b[1] - a[1]) / w], c = lerp(a, b, 0.5), s = round ? h - w / 2 : h
      const pts = [a, b, lift(b, s)]
      if (round) for (let k = 1; k < 12; k++) { const t = (PI * k) / 12; pts.push(lift([c[0] + (e[0] * cos(t) * w) / 2, c[1] + (e[1] * cos(t) * w) / 2], s + (sin(t) * w) / 2)) }
      pts.push(lift(a, s))
      ctx.globalAlpha = 0.88; fillPoly(pts, INK); ctx.globalAlpha = 1
    }, 0.05)
  }
  /** The shade under an open roof (a market hall, a colonnade): a dark band below the eaves on the sides that face you. */
  function underRoof(x0, y0, x1, y1, H) {
    later([(x0 + x1) / 2, (y0 + y1) / 2], () => {
      const C = rect(x0, y0, x1, y1), NRM = [N, E, S, WD]
      for (let i = 0; i < 4; i++) {
        if (faces(NRM[i]) <= 0.02) continue
        const a = C[i], b = C[(i + 1) % 4], qd = [a, b, lift(b, H), lift(a, H)]
        if (COL) { ctx.globalAlpha = 0.42; fillPoly(qd, '#3a2c1a'); ctx.globalAlpha = 1 }
        hatchIn(qd, Math.atan2(UP[1], UP[0]), K(2.2), 0.45, { keep: 0.9 })
      }
    }, -2e3)
  }

  /* ---------- buildings ---------- */
  const baseOf = (sil, kind) => fillPoly(sil, COL ? mix(kindCol(kind || 'tile'), PAPER, 0.4) : PAPER)
  /** One roofed footprint: opaque base, a gable roof (ridge along ax), the outline. o: kind, col, hip0, hip1, w. */
  function house(x0, y0, x1, y1, ax, o) {
    if (UP) { later([(x0 + x1) / 2, (y0 + y1) / 2], () => birdHouse(x0, y0, x1, y1, ax, o), o && o.nudge); return }
    o = o || {}
    const sil = rect(x0, y0, x1, y1), kind = o.kind || 'tile'
    baseOf(sil, kind)
    gable(x0, y0, x1, y1, ax, o)
    outline(sil, o.w || 1.5, { noext: true })
    if (texOf(kind) === 'thatch') ragged(sil); else eaveBand(sil)
  }
  /** A block of attached houses: all their shadows first, then each roof, then the chimneys (which shade the roofs). */
  function block(hs, sh) {
    const same = hs.filter((h) => !h.sh).map((h) => rect(h.x0, h.y0, h.x1, h.y1))
    if (same.length) castShadow(same, sh || 7)
    for (const h of hs) if (h.sh) castShadow([rect(h.x0, h.y0, h.x1, h.y1)], h.sh)
    if (UP) { for (const h of hs) house(h.x0, h.y0, h.x1, h.y1, h.ax || 'y', h); return } // in turn, each with its own chimneys
    for (const h of hs) house(h.x0, h.y0, h.x1, h.y1, h.ax || 'y', h)
    for (const h of hs) if (h.ch) for (const c of h.ch) stack(c[0], c[1], c[2])
  }
  /** Square tower under a pyramid roof (taller than a house: longer shadow). */
  function sqTower(x0, y0, x1, y1, kind, sh) {
    const p = rect(x0, y0, x1, y1)
    castShadow([p], sh || 13)
    if (UP) { // gives back how high its point stands, for a flag
      const H = (sh || 13) * 1.6 * BH
      later([(x0 + x1) / 2, (y0 + y1) / 2], () => birdTower(x0, y0, x1, y1, kind, H))
      return H + (Math.min(x1 - x0, y1 - y0) / 2) * 1.6
    }
    baseOf(p, kind)
    const c = pyramid(x0, y0, x1, y1, { kind })
    outline(p, 1.7, { noext: true })
    fillPoly(oval(c[0], c[1], Math.max(0.9, K(0.9)), Math.max(0.9, K(0.9)), 6), INK)
    return c
  }
  /** Round tower: a ring of masonry under a cone. */
  function roundTower(cx, cy, R, kind, sh, seams) {
    const base = oval(cx, cy, R, R, 0, 0.004)
    castShadow([base], sh || 13)
    if (UP) { const H = (sh || 13) * 1.6 * BH; later([cx, cy], () => birdRound(cx, cy, R, kind, H)); return H + R * 2.3 }
    paint(base, STONE(), 0.25); loop(base, 1.7)
    const cone = fan(cx, cy, R * 0.86, 0, TAU, { kind, seams: seams || 10 })
    loop(cone, 1.2)
    fillPoly(oval(cx, cy, Math.max(0.9, K(0.9)), Math.max(0.9, K(0.9)), 6), INK)
  }
  /** Four ranges round a closed court, hips at the corners. Draws the court floor, the shadows that fall into it, roofs and outlines. */
  function courtyard(x0, y0, x1, y1, t, o) {
    o = o || {}
    const h = t / 2, ix0 = x0 + t, iy0 = y0 + t, ix1 = x1 - t, iy1 = y1 - t
    const sil = rect(x0, y0, x1, y1), court = rect(ix0, iy0, ix1, iy1), sh = o.sh || 8
    ground(court, o.floor || 'cobble')
    if (UP) { // four ranges, the far one first
      clipOut(court, () => castShadow([sil], sh))
      const ranges = [[x0, y0, x1, iy0, 'x'], [x0, iy1, x1, y1, 'x'], [x0, iy0, ix0, iy1, 'y'], [ix1, iy0, x1, iy1, 'y']]
      for (const g of ranges) house(g[0], g[1], g[2], g[3], g[4], { ...o, sh, hip0: true, hip1: true })
      return court
    }
    if (SH) { ctx.save(); path(court); ctx.clip(); castShadow([rect(ix0 - 1, iy0 - 1, ix1 + 1, iy0), rect(ix0 - 1, iy0 - 1, ix0, iy1 + 1)], sh); ctx.restore() }
    clipOut(court, () => castShadow([sil], sh))
    ctx.beginPath(); for (let i = 0; i < 4; i++) i ? ctx.lineTo(sil[i][0], sil[i][1]) : ctx.moveTo(sil[i][0], sil[i][1]); ctx.closePath()
    for (let i = 0; i < 4; i++) i ? ctx.lineTo(court[i][0], court[i][1]) : ctx.moveTo(court[i][0], court[i][1]); ctx.closePath()
    ctx.fillStyle = COL ? mix(kindCol(o.kind || 'tile'), PAPER, 0.4) : PAPER; ctx.fill('evenodd')
    const c = [[x0 + h, y0 + h], [x1 - h, y0 + h], [x1 - h, y1 - h], [x0 + h, y1 - h]]
    plane([[x0, y0], [x1, y0], c[1], c[0]], N, o); plane([[x1, y0], [x1, y1], c[2], c[1]], E, o)
    plane([[x1, y1], [x0, y1], c[3], c[2]], S, o); plane([[x0, y1], [x0, y0], c[0], c[3]], WD, o)
    plane([[ix0, iy0], [ix1, iy0], c[1], c[0]], S, o); plane([[ix1, iy0], [ix1, iy1], c[2], c[1]], WD, o)
    plane([[ix1, iy1], [ix0, iy1], c[3], c[2]], N, o); plane([[ix0, iy1], [ix0, iy0], c[0], c[3]], E, o)
    for (let i = 0; i < 4; i++) { crease(sil[i], c[i], 1); crease(court[i], c[i], 1); ridge(c[i], c[(i + 1) % 4], texOf(o.kind)) }
    outline(sil, 1.7, { noext: true }); outline(court.slice().reverse(), 1.3, { noext: true })
    eaveBand(sil)
    return court
  }
  /** A small gabled dormer (ridge along y) on a roof slope; it throws its own little shadow on the roof. */
  function dormer(cx, y0, y1, w, o) {
    if (det < 1 || UP) return
    const p = rect(cx - w / 2, y0, cx + w / 2, y1)
    castShadow([p], 2.6); baseOf(p, o.kind)
    gable(cx - w / 2, y0, cx + w / 2, y1, 'y', o)
    outline(p, 1.2, { noext: true })
  }

  /* ---------- small things ---------- */
  function stack(cx, cy, w) {
    if (det < 1 || UP) return // in bird's-eye a house draws its own chimneys
    w = w || 3.4
    const sq = rect(cx - w / 2, cy - w / 2, cx + w / 2, cy + w / 2)
    castShadow([sq], w * 0.9)
    paint(sq, STONE(), 0.1)
    if (det >= 2) { hatchIn([[cx + w * 0.1, cy - w / 2], [cx + w / 2, cy - w / 2], [cx + w / 2, cy + w / 2], [cx - w * 0.1, cy + w / 2]], 1.9, K(2.2), 0.5); fillPoly(rect(cx - w * 0.22, cy - w * 0.22, cx + w * 0.22, cy + w * 0.22), INK) }
    outline(sq, det >= 2 ? 1.4 : 1.0, { noext: true, flat: det < 2 })
  }
  function post(x, y, rad) {
    if (standing()) { const w = Math.max((rad || 0.8) * 1.2, K(1.3)); later([x, y], () => { pole([x, y], 0, 3 * BH, w); lifted(3 * BH, () => post(x, y, rad)) }); return }
    ctx.beginPath(); ctx.arc(x, y, Math.max(rad || 0.8, K(1.0)), 0, TAU); ctx.fillStyle = INK; ctx.fill()
  }
  /** Pale column top with an ink ring (a pillar seen from above). */
  function pillar(x, y, rad, h) {
    rad = Math.max(rad || 1.3, K(1.2))
    if (standing() && h) { const c = oval(x, y, rad, rad, 12); later([x, y], () => sides(c, 0, h, lighter(STONE(), 0.25)), -1e3); return } // under a roof: drawn before it
    if (det < 1) { post(x, y, rad * 0.8); return }
    const c = oval(x, y, rad, rad, 8); castShadow([c], rad * 1.2); fillPoly(c, PAPER); loop(c, 0.9, { flat: true })
  }
  /** A fence run: a rail with a post every few units. */
  function fenceSeg(a, b, o) {
    o = o || {}
    const L = hyp(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / (o.gap || 6)))
    if (standing()) { // posts and two rails, in short runs
      const h = 3.6 * BH, w = Math.max((o.rad || 0.8) * 0.9, K(1.2)), per = Math.max(1, Math.round(8 / (L / n)))
      for (let i = 0; i < n; i += per) {
        const j = Math.min(n, i + per), p = lerp(a, b, i / n), q = lerp(a, b, j / n)
        later(lerp(p, q, 0.5), () => {
          for (let k = i === 0 ? i : i + 1; k <= j; k++) pole(lerp(a, b, k / n), 0, h, w)
          for (const z of [h * 0.45, h * 0.88]) ln(lift(p, z), lift(q, z), 0.8, { taper: 0.2, wob: 0.15 })
        })
      }
      return
    }
    ln(a, b, 0.9, { taper: 0.25, wob: 0.2 })
    for (let i = 0; i <= n; i++) post(a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n, o.rad || 0.8)
  }
  /** Flat doorstep / threshold slab. */
  function step(cx, cy, w, h) {
    if (det < 1) return
    const p = rect(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2)
    castShadow([p], 1); paint(p, STONE(), 0.1); outline(p, 0.9, { noext: true, flat: true, wob: 0.15 })
  }
  /** A flight of steps: a stone block with risers drawn across it. Lines run along x when ax is 'x'. */
  function steps(x0, y0, x1, y1, n, ax) {
    const p = rect(x0, y0, x1, y1)
    castShadow([p], 1.2); paint(p, STONE(), 0.05, 0.5)
    for (let i = 1; i < n; i++) {
      if (ax === 'y') ln([x0 + ((x1 - x0) * i) / n, y0], [x0 + ((x1 - x0) * i) / n, y1], 0.7, { taper: 0.3, wob: 0.15 })
      else ln([x0, y0 + ((y1 - y0) * i) / n], [x1, y0 + ((y1 - y0) * i) / n], 0.7, { taper: 0.3, wob: 0.15 })
    }
    outline(p, 1.0, { noext: true })
  }
  /** Rain barrel / tub seen from above. */
  function tub(x, y, rad, water) {
    const c = oval(x, y, rad, rad, 10)
    if (standing()) return standUp([x, y], c, rad * 1.1 * BH, WOOD(), () => tub(x, y, rad, water), rad * 0.6)
    castShadow([c], rad * 0.6)
    paint(c, WOOD(), 0.2); loop(c, 1.1)
    if (det >= 1) { const c2 = oval(x, y, rad * 0.7, rad * 0.7, 10); fillPoly(c2, water && COL ? mix(T.water, PAPER, 0.15) : PAPER); loop(c2, 0.6, { flat: true }); sg(x - rad, y, x + rad, y); flush(0.3) }
  }
  function crate(x, y, w) {
    const p = rect(x - w / 2, y - w / 2, x + w / 2, y + w / 2)
    if (standing()) return standUp([x, y], p, w * 0.8 * BH, WOOD(), () => crate(x, y, w), w * 0.5)
    castShadow([p], w * 0.5); paint(p, WOOD(), 0.15); outline(p, 0.9, { noext: true })
    if (det >= 1) { sg(x - w / 2, y - w / 2, x + w / 2, y + w / 2); sg(x + w / 2, y - w / 2, x - w / 2, y + w / 2); flush(0.4) }
  }
  /** A low wooden or stone block (a trough, a bench): flat in plan, h tall in bird's-eye. */
  function box(p, h, col, sh, w) {
    const top = () => { paint(p, col, 0.2); outline(p, w || 0.9, { noext: true }) }
    if (standing()) return standUp(centre(p), p, h * BH, col, top, sh)
    castShadow([p], sh); top()
  }
  function basket(x, y, rad) {
    const c = oval(x, y, rad, rad * 0.85, 9)
    if (standing()) return standUp([x, y], c, rad * 0.8 * BH, mix(T.sand, '#8a7236', 0.3), () => basket(x, y, rad), rad * 0.5)
    castShadow([c], rad * 0.5); paint(c, mix(T.sand, '#8a7236', 0.3), 0.2); loop(c, 0.8)
    if (det >= 2) { sg(x - rad * 0.6, y - rad * 0.2, x + rad * 0.6, y - rad * 0.2); sg(x - rad * 0.6, y + rad * 0.25, x + rad * 0.6, y + rad * 0.25); flush(0.35) }
  }
  /** Stack of logs seen from above. */
  function woodpile(x0, y0, x1, y1) {
    const p = rect(x0, y0, x1, y1), h = y1 - y0, n = Math.max(2, Math.round(h / 2.4))
    if (standing()) return standUp([(x0 + x1) / 2, (y0 + y1) / 2], p, 2.6 * BH, WOOD(), () => woodpile(x0, y0, x1, y1), 1.4)
    castShadow([p], 1.4); paint(p, WOOD(), 0.25)
    if (det >= 1) for (let i = 1; i < n; i++) ln([x0 + jt(0.3), y0 + (h * i) / n], [x1 + jt(0.3), y0 + (h * i) / n], 0.6, { taper: 0.3, wob: 0.15 })
    outline(p, 1.1, { noext: true })
  }
  /** Round stone well: ring of blocks around dark water. */
  function well(x, y, rad) {
    const o1 = oval(x, y, rad, rad), o2 = oval(x, y, rad * 0.6, rad * 0.6)
    if (standing()) { // a stone drum, and a winch on two posts over it
      const h = 2.4 * BH
      castShadow([o1], rad * 0.7)
      later([x, y], () => {
        sides(o1, 0, h, STONE()); lifted(h, () => well(x, y, rad))
        if (det < 1) return
        const hz = [-UP[1], UP[0]], p = [x - hz[0] * rad * 0.85, y - hz[1] * rad * 0.85], q = [x + hz[0] * rad * 0.85, y + hz[1] * rad * 0.85], zt = h + rad * 1.2
        pole(p, h, zt, K(1.3)); pole(q, h, zt, K(1.3)); ln(lift(p, zt - rad * 0.15), lift(q, zt - rad * 0.15), 1.2, { taper: 0.2 })
      })
      return
    }
    castShadow([o1], rad * 0.7)
    paint(o1, STONE(), 0.1); loop(o1, 1.4)
    if (det >= 1) { const n = Math.max(6, Math.round(rad * 2.2)); for (let i = 0; i < n; i++) { const a = (TAU * i) / n + jt(0.05); sg(x + cos(a) * rad * 0.6, y + sin(a) * rad * 0.6, x + cos(a) * rad, y + sin(a) * rad) } flush(0.5) }
    fillPoly(o2, COL ? mix(T.water, '#2a3a38', 0.45) : INK); if (det >= 1) loop(o2, 0.9, { flat: true })
  }
  /** Round haystack seen from above. */
  function haystack(x, y, rad) {
    const c = oval(x, y, rad, rad)
    if (standing()) return standUp([x, y], c, rad * 0.6 * BH, mix(T.sand, '#8a7236', 0.3), () => haystack(x, y, rad), rad * 0.6)
    castShadow([c], rad * 0.6)
    paint(c, mix(T.sand, '#8a7236', 0.3), 0.2)
    shadeBands(c, x, y, rad, 3)
    if (det >= 1) { const n = Math.round(rad * 1.6 * Math.min(2.4, Math.max(0.8, u))); ctx.save(); path(c); ctx.clip(); for (let i = 0; i < n; i++) { const a = r() * TAU, ρ = rad * rr(0.12, 0.95), l = rr(1.5, 3.2); sg(x + cos(a) * ρ, y + sin(a) * ρ, x + cos(a + 1.3) * (ρ + l * 0.2) + cos(a) * l, y + sin(a + 1.3) * (ρ + l * 0.2) + sin(a) * l) } flush(0.5); ctx.restore() }
    loop(c, 1.2)
  }
  /** Garden bed: soil with rows of little plants, inside a rectangle. */
  function furrows(x0, y0, x1, y1, ang) {
    const p = rect(x0, y0, x1, y1)
    if (COL) { fillPoly(p, mix(T.land, '#8a6a42', 0.4)); wash(p, mix(T.land, '#7d5d38', 0.5), 0.55) } else fillPoly(p, PAPER)
    ctx.save(); path(p); ctx.clip()
    const dx = cos(ang), dy = sin(ang), nx = -dy, ny = dx, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, L = hyp(x1 - x0, y1 - y0), g = Math.max(K(5), 3)
    let row = 0
    for (let t = -L / 2 + g / 2; t < L / 2; t += g, row++) {
      const ox = cx + nx * t, oy = cy + ny * t
      let s0 = -L / 2
      while (s0 < L / 2) { const e = Math.min(s0 + rr(10, 24), L / 2); sg(ox + dx * s0, oy + dy * s0 + jt(0.2), ox + dx * e, oy + dy * e + jt(0.2)); s0 = e + rr(0.5, 2) }
      if (det >= 2) {
        const stp = row % 2 ? 3.2 : 2.4
        for (let s2 = -L / 2 + 1.5; s2 < L / 2; s2 += stp * rr(0.9, 1.15)) {
          const px = ox + dx * s2 + nx * jt(0.3), py = oy + dy * s2 + ny * jt(0.3)
          if (row % 3 === 0) { sg(px, py, px + 0.8, py - 1.1); sg(px, py, px - 0.8, py - 1.0); sg(px, py, px, py - 1.5) } else { ctx.beginPath(); ctx.arc(px, py, Math.max(0.7, K(1.0)), 0, TAU); ctx.lineWidth = W(0.5); ctx.strokeStyle = INK; ctx.stroke() }
        }
      }
    }
    flush(0.5)
    ctx.restore()
    outline(p, 0.8, { noext: true, flat: true, wob: 0.3 })
  }
  /** A flat surface with no cast shadow: cobbles, trodden earth, grass, gravel, a ruined floor. */
  function ground(pts, kind) {
    const col = kind === 'cobble' ? PAVE() : kind === 'earth' ? mix(T.land, '#8a6a42', 0.35) : kind === 'gravel' ? mix(T.sand, PAPER, 0.3) : kind === 'floor' ? mix(T.sand, T.rock, 0.4) : mix(T.grass, T.sand, 0.4)
    if (COL) { fillPoly(pts, mix(col, PAPER, 0.3)); wash(pts, col, kind === 'grass' ? 0.5 : 0.45); if (det >= 2) bloom(pts, col) } else fillPoly(pts, PAPER)
    if (det < 1) return
    if (kind === 'cobble' || kind === 'floor') {
      if (det >= 2) rowsTex(pts, S, { g: Math.max(K(6), 3.2), tw: Math.max(K(7.5), 4), irr: 0.3, irregular: true, w: 0.4 })
      else stippleIn(pts, 0.35, K(0.5))
    } else if (kind === 'earth') stippleIn(pts, det >= 2 ? 1.0 : 0.5, K(0.5))
    else if (kind === 'gravel') stippleIn(pts, det >= 2 ? 1.4 : 0.7, K(0.45))
    else {
      const [x0, y0, x1, y1] = bbox(pts), n = Math.round(((x1 - x0) * (y1 - y0)) / (det >= 2 ? 70 : 160))
      ctx.save(); path(pts); ctx.clip(); for (let i = 0; i < n; i++) tuft(rr(x0, x1), rr(y0, y1), rr(0.6, 1.0)); flush(0.45); ctx.restore()
    }
  }
  /** Low stone wall between two points. */
  function wallRun(a, b, t) {
    t = t || 2.6
    const L = hyp(b[0] - a[0], b[1] - a[1]), vx = (b[0] - a[0]) / L, vy = (b[1] - a[1]) / L, nx = -vy * t / 2, ny = vx * t / 2
    const p = [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]]
    castShadow([p], 1.8)
    if (standing()) { const h = (t >= 3 ? 5 : 3.4) * BH; pieces(a, b, 7, t / 2, (p0, q0, m) => later(m, () => slab(p0, q0, t, h, STONE(), () => wallRun(p0, q0, t)))); return }
    paint(p, STONE(), 0.1)
    if (det >= 2) { const g = Math.max(K(5), 3); for (let s = g * 0.5; s < L; s += g * rr(0.85, 1.2)) sg(a[0] + vx * s + nx, a[1] + vy * s + ny, a[0] + vx * s - nx, a[1] + vy * s - ny); flush(0.45) }
    outline(p, 1.1, { noext: true, wob: 0.15 })
  }
  /** Clipped hedge between two points: a dark green band with a lumpy edge. */
  function hedge(a, b, t, open) {
    t = t || 2.6
    const L = hyp(b[0] - a[0], b[1] - a[1]), vx = (b[0] - a[0]) / L, vy = (b[1] - a[1]) / L, nx = -vy, ny = vx, hw = t / 2
    const top = [], bot = [], m = Math.max(2, Math.round(L / Math.max(K(3), 2)))
    for (let i = 0; i <= m; i++) { const s = (L * i) / m, k = hw * (1 + jt(0.18)), k2 = hw * (1 + jt(0.18)); top.push([a[0] + vx * s + nx * k, a[1] + vy * s + ny * k]); bot.push([a[0] + vx * s - nx * k2, a[1] + vy * s - ny * k2]) }
    const p = top.concat(bot.reverse())
    castShadow([p], t * 0.5)
    if (standing()) { const h = t * 1.6 * BH; pieces(a, b, 7, t / 2, (p0, q0, m) => later(m, () => slab(p0, q0, t, h, GREEN(), () => hedge(p0, q0, t, true), { leaf: true }))); return }
    if (open) { // one length of a standing hedge's top: flat colour and the long edges only, so the lengths join up unseen
      fillPoly(p, COL ? mix(GREEN(), PAPER, 0.12) : PAPER)
      if (det >= 1) stippleIn(p, det >= 2 ? 3 : 1.6, K(0.5))
      pl(top, 0.9, { wob: 0.3, taper: 0.1 }); pl(bot, 0.9, { wob: 0.3, taper: 0.1 })
      return
    }
    if (COL) { fillPoly(p, mix(GREEN(), PAPER, 0.3)); wash(p, GREEN(), 0.6) } else fillPoly(p, PAPER)
    if (det >= 1) stippleIn(p, det >= 2 ? 3 : 1.6, K(0.5))
    outline(p, 0.9, { noext: true, wob: 0.3 })
  }
  /** Round tree canopy. */
  function tree(x, y, R) {
    if (standing()) { // a trunk, and the crown held up on it; its shadow falls a little way off
      const h = R * 1.4 * BH
      castShadow([blob(x + LX * h * 0.25, y + LY * h * 0.25, R * 0.85)], R * 0.3)
      later([x, y], () => { pole([x, y], 0, h - R * 0.4, Math.max(K(1.6), R * 0.2)); lifted(h, () => tree(x, y, R)) })
      return
    }
    const c = blob(x, y, R)
    castShadow([c], R * 0.55)
    if (COL) { fillPoly(c, mix(GREEN(), PAPER, 0.35)); wash(c, GREEN(), 0.6); if (det >= 1) bloom(c, GREEN()) } else fillPoly(c, PAPER)
    shadeBands(c, x, y, R, 2)
    if (det >= 1) {
      ctx.save(); path(c); ctx.clip()
      const n = Math.round(R * R * (det >= 2 ? 0.9 : 0.5)); ctx.beginPath(); const dr = Math.max(K(0.5), 0.35)
      for (let i = 0; i < n; i++) { const a = r() * TAU, d = R * Math.sqrt(r()); const dk = cos(a) * LX + sin(a) * LY; if (r() > 0.25 + dk * 0.75) continue; const px = x + cos(a) * d, py = y + sin(a) * d * 0.94; ctx.moveTo(px + dr, py); ctx.arc(px, py, dr * rr(0.6, 1.3), 0, TAU) }
      ctx.fillStyle = INK; ctx.fill()
      if (det >= 2) for (let i = 0; i < 4; i++) { const a = r() * TAU, d = R * rr(0.3, 0.75); pl([[x + cos(a) * d, y + sin(a) * d], [x + cos(a + 0.5) * d * 0.9, y + sin(a + 0.5) * d * 0.9], [x + cos(a + 1) * d * 0.95, y + sin(a + 1) * d * 0.95]], 0.5, { taper: 0.8, wob: 0.2 }) }
      ctx.restore()
    }
    loop(c, 1.2)
  }
  /** Loose stone / fallen block seen from above. */
  function stone(x, y, rad) {
    const n = r() < 0.5 ? 5 : 6, ph = r() * 6, el = rr(0.65, 1), pts = []
    for (let i = 0; i < n; i++) { const a = ph + (TAU * i) / n + jt(0.28), k = rad * rr(0.72, 1.12); pts.push([x + cos(a) * k, y + sin(a) * k * el]) }
    if (det >= 2) castShadow([pts], Math.max(1, rad * 0.55))
    if (det >= 2) paint(pts, STONE(), rr(0, 0.25), 0.55); else fillPoly(pts, COL ? mix(STONE(), PAPER, 0.35) : PAPER)
    outline(pts, rad > 2.6 ? 1.1 : 0.8, { noext: true, wob: 0.1 })
    if (det >= 2 && rad > 2.1) hatchIn([[x, y - rad * 0.1], [x + rad * 0.9, y + rad * 0.2], [x + rad * 0.5, y + rad * 0.8 * el], [x - rad * 0.2, y + rad * 0.8 * el]], 2.0, K(2.2), 0.4)
  }
  /** A pennant streaming from a pole at (x, y), seen from above. */
  function pennant(x, y, L, ang, col, z0) {
    if (det < 1) return
    if (standing()) { // on a pole from the ground, or from z0 (the top of a tower)
      const zt = (z0 || 0) + (z0 ? 5 : 12) * BH
      later([x, y], () => { pole([x, y], z0 || 0, zt, K(1.2)); lifted(zt, () => pennant(x, y, L, ang, col)) }, z0 ? 0.02 : 0)
      return
    }
    const ux = cos(ang), uy = sin(ang), nx = -uy, ny = ux, w0 = L * 0.13, amp = L * 0.07, top = [], bot = []
    for (let i = 0; i <= 8; i++) {
      const t = i / 8, cx = x + ux * L * t + nx * amp * sin(t * 5.2), cy = y + uy * L * t + ny * amp * sin(t * 5.2), hw = w0 * (1 - 0.55 * t)
      top.push([cx + nx * hw, cy + ny * hw]); bot.push([cx - nx * hw, cy - ny * hw])
    }
    const nt = [x + ux * L * 0.78 + nx * amp * sin(0.78 * 5.2), y + uy * L * 0.78 + ny * amp * sin(0.78 * 5.2)]
    const pts = [...top, nt, ...bot.reverse()]
    if (COL) { fillPoly(pts, mix(col || darker(T.roof, 0.1), PAPER, 0.2)); wash(pts, col || darker(T.roof, 0.1), 0.6) } else fillPoly(pts, PAPER)
    if (det >= 2) hatchIn(pts, ang + PI / 2, Math.max(K(1.9), 1.1), 0.45)
    outline(pts, 0.7, { noext: true, flat: true, wob: 0.05 })
    ctx.beginPath(); ctx.arc(x, y, Math.max(0.9, K(1)), 0, TAU); ctx.fillStyle = PAPER; ctx.fill(); loop(oval(x, y, Math.max(0.9, K(1)), Math.max(0.9, K(1)), 8), 0.8, { flat: true })
  }

  /* ---------- canvas: awnings, stalls, tents ---------- */
  const canvasCol = () => lighter(mix(T.sand, T.land, 0.5), 0.35)
  const stripeCol = (v) => (v === 1 ? darker(T.roof, 0.05) : v === 2 ? mix(T.water, '#3a5a6a', 0.45) : v === 3 ? mix(T.sand, '#b07a20', 0.6) : mix(T.forest, '#4a3a22', 0.4))
  /** Canvas colour for a panel: opaque base then wash. v selects the stripe colour; undefined = plain canvas. */
  function canvasFill(pts, v) {
    if (!COL) { fillPoly(pts, PAPER); return }
    const c = v == null ? canvasCol() : stripeCol(v)
    fillPoly(pts, mix(c, PAPER, v == null ? 0.4 : 0.35)); wash(pts, c, v == null ? 0.5 : 0.62)
  }
  /** Striped canvas over an axis-aligned rectangle; bands run along ax. v = stripe colour, null for plain canvas. */
  function stripes(p, ax, v) {
    canvasFill(p, undefined)
    if (v == null) return
    const bw = Math.max(K(2.6), 2.2), [x0, y0] = p[0], [x1, y1] = p[2]
    ctx.save(); path(p); ctx.clip()
    if (ax === 'y') { for (let a = x0, k = 0; a < x1; a += bw, k++) if (k % 2 === 0) { const q = rect(a, y0 - 1, Math.min(a + bw, x1), y1 + 1); canvasFill(q, v); hatchIn(q, PI / 2, Math.max(K(2), 1.3), 0.4) } }
    else { for (let a = y0, k = 0; a < y1; a += bw, k++) if (k % 2 === 0) { const q = rect(x0 - 1, a, x1 + 1, Math.min(a + bw, y1)); canvasFill(q, v); hatchIn(q, 0, Math.max(K(2), 1.3), 0.4) } }
    ctx.restore()
  }
  /** Shop awning jutting from a wall at y towards the street (+y). */
  function awning(x0, x1, y, dpt, v) {
    const p = rect(x0, y, x1, y + dpt)
    castShadow([p], 1.8)
    if (standing()) { // held out on two posts, below the eaves
      const h = 4.6 * BH
      later([(x0 + x1) / 2, y + dpt], () => { pole([x0 + 0.7, y + dpt - 0.7], 0, h, K(1.2)); pole([x1 - 0.7, y + dpt - 0.7], 0, h, K(1.2)); lifted(h, () => awning(x0, x1, y, dpt, v)) })
      return
    }
    stripes(p, 'y', v)
    outline(p, 0.9, { noext: true, flat: true })
    if (det >= 1) { post(x0 + 0.7, y + dpt - 0.7, 0.7); post(x1 - 0.7, y + dpt - 0.7, 0.7) }
  }
  /** Market stall: a canvas roof w by h (ridge along its length), turned by ang. v = stripe colour or null. */
  function stall(x, y, w, h, v, ang, o) {
    o = o || {}
    turned(x, y, ang, () => {
      const p = rect(-w / 2, -h / 2, w / 2, h / 2)
      castShadow([p], o.sh || 2.4)
      const roof = () => {
        stripes(p, 'y', v)
        if (det >= 1) hatchIn(rect(-w / 2, 0, w / 2, h / 2), 0.9, Math.max(K(3.4), 2.6), 0.36, { keep: 0.6 })
        ln([-w / 2, 0], [w / 2, 0], 0.9, { taper: 0.3 })
        outline(p, 1, { noext: true })
        if (det >= 2 && !UP) for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) post(sx * (w / 2 - 0.8), sy * (h / 2 - 0.8), 0.6)
      }
      if (!standing()) return roof()
      later([0, 0], () => { // the back posts, a counter along the side that faces you, the front posts, the canvas on top
        const H = 4.4 * BH, fy = faces(S) >= faces(N) ? 1 : -1, ps = [-1, 1].map((sx) => (sy) => [sx * (w / 2 - 0.8), sy * (h / 2 - 0.8)])
        for (const f of ps) pole(f(-fy), 0, H, K(1.2))
        const cn = rect(-w / 2 + 0.7, fy > 0 ? h / 2 - 2.6 : -h / 2 + 0.7, w / 2 - 0.7, fy > 0 ? h / 2 - 0.7 : -h / 2 + 2.6), ch = 1.9 * BH
        sides(cn, 0, ch, WOOD()); lifted(ch, () => { paint(cn, lighter(WOOD(), 0.25), 0.1); outline(cn, 0.8, { noext: true }) })
        for (const f of ps) pole(f(fy), 0, H, K(1.2))
        lifted(H, roof)
      })
    })
  }
  /** Covered stall: a little plank-roofed shed open at the sides. */
  function shedStall(x0, y0, x1, y1, kind) {
    const p = rect(x0, y0, x1, y1)
    castShadow([p], 3)
    if (UP) { underRoof(x0, y0, x1, y1, 3.6 * 1.25 * BH); return house(x0, y0, x1, y1, x1 - x0 >= y1 - y0 ? 'x' : 'y', { kind: kind || 'plank', sh: 3.6, open: true, posts: true }) }
    baseOf(p, kind || 'plank')
    gable(x0, y0, x1, y1, x1 - x0 >= y1 - y0 ? 'x' : 'y', { kind: kind || 'plank' })
    outline(p, 1.2, { noext: true })
    if (det >= 1) for (const q of [[x0 + 1, y0 + 1], [x1 - 1, y0 + 1], [x1 - 1, y1 - 1], [x0 + 1, y1 - 1]]) post(q[0], q[1], 0.7)
  }
  /** Small round tent with gores; v = stripe colour or null. */
  function tent(x, y, R, v) {
    const base = oval(x, y, R, R, 0, 0.004)
    castShadow([base], R * 0.7)
    if (standing()) { // a low canvas wall and a cone of gores, striped ones in turn
      later([x, y], () => {
        const hw = R * 0.3 * BH, up = Math.atan2(UP[1], UP[0])
        sides(oval(x, y, R, R, 24, 0.004), 0, hw, canvasCol())
        const apex = birdCone(x, y, R, hw, R * 0.95 * BH, 8, 0.2, (pts, k, f) => {
          canvasFill(pts, v != null && k % 2 === 0 ? v : undefined)
          if (f > 0.25) hatchIn(pts, up, Math.max(K(2.6), 1.6), 0.4, { keep: 0.75 })
        })
        fillPoly(oval(apex[0], apex[1], Math.max(0.8, K(0.8)), Math.max(0.8, K(0.8)), 6), INK)
      })
      return
    }
    paint(base, canvasCol(), 0.15)
    const n = 8
    if (det >= 1) {
      for (let k = 0; k < n; k++) {
        const a0 = (TAU * k) / n + 0.2, a1 = (TAU * (k + 1)) / n + 0.2, pts = [[x, y]]
        for (let q = 0; q <= 4; q++) { const a = a0 + ((a1 - a0) * q) / 4; pts.push([x + cos(a) * R, y + sin(a) * R]) }
        const mid = (a0 + a1) / 2, dk = cos(mid) * LX + sin(mid) * LY, stripe = v != null && k % 2 === 0
        if (stripe) { canvasFill(pts, v); hatchIn(pts, mid, Math.max(K(2.0), 1.3) * (dk > 0.3 ? 0.78 : 1.25), 0.4) }
        else if (dk > 0.25) hatchIn(pts, mid, Math.max(K(3.6), 2.4), 0.36, { keep: 0.6 })
      }
      for (let k = 0; k < n; k++) { const a = (TAU * k) / n + 0.2; ln([x + cos(a) * R * 0.1, y + sin(a) * R * 0.1], [x + cos(a) * R, y + sin(a) * R], 0.7, { taper: 0.25, wob: 0.2 }) }
    } else hatchIn(base.filter((p) => (p[0] - x) * LX + (p[1] - y) * LY > -R * 0.2).concat([[x, y]]), 0.9, K(2.4), 0.45)
    shadeBands(base, x, y, R, 2)
    loop(base, 1.2)
    fillPoly(oval(x, y, Math.max(0.8, K(0.8)), Math.max(0.8, K(0.8)), 6), INK)
  }
  /** Two-wheeled cart, shafts to the front (-x), turned by ang. */
  function cart(x, y, w, h, ang) {
    turned(x, y, ang, () => {
      const p = rect(-w / 2, -h / 2, w / 2, h / 2)
      castShadow([p], 1.6)
      const body = () => {
        paint(p, WOOD(), 0.15)
        if (det >= 1) { for (let i = 1; i < 3; i++) sg(-w / 2, -h / 2 + (h * i) / 3, w / 2, -h / 2 + (h * i) / 3); flush(0.4) }
        outline(p, 1.0, { noext: true })
      }
      const shafts = () => { ln([-w / 2, -h * 0.3], [-w / 2 - w * 0.45, -h * 0.25], 0.8, { taper: 0.2 }); ln([-w / 2, h * 0.3], [-w / 2 - w * 0.45, h * 0.25], 0.8, { taper: 0.2 }) }
      const bed = () => { body(); shafts() }
      if (!standing()) { body(); for (const sy of [-1, 1]) fillPoly(oval(w * 0.08, sy * (h / 2 + 0.9), Math.max(2.2, K(2.2)), Math.max(0.7, K(0.7)), 8), INK); shafts(); return }
      later([0, 0], () => { // the far wheel, the bed up on its axle, the near wheel
        const Rw = Math.max(2.2, K(2.2)), zb = Rw * 1.15
        const wheel = (sy) => {
          const c = [w * 0.08, sy * (h / 2 + 0.5)], pts = []
          for (let k = 0; k < 16; k++) { const t = (TAU * k) / 16; pts.push(lift([c[0] + cos(t) * Rw, c[1]], Rw + sin(t) * Rw)) }
          paint(pts, darker(WOOD(), 0.35), 0.4); loop(pts, 0.9, { flat: true })
          const hub = lift(c, Rw); fillPoly(oval(hub[0], hub[1], Rw * 0.22, Rw * 0.22, 6), INK)
        }
        const order = [-1, 1].sort((a, b) => near([0, a]) - near([0, b]))
        wheel(order[0]); sides(p, zb * 0.55, zb, WOOD()); lifted(zb, bed); wheel(order[1])
      })
    })
  }
  /** A fenced pen with a gate gap in the middle of the side facing `open` ('n' | 's' | 'e' | 'w'). */
  function pen(x0, y0, x1, y1, open) {
    const fo = { gap: Math.max(K(4.5), 3.6), rad: 0.8 }
    const gw = Math.min(7, (x1 - x0) * 0.3), mx = (x0 + x1) / 2, my = (y0 + y1) / 2
    if (open === 'n') { fenceSeg([x0, y0], [mx - gw / 2, y0], fo); fenceSeg([mx + gw / 2, y0], [x1, y0], fo) } else fenceSeg([x0, y0], [x1, y0], fo)
    if (open === 's') { fenceSeg([x0, y1], [mx - gw / 2, y1], fo); fenceSeg([mx + gw / 2, y1], [x1, y1], fo) } else fenceSeg([x0, y1], [x1, y1], fo)
    if (open === 'w') { fenceSeg([x0, y0], [x0, my - gw / 2], fo); fenceSeg([x0, my + gw / 2], [x0, y1], fo) } else fenceSeg([x0, y0], [x0, y1], fo)
    if (open === 'e') { fenceSeg([x1, y0], [x1, my - gw / 2], fo); fenceSeg([x1, my + gw / 2], [x1, y1], fo) } else fenceSeg([x1, y0], [x1, y1], fo)
  }
  /** An animal seen from above: a small oval, dark for cattle, pale for sheep. */
  function beast(x, y, L, dark, ang) {
    if (det < 1) { if (dark) post(x, y, L * 0.4); return }
    const o = ovalR(x, y, L, L * 0.5, ang, 8)
    castShadow([o], L * 0.3)
    if (standing()) { // up on four legs
      const h = L * 0.55 * BH, ux = cos(ang), uy = sin(ang)
      later([x, y], () => {
        for (const [a, b] of [[-0.55, -0.22], [-0.55, 0.22], [0.55, -0.22], [0.55, 0.22]]) pole([x + ux * a * L - uy * b * L, y + uy * a * L + ux * b * L], 0, h, K(0.9))
        lifted(h, () => beast(x, y, L, dark, ang))
      })
      return
    }
    fillPoly(o, dark ? (COL ? mix('#4a3a2a', PAPER, 0.3) : INK) : PAPER); loop(o, 0.7, { flat: true })
  }
  /** Round fountain: stone basin, water, a column in the middle. */
  function fountain(x, y, R) {
    const o1 = oval(x, y, R, R), o2 = oval(x, y, R * 0.74, R * 0.74)
    castShadow([o1], R * 0.25)
    if (standing()) { // a raised basin, and the column standing up out of the water
      later([x, y], () => {
        const hb = Math.max(1.6, R * 0.2) * BH, hc = R * 0.75 * BH, c = oval(x, y, R * 0.22, R * 0.22, 12)
        sides(o1, 0, hb, STONE()); lifted(hb, () => fountain(x, y, R))
        sides(c, hb, hb + hc, STONE())
        lifted(hb + hc, () => { paint(c, lighter(STONE(), 0.1), 0.15); loop(c, 0.9); fillPoly(oval(x, y, R * 0.07, R * 0.07, 6), INK) })
      })
      return
    }
    paint(o1, STONE(), 0.1); loop(o1, 1.4)
    if (det >= 1) { const n = Math.max(8, Math.round(R * 1.8)); for (let i = 0; i < n; i++) { const a = (TAU * i) / n + jt(0.04); sg(x + cos(a) * R * 0.74, y + sin(a) * R * 0.74, x + cos(a) * R, y + sin(a) * R) } flush(0.45) }
    fillPoly(o2, COL ? mix(T.water, PAPER, 0.25) : PAPER); loop(o2, 0.8, { flat: true })
    if (det >= 1) for (const f of [0.4, 0.58]) { const a0 = rr(0, TAU); const arc = oval(x, y, R * f, R * f, 10, 0.01, a0, a0 + rr(1.5, 3.5)); pl(arc, 0.4, { taper: 0.6, wob: 0.1 }) }
    const c = oval(x, y, R * 0.22, R * 0.22, 10); castShadow([c], R * 0.5); paint(c, STONE(), 0.2); loop(c, 0.9)
    fillPoly(oval(x, y, R * 0.07, R * 0.07, 6), INK)
  }
  /** Market cross: three octagonal steps and a tall shaft throwing a long shadow. */
  function cross(x, y, R) {
    if (standing()) { // three steps, the shaft, and the arms of the cross near its top
      castShadow([octagon(x, y, R)], R * 0.3); castShadow([rect(x - R * 0.15, y - R * 0.15, x + R * 0.15, y + R * 0.15)], R * 1.4)
      later([x, y], () => {
        const s = R * 0.16 * BH
        let z = 0
        ;[1, 0.7, 0.42].forEach((k, i) => {
          const o = octagon(x, y, R * k)
          sides(o, z, z + s, STONE()); z += s
          lifted(z, () => { paint(o, STONE(), 0.08 + i * 0.05); outline(o, i === 0 ? 1.2 : 0.8, { noext: true }) })
        })
        const sq = rect(x - R * 0.15, y - R * 0.15, x + R * 0.15, y + R * 0.15), zt = z + R * 1.5 * BH, hz = [-UP[1], UP[0]]
        sides(sq, z, zt, STONE()); lifted(zt, () => { paint(sq, STONE(), 0.2); outline(sq, 0.9, { noext: true }) })
        const za = zt - R * 0.38, k = R * 0.4
        ln(lift([x - hz[0] * k, y - hz[1] * k], za), lift([x + hz[0] * k, y + hz[1] * k], za), 2.4, { taper: 0.1 })
      })
      return
    }
    ;[1, 0.7, 0.42].forEach((k, i) => {
      const o = octagon(x, y, R * k)
      castShadow([o], i === 0 ? R * 0.3 : R * 0.18); paint(o, STONE(), 0.08 + i * 0.05); outline(o, i === 0 ? 1.2 : 0.8, { noext: true })
    })
    const sq = rect(x - R * 0.15, y - R * 0.15, x + R * 0.15, y + R * 0.15)
    castShadow([sq], R * 1.4); paint(sq, STONE(), 0.3); outline(sq, 0.9, { noext: true })
  }
  /** Fish-net hung out to dry: a lattice over a rectangle. */
  function net(x0, y0, x1, y1) {
    if (det < 1) return
    const p = rect(x0, y0, x1, y1)
    hatchIn(p, PI / 4, Math.max(K(2.6), 1.8), 0.35, { keep: 0.9 }); hatchIn(p, -PI / 4, Math.max(K(2.6), 1.8), 0.35, { keep: 0.9 })
    outline(p, 0.6, { noext: true, flat: true, wob: 0.4 })
  }
  /** A plaza: a rectangle with chamfered corners and a slightly uneven edge. */
  function plaza(w, h, c) {
    const p = [[-w / 2 + c, -h / 2], [w / 2 - c, -h / 2], [w / 2, -h / 2 + c], [w / 2, h / 2 - c], [w / 2 - c, h / 2], [-w / 2 + c, h / 2], [-w / 2, h / 2 - c], [-w / 2, -h / 2 + c]]
    return p.map((q) => [q[0] + jt(0.6), q[1] + jt(0.6)])
  }
  function plazaEdge(p) { outline(p, 0.8, { flat: true, wob: 0.35, noext: true }) }

  /* ---------- ruins ---------- */
  /** Offset a polyline into a wall band polygon, mitred at corners, with broken ends where the wall has fallen. */
  function bandPoly(c, t, jag0, jag1) {
    const n = c.length, L = [], R = []
    for (let i = 0; i < n; i++) {
      let tx, ty, k = 1
      if (i === 0 || i === n - 1) { const a = c[i === 0 ? 0 : n - 2], b = c[i === 0 ? 1 : n - 1], d = hyp(b[0] - a[0], b[1] - a[1]) || 1; tx = (b[0] - a[0]) / d; ty = (b[1] - a[1]) / d } else {
        const a = c[i - 1], b = c[i], d = c[i + 1], l1 = hyp(b[0] - a[0], b[1] - a[1]) || 1, l2 = hyp(d[0] - b[0], d[1] - b[1]) || 1
        const t1 = [(b[0] - a[0]) / l1, (b[1] - a[1]) / l1], t2 = [(d[0] - b[0]) / l2, (d[1] - b[1]) / l2]
        tx = t1[0] + t2[0]; ty = t1[1] + t2[1]; const tl = hyp(tx, ty) || 1; tx /= tl; ty /= tl
        k = 1 / Math.max(0.55, t1[0] * tx + t1[1] * ty)
      }
      const hw = (t / 2) * (1 + jt(0.07)) * k
      L.push([c[i][0] - ty * hw, c[i][1] + tx * hw]); R.push([c[i][0] + ty * hw, c[i][1] - tx * hw])
    }
    const sub = (P) => { const o = [P[0]]; for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i], d = hyp(b[0] - a[0], b[1] - a[1]), m = Math.floor(d / 9); for (let q = 1; q <= m; q++) { const f = q / (m + 1); o.push([a[0] + (b[0] - a[0]) * f + jt(0.3), a[1] + (b[1] - a[1]) * f + jt(0.3)]) } o.push(b) } return o }
    const Ls = sub(L), Rs = sub(R).reverse()
    const tang = (i) => { const a = c[Math.max(0, i - 1)], b = c[Math.min(n - 1, i + 1)], d = hyp(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / d, (b[1] - a[1]) / d] }
    const t0 = tang(0), t1 = tang(n - 1)
    const cap = (a, b, tx, ty, j) => (j ? [[(a[0] + b[0]) / 2 + tx * jt(j) + (b[0] - a[0]) * 0.22, (a[1] + b[1]) / 2 + ty * jt(j) + (b[1] - a[1]) * 0.22], [(a[0] + b[0]) / 2 + tx * jt(j) - (b[0] - a[0]) * 0.22, (a[1] + b[1]) / 2 + ty * jt(j) - (b[1] - a[1]) * 0.22]] : [])
    const startCap = jag0 ? cap(Rs[Rs.length - 1], Ls[0], -t0[0], -t0[1], jag0).reverse() : []
    const endCap = jag1 ? cap(Ls[Ls.length - 1], Rs[0], t1[0], t1[1], jag1) : []
    return [...startCap, ...Ls, ...endCap, ...Rs]
  }
  /** Roofless walls: floors, then the standing wall pieces (polylines) as stone bands with rubble at their broken ends. */
  function ruinWalls(rooms, pieces, t, sh) {
    if (UP) return birdRuins(rooms, pieces, t, sh)
    for (const rm of rooms) {
      ground(rm, 'floor')
      if (det >= 2) { const [bx0, by0, bx1, by1] = bbox(rm); ctx.save(); path(rm); ctx.clip(); const nT = Math.round(((bx1 - bx0) * (by1 - by0)) / 300); for (let i = 0; i < nT; i++) tuft(rr(bx0, bx1), rr(by0, by1), rr(0.7, 1.2)); flush(0.5); ctx.restore() }
    }
    const polys = pieces.map((c) => bandPoly(c, t, rr(1, 2.4), rr(1, 2.4)))
    castShadow(polys, sh || 3.5)
    for (const p of polys) outline(p, 2.0, { noext: true, wob: 0.18 })
    const wallCol = lighter(STONE(), 0.1)
    polys.forEach((p, i) => {
      const c = pieces[i]
      paint(p, wallCol, clamp(0.1 + (c[0][0] * LX + c[0][1] * LY) / 200, 0, 0.4), 0.65)
      ctx.save(); path(p); ctx.clip()
      for (let k = 0; k < c.length - 1; k++) {
        const a = c[k], b = c[k + 1], d = hyp(b[0] - a[0], b[1] - a[1]) || 1, vx = (b[0] - a[0]) / d, vy = (b[1] - a[1]) / d
        let nx = -vy, ny = vx; if (nx * LX + ny * LY < 0) { nx = -nx; ny = -ny }
        const f = clamp(nx * LX + ny * LY, 0, 1), gg = Math.max(K(2.4), 1.5)
        if (det >= 1) sg(a[0] - vx * 2, a[1] - vy * 2, b[0] + vx * 2, b[1] + vy * 2)
        for (let s2 = 0; s2 < d; s2 += gg * rr(0.8, 1.25)) { const e = t * rr(0.28, 0.5) * (0.5 + f); sg(a[0] + vx * s2, a[1] + vy * s2, a[0] + vx * (s2 + e * 0.5) + nx * e * 1.05, a[1] + vy * (s2 + e * 0.5) + ny * e * 1.05) }
        if (det >= 2) { const g = Math.max(K(7), 4); for (let s2 = rr(0, g); s2 < d; s2 += g * rr(0.7, 1.35)) { const side = r() < 0.5 ? 1 : -1; sg(a[0] + vx * s2, a[1] + vy * s2, a[0] + vx * s2 + nx * side * t * 0.55, a[1] + vy * s2 + ny * side * t * 0.55) } }
      }
      flush(0.5)
      if (det >= 2) stippleIn(p, 0.9, K(0.55))
      ctx.restore()
    })
    if (det < 1) return
    for (const c of pieces) {
      for (const k of [0, 1]) {
        const a = k === 0 ? c[0] : c[c.length - 1], b = k === 0 ? c[1] : c[c.length - 2], d = hyp(a[0] - b[0], a[1] - b[1]) || 1, vx = (a[0] - b[0]) / d, vy = (a[1] - b[1]) / d
        const n = det >= 2 ? 3 : 1
        for (let i = 0; i < n; i++) { const along = rr(1, 6), side = jt(t * 0.9); stone(a[0] + vx * along - vy * side, a[1] + vy * along + vx * side, rr(1.1, 2.4)) }
      }
    }
  }
  /** Bird's-eye ruins: the same floors, and the wall pieces standing in short lengths whose tops have broken off at different
     heights, lowest towards the fallen ends. */
  function birdRuins(rooms, runs, t, sh) {
    for (const rm of rooms) {
      ground(rm, 'floor')
      if (det >= 2) { const [bx0, by0, bx1, by1] = bbox(rm); ctx.save(); path(rm); ctx.clip(); const nT = Math.round(((bx1 - bx0) * (by1 - by0)) / 300); for (let i = 0; i < nT; i++) tuft(rr(bx0, bx1), rr(by0, by1), rr(0.7, 1.2)); flush(0.5); ctx.restore() }
    }
    castShadow(runs.map((c) => bandPoly(c, t, 0, 0)), sh || 3.5)
    const col = lighter(STONE(), 0.1), hmax = 6.5 * BH, up = () => Math.atan2(UP[1], UP[0])
    /** One length of the broken wall from p to q, its top sloping from h0 to h1; ends are only closed off where the run ends. */
    const length = (p, q, h0, h1, cap0, cap1) => {
      const L = hyp(q[0] - p[0], q[1] - p[1]) || 1, v = [(q[0] - p[0]) / L, (q[1] - p[1]) / L], n = [-v[1], v[0]], nx = (n[0] * t) / 2, ny = (n[1] * t) / 2
      const A = [p[0] + nx, p[1] + ny], B = [q[0] + nx, q[1] + ny], C = [q[0] - nx, q[1] - ny], D = [p[0] - nx, p[1] - ny]
      const face = (a, b, ha, hb, nrm, cap) => {
        if (faces(nrm) <= 0.001) return
        const k = nrm[0] * LX + nrm[1] * LY, qd = [a, b, lift(b, hb), lift(a, ha)]
        paint(qd, col, clamp(0.3 + 0.6 * k, 0, 1), 0.6)
        if (k > 0.35 || !COL) hatchIn(qd, up(), K(k > 0.35 ? 2.4 : 3.8), 0.45, { keep: k > 0.35 ? 0.88 : 0.5 })
        if (cap) outline(qd, 0.9, { noext: true }); else ln(a, b, 0.9, { taper: 0.2, wob: 0.15 })
      }
      face(A, B, h0, h1, n, false); face(C, D, h1, h0, [-n[0], -n[1]], false)
      if (cap1) face(B, C, h1, h1, v, true)
      if (cap0) face(D, A, h0, h0, [-v[0], -v[1]], true)
      const top = [lift(A, h0), lift(B, h1), lift(C, h1), lift(D, h0)]
      paint(top, lighter(col, 0.15), 0.1, 0.65); if (det >= 2) stippleIn(top, 0.9, K(0.55))
      ln(top[0], top[1], 0.9, { taper: 0.2, wob: 0.2 }); ln(top[2], top[3], 0.9, { taper: 0.2, wob: 0.2 })
      if (cap1) ln(top[1], top[2], 0.9, { taper: 0.2 }); if (cap0) ln(top[3], top[0], 0.9, { taper: 0.2 })
    }
    for (const c of runs) {
      let total = 0
      for (let k = 0; k < c.length - 1; k++) total += hyp(c[k + 1][0] - c[k][0], c[k + 1][1] - c[k][1])
      // the height along the run: lowest at the broken ends, a slow swell and a ragged edge in between
      const ph = rr(0, TAU), hAt = (s) => hmax * clamp((0.3 + 0.7 * Math.min(1, Math.min(s, total - s) / 10)) * (0.78 + 0.18 * sin(s * 0.35 + ph)) + jt(0.07), 0.15, 1)
      let along = 0
      for (let k = 0; k < c.length - 1; k++) {
        const L = hyp(c[k + 1][0] - c[k][0], c[k + 1][1] - c[k][1]), last = k === c.length - 2
        const hs = []
        pieces(c[k], c[k + 1], 4, t / 2, (p, q, m) => hs.push({ p, q, m }))
        let h0 = hAt(along)
        hs.forEach((it, i) => {
          const s1 = along + Math.min(L, hyp(it.q[0] - c[k][0], it.q[1] - c[k][1])), h1 = hAt(s1), a = h0
          later(it.m, () => length(it.p, it.q, a, h1, k === 0 && i === 0, last && i === hs.length - 1))
          h0 = h1
        })
        along += L
      }
    }
    if (det < 1) return
    for (const c of runs) {
      for (const k of [0, 1]) {
        const a = k === 0 ? c[0] : c[c.length - 1], b = k === 0 ? c[1] : c[c.length - 2], d = hyp(a[0] - b[0], a[1] - b[1]) || 1, vx = (a[0] - b[0]) / d, vy = (a[1] - b[1]) / d
        for (let i = 0; i < (det >= 2 ? 3 : 1); i++) { const along = rr(1, 6), side = jt(t * 0.9); stone(a[0] + vx * along - vy * side, a[1] + vy * along + vx * side, rr(1.1, 2.4)) }
      }
    }
  }
  /** A fallen column lying on the ground: a long rounded shaft with drum lines. */
  function fallenColumn(x, y, L, rad, ang) {
    turned(x, y, ang, () => {
      const p = [[-L / 2, -rad], [L / 2, -rad], [L / 2 + rad * 0.6, 0], [L / 2, rad], [-L / 2, rad], [-L / 2 - rad * 0.6, 0]]
      castShadow([p], rad * 0.9); paint(p, lighter(STONE(), 0.1), 0.15); outline(p, 1.0, { noext: true, wob: 0.15 })
      if (det >= 1) { for (let s = -L / 2 + rr(3, 6); s < L / 2 - 1; s += rr(4, 7)) sg(s, -rad, s + jt(0.3), rad); flush(0.45) }
      if (det >= 1) hatchIn([[-L / 2, rad * 0.2], [L / 2, rad * 0.2], [L / 2, rad], [-L / 2, rad]], 0.3, K(2.2), 0.4, { keep: 0.8 })
    })
  }

  function reg(name, label, category, fs, fns) {
    A.register(name, {
      label, category, kind: 'fixed', view: 'top', variants: fns.length,
      draw(c, x, y, s, rg, style, v) {
        open(c, x, y, s, rg, style, fs)
        try {
          if (UP) { Q = []; SEQ = 0 }
          fns[(((v | 0) % fns.length) + fns.length) % fns.length]()
          if (Q) flushQ()
        } finally { Q = null; ctx.restore() }
      },
    })
  }

  /* =====================================================================================================================
     HOUSES: blocks of attached town houses. The street is at +y unless the plan says otherwise.
     ===================================================================================================================== */
  /** 0: straight terrace of four, gables to the street. */
  function hs0() {
    const xs = [-50, -25, 0, 25, 50], backs = [-22, -20, -23, -21], ks = ['tile', 'slate', 'tile2', 'shingle'], cy = [-6, 2, -3, 5]
    const hs = []
    for (let i = 0; i < 4; i++) hs.push({ x0: xs[i], y0: backs[i], x1: xs[i + 1], y1: 22, ax: 'y', kind: ks[i], ch: [[i === 3 ? 47.5 : xs[i + 1], cy[i], 3.4]] })
    block(hs, 7)
    for (let i = 0; i < 4; i++) step(xs[i] + 12.5 + (i % 2 ? -5 : 5), 23.6, 5, 2.4)
  }
  /** 1: terrace of six, every house a different width, depth and height; two of them ridge-on to the street. */
  function hs1() {
    const ws = [15, 19, 13, 21, 17, 15], backs = [-20, -26, -17, -24, -22, -19], hts = [6, 9, 4.5, 8, 7, 6]
    const ks = ['slate', 'tile', 'thatch', 'tile2', 'slate2', 'shingle'], ax = ['y', 'y', 'x', 'y', 'x', 'y']
    const hs = []; let x = -50
    for (let i = 0; i < 6; i++) {
      const x1 = x + ws[i]
      hs.push({ x0: x, y0: backs[i], x1, y1: 20, ax: ax[i], kind: ks[i], sh: hts[i], ch: i === 2 ? [] : [[ax[i] === 'x' ? x + ws[i] / 2 : x1 - (i === 5 ? 2.2 : 0), ax[i] === 'x' ? (backs[i] + 20) / 2 : -8 + (i % 3) * 6, 3.2]] })
      x = x1
    }
    block(hs)
    step(-42, 21.6, 4.5, 2.2); step(-16, 21.6, 4.5, 2.2); step(10, 21.6, 4.5, 2.2); step(38, 21.6, 4.5, 2.2)
  }
  /** 2: L-shaped corner block: a range along the street at +y and another up the street at +x. */
  function hs2() {
    const hs = []
    const xs = [-50, -30, -11, 9, 28], ks = ['tile', 'slate', 'tile3', 'shingle']
    for (let i = 0; i < 4; i++) hs.push({ x0: xs[i], y0: -6 - (i % 2) * 2, x1: xs[i + 1], y1: 22, ax: 'y', kind: ks[i], ch: [[xs[i + 1], -2 + i * 2, 3.3]] })
    hs.push({ x0: 28, y0: -6, x1: 50, y1: 22, ax: 'x', kind: 'slate2', hip1: true, ch: [[34, 8, 3.4]] })
    const ys = [-50, -28, -6], ks2 = ['tile2', 'thatch']
    for (let i = 0; i < 2; i++) hs.push({ x0: 29 + (i % 2) * 2, y0: ys[i], x1: 50, y1: ys[i + 1], ax: 'x', kind: ks2[i], ch: i ? [] : [[40, -28, 3.3]] })
    block(hs, 7)
    step(-20, 23.6, 5, 2.4); step(18, 23.6, 5, 2.4); step(51.6, -40, 2.4, 5); step(51.6, -16, 2.4, 5)
  }
  /** 3: U-shaped block round a back yard, open to -y: a well, a woodpile and a tree in the yard. */
  function hs3() {
    const yard = rect(-30, -34, 30, 2)
    ground(yard, 'earth')
    const hs = []
    const xs = [-50, -30, -10, 10, 30, 50], ks = ['slate', 'tile', 'tile2', 'thatch', 'slate2']
    for (let i = 0; i < 5; i++) hs.push({ x0: xs[i], y0: 2 - (i % 2 ? 1.5 : 0), x1: xs[i + 1], y1: 26, ax: 'y', kind: ks[i], ch: [[xs[i + 1] - (i === 4 ? 2.2 : 0), 8 + (i % 3) * 5, 3.3]] })
    hs.push({ x0: -50, y0: -34, x1: -30, y1: -16, ax: 'x', kind: 'tile3', ch: [[-40, -16, 3.3]] })
    hs.push({ x0: -50, y0: -16, x1: -31, y1: 2, ax: 'x', kind: 'shingle', ch: [] })
    hs.push({ x0: 30, y0: -34, x1: 50, y1: -14, ax: 'x', kind: 'tile', ch: [[40, -14, 3.3]] })
    hs.push({ x0: 31, y0: -14, x1: 50, y1: 2, ax: 'x', kind: 'slate', ch: [] })
    block(hs, 7)
    wallRun([-30, -34], [-8, -34], 2.2); wallRun([0, -34], [30, -34], 2.2)
    well(8, -16, 4.2)
    if (det >= 1) woodpile(-29, -8, -19, -2)
    tree(-14, -22, 6.5)
    step(-20, 27.6, 5, 2.4); step(20, 27.6, 5, 2.4)
  }
  /** 4: closed square block round a courtyard with little gardens. */
  function hs4() {
    const court = rect(-32, -22, 32, 22)
    ground(court, 'grass')
    ground(rect(-32, -3, 32, 3), 'gravel'); ground(rect(-3, -22, 3, 22), 'gravel')
    furrows(-26, -17, -8, -7, 0); furrows(8, -17, 26, -7, 0); furrows(-26, 7, -8, 17, 0); furrows(8, 7, 26, 17, 0)
    const hs = []
    const xs = [-50, -32, -10, 10, 32, 50], kn = ['tile', 'slate', 'tile2', 'thatch', 'tile'], ksn = ['slate2', 'tile3', 'shingle', 'slate', 'tile2']
    for (let i = 0; i < 5; i++) {
      hs.push({ x0: xs[i], y0: -40, x1: xs[i + 1], y1: -22, ax: i === 0 || i === 4 ? 'x' : 'y', kind: kn[i], ch: [[i === 0 || i === 4 ? (xs[i] + xs[i + 1]) / 2 : xs[i + 1], i === 0 || i === 4 ? -31 : -34 + (i % 2) * 6, 3.3]] })
      hs.push({ x0: xs[i], y0: 22, x1: xs[i + 1], y1: 40, ax: i === 0 || i === 4 ? 'x' : 'y', kind: ksn[i], ch: [[i === 0 || i === 4 ? (xs[i] + xs[i + 1]) / 2 : xs[i + 1] - (i === 4 ? 2.2 : 0), i === 0 || i === 4 ? 31 : 28 + (i % 2) * 6, 3.3]] })
    }
    hs.push({ x0: -50, y0: -22, x1: -32, y1: 0, ax: 'x', kind: 'shingle', ch: [[-41, 0, 3.3]] })
    hs.push({ x0: -50, y0: 0, x1: -32, y1: 22, ax: 'x', kind: 'tile', ch: [] })
    hs.push({ x0: 32, y0: -22, x1: 50, y1: 0, ax: 'x', kind: 'slate', ch: [[41, 0, 3.3]] })
    hs.push({ x0: 32, y0: 0, x1: 50, y1: 22, ax: 'x', kind: 'tile2', ch: [] })
    block(hs, 7)
    tree(-18, 0, 5)
    step(0, 41.6, 5, 2.4); step(-21, 41.6, 4.5, 2.4); step(21, 41.6, 4.5, 2.4)
  }
  /** 5: a loose cluster of five houses, each set a little askew, with a trodden alley between the two rows. */
  function hs5() {
    const alley = [[-50, -3], [-20, -5], [10, -2], [50, -4], [50, 4], [10, 6], [-20, 3], [-50, 5]]
    ground(alley, 'earth')
    if (det >= 1) { pl([[-50, -3], [-20, -5], [10, -2], [50, -4]], 0.5, { taper: 0.7, wob: 0.6 }); pl([[-50, 5], [-20, 3], [10, 6], [50, 4]], 0.5, { taper: 0.7, wob: 0.6 }) }
    const put = (cx, cy, w, h, ang, kind, ax, ch, hip) => turned(cx, cy, ang, () => {
      const p = rect(-w / 2, -h / 2, w / 2, h / 2)
      castShadow([p], 6)
      house(-w / 2, -h / 2, w / 2, h / 2, ax, { kind, hip0: hip, hip1: hip })
      if (ch) stack(ch[0], ch[1], 3.2)
      if (ax === 'y') step(0, h / 2 + 1.4, 4, 2); else step(w * 0.2, h / 2 + 1.4, 4, 2)
    })
    put(-30, -22, 32, 20, -0.12, 'thatch', 'x', [-9, 0], true)
    put(12, -25, 26, 18, 0.08, 'tile', 'x', [8, 0])
    put(40, -15, 16, 15, 0.22, 'shingle', 'y', [-6, -2])
    put(-29, 20, 26, 22, 0.05, 'slate', 'y', [-10, 4])
    put(22, 21, 32, 20, -0.07, 'tile2', 'x', [-9, 0])
    if (det >= 1) { tub(-9, 16, 2.2, true); woodpile(2, 12, 10, 16) }
  }
  /** 6: row of shops with their roofs along the street, chimneys on the party walls and awnings out over the pavement. */
  function hs6() {
    const xs = [-50, -32, -12, 8, 30, 50], ks = ['tile', 'slate', 'tile3', 'tile2', 'slate2'], ax = ['x', 'x', 'y', 'x', 'x']
    const hs = []
    for (let i = 0; i < 5; i++) hs.push({ x0: xs[i], y0: -18 - (i === 2 ? 3 : 0), x1: xs[i + 1], y1: 18, ax: ax[i], kind: ks[i], sh: i === 2 ? 8 : 7, ch: i === 4 ? [[48, 0, 3.4]] : [[xs[i + 1], ax[i] === 'x' ? 0 : -6, 3.4]] })
    block(hs)
    awning(-30, -14, 18, 5, 1); awning(10, 28, 18, 5, 2); awning(-48, -36, 18, 4.5, null)
    step(-2, 19.6, 5, 2.4); step(40, 19.6, 5, 2.4)
    if (det >= 1) { tub(31.5, 21, 2, false); crate(44, 21, 3.2) }
  }
  /** 7: two rows back to back with a narrow lane between; the north row faces -y, the south row +y. */
  function hs7() {
    ground(rect(-50, -5, 50, 5), 'earth')
    const hs = []
    const xn = [-50, -28, -8, 14, 34, 50], kn = ['tile2', 'slate', 'tile', 'thatch', 'slate2']
    for (let i = 0; i < 5; i++) hs.push({ x0: xn[i], y0: -30, x1: xn[i + 1], y1: -5 + (i % 2 ? -1.5 : 0), ax: 'y', kind: kn[i], ch: [[xn[i + 1] - (i === 4 ? 2.2 : 0), -9 - (i % 2) * 4, 3.3]] })
    const xsn = [-50, -32, -10, 10, 30, 50], ks = ['shingle', 'tile', 'slate', 'tile3', 'tile2']
    for (let i = 0; i < 5; i++) hs.push({ x0: xsn[i], y0: 5 + (i % 2 ? 1.5 : 0), x1: xsn[i + 1], y1: 30, ax: 'y', kind: ks[i], ch: [[xsn[i + 1] - (i === 4 ? 2.2 : 0), 9 + (i % 2) * 4, 3.3]] })
    block(hs, 7)
    step(-39, -31.6, 4.5, 2.2); step(3, -31.6, 4.5, 2.2); step(42, -31.6, 4.5, 2.2)
    step(-21, 31.6, 4.5, 2.2); step(20, 31.6, 4.5, 2.2)
    if (det >= 1) { tub(-24, 1, 1.8, true); crate(18, -1, 2.6) }
  }
  reg('ct-houses', 'Houses', 'ct-houses', 0.5, [hs0, hs1, hs2, hs3, hs4, hs5, hs6, hs7])

  /* =====================================================================================================================
     MANOR: a big house with wings, courts and gardens
     ===================================================================================================================== */
  const SLATE = { kind: 'slate' }, TILE = { kind: 'tile' }
  /** 0: H-plan in slate: a hall between two cross wings, a walled forecourt with a gate on the street. */
  function mn0() {
    ground(rect(-50, 10, 50, 44), 'gravel')
    const main = rect(-30, -10, 30, 10), wl = rect(-50, -27, -30, 27), wr = rect(30, -27, 50, 27)
    const sil = [[-50, -27], [-30, -27], [-30, -10], [30, -10], [30, -27], [50, -27], [50, 27], [30, 27], [30, 10], [-30, 10], [-30, 27], [-50, 27]]
    castShadow([main, wl, wr], 9)
    if (UP) { // the hall runs into the wings' roofs
      house(-50, -27, -30, 27, 'y', { ...SLATE, ch: [[-40, -14, 4]] }); house(30, -27, 50, 27, 'y', { ...SLATE, ch: [[40, 16, 4]] })
      house(-30, -10, 30, 10, 'x', { ...SLATE, v0: true, v1: true, nudge: 1, ch: [[-20, 0, 4], [20, 0, 4]] })
    } else {
      baseOf(sil, 'slate')
      gable(-30, -10, 30, 10, 'x', SLATE)
      gable(-50, -27, -30, 27, 'y', SLATE); gable(30, -27, 50, 27, 'y', SLATE)
      ln([-30, -10], [-30, 10], 1.3, { taper: 0.3 }); ln([30, -10], [30, 10], 1.3, { taper: 0.3 })
      outline(sil, 1.6); eaveBand(sil)
      if (det >= 2) { dormer(-14, 2, 11.5, 6, SLATE); dormer(14, 2, 11.5, 6, SLATE) }
      stack(-20, 0, 4); stack(20, 0, 4); stack(-40, -14, 4); stack(40, 16, 4)
    }
    wallRun([-50, 27], [-50, 44]); wallRun([50, 27], [50, 44]); wallRun([-50, 44], [-7, 44]); wallRun([7, 44], [50, 44])
    post(-7, 44, 1.3); post(7, 44, 1.3)
    step(0, 11.8, 7, 2.6)
    if (det >= 1) { tree(-40, 36, 5); tree(40, 36, 5) }
  }
  /** 1: E-plan in tile: a long range, two wings and a central porch towards the street, a kitchen garden behind a hedge. */
  function mn1() {
    ground(rect(-50, -47, 50, -24), 'grass'); ground(rect(-50, -30, 50, -24), 'gravel'); ground(rect(-34, -6, 34, 24), 'gravel')
    furrows(-46, -43, -20, -31, 0); furrows(-14, -43, 14, -31, 0); furrows(20, -43, 46, -31, 0)
    hedge([-50, -47], [50, -47], 2.8); hedge([-50, -46], [-50, -26], 2.6); hedge([50, -46], [50, -26], 2.6)
    const range = rect(-50, -24, 50, -6), wl = rect(-50, -6, -34, 22), wr = rect(34, -6, 50, 22), porch = rect(-7, -6, 7, 8)
    const sil = [[-50, -24], [50, -24], [50, 22], [34, 22], [34, -6], [7, -6], [7, 8], [-7, 8], [-7, -6], [-34, -6], [-34, 22], [-50, 22]]
    castShadow([range, wl, wr, porch], 9)
    if (UP) { // the wings and the porch run into the range's roof
      house(-50, -24, 50, -6, 'x', { ...TILE, ch: [[-40, -15, 4], [-14, -15, 4], [14, -15, 4], [40, -15, 4]] })
      house(-50, -6, -34, 22, 'y', { ...TILE, v0: true }); house(34, -6, 50, 22, 'y', { ...TILE, v0: true }); house(-7, -6, 7, 8, 'y', { ...TILE, v0: true })
    } else {
      baseOf(sil, 'tile')
      gable(-50, -24, 50, -6, 'x', TILE)
      gable(-50, -6, -34, 22, 'y', TILE); gable(34, -6, 50, 22, 'y', TILE); gable(-7, -6, 7, 8, 'y', TILE)
      ln([-34, -6], [-7, -6], 1.3, { taper: 0.3 }); ln([7, -6], [34, -6], 1.3, { taper: 0.3 })
      outline(sil, 1.6); eaveBand(sil)
      stack(-40, -15, 4); stack(-14, -15, 4); stack(14, -15, 4); stack(40, -15, 4)
    }
    step(0, 9.8, 7, 2.6)
    if (det >= 1) { tree(-44, 26, 5); tree(44, 26, 5) }
  }
  /** 2: courtyard house: four tiled ranges round a cobbled court, a gatehouse tower on the south side, a well. */
  function mn2() {
    courtyard(-50, -36, 50, 36, 16, { kind: 'tile', sh: 9 })
    sqTower(-9, 20, 9, 40, 'slate', 12)
    if (UP) doorIn([-3.2, 40], [3.2, 40], S, 7 * BH, true); else fillPoly(rect(-3, 36.2, 3, 41), INK)
    well(6, 0, 4.5)
    stack(-30, -28, 4); stack(30, -28, 4); stack(-42, 10, 4); stack(42, -10, 4); stack(-22, 28, 4)
    if (det >= 1) { tub(-24, -16, 2.2, true); crate(24, 14, 3.4) }
  }
  /** 3: an L-shaped house with a walled garden: four beds inside a hedge, gravel paths, a tree, a gate in the wall. */
  function mn3() {
    ground(rect(-30, -30, 50, 30), 'grass')
    ground(rect(-2, -3, 48, 3), 'gravel'); ground(rect(21, -22, 27, 22), 'gravel'); ground(rect(-30, 4, -2, 10), 'gravel')
    furrows(0, -20, 19, -5, 0); furrows(29, -20, 46, -5, 0); furrows(0, 5, 19, 20, 0); furrows(29, 5, 46, 20, 0)
    hedge([-2, -22], [48, -22], 2.2); hedge([-2, 22], [48, 22], 2.2); hedge([-2, -22], [-2, 2], 2.2); hedge([-2, 5], [-2, 22], 2.2); hedge([48, -22], [48, 22], 2.2)
    tree(-16, 16, 7)
    const main = rect(-50, -30, -6, -8), wing = rect(-50, -8, -30, 24)
    const sil = [[-50, -30], [-6, -30], [-6, -8], [-30, -8], [-30, 24], [-50, 24]]
    castShadow([main, wing], 9)
    if (UP) {
      house(-50, -30, -6, -8, 'x', { kind: 'tile', hip1: true, ch: [[-40, -19, 4], [-14, -19, 4]] })
      house(-50, -8, -30, 24, 'y', { ...TILE, v0: true, ch: [[-40, 10, 4]] })
    } else {
      baseOf(sil, 'tile')
      gable(-50, -30, -6, -8, 'x', { kind: 'tile', hip1: true }); gable(-50, -8, -30, 24, 'y', TILE)
      ln([-30, -8], [-6, -8], 1.3, { taper: 0.3 })
      outline(sil, 1.6); eaveBand(sil)
      stack(-40, -19, 4); stack(-14, -19, 4); stack(-40, 10, 4)
    }
    wallRun([-6, -30], [50, -30]); wallRun([50, -30], [50, 30]); wallRun([50, 30], [14, 30]); wallRun([6, 30], [-30, 30]); wallRun([-30, 24], [-30, 30])
    post(6, 30, 1.2); post(14, 30, 1.2)
    step(-20, -6.2, 6, 2.4)
  }
  /** 4: fortified manor: a hall with a round tower at one corner inside a curtain wall, a gatehouse and a stable in the yard. */
  function mn4() {
    ground(rect(-50, -40, 50, 34), 'earth')
    const hall = rect(-34, -26, 26, -2), stable = rect(-46, 2, -32, 26)
    castShadow([hall], 9)
    if (UP) house(-34, -26, 26, -2, 'x', { ...SLATE, nudge: -8, ch: [[-20, -14, 4], [10, -14, 4]] }) // drawn before the tower at its end
    else { baseOf(hall, 'slate'); gable(-34, -26, 26, -2, 'x', SLATE); outline(hall, 1.6); eaveBand(hall); stack(-20, -14, 4); stack(10, -14, 4) }
    const zt = roundTower(30, -20, 11, 'slate', 14, 10)
    castShadow([stable], 6)
    if (UP) house(-46, 2, -32, 26, 'y', { kind: 'plank', sh: 5 })
    else { baseOf(stable, 'plank'); gable(-46, 2, -32, 26, 'y', { kind: 'plank' }); outline(stable, 1.4, { noext: true }) }
    well(2, 14, 4)
    wallRun([-50, -40], [50, -40], 3); wallRun([50, -40], [50, 34], 3); wallRun([-50, -40], [-50, 34], 3); wallRun([-50, 34], [-9, 34], 3); wallRun([9, 34], [50, 34], 3)
    sqTower(-9, 28, 9, 40, 'slate', 11)
    if (UP) doorIn([-3.2, 40], [3.2, 40], S, 7 * BH, true); else fillPoly(rect(-3, 34.2, 3, 41), INK)
    if (det >= 1) { haystack(38, 20, 5); woodpile(-30, -36, -16, -30) }
    pennant(30, -20, 9, 0.3, undefined, UP ? zt : 0)
  }
  /** 5: timber hall under thatch with a kitchen, barn and stable round a fenced yard. */
  function mn5() {
    ground(rect(-50, -36, 50, 38), 'earth')
    const hall = rect(-48, -16, -4, 10), kit = rect(6, -32, 24, -16), barn = rect(14, -6, 48, 18), stab = rect(-44, 18, -14, 34)
    if (UP) {
      castShadow([hall], 8); castShadow([kit], 6); castShadow([barn], 7); castShadow([stab], 6)
      house(-48, -16, -4, 10, 'x', { kind: 'thatch', hip0: true, hip1: true, ch: [[-26, -3, 4]] })
      house(6, -32, 24, -16, 'x', { kind: 'thatch2', sh: 5, ch: [[10, -24, 3.4]] })
      house(14, -6, 48, 18, 'x', { kind: 'plank', sh: 6, door: false }); doorIn([27, 18], [37, 18], S, 6.5 * BH)
      house(-44, 18, -14, 34, 'x', { kind: 'shingle', sh: 5 })
    } else {
      castShadow([hall], 8); baseOf(hall, 'thatch'); gable(-48, -16, -4, 10, 'x', { kind: 'thatch', hip0: true, hip1: true }); outline(hall, 1.6); ragged(hall)
      stack(-26, -3, 4)
      castShadow([kit], 6); baseOf(kit, 'thatch2'); gable(6, -32, 24, -16, 'x', { kind: 'thatch2' }); outline(kit, 1.4, { noext: true }); ragged(kit)
      stack(10, -24, 3.4)
      castShadow([barn], 7); baseOf(barn, 'plank'); gable(14, -6, 48, 18, 'x', { kind: 'plank' }); outline(barn, 1.5, { noext: true }); eaveBand(barn)
      fillPoly(rect(28, 17.5, 36, 19.5), INK)
      castShadow([stab], 6); baseOf(stab, 'shingle'); gable(-44, 18, -14, 34, 'x', { kind: 'shingle' }); outline(stab, 1.4, { noext: true })
    }
    haystack(36, 30, 6); well(2, 26, 3.6)
    if (det >= 1) { woodpile(-46, -30, -32, -22); tub(-2, -18, 2, true) }
    const fo = { gap: 6 }
    fenceSeg([-50, -36], [50, -36], fo); fenceSeg([50, -36], [50, 38], fo); fenceSeg([-50, -36], [-50, 38], fo); fenceSeg([-50, 38], [-5, 38], fo); fenceSeg([8, 38], [50, 38], fo)
  }
  /** 6: town mansion on the street at +y: pavilions at both ends, a pediment over the door, steps, and a formal garden behind. */
  function mn6() {
    ground(rect(-50, -44, 50, -2), 'grass')
    ground(rect(-3, -16, 3, -2), 'gravel')
    furrows(-40, -40, -12, -30, 0); furrows(12, -40, 40, -30, 0); furrows(-40, -18, -12, -8, 0); furrows(12, -18, 40, -8, 0)
    hedge([-44, -42], [44, -42], 2.2); hedge([-44, -42], [-44, -6], 2.2); hedge([44, -42], [44, -6], 2.2)
    const o1 = oval(0, -24, 8, 8), o2 = oval(0, -24, 6.4, 6.4), pond = () => { paint(o1, STONE(), 0.1); loop(o1, 1.2); fillPoly(o2, COL ? mix(T.water, PAPER, 0.25) : PAPER); loop(o2, 0.7, { flat: true }) }
    if (UP) later([0, -24], () => { sides(o1, 0, 1.4 * BH, STONE()); lifted(1.4 * BH, pond) }); else pond()
    if (det >= 1) { tree(-47, -40, 4.5); tree(47, -40, 4.5) }
    wallRun([-50, -44], [50, -44]); wallRun([-50, -44], [-50, -2]); wallRun([50, -44], [50, -2])
    const main = rect(-22, 2, 22, 28), pl0 = rect(-42, -2, -22, 30), pr = rect(22, -2, 42, 30)
    const sil = [[-42, -2], [-22, -2], [-22, 2], [22, 2], [22, -2], [42, -2], [42, 30], [-42, 30]]
    castShadow([main, pl0, pr], 10)
    if (UP) { // steep-roofed pavilions, the main range running into them (its valleys meet their steeper roofs)
      house(-42, -2, -22, 30, 'y', { ...SLATE, hip0: true, hip1: true, pitch: 1 }); house(22, -2, 42, 30, 'y', { ...SLATE, hip0: true, hip1: true, pitch: 1 })
      house(-22, 2, 22, 28, 'x', { ...SLATE, v0: 9.75, v1: 9.75, nudge: 1, ch: [[-10, 15, 4], [10, 15, 4]] })
    } else {
      baseOf(sil, 'slate')
      gable(-22, 2, 22, 28, 'x', SLATE)
      pyramid(-42, -2, -22, 30, SLATE); pyramid(22, -2, 42, 30, SLATE)
      ln([-22, 2], [-22, 28], 1.3, { taper: 0.3 }); ln([22, 2], [22, 28], 1.3, { taper: 0.3 })
      outline(sil, 1.6); eaveBand(sil)
      dormer(0, 19, 30.5, 10, SLATE)
      if (det >= 2) { dormer(-12, 20, 29.5, 5, SLATE); dormer(12, 20, 29.5, 5, SLATE) }
      stack(-10, 15, 4); stack(10, 15, 4)
    }
    steps(-7, 30, 7, 35, 3, 'x')
    if (det >= 1) { post(-15, 33, 1.1); post(15, 33, 1.1) }
  }
  /** 7: the manor in ruins: roofless walls round grassy floors, one wing still under its slates, an old garden wall. */
  function mn7() {
    const rooms = [rect(-30, -12, 30, 12), rect(-48, -26, -30, 26), rect(30, -26, 48, 14)]
    const pieces = [
      [[-30, 4], [-30, 26], [-40, 26]],
      [[-30, -12], [-6, -12]], [[8, -12], [30, -12]], [[-20, 12], [0, 12]], [[12, 12], [30, 12], [30, 14]],
      [[30, -26], [48, -26], [48, -4]], [[48, 6], [48, 14], [38, 14]],
      [[-50, 36], [-20, 36]], [[0, 36], [30, 36], [30, 28]],
    ]
    ruinWalls(rooms, pieces, 3, 3.5)
    const wing = rect(-49.5, -27.5, -28.5, -2)
    castShadow([wing], 8)
    if (UP) house(-49.5, -27.5, -28.5, -2, 'y', { ...SLATE, ch: [[-39, -22, 4]] })
    else { baseOf(wing, 'slate'); gable(-49.5, -27.5, -28.5, -2, 'y', SLATE); outline(wing, 1.5, { noext: true }) }
    if (det >= 1) { tree(10, 0, 7); stone(-12, 4, 2.2); stone(20, -4, 1.8); stone(40, 6, 2.4) }
    stack(-39, -22, 4)
  }
  reg('ct-manor', 'Manor house', 'ct-houses', 0.7, [mn0, mn1, mn2, mn3, mn4, mn5, mn6, mn7])

  /* =====================================================================================================================
     GUILDHALL: big civic buildings
     ===================================================================================================================== */
  /** 0: long hall with a bell tower at the west end, buttresses down the sides and steps to the door. */
  function gh0() {
    const hall = rect(-30, -16, 50, 16)
    castShadow([hall], 10)
    if (UP) house(-30, -16, 50, 16, 'x', { kind: 'slate', hip1: true, sh: 8, ch: [[36, 0, 4.2]] })
    else { baseOf(hall, 'slate'); gable(-30, -16, 50, 16, 'x', { kind: 'slate', hip1: true }); outline(hall, 1.7); eaveBand(hall) }
    if (det >= 1) for (const bx of [-18, -2, 14, 30]) for (const sy of [-1, 1]) {
      const bu = rect(bx - 1.6, sy > 0 ? 16 : -19, bx + 1.6, sy > 0 ? 19 : -16), top = () => { paint(bu, STONE(), 0.1); outline(bu, 1, { noext: true, flat: true }) }
      if (UP) standUp([bx, sy * 17.5], bu, 8 * BH, STONE(), top, 2); else { castShadow([bu], 2); top() }
    }
    const zt = sqTower(-50, -12, -30, 12, 'slate', 15)
    pennant(-40, 0, 10, 0.3, undefined, UP ? zt : 0)
    steps(-4, 16, 12, 21, 3, 'x')
    stack(36, 0, 4.2)
    doorIn([0.5, 16], [7.5, 16], S, 6.5 * BH, true)
  }
  /** 1: market hall: a big hipped roof standing on pillars, a lantern on the ridge, stalls spilling out from under the eaves. */
  function gh1() {
    const roof = rect(-46, -22, 46, 22), H = 8 * 1.25 * BH
    castShadow([roof], 8)
    if (UP) { // open on all sides: the paved floor, the shade under the roof, the pillars, the roof, a lantern on its ridge
      ground(roof, 'cobble'); underRoof(-46, -22, 46, 22, H)
      house(-46, -22, 46, 22, 'x', { kind: 'tile', hip0: true, hip1: true, sh: 8, open: true })
      later([0, 0], () => lifted(H + 22 * 0.75 - 4.5, () => birdTower(-6, -6, 6, 6, 'slate', 4.5 * BH)), 1)
    } else {
      baseOf(roof, 'tile')
      gable(-46, -22, 46, 22, 'x', { kind: 'tile', hip0: true, hip1: true })
      outline(roof, 1.6); eaveBand(roof)
      const cu = rect(-6, -6, 6, 6)
      castShadow([cu], 4); baseOf(cu, 'slate'); pyramid(-6, -6, 6, 6, SLATE); outline(cu, 1.3, { noext: true })
      fillPoly(oval(0, 0, Math.max(0.9, K(0.9)), Math.max(0.9, K(0.9)), 6), INK)
    }
    for (let x = -44; x <= 44.1; x += 11) { pillar(x, -22, 1.3, H); pillar(x, 22, 1.3, H) }
    for (let y = -11; y <= 11.1; y += 11) { pillar(-46, y, 1.3, H); pillar(46, y, 1.3, H) }
    awning(-38, -26, 22, 5, 1); awning(-6, 6, 22, 5, 3); awning(24, 36, 22, 5, 2)
    if (det >= 1) { crate(-16, 25, 3); tub(14, 25, 2, false) }
  }
  /** 2: hall round a courtyard: slate ranges, a gabled gatehouse through the south range, a statue in the court. */
  function gh2() {
    courtyard(-50, -34, 50, 34, 15, { kind: 'slate', sh: 10, floor: 'cobble' })
    const gh = rect(-10, 17, 10, 40)
    castShadow([gh], 13)
    const pl1 = rect(-2.5, -2.5, 2.5, 2.5), plinth = () => { paint(pl1, STONE(), 0.2); outline(pl1, 1, { noext: true }) }
    if (UP) { // the gatehouse stands taller than the ranges, its arch facing the street; a statue on a plinth in the court
      house(-10, 17, 10, 40, 'y', { ...TILE, sh: 13, door: false }); doorIn([-3.5, 40], [3.5, 40], S, 8 * BH, true)
      standUp([0, 0], pl1, 3 * BH, STONE(), plinth, 2)
      const zs = 3 * BH, fig = oval(0, 0, 1.3, 1.3, 10)
      later([0, 0.1], () => { sides(fig, zs, zs + 5 * BH, lighter(STONE(), 0.2)); lifted(zs + 5 * BH, () => { paint(fig, lighter(STONE(), 0.2), 0.1); loop(fig, 0.8) }) })
    } else {
      baseOf(gh, 'tile'); gable(-10, 17, 10, 40, 'y', TILE); outline(gh, 1.6, { noext: true })
      fillPoly(rect(-3.5, 34.2, 3.5, 41), INK)
      castShadow([pl1], 7); plinth()
    }
    stack(-30, -27, 4); stack(30, -27, 4); stack(-42, 8, 4); stack(42, -8, 4)
    pennant(0, 28.5, 9, 0.3, undefined, UP ? 13 * 1.25 * BH + 7.5 : 0)
  }
  /** 3: town hall on a square: a broad tiled roof, a tower over the middle, a wide flight of steps onto the paving. */
  function gh3() {
    ground(rect(-50, 8, 50, 24), 'cobble')
    const b = rect(-50, -24, 50, 8)
    castShadow([b], 10)
    let zt = 0
    if (UP) { // the tower rises out of the roof: its front wall starts where it comes through the roof slope
      house(-50, -24, 50, 8, 'x', { kind: 'tile', hip0: true, hip1: true, ch: [[-38, -8, 4], [38, -8, 4]] })
      const zr = 7 * 1.25 * BH + 16 * 0.75 * 0.5, Ht = 14 * 1.6 * BH
      castShadow([rect(-8, -16, 8, 0)], 14)
      later([0, -8], () => lifted(zr, () => birdTower(-8, -16, 8, 0, 'slate', Ht - zr)), 1)
      zt = Ht + 8 * 1.6
      doorIn([-4, 8], [4, 8], S, 6.5 * BH, true)
    } else {
      baseOf(b, 'tile')
      gable(-50, -24, 50, 8, 'x', { kind: 'tile', hip0: true, hip1: true })
      outline(b, 1.7); eaveBand(b)
      if (det >= 2) { dormer(-30, 0, 9.5, 7, TILE); dormer(30, 0, 9.5, 7, TILE) }
      sqTower(-8, -16, 8, 0, 'slate', 14)
    }
    pennant(0, -8, 10, 0.3, undefined, zt)
    stack(-38, -8, 4); stack(38, -8, 4)
    steps(-30, 8, 30, 18, 5, 'x')
    for (const sx of [-1, 1]) {
      const pb = rect(sx > 0 ? 30 : -35, 8, sx > 0 ? 35 : -30, 18), top = () => { paint(pb, STONE(), 0.15); outline(pb, 1.1, { noext: true }) }
      if (UP) standUp([sx * 32.5, 13], pb, 2.6 * BH, STONE(), top, 2.5); else { castShadow([pb], 2.5); top() }
    }
    if (det >= 1) { post(-42, 16, 1.1); post(42, 16, 1.1); pennant(-42, 16, 7, 0.4); pennant(42, 16, 7, 0.4) }
  }
  /** 4: trade hall: a long shingled roof with two loading gables and hoists on the street side, goods stacked outside. */
  function gh4() {
    const b = rect(-50, -22, 50, 12), gl = rect(-40, 4, -20, 20), gr = rect(20, 4, 40, 20)
    const sil = [[-50, -22], [50, -22], [50, 12], [40, 12], [40, 20], [20, 20], [20, 12], [-20, 12], [-20, 20], [-40, 20], [-40, 12], [-50, 12]]
    castShadow([b, gl, gr], 10)
    if (UP) { // the loading gables run into the main roof; a hoist beam juts out over each loading door
      house(-50, -22, 50, 12, 'x', { kind: 'shingle', ch: [[-10, -5, 4], [12, -5, 4]] })
      for (const cx of [-30, 30]) {
        house(cx - 10, 12, cx + 10, 20, 'y', { kind: 'shingle', v0: true, door: false }); doorIn([cx - 4, 20], [cx + 4, 20], S, 6 * BH)
        const zb = 7 * 1.25 * BH + 5
        later([cx, 20], () => { ln(lift([cx, 20], zb), lift([cx, 25], zb), 1.6, { taper: 0.15 }); ln(lift([cx, 25], zb), lift([cx, 25], 2.5 * BH), 0.6, { taper: 0.1 }) }, 0.1)
      }
    } else {
      baseOf(sil, 'shingle')
      gable(-50, -22, 50, 12, 'x', { kind: 'shingle' })
      gable(-40, 4, -20, 20, 'y', { kind: 'shingle' }); gable(20, 4, 40, 20, 'y', { kind: 'shingle' })
      ln([-40, 4], [-20, 4], 0.9, { taper: 0.3 }); ln([20, 4], [40, 4], 0.9, { taper: 0.3 })
      outline(sil, 1.7); eaveBand(sil)
      for (const cx of [-30, 30]) {
        ln([cx, 20], [cx, 25], 1.3, { taper: 0.2 }); fillPoly(oval(cx, 25, Math.max(0.9, K(0.9)), Math.max(0.9, K(0.9)), 6), INK)
        fillPoly(rect(cx - 4, 18.5, cx + 4, 20.3), INK)
      }
    }
    stack(-10, -5, 4); stack(12, -5, 4)
    if (det >= 1) { tub(-8, 16, 2.4, false); tub(-3, 17.5, 2.4, false); crate(4, 15.5, 4); crate(9, 17, 3); cart(46, 24, 11, 6.5, 0.15) }
  }
  /** 5: hall with a clock tower: a slate hall and a square tower under an eight-sided spire. */
  function gh5() {
    const hall = rect(-50, -18, 20, 18), tw = rect(20, -15, 50, 15)
    castShadow([hall], 10)
    if (UP) house(-50, -18, 20, 18, 'x', { kind: 'slate', hip0: true, ch: [[-30, 0, 4], [0, 0, 4]] })
    else { baseOf(hall, 'slate'); gable(-50, -18, 20, 18, 'x', { kind: 'slate', hip0: true }); outline(hall, 1.7); eaveBand(hall) }
    castShadow([tw], 17)
    if (UP) { // the tower, a clock high on the face that turns to you, corner pinnacles and an eight-sided spire
      const Ht = 17 * 1.6 * BH, hs = 13 * 2.1
      later([35, 0], () => {
        const NRM = [N, E, S, WD]
        for (let i = 0; i < 4; i++) if (faces(NRM[i]) > 0.02) birdWall(tw[i], tw[(i + 1) % 4], NRM[i], Ht, null, 'stone', { door: false })
        lifted(Ht, () => { paint(tw, lighter(STONE(), 0.1), 0.15); outline(tw, 1.4, { noext: true }) })
        let best = 0; for (let i = 1; i < 4; i++) if (faces(NRM[i]) > faces(NRM[best])) best = i
        const a = tw[best], b = tw[(best + 1) % 4], c = lift(lerp(a, b, 0.5), Ht * 0.8), cr = 3.6
        const face = []; for (let k = 0; k < 20; k++) { const t = (TAU * k) / 20, e = [(b[0] - a[0]) / 30, (b[1] - a[1]) / 30]; face.push([c[0] + e[0] * cos(t) * cr - UP[0] * sin(t) * cr, c[1] + e[1] * cos(t) * cr - UP[1] * sin(t) * cr]) }
        fillPoly(face, PAPER); loop(face, 0.9, { flat: true }); ln(c, [c[0] - UP[0] * cr * 0.7, c[1] - UP[1] * cr * 0.7], 0.8); ln(c, [c[0] + ((b[0] - a[0]) / 30) * cr * 0.5, c[1] + ((b[1] - a[1]) / 30) * cr * 0.5], 0.8)
        for (const p of tw.slice().sort((p, q) => near(p) - near(q))) if (det >= 1) pole([p[0] + (35 - p[0]) * 0.1, p[1] - p[1] * 0.1], Ht, Ht + 5 * BH, K(1.8))
        birdCone(35, 0, 13, Ht, hs, 8, PI / 8, (pts, k, f) => { paint(pts, kindCol('slate2'), clamp(0.3 + 0.5 * f, 0, 1)); if (f > 0.2 || !COL) hatchIn(pts, Math.atan2(UP[1], UP[0]), K(f > 0.6 ? 2.2 : 3.2), 0.45, { keep: 0.85 }) }, true)
      })
      pennant(35, 0, 11, 0.3, undefined, Ht + hs)
    } else {
      paint(tw, STONE(), 0.25)
      if (det >= 1) for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) post(35 + sx * 13.5, sy * 13.5, 1.1)
      outline(tw, 1.8)
      const sp = fan(35, 0, 13, 0, TAU, { kind: 'slate2', sides: 8, seams: 8 })
      outline(sp, 1.4, { noext: true })
      fillPoly(oval(35, 0, Math.max(1, K(1)), Math.max(1, K(1)), 6), INK)
      pennant(35, 0, 11, 0.3)
    }
    stack(-30, 0, 4); stack(0, 0, 4)
    steps(-20, 18, -8, 23, 3, 'x')
  }
  /** 6: temple-like hall: a tiled roof over the cella with a lower colonnade roof all round, columns under its eaves, steps in front. */
  function gh6() {
    const outer = rect(-50, -28, 50, 28), inner = rect(-36, -18, 36, 18)
    castShadow([outer], 9)
    if (UP) { // columns under a lean-to roof all round, and the cella rising out of it under its own gable
      const H1 = 7 * 1.25 * BH, rise = 7.5
      underRoof(-50, -28, 50, 28, H1)
      for (let x = -46; x <= 46.1; x += 9.2) { pillar(x, -28, 1.3, H1); pillar(x, 28, 1.3, H1) }
      for (let y = -18.4; y <= 18.5; y += 9.2) { pillar(-50, y, 1.3, H1); pillar(50, y, 1.3, H1) }
      later([0, 0], () => {
        const NRM = [N, E, S, WD], Eo = outer.map((q) => lift(q, H1)), Ii = inner.map((q) => lift(q, H1 + rise))
        birdRoof(NRM.map((d, i) => ({ pts: [Eo[i], Eo[(i + 1) % 4], Ii[(i + 1) % 4], Ii[i]], eave: [Eo[i], Eo[(i + 1) % 4]], top: [Ii[i], Ii[(i + 1) % 4]], d, run: i % 2 ? 14 : 10 })), rise, 'tile', {})
        for (let i = 0; i < 4; i++) crease(Eo[i], Ii[i], 1)
        outline(Eo, 1.4, { noext: true })
        lifted(H1 + rise, () => birdHouse(-36, -18, 36, 18, 'x', { ...TILE, sh: 4, blind: true, wall: mix(STONE(), PAPER, 0.35) }))
      })
      steps(-40, 28, 40, 34, 3, 'x')
      return
    }
    baseOf(outer, 'tile')
    plane([[-50, -28], [50, -28], [36, -18], [-36, -18]], N, TILE); plane([[50, -28], [50, 28], [36, 18], [36, -18]], E, TILE)
    plane([[50, 28], [-50, 28], [-36, 18], [36, 18]], S, TILE); plane([[-50, 28], [-50, -28], [-36, -18], [-36, 18]], WD, TILE)
    for (let i = 0; i < 4; i++) crease(outer[i], inner[i], 1)
    castShadow([inner], 5)
    baseOf(inner, 'tile'); gable(-36, -18, 36, 18, 'x', TILE)
    outline(inner, 1.4, { noext: true })
    outline(outer, 1.7); eaveBand(outer)
    for (let x = -46; x <= 46.1; x += 9.2) { pillar(x, -28, 1.3); pillar(x, 28, 1.3) }
    for (let y = -18.4; y <= 18.5; y += 9.2) { pillar(-50, y, 1.3); pillar(50, y, 1.3) }
    steps(-40, 28, 40, 34, 3, 'x')
  }
  /** 7: the hall in ruins: broken walls, two rows of column stumps, fallen drums, a tree come up through the floor. */
  function gh7() {
    const rooms = [rect(-50, -22, 50, 22)]
    const pieces = [[[-50, 22], [-50, -22], [-12, -22]], [[4, -22], [50, -22], [50, -6]], [[50, 8], [50, 22], [22, 22]], [[-32, 22], [-10, 22]]]
    ruinWalls(rooms, pieces, 3.2, 3.5)
    for (const sy of [-1, 1]) for (const x of [-36, -24, -12, 0, 12, 24, 36]) {
      const up = (x + sy * 12 + 48) % 5 !== 0
      if (!up) continue
      const c = oval(x, sy * 11, 2.2, 2.2, 10), top = () => { paint(c, lighter(STONE(), 0.1), 0.2); loop(c, 1) }
      if (UP) standUp([x, sy * 11], c, rr(2, 9) * BH, lighter(STONE(), 0.1), top, 5); else { castShadow([c], 5); top() }
    }
    fallenColumn(8, 2, 16, 2, 0.35); fallenColumn(-26, 0, 12, 1.9, -0.2)
    if (det >= 1) { tree(30, 4, 8); stone(-6, 14, 2); stone(40, -14, 2.4); stone(-40, -10, 1.8) }
  }
  reg('ct-guildhall', 'Guildhall', 'ct-houses', 0.9, [gh0, gh1, gh2, gh3, gh4, gh5, gh6, gh7])

  /* =====================================================================================================================
     MARKET: market squares, flat paving with stalls, carts, a well, a cross or a fountain
     ===================================================================================================================== */
  /** 0: a round fountain with stalls set in a ring round it. */
  function mk0() {
    const p = oval(0, 0, 50, 38, 40, 0.02)
    ground(p, 'cobble'); plazaEdge(p)
    fountain(0, 0, 11)
    for (let k = 0; k < 8; k++) { const a = (TAU * k) / 8 + PI / 16; stall(cos(a) * 30, sin(a) * 23, 11, 6.5, [1, 2, 3, 0][k % 4], a + PI / 2) }
    if (det >= 1) { tub(-42, 6, 2.2, false); basket(42, -6, 1.8); basket(44, -2, 1.6) }
  }
  /** 1: a market cross with stalls in two rows either side and a cart or two. */
  function mk1() {
    const p = plaza(100, 66, 10)
    ground(p, 'cobble'); plazaEdge(p)
    cross(0, 0, 9)
    for (const x of [-38, -24, -10, 10, 24, 38]) stall(x, -20, 11, 7, [1, null, 2, 3, null, 1][(x + 38) / 14 | 0], jt(0.04))
    for (const x of [-31, -17, 17, 31]) stall(x, 20, 11, 7, [3, 2, 1, null][(x + 31) / 14 | 0], jt(0.04))
    cart(-42, 6, 11, 6.5, -1.4); cart(43, -4, 11, 6.5, 1.75)
    if (det >= 1) { tub(-2, 20, 2.2, false); crate(3, 21, 3); basket(-22, 4, 1.7) }
  }
  /** 2: covered stalls, two rows of plank-roofed sheds with a walk between, benches and baskets outside. */
  function mk2() {
    const p = plaza(100, 60, 8)
    ground(p, 'cobble'); plazaEdge(p)
    shedStall(-46, -24, -20, -11, 'plank'); shedStall(-13, -24, 13, -11, 'shingle'); shedStall(20, -24, 46, -11, 'plank')
    shedStall(-46, 11, -20, 24, 'shingle'); shedStall(-13, 11, 13, 24, 'plank'); shedStall(20, 11, 46, 24, 'plank')
    if (det >= 1) {
      for (const x of [-33, 0, 33]) { crate(x - 4, -6, 3); crate(x + 3, 6, 3.2) }
      basket(-18, -2, 1.7); basket(16, 1, 1.6); basket(19, 4, 1.5); tub(42, 0, 2.2, false)
    }
    stall(-30, 30, 10, 6, 2, 0.05); stall(28, -30, 10, 6, 1, -0.05)
  }
  /** 3: fish market on the quay: the quay edge at -y with bollards, stalls facing the water, barrels, baskets, a net drying. */
  function mk3() {
    const p = [[-50, -36], [50, -36], [50, 28], [42, 36], [-42, 36], [-50, 28]]
    ground(p, 'cobble'); plazaEdge(p)
    ln([-50, -36], [50, -36], 1.6, { taper: 0.15, wob: 0.2 }); if (det >= 1) ln([-50, -33.4], [50, -33.4], 0.7, { taper: 0.2, wob: 0.2 })
    for (const x of [-42, -26, -10, 6, 22, 38]) { const c = oval(x, -34.6, 1.3, 1.3, 8); if (UP) { post(x, -34.6, 1.3); continue } if (det >= 1) castShadow([c], 2); fillPoly(c, INK) }
    for (const x of [-34, -18, 0, 18, 34]) stall(x, -22, 12, 7, [2, null, 2, null, 2][(x + 34) / 17 | 0], jt(0.04))
    stall(-20, 14, 12, 7, null, 0.06); stall(2, 15, 12, 7, 2, -0.04); stall(24, 13, 12, 7, null, 0.03)
    if (det >= 1) {
      tub(40, -26, 2.4, false); tub(45, -24, 2.4, false); tub(42, -20, 2.4, false)
      basket(-44, -22, 1.8); basket(-46, -18, 1.6); basket(-42, -17, 1.6); basket(-8, -14, 1.6); basket(12, -13, 1.5)
      crate(-30, -10, 3); crate(34, -8, 3.4)
      net(-44, 4, -30, 16)
    }
    cart(42, 24, 11, 6.5, 0.3)
  }
  /** 4: livestock market: trodden ground, fenced pens full of sheep and cattle, a lane down the middle, a hay cart. */
  function mk4() {
    const p = plaza(100, 70, 8)
    ground(p, 'earth'); plazaEdge(p)
    pen(-46, -31, -26, -5, 'e'); pen(-22, -31, -2, -5, 'w'); pen(-46, 5, -26, 31, 'e'); pen(-22, 5, -2, 31, 'w')
    pen(8, -31, 46, -1, 's'); pen(8, 8, 46, 31, 'n')
    const sheep = (x0, y0, x1, y1, n) => { for (let i = 0; i < n; i++) beast(rr(x0 + 2, x1 - 2), rr(y0 + 2, y1 - 2), 2.1, false, r() * PI) }
    const cows = (x0, y0, x1, y1, n) => { for (let i = 0; i < n; i++) beast(rr(x0 + 2.5, x1 - 2.5), rr(y0 + 2.5, y1 - 2.5), 3.2, true, r() * PI) }
    sheep(-46, -31, -26, -5, 10); sheep(-22, 5, -2, 31, 9); cows(-22, -31, -2, -5, 4); cows(8, -31, 46, -1, 6); sheep(8, 8, 46, 31, 12)
    for (const tr of [rect(12, -30, 24, -27), rect(-44, 10, -41, 22)]) box(tr, 1.8, WOOD(), 1.4)
    cart(28, 3.5, 12, 6.5, 0); if (det >= 1) haystack(42, 4, 3)
    if (det >= 1) { post(-24, 36, 1.1); pennant(-24, 36, 6, 0.4) }
  }
  /** 5: fair day: round tents, carts drawn up, a fire ring and a flag. */
  function mk5() {
    const p = oval(0, 0, 50, 38, 40, 0.03)
    ground(p, 'earth'); plazaEdge(p)
    tent(-30, -14, 9, 1); tent(10, -20, 8, 2); tent(34, 8, 9, 3); tent(-10, 16, 7, 0); tent(-36, 20, 5.5, null); tent(36, -22, 5.5, null)
    cart(30, -8, 12, 7, 0.3); cart(-44, 2, 11, 6.5, -1.3); cart(8, 27, 12, 7, 2.9); cart(16, 4, 10, 6, 1.1)
    const fr = oval(-6, -4, 3.2, 3.2, 10); if (det >= 1) { for (let i = 0; i < 9; i++) { const a = (TAU * i) / 9; stone(-6 + cos(a) * 3.4, -4 + sin(a) * 3.4, 0.9) } } fillPoly(oval(-6, -4, 1.6, 1.6, 8), INK); if (det < 1) loop(fr, 0.7, { flat: true })
    post(-14, -30, 1.2); pennant(-14, -30, 9, 0.35, stripeCol(2))
    if (det >= 1) { tub(22, -28, 2.2, false); crate(-24, 30, 3); basket(2, -8, 1.6) }
  }
  /** 6: a small square with a well, three stalls, a tree with a bench under it and a cart. */
  function mk6() {
    const p = plaza(100, 64, 12)
    ground(p, 'cobble'); plazaEdge(p)
    well(-8, 2, 6.5)
    stall(-34, -16, 12, 7, 1, 0.1); stall(-30, 20, 11, 7, 3, -0.1); stall(14, -22, 12, 7, 2, 0.05)
    tree(32, 2, 10)
    box(rect(28, 15, 36, 17.4), 1.6, WOOD(), 1, 0.8)
    cart(42, -22, 11, 6.5, 0.4)
    if (det >= 1) { tub(-44, 4, 2.2, true); basket(-2, -10, 1.6); basket(1, -8, 1.5); crate(10, 22, 3) }
  }
  /** 7: a busy grid of awnings with narrow alleys between. */
  function mk7() {
    const p = plaza(100, 72, 6)
    ground(p, 'cobble'); plazaEdge(p)
    const vs = [1, 2, null, 3, 0, 1, 2, null, 1, 3, 2, 1]
    let k = 0
    for (const y of [-22, 0, 22]) for (const x of [-36, -12, 12, 36]) { stall(x, y, 16, 9, vs[k], jt(0.03)); k++ }
    if (det >= 2) { tub(-24, -10, 1.8, false); crate(24, 11, 2.6); basket(0, -11, 1.4); basket(-24, 12, 1.4); crate(-2, 34, 2.6) }
    if (det >= 1) { post(46, -34, 1.1); pennant(46, -34, 6, 0.4) }
  }
  reg('ct-market', 'Market', 'ct-houses', 0.7, [mk0, mk1, mk2, mk3, mk4, mk5, mk6, mk7])
})(window.Atlas)
