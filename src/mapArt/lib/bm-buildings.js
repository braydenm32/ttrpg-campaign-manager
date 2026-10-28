/* Battle-map buildings, seen from directly above (view 'top'): cottage, house, barn, tower, chapel, ruin, bridge, pavilion.
   Every piece is drawn in a design space where the LONG side of the footprint is 100 units (scaled by s/100), centred on (x, y).
   Light comes from the upper left: roof planes that slope down towards the lower right are shaded (heavier hatching, darker wash),
   and with st.shadows a cast shadow falls down and to the right. Fixed pieces have 8 hand-designed variants (variant 0-7);
   r() only adds hand-jitter to strokes there. Texture density follows the pixel size, so small pieces stay clean and large ones
   get individual shingles, thatch strokes and stone courses. */
;(function (A) {
  'use strict'
  const PI = Math.PI, TAU = PI * 2, sin = Math.sin, cos = Math.cos, hyp = Math.hypot
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
  const LX = 0.62, LY = 0.78 // direction the shade and the cast shadows run (down and to the right)
  let ctx, r, st, INK, PAPER, COL, T, SH, u, det, LW, ROW, TW, THA, SZ
  let KOV = {} // per-variant colour overrides by roof kind
  const rr = (a, b) => a + r() * (b - a)
  const jt = (a) => (r() - 0.5) * 2 * a
  const K = (px) => px / u // screen pixels to design units
  const W = (b) => (b * LW) / u // pen weight (about b pixels at line weight 1) in design units

  function open(c, x, y, s, rg, style) {
    ctx = c; r = rg; st = style; INK = st.ink; PAPER = st.paper; COL = st.mode === 'colour'; T = st.tint; SH = !!st.shadows
    SZ = s; u = s / 100; KOV = {}
    det = s >= 210 ? 3 : s >= 120 ? 2 : s >= 52 ? 1 : 0
    LW = st.line * clamp(0.55 + s / 330, 0.8, 1.6)
    const grow = Math.max(0, s - 60)
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
  const kindCol = (k) => KOV[k] ? KOV[k] : k === 'tile' ? T.roof : k === 'thatch' ? mix(T.sand, '#7b6330', 0.42) : k === 'slate' ? mix(T.rock, '#5a5f68', 0.34)
    : k === 'plank' ? WOOD() : k === 'shingle' ? mix(T.rock, '#6d4e34', 0.5) : k === 'stone' ? T.rock : T.sand

  /* ---------- paths and paint ---------- */
  function path(pts) { ctx.beginPath(); for (let i = 0; i < pts.length; i++) i ? ctx.lineTo(pts[i][0], pts[i][1]) : ctx.moveTo(pts[i][0], pts[i][1]); ctx.closePath() }
  function fillPoly(pts, col) { path(pts); ctx.fillStyle = col; ctx.fill() }
  const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
  const orient = (pts) => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1] } return a >= 0 ? 1 : -1 }
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
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
    for (const p of pts) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1] }
    const area = (x1 - x0) * (y1 - y0)
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
  /** Soft bands of shade on the lower right of a round or odd shape (colour mode): half-planes laid one over another. */
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
    if (det < 2) { // small sizes: two plain strokes, heavier on the shade side (much cheaper than a ribbon per edge)
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
    n = n || clamp(Math.round(Math.max(rx, ry) * u * 0.8), 14, 80)
    const full = a1 - a0 >= TAU - 0.001, out = [], ph = r() * 6, w = wob == null ? 0.006 : wob
    const m = full ? n : n + 1
    for (let i = 0; i < m; i++) { const a = a0 + (a1 - a0) * i / n, k = 1 + w * sin(a * 3 + ph) + jt(w * 0.5); out.push([cx + cos(a) * rx * k, cy + sin(a) * ry * k]) }
    return out
  }
  /** Rounded polygon: corners rounded with radius rad. */
  function rounded(pts, rad, steps) {
    const n = pts.length, out = []; steps = steps || 4
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i + n - 1) % n], p1 = pts[i], p2 = pts[(i + 1) % n]
      const d0 = hyp(p1[0] - p0[0], p1[1] - p0[1]), d2 = hyp(p2[0] - p1[0], p2[1] - p1[1]), k = Math.min(rad, d0 / 2, d2 / 2)
      const a = [p1[0] + (p0[0] - p1[0]) * k / d0, p1[1] + (p0[1] - p1[1]) * k / d0], b = [p1[0] + (p2[0] - p1[0]) * k / d2, p1[1] + (p2[1] - p1[1]) * k / d2]
      for (let j = 0; j <= steps; j++) { const t = j / steps, mt = 1 - t; out.push([mt * mt * a[0] + 2 * mt * t * p1[0] + t * t * b[0], mt * mt * a[1] + 2 * mt * t * p1[1] + t * t * b[1]]) }
    }
    return out
  }

  /** Hatching inside a polygon: lines at `ang`, `gap` apart, broken here and there like pen work. */
  function hatchIn(pts, ang, gap, w, o) {
    o = o || {}
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
    for (const p of pts) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1] }
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
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
    for (const p of pts) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1] }
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
  /** Boards running down the slope: butt joints staggered from board to board, nails at the joints, grain and the odd darker board. */
  function plankTex(pts, d, o) {
    const F = frame(pts, d), at = F.at, pw = o.pw || Math.max(ROW * 1.75, 3.4)
    ctx.save(); path(pts); ctx.clip()
    for (let a = F.a0 + pw * 0.5; a < F.a1; a += pw * rr(0.94, 1.06)) {
      let b = F.b0 - rr(0, 4)
      while (b < F.b1) { const e = Math.min(b + rr(40, 90), F.b1 + 2), p = at(a + jt(0.12), b), q = at(a + jt(0.12), e); sg(p[0], p[1], q[0], q[1]); b = e + rr(0.2, 0.9) }
      if (det >= 1) {
        for (let b2 = F.b0 + rr(4, 20); b2 < F.b1; b2 += rr(20, 38)) {
          const m = at(a - pw * 0.5, b2), n2 = at(a + pw * 0.5, b2); sg(m[0], m[1], n2[0], n2[1])
        }
        if (det >= 2) {
          const g = at(a + jt(pw * 0.2), rr(F.b0, F.b1 - 8)); at(a + jt(pw * 0.2), 0)
          const l = rr(4, 12); sg(g[0], g[1], g[0] + d[0] * l, g[1] + d[1] * l)
          if (r() < 0.18) { const hg = Math.max(K(2.4), 1.4); for (let a2 = a - pw * 0.4; a2 < a + pw * 0.4; a2 += hg) { const p = at(a2, F.b0), q = at(a2 + jt(0.2), F.b1); sg(p[0], p[1], q[0], q[1]) } }
        }
      }
    }
    flush(o.w || 0.6)
    if (det >= 2) {
      ctx.beginPath(); const dr = Math.max(K(0.7), 0.4)
      for (let a = F.a0 + pw * 0.5; a < F.a1; a += pw) for (let b2 = F.b0 + 6; b2 < F.b1; b2 += 28) if (r() < 0.55) { const c = at(a, b2 + jt(3)); ctx.moveTo(c[0] + dr, c[1]); ctx.arc(c[0], c[1], dr, 0, TAU) }
      ctx.fillStyle = INK; ctx.fill()
    }
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
    if (det >= 1) {
      for (let b = F.b1 - rr(6, 10); b > F.b0 + 4; b -= rr(9, 15)) {
        let a = F.a0 - 2
        while (a < F.a1) {
          const L = rr(7, 20), p = at(a, b + jt(0.5)), q = at(a + L, b + jt(0.5)), m = at(a + L / 2, b + jt(0.7))
          ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.quadraticCurveTo(m[0], m[1], q[0], q[1]); ctx.lineWidth = W(0.55); ctx.strokeStyle = INK; ctx.stroke()
          a += L + rr(0.6, 2.4)
        }
      }
    }
    ctx.restore()
  }
  /** Slanted hatching on the shaded side of a roof plane. */
  function slopeHatch(pts, d, sh, o) {
    if (sh < 0.58 || det < 1) return
    const F = frame(pts, d), at = F.at, hg = ROW * (sh > 0.8 ? 1.25 : 2.3) * ((o && o.hg) || 1), span = F.b1 - F.b0
    ctx.save(); path(pts); ctx.clip()
    for (let a = F.a0 - span * 0.4; a < F.a1; a += hg * rr(0.8, 1.25)) {
      const L = span * rr(0.28, 0.85) * (sh > 0.8 ? 1 : 0.7), p = at(a, F.b1 + 1), q = at(a + L * 0.42 + jt(0.3), F.b1 - L)
      sg(p[0], p[1], q[0], q[1])
    }
    flush(0.45)
    ctx.restore()
  }
  /** Patch of lichen / moss: a loose stipple cluster, thinning to the edge (and a faint green wash in colour). Clip to the roof first. */
  function moss(cx, cy, rad) {
    if (COL) { ctx.save(); ctx.globalAlpha = 0.2; ctx.fillStyle = mix(T.forest, '#7d8a50', 0.3); path(oval(cx, cy, rad, rad * rr(0.6, 0.9), 10, 0.15)); ctx.fill(); ctx.restore() }
    const n = Math.round(rad * rad * 0.45 * Math.min(2, u))
    ctx.beginPath(); const dr = Math.max(K(0.55), 0.35)
    for (let i = 0; i < n; i++) { const a = r() * TAU, d = rad * Math.sqrt(r()) * r(), x = cx + cos(a) * d, y = cy + sin(a) * d * 0.8; ctx.moveTo(x + dr, y); ctx.arc(x, y, dr * rr(0.6, 1.3), 0, TAU) }
    ctx.fillStyle = INK; ctx.fill()
  }
  /** Weathering on a roof plane: a patch or two of moss and the odd streak. Large sizes only. */
  function weather(pts, d, sh) {
    if (det < 2) return
    const F = frame(pts, d), at = F.at, w = F.a1 - F.a0, h = F.b1 - F.b0
    if (w * h < 260) return
    ctx.save(); path(pts); ctx.clip()
    const n = r() < 0.5 ? 0 : r() < 0.4 ? 2 : 1
    for (let i = 0; i < n; i++) { const c = at(rr(F.a0 + w * 0.1, F.a1 - w * 0.1), rr(F.b0 + h * 0.15, F.b1 - h * 0.1)); moss(c[0], c[1], rr(3, Math.min(9, h * 0.35 + 3))) }
    ctx.restore()
  }
  /** One roof plane: opaque paint, texture by kind, shade hatching. d = unit vector pointing down the slope. */
  function plane(pts, d, o) {
    o = o || {}
    const kind = o.kind || 'shingle', sh = o.shade != null ? o.shade : shadeOf(d)
    paint(pts, o.col || kindCol(kind), sh)
    if (kind === 'thatch') { thatchTex(pts, d, sh, o); weather(pts, d, sh) }
    else if (kind === 'plank') { plankTex(pts, d, o); slopeHatch(pts, d, sh, o); weather(pts, d, sh) }
    else { if (kind === 'tile') tileTex(pts, d, { w: o.w }); else rowsTex(pts, d, kind === 'slate' ? { g: ROW * 1.25, tw: TW * 1.5, irregular: true, irr: 0.25, w: o.w, full: true } : { irregular: o.irregular !== false, w: o.w }); slopeHatch(pts, d, sh, o); weather(pts, d, sh) }
  }
  const cm = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const N = [0, -1], S = [0, 1], WD = [-1, 0], E = [1, 0]
  /** Gable (or hipped, with hip0 / hip1) roof over a rectangle; ridge runs along ax ('x' or 'y'). Returns the ridge ends. */
  function gable(x0, y0, x1, y1, ax, o) {
    o = o || {}
    const sw = ax === 'y', M = sw ? (p) => [p[1], p[0]] : (p) => p, m = (a) => a.map(M)
    const L0 = sw ? y0 : x0, L1 = sw ? y1 : x1, D0 = sw ? x0 : y0, D1 = sw ? x1 : y1, Dm = (D0 + D1) / 2, hd = (D1 - D0) / 2
    const h0 = o.hip0 ? hd : 0, h1 = o.hip1 ? hd : 0, R0 = [L0 + h0, Dm], R1 = [L1 - h1, Dm]
    const dN = sw ? WD : N, dS = sw ? E : S, dL = sw ? N : WD, dH = sw ? S : E
    plane(m([[L0, D0], [L1, D0], R1, R0]), dN, o)
    plane(m([[L0, D1], [L1, D1], R1, R0]), dS, o)
    if (h0) plane(m([[L0, D0], [L0, D1], R0]), dL, o)
    if (h1) plane(m([[L1, D0], [L1, D1], R1]), dH, o)
    const k = o.kind
    if (h0) { crease(M([L0, D0]), M(R0)); crease(M([L0, D1]), M(R0)) }
    if (h1) { crease(M([L1, D0]), M(R1)); crease(M([L1, D1]), M(R1)) }
    ridge(M(R0), M(R1), k)
    return { a: M(R0), b: M(R1) }
  }
  /** A cross wing: gable planes that run into the main roof along valleys. (cx, ww) = wing centre line and half-width on the main's edge. */
  function crease(a, b, w, o) { ln(a, b, w || 1, o || { taper: 0.4 }) }
  /** Ridge line. Thatch gets a bound roll along the top, tile and shingle a capped ridge. */
  function ridge(a, b, kind) {
    const L = hyp(b[0] - a[0], b[1] - a[1]); if (L < 1) return
    const vx = (b[0] - a[0]) / L, vy = (b[1] - a[1]) / L, nx = -vy, ny = vx
    if (kind === 'thatch') {
      const hw = Math.max(K(2.2), 1.7)
      const band = [[a[0] + nx * hw, a[1] + ny * hw], [b[0] + nx * hw, b[1] + ny * hw], [b[0] - nx * hw, b[1] - ny * hw], [a[0] - nx * hw, a[1] - ny * hw]]
      paint(band, kindCol('thatch'), 0.15)
      if (det >= 1) { const g = Math.max(K(2.6), 2.2); for (let t = g * 0.5; t < L - 1; t += g * rr(0.85, 1.2)) sg(a[0] + vx * t - nx * hw * 0.9, a[1] + vy * t - ny * hw * 0.9, a[0] + vx * (t + hw * 0.7) + nx * hw * 0.9, a[1] + vy * (t + hw * 0.7) + ny * hw * 0.9); flush(0.5) }
      ln([a[0] + nx * hw, a[1] + ny * hw], [b[0] + nx * hw, b[1] + ny * hw], 0.8, { taper: 0.3 }); ln([a[0] - nx * hw, a[1] - ny * hw], [b[0] - nx * hw, b[1] - ny * hw], 1.15, { taper: 0.3 })
    } else {
      ln(a, b, 1.5, { taper: 0.35 })
      if (det >= 2) { const g = Math.max(K(4), 3); for (let t = g * 0.5; t < L - 1; t += g * rr(0.9, 1.15)) sg(a[0] + vx * t - nx * 1.1, a[1] + vy * t - ny * 1.1, a[0] + vx * t + nx * 1.1, a[1] + vy * t + ny * 1.1); flush(0.5) }
    }
  }
  /** Pyramid (hipped) roof over a rectangle. */
  function pyramid(x0, y0, x1, y1, o) {
    const c = [(x0 + x1) / 2 + ((o && o.ox) || 0), (y0 + y1) / 2 + ((o && o.oy) || 0)]
    plane([[x0, y0], [x1, y0], c], N, o); plane([[x0, y1], [x1, y1], c], S, o); plane([[x0, y0], [x0, y1], c], WD, o); plane([[x1, y0], [x1, y1], c], E, o)
    for (const p of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) crease(p, c, 1)
    return c
  }
  /** A single sloping plane (lean-to, shed). wall = the edge where it meets the building, drawn as a firm line. */
  function shed(pts, d, o, wall) {
    plane(pts, d, o)
    if (wall) ln(wall[0], wall[1], 1.7, { taper: 0.3 })
  }
  /** Conical roof (or a slice of one), apex (cx, cy), radius rad, from angle a0 to a1. o: kind, sides (0 = round), seams, col. */
  function fan(cx, cy, rad, a0, a1, o) {
    o = o || {}
    const kind = o.kind || 'slate', full = a1 - a0 >= TAU - 0.01, sides = o.sides || 0
    const n = sides ? Math.max(1, Math.round(((a1 - a0) / TAU) * sides)) : clamp(Math.round(rad * u * 0.8), 14, 80)
    const rim = []
    for (let k = 0; k <= n; k++) { const a = a0 + ((a1 - a0) * k) / n; rim.push([cx + cos(a) * rad * (sides ? 1 : 1 + jt(0.004)), cy + sin(a) * rad * (sides ? 1 : 1 + jt(0.004))]) }
    const pts = full ? rim.slice(0, -1) : [[cx, cy], ...rim]
    const mid = (a0 + a1) / 2, sh0 = full ? 0.5 : shadeOf([cos(mid), sin(mid)])
    paint(pts, o.col || kindCol(kind), full ? 0.35 : sh0 * 0.7)
    shadeBands(pts, cx, cy, rad, 3)
    ctx.save(); path(pts); ctx.clip()
    // rings of courses with staggered joints
    if (kind === 'thatch') {
      for (let ρ = rad; ρ > 5; ) {
        const step = rr(8, 12), dθ = Math.min(0.3, Math.max(THA, 1) / ρ), from = Math.max(2, ρ - step - rr(1.5, 4))
        for (let a = a0; a < a1; a += dθ * rr(0.7, 1.4)) {
          const ang = a + jt(0.003)
          sg(cx + cos(ang) * ρ, cy + sin(ang) * ρ, cx + cos(ang + jt(0.012)) * from, cy + sin(ang + jt(0.012)) * from)
        }
        ρ -= step
      }
      flush(0.5)
    } else {
      const g = o.g || ROW * 1.7, tw = o.tw || TW * 1.35
      let i = 0
      for (let ρ = rad - g * 0.5; ρ > g * 0.6; ρ -= g * (1 + jt(0.05)), i++) {
        // ring, broken
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
    // radial hatching on the shaded side
    if (det >= 1 && kind !== 'thatch') {
      const base = ROW * 1.9
      const nHat = Math.round(((a1 - a0) * rad) / base)
      for (let k = 0; k < nHat; k++) {
        const ang = a0 + ((a1 - a0) * (k + r() * 0.6)) / nHat, dk = cos(ang) * LX + sin(ang) * LY
        if (dk < 0.15) continue
        if (r() > dk * 1.15) continue
        const f0 = rr(0.05, 0.4), f1 = rr(0.7, 0.99)
        sg(cx + cos(ang) * rad * f1, cy + sin(ang) * rad * f1, cx + cos(ang + 0.01) * rad * f0, cy + sin(ang + 0.01) * rad * f0)
      }
      flush(0.45)
    } else if (kind === 'thatch') {
      // denser strokes on the shaded side
      const nHat = Math.round(((a1 - a0) * rad) / (THA * 2.2))
      for (let k = 0; k < nHat; k++) {
        const ang = a0 + ((a1 - a0) * (k + r() * 0.6)) / nHat, dk = cos(ang) * LX + sin(ang) * LY
        if (dk < 0.2) continue
        const f1 = rr(0.55, 0.99), f0 = f1 - rr(0.08, 0.3)
        sg(cx + cos(ang) * rad * f1, cy + sin(ang) * rad * f1, cx + cos(ang + 0.008) * rad * f0, cy + sin(ang + 0.008) * rad * f0)
      }
      flush(0.5)
    }
    // seams (stone cones, spires, gores)
    if (o.seams) {
      const ns = Math.max(3, Math.round(((a1 - a0) / TAU) * o.seams))
      for (let k = full ? 0 : 1; k < (full ? ns : ns); k++) { const ang = a0 + ((a1 - a0) * (k + (full ? 0 : 0))) / ns; sg(cx, cy, cx + cos(ang) * rad, cy + sin(ang) * rad) }
      flush(0.7)
    }
    ctx.restore()
    return pts
  }

  /** Inner line and eave-shadow ticks along the shaded eaves (down and to the right) of a silhouette. */
  function eaveBand(sil, inset) {
    if (det < 2) return
    groundBits(sil, 7)
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
  /** A few grass tufts and pebbles on the ground just outside the eaves, mostly on the shaded sides. Large sizes only. */
  function groundBits(sil, n) {
    if (det < 2) return
    const m = sil.length, sgn = orient(sil)
    for (let k = 0; k < n; k++) {
      const i = Math.floor(r() * m), p = sil[i], q = sil[(i + 1) % m], L = hyp(q[0] - p[0], q[1] - p[1])
      if (L < 9) continue
      const t = r(), ux = (q[0] - p[0]) / L, uy = (q[1] - p[1]) / L, nx = uy * sgn, ny = -ux * sgn, off = rr(1.8, 3.6)
      const x = p[0] + (q[0] - p[0]) * t + nx * off, y = p[1] + (q[1] - p[1]) * t + ny * off
      if (r() < 0.8) tuft(x, y + 1.2, rr(0.8, 1.3)); else { const c = oval(x, y, rr(0.8, 1.5), rr(0.6, 1.1), 7); fillPoly(c, COL ? mix(STONE(), PAPER, 0.3) : PAPER); loop(c, 0.7, { flat: true }) }
    }
    flush(0.55)
  }
  /** Ragged straw ends sticking out along the eaves of a thatched silhouette. */
  function ragged(sil) {
    if (det < 1) return
    groundBits(sil, 6)
    const n = sil.length, sgn = orient(sil)
    for (let i = 0; i < n; i++) {
      const p = sil[i], q = sil[(i + 1) % n], dx = q[0] - p[0], dy = q[1] - p[1], L = hyp(dx, dy)
      if (L < 4) continue
      const ux = dx / L, uy = dy / L, nx = uy * sgn, ny = -ux * sgn, g = Math.max(K(3.2), 1.6)
      for (let t = g * 0.4; t < L; t += g * rr(0.6, 1.4)) { const l = rr(0.5, 1.7), a = rr(-0.5, 0.5); sg(p[0] + ux * t, p[1] + uy * t, p[0] + ux * t + nx * l + ux * a, p[1] + uy * t + ny * l + uy * a) }
    }
    flush(0.5)
  }

  /* ---------- small things ---------- */
  function chimney(cx, cy, w, h, o) {
    h = h || w; o = o || {}
    const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2, sq = rect(x0, y0, x1, y1)
    castShadow([sq], w * 0.95)
    paint(sq, STONE(), 0.1)
    if (det >= 1) {
      hatchIn([[cx + w * 0.1, y0], [x1, y0], [x1, y1], [cx - w * 0.1, y1]], 1.9, K(2.2), 0.5)
      const f = rect(x0 + w * 0.27, y0 + h * 0.27, x1 - w * 0.27, y1 - h * 0.27); fillPoly(f, INK)
    }
    outline(sq, 1.7)
    if (det >= 2) { const m = rect(x0 + w * 0.18, y0 + h * 0.18, x1 - w * 0.18, y1 - h * 0.18); outline(m, 0.6, { flat: true, noext: true }) }
  }
  function post(x, y, rad) {
    rad = rad || 1
    ctx.beginPath(); ctx.arc(x, y, Math.max(rad, K(1.1)), 0, TAU); ctx.fillStyle = INK; ctx.fill()
  }
  /** A fence run: a rail with a post every few units. */
  function fenceSeg(a, b, o) {
    o = o || {}
    const L = hyp(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / (o.gap || 7)))
    ln(a, b, 0.9, { taper: 0.25, wob: 0.2 })
    if (det >= 2) ln([a[0] + (b[1] - a[1]) / L * 0.9, a[1] - (b[0] - a[0]) / L * 0.9], [b[0] + (b[1] - a[1]) / L * 0.9, b[1] - (b[0] - a[0]) / L * 0.9], 0.5, { taper: 0.4, wob: 0.2 })
    for (let i = 0; i <= n; i++) post(a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n, o.rad || 0.9)
  }
  /** Flat stone step / threshold slab. */
  function slab(x, y, w, h) {
    const p = rect(x - w / 2, y - h / 2, x + w / 2, y + h / 2)
    castShadow([p], 1.4); paint(p, STONE(), 0.1); outline(p, 1.1, { noext: true, wob: 0.15 })
    if (det >= 1) hatchIn(rect(x - w * 0.1, y - h / 2, x + w / 2, y + h / 2), 2.0, K(2.2), 0.4)
  }
  /** Rain barrel / tub / well top seen from above. */
  function tub(x, y, rad, water) {
    const c = oval(x, y, rad, rad)
    castShadow([c], rad * 0.6)
    paint(c, WOOD(), 0.2); loop(c, 1.3)
    const c2 = oval(x, y, rad * 0.72, rad * 0.72)
    fillPoly(c2, water && COL ? mix(T.water, PAPER, 0.15) : PAPER); loop(c2, 0.7, { flat: true })
    if (det >= 1) { hatchIn(oval(x + rad * 0.12, y + rad * 0.12, rad * 0.7, rad * 0.7), 2.1, K(2.3), 0.4); sg(x - rad, y, x + rad, y); flush(0.3) }
  }
  /** Stack of logs seen from above: parallel logs with ring ends. */
  function woodpile(x0, y0, x1, y1) {
    const p = rect(x0, y0, x1, y1), h = y1 - y0, n = Math.max(2, Math.round(h / 2.8))
    castShadow([p], 1.6); paint(p, WOOD(), 0.25)
    for (let i = 1; i < n; i++) ln([x0 + jt(0.3), y0 + (h * i) / n], [x1 + jt(0.3), y0 + (h * i) / n], 0.7, { taper: 0.3, wob: 0.15 })
    outline(p, 1.2, { noext: true })
  }
  /** Round stone well: ring of blocks around dark water. */
  function well(x, y, rad) {
    const o1 = oval(x, y, rad, rad), o2 = oval(x, y, rad * 0.62, rad * 0.62)
    castShadow([o1], rad * 0.7)
    paint(o1, STONE(), 0.1); loop(o1, 1.5)
    if (det >= 1) { const n = Math.max(6, Math.round(rad * 2.2)); for (let i = 0; i < n; i++) { const a = (TAU * i) / n + jt(0.05); sg(x + cos(a) * rad * 0.62, y + sin(a) * rad * 0.62, x + cos(a) * rad, y + sin(a) * rad) } flush(0.55) }
    fillPoly(o2, COL ? mix(T.water, '#2a3a38', 0.45) : INK); loop(o2, 1, { flat: true })
  }
  /** Garden bed: soil with rows of little plants (round leafy heads and sprigs), inside a rectangle. */
  function furrows(x0, y0, x1, y1, ang) {
    const p = rect(x0, y0, x1, y1)
    if (COL) { fillPoly(p, mix(T.land, '#8a6a42', 0.4)); wash(p, mix(T.land, '#7d5d38', 0.5), 0.55) } else fillPoly(p, PAPER)
    ctx.save(); path(p); ctx.clip()
    const dx = cos(ang), dy = sin(ang), nx = -dy, ny = dx, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, L = hyp(x1 - x0, y1 - y0), g = Math.max(K(7), 4.2)
    let row = 0
    for (let t = -L / 2 + g / 2; t < L / 2; t += g, row++) {
      const ox = cx + nx * t, oy = cy + ny * t
      let s0 = -L / 2
      while (s0 < L / 2) { const e = Math.min(s0 + rr(10, 24), L / 2); sg(ox + dx * s0, oy + dy * s0 + jt(0.2), ox + dx * e, oy + dy * e + jt(0.2)); s0 = e + rr(0.5, 2) }
      if (det >= 1) {
        const step = row % 2 ? 3.6 : 2.6
        for (let s2 = -L / 2 + 1.5; s2 < L / 2; s2 += step * rr(0.9, 1.15)) {
          const px = ox + dx * s2 + nx * jt(0.3), py = oy + dy * s2 + ny * jt(0.3)
          if (row % 3 === 0) { sg(px, py, px + 0.9, py - 1.3); sg(px, py, px - 0.9, py - 1.2); sg(px, py, px, py - 1.8) } else { ctx.beginPath(); ctx.arc(px, py, Math.max(0.8, K(1.1)), 0, TAU); ctx.moveTo(px - 0.5, py); ctx.lineTo(px + 0.5, py) ; ctx.lineWidth = W(0.55); ctx.strokeStyle = INK; ctx.stroke() }
        }
      }
    }
    flush(0.5)
    ctx.restore()
    outline(p, 0.9, { noext: true, wob: 0.3 })
  }
  /** Round haystack / rick seen from above: spiral of strokes. */
  function haystack(x, y, rad) {
    const c = oval(x, y, rad, rad)
    castShadow([c], rad * 0.6)
    paint(c, mix(T.sand, '#8a7236', 0.3), 0.2)
    shadeBands(c, x, y, rad, 3)
    if (det >= 1) { const n = Math.round(rad * 1.6 * Math.min(2.4, Math.max(0.8, u))); ctx.save(); path(c); ctx.clip(); for (let i = 0; i < n; i++) { const a = r() * TAU, ρ = rad * rr(0.12, 0.95), l = rr(1.5, 3.2); sg(x + cos(a) * ρ, y + sin(a) * ρ, x + cos(a + 1.3) * (ρ + l * 0.2) + cos(a) * l, y + sin(a + 1.3) * (ρ + l * 0.2) + sin(a) * l) } flush(0.5); ctx.restore() }
    loop(c, 1.3)
  }
  /** A rectangular hay bale: bound with twine. */
  function bale(x, y, w, h, ang) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang || 0)
    const p = rect(-w / 2, -h / 2, w / 2, h / 2)
    castShadow([p], 1.8); paint(p, mix(T.sand, '#8a7236', 0.3), 0.2)
    if (det >= 1) { ctx.save(); path(p); ctx.clip(); const n = Math.round(w * u * 0.5); for (let i = 0; i < n; i++) { const xx = rr(-w / 2, w / 2), yy = rr(-h / 2, h / 2); sg(xx, yy, xx + rr(1, 3), yy + jt(0.5)) } flush(0.45); ctx.restore() }
    outline(p, 1.2, { noext: true, wob: 0.15 })
    sg(-w * 0.2, -h / 2, -w * 0.2, h / 2); sg(w * 0.2, -h / 2, w * 0.2, h / 2); flush(0.55)
    ctx.restore()
  }

  function reg(name, label, kind, fns, extra) {
    A.register(name, Object.assign({
      label, category: 'bm-buildings', kind, view: 'top', variants: fns.length,
      draw(c, x, y, s, rg, style, v) {
        open(c, x, y, s, rg, style)
        try { fns[(((v | 0) % fns.length) + fns.length) % fns.length]() } finally { ctx.restore() }
      },
    }, extra || {}))
  }

  /* =====================================================================================================================
     COTTAGE: thatched roofs
     ===================================================================================================================== */
  const baseOf = (sil, kind) => fillPoly(sil, COL ? mix(kindCol(kind || 'thatch'), PAPER, 0.4) : PAPER)
  const TH = { kind: 'thatch' }

  /** 0: plain rectangle, gable ends, a stack on the west end, doorstep and rain barrel. */
  function cot0() {
    const sil = rect(-50, -27, 50, 27)
    castShadow([sil], 4.5); baseOf(sil)
    gable(-50, -27, 50, 27, 'x', TH)
    outline(sil, 1.8); ragged(sil)
    chimney(-44, 0, 9, 11)
    slab(-6, 32, 9, 5)
    if (det >= 1) { dots(Math.round(14 * Math.min(2, u + 0.6)), -12, 35, 4, 47, 0.45) }
    tub(40, 33, 4.2, true)
  }
  /** 1: L-shape, a wing running south with valleys, one stack on each ridge. */
  function cot1() {
    KOV.thatch = mix(kindCol('thatch'), '#6a5f50', 0.4)
    const sil = [[-50, -34], [50, -34], [50, 36], [18, 36], [18, -2], [-50, -2]]
    castShadow([sil], 5); baseOf(sil)
    plane([[-50, -34], [50, -34], [50, -18], [-50, -18]], N, TH)
    plane([[-50, -2], [50, -2], [50, -18], [-50, -18]], S, TH)
    plane([[34, -18], [18, -2], [18, 36], [34, 36]], WD, TH)
    plane([[34, -18], [50, -2], [50, 36], [34, 36]], E, TH)
    crease([18, -2], [34, -18], 1.1); crease([50, -2], [34, -18], 1.1)
    ridge([-50, -18], [34, -18], 'thatch'); ridge([34, -18], [34, 36], 'thatch')
    outline(sil, 1.8); ragged(sil)
    chimney(-42, -18, 9, 10)
    chimney(34, 28, 8, 9)
    slab(-14, 3, 9, 4.5)
    if (det >= 2) { woodpile(-46, 6, -30, 16) }
  }
  /** 2: rectangle with a boarded lean-to on the east end, stack in the middle. */
  function cot2() {
    const sil = [[-50, -26], [20, -26], [20, -12], [50, -12], [50, 22], [-50, 22]]
    castShadow([sil], 4.5); baseOf(sil)
    gable(-50, -26, 20, 22, 'x', TH)
    shed([[20, -12], [50, -12], [50, 22], [20, 22]], E, { kind: 'plank' }, [[20, -12], [20, 22]])
    outline(sil, 2.1); ragged([[-50, -26], [20, -26], [20, 22], [-50, 22]])
    chimney(-12, -2, 9, 10)
    slab(-30, 27, 9, 4.5)
    if (det >= 1) { ln([20, 22], [50, 22], 1.6, { taper: 0.3 }) }
    if (det >= 2) { tub(42, 29, 3.6, true); woodpile(26, -22, 46, -15) }
  }
  /** 3: hip-roofed cottage, ridge short, a porch roof on the south side. */
  function cot3() {
    KOV.thatch = mix(kindCol('thatch'), '#6d7a45', 0.22)
    const sil = rect(-50, -34, 50, 34)
    castShadow([sil], 5); baseOf(sil)
    gable(-50, -34, 50, 34, 'x', { kind: 'thatch', hip0: true, hip1: true })
    outline(sil, 1.8); ragged(sil)
    const porch = [[-9, 34], [9, 34], [9, 46], [-9, 46]]
    castShadow([porch], 3)
    plane(porch, S, { kind: 'plank' }); ln([-9, 34], [9, 34], 1.4, { taper: 0.3 }); outline(porch, 1.5, { noext: true })
    chimney(0, 0, 9, 10)
    if (det >= 1) { tub(-40, 42, 4.2, true) }
  }
  /** 4: a small cottage at the back of a fenced yard with garden beds, a well and a hen house. */
  function cot4() {
    KOV.thatch = darker(kindCol('thatch'), 0.12)
    const yard = rect(-50, -38, 50, 38)
    if (COL) { fillPoly(yard, mix(T.grass, T.sand, 0.45)); wash(yard, mix(T.grass, T.land, 0.4), 0.5) } else fillPoly(yard, PAPER)
    if (det >= 1) { stippleIn(yard, 1.1, K(0.7)) }
    furrows(-6, -6, 22, 14, 0.02); furrows(-6, 18, 22, 34, 0.02); furrows(28, -6, 46, 34, 1.55)
    const sil = rect(-47, -35, 13, -3)
    castShadow([sil], 4.5); baseOf(sil)
    gable(-47, -35, 13, -3, 'x', TH)
    outline(sil, 1.8); ragged(sil)
    chimney(-40, -19, 8, 9)
    const hen = rect(30, -35, 45, -23)
    castShadow([hen], 2.5); baseOf(hen, 'plank'); gable(30, -35, 45, -23, 'x', { kind: 'plank' }); outline(hen, 1.5, { noext: true })
    well(-33, 14, 6)
    slab(-20, 2, 8, 4)
    const fo = { gap: 7.2 }
    fenceSeg([-50, -38], [50, -38], fo); fenceSeg([50, -38], [50, 38], fo); fenceSeg([-50, -38], [-50, 38], fo)
    fenceSeg([-50, 38], [-6, 38], fo); fenceSeg([6, 38], [50, 38], fo)
    if (det >= 1) { slab(0, 38, 10, 3) }
  }
  /** 5: T-shaped, a cross wing with a hipped end and a little porch. */
  function cot5() {
    const sil = [[-50, -26], [50, -26], [50, 6], [14, 6], [14, 34], [-14, 34], [-14, 6], [-50, 6]]
    castShadow([sil], 5); baseOf(sil)
    plane([[-50, -26], [50, -26], [50, -10], [-50, -10]], N, TH)
    plane([[-50, 6], [50, 6], [50, -10], [-50, -10]], S, TH)
    // wing: valleys from the main eave, hipped end
    plane([[0, -8], [-14, 6], [-14, 20], [0, 20]], WD, TH)
    plane([[0, -8], [14, 6], [14, 20], [0, 20]], E, TH)
    plane([[-14, 20], [14, 20], [0, 34]], S, TH); plane([[-14, 20], [-14, 34], [0, 34]], WD, TH); plane([[14, 20], [14, 34], [0, 34]], E, TH)
    plane([[-14, 20], [14, 20], [14, 34], [-14, 34]].slice(0, 0).concat([[-14, 20], [14, 20], [0, 34]]), S, TH)
    crease([-14, 6], [0, -8], 1.1); crease([14, 6], [0, -8], 1.1); crease([-14, 20], [0, 34], 1); crease([14, 20], [0, 34], 1)
    ridge([-50, -10], [50, -10], 'thatch'); ridge([0, -8], [0, 20], 'thatch')
    outline(sil, 1.8); ragged(sil)
    chimney(-44, -10, 8, 10); chimney(44, -10, 8, 10)
    const porch = [[-6, 34], [6, 34], [6, 43], [-6, 43]]
    castShadow([porch], 2.5); plane(porch, S, { kind: 'plank' }); outline(porch, 1.4, { noext: true })
    if (det >= 1) slab(0, 47, 8, 3.5)
  }
  /** 6: long croft with rounded thatched ends, held down by a rope net and stone weights. */
  function cot6() {
    KOV.thatch = mix(T.rock, '#4a4036', 0.5)
    const cxs = 28, hr = 24
    const sil = []
    for (let i = 0; i <= 10; i++) { const a = -PI / 2 + (PI * i) / 10; sil.push([cxs + cos(a) * hr * 1.0, sin(a) * hr]) }
    for (let i = 0; i <= 10; i++) { const a = PI / 2 + (PI * i) / 10; sil.push([-cxs + cos(a) * hr, sin(a) * hr]) }
    castShadow([sil], 4.5); baseOf(sil)
    plane([[-cxs, -hr], [cxs, -hr], [cxs, 0], [-cxs, 0]], N, TH)
    plane([[-cxs, hr], [cxs, hr], [cxs, 0], [-cxs, 0]], S, TH)
    fan(cxs, 0, hr, -PI / 2, PI / 2, { kind: 'thatch' }); fan(-cxs, 0, hr, PI / 2, PI * 1.5, { kind: 'thatch' })
    ridge([-cxs, 0], [cxs, 0], 'thatch')
    outline(sil, 1.8); ragged(sil)
    // rope net with stone weights: diagonal ropes crossing the roof, a stone hanging at each end
    const xr = []
    for (let x = -cxs - 8; x <= cxs + 8; x += 11) xr.push(x)
    for (const x of xr) {
      for (const sgn of [-1, 1]) {
        const xe = x + sgn * 7, ya = -hr + 0.8, yb = hr - 0.8
        const yEdge = (xx) => { const dx = Math.max(0, Math.abs(xx) - cxs); return hr * Math.sqrt(Math.max(0, 1 - (dx / hr) ** 2)) }
        if (yEdge(x) < 8 || yEdge(xe) < 8) continue
        ln([x, -yEdge(x) + 0.8], [xe, yEdge(xe) - 0.8], 0.75, { taper: 0.15, wob: 0.35 })
      }
    }
    for (const x of xr) {
      const yy = Math.sqrt(Math.max(0, 1 - (Math.max(0, Math.abs(x) - cxs) / hr) ** 2)) * hr
      if (yy < 8) continue
      for (const x2 of [x, x + 7]) {
        const y2 = Math.sqrt(Math.max(0, 1 - (Math.max(0, Math.abs(x2) - cxs) / hr) ** 2)) * hr
        if (y2 < 8) continue
        for (const sg2 of [-1, 1]) { const px = x2, py = sg2 * (y2 + 1.7); fillPoly(oval(px, py, 1.7, 1.9, 9), COL ? mix(T.rock, PAPER, 0.3) : PAPER); loop(oval(px, py, 1.7, 1.9, 9), 0.9) }
      }
    }
    if (det >= 1) { slab(-8, 31, 8, 4) }
  }
  /** 7: a round thatched hut with a smoke hole, and a boarded lean-to store against it. */
  function cot7() {
    KOV.thatch = lighter(kindCol('thatch'), 0.15)
    const cx = -14, R = 36
    const store = rect(18, -15, 50, 15)
    castShadow([store, oval(cx, 0, R, R, 30)], 4.5)
    baseOf(store, 'plank')
    shed([[22, -15], [50, -15], [50, 15], [22, 15]], E, { kind: 'plank' }, null)
    outline(store, 1.8, { noext: true })
    const pts = fan(cx, 0, R, 0, TAU, { kind: 'thatch' })
    // smoke hole and binding at the apex
    const hole = oval(cx, 0, 3.4, 3.4, 12); fillPoly(hole, INK)
    const band = oval(cx, 0, 6.5, 6.5, 14); loop(band, 0.8, { flat: true })
    if (det >= 1) { stippleIn(oval(cx, 0, 11, 11, 16), 3, K(0.6)) }
    loop(pts, 2.1); ragged(pts.map((p) => p))
    if (det >= 2) { for (let i = 0; i < 3; i++) { const a = -0.5 + i * 2.2; tuft(cx + cos(a) * (R + 3), sin(a) * (R + 3) + 2) } flush(0.55) }
    slab(cx - 38, 4, 3.2, 8)
  }

  reg('bm-cottage', 'Cottage', 'fixed', [cot0, cot1, cot2, cot3, cot4, cot5, cot6, cot7])

  /* =====================================================================================================================
     HOUSE: tiled, shingled and slated roofs
     ===================================================================================================================== */
  const TILE = { kind: 'tile' }, SHIN = { kind: 'shingle' }, SLATE = { kind: 'slate' }
  /** A small gabled dormer (ridge along y) sitting on a roof slope; it throws its own little shadow on the roof. */
  function dormer(cx, y0, y1, w, o) {
    const p = rect(cx - w / 2, y0, cx + w / 2, y1)
    castShadow([p], 3.4); baseOf(p, o.kind)
    gable(cx - w / 2, y0, cx + w / 2, y1, 'y', o)
    outline(p, 1.5, { noext: true })
  }
  /** Same, ridge along x (on a roof sloping east or west). */
  function dormerX(cy, x0, x1, w, o) {
    const p = rect(x0, cy - w / 2, x1, cy + w / 2)
    castShadow([p], 3.4); baseOf(p, o.kind)
    gable(x0, cy - w / 2, x1, cy + w / 2, 'x', o)
    outline(p, 1.5, { noext: true })
  }

  /** 0: plain gabled house, clay tiles, a stack at each end and two dormers on the north slope. */
  function hou0() {
    const sil = rect(-50, -30, 50, 30)
    castShadow([sil], 7); baseOf(sil, 'tile')
    gable(-50, -30, 50, 30, 'x', TILE)
    outline(sil, 2.2); eaveBand(sil)
    dormer(-22, -31.5, -16, 12, TILE); dormer(24, -31.5, -16, 12, TILE)
    chimney(-44, 0, 9, 11); chimney(44, 0, 9, 11)
    slab(-4, 35, 11, 5)
  }
  /** 1: T-shaped cross gable in brown shingle, with a lean-to bay and one stack on each ridge. */
  function hou1() {
    const sil = [[-50, -28], [50, -28], [50, 4], [16, 4], [16, 36], [-16, 36], [-16, 4], [-50, 4]]
    castShadow([sil], 7); baseOf(sil, 'shingle')
    plane([[-50, -28], [50, -28], [50, -12], [-50, -12]], N, SHIN)
    plane([[-50, 4], [50, 4], [50, -12], [-50, -12]], S, SHIN)
    plane([[0, -10], [-16, 4], [-16, 36], [0, 36]], WD, SHIN)
    plane([[0, -10], [16, 4], [16, 36], [0, 36]], E, SHIN)
    crease([-16, 4], [0, -10], 1.2); crease([16, 4], [0, -10], 1.2)
    ridge([-50, -12], [50, -12], 'shingle'); ridge([0, -10], [0, 36], 'shingle')
    outline(sil, 2.2); eaveBand(sil)
    // lean-to bay on the east side of the wing
    const bay = [[16, 14], [26, 14], [26, 30], [16, 30]]
    castShadow([bay], 4); plane(bay, E, { kind: 'plank' }); ln([16, 14], [16, 30], 1.5, { taper: 0.3 }); outline(bay, 1.5, { noext: true })
    chimney(-40, -12, 9, 11); chimney(40, -12, 9, 11)
    slab(0, 41, 11, 5)
  }
  /** 2: hipped tile roof, ridge short, a pair of stacks on the ridge and a dormer on each long slope. */
  function hou2() {
    const sil = rect(-50, -33, 50, 33)
    castShadow([sil], 7.5); baseOf(sil, 'tile')
    gable(-50, -33, 50, 33, 'x', { kind: 'tile', hip0: true, hip1: true })
    outline(sil, 2.2); eaveBand(sil)
    dormer(-8, -34.5, -20, 12, TILE); dormer(8, 20, 34.5, 12, TILE)
    chimney(-20, 0, 8, 10); chimney(20, 0, 8, 10)
    slab(26, 38, 10, 4.5)
  }
  /** 3: two-part roof: a tall slate main block (ridge north-south) and a lower tiled annex running east, with dormers. */
  function hou3() {
    const sil = [[-50, -32], [10, -32], [10, -4], [50, -4], [50, 26], [10, 26], [10, 32], [-50, 32]]
    castShadow([sil], 8); baseOf(sil, 'slate')
    gable(-50, -32, 10, 32, 'y', { kind: 'slate', hip0: false, hip1: false })
    gable(10, -4, 50, 26, 'x', { kind: 'tile', hip1: true })
    ln([10, -4], [10, 26], 1.6, { taper: 0.25 })
    outline(sil, 2.2); eaveBand(sil)
    dormerX(-14, -51.5, -37, 12, SLATE); dormerX(14, -51.5, -37, 12, SLATE)
    chimney(-20, -22, 9, 10); chimney(-20, 18, 9, 10); chimney(44, 11, 8, 9)
  }
  /** 4: a terrace of three houses side by side, each with its own roof, party walls between. */
  function hou4() {
    const A3 = rect(-50, -26, -17, 26), B3 = rect(-17, -29, 17, 24), C3 = rect(17, -26, 50, 29)
    castShadow([A3, B3, C3], 6.5)
    for (const [r3, k, kd] of [[A3, 'shingle', SHIN], [B3, 'tile', TILE], [C3, 'slate', SLATE]]) {
      baseOf(r3, k)
      gable(r3[0][0], r3[0][1], r3[2][0], r3[2][1], 'y', kd)
      outline(r3, 2, { noext: true })
    }
    eaveBand(A3); eaveBand(B3); eaveBand(C3)
    chimney(-33, -14, 8, 9); chimney(0, 14, 8, 9); chimney(33, -10, 8, 9)
    slab(-33, 31, 8, 4); slab(0, 29, 8, 4); slab(33, 34, 8, 4)
  }
  /** 5: courtyard house: three tiled ranges round a cobbled yard with a well, a low wall and a gate on the south. */
  function hou5() {
    const sil = [[-50, -38], [50, -38], [50, 38], [26, 38], [26, -8], [-26, -8], [-26, 38], [-50, 38]]
    const yd = rect(-26, -8, 26, 38)
    // courtyard floor first (under everything)
    paint(yd, T.rock, 0)
    castShadow([sil], 7.5); baseOf(sil, 'tile')
    // cobbled yard: flags and the shadow of the north range
    ctx.save(); path(yd); ctx.clip()
    rowsTex(yd, S, { g: K(9), tw: K(11), irr: 0.22, irregular: true, w: 0.5 })
    ctx.restore()
    if (SH) castShadow([rect(-26, -8, 26, -8.2)], 7)
    plane([[-50, -38], [50, -38], [50, -23], [-50, -23]], N, TILE)
    plane([[-50, -8], [50, -8], [50, -23], [-50, -23]], S, TILE)
    plane([[-38, -20], [-50, -8], [-50, 38], [-38, 38]], WD, TILE)
    plane([[-38, -20], [-26, -8], [-26, 38], [-38, 38]], E, TILE)
    plane([[38, -20], [26, -8], [26, 38], [38, 38]], WD, TILE)
    plane([[38, -20], [50, -8], [50, 38], [38, 38]], E, TILE)
    crease([-50, -8], [-38, -20], 1.1); crease([-26, -8], [-38, -20], 1.1); crease([26, -8], [38, -20], 1.1); crease([50, -8], [38, -20], 1.1)
    ridge([-50, -23], [50, -23], 'tile'); ridge([-38, -20], [-38, 38], 'tile'); ridge([38, -20], [38, 38], 'tile')
    outline(sil, 2.2); eaveBand(sil)
    // low yard wall with a gate gap, and the well
    for (const [a, b] of [[[-26, 36], [-6, 36]], [[6, 36], [26, 36]]]) { const w = rect(a[0], 34, b[0], 38); castShadow([w], 1.8); paint(w, STONE(), 0.1); outline(w, 1.3, { noext: true }); if (det >= 1) hatchIn(w, 1.9, K(2.2), 0.4) }
    well(0, 14, 6)
    chimney(-30, -23, 8, 9); chimney(30, -23, 8, 9); chimney(-38, 30, 8, 9)
    if (det >= 1) { slab(-4, 42, 8, 3.5) }
  }
  /** 6: gambrel roof (two pitches each side) in slate-grey shingle, three dormers on the south slope. */
  function hou6() {
    const sil = rect(-50, -30, 50, 30)
    castShadow([sil], 8); baseOf(sil, 'slate')
    const k = { kind: 'slate', irregular: true }
    plane([[-50, -30], [50, -30], [50, -10], [-50, -10]], N, k)
    plane([[-50, -10], [50, -10], [50, 0], [-50, 0]], N, Object.assign({}, k, { shade: 0.12, hg: 1 }))
    plane([[-50, 0], [50, 0], [50, 10], [-50, 10]], S, Object.assign({}, k, { shade: 0.78 }))
    plane([[-50, 10], [50, 10], [50, 30], [-50, 30]], S, Object.assign({}, k, { shade: 0.95 }))
    ln([-50, -10], [50, -10], 1.3, { taper: 0.3 }); ln([-50, 10], [50, 10], 1.3, { taper: 0.3 })
    ridge([-50, 0], [50, 0], 'slate')
    outline(sil, 2.2); eaveBand(sil)
    dormer(-30, 15, 31.5, 11, SLATE); dormer(0, 15, 31.5, 11, SLATE); dormer(30, 15, 31.5, 11, SLATE)
    chimney(-44, 0, 9, 10); chimney(44, 0, 9, 10)
    slab(-14, 37, 10, 4.5)
  }
  /** 7: slate L-house with a round stair turret in the angle, topped by a conical roof. */
  function hou7() {
    const sil = [[-50, -30], [50, -30], [50, 2], [-18, 2], [-18, 36], [-50, 36]]
    castShadow([sil, oval(-9, 8, 15, 15, 24)], 8); baseOf(sil, 'slate')
    plane([[-50, -30], [50, -30], [50, -14], [-50, -14]], N, SLATE)
    plane([[-50, 2], [50, 2], [50, -14], [-50, -14]], S, SLATE)
    plane([[-34, -14], [-50, 2], [-50, 36], [-34, 36]], WD, SLATE)
    plane([[-34, -14], [-18, 2], [-18, 36], [-34, 36]], E, SLATE)
    crease([-50, 2], [-34, -14], 1.2); crease([-18, 2], [-34, -14], 1.2)
    ridge([-34, -14], [50, -14], 'slate'); ridge([-34, -14], [-34, 36], 'slate')
    outline(sil, 2.2); eaveBand(sil)
    // the turret: drum with a conical slate cap, standing in the inner corner
    const tc = [-9, 8], tr = 15
    castShadow([oval(tc[0], tc[1], tr, tr, 24)], 7)
    const c2 = fan(tc[0], tc[1], tr, 0, TAU, { kind: 'slate', seams: 14 })
    loop(c2, 2)
    fillPoly(oval(tc[0], tc[1], 1.8, 1.8, 8), INK)
    chimney(44, -14, 9, 10); chimney(-34, 28, 8, 9)
    slab(-34, 41, 10, 4.5)
  }
  reg('bm-house', 'House', 'fixed', [hou0, hou1, hou2, hou3, hou4, hou5, hou6, hou7])

  /* =====================================================================================================================
     BARN: long plank and shingle roofs, big doors, hay hoods
     ===================================================================================================================== */
  const PLANK = { kind: 'plank' }
  /** Big barn doors standing open at a gable end: a dark doorway between two plank leaves folded flat against the wall, and a worn apron outside.
   *  c = centre of the opening on the wall line, o = unit vector pointing out of the building, wd = opening width. */
  function bigDoors(cx, cy, o, wd, lf) {
    if (!wd) return
    const t = [-o[1], o[0]], hw = wd / 2, L = lf || wd * 0.5
    const P = (a, b) => [cx + t[0] * a + o[0] * b, cy + t[1] * a + o[1] * b]
    // apron
    const apron = [P(-hw - 1, 0), P(hw + 1, 0), P(hw + 1, 5.5), P(-hw - 1, 5.5)]
    castShadow([apron], 1); paint(apron, mix(T.land, T.sand, 0.3), 0.15, 0.4); outline(apron, 0.9, { noext: true, wob: 0.15 })
    if (det >= 1) { for (let i = 0; i < 5; i++) ln(P(rr(-hw, hw), rr(0.8, 4.8)), P(rr(-hw, hw), rr(1.2, 5)), 0.4, { taper: 0.9, wob: 0.1 }); for (const s2 of [-0.5, 0.5]) ln(P(hw * s2, 1), P(hw * s2, 5.4), 0.55, { taper: 0.9, wob: 0.2 }) }
    // the doorway: dark
    fillPoly([P(-hw, -2.6), P(hw, -2.6), P(hw, 0.4), P(-hw, 0.4)], INK)
    // leaves folded back against the wall
    for (const sgn of [-1, 1]) {
      const leaf = [P(sgn * hw, 0.2), P(sgn * (hw + L), 0.2), P(sgn * (hw + L), 2.4), P(sgn * hw, 2.4)]
      castShadow([leaf], 1.2); fillPoly(leaf, COL ? mix(WOOD(), PAPER, 0.3) : PAPER); outline(leaf, 1.1, { noext: true, wob: 0.1 })
      if (det >= 1) { for (let i = 1; i < 4; i++) { const a = P(sgn * (hw + (L * i) / 4), 0.2), b = P(sgn * (hw + (L * i) / 4), 2.4); sg(a[0], a[1], b[0], b[1]) } flush(0.4) }
      if (det >= 2) { for (const f of [0.25, 0.7]) { const a = P(sgn * (hw + L * f), 0.6), b = P(sgn * (hw + L * f), 2.0); ln(a, b, 0.7, { taper: 0.2 }) } }
    }
  }
  /** Hay hood: a small gabled roof jutting from the ridge end, with a hoist beam and pulley. */
  function hood(x0, y0, x1, y1, ax, beam, o) {
    const p = rect(x0, y0, x1, y1)
    castShadow([p], 3.2); baseOf(p, o.kind)
    gable(x0, y0, x1, y1, ax, o)
    outline(p, 1.5, { noext: true })
    const e = beam; ln(e[0], e[1], 1.6, { taper: 0.3 })
    ctx.beginPath(); ctx.arc(e[1][0], e[1][1], 1.5, 0, TAU); ctx.fillStyle = PAPER; ctx.fill(); loop(oval(e[1][0], e[1][1], 1.5, 1.5, 8), 0.9)
  }
  /** Open lean-to cart shed: sloping plank roof held on posts along its outer edge. */
  function cartShed(x0, y0, x1, y1, d, posts) {
    const p = rect(x0, y0, x1, y1)
    castShadow([p], 3); plane(p, d, PLANK); outline(p, 1.4, { noext: true })
    for (const q of posts) { ctx.beginPath(); ctx.arc(q[0], q[1], 1.6, 0, TAU); ctx.fillStyle = PAPER; ctx.fill(); loop(oval(q[0], q[1], 1.6, 1.6, 8), 1.1) }
  }

  /** 0: classic gabled plank barn, big doors and a hay hood on the west end. */
  function barn0() {
    const sil = rect(-36, -25, 50, 25)
    castShadow([sil], 8); baseOf(sil, 'plank')
    gable(-36, -25, 50, 25, 'x', PLANK)
    outline(sil, 2.2); eaveBand(sil)
    hood(-45, -8, -36, 8, 'x', [[-45, 0], [-48, 0]], PLANK)
    bigDoors(-36, 0, [-1, 0], 18, 10)
    if (det >= 1) { slab(20, 30, 9, 4.5) }
  }
  /** 1: aisled barn: tall nave, lower aisles both sides, a cross-gabled cart porch on the south. */
  function barn1() {
    KOV.plank = mix(WOOD(), '#8f9192', 0.5)
    const sil = [[-50, -30], [50, -30], [50, 30], [12, 30], [12, 38], [-12, 38], [-12, 30], [-50, 30]]
    castShadow([sil], 8); baseOf(sil, 'plank')
    gable(-50, -14, 50, 14, 'x', PLANK)
    shed([[-50, -30], [50, -30], [50, -14], [-50, -14]], N, PLANK, [[-50, -14], [50, -14]])
    shed([[-50, 30], [50, 30], [50, 14], [-50, 14]], S, PLANK, [[-50, 14], [50, 14]])
    gable(-12, 22, 12, 38, 'y', PLANK)
    ln([-12, 22], [12, 22], 0.9, { taper: 0.3 })
    outline(sil, 2.2); eaveBand(sil)
    hood(40, -6, 50, 6, 'x', [[50, 0], [53, 0]], PLANK)
    ln([-12, 38], [12, 38], 1.6, { taper: 0.2 })
    bigDoors(0, 38, [0, 1], 16, 9)
  }
  /** 2: gambrel-roofed shingle barn with a ventilating cupola on the ridge and big doors on the east end. */
  function barn2() {
    KOV.shingle = mix(T.roof, '#4a3224', 0.4)
    const sil = rect(-50, -26, 40, 26)
    castShadow([sil], 9); baseOf(sil, 'shingle')
    const k = { kind: 'shingle' }
    plane([[-50, -26], [40, -26], [40, -9], [-50, -9]], N, k)
    plane([[-50, -9], [40, -9], [40, 0], [-50, 0]], N, Object.assign({}, k, { shade: 0.1 }))
    plane([[-50, 0], [40, 0], [40, 9], [-50, 9]], S, Object.assign({}, k, { shade: 0.78 }))
    plane([[-50, 9], [40, 9], [40, 26], [-50, 26]], S, Object.assign({}, k, { shade: 0.96 }))
    ln([-50, -9], [40, -9], 1.3, { taper: 0.3 }); ln([-50, 9], [40, 9], 1.3, { taper: 0.3 }); ridge([-50, 0], [40, 0], 'shingle')
    outline(sil, 2.2); eaveBand(sil)
    // cupola
    const cu = rect(-17, -7, -3, 7)
    castShadow([cu], 5); baseOf(cu, 'shingle'); pyramid(-17, -7, -3, 7, { kind: 'shingle' }); outline(cu, 1.6, { noext: true })
    fillPoly(oval(-10, 0, 1.1, 1.1, 6), INK)
    bigDoors(40, 0, [1, 0], 18, 10)
  }
  /** 3: round barn: a sixteen-sided shingled roof round a central cupola, with an entrance gable. */
  function barn3() {
    KOV.shingle = mix(T.rock, '#7a5a40', 0.45)
    const cx = -3, R = 43
    const ent = rect(R - 6 + cx, -10, 50, 10)
    castShadow([oval(cx, 0, R, R, 32), ent], 9)
    baseOf(ent, 'shingle'); gable(R - 6 + cx, -10, 50, 10, 'x', { kind: 'shingle' }); outline(ent, 1.6, { noext: true })
    const pts = fan(cx, 0, R, 0, TAU, { kind: 'shingle', sides: 16, seams: 16, col: undefined })
    loop(pts, 2.1)
    const cup = oval(cx, 0, 8, 8, 14)
    castShadow([cup], 4); paint(cup, WOOD(), 0.1)
    fan(cx, 0, 8, 0, TAU, { kind: 'shingle', sides: 8, seams: 8 }); loop(cup, 1.4)
    fillPoly(oval(cx, 0, 1.1, 1.1, 6), INK)
    bigDoors(50, 0, [1, 0], 14, 8)
  }
  /** 4: gabled barn with a round silo against the east end and an open cart shed along the south side. */
  function barn4() {
    const sil = [[-42, -26], [22, -26], [22, 26], [-42, 26]]
    castShadow([sil, oval(36, 0, 14, 14, 20), rect(-34, 26, 0, 40)], 8); baseOf(sil, 'plank')
    gable(-42, -26, 22, 26, 'x', PLANK)
    outline(sil, 2.2); eaveBand(sil)
    cartShed(-34, 26, 0, 40, S, [[-34, 40], [-22, 40], [-11, 40], [0, 40]])
    ln([-34, 26], [0, 26], 1.6, { taper: 0.2 })
    // silo
    const sc = [36, 0], sr = 14
    castShadow([oval(sc[0], sc[1], sr, sr, 20)], 11)
    const c2 = fan(sc[0], sc[1], sr, 0, TAU, { kind: 'slate', seams: 10 }); loop(c2, 1.8)
    fillPoly(oval(sc[0], sc[1], 1.5, 1.5, 8), INK)
    hood(-50, -7, -42, 7, 'x', [[-50, 0], [-53, 0]], PLANK)
    bigDoors(-42, 0, [-1, 0], 16, 8)
  }
  /** 5: long tithe barn in shingle with two cross-gabled porches on the south side. */
  function barn5() {
    KOV.shingle = mix(T.rock, '#4f4033', 0.5)
    const sil = [[-50, -18], [50, -18], [50, 18], [34, 18], [34, 30], [10, 30], [10, 18], [-10, 18], [-10, 30], [-34, 30], [-34, 18], [-50, 18]]
    castShadow([sil], 8); baseOf(sil, 'shingle')
    gable(-50, -18, 50, 18, 'x', SHIN)
    gable(-34, 12, -10, 30, 'y', SHIN); gable(10, 12, 34, 30, 'y', SHIN)
    ln([-34, 12], [-10, 12], 0.8, { taper: 0.3 }); ln([10, 12], [34, 12], 0.8, { taper: 0.3 })
    outline(sil, 2.2); eaveBand(sil)
    ln([-34, 30], [-10, 30], 1.6, { taper: 0.2 }); ln([10, 30], [34, 30], 1.6, { taper: 0.2 })
    bigDoors(-22, 30, [0, 1], 16, 8.5); bigDoors(22, 30, [0, 1], 16, 8.5)
  }
  /** 6: L-shaped barn and stable range: a wing runs north at the east end; hay hood on the wing; trough in the angle. */
  function barn6() {
    KOV.plank = mix(T.roof, '#5a4030', 0.4)
    const sil = [[-50, 6], [18, 6], [18, -36], [50, -36], [50, 38], [-50, 38]]
    castShadow([sil], 8); baseOf(sil, 'plank')
    plane([[-50, 6], [50, 6], [50, 22], [-50, 22]], N, PLANK)
    plane([[-50, 38], [50, 38], [50, 22], [-50, 22]], S, PLANK)
    plane([[34, 22], [18, 6], [18, -36], [34, -36]], WD, PLANK)
    plane([[34, 22], [50, 6], [50, -36], [34, -36]], E, PLANK)
    // the wing is the taller roof: its planes run into the main along valleys
    crease([18, 6], [34, 22], 1.2); crease([50, 6], [34, 22], 1.2)
    ridge([-50, 22], [34, 22], 'plank'); ridge([34, 22], [34, -36], 'plank')
    outline(sil, 2.2); eaveBand(sil)
    hood(26, -44, 42, -36, 'y', [[34, -44], [34, -47]], PLANK)
    bigDoors(34, -36, [0, -1], 0, 0)
    if (det >= 1) { const tr = rect(-14, -6, 2, 0); castShadow([tr], 1.6); paint(tr, WOOD(), 0.2); outline(tr, 1.2, { noext: true }); haystack(-36, -8, 6) }
  }
  /** 7: a small barn at the back of a fenced stockyard with hay bales, a haystack, a trough and an open gate. */
  function barn7() {
    const yard = rect(-50, -38, 50, 38)
    if (COL) { fillPoly(yard, mix(T.land, T.grass, 0.35)); wash(yard, mix(T.land, '#8a6a42', 0.35), 0.5) } else fillPoly(yard, PAPER)
    if (det >= 1) stippleIn(yard, 1.6, K(0.7))
    const sil = rect(-48, -36, 6, -8)
    castShadow([sil], 7); baseOf(sil, 'plank')
    gable(-48, -36, 6, -8, 'x', PLANK)
    outline(sil, 2.1); eaveBand(sil)
    hood(6, -26, 14, -18, 'x', [[14, -22], [17, -22]], PLANK)
    haystack(32, -22, 11)
    for (const [bx, by, ba] of [[-34, 6, 0.1], [-20, 8, -0.05], [-27, 18, 0.08], [30, 14, 0.9], [-12, 26, 0.0]]) bale(bx, by, 13, 7, ba)
    const tr = rect(14, 22, 34, 29); castShadow([tr], 2); paint(tr, WOOD(), 0.2); outline(tr, 1.3, { noext: true })
    const w2 = rect(16, 24, 32, 27); fillPoly(w2, COL ? mix(T.water, PAPER, 0.2) : PAPER); outline(w2, 0.6, { noext: true, flat: true })
    const fo = { gap: 7.4 }
    fenceSeg([-50, -38], [50, -38], fo); fenceSeg([50, -38], [50, 38], fo); fenceSeg([-50, -38], [-50, 38], fo); fenceSeg([-50, 38], [-8, 38], fo); fenceSeg([14, 38], [50, 38], fo)
    // gate standing open
    ln([-8, 38], [-4, 24], 1.2, { taper: 0.2 }); ln([-6, 36], [-3, 26], 0.8, { taper: 0.3 }); post(-8, 38, 1.4)
  }
  reg('bm-barn', 'Barn', 'fixed', [barn0, barn1, barn2, barn3, barn4, barn5, barn6, barn7])

  /* =====================================================================================================================
     TOWER: stone towers, round and square, with cones, spires and crenellated tops
     ===================================================================================================================== */
  /** A pennant streaming from a pole at (x, y), seen from above: a slim waving swallow-tailed ribbon blown towards ang. */
  function pennant(x, y, L, ang, col) {
    const ux = cos(ang), uy = sin(ang), nx = -uy, ny = ux, w0 = L * 0.13, amp = L * 0.07, top = [], bot = []
    const N8 = 8
    for (let i = 0; i <= N8; i++) {
      const t = i / N8, cx = x + ux * L * t + nx * amp * sin(t * 5.2), cy = y + uy * L * t + ny * amp * sin(t * 5.2), hw = w0 * (1 - 0.55 * t)
      top.push([cx + nx * hw, cy + ny * hw]); bot.push([cx - nx * hw, cy - ny * hw])
    }
    const nt = [x + ux * L * 0.78 + nx * amp * sin(0.78 * 5.2), y + uy * L * 0.78 + ny * amp * sin(0.78 * 5.2)]
    const pts = [...top, nt, ...bot.reverse()]
    if (COL) { fillPoly(pts, mix(col || darker(T.roof, 0.1), PAPER, 0.2)); wash(pts, col || darker(T.roof, 0.1), 0.6) } else fillPoly(pts, PAPER)
    if (det >= 1) { ctx.save(); path(pts); ctx.clip(); const hg = Math.max(K(1.9), 1.1); for (let q = -2; q < L; q += hg) { const ax = x + ux * q, ay = y + uy * q; sg(ax - nx * 3, ay - ny * 3 + 0, ax + nx * 3 + ux * 0.9, ay + ny * 3 + uy * 0.9) } flush(0.45); ctx.restore() }
    outline(pts, 0.8, { noext: true, flat: true, wob: 0.05 })
    ctx.beginPath(); ctx.arc(x, y, 1.3, 0, TAU); ctx.fillStyle = PAPER; ctx.fill(); loop(oval(x, y, 1.3, 1.3, 8), 0.9, { flat: true })
  }
  /** Ring-shaped wall of masonry between Ri and Ro: block courses as ticks and a broken ring line. */
  function ringCourses(cx, cy, Ro, Ri, rows, sideN) {
    const t = Ro - Ri, n = sideN || Math.max(10, Math.round((TAU * (Ro + Ri) * 0.5) / Math.max(K(11), 6)))
    for (let k = 0; k < rows; k++) {
      const r0 = Ri + (t * k) / rows, r1 = Ri + (t * (k + 1)) / rows, off = (k % 2) * 0.5
      for (let i = 0; i < n; i++) { if (r() < 0.9) { const a = ((i + off + jt(0.08)) * TAU) / n; sg(cx + cos(a) * r0, cy + sin(a) * r0, cx + cos(a) * r1, cy + sin(a) * r1) } }
      if (k) { let a = 0; while (a < TAU) { const e = Math.min(a + rr(0.4, 1.2), TAU); ctx.beginPath(); for (let q = 0; q <= 6; q++) { const an = a + ((e - a) * q) / 6; ctx[q ? 'lineTo' : 'moveTo'](cx + cos(an) * r0, cy + sin(an) * r0) } ctx.lineWidth = W(0.5); ctx.strokeStyle = INK; ctx.stroke(); a = e + rr(0.02, 0.08) } }
    }
    flush(0.5)
  }
  /** Crenellated parapet ring: wall-walk plus n merlons on the outer edge. Floor inside is left to the caller. */
  function crenRing(cx, cy, Ro, Ri, n, o) {
    o = o || {}
    const t = Ro - Ri, rm = Ro - t * 0.55, ph = o.phase || 0, step = TAU / n, mer = []
    for (let k = 0; k < n; k++) {
      const a = ph + k * step, s0 = a - step * 0.27, s1 = a + step * 0.27, pts = []
      for (let q = 0; q <= 3; q++) pts.push([cx + cos(s0 + ((s1 - s0) * q) / 3) * Ro, cy + sin(s0 + ((s1 - s0) * q) / 3) * Ro])
      for (let q = 3; q >= 0; q--) pts.push([cx + cos(s0 + ((s1 - s0) * q) / 3) * rm, cy + sin(s0 + ((s1 - s0) * q) / 3) * rm])
      mer.push({ pts, a })
    }
    const base = oval(cx, cy, Ro, Ro, 40, 0.004)
    paint(base, STONE(), 0.25); shadeBands(base, cx, cy, Ro, 3)
    if (det >= 1) ringCourses(cx, cy, rm + 0.5, Ri, 2)
    loop(base, 2.1)
    if (SH) castShadow(mer.map((m) => m.pts), 2.8)
    for (const m of mer) {
      const dk = cos(m.a) * LX + sin(m.a) * LY
      paint(m.pts, STONE(), 0.1 + Math.max(0, dk) * 0.2)
      if (det >= 1 && dk > 0.1) hatchIn(m.pts, m.a + 1.9, K(2.3), 0.45)
      outline(m.pts, 1.3, { noext: true, wob: 0.12 })
      if (det >= 2) { const ma = m.a; sg(cx + cos(ma) * (Ro - 0.9), cy + sin(ma) * (Ro - 0.9), cx + cos(ma) * (rm + 0.9), cy + sin(ma) * (rm + 0.9)) }
    }
    flush(0.4)
  }
  /** Crenellated square parapet. Merlons sit on the outer edge; corners are L-shaped blocks. */
  function crenSquare(x0, y0, x1, y1, n, t) {
    const m = (x1 - x0) / (2 * n - 1) * 1.15, W0 = x1 - x0, parts = []
    const c = (W0 - n * m) / (n - 1), mt = t * 0.56
    const sq = rect(x0, y0, x1, y1)
    paint(sq, STONE(), 0.25)
    if (det >= 1) {
      // wall-walk courses: ticks across the band
      const g = Math.max(K(8), 4.4)
      for (let s = x0 + g; s < x1 - 1; s += g * rr(0.8, 1.25)) { sg(s, y0 + mt, s + jt(0.3), y0 + t); sg(s, y1 - t, s + jt(0.3), y1 - mt) }
      for (let s = y0 + g; s < y1 - 1; s += g * rr(0.8, 1.25)) { sg(x0 + mt, s, x0 + t, s + jt(0.3)); sg(x1 - t, s, x1 - mt, s + jt(0.3)) }
      flush(0.45)
    }
    for (let i = 1; i < n - 1; i++) {
      const a = x0 + i * (m + c)
      parts.push(rect(a, y0, a + m, y0 + mt), rect(a, y1 - mt, a + m, y1))
      const b = y0 + i * (m + c)
      parts.push(rect(x0, b, x0 + mt, b + m), rect(x1 - mt, b, x1, b + m))
    }
    for (const [cx, cy, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x1, y1, -1, -1], [x0, y1, 1, -1]]) {
      parts.push([[cx, cy], [cx + sx * m, cy], [cx + sx * m, cy + sy * mt], [cx + sx * mt, cy + sy * mt], [cx + sx * mt, cy + sy * m], [cx, cy + sy * m]])
    }
    if (SH) castShadow(parts, 2.8)
    for (const p of parts) {
      let sx = 0, sy = 0; for (const q of p) { sx += q[0]; sy += q[1] }
      const dk = (sx / p.length) * LX / 50 + (sy / p.length) * LY / 50
      paint(p, STONE(), 0.1 + Math.max(0, dk) * 0.25)
      if (det >= 1 && dk > -0.05) hatchIn(p, 1.9, K(2.3), 0.45)
      outline(p, 1.3, { noext: true, wob: 0.12 })
    }
    outline(sq, 2.1)
  }
  /** Flagstone deck inside a polygon. */
  function deck(pts, col) {
    paint(pts, col || T.rock, 0.0)
    if (det >= 1) { ctx.save(); path(pts); ctx.clip(); rowsTex(pts, S, { g: K(7), tw: K(9), irr: 0.25, irregular: true, w: 0.5 }); ctx.restore() }
  }
  /** A small roof hatch with an iron ring. */
  function hatchDoor(x, y, w) {
    const p = rect(x - w / 2, y - w / 2, x + w / 2, y + w / 2)
    castShadow([p], 1.6); paint(p, WOOD(), 0.1)
    if (det >= 1) { ctx.save(); path(p); ctx.clip(); for (let i = 1; i < 4; i++) sg(x - w / 2, y - w / 2 + (w * i) / 4, x + w / 2, y - w / 2 + (w * i) / 4); flush(0.5); ctx.restore() }
    outline(p, 1.3, { noext: true, wob: 0.1 })
    ctx.beginPath(); ctx.arc(x, y, w * 0.14, 0, TAU); ctx.lineWidth = W(0.8); ctx.strokeStyle = INK; ctx.stroke()
  }

  /** 0: round tower under a slate cone, on a ring of corbelled stone. */
  function tow0() {
    const R = 50
    castShadow([oval(0, 0, R, R, 36)], 17)
    const base = oval(0, 0, R, R, 40, 0.004)
    paint(base, STONE(), 0.25); shadeBands(base, 0, 0, R, 3)
    if (det >= 1) ringCourses(0, 0, R, R * 0.84, 2, 30)
    loop(base, 2.3)
    const cone = fan(0, 0, R * 0.86, 0, TAU, { kind: 'tile', seams: 16 })
    loop(cone, 1.7)
    fillPoly(oval(0, 0, 2, 2, 8), INK)
    if (det >= 1) pennant(0, 0, 18, 0.35)
  }
  /** 1: square tower with a flat crenellated top, flagged roof deck and a hatch. */
  function tow1() {
    castShadow([rect(-50, -50, 50, 50)], 17)
    const t = 13
    crenSquare(-50, -50, 50, 50, 5, t)
    const inner = rect(-50 + t, -50 + t, 50 - t, 50 - t)
    castShadow([rect(-50 + t, -50 + t, -50 + t + 2, 50 - t)], 0)
    deck(inner, STONE())
    if (SH) { ctx.save(); path(inner); ctx.clip(); castShadow([rect(-50 + t - 2, -50 + t - 2, 50 - t + 2, -50 + t)], 3); castShadow([rect(-50 + t - 2, -50 + t, -50 + t, 50 - t)], 3); ctx.restore() }
    outline(inner, 1.3, { noext: true })
    hatchDoor(8, 6, 14)
    if (det >= 1) pennant(-18, -16, 16, 0.3)
  }
  /** 2: round crenellated tower with an attached stair turret under a small cone. */
  function tow2() {
    const R = 50, Ri = 36
    castShadow([oval(0, 0, R, R, 36)], 17)
    crenRing(0, 0, R, Ri, 16, { phase: 0.1 })
    const fl = oval(0, 0, Ri, Ri, 40, 0.003)
    deck(fl, STONE()); loop(fl, 1.2, { flat: true })
    if (SH) { ctx.save(); path(fl); ctx.clip(); castShadow([oval(0, 0, Ri + 3, Ri + 3, 30)], 0); ctx.restore() }
    hatchDoor(-6, 8, 13)
    // stair turret rising out of the parapet
    const tc = [27, -28], tr = 13
    castShadow([oval(tc[0], tc[1], tr, tr, 20)], 11)
    const cone = fan(tc[0], tc[1], tr, 0, TAU, { kind: 'shingle', seams: 10 }); loop(cone, 1.7)
    fillPoly(oval(tc[0], tc[1], 1.4, 1.4, 8), INK)
  }
  /** 3: square tower, hipped slate pyramid roof on a stone plinth, with a weathervane. */
  function tow3() {
    const sq = rect(-50, -50, 50, 50)
    castShadow([sq], 16); paint(sq, STONE(), 0.25)
    if (det >= 1) {
      const g = Math.max(K(9), 4.8)
      for (let s = -50 + g * 0.5; s < 50; s += g * rr(0.85, 1.2)) { sg(s, -50, s, -44); sg(s, 50, s, 44); sg(-50, s, -44, s); sg(50, s, 44, s) }
      flush(0.45)
    }
    outline(sq, 2.3)
    const ro = rect(-44, -44, 44, 44)
    const c = pyramid(-44, -44, 44, 44, { kind: 'slate' })
    outline(ro, 1.9)
    fillPoly(oval(c[0], c[1], 1.8, 1.8, 8), INK)
    if (det >= 1) { ln([c[0], c[1]], [c[0] + 9, c[1] - 4], 0.9, { taper: 0.3 }); ln([c[0] + 6, c[1] - 5.5], [c[0] + 10, c[1] - 2.5], 0.7, { taper: 0.4 }) }
  }
  /** 4: eight-sided tower with a tall pointed slate spire. */
  function tow4() {
    const R = 50
    const oct = []; for (let i = 0; i < 8; i++) { const a = PI / 8 + (TAU * i) / 8; oct.push([cos(a) * R / cos(PI / 8) * 0.93, sin(a) * R / cos(PI / 8) * 0.93]) }
    castShadow([oct], 17); paint(oct, STONE(), 0.25)
    if (det >= 1) { for (let i = 0; i < 8; i++) { const p = oct[i], q = oct[(i + 1) % 8], L = hyp(q[0] - p[0], q[1] - p[1]), g = Math.max(K(9), 4.6); for (let t = g * 0.5; t < L; t += g * rr(0.85, 1.2)) { const f = t / L, x = p[0] + (q[0] - p[0]) * f, y = p[1] + (q[1] - p[1]) * f; sg(x, y, x * 0.92, y * 0.92) } } flush(0.45) }
    outline(oct, 2.3)
    const roof = []; for (let i = 0; i < 8; i++) { const a = PI / 8 + (TAU * i) / 8; roof.push([cos(a) * R / cos(PI / 8) * 0.84, sin(a) * R / cos(PI / 8) * 0.84]) }
    for (let i = 0; i < 8; i++) {
      const p = roof[i], q = roof[(i + 1) % 8], mid = (PI / 8 + (TAU * (i + 0.5)) / 8)
      plane([p, q, [0, 0]], [cos(mid), sin(mid)], { kind: 'shingle' })
    }
    for (const p of roof) crease(p, [0, 0], 1)
    outline(roof, 1.9)
    fillPoly(oval(0, 0, 1.8, 1.8, 8), INK)
    if (det >= 1) pennant(0, 0, 15, 0.3)
  }
  /** 5: a round keep with a taller stair turret clasped to its north-east flank, both under cones. */
  function tow5() {
    const mc = [-9, 8], mr = 37, tc = [30, -28], tr = 15
    castShadow([oval(mc[0], mc[1], mr, mr, 30), oval(tc[0], tc[1], tr, tr, 20)], 15)
    // keep
    const kb = oval(mc[0], mc[1], mr, mr, 36, 0.004); paint(kb, STONE(), 0.25); loop(kb, 2.1)
    if (det >= 1) ringCourses(mc[0], mc[1], mr, mr * 0.84, 2, 26)
    const kc = fan(mc[0], mc[1], mr * 0.86, 0, TAU, { kind: 'slate', seams: 14 }); loop(kc, 1.6)
    fillPoly(oval(mc[0], mc[1], 1.8, 1.8, 8), INK)
    // turret, standing a little higher
    castShadow([oval(tc[0], tc[1], tr, tr, 20)], 9)
    const tb = oval(tc[0], tc[1], tr, tr, 24, 0.004); paint(tb, STONE(), 0.25); loop(tb, 2.1)
    const tcn = fan(tc[0], tc[1], tr * 0.86, 0, TAU, { kind: 'tile', seams: 10 }); loop(tcn, 1.5)
    fillPoly(oval(tc[0], tc[1], 1.4, 1.4, 8), INK)
    if (det >= 1) pennant(tc[0], tc[1], 11, 0.25)
  }
  /** 6: timber watchtower: braced legs, a railed plank platform with a ladder, and a little shingled roof. */
  function tow6() {
    const P = 34, F = 44
    castShadow([rect(-P, -P, P, P)], 15)
    // splayed braces and the feet of the legs
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      ln([sx * F, sy * F], [sx * P, sy * P], 2.4, { taper: 0.2, wob: 0.15 })
      ln([sx * F, sy * (P - 8)], [sx * (P - 2), sy * (P - 8)], 0.9, { taper: 0.3 })
      ln([sx * (P - 8), sy * F], [sx * (P - 8), sy * (P - 2)], 0.9, { taper: 0.3 })
      const foot = rect(sx * F - 3.2, sy * F - 3.2, sx * F + 3.2, sy * F + 3.2); castShadow([foot], 2.5); paint(foot, STONE(), 0.1); outline(foot, 1.3, { noext: true }); if (det >= 1) hatchIn(rect(sx * F, sy * F - 3.2, sx * F + 3.2, sy * F + 3.2), 1.9, K(2.2), 0.4)
    }
    // ladder going down the south side
    const lad = (x) => { ln([x, P - 1], [x, P + 15], 1.5, { taper: 0.1, wob: 0.1 }) }
    lad(-5); lad(5)
    for (let y = P + 3; y < P + 15; y += 3.6) ln([-5, y], [5, y], 0.9, { taper: 0.1, wob: 0.1 })
    const pf = rect(-P, -P, P, P)
    paint(pf, WOOD(), 0.1)
    ctx.save(); path(pf); ctx.clip(); plankTex(pf, S, { pw: Math.max(K(6), 4.2), w: 0.55 }); ctx.restore()
    outline(pf, 2.1)
    // handrail along the platform edge
    const hr = rect(-P + 4, -P + 4, P - 4, P - 4)
    for (let i = 0; i < 4; i++) { const p = hr[i], q = hr[(i + 1) % 4]; if (i === 2) { ln(p, [5.5, p[1]], 1.2, { taper: 0.2 }); ln([-5.5, p[1]], q, 1.2, { taper: 0.2 }) } else ln(p, q, 1.2, { taper: 0.2 }) }
    for (let i = 0; i < 4; i++) { const p = hr[i], q = hr[(i + 1) % 4], n = 5; for (let k = 0; k < n; k++) { const x = p[0] + ((q[0] - p[0]) * k) / n, y = p[1] + ((q[1] - p[1]) * k) / n; if (i === 2 && Math.abs(x) < 6) continue; post(x, y, 1.15) } }
    // roof on four posts
    const rq = rect(-22, -22, 22, 22)
    castShadow([rq], 9)
    const c = pyramid(-24, -24, 24, 24, { kind: 'plank', pw: ROW * 1.6 })
    outline(rect(-24, -24, 24, 24), 1.8)
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const q = oval(sx * 25, sy * 25, 1.7, 1.7, 8); fillPoly(q, PAPER); loop(q, 1.1) }
    fillPoly(oval(c[0], c[1], 1.5, 1.5, 8), INK)
    if (det >= 1) pennant(c[0], c[1], 12, 0.3)
  }
  /** 7: square keep with four round corner turrets under cones; a flat flagged roof between. */
  function tow7() {
    const H = 36, tr = 14
    castShadow([rect(-H - 6, -H - 6, H + 6, H + 6), ...[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => oval(sx * H, sy * H, tr, tr, 16))], 15)
    crenSquare(-H - 4, -H - 4, H + 4, H + 4, 4, 10)
    const inner = rect(-H + 6, -H + 6, H - 6, H - 6)
    deck(inner, STONE()); outline(inner, 1.1, { noext: true })
    if (SH) { ctx.save(); path(inner); ctx.clip(); castShadow([rect(-H + 4, -H + 4, H - 4, -H + 6)], 3); castShadow([rect(-H + 4, -H + 6, -H + 6, H - 6)], 3); ctx.restore() }
    hatchDoor(4, 4, 10)
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const tb = oval(sx * H, sy * H, tr, tr, 20, 0.004); paint(tb, STONE(), 0.25); loop(tb, 2)
      const c = fan(sx * H, sy * H, tr * 0.84, 0, TAU, { kind: 'tile', seams: 8 }); loop(c, 1.4)
      fillPoly(oval(sx * H, sy * H, 1.2, 1.2, 6), INK)
    }
    if (det >= 1) pennant(-20, -18, 14, 0.3)
  }
  reg('bm-tower', 'Tower', 'fixed', [tow0, tow1, tow2, tow3, tow4, tow5, tow6, tow7])

  /* =====================================================================================================================
     CHAPEL: long and cross-shaped roofs with bell towers, apses and bellcotes
     ===================================================================================================================== */
  /** A tiny bellcote: little gabled roof set across the ridge, a bell dot and a cross. */
  function bellcote(x0, y0, x1, y1, kind) {
    const p = rect(x0, y0, x1, y1)
    castShadow([p], 4.5); baseOf(p, kind)
    gable(x0, y0, x1, y1, 'y', { kind })
    outline(p, 1.6, { noext: true })
    const cx = (x0 + x1) / 2
    if (det >= 1) { fillPoly(oval(cx, (y0 + y1) / 2, 1.1, 1.1, 6), INK) }
  }
  /** Low churchyard wall segment: stone band with a coping line. */
  function wallBand(a, b, t) {
    const L = hyp(b[0] - a[0], b[1] - a[1]), vx = (b[0] - a[0]) / L, vy = (b[1] - a[1]) / L, nx = -vy * t / 2, ny = vx * t / 2
    const p = [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]]
    castShadow([p], 2); paint(p, STONE(), 0.1)
    if (det >= 1) { const g = Math.max(K(7), 4); for (let s = g * 0.5; s < L; s += g * rr(0.85, 1.2)) sg(a[0] + vx * s + nx, a[1] + vy * s + ny, a[0] + vx * s - nx, a[1] + vy * s - ny); flush(0.45) }
    outline(p, 1.3, { noext: true, wob: 0.15 })
  }
  function headstone(x, y, w, h) {
    const p = [[x - w / 2, y + h / 2], [x - w / 2, y - h / 4], [x - w / 4, y - h / 2], [x + w / 4, y - h / 2], [x + w / 2, y - h / 4], [x + w / 2, y + h / 2]]
    castShadow([p], 1.8); paint(p, STONE(), 0.1); outline(p, 1, { noext: true, wob: 0.1 })
    if (det >= 2) hatchIn(p.filter((q, i) => i > 2 || i === 0).length ? [[x, y - h / 2], [x + w / 2, y - h / 4], [x + w / 2, y + h / 2], [x, y + h / 2]] : p, 1.9, K(2.2), 0.4)
  }

  /** 0: cruciform church in slate: long nave, short transepts, a little lantern at the crossing and a square tower on the west end. */
  function cha0() {
    const xT = 6
    const sil = [[-50, -10], [-30, -10], [-30, -12], [xT - 12, -12], [xT - 12, -34], [xT + 12, -34], [xT + 12, -12], [50, -12], [50, 12], [xT + 12, 12], [xT + 12, 34], [xT - 12, 34], [xT - 12, 12], [-30, 12], [-30, 10], [-50, 10]]
    castShadow([sil], 9); baseOf(sil, 'slate')
    const k = { kind: 'slate' }
    gable(-30, -12, 50, 12, 'x', Object.assign({ hip1: true }, k))
    for (const sg2 of [-1, 1]) {
      plane([[xT, 0], [xT - 12, sg2 * 12], [xT - 12, sg2 * 34], [xT, sg2 * 34]], WD, k)
      plane([[xT, 0], [xT + 12, sg2 * 12], [xT + 12, sg2 * 34], [xT, sg2 * 34]], E, k)
      crease([xT - 12, sg2 * 12], [xT, 0], 1.1); crease([xT + 12, sg2 * 12], [xT, 0], 1.1)
      ridge([xT, 0], [xT, sg2 * 34], 'slate')
    }
    // nave ridge, redrawn clear of the crossing
    ridge([-30, 0], [xT - 3, 0], 'slate'); ridge([xT + 3, 0], [38, 0], 'slate')
    // west tower
    const tw = rect(-50, -10, -30, 10)
    baseOf(tw, 'slate'); pyramid(-50, -10, -30, 10, k); outline(tw, 1.9)
    fillPoly(oval(-40, 0, 1.4, 1.4, 6), INK)
    // crossing lantern
    const lant = rect(xT - 6, -6, xT + 6, 6); castShadow([lant], 5); baseOf(lant, 'slate'); pyramid(xT - 6, -6, xT + 6, 6, k); outline(lant, 1.5, { noext: true })
    outline(sil, 2.2); eaveBand(sil)
    ln([-30, -10], [-30, 10], 1.6, { taper: 0.3 })
    slab(-14, 17, 8, 4)
  }
  /** 1: small nave ending in a round apse, with a bellcote on the west gable and a porch. */
  function cha1() {
    const ax = 34, ar = 16
    const sil = [[-50, -16], [ax, -16]]
    for (let i = 0; i <= 12; i++) { const a = -PI / 2 + (PI * i) / 12; sil.push([ax + cos(a) * ar, sin(a) * ar]) }
    sil.push([ax, 16], [-50, 16])
    const porch = rect(-34, 16, -18, 27)
    castShadow([sil, porch], 8); baseOf(sil, 'shingle')
    plane([[-50, -16], [ax, -16], [ax, 0], [-50, 0]], N, SHIN)
    plane([[-50, 16], [ax, 16], [ax, 0], [-50, 0]], S, SHIN)
    fan(ax, 0, ar, -PI / 2, PI / 2, { kind: 'shingle', seams: 10 })
    ridge([-50, 0], [ax, 0], 'shingle'); ln([ax, -16], [ax, 16], 1.1, { taper: 0.3 })
    outline(sil, 2.2); eaveBand(sil)
    gable(-34, 16, -18, 27, 'y', SHIN); outline(porch, 1.5, { noext: true }); ln([-34, 16], [-18, 16], 0.8, { taper: 0.3 })
    bellcote(-50, -6, -41, 6, 'shingle')
    slab(-26, 31, 8, 3.6)
  }
  /** 2: aisled church: nave under tile, aisles on both sides, a crenellated west tower and a south porch. */
  function cha2() {
    const sil = [[-26, -26], [50, -26], [50, 26], [16, 26], [16, 36], [0, 36], [0, 26], [-26, 26], [-26, 12], [-50, 12], [-50, -12], [-26, -12]]
    castShadow([sil], 9); baseOf(sil, 'tile')
    gable(-26, -12, 50, 12, 'x', Object.assign({ hip1: true }, TILE))
    shed([[-26, -26], [50, -26], [50, -12], [-26, -12]].slice(0, 0).concat([[-26, -26], [46, -26], [46, -12], [-26, -12]]), N, TILE, [[-26, -12], [46, -12]])
    shed([[-26, 26], [46, 26], [46, 12], [-26, 12]], S, TILE, [[-26, 12], [46, 12]])
    gable(0, 18, 16, 36, 'y', TILE); ln([0, 22], [16, 22], 0.7, { taper: 0.3 })
    outline(sil, 2.2); eaveBand(sil)
    const tw = rect(-50, -12, -26, 12)
    castShadow([tw], 12)
    crenSquare(-50, -12, -26, 12, 3, 7)
    const inn = rect(-43, -5, -33, 5); deck(inn, STONE()); outline(inn, 0.9, { noext: true })
    ridge([-26, 0], [44, 0], 'tile')
    slab(8, 40, 8, 3.6)
  }
  /** 3: Greek-cross chapel: four equal arms under tile, a faceted slate lantern spire over the crossing. */
  function cha3() {
    const sil = [[-14, -50], [14, -50], [14, -14], [50, -14], [50, 14], [14, 14], [14, 50], [-14, 50], [-14, 14], [-50, 14], [-50, -14], [-14, -14]]
    castShadow([sil], 9); baseOf(sil, 'tile')
    gable(-50, -14, 50, 14, 'x', TILE)
    for (const s2 of [-1, 1]) {
      plane([[0, 0], [-14, s2 * 14], [-14, s2 * 50], [0, s2 * 50]], WD, TILE)
      plane([[0, 0], [14, s2 * 14], [14, s2 * 50], [0, s2 * 50]], E, TILE)
      crease([-14, s2 * 14], [0, 0], 1.1); crease([14, s2 * 14], [0, 0], 1.1); ridge([0, 0], [0, s2 * 50], 'tile')
    }
    ridge([-50, 0], [0, 0], 'tile'); ridge([0, 0], [50, 0], 'tile')
    outline(sil, 2.2); eaveBand(sil)
    const sp = []; for (let i = 0; i < 8; i++) { const a = PI / 8 + (TAU * i) / 8; sp.push([cos(a) * 11.5, sin(a) * 11.5]) }
    castShadow([sp], 8); baseOf(sp, 'slate')
    for (let i = 0; i < 8; i++) { const mid = PI / 8 + (TAU * (i + 0.5)) / 8; plane([sp[i], sp[(i + 1) % 8], [0, 0]], [cos(mid), sin(mid)], { kind: 'slate' }) }
    for (const p of sp) crease(p, [0, 0], 0.9)
    outline(sp, 1.7)
    fillPoly(oval(0, 0, 1.5, 1.5, 8), INK)
    if (det >= 1) { ln([0, 0], [0, -7], 0.9, { taper: 0.3 }); ln([-2.6, -4.5], [2.6, -4.5], 0.8, { taper: 0.3 }) }
  }
  /** 4: round chapel: a conical slate roof on a drum, a chancel with an apse, a gabled porch and a lantern ring at the top. */
  function cha4() {
    const cx = -10, R = 38
    const chan = rect(24, -11, 40, 11)
    const porch = rect(-50, -9, -40, 9)
    castShadow([oval(cx, 0, R, R, 32), chan, porch, oval(40, 0, 11, 11, 14)], 9)
    // chancel with its own small apse
    baseOf(chan, 'slate'); gable(24, -11, 40, 11, 'x', Object.assign({ hip1: false }, SLATE))
    fan(40, 0, 11, -PI / 2, PI / 2, { kind: 'slate', seams: 8 }); ln([40, -11], [40, 11], 0.9, { taper: 0.3 }); ridge([24, 0], [40, 0], 'slate')
    outline([[24, -11], [40, -11], ...oval(40, 0, 11, 11, 12, 0, -PI / 2, PI / 2).slice(1), [40, 11], [24, 11]].slice(0, 0).concat(rect(24, -11, 40, 11)), 1.4, { noext: true })
    baseOf(porch, 'slate'); gable(-50, -9, -40, 9, 'x', SLATE); outline(porch, 1.5, { noext: true })
    const dome = fan(cx, 0, R, 0, TAU, { kind: 'slate', seams: 14 })
    loop(dome, 2.1)
    // lantern ring on top
    const lr = oval(cx, 0, 6, 6, 14); castShadow([lr], 5); paint(lr, STONE(), 0.2); loop(lr, 1.3)
    if (det >= 1) { for (let i = 0; i < 8; i++) { const a = (TAU * i) / 8; sg(cx + cos(a) * 3.4, cy0(0) + sin(a) * 3.4, cx + cos(a) * 6, sin(a) * 6) } flush(0.5) }
    fillPoly(oval(cx, 0, 1.6, 1.6, 8), INK)
    if (det >= 1) { ln([cx, 0], [cx, -8], 0.9, { taper: 0.3 }); ln([cx - 2.4, -5.5], [cx + 2.4, -5.5], 0.8, { taper: 0.3 }) }
  }
  const cy0 = (v) => v
  /** 5: a village chapel standing in its walled churchyard: gravestones, a lych-gate and a path. */
  function cha5() {
    const yard = rect(-50, -38, 50, 38)
    if (COL) { fillPoly(yard, mix(T.grass, T.sand, 0.3)); wash(yard, mix(T.grass, T.land, 0.3), 0.45) } else fillPoly(yard, PAPER)
    if (det >= 1) stippleIn(yard, 1.2, K(0.7))
    // path from the gate to the door
    if (det >= 1) { for (let i = 0; i < 14; i++) { const y = 38 - i * 4.2, x = -4 + (y > 0 ? 0 : (y + 38) * -0.0) ; ln([x - 2, y], [x + 2, y + 0.4], 0.5, { taper: 0.9, wob: 0.2 }) } }
    // the chapel
    const sil = [[-44, -34], [14, -34], [14, -8], [-44, -8]]
    castShadow([sil], 8); baseOf(sil, 'shingle')
    gable(-44, -34, 14, -8, 'x', SHIN)
    outline(sil, 2.1); eaveBand(sil)
    bellcote(-44, -26, -35, -16, 'shingle')
    slab(-6, -3, 8, 3.6)
    // graves
    const gv = [[-38, 6], [-28, 7], [-18, 5], [-38, 18], [-27, 17], [-17, 19], [22, -22], [30, -14], [38, -22], [30, 8], [38, 16], [22, 20], [30, 26], [-36, 29], [-24, 28], [44, 0]]
    for (const [gx, gy] of gv) headstone(gx, gy, 4.6, 6.4)
    // wall with a lych-gate gap on the south
    const wt = 3.4
    wallBand([-50, -38], [50, -38], wt); wallBand([50, -38], [50, 38], wt); wallBand([-50, -38], [-50, 38], wt)
    wallBand([-50, 38], [-8, 38], wt); wallBand([8, 38], [50, 38], wt)
    const lg = rect(-10, 34, 10, 42); castShadow([lg], 3); baseOf(lg, 'shingle'); gable(-10, 34, 10, 42, 'x', SHIN); outline(lg, 1.6, { noext: true })
  }
  /** 6: a Gothic church: tall nave with buttresses, a five-sided apse and a crenellated tower at the south-west. */
  function cha6() {
    const dy = -9
    ctx.save(); ctx.translate(0, dy)
    const ax = 33, ar = 17
    const sil = [[-50, -17], [ax, -17]]
    for (let i = 0; i <= 10; i++) { const a = -PI / 2 + (PI * i) / 10; sil.push([ax + cos(a) * ar, sin(a) * ar]) }
    sil.push([ax, 17], [-30, 17], [-30, 36], [-50, 36])
    castShadow([sil], 10); baseOf(sil, 'slate')
    plane([[-50, -17], [ax, -17], [ax, 0], [-50, 0]], N, SLATE)
    plane([[-50, 17], [ax, 17], [ax, 0], [-50, 0]], S, SLATE)
    fan(ax, 0, ar, -PI / 2, PI / 2, { kind: 'slate', sides: 10, seams: 10 })
    ridge([-50, 0], [ax, 0], 'slate'); ln([ax, -17], [ax, 17], 1.1, { taper: 0.3 })
    // buttresses: stone caps standing proud of the eaves
    for (const bx of [-38, -22, -6, 10, 26]) for (const by of [-1, 1]) {
      const bu = rect(bx - 2.3, by < 0 ? -22 : 17, bx + 2.3, by < 0 ? -17 : 22)
      if (by > 0 && bx < -30) continue
      castShadow([bu], 3); paint(bu, STONE(), 0.1); outline(bu, 1.3, { noext: true, wob: 0.1 }); if (det >= 1) hatchIn(rect(bx, by < 0 ? -22 : 17, bx + 2.3, by < 0 ? -17 : 22), 1.9, K(2.2), 0.4)
    }
    outline(sil.slice(0, -4).concat([[ax, 17], [-50, 17]]).slice(0, 0).concat(sil), 2.2); eaveBand(sil)
    // tower
    const tw = rect(-50, 17, -30, 36)
    castShadow([tw], 13)
    crenSquare(-50, 17, -30, 37, 3, 7)
    const inn = rect(-43, 24, -37, 30); deck(inn, STONE()); outline(inn, 0.9, { noext: true })
    ctx.restore()
  }
  /** 7: timber-framed chapel in shingle with a chancel and a separate open belfry on four posts. */
  function cha7() {
    const sil = [[-50, -17], [14, -17], [14, -9], [30, -9], [30, 9], [14, 9], [14, 17], [-50, 17]]
    const bf = rect(30, -34, 50, -14)
    castShadow([sil, bf], 9); baseOf(sil, 'shingle')
    gable(-50, -17, 14, 17, 'x', SHIN)
    gable(14, -9, 30, 9, 'x', Object.assign({ hip1: true }, SHIN))
    ridge([-50, 0], [14, 0], 'shingle')
    outline(sil, 2.2); eaveBand(sil)
    ln([14, -9], [14, 9], 1, { taper: 0.3 })
    // porch
    const pc = rect(-36, 17, -22, 27); castShadow([pc], 3); baseOf(pc, 'shingle'); gable(-36, 17, -22, 27, 'y', SHIN); outline(pc, 1.5, { noext: true })
    // belfry: posts, brace, small pyramid roof
    const posts = [[32, -32], [48, -32], [48, -16], [32, -16]]
    for (let i = 0; i < 4; i++) ln(posts[i], posts[(i + 1) % 4], 1.4, { taper: 0.2 })
    ln(posts[0], posts[2], 0.8, { taper: 0.3 }); ln(posts[1], posts[3], 0.8, { taper: 0.3 })
    for (const p of posts) { fillPoly(oval(p[0], p[1], 2, 2, 8), PAPER); loop(oval(p[0], p[1], 2, 2, 8), 1.2) }
    castShadow([rect(34, -30, 46, -18)], 7)
    const c = pyramid(33, -31, 47, -17, SHIN); outline(rect(33, -31, 47, -17), 1.6)
    fillPoly(oval(c[0], c[1], 1.2, 1.2, 6), INK)
    // flagstone path between door and belfry
    if (det >= 1) { for (const [sx, sy] of [[-29, 31], [-28, 36]]) slab(sx, sy, 6, 3.4) }
  }
  reg('bm-chapel', 'Chapel', 'fixed', [cha0, cha1, cha2, cha3, cha4, cha5, cha6, cha7])

  /* =====================================================================================================================
     RUIN: a floor plan seen from above, drawn fresh each time (broken wall bands, rubble, flags, a doorway)
     ===================================================================================================================== */
  function inPoly(x, y, poly) {
    let c = false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j]
      if (((a[1] > y) !== (b[1] > y)) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c
    }
    return c
  }
  /** A loose stone or fallen block, seen from above. */
  function stone(x, y, rad, o) {
    o = o || {}
    const n = o.n || (r() < 0.5 ? 5 : 6), ph = r() * 6, el = rr(0.65, 1)
    const pts = []
    for (let i = 0; i < n; i++) { const a = ph + (TAU * i) / n + jt(0.28), k = rad * rr(0.72, 1.12); pts.push([x + cos(a) * k, y + sin(a) * k * el]) }
    if (det >= 2) castShadow([pts], Math.max(1, rad * 0.55))
    if (det >= 2) paint(pts, o.col || STONE(), rr(0, 0.25), 0.55); else fillPoly(pts, COL ? mix(o.col || STONE(), PAPER, 0.35) : PAPER)
    outline(pts, rad > 2.6 ? 1.2 : 0.9, { noext: true, wob: 0.1 })
    if (det >= 2 && rad > 2.1) { const m = [[x, y - rad * 0.1], [x + rad * 0.9, y + rad * 0.2], [x + rad * 0.5, y + rad * 0.8 * el], [x - rad * 0.2, y + rad * 0.8 * el]]; hatchIn(m, 2.0, K(2.2), 0.4) }
  }
  /** Offset a polyline into a wall band polygon, mitred at corners. */
  function bandPoly(c, t, jag0, jag1) {
    const n = c.length, L = [], R = []
    const tang = (i) => { const a = c[Math.max(0, i - 1)], b = c[Math.min(n - 1, i + 1)], d = hyp(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / d, (b[1] - a[1]) / d] }
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
    // subdivide long edges and wobble the faces a little, like uneven masonry
    const sub = (P) => { const o = [P[0]]; for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i], d = hyp(b[0] - a[0], b[1] - a[1]), m = Math.floor(d / 9); for (let q = 1; q <= m; q++) { const f = q / (m + 1); o.push([a[0] + (b[0] - a[0]) * f + jt(0.35), a[1] + (b[1] - a[1]) * f + jt(0.35)]) } o.push(b) } return o }
    const Ls = sub(L), Rs = sub(R).reverse()
    const t0 = tang(0), t1 = tang(n - 1)
    const cap = (a, b, tx, ty, j) => (j ? [[(a[0] + b[0]) / 2 + tx * jt(j) + (b[0] - a[0]) * 0.22, (a[1] + b[1]) / 2 + ty * jt(j) + (b[1] - a[1]) * 0.22], [(a[0] + b[0]) / 2 + tx * jt(j) - (b[0] - a[0]) * 0.22, (a[1] + b[1]) / 2 + ty * jt(j) - (b[1] - a[1]) * 0.22]] : [])
    // end caps: stepped, broken edges where the wall has fallen
    const startCap = jag0 ? cap(Rs[Rs.length - 1], Ls[0], -t0[0], -t0[1], jag0) : []
    const endCap = jag1 ? cap(Ls[Ls.length - 1], Rs[0], t1[0], t1[1], jag1) : []
    return { poly: [...startCap.reverse().length ? startCap : [], ...Ls, ...endCap, ...Rs], Ls, Rs }
  }

  function ruin() {
    // ---- choose a plan ----
    const plan = Math.floor(r() * 7), runs = [], rooms = []
    const w = rr(66, 94), h = rr(40, 64)
    let t = rr(6.6, 8.2)
    const circ = (cx, cy, rad, n) => { const p = []; for (let i = 0; i < n; i++) { const a = (TAU * i) / n; p.push([cx + cos(a) * rad, cy + sin(a) * rad]) } return p }
    if (plan === 0) { const p = rect(-w / 2, -h / 2, w / 2, h / 2); runs.push({ pts: p, closed: true, door: true }); rooms.push(p) }
    else if (plan === 1) {
      const p = rect(-w / 2, -h / 2, w / 2, h / 2), px = rr(-w * 0.2, w * 0.22)
      runs.push({ pts: p, closed: true, door: true }, { pts: [[px, -h / 2], [px, h / 2]], closed: false, door: r() < 0.7 })
      rooms.push([[-w / 2, -h / 2], [px, -h / 2], [px, h / 2], [-w / 2, h / 2]], [[px, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [px, h / 2]])
    } else if (plan === 2) {
      const c = rr(-w * 0.05, w * 0.18), d = rr(-h * 0.05, h * 0.12)
      const p = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, d], [c, d], [c, h / 2], [-w / 2, h / 2]]
      runs.push({ pts: p, closed: true, door: true }); rooms.push(p)
    } else if (plan === 3) {
      const ww = Math.min(w, 82), hh = Math.min(h, 54), p = rect(-ww / 2, -hh / 2, ww / 2, hh / 2), tr = rr(13, 17)
      const cp = circ(ww / 2, -hh / 2, tr, 22)
      runs.push({ pts: p, closed: true, door: true }, { pts: cp, closed: true, door: false }); rooms.push(p, cp)
      t = rr(6, 7.4)
    } else if (plan === 4) {
      const R = rr(30, 46), cp = circ(0, 0, R, 30)
      runs.push({ pts: cp, closed: true, door: true }); rooms.push(cp)
      if (r() < 0.6) { const a = rect(R - 2, -8, R + 12, 8); runs.push({ pts: [[R - 1, -8], [R + 11, -8], [R + 11, 8], [R - 1, 8]], closed: false, door: false }); rooms.push(a) }
      t = rr(8, 10)
    } else if (plan === 5) {
      const ww = rr(62, 78), hh = rr(32, 44), p = [[-ww / 2, -hh / 2], [ww / 2 - hh / 2, -hh / 2]]
      for (let i = 1; i < 10; i++) { const a = -PI / 2 + (PI * i) / 10; p.push([ww / 2 - hh / 2 + cos(a) * hh / 2, sin(a) * hh / 2]) }
      p.push([ww / 2 - hh / 2, hh / 2], [-ww / 2, hh / 2])
      runs.push({ pts: p, closed: true, door: true }); rooms.push(p)
    } else {
      const sz = rr(58, 72), q = sz / 2, tw = 15, p = rect(-q, -q, q, q)
      runs.push({ pts: p, closed: true, door: true })
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) runs.push({ pts: rect(sx * q - tw / 2, sy * q - tw / 2, sx * q + tw / 2, sy * q + tw / 2), closed: true, door: false })
      rooms.push(p)
      t = rr(8.5, 10)
    }
    // random quarter-turn and mirror, then fit the plan to 94 units
    const q = Math.floor(r() * 4), fl = r() < 0.5
    const tf = (p) => { let x = fl ? -p[0] : p[0], y = p[1]; for (let i = 0; i < q; i++) { const nx = -y; y = x; x = nx } return [x, y] }
    for (const ru of runs) ru.pts = ru.pts.map(tf)
    for (let i = 0; i < rooms.length; i++) rooms[i] = rooms[i].map(tf)
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
    for (const ru of runs) for (const p of ru.pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]) }
    const sc = Math.min(1, 90 / Math.max(x1 - x0 + t, y1 - y0 + t)), ox = (x0 + x1) / 2, oy = (y0 + y1) / 2
    const fit = (p) => [(p[0] - ox) * sc, (p[1] - oy) * sc]
    for (const ru of runs) ru.pts = ru.pts.map(fit)
    for (let i = 0; i < rooms.length; i++) rooms[i] = rooms[i].map(fit)
    t *= Math.max(0.8, sc)

    // ---- break the walls into standing pieces ----
    const intact = rr(0.5, 0.9), pieces = [], doors = []
    for (const ru of runs) {
      const P = ru.closed ? ru.pts.concat([ru.pts[0]]) : ru.pts, C = [0]
      for (let i = 1; i < P.length; i++) C.push(C[i - 1] + hyp(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]))
      const L = C[C.length - 1]
      const at = (s) => { let i = 1; while (i < C.length - 1 && C[i] < s) i++; const f = (s - C[i - 1]) / ((C[i] - C[i - 1]) || 1); return [P[i - 1][0] + (P[i][0] - P[i - 1][0]) * f, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * f, i] }
      const sub = (s0, s1) => { const out = [at(s0).slice(0, 2)]; for (let i = 1; i < P.length - 1; i++) if (C[i] > s0 + 1.5 && C[i] < s1 - 1.5) out.push(P[i]); out.push(at(s1).slice(0, 2)); return out }
      // doorway on a longish stretch
      let gap = null
      if (ru.door) { const gw = rr(11, 14); let tries = 0, d; do { d = rr(0.12, 0.88) * L; tries++ } while (tries < 20 && (() => { const a = at(d - gw / 2), b = at(d + gw / 2); return a[2] !== b[2] })()); gap = [d - gw / 2, d + gw / 2]; const a = at(d), b = at(Math.min(L, d + 1)); doors.push({ x: a[0], y: a[1], tx: b[0] - a[0], ty: b[1] - a[1], gw }) }
      let s = ru.closed ? rr(0, 14) : 0, firstDone = false
      const start0 = s
      const raw = []
      while (s < L - 1) {
        const len = (r() < 0.3 ? rr(34, 80) : rr(10, 34)) * (0.55 + intact * 0.8)
        const e = Math.min(s + len, L)
        if (r() < 0.2 + intact * 0.75 || !firstDone) raw.push([s, e])
        firstDone = true
        s = e + (r() < 0.2 ? 0.01 : rr(3, 13) * (1.5 - intact))
      }
      if (ru.closed && start0 > 3 && r() < 0.8) raw.push([Math.max(0, start0 - rr(8, 30)), start0 - 3].map((v) => Math.max(0, v)))
      for (let [a, b] of raw) {
        let segs = [[a, b]]
        if (gap) { segs = []; if (a < gap[0]) segs.push([a, Math.min(b, gap[0])]); if (b > gap[1]) segs.push([Math.max(a, gap[1]), b]) }
        for (const [sa, sb] of segs) {
          if (sb - sa < 3.5) continue
          const nearDoorA = gap && Math.abs(sa - gap[1]) < 0.05, nearDoorB = gap && Math.abs(sb - gap[0]) < 0.05
          const clean0 = nearDoorA || (!ru.closed && sa < 0.01), clean1 = nearDoorB || (!ru.closed && sb > L - 0.01)
          const bp = bandPoly(sub(sa, sb), t, clean0 ? 0 : rr(1.2, 3.2), clean1 ? 0 : rr(1.2, 3.2))
          pieces.push({ c: sub(sa, sb), bp, ends: [clean0 ? null : at(sa), clean1 ? null : at(sb)] })
        }
      }
    }
    const polys = pieces.map((p) => p.bp.poly)

    // ---- drawing ----
    // floors
    const floorCol = mix(T.sand, T.rock, 0.4)
    for (const rm of rooms) {
      if (COL) { fillPoly(rm, mix(floorCol, PAPER, 0.4)); wash(rm, floorCol, 0.55) } else fillPoly(rm, PAPER)
      let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9
      for (const p of rm) { bx0 = Math.min(bx0, p[0]); bx1 = Math.max(bx1, p[0]); by0 = Math.min(by0, p[1]); by1 = Math.max(by1, p[1]) }
      if (det < 1) continue
      ctx.save(); path(rm); ctx.clip()
      const cell = Math.max(8, K(21)), ph1 = r() * 6, ph2 = r() * 6, cover = rr(0.6, 0.9), ph3 = r() * 6
      const yb = [by0 - 3 - rr(0, cell * 0.5)]
      while (yb[yb.length - 1] < by1 + 2) yb.push(yb[yb.length - 1] + cell * rr(0.85, 1.2))
      const fy = (yy, rowI, xx) => yy + cell * 0.05 * sin(xx * 0.43 + rowI * 1.9 + ph3)
      for (let ri = 0; ri < yb.length - 1; ri++) {
        const ya = yb[ri], yc = yb[ri + 1], rowH = yc - ya
        let x = bx0 - 3 - rr(0, cell * 0.8)
        while (x < bx1 + 2) {
          const cw = rowH * rr(0.9, 1.55), x2 = x + cw, cxm = (x + x2) / 2, cym = (ya + yc) / 2, noise = 0.5 + 0.5 * sin(cxm * 0.11 + ph1) * sin(cym * 0.14 + ph2)
          if (r() > cover * (0.4 + 1.0 * noise)) { if (det >= 2 && r() < 0.6) dots(2, x, ya, x2, yc, 0.45); x = x2; continue }
          const lean = (yy) => cell * 0.04 * sin(yy * 0.6 + ph3)
          sg(x, fy(ya, ri, x), x2, fy(ya, ri, x2)); sg(x, fy(yc, ri + 1, x), x2, fy(yc, ri + 1, x2))
          sg(x + lean(ya), fy(ya, ri, x), x + lean(yc), fy(yc, ri + 1, x)); sg(x2 + lean(ya), fy(ya, ri, x2), x2 + lean(yc), fy(yc, ri + 1, x2))
          if (det >= 2 && r() < 0.14) { sg(x + cw * 0.2, ya + rowH * 0.35, x + cw * 0.6, ya + rowH * 0.8) }
          x = x2
        }
      }
      flush(0.42)
      if (det >= 2) {
        for (let i = 0; i < 2; i++) { const px = rr(bx0, bx1), py = rr(by0, by1), a = r() * TAU; if (inPoly(px, py, rm)) pl([[px, py], [px + cos(a) * 6 + jt(1), py + sin(a) * 6], [px + cos(a) * 11 + jt(2), py + sin(a) * 11 + jt(2)]], 0.7, { taper: 0.9, wob: 0.3 }) }
        const nT = Math.round(((bx1 - bx0) * (by1 - by0)) / 650)
        for (let i = 0; i < nT; i++) { const px = rr(bx0, bx1), py = rr(by0, by1); if (inPoly(px, py, rm)) tuft(px, py, rr(0.8, 1.4)) }
        flush(0.55)
      }
      ctx.restore()
    }
    if (SH) castShadow(polys, 4.2)
    // walls: outline ribbons first (double weight), then the stone on top, so overlaps at corners merge cleanly
    for (const p of pieces) outline(p.bp.poly, 3.2, { noext: true, wob: 0.18 })
    const wallCol = lighter(STONE(), 0.1)
    for (const p of pieces) {
      const sh = clamp(0.1 + (p.c[0][0] * LX + p.c[0][1] * LY) / 200, 0, 0.4)
      paint(p.bp.poly, wallCol, sh, 0.65)
    }
    for (const p of pieces) {
      const poly = p.bp.poly
      ctx.save(); path(poly); ctx.clip()
      // blocks: ticks across the band and a mortar line down it
      const g = Math.max(K(10), 5.2), c = p.c
      for (let i = 0; i < c.length - 1; i++) {
        const a = c[i], b = c[i + 1], d = hyp(b[0] - a[0], b[1] - a[1]) || 1, vx = (b[0] - a[0]) / d, vy = (b[1] - a[1]) / d, nx = -vy * t * 0.5, ny = vx * t * 0.5
        sg(a[0] - vx * 2, a[1] - vy * 2, b[0] + vx * 2, b[1] + vy * 2)
        if (det >= 2) for (let s2 = rr(0, g); s2 < d; s2 += g * rr(0.7, 1.35)) { const side = r() < 0.5 ? 1 : -1; sg(a[0] + vx * s2, a[1] + vy * s2, a[0] + vx * s2 + nx * side * 1.2, a[1] + vy * s2 + ny * side * 1.2); sg(a[0] + vx * s2 + nx * side * 0.01, a[1] + vy * s2 + ny * side * 0.01, a[0] + vx * s2 + nx * -side * 0.0, a[1] + vy * s2) }
      }
      flush(0.5)
      // shade: hatching on the lower-right half of the band
      if (det >= 0) {
        for (let i = 0; i < c.length - 1; i++) {
          const a = c[i], b = c[i + 1], d = hyp(b[0] - a[0], b[1] - a[1]) || 1, vx = (b[0] - a[0]) / d, vy = (b[1] - a[1]) / d
          let nx = -vy, ny = vx; if (nx * LX + ny * LY < 0) { nx = -nx; ny = -ny }
          const f = clamp(nx * LX + ny * LY, 0, 1)
          const gg = Math.max(K(2.4), 1.5)
          for (let s2 = 0; s2 < d; s2 += gg * rr(0.8, 1.25)) { const e = t * rr(0.28, 0.5) * (0.5 + f); sg(a[0] + vx * s2, a[1] + vy * s2, a[0] + vx * (s2 + e * 0.5) + nx * e * 1.05, a[1] + vy * (s2 + e * 0.5) + ny * e * 1.05) }
        }
        flush(0.5)
      }
      if (det >= 2) { stippleIn(poly, 0.9, K(0.55)) }
      if (COL && r() < 0.35) { ctx.globalAlpha = 0.28; fillPoly(oval((p.c[0][0] + p.c[p.c.length - 1][0]) / 2, (p.c[0][1] + p.c[p.c.length - 1][1]) / 2, rr(6, 12), rr(3, 5), 12), T.forest); ctx.globalAlpha = 1 }
      ctx.restore()
    }
    // inked top edges again where the lighting is strongest: a thin line along the lit faces, drawn over the stone
    // rubble at the broken ends
    const rub = Math.max(0, Math.min(1, (SZ - 40) / 120))
    for (const p of pieces) {
      for (let k = 0; k < 2; k++) {
        const e = p.ends[k]; if (!e) continue
        const c = p.c, a = k === 0 ? c[0] : c[c.length - 1], b = k === 0 ? c[1] : c[c.length - 2], d = hyp(a[0] - b[0], a[1] - b[1]) || 1, vx = (a[0] - b[0]) / d, vy = (a[1] - b[1]) / d
        const n = Math.round(rr(1, 3) + rub * 3)
        for (let i = 0; i < n; i++) { const along = rr(1, 11), side = jt(t * 0.9); stone(a[0] + vx * along - vy * side, a[1] + vy * along + vx * side, rr(1.3, 3.3) * (SZ < 80 ? 1.2 : 1)) }
        if (det >= 2) dots(Math.round(5 + rub * 8), a[0] + vx * 1 - 8, a[1] + vy * 1 - 8, a[0] + vx * 1 + 8, a[1] + vy * 1 + 8, 0.45)
      }
    }
    // a few big fallen blocks and loose stones inside
    for (let i = 0; i < Math.round(1 + rub * 5); i++) { const rm = rooms[Math.floor(r() * rooms.length)]; let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9; for (const p of rm) { bx0 = Math.min(bx0, p[0]); bx1 = Math.max(bx1, p[0]); by0 = Math.min(by0, p[1]); by1 = Math.max(by1, p[1]) } const px = rr(bx0, bx1), py = rr(by0, by1); if (inPoly(px, py, rm)) stone(px, py, rr(1.4, 3.6)) }
    // doorway: worn threshold slabs
    for (const d of doors) {
      const L = hyp(d.tx, d.ty) || 1, vx = d.tx / L, vy = d.ty / L
      for (const sg2 of [-1, 1]) { const px = d.x + vx * (d.gw / 2) * sg2 * 0.0, py = d.y + vy * 0 }
      const sl = rect(-d.gw / 2 + 1, -t / 2 + 0.8, d.gw / 2 - 1, t / 2 - 0.8)
      ctx.save(); ctx.translate(d.x + vx * d.gw / 2, d.y + vy * d.gw / 2); ctx.rotate(Math.atan2(vy, vx))
      paint(sl, STONE(), 0.05, 0.5); outline(sl, 1, { noext: true, wob: 0.1 })
      if (det >= 1) { sg(0, -t / 2 + 0.8, 0, t / 2 - 0.8); flush(0.5) }
      ctx.restore()
    }
  }
  A.register('bm-ruin', { label: 'Ruined building', category: 'bm-buildings', kind: 'recipe', view: 'top',
    draw(c, x, y, s, rg, style) { open(c, x, y, s, rg, style); try { ruin() } finally { ctx.restore() } } })

  /* =====================================================================================================================
     BRIDGE: laid across a stream, long side along x (the water runs up and down the page)
     ===================================================================================================================== */
  /** Planks laid across a deck: each plank is a short ink line, with grain ticks, nails and the odd darker board. */
  function deckPlanks(x0, y0, x1, y1, pw, o) {
    o = o || {}
    const p = rect(x0, y0, x1, y1)
    paint(p, o.col || WOOD(), 0.05)
    ctx.save(); path(p); ctx.clip()
    const n = Math.max(2, Math.round((x1 - x0) / pw))
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n + jt(0.12)
      sg(x, y0 - 1, x + jt(0.25), y1 + 1)
    }
    flush(0.7)
    if (det >= 1) {
      for (let i = 0; i < n; i++) {
        const xa = x0 + ((x1 - x0) * i) / n, xb = x0 + ((x1 - x0) * (i + 1)) / n
        // grain
        const k = det >= 2 ? 2 : 1
        for (let q = 0; q < k; q++) { const gx = xa + (xb - xa) * rr(0.25, 0.75), gy = rr(y0 + 1, y1 - 6), l = rr(3, (y1 - y0) * 0.45); sg(gx, gy, gx + jt(0.2), gy + l) }
        if (det >= 2) { sg(xa + (xb - xa) * 0.5 - 0.2, y0 + 1.8, xa + (xb - xa) * 0.5 + 0.2, y0 + 1.8); sg(xa + (xb - xa) * 0.5 - 0.2, y1 - 1.8, xa + (xb - xa) * 0.5 + 0.2, y1 - 1.8) }
        if (r() < 0.14) { for (let h2 = y0; h2 < y1; h2 += K(2.6)) sg(xa + 0.3, h2, xb - 0.3, h2 + (xb - xa) * 0.8) }
      }
      flush(0.4)
    }
    ctx.restore()
    return p
  }
  /** Round-topped timber post or pile seen from above. */
  function pile(x, y, rad) {
    const c = oval(x, y, rad, rad, 10); castShadow([c], rad * 0.9); fillPoly(c, COL ? mix(WOOD(), PAPER, 0.3) : PAPER); loop(c, 1.1)
    if (det >= 1) { sg(x - rad * 0.5, y, x + rad * 0.2, y + rad * 0.3); flush(0.4) }
  }
  /** Stone coping blocks along a straight band. */
  function blocks(a, b, t, g) {
    const L = hyp(b[0] - a[0], b[1] - a[1]), vx = (b[0] - a[0]) / L, vy = (b[1] - a[1]) / L, nx = -vy * t / 2, ny = vx * t / 2
    for (let s = g * rr(0.4, 0.9); s < L - 1; s += g * rr(0.8, 1.25)) sg(a[0] + vx * s + nx, a[1] + vy * s + ny, a[0] + vx * s - nx, a[1] + vy * s - ny)
    flush(0.5)
  }
  const stoneBand = (pts, t) => {
    const p = pts; castShadow([p], 2.2); paint(p, lighter(STONE(), 0.08), 0.1)
    outline(p, t || 1.5, { noext: true, wob: 0.14 })
  }

  /** 0: plank footbridge: transverse boards between two edge beams, post-and-rail on both sides, stone footings at the ends. */
  function bri0() {
    const deck = rect(-44, -11, 44, 11)
    castShadow([deck], 3)
    for (const sx of [-1, 1]) { const f = rect(sx > 0 ? 42 : -50, -14, sx > 0 ? 50 : -42, 14); castShadow([f], 2); paint(f, STONE(), 0.1); outline(f, 1.4, { noext: true }); if (det >= 1) { hatchIn(rect(sx > 0 ? 46 : -46, -14, sx > 0 ? 50 : -42, 14), 2, K(2.3), 0.45); for (let y = -11; y < 13; y += 5.5) sg(sx > 0 ? 42 : -50, y, sx > 0 ? 50 : -42, y + jt(0.4)); flush(0.45) } }
    deckPlanks(-44, -11, 44, 11, Math.max(K(11), 3.6))
    outline(deck, 1.9)
    // edge beams and rails
    for (const sy of [-1, 1]) {
      ln([-44, sy * 11], [44, sy * 11], 2.2, { taper: 0.15, wob: 0.12 })
      ln([-44, sy * 13.2], [44, sy * 13.2], 1.2, { taper: 0.2, wob: 0.15 })
      for (let x = -44; x <= 44.1; x += 11) pile(x, sy * 13.2, 1.7)
    }
  }
  /** 1: wide cart bridge: heavy deck, bolted kerb timbers, trestle piles standing out beyond the edges. */
  function bri1() {
    const deck = rect(-45, -16, 45, 16)
    castShadow([deck], 3.5)
    for (const px of [-30, -10, 10, 30]) for (const sy of [-1, 1]) { const b = rect(px - 3.2, sy * 18.5 - 3, px + 3.2, sy * 18.5 + 3); castShadow([b], 2); paint(b, WOOD(), 0.2); outline(b, 1.2, { noext: true }); if (det >= 1) hatchIn(rect(px, sy * 18.5 - 3, px + 3.2, sy * 18.5 + 3), 2, K(2.2), 0.4) }
    for (const sx of [-1, 1]) { const f = rect(sx > 0 ? 43 : -50, -19, sx > 0 ? 50 : -43, 19); castShadow([f], 2); paint(f, STONE(), 0.1); outline(f, 1.4, { noext: true }); if (det >= 1) { hatchIn(rect(sx > 0 ? 47 : -47, -19, sx > 0 ? 50 : -43, 19), 2, K(2.3), 0.45); for (let y = -16; y < 18; y += 6) sg(sx > 0 ? 43 : -50, y, sx > 0 ? 50 : -43, y + jt(0.4)); flush(0.45) } }
    deckPlanks(-45, -16, 45, 16, Math.max(K(12), 4.2))
    outline(deck, 1.9)
    for (const sy of [-1, 1]) {
      const kb = rect(-45, sy < 0 ? -16 : 12.5, 45, sy < 0 ? -12.5 : 16)
      paint(kb, WOOD(), 0.35); outline(kb, 1.4, { noext: true })
      if (det >= 1) { for (let x = -43; x < 45; x += 6.5) { sg(x, (kb[0][1] + kb[2][1]) / 2, x + 0.01, (kb[0][1] + kb[2][1]) / 2 + 0.01) } flush(0.5) }
      ctx.beginPath(); for (let x = -43; x < 45; x += 6.5) { const yy = (kb[0][1] + kb[2][1]) / 2; ctx.moveTo(x + 0.55, yy); ctx.arc(x, yy, Math.max(0.55, K(0.8)), 0, TAU) } ctx.fillStyle = INK; ctx.fill()
      for (const px of [-45, -22.5, 0, 22.5, 45]) { const q = rect(px - 2, sy * 14.3 - 2, px + 2, sy * 14.3 + 2); paint(q, WOOD(), 0.2); outline(q, 1.1, { noext: true }); fillPoly(rect(px - 0.8, sy * 14.3 - 0.8, px + 0.8, sy * 14.3 + 0.8), INK) }
    }
  }
  /** 2: single-arch stone bridge: flared wing walls, cobbled hump, parapets with coping, two half-round refuges. */
  function bri2() {
    const par = (sy) => {
      const o = [[-50, sy * 27], [-42, sy * 22.5], [-34, sy * 18.5], [0, sy * 18], [34, sy * 18.5], [42, sy * 22.5], [50, sy * 27]], i = [[50, sy * 21.5], [42, sy * 17], [34, sy * 13.2], [0, sy * 12.7], [-34, sy * 13.2], [-42, sy * 17], [-50, sy * 21.5]]
      return o.concat(i)
    }
    const deck = [[-50, -21.5], [-42, -17], [-34, -13.2], [0, -12.7], [34, -13.2], [42, -17], [50, -21.5], [50, 21.5], [42, 17], [34, 13.2], [0, 12.7], [-34, 13.2], [-42, 17], [-50, 21.5]]
    castShadow([par(-1), par(1), deck], 3.2)
    // cobbled deck
    paint(deck, T.rock, 0.0); ctx.save(); path(deck); ctx.clip()
    rowsTex(deck, S, { g: Math.max(K(8), 3.4), tw: Math.max(K(10), 4.2), irr: 0.3, irregular: true, w: 0.5 })
    // the hump: shade the descending east slope, a few crown lines
    hatchIn([[10, -30], [50, -30], [50, 30], [10, 30]], 1.2, Math.max(K(3.2), 2), 0.5)
    for (const cx of [-8, 0]) { ln([cx, -13], [cx + jt(1), 13], 0.8, { taper: 0.6, wob: 0.25 }) }
    ctx.restore()
    outline(deck, 1.3, { noext: true, flat: true })
    for (const sy of [-1, 1]) {
      const p = par(sy)
      paint(p, lighter(STONE(), 0.08), 0.1); outline(p, 1.9, { noext: true, wob: 0.15 })
      if (det >= 1) { const g = Math.max(K(7), 4.2); ctx.save(); path(p); ctx.clip(); for (let x = -50 + g * 0.5; x < 50; x += g * rr(0.85, 1.2)) { const yo = sy * (x < -34 ? 24.3 : x > 34 ? 24.3 : 15.4); sg(x, yo - 3.2, x + jt(0.3), yo + 3.2) } flush(0.45); hatchIn([[-50, sy > 0 ? 15 : -31], [50, sy > 0 ? 15 : -31], [50, sy > 0 ? 31 : -15], [-50, sy > 0 ? 31 : -15]], 1.9, K(2.4), 0.4, { keep: 0.5 }); ctx.restore() }
    }
    for (const bx of [-18, 18]) for (const sy of [-1, 1]) {
      const c = oval(bx, sy * 18.5, 6.4, 6.4, 12, 0.005, sy < 0 ? PI : 0, sy < 0 ? TAU : PI)
      const bay = c.concat([[bx - 6.4, sy * 18.5]]).length ? c : c
      castShadow([bay], 2); paint(bay, lighter(STONE(), 0.08), 0.1); outline(bay, 1.5, { noext: true, wob: 0.12 })
      if (det >= 1) { sg(bx, sy * 12.5, bx, sy * 24.5); flush(0.45) }
    }
  }
  /** 3: rope bridge: slack planks between side ropes, foot and hand lines tied together, big anchor posts at both ends. */
  function bri3() {
    const sag = (x) => 3.2 * sin((PI * (x + 40)) / 80)
    const deck = []; for (let x = -40; x <= 40.1; x += 8) deck.push([x, -7.5 + sag(x)]); for (let x = 40; x >= -40.1; x -= 8) deck.push([x, 7.5 + sag(x)])
    castShadow([deck], 2)
    fillPoly(deck, COL ? mix(WOOD(), PAPER, 0.4) : PAPER)
    // end platforms
    for (const sx of [-1, 1]) { const e = rect(sx > 0 ? 40 : -50, -9, sx > 0 ? 50 : -40, 9); paint(e, WOOD(), 0.1); outline(e, 1.4, { noext: true }); ctx.save(); path(e); ctx.clip(); for (let x = e[0][0]; x < e[1][0]; x += 3.3) sg(x, -9, x, 9); flush(0.5); ctx.restore() }
    // planks: slightly skewed, with gaps between
    const n = Math.round(80 / Math.max(K(10), 3.4))
    for (let i = 0; i < n; i++) {
      const x = -40 + (80 * (i + 0.5)) / n, w2 = (80 / n) * 0.78, y0 = -7.5 + sag(x), y1 = 7.5 + sag(x), sk = jt(0.5)
      const q = [[x - w2 / 2, y0 - 0.3], [x + w2 / 2 + sk, y0 - 0.3], [x + w2 / 2 + sk, y1 + 0.3], [x - w2 / 2, y1 + 0.3]]
      paint(q, WOOD(), 0.08 + r() * 0.1, 0.55); outline(q, 0.9, { noext: true, wob: 0.1, taper: 0.2 })
      if (det >= 2) { sg(x, y0 + 2, x + jt(0.2), y0 + 2 + rr(2, 6)); flush(0.35) }
    }
    // ropes
    for (const sy of [-1, 1]) {
      const foot = [], hand = []
      for (let x = -46; x <= 46.1; x += 4) { foot.push([x, sy * 8.6 + sag(Math.max(-40, Math.min(40, x)))]); hand.push([x, sy * 13.2 + sag(Math.max(-40, Math.min(40, x))) * 1.15]) }
      pl(foot, 1.3, { taper: 0.1, wob: 0.15 }); pl(hand, 1.1, { taper: 0.1, wob: 0.15 })
      for (let x = -40; x <= 40.1; x += 8) { const s0 = sag(x); ln([x, sy * 8.6 + s0], [x, sy * 13.2 + s0 * 1.15], 0.7, { taper: 0.15, wob: 0.1 }) }
    }
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) { const q = oval(sx * 46, sy * 12.5, 3.2, 3.2, 12); castShadow([q], 3); fillPoly(q, COL ? mix(WOOD(), PAPER, 0.2) : PAPER); loop(q, 1.5); if (det >= 1) { sg(sx * 46 - 1.5, sy * 12.5 - 1, sx * 46 + 1.2, sy * 12.5 + 1.4); flush(0.45) } }
  }
  /** 4: log bridge: four trunks side by side, lashed with rope, one rope handrail on posts. */
  function bri4() {
    const ys = [-9.5, -3.2, 3.2, 9.5], rad = 3.5
    const body = rect(-46, -13, 46, 13)
    castShadow([body], 3)
    // opaque base under the logs
    fillPoly(rect(-45, -12.6, 45, 12.6), COL ? mix(WOOD(), PAPER, 0.3) : PAPER)
    ys.forEach((cy, i) => {
      const a = -45 + jt(2.5) + (i % 2) * 2, b = 45 + jt(2.5) - (i % 2) * 2
      const lg = [[a, cy - rad], [b, cy - rad], [b + 0.8, cy], [b, cy + rad], [a, cy + rad], [a - 0.8, cy]]
      paint(lg, WOOD(), 0.1 + i * 0.05, 0.6); outline(lg, 1.5, { noext: true, wob: 0.25 })
      // bark: long broken strokes
      ctx.save(); path(lg); ctx.clip()
      const k = det >= 1 ? 7 : 3
      for (let q = 0; q < k * (det >= 2 ? 2 : 1); q++) { const x = rr(a, b - 12), y = cy + rr(-rad, rad) * 0.85; sg(x, y, x + rr(6, 22), y + jt(0.25)) }
      flush(0.5)
      if (SH && det >= 1) hatchIn([[a, cy + rad * 0.2], [b, cy + rad * 0.2], [b, cy + rad], [a, cy + rad]], 0.4, K(2.2), 0.45, { keep: 0.8 })
      ctx.restore()
      // cut ends
      for (const ex of [a, b]) { const e = oval(ex, cy, 1.1, rad * 0.8, 10); fillPoly(e, PAPER); loop(e, 0.9, { flat: true }) }
    })
    // lashings
    for (const x of [-30, 0, 30]) { ln([x, -13], [x + jt(1), 13], 1.3, { taper: 0.1 }); for (const y of ys) { ctx.beginPath(); ctx.arc(x, y, 0.9, 0, TAU); ctx.fillStyle = INK; ctx.fill() } }
    // handrail
    for (let x = -42; x <= 42.1; x += 14) pile(x, -15.6, 1.6)
    ln([-42, -15.6], [42, -15.6], 1.1, { taper: 0.15, wob: 0.3 })
  }
  /** 5: clapper bridge: three huge flat slabs resting on stone piers. */
  function bri5() {
    const spans = [[-48, -17], [-15, 15], [17, 48]]
    const piers = [-48, -16, 16, 48]
    castShadow(spans.map(([a, b]) => rect(a, -10, b, 10)), 3.5)
    for (const px of piers) { const sx = Math.min(Math.max(px, -47), 47); const pr = [[sx - 3.4, -13], [sx + 3.4, -13.5], [sx + 3.6, 13], [sx - 3.2, 13.5]]; paint(pr, STONE(), 0.3); outline(pr, 1.3, { noext: true }); if (det >= 1) hatchIn(pr, 1.9, K(2.2), 0.4) }
    spans.forEach(([a, b], i) => {
      const slab2 = [[a, -9 + jt(1.2)], [(a + b) / 2, -10.5 + jt(1)], [b, -9 + jt(1.2)], [b + jt(0.6), 0 + jt(2)], [b, 9.5 + jt(1.2)], [(a + b) / 2, 10.8 + jt(1)], [a, 9.5 + jt(1.2)], [a + jt(0.6), jt(2)]]
      paint(slab2, lighter(STONE(), 0.1), 0.05 + i * 0.03, 0.6); outline(slab2, 2, { wob: 0.2, noext: true })
      if (det >= 1) {
        stippleIn(slab2, 1.2, K(0.6))
        ctx.save(); path(slab2); ctx.clip()
        hatchIn([[a, 5], [b, 5], [b, 12], [a, 12]], 0.25, K(2.4), 0.5)
        hatchIn([[b - 6, -12], [b + 1, -12], [b + 1, 12], [b - 6, 12]], 1.7, K(2.4), 0.45)
        pl([[a + rr(4, 12), -9], [a + rr(10, 18), jt(3)], [a + rr(16, 24), 8]], 0.7, { taper: 0.8, wob: 0.4 })
        ctx.restore()
        if (det >= 2 && r() < 0.8) { tuft((a + b) / 2 + jt(8), -9.6, 0.8); flush(0.5) }
      }
    })
  }
  /** 6: three-arch stone bridge with pointed cutwaters on the piers, straight parapets, and refuges above them. */
  function bri6() {
    const t = 5
    const tri = []
    for (const px of [-17, 17]) for (const sy of [-1, 1]) tri.push([[px - 6.5, sy * 16.5], [px + 6.5, sy * 16.5], [px + 5.4, sy * 21.5], [px, sy * 25.5], [px - 5.4, sy * 21.5]])
    const deck = rect(-44, -12, 44, 12)
    castShadow([deck, ...tri, rect(-50, -17, -44, 17), rect(44, -17, 50, 17)], 3.5)
    for (const t2 of tri) { paint(t2, STONE(), 0.2); outline(t2, 1.5, { noext: true, wob: 0.12 }); if (det >= 1) { hatchIn([t2[2 - 0 > 1 ? 1 : 0], t2[2], t2[3], t2[4].slice(0, 2).map((v, i) => (i === 0 ? (t2[0][0] + t2[1][0]) / 2 : v))].slice(0, 0).concat([[(t2[0][0] + t2[1][0]) / 2, t2[0][1]], t2[1], t2[2], t2[3]]), 1.9, K(2.2), 0.4); sg(t2[3][0], t2[3][1], (t2[0][0] + t2[1][0]) / 2, t2[0][1]); flush(0.45) } }
    for (const sx of [-1, 1]) { const e = rect(sx > 0 ? 42 : -50, -17, sx > 0 ? 50 : -42, 17); paint(e, STONE(), 0.2); outline(e, 1.6, { noext: true }); if (det >= 1) { hatchIn(rect(sx > 0 ? 46 : -46, -17, sx > 0 ? 50 : -42, 17), 2, K(2.3), 0.45); for (let y = -14; y < 17; y += 5.5) sg(sx > 0 ? 42 : -50, y, sx > 0 ? 50 : -42, y + jt(0.4)); flush(0.45) } }
    paint(deck, T.rock, 0)
    ctx.save(); path(deck); ctx.clip(); rowsTex(deck, S, { g: Math.max(K(8), 3.4), tw: Math.max(K(10), 4.2), irr: 0.3, irregular: true, w: 0.5 }); hatchIn(rect(14, -12, 44, 12), 1.2, Math.max(K(3.2), 2), 0.45); ctx.restore()
    outline(deck, 1.3, { noext: true, flat: true })
    for (const sy of [-1, 1]) {
      const p = rect(-44, sy < 0 ? -17 : 12, 44, sy < 0 ? -12 : 17)
      paint(p, lighter(STONE(), 0.08), 0.1); outline(p, 1.9, { noext: true, wob: 0.14 }); if (det >= 1) { blocks([-44, sy * 14.5], [44, sy * 14.5], t, Math.max(K(7), 4.2)) }
      if (det >= 1) hatchIn(rect(-44, sy * 14.5, 44, sy * 17.2).slice(0, 0).concat(rect(-44, sy < 0 ? -14.5 : 14.5, 44, sy < 0 ? -12 : 17)), 1.9, K(2.4), 0.4, { keep: 0.5 })
    }
  }
  /** 7: covered bridge: a long shingled gable over stone abutments, rafter tails along the eaves. */
  function bri7() {
    const body = rect(-46, -17, 46, 17)
    castShadow([body, rect(-50, -12, 50, 12)], 7)
    for (const sx of [-1, 1]) { const e = rect(sx > 0 ? 44 : -50, -13, sx > 0 ? 50 : -44, 13); paint(e, STONE(), 0.2); outline(e, 1.4, { noext: true }); if (det >= 1) { hatchIn(rect(sx > 0 ? 47 : -47, -13, sx > 0 ? 50 : -44, 13), 2, K(2.3), 0.45); for (let y = -10; y < 13; y += 5) sg(sx > 0 ? 44 : -50, y, sx > 0 ? 50 : -44, y + jt(0.4)); flush(0.45) } }
    KOV.shingle = mix(T.rock, '#9a7a52', 0.5)
    baseOf(body, 'shingle')
    gable(-46, -17, 46, 17, 'x', SHIN)
    outline(body, 2.2)
    if (det >= 1) {
      const g = Math.max(K(6.5), 3.6)
      for (let x = -46 + g * 0.5; x < 46; x += g * rr(0.9, 1.15)) { sg(x, -17, x, -19.2); sg(x, 17, x, 19.2) }
      flush(0.55)
    }
    eaveBand(body)
  }
  reg('bm-bridge', 'Bridge', 'fixed', [bri0, bri1, bri2, bri3, bri4, bri5, bri6, bri7])

  /* =====================================================================================================================
     PAVILION: big round and long tournament / army tents with striped canvas, scalloped valances and pennants
     ===================================================================================================================== */
  const canvasCol = () => lighter(mix(T.sand, T.land, 0.5), 0.35)
  const stripeCol = (v) => (v === 1 ? darker(T.roof, 0.05) : v === 2 ? mix(T.water, '#3a5a6a', 0.45) : v === 3 ? mix(T.sand, '#b07a20', 0.6) : mix(T.forest, '#4a3a22', 0.4))
  /** Scalloped outline of a closed polygon: a little outward bump per `sw` units of perimeter. */
  function scallop(pts, sw, bump) {
    const n = pts.length, sgn = orient(pts), out = []
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n], dx = q[0] - p[0], dy = q[1] - p[1], L = hyp(dx, dy), m = Math.max(1, Math.round(L / sw)), ux = dx / L, uy = dy / L, nx = uy * sgn, ny = -ux * sgn
      for (let k = 0; k < m; k++) for (let j = 0; j < 4; j++) {
        const f = (k + j / 4) / m, b = Math.sin((PI * j) / 4) * bump
        out.push([p[0] + dx * f + nx * b, p[1] + dy * f + ny * b])
      }
    }
    return out
  }
  /** Canvas colour for a panel: opaque base then wash. v selects the stripe colour; undefined = plain canvas. */
  function canvasFill(pts, v, sh) {
    if (!COL) { fillPoly(pts, PAPER); return }
    const c = v == null ? canvasCol() : stripeCol(v)
    fillPoly(pts, mix(c, PAPER, v == null ? 0.4 : 0.35)); wash(pts, c, v == null ? 0.5 : 0.62)
    if (v != null && det >= 1) bloom(pts, c)
  }
  /** Roof plane of striped canvas over polygon pp sloping down along d: bands of colour run from ridge to eave. */
  function stripedPlane(pp, d, band, v, plainV) {
    const sh = shadeOf(d), ang = Math.atan2(d[1], d[0])
    canvasFill(pp, plainV)
    ctx.save(); path(pp); ctx.clip()
    const F = frame(pp, d)
    for (let a = F.a0, k = 0; a < F.a1; a += band, k++) {
      if (k % 2) continue
      const q = [F.at(a, F.b0 - 1), F.at(a + band, F.b0 - 1), F.at(a + band, F.b1 + 1), F.at(a, F.b1 + 1)]
      canvasFill(q, v)
      hatchIn(q, ang, Math.max(K(2.0), 1.3) * (sh > 0.6 ? 0.8 : 1.25), 0.4)
    }
    if (sh > 0.6) hatchIn(pp, ang + 0.55, Math.max(K(4.4), 3), 0.36, { keep: 0.5 })
    ctx.restore()
  }
  /** Round pavilion cone with n gores, alternate gores striped in colour v. */
  function goreCone(cx, cy, R, n, v, o) {
    o = o || {}
    const base = oval(cx, cy, R, R, 48, 0.003)
    paint(base, canvasCol(), 0.15)
    for (let k = 0; k < n; k++) {
      const a0 = (TAU * k) / n + (o.ph || 0), a1 = (TAU * (k + 1)) / n + (o.ph || 0), pts = [[cx, cy]]
      for (let q = 0; q <= 5; q++) { const a = a0 + ((a1 - a0) * q) / 5; pts.push([cx + cos(a) * R, cy + sin(a) * R]) }
      const mid = (a0 + a1) / 2, dk = cos(mid) * LX + sin(mid) * LY, stripe = k % 2 === 0
      if (stripe) canvasFill(pts, v)
      // lines run parallel to the gore's axis (no black knot at the apex)
      if (stripe) hatchIn(pts, mid, Math.max(K(2.0), 1.3) * (dk > 0.3 ? 0.78 : 1.25), 0.4)
      else if (dk > 0.25) hatchIn(pts, mid, Math.max(K(4.4), 3), 0.36, { keep: 0.7 })
    }
    shadeBands(base, cx, cy, R, 3)
    for (let k = 0; k < n; k++) { const a = (TAU * k) / n + (o.ph || 0); ln([cx + cos(a) * 1.5, cy + sin(a) * 1.5], [cx + cos(a) * R, cy + sin(a) * R], 0.8, { taper: 0.25, wob: 0.25 }) }
    return base
  }
  /** Scalloped valance ring around a round tent. */
  function valance(cx, cy, R, w, n) {
    const pts = [], m = 160
    for (let i = 0; i < m; i++) { const a = (TAU * i) / m, k = Math.abs(sin((n * a) / 2)); pts.push([cx + cos(a) * (R - w + w * (0.45 + 0.55 * k)), cy + sin(a) * (R - w + w * (0.45 + 0.55 * k))]) }
    return pts
  }
  /** Guy ropes from points on the rim out to pegs. */
  function guys(cx, cy, R, n, reach, ph) {
    for (let k = 0; k < n; k++) {
      const a = (TAU * k) / n + (ph || 0), x0 = cx + cos(a) * R, y0 = cy + sin(a) * R, x1 = cx + cos(a) * (R + reach), y1 = cy + sin(a) * (R + reach)
      ln([x0, y0], [x1, y1], 0.7, { taper: 0.2, wob: 0.2 }); fillPoly(rect(x1 - 0.8, y1 - 0.8, x1 + 0.8, y1 + 0.8), INK)
    }
  }
  function mastTop(x, y, rad) { ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fillStyle = PAPER; ctx.fill(); loop(oval(x, y, rad, rad, 10), 1, { flat: true }); fillPoly(oval(x, y, rad * 0.4, rad * 0.4, 6), INK) }
  /** Rope pegs along an edge of a rectangle: short guys from the valance. */
  function edgeGuys(pts) { for (const [gx, gy, dy] of pts) { ln([gx, gy], [gx + jt(0.8), gy + dy * 8], 0.7, { taper: 0.2, wob: 0.2 }); fillPoly(rect(gx - 0.8, gy + dy * 8 - 0.8, gx + 0.8, gy + dy * 8 + 0.8), INK) } }

  /** 0: round pavilion, twelve gores in alternate red stripes under a scalloped valance, a pennant at the top. */
  function pav0() {
    const R = 40
    castShadow([oval(0, 0, R + 4, R + 4, 40)], 6)
    guys(0, 0, R + 3, 8, 6, 0.2)
    const sk = valance(0, 0, R + 4, 5, 28)
    paint(sk, canvasCol(), 0.3); loop(sk, 1.9)
    if (det >= 1) { const m = 28; for (let i = 0; i < m; i++) { const a = (TAU * (i + 0.5)) / m; sg(cos(a) * (R + 4 - 2.3), sin(a) * (R + 4 - 2.3), cos(a) * (R + 4 - 4.6), sin(a) * (R + 4 - 4.6)) } flush(0.4) }
    const base = goreCone(0, 0, R - 1, 12, 1)
    loop(base, 1.3)
    mastTop(0, 0, 2.2)
    pennant(0, 0, 22, 0.3, stripeCol(1))
  }
  /** 1: long tournament pavilion in olive stripes: hipped ridge tent, scalloped eaves, a pennant at each end. */
  function pav1() {
    const x0 = -46, x1 = 46, hy = 24, rx = 22
    const sil = [[x0, -hy], [x1, -hy], [x1, hy], [x0, hy]]
    castShadow([sil], 6)
    edgeGuys([[-30, -hy, -1], [-10, -hy, -1], [10, -hy, -1], [30, -hy, -1], [-30, hy, 1], [-10, hy, 1], [10, hy, 1], [30, hy, 1]])
    const sk = scallop(sil, 8, 2.4)
    paint(sk, canvasCol(), 0.3); outline(sk, 1.7, { noext: true })
    stripedPlane([[x0, -hy], [x1, -hy], [rx, 0], [-rx, 0]], N, 12, 0)
    stripedPlane([[x0, hy], [x1, hy], [rx, 0], [-rx, 0]], S, 12, 0)
    stripedPlane([[x0, -hy], [x0, hy], [-rx, 0]], WD, 12, 0)
    stripedPlane([[x1, -hy], [x1, hy], [rx, 0]], E, 12, 0)
    for (const p of [[x0, -hy], [x0, hy], [x1, -hy], [x1, hy]]) ln(p, p[0] < 0 ? [-rx, 0] : [rx, 0], 0.9, { taper: 0.3 })
    ln([-rx, 0], [rx, 0], 1.6, { taper: 0.3 })
    outline(sil, 1.5, { noext: true })
    mastTop(-rx, 0, 2); mastTop(rx, 0, 2)
    pennant(-rx, 0, 24, 0.25, stripeCol(1)); pennant(rx, 0, 24, 0.25, stripeCol(2))
  }
  /** 2: big top: a tall centre cone in red over a lower blue ring skirt, pennons round the edge. */
  function pav2() {
    const R = 44, r2 = 25
    castShadow([oval(0, 0, R, R, 40)], 7)
    guys(0, 0, R, 10, 5, 0.1)
    const sk = valance(0, 0, R, 5, 26)
    paint(sk, canvasCol(), 0.3); loop(sk, 1.9)
    const ring = oval(0, 0, R - 5, R - 5, 40)
    paint(ring, canvasCol(), 0.2)
    const n = 14
    for (let k = 0; k < n; k++) {
      const a0 = (TAU * k) / n, a1 = (TAU * (k + 1)) / n, pts = []
      for (let q = 0; q <= 4; q++) { const a = a0 + ((a1 - a0) * q) / 4; pts.push([cos(a) * (R - 5), sin(a) * (R - 5)]) }
      for (let q = 4; q >= 0; q--) { const a = a0 + ((a1 - a0) * q) / 4; pts.push([cos(a) * r2, sin(a) * r2]) }
      const mid = (a0 + a1) / 2, dk = cos(mid) * LX + sin(mid) * LY
      if (k % 2 === 0) { canvasFill(pts, 2); hatchIn(pts, mid, Math.max(K(2.0), 1.3) * (dk > 0.3 ? 0.78 : 1.25), 0.4) }
      else if (dk > 0.3) hatchIn(pts, mid, Math.max(K(4.4), 3), 0.36, { keep: 0.7 })
      ln([cos(a0) * r2, sin(a0) * r2], [cos(a0) * (R - 5), sin(a0) * (R - 5)], 0.8, { taper: 0.3 })
    }
    shadeBands(ring, 0, 0, R, 3)
    loop(ring, 1.2)
    castShadow([oval(0, 0, r2, r2, 30)], 5)
    const c2 = goreCone(0, 0, r2, 12, 1)
    loop(c2, 1.6)
    mastTop(0, 0, 2.2)
    pennant(0, 0, 20, 0.3, stripeCol(1))
    if (det >= 1) for (let i = 0; i < 7; i++) { const a = (TAU * (i + 0.5)) / 7 + 0.1; pennant(cos(a) * (R - 3), sin(a) * (R - 3), 11, a + 0.9, stripeCol(i % 2 ? 1 : 3)) }
  }
  /** 3: eight-sided pavilion with an open entrance awning on the south and a banner on the mast. */
  function pav3() {
    const R = 38, oct = []
    for (let i = 0; i < 8; i++) { const a = PI / 8 + (TAU * i) / 8; oct.push([cos(a) * R, sin(a) * R]) }
    const aw = [[-12, R - 4], [12, R - 4], [16, 50], [-16, 50]]
    castShadow([oct, aw], 6)
    canvasFill(aw, undefined)
    ctx.save(); path(aw); ctx.clip()
    for (let k = 0; k < 4; k += 2) { const xa = -16 + k * 8, q = [[xa, R - 4], [xa + 8, R - 4], [xa + 8, 50], [xa, 50]]; canvasFill(q, 3); hatchIn(q, 1.57, Math.max(K(2.0), 1.3), 0.4) }
    ctx.restore()
    outline(aw, 1.4, { noext: true })
    for (const px of [-16, 16]) { const p = oval(px, 49, 1.6, 1.6, 8); fillPoly(p, PAPER); loop(p, 1.1) }
    const sk = scallop(oct, 9, 2.4)
    paint(sk, canvasCol(), 0.3); outline(sk, 1.8, { noext: true })
    for (let i = 0; i < 8; i++) {
      const pp = [oct[i], oct[(i + 1) % 8], [0, 0]], mid = PI / 8 + (TAU * (i + 0.5)) / 8, dk = cos(mid) * LX + sin(mid) * LY
      const stripe = i % 2 === 0
      canvasFill(pp, stripe ? 1 : undefined)
      if (stripe) hatchIn(pp, mid, Math.max(K(2.0), 1.3) * (dk > 0.3 ? 0.78 : 1.25), 0.4)
      else if (dk > 0.25) hatchIn(pp, mid, Math.max(K(4.4), 3), 0.36, { keep: 0.7 })
      ln(oct[i], [0, 0], 0.9, { taper: 0.3 })
    }
    outline(oct, 1.4, { noext: true })
    mastTop(0, 0, 2.2)
    const bn = [[0, 0], [20, 3], [19, 12], [0, 9]]
    canvasFill(bn, 2); outline(bn, 1, { noext: true, flat: true })
    if (det >= 1) { hatchIn(bn, 0.15, K(2.4), 0.45); ln([2, 5], [17, 7.5], 0.6, { taper: 0.4 }) }
  }
  /** 4: marquee in ochre stripes: a long ridge tent with a deep entrance porch on the east end, and two pennants. */
  function pav4() {
    const x0 = -50, x1 = 24, hy = 22, rx0 = -28, rx1 = 6
    const porch = [[x1 - 2, -15], [50, -15], [50, 15], [x1 - 2, 15]]
    const sil = [[x0, -hy], [x1, -hy], [x1, hy], [x0, hy]]
    castShadow([sil, porch], 6)
    canvasFill(porch, undefined)
    ctx.save(); path(porch); ctx.clip()
    for (let k = 0; k < 5; k += 2) { const ya = -15 + k * 6, q = [[x1 - 2, ya], [50, ya], [50, ya + 6], [x1 - 2, ya + 6]]; canvasFill(q, 3); hatchIn(q, 0, Math.max(K(2.0), 1.3), 0.4) }
    ctx.restore()
    outline(porch, 1.5, { noext: true })
    for (const py of [-15, 15]) { const p = oval(50, py, 1.7, 1.7, 8); fillPoly(p, PAPER); loop(p, 1.1) }
    if (det >= 1) { for (let y = -13; y < 14; y += 4.5) ln([50, y], [51.8, y + 2.5], 0.7, { taper: 0.4, wob: 0.1 }) }
    const sk = scallop(sil, 8, 2.4)
    paint(sk, canvasCol(), 0.3); outline(sk, 1.7, { noext: true })
    stripedPlane([[x0, -hy], [x1, -hy], [rx1, 0], [rx0, 0]], N, 11, 3)
    stripedPlane([[x0, hy], [x1, hy], [rx1, 0], [rx0, 0]], S, 11, 3)
    stripedPlane([[x0, -hy], [x0, hy], [rx0, 0]], WD, 11, 3)
    stripedPlane([[x1, -hy], [x1, hy], [rx1, 0]], E, 11, 3)
    for (const p of [[x0, -hy], [x0, hy]]) ln(p, [rx0, 0], 0.9, { taper: 0.3 }); for (const p of [[x1, -hy], [x1, hy]]) ln(p, [rx1, 0], 0.9, { taper: 0.3 })
    ln([rx0, 0], [rx1, 0], 1.6, { taper: 0.3 }); outline(sil, 1.5, { noext: true })
    mastTop(rx0, 0, 2); mastTop(rx1, 0, 2)
    pennant(rx0, 0, 22, 0.3, stripeCol(1)); pennant(rx1, 0, 22, 0.3, stripeCol(1))
  }
  /** 5: army command pavilion in blue: a square hip with a tall centre mast and a big banner, pennons on the corners, one wall rolled up. */
  function pav5() {
    const h = 34
    const sq = rect(-h - 8, -h, h + 8, h)
    const flap = [[-h - 8, h], [h + 8, h], [h + 14, h + 10], [-h - 14, h + 10]]
    castShadow([sq, flap], 6)
    canvasFill(flap, undefined)
    ctx.save(); path(flap); ctx.clip(); for (let k = 0; k < 9; k += 2) { const xa = -h - 14 + k * 6.4, q = [[xa, h], [xa + 6.4, h], [xa + 6.4, h + 10], [xa, h + 10]]; canvasFill(q, 2); hatchIn(q, 1.57, Math.max(K(2.0), 1.3), 0.4) } ctx.restore()
    outline(flap, 1.5, { noext: true })
    for (const px of [-h - 14, h + 14]) { const p = oval(px, h + 10, 1.7, 1.7, 8); fillPoly(p, PAPER); loop(p, 1.1) }
    const sk = scallop(sq, 9, 2.4)
    paint(sk, canvasCol(), 0.3); outline(sk, 1.7, { noext: true })
    const c = [0, 0], pts = [[-h - 8, -h], [h + 8, -h], [h + 8, h], [-h - 8, h]]
    pts.forEach((p, i) => {
      const q = pts[(i + 1) % 4], pp = [p, q, c], mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], ml = hyp(mid[0], mid[1])
      stripedPlane(pp, [mid[0] / ml, mid[1] / ml], 12, 2)
      ln(p, c, 0.9, { taper: 0.3 })
    })
    outline(sq, 1.4, { noext: true })
    mastTop(0, 0, 2.4)
    const bn = [[0, 0], [24, 2], [22, 15], [0, 12]]
    canvasFill(bn, 1); outline(bn, 1.1, { noext: true, flat: true }); if (det >= 1) { hatchIn([[0, 0], [24, 2], [22, 8], [0, 6]], 0.1, K(2.4), 0.5); ln([3, 12], [19, 14], 0.6, { taper: 0.4 }) }
    if (det >= 1) for (const [px, py] of [[-h - 8, -h], [h + 8, -h]]) pennant(px, py, 12, 0.3, stripeCol(1))
  }
  /** 6: round olive pavilion with the door flap tied back: a dark opening, two folded flaps, a mast pennant. */
  function pav6() {
    const R = 42
    castShadow([oval(0, 0, R + 4, R + 4, 40)], 6)
    guys(0, 0, R + 5, 9, 5, 0.55)
    const sk = valance(0, 0, R + 4, 5, 30)
    paint(sk, canvasCol(), 0.3); loop(sk, 1.9)
    const base = goreCone(0, 0, R - 1, 16, 0)
    loop(base, 1.3)
    const a0 = PI / 2 - 0.17, a1 = PI / 2 + 0.17
    const door = [[0, R * 0.62], [cos(a0) * (R + 3), sin(a0) * (R + 3)], [cos(a1) * (R + 3), sin(a1) * (R + 3)]]
    fillPoly(door, COL ? mix(INK, canvasCol(), 0.15) : INK)
    for (const s2 of [-1, 1]) {
      const fl = [[s2 * 5, R * 0.66], [s2 * 13, R + 4], [s2 * 9, R + 6.5], [s2 * 3.5, R * 0.72]]
      canvasFill(fl, undefined); outline(fl, 1.2, { noext: true }); if (det >= 1) hatchIn(fl, 1.57, K(2.5), 0.45)
    }
    mastTop(0, 0, 2.2)
    pennant(0, 0, 22, 0.3, stripeCol(0))
  }
  /** 7: long double-masted tent: two raised peaks, diamond-patterned canvas in red and blue, valance all round. */
  function pav7() {
    const x0 = -48, x1 = 48, hy = 22, p0 = -22, p1 = 22
    const sil = [[x0, -hy], [x1, -hy], [x1, hy], [x0, hy]]
    castShadow([sil], 6)
    edgeGuys([[-38, -hy, -1], [-14, -hy, -1], [14, -hy, -1], [38, -hy, -1], [-38, hy, 1], [-14, hy, 1], [14, hy, 1], [38, hy, 1]])
    const sk = scallop(sil, 8, 2.4)
    paint(sk, canvasCol(), 0.3); outline(sk, 1.7, { noext: true })
    canvasFill(sil, undefined)
    ctx.save(); path(sil); ctx.clip()
    // lozenges: alternate ones painted and hatched
    const dw = hy * 0.8, dh = hy
    for (let j = -1; j <= 1; j++) for (let i = -8; i <= 8; i++) {
      const cx = i * dw * 1.0 + (j % 2 ? dw / 2 : 0), cy = j * dh
      if ((i + j + 20) % 2) continue
      const lz = [[cx, cy - dh / 2], [cx + dw / 2, cy], [cx, cy + dh / 2], [cx - dw / 2, cy]]
      canvasFill(lz, (i + j + 20) % 4 === 0 ? 2 : 1); hatchIn(lz, 1.3, Math.max(K(2.0), 1.3), 0.4)
    }
    for (let k = -14; k < 16; k++) { sg(k * dw / 2 * 2 - 0, -hy, k * dw / 2 * 2 + dh, hy); sg(k * dw / 2 * 2, hy, k * dw / 2 * 2 + dh, -hy) }
    flush(0.55)
    hatchIn([[-48, 0], [48, 0], [48, 22], [-48, 22]], 0.7, Math.max(K(3.4), 2.6), 0.38, { keep: 0.55 })
    ctx.restore()
    for (const px of [p0, p1]) {
      const pk = [[px - 9, -9], [px + 9, -9], [px + 9, 9], [px - 9, 9]], c = [px, 0], dirs4 = [N, E, S, WD]
      castShadow([pk], 4)
      pk.forEach((p, i) => { const q = pk[(i + 1) % 4], pp = [p, q, c]; canvasFill(pp, i % 2 ? 1 : undefined); if (i % 2 || shadeOf(dirs4[i]) > 0.6) hatchIn(pp, 0.6 + i, Math.max(K(2.0), 1.3), 0.4); ln(p, c, 0.8, { taper: 0.3 }) })
      outline(pk, 1.3, { noext: true })
      mastTop(px, 0, 2)
      pennant(px, 0, 22, 0.28, stripeCol(px < 0 ? 1 : 2))
    }
    outline(sil, 1.5, { noext: true })
    ln([p0 + 9, 0], [p1 - 9, 0], 1.3, { taper: 0.3 })
  }
  reg('bm-tent-large', 'Pavilion', 'fixed', [pav0, pav1, pav2, pav3, pav4, pav5, pav6, pav7])
})(window.Atlas)
