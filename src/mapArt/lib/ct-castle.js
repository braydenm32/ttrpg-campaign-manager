/* Town-plan castles, cathedrals, gatehouses and wall towers, seen from directly above (view 'top'), for town and city maps.
   Same conventions as bm-buildings: the LONG side of the footprint is 100 design units (scaled by s/100), centred on (x, y);
   light from the upper left, so roof planes sloping down-right are shaded and (with st.shadows) cast shadows fall down-right;
   colour mode = translucent washes over the same linework, ink mode = paper and ink only; opaque fills first so a piece hides
   whatever lies under it. Every piece is 'fixed' with 8 hand-designed versions; r() only adds hand-jitter.
   These pieces are drawn small on a town plan (about 1.4 px per foot), so detail follows an effective size (s times a per-piece
   factor): clean shapes and one hatch tone when small; stone courses, tiles and crenels only as the piece grows.
   Town walls: a wall runs along the x axis through y = 0; outside the town is -y, inside is +y. The gatehouse covers the wall
   ends at x = ±[38, 50] (the renderer cuts the wall across x in [-44, 44], |y| <= 12); the wall tower is wider than the wall. */
;(function (A) {
  'use strict'
  const PI = Math.PI, TAU = PI * 2, sin = Math.sin, cos = Math.cos, hyp = Math.hypot
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
  let LX = 0.62, LY = 0.78 // direction the shade and the cast shadows run (down and to the right); a turned piece is handed its own (A.light)
  let ctx, r, st, INK, PAPER, COL, T, SH, u, det, LW, ROW, TW, THA
  const rr = (a, b) => a + r() * (b - a)
  const jt = (a) => (r() - 0.5) * 2 * a
  const K = (px) => px / u // screen pixels to design units
  const W = (b) => (b * LW) / u // pen weight (about b pixels at line weight 1) in design units

  function open(c, x, y, s, rg, style, dsc) {
    ctx = c; r = rg; st = style; INK = st.ink; PAPER = st.paper; COL = st.mode === 'colour'; T = st.tint; SH = !!st.shadows
    u = s / 100; LX = A.light ? A.light[0] : 0.62; LY = A.light ? A.light[1] : 0.78
    const se = s * dsc // how big the piece's typical building reads on screen
    det = se >= 210 ? 3 : se >= 120 ? 2 : se >= 52 ? 1 : 0
    LW = st.line * clamp(0.55 + se / 330, se < 40 ? 0.66 : 0.8, 1.6)
    const grow = Math.max(0, se - 60)
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
  const YARD = () => mix(T.sand, T.land, 0.5)
  const GRASS = () => mix(T.grass, T.sand, 0.3)
  const ROAD = () => mix(T.sand, '#b89a66', 0.25)
  const kindCol = (k) => k === 'tile' ? T.roof : k === 'thatch' ? mix(T.sand, '#7b6330', 0.42) : k === 'slate' ? mix(T.rock, '#5a5f68', 0.34)
    : k === 'plank' ? WOOD() : k === 'shingle' ? mix(T.rock, '#6d4e34', 0.5) : k === 'lead' ? mix(T.rock, '#8a948e', 0.55) : k === 'stone' ? T.rock : T.sand

  /* ---------- paths and paint (a "poly" is a point list, or a list of rings filled even-odd) ---------- */
  const isRings = (pts) => pts.length > 0 && Array.isArray(pts[0][0])
  function sub(ring) { for (let i = 0; i < ring.length; i++) { if (i) ctx.lineTo(ring[i][0], ring[i][1]); else ctx.moveTo(ring[i][0], ring[i][1]) } ctx.closePath() }
  function path(pts) { ctx.beginPath(); if (isRings(pts)) for (const g of pts) sub(g); else sub(pts) }
  function fillPoly(pts, col) { path(pts); ctx.fillStyle = col; ctx.fill('evenodd') }
  const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
  const orient = (pts) => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1] } return a >= 0 ? 1 : -1 }
  function bbox(pts) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
    const one = (g) => { for (const p of g) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1] } }
    if (isRings(pts)) for (const g of pts) one(g); else one(pts)
    return [x0, y0, x1, y1]
  }
  const shift = (pts, dx, dy) => pts.map((p) => [p[0] + dx, p[1] + dy])
  /** Translucent paint laid twice with a slight offset and a darker pooled edge (colour mode). */
  function wash(pts, col, a) {
    a = a == null ? 0.55 : a
    ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = col
    ctx.globalAlpha = a * 0.62; path(pts); ctx.fill('evenodd')
    ctx.translate(jt(0.5 / u), jt(0.5 / u)); path(pts); ctx.fill('evenodd')
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
  function bloom(pts, c) {
    const [x0, y0, x1, y1] = bbox(pts), area = (x1 - x0) * (y1 - y0)
    if (area * u * u < 900) return
    const n = Math.min(5, 1 + Math.floor(area / 500))
    ctx.save(); path(pts); ctx.clip('evenodd')
    for (let i = 0; i < n; i++) {
      const rad = Math.min(x1 - x0, y1 - y0) * rr(0.25, 0.6) + 2, cx = rr(x0, x1), cy = rr(y0, y1), dark = r() < 0.6
      ctx.globalAlpha = rr(0.05, 0.11); ctx.fillStyle = dark ? darker(c, 0.35) : lighter(c, 0.45)
      path(oval(cx, cy, rad * rr(0.8, 1.5), rad * rr(0.6, 1), 10, 0.12)); ctx.fill()
    }
    ctx.restore()
  }
  /** Soft bands of shade on the lower right of a round or odd shape (colour mode). */
  function shadeBands(pts, cx, cy, rad, n) {
    if (!COL) return
    ctx.save(); path(pts); ctx.clip('evenodd')
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
      ctx.beginPath(); sub(pts)
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
    ctx.beginPath(); sub(outer); sub(inner)
    ctx.fillStyle = INK; ctx.fill('evenodd')
  }
  /** Open polyline drawn as a thin line that lifts off the paper now and then. */
  function broken(pts, w, closed) {
    const n = pts.length, m = closed ? n : n - 1
    for (let i = 0; i < m; i++) {
      const a = pts[i], b = pts[(i + 1) % n], d = hyp(b[0] - a[0], b[1] - a[1]) || 1, vx = (b[0] - a[0]) / d, vy = (b[1] - a[1]) / d
      let s0 = 0
      while (s0 < d) { const e = Math.min(s0 + rr(K(8), K(30)), d); sg(a[0] + vx * s0, a[1] + vy * s0, a[0] + vx * e, a[1] + vy * e); s0 = e + rr(K(1.5), K(4)) }
    }
    flush(w || 0.5)
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
  /** Regular polygon with n sides, a flat side facing -y when flat is true. */
  function ngon(cx, cy, R, n, flat) {
    const out = [], ph = flat ? -PI / 2 + PI / n : -PI / 2
    for (let i = 0; i < n; i++) { const a = ph + (TAU * i) / n; out.push([cx + cos(a) * R, cy + sin(a) * R]) }
    return out
  }
  /** Mitred offset of a closed polygon: d > 0 grows it outward. */
  function offsetPoly(pts, d) {
    const n = pts.length, sgn = orient(pts), out = []
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i + n - 1) % n], p1 = pts[i], p2 = pts[(i + 1) % n]
      const l1 = hyp(p1[0] - p0[0], p1[1] - p0[1]) || 1, l2 = hyp(p2[0] - p1[0], p2[1] - p1[1]) || 1
      const n1x = ((p1[1] - p0[1]) / l1) * sgn, n1y = (-(p1[0] - p0[0]) / l1) * sgn, n2x = ((p2[1] - p1[1]) / l2) * sgn, n2y = (-(p2[0] - p1[0]) / l2) * sgn
      const k = d / Math.max(0.35, 1 + n1x * n2x + n1y * n2y)
      out.push([p1[0] + (n1x + n2x) * k, p1[1] + (n1y + n2y) * k])
    }
    return out
  }
  /** A band of half-width hw along an open polyline, as a closed polygon. */
  function ribbon(pts, hw) {
    const n = pts.length, L = [], R = []
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], d = hyp(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / d, ny = (b[0] - a[0]) / d
      L.push([pts[i][0] + nx * hw, pts[i][1] + ny * hw]); R.push([pts[i][0] - nx * hw, pts[i][1] - ny * hw])
    }
    return L.concat(R.reverse())
  }
  /** Hatching inside a polygon: lines at `ang`, `gap` apart, broken here and there like pen work. */
  function hatchIn(pts, ang, gap, w, o) {
    o = o || {}
    const [x0, y0, x1, y1] = bbox(pts)
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, L = hyp(x1 - x0, y1 - y0), dx = cos(ang), dy = sin(ang), nx = -dy, ny = dx
    ctx.save(); path(pts); ctx.clip('evenodd')
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
    ctx.save(); path(pts); ctx.clip('evenodd'); ctx.beginPath()
    const rad = Math.max(K(0.55), size || 0.5)
    for (let i = 0; i < n; i++) { const x = rr(x0, x1), y = rr(y0, y1); ctx.moveTo(x + rad, y); ctx.arc(x, y, rad * rr(0.6, 1.3), 0, TAU) }
    ctx.fillStyle = col || INK; ctx.fill(); ctx.restore()
  }
  function dots(n, x0, y0, x1, y1, size) {
    ctx.beginPath(); const rad = Math.max(K(0.5), size || 0.5)
    for (let i = 0; i < n; i++) { const x = rr(x0, x1), y = rr(y0, y1); ctx.moveTo(x + rad, y); ctx.arc(x, y, rad * rr(0.6, 1.3), 0, TAU) }
    ctx.fillStyle = INK; ctx.fill()
  }
  const tuft = (x, y, s) => { s = s || 1; sg(x - 0.7 * s, y, x - 1.5 * s, y - 2.1 * s); sg(x, y, x + 0.1 * s, y - 2.7 * s); sg(x + 0.7 * s, y, x + 1.6 * s, y - 2 * s) }
  /** Ink-mode volume for a flat-topped shape: a few hatch lines on its down-right side (colour mode uses shadeBands). */
  function shadeSide(pts, k) {
    if (COL) return
    const [x0, y0, x1, y1] = bbox(pts), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rad = Math.max(x1 - x0, y1 - y0) / 2
    k = k == null ? 0.3 : k
    const ox = cx + LX * rad * k, oy = cy + LY * rad * k, px = -LY, py = LX, big = rad * 1.7
    const half = [[ox + px * big, oy + py * big], [ox - px * big, oy - py * big], [ox - px * big + LX * big, oy - py * big + LY * big], [ox + px * big + LX * big, oy + py * big + LY * big]]
    ctx.save(); path(pts); ctx.clip('evenodd'); hatchIn(half, 2.2, K(2.4), 0.45); ctx.restore()
  }

  /* ---------- cast shadow ---------- */
  /** Pen hatching across a box, lines running across the light (used inside a shadow clip). */
  function shadowHatch(x0, y0, x1, y1) {
    const nx = LX, ny = LY, vx = -ny, vy = nx
    let tmin = 1e9, tmax = -1e9, vmin = 1e9, vmax = -1e9
    for (const [px, py] of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) { const t = px * nx + py * ny, v = px * vx + py * vy; if (t < tmin) tmin = t; if (t > tmax) tmax = t; if (v < vmin) vmin = v; if (v > vmax) vmax = v }
    const g = K(2.7), seg = K(40)
    for (let t = tmin; t < tmax; t += g * rr(0.8, 1.25)) {
      let v = vmin - rr(0, K(3))
      while (v < vmax) {
        const e = Math.min(v + rr(seg * 0.3, seg), vmax)
        sg(t * nx + v * vx, t * ny + v * vy, (t + jt(K(0.6))) * nx + e * vx, (t + jt(K(0.6))) * ny + e * vy); v = e + rr(K(0.5), K(1.6))
      }
    }
    flush(0.5)
  }
  /** Shadow of one or more footprints thrown down-right by `len` units: hatching in ink, a translucent wash in colour. */
  function castShadow(polys, len) {
    if (!SH || len <= 0) return
    const dx = len * LX, dy = len * LY, n = Math.max(2, Math.min(7, Math.ceil((len * u) / 6)))
    ctx.save(); ctx.beginPath()
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
    for (const pl0 of polys) {
      const P = orient(pl0) > 0 ? pl0 : pl0.slice().reverse()
      for (let k = 0; k <= n; k++) {
        const t = k / n
        for (let i = 0; i < P.length; i++) {
          const x = P[i][0] + dx * t, y = P[i][1] + dy * t
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
          if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y)
        }
        ctx.closePath()
      }
    }
    if (COL) { ctx.fillStyle = 'rgba(40,30,15,.25)'; ctx.fill() } else { ctx.clip(); shadowHatch(x0, y0, x1, y1) }
    ctx.restore()
  }
  /** Shadow thrown by the walls that enclose a floor (courtyard, deck): the strip inside the upper-left edges of `inner`. */
  function innerShadow(inner, len) {
    if (!SH || len <= 0) return
    ctx.save(); path(inner); ctx.clip()
    ctx.beginPath(); sub(inner); sub(shift(inner, len * LX, len * LY)); ctx.clip('evenodd')
    const [x0, y0, x1, y1] = bbox(inner)
    if (COL) { ctx.fillStyle = 'rgba(40,30,15,.25)'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0) } else shadowHatch(x0, y0, x1, y1)
    ctx.restore()
  }

  /* ---------- roof planes ---------- */
  const shadeOf = (d) => clamp(0.5 + 0.55 * (d[0] * LX + d[1] * LY), 0, 1)
  function frame(pts, d) {
    const e = [-d[1], d[0]]
    let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9
    for (const p of pts) { const a = p[0] * e[0] + p[1] * e[1], b = p[0] * d[0] + p[1] * d[1]; if (a < a0) a0 = a; if (a > a1) a1 = a; if (b < b0) b0 = b; if (b > b1) b1 = b }
    return { a0, a1, b0, b1, at: (a, b) => [a * e[0] + b * d[0], a * e[1] + b * d[1]] }
  }
  /** Courses of shingles / slates: rows parallel to the eave, with staggered joints. */
  function rowsTex(pts, d, o) {
    const F = frame(pts, d), at = F.at, sc = clamp((F.b1 - F.b0) / 30, 1, 1.8), g = (o.g || ROW) * sc, tw = (o.tw || TW) * Math.sqrt(sc), irr = o.irr == null ? 0.16 : o.irr
    ctx.save(); path(pts); ctx.clip('evenodd')
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
        }
      }
    }
    flush(o.w || 0.62)
    ctx.restore()
  }
  /** Clay tiles: each row a chain of scallops, with the joints running up between them. */
  function tileTex(pts, d, o) {
    const F = frame(pts, d), at = F.at, sc = clamp((F.b1 - F.b0) / 30, 1, 1.7), g = (o.g || ROW * 1.15) * sc, tw = (o.tw || TW * 0.85) * Math.sqrt(sc)
    ctx.save(); path(pts); ctx.clip('evenodd'); ctx.beginPath()
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
  /** Thatch: many short overlapping strokes running down the slope, denser on the shaded side, with bundle lines across. */
  function thatchTex(pts, d, sh) {
    const F = frame(pts, d), at = F.at, dense = 0.55 + sh * 0.95, ga = THA / dense
    ctx.save(); path(pts); ctx.clip('evenodd')
    for (let a = F.a0 - ga; a < F.a1 + ga; a += ga * rr(0.65, 1.45)) {
      let b = F.b0 - rr(0, 6)
      while (b < F.b1) { const L = rr(5, 13) * K(1) * 0.5 + 1, p = at(a, b), q = at(a + jt(0.7), b + L); sg(p[0], p[1], q[0], q[1]); b += L * rr(0.5, 0.95) + (r() < 0.14 ? rr(0.5, 2.5) : 0) }
    }
    flush(0.5)
    ctx.restore()
  }
  /** Slanted hatching on the shaded side of a roof plane. */
  function slopeHatch(pts, d, sh) {
    if (sh < 0.58) return
    const F = frame(pts, d), at = F.at, hg = ROW * (sh > 0.8 ? 1.25 : 2.3), span = F.b1 - F.b0
    ctx.save(); path(pts); ctx.clip('evenodd')
    for (let a = F.a0 - span * 0.4; a < F.a1; a += hg * rr(0.8, 1.25)) {
      const L = span * rr(0.28, 0.85) * (sh > 0.8 ? 1 : 0.7), p = at(a, F.b1 + 1), q = at(a + L * 0.42 + jt(0.3), F.b1 - L)
      sg(p[0], p[1], q[0], q[1])
    }
    flush(0.45)
    ctx.restore()
  }
  /** One roof plane: opaque paint, texture by kind (when big enough to carry it), shade hatching. d = unit vector down the slope. */
  function plane(pts, d, o) {
    o = o || {}
    const kind = o.kind || 'slate', sh = o.shade != null ? o.shade : shadeOf(d)
    paint(pts, o.col || kindCol(kind), sh)
    const F = frame(pts, d), span = Math.min(F.a1 - F.a0, F.b1 - F.b0) * u
    if (det >= 1 && span >= 9 && kind !== 'lead') {
      if (kind === 'tile') tileTex(pts, d, {})
      else if (kind === 'thatch') thatchTex(pts, d, sh)
      else rowsTex(pts, d, kind === 'slate' ? { g: ROW * 1.25, tw: TW * 1.5, irregular: true, irr: 0.25, full: true } : { irregular: true })
      if (kind !== 'thatch') slopeHatch(pts, d, sh)
    } else if (sh > 0.58 && span >= 2.5) hatchIn(pts, Math.atan2(-d[1] + 0.42 * d[0], -d[0] - 0.42 * d[1]), K(2.3), 0.45)
  }
  const N = [0, -1], S = [0, 1], WD = [-1, 0], E = [1, 0]
  function crease(a, b, w, o) { ln(a, b, w || 1, o || { taper: 0.4 }) }
  function ridge(a, b) { if (hyp(b[0] - a[0], b[1] - a[1]) >= 1) ln(a, b, 1.4, { taper: 0.35 }) }
  /** Gable (or hipped, with hip0 / hip1) roof over a rectangle; ridge runs along ax ('x' or 'y'). */
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
    if (h0) { crease(M([L0, D0]), M(R0)); crease(M([L0, D1]), M(R0)) }
    if (h1) { crease(M([L1, D0]), M(R1)); crease(M([L1, D1]), M(R1)) }
    ridge(M(R0), M(R1))
    return { a: M(R0), b: M(R1) }
  }
  /** Pyramid (hipped) roof over a rectangle. */
  function pyramid(x0, y0, x1, y1, o) {
    const c = [(x0 + x1) / 2, (y0 + y1) / 2]
    plane([[x0, y0], [x1, y0], c], N, o); plane([[x0, y1], [x1, y1], c], S, o); plane([[x0, y0], [x0, y1], c], WD, o); plane([[x1, y0], [x1, y1], c], E, o)
    for (const p of [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]) crease(p, c, 1)
    return c
  }
  /** Conical roof (or a slice of one), apex (cx, cy), radius rad, from angle a0 to a1. o: kind, sides (0 = round), seams, col. */
  function fan(cx, cy, rad, a0, a1, o) {
    o = o || {}
    const kind = o.kind || 'slate', full = a1 - a0 >= TAU - 0.01, sides = o.sides || 0, px = rad * u
    const n = sides ? Math.max(1, Math.round(((a1 - a0) / TAU) * sides)) : clamp(Math.round(px * 0.8), 10, 80)
    const rim = []
    for (let k = 0; k <= n; k++) { const a = a0 + ((a1 - a0) * k) / n; rim.push([cx + cos(a) * rad * (sides ? 1 : 1 + jt(0.004)), cy + sin(a) * rad * (sides ? 1 : 1 + jt(0.004))]) }
    const pts = full ? rim.slice(0, -1) : [[cx, cy], ...rim]
    const mid = (a0 + a1) / 2, sh0 = full ? 0.5 : shadeOf([cos(mid), sin(mid)])
    paint(pts, o.col || kindCol(kind), full ? 0.35 : sh0 * 0.7)
    shadeBands(pts, cx, cy, rad, 3)
    ctx.save(); path(pts); ctx.clip()
    const fine = det >= 1 && px >= 9
    if (fine && kind === 'thatch') {
      for (let ρ = rad; ρ > 5; ) {
        const step = rr(8, 12), dθ = Math.min(0.3, Math.max(THA, 1) / ρ), from = Math.max(2, ρ - step - rr(1.5, 4))
        for (let a = a0; a < a1; a += dθ * rr(0.7, 1.4)) { const ang = a + jt(0.003); sg(cx + cos(ang) * ρ, cy + sin(ang) * ρ, cx + cos(ang + jt(0.012)) * from, cy + sin(ang + jt(0.012)) * from) }
        ρ -= step
      }
      flush(0.5)
    } else if (fine && kind !== 'lead') {
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
    if (px >= 4 && kind !== 'thatch') { // radial hatching on the shaded side
      const base = fine ? ROW * 1.9 : K(2.6), nHat = Math.round(((a1 - a0) * rad) / base)
      for (let k = 0; k < nHat; k++) {
        const ang = a0 + ((a1 - a0) * (k + r() * 0.6)) / nHat, dk = cos(ang) * LX + sin(ang) * LY
        if (dk < 0.15 || r() > dk * 1.15) continue
        const f0 = rr(0.05, 0.4), f1 = rr(0.7, 0.99)
        sg(cx + cos(ang) * rad * f1, cy + sin(ang) * rad * f1, cx + cos(ang + 0.01) * rad * f0, cy + sin(ang + 0.01) * rad * f0)
      }
      flush(0.45)
    } else if (px >= 4) {
      const nHat = Math.round(((a1 - a0) * rad) / (THA * 2.2))
      for (let k = 0; k < nHat; k++) {
        const ang = a0 + ((a1 - a0) * (k + r() * 0.6)) / nHat, dk = cos(ang) * LX + sin(ang) * LY
        if (dk < 0.2) continue
        const f1 = rr(0.55, 0.99), f0 = f1 - rr(0.08, 0.3)
        sg(cx + cos(ang) * rad * f1, cy + sin(ang) * rad * f1, cx + cos(ang + 0.008) * rad * f0, cy + sin(ang + 0.008) * rad * f0)
      }
      flush(0.5)
    }
    if (o.seams && px >= 6) {
      const ns = Math.max(3, Math.round(((a1 - a0) / TAU) * o.seams))
      for (let k = full ? 0 : 1; k < ns; k++) { const ang = a0 + ((a1 - a0) * k) / ns; sg(cx, cy, cx + cos(ang) * rad, cy + sin(ang) * rad) }
      flush(0.7)
    }
    ctx.restore()
    return pts
  }

  /* ---------- castle parts ---------- */
  const baseOf = (sil, kind) => fillPoly(sil, COL ? mix(kindCol(kind || 'slate'), PAPER, 0.4) : PAPER)
  /** Flat paved floor (wall-walk, tower top, courtyard paving): light stone with flag joints at larger sizes. */
  function deck(pts, col) {
    paint(pts, col || lighter(STONE(), 0.18), 0)
    if (det >= 2) { const g = Math.max(K(6), 1.2); rowsTex(pts, S, { g, tw: g * 1.3, irr: 0.25, irregular: true, w: 0.42 }) }
  }
  /** Batched merlon blocks: a slightly darker stone fill and a thin outline, so a crenellated edge reads as a notched line. */
  function drawMerlons(quads) {
    if (!quads.length) return
    ctx.beginPath(); for (const q of quads) sub(q)
    ctx.fillStyle = COL ? darker(STONE(), 0.25) : PAPER; ctx.fill()
    ctx.lineWidth = W(0.7); ctx.strokeStyle = INK; ctx.stroke()
  }
  const merlonPitch = () => K(7.2)
  /** Crenellations along the edges of a polygon: merlons standing on the outline, pointing inward. */
  function merlons(pts, o) {
    o = o || {}
    const n = pts.length, sgn = orient(pts), pitch = o.pitch || merlonPitch(), mw = pitch * 0.5, d = clamp(pitch * 0.5, K(1.2), o.maxDepth || pitch), quads = []
    for (let i = 0; i < n; i++) {
      if (o.skip && o.skip(i)) continue
      const p = pts[i], q = pts[(i + 1) % n], dx = q[0] - p[0], dy = q[1] - p[1], L = hyp(dx, dy)
      if (L < mw * 1.6) continue
      const ux = dx / L, uy = dy / L, nx = uy * sgn, ny = -ux * sgn
      const cnt = Math.floor((L - mw) / pitch) + 1, off = (L - ((cnt - 1) * pitch + mw)) / 2
      for (let k = 0; k < cnt; k++) {
        const a = off + k * pitch, b = a + mw
        quads.push([[p[0] + ux * a, p[1] + uy * a], [p[0] + ux * b, p[1] + uy * b], [p[0] + ux * b - nx * d, p[1] + uy * b - ny * d], [p[0] + ux * a - nx * d, p[1] + uy * a - ny * d]])
      }
    }
    drawMerlons(quads)
  }
  /** Crenellations round a circle of radius R. */
  function merlonRing(cx, cy, R, o) {
    o = o || {}
    const pitch = o.pitch || merlonPitch(), n = Math.max(6, Math.round((TAU * R) / pitch)), step = TAU / n, d = clamp((step * R) * 0.5, K(1.2), R * 0.4), ph = o.phase || 0, quads = []
    for (let k = 0; k < n; k++) {
      const a0 = ph + k * step, a1 = a0 + step * 0.5, Ri = R - d
      quads.push([[cx + cos(a0) * R, cy + sin(a0) * R], [cx + cos(a1) * R, cy + sin(a1) * R], [cx + cos(a1) * Ri, cy + sin(a1) * Ri], [cx + cos(a0) * Ri, cy + sin(a0) * Ri]])
    }
    drawMerlons(quads)
  }
  /** Flat-topped block (square tower, keep, gate tower) with a crenellated parapet round a paved deck. Returns the deck polygon. */
  function crenBlock(pts, o) {
    o = o || {}
    const b = bbox(pts), size = Math.min(b[2] - b[0], b[3] - b[1]), pd = o.pd || clamp(size * 0.18, K(1.6), K(9)), big = size * u > 12 && det >= 1
    castShadow([pts], o.h == null ? size * 0.4 : o.h)
    paint(pts, o.col || STONE(), 0.25)
    const inner = offsetPoly(pts, -pd)
    if (big) { deck(inner, o.deckCol); innerShadow(inner, pd * 0.7); outline(inner, 0.8, { flat: true, noext: true, wob: 0.1 }) }
    else shadeSide(pts)
    outline(pts, o.w || 1.7, { noext: true, wob: 0.12 })
    if (big && o.cren !== false) merlons(pts, { maxDepth: pd * 0.85 })
    return inner
  }
  /** Round tower of radius R. o.roof: 'cren' (default) or 'cone'; o.kind = roof kind; o.h = shadow length. */
  function roundTower(cx, cy, R, o) {
    o = o || {}
    const px = R * u, n = clamp(Math.round(px * 0.9), 12, 56)
    const base = oval(cx, cy, R, R, n, 0.004)
    castShadow([base], o.h == null ? R * 0.8 : o.h)
    paint(base, o.col || STONE(), 0.25)
    if (o.roof === 'cone') {
      shadeBands(base, cx, cy, R, 2)
      loop(base, 1.5)
      const cone = fan(cx, cy, R * (px > 12 ? 0.84 : 0.78), 0, TAU, { kind: o.kind || 'slate', seams: o.seams || clamp(Math.round(px / 2.2), 6, 16) })
      loop(cone, 1.1, { flat: true })
      if (px > 5) fillPoly(oval(cx, cy, Math.max(0.5, K(1.1)), Math.max(0.5, K(1.1)), 8), INK)
    } else {
      const pd = clamp(R * 0.24, K(1.6), K(9)), big = det >= 1 && px > 7
      if (big) {
        const fl = oval(cx, cy, R - pd, R - pd, n, 0.003)
        deck(fl, o.deckCol); innerShadow(fl, pd * 0.7); loop(fl, 0.8, { flat: true })
      } else { shadeBands(base, cx, cy, R, 3); shadeSide(base) }
      loop(base, 1.6)
      if (big && o.cren !== false) merlonRing(cx, cy, R, { phase: o.phase })
    }
    return base
  }
  /** The shade and wall-walk marks on a wall band between the rings outer and inner. */
  function wallTex(outer, inner, t) {
    if (det < 1) return
    const n = outer.length, sgn = orient(outer)
    ctx.save(); path([outer, inner]); ctx.clip('evenodd')
    const gg = Math.max(K(2.4), t * 0.12)
    for (let i = 0; i < n; i++) {
      const a = outer[i], b = outer[(i + 1) % n], d = hyp(b[0] - a[0], b[1] - a[1]) || 1, vx = (b[0] - a[0]) / d, vy = (b[1] - a[1]) / d
      const nx = vy * sgn, ny = -vx * sgn, f = nx * LX + ny * LY
      if (f < 0.3) continue
      for (let s2 = gg * 0.5; s2 < d; s2 += gg * rr(0.8, 1.25)) { const e = t * rr(0.3, 0.55) * (0.5 + f * 0.5); sg(a[0] + vx * s2, a[1] + vy * s2, a[0] + vx * (s2 + e * 0.5) - nx * e, a[1] + vy * (s2 + e * 0.5) - ny * e) }
    }
    flush(0.45)
    if (det >= 2 && t * u > 9) broken(offsetPoly(outer, -t * 0.32), 0.4, true)
    ctx.restore()
  }
  /** Courtyard ground: bare earth (or o colour), a little stipple when big. */
  function yard(poly, col) {
    paint(poly, col || YARD(), 0, 0.5)
    if (det >= 2) stippleIn(poly, 0.5, K(0.5))
  }
  /** A closed curtain wall along centre line cl, thickness t. Paints the courtyard inside first (o.yard colour, or false). */
  function curtain(cl, t, o) {
    o = o || {}
    const outer = offsetPoly(cl, t / 2), inner = offsetPoly(cl, -t / 2), h = o.h == null ? t * 1.1 : o.h
    castShadow([outer], h)
    if (o.yard !== false) yard(inner, o.yard)
    innerShadow(inner, h)
    paint([outer, inner], o.col || STONE(), 0.2)
    wallTex(outer, inner, t)
    outline(outer, o.w || 1.6, { noext: true, wob: 0.15 }); outline(inner, (o.w || 1.6) * 0.7, { noext: true, wob: 0.15, flat: true })
    if (o.cren !== false && det >= 1 && t * u > 4) merlons(outer, { maxDepth: t * 0.42 })
    return { outer, inner }
  }
  /** An open run of wall (a stub, a passage side, a barbican arm) with the same look as curtain. */
  function wallRun(poly, t, o) {
    o = o || {}
    castShadow([poly], o.h == null ? t * 1.1 : o.h)
    paint(poly, STONE(), 0.2)
    if (det >= 1) { ctx.save(); path(poly); ctx.clip(); const n = poly.length, sgn = orient(poly); for (let i = 0; i < n; i++) { const a = poly[i], b = poly[(i + 1) % n], d = hyp(b[0] - a[0], b[1] - a[1]) || 1, vx = (b[0] - a[0]) / d, vy = (b[1] - a[1]) / d, nx = vy * sgn, ny = -vx * sgn, f = nx * LX + ny * LY; if (f < 0.3) continue; const gg = Math.max(K(2.4), t * 0.12); for (let s2 = gg * 0.5; s2 < d; s2 += gg * rr(0.8, 1.25)) { const e = t * rr(0.3, 0.5); sg(a[0] + vx * s2, a[1] + vy * s2, a[0] + vx * (s2 + e * 0.5) - nx * e, a[1] + vy * (s2 + e * 0.5) - ny * e) } } flush(0.45); ctx.restore() }
    outline(poly, o.w || 1.5, { noext: true, wob: 0.15 })
    if (o.cren && det >= 1 && t * u > 4) merlons(poly, { maxDepth: t * 0.42, skip: o.cren === true ? null : o.cren })
  }
  /** A roofed building: gable (or hipped) roof over a rectangle. o.kind roof kind, hip0 / hip1, h = shadow. */
  function hall(x0, y0, x1, y1, ax, o) {
    o = o || {}
    const p = rect(x0, y0, x1, y1)
    castShadow([p], o.h == null ? Math.min(x1 - x0, y1 - y0) * 0.3 : o.h)
    baseOf(p, o.kind)
    gable(x0, y0, x1, y1, ax, o)
    outline(p, o.w || 1.5, { noext: true })
    return p
  }
  /** Half-round (or faceted) apse roof on the end of a building, facing angle `dir` (0 = east). */
  function apse(ax, ay, R, dir, o) {
    o = o || {}
    const a0 = dir - PI / 2, a1 = dir + PI / 2
    const sil = fan(ax, ay, R, a0, a1, { kind: o.kind || 'slate', sides: o.sides, seams: o.seams || (o.sides ? o.sides : 10) })
    if (!o.noShadow) castShadow([sil], o.h == null ? R * 0.5 : o.h)
    pl(sil.slice(1), 1.5, { taper: 0.25, wob: 0.15 })
    ln([ax + cos(a0) * R, ay + sin(a0) * R], [ax + cos(a1) * R, ay + sin(a1) * R], 0.9, { taper: 0.3 })
    return sil
  }
  /** Faceted spire: n planes meeting at the apex over a regular polygon of radius R. */
  function spire(cx, cy, R, n, o) {
    o = o || {}
    const pts = ngon(cx, cy, R, n, true), kind = o.kind || 'slate'
    castShadow([pts], o.h == null ? R * 1.2 : o.h)
    baseOf(pts, kind)
    if (R * u > 6) {
      for (let i = 0; i < n; i++) { const a = -PI / 2 + PI / n + (TAU * (i + 0.5)) / n; plane([pts[i], pts[(i + 1) % n], [cx, cy]], [cos(a), sin(a)], { kind }) }
      for (const p of pts) crease(p, [cx, cy], 0.9)
    } else { paint(pts, kindCol(kind), 0.45); shadeSide(pts, 0.1) }
    outline(pts, 1.4, { noext: true })
    fillPoly(oval(cx, cy, Math.max(0.5, K(1.2)), Math.max(0.5, K(1.2)), 8), INK)
    return pts
  }
  /** Dome: lead sheets with ribs, a soft crescent of shade and a lantern on top. */
  function dome(cx, cy, R, o) {
    o = o || {}
    const pts = fan(cx, cy, R, 0, TAU, { kind: o.kind || 'lead', seams: o.seams || clamp(Math.round(R * u / 2.5), 8, 20) })
    loop(pts, 1.4)
    const lr = R * (o.lantern || 0.16)
    if (lr * u > 1.5) { const l = oval(cx, cy, lr, lr, 12); castShadow([l], lr * 0.8); paint(l, STONE(), 0.2); loop(l, 0.9) }
    fillPoly(oval(cx, cy, Math.max(0.5, K(1.1)), Math.max(0.5, K(1.1)), 8), INK)
    return pts
  }
  /** Column bases seen from above, batched. */
  function columns(list, rad) {
    const polys = list.map(([x, y]) => oval(x, y, rad, rad, 8))
    castShadow(polys, rad * 1.1)
    ctx.beginPath(); for (const p of polys) sub(p); ctx.fillStyle = COL ? mix(STONE(), PAPER, 0.25) : PAPER; ctx.fill()
    ctx.lineWidth = W(0.8); ctx.strokeStyle = INK; ctx.stroke()
  }
  /** Lawn: grass colour with stipple. */
  function lawn(poly) { paint(poly, GRASS(), 0, 0.5); if (det >= 1) stippleIn(poly, 0.9, K(0.5)) }
  /** Covered walk round a garth: four lean-to roofs sloping into the garden, which gets a lawn, paths and a well. */
  function cloister(x0, y0, x1, y1, w, o) {
    o = o || {}
    const kind = o.kind || 'tile', R = rect(x0, y0, x1, y1), g = rect(x0 + w, y0 + w, x1 - w, y1 - w)
    castShadow([R], w * 0.5)
    baseOf(R, kind)
    plane([[x0, y0], [x1, y0], [x1 - w, y0 + w], [x0 + w, y0 + w]], S, { kind })
    plane([[x0, y1], [x1, y1], [x1 - w, y1 - w], [x0 + w, y1 - w]], N, { kind })
    plane([[x0, y0], [x0, y1], [x0 + w, y1 - w], [x0 + w, y0 + w]], E, { kind })
    plane([[x1, y0], [x1, y1], [x1 - w, y1 - w], [x1 - w, y0 + w]], WD, { kind })
    for (const [a, b] of [[[x0, y0], [x0 + w, y0 + w]], [[x1, y0], [x1 - w, y0 + w]], [[x1, y1], [x1 - w, y1 - w]], [[x0, y1], [x0 + w, y1 - w]]]) crease(a, b, 0.9)
    lawn(g)
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
    if (det >= 1) { // paths crossing the garth and a well in the middle
      const pw = Math.max(K(1.6), 0.8)
      for (const p of [rect(cx - pw, y0 + w, cx + pw, y1 - w), rect(x0 + w, cy - pw, x1 - w, cy + pw)]) { fillPoly(p, COL ? ROAD() : PAPER); broken([p[0], p[3]], 0.35); broken([p[1], p[2]], 0.35) }
      well(cx, cy, Math.max(K(2), 1.6))
      if (o.bushes !== false) { bush(x0 + w + (cx - x0 - w) * 0.5, y0 + w + (cy - y0 - w) * 0.5, Math.max(K(2.4), 2)); bush(cx + (x1 - w - cx) * 0.5, cy + (y1 - w - cy) * 0.55, Math.max(K(2.4), 2.3)) }
    }
    innerShadow(g, w * 0.4)
    outline(R, 1.3, { noext: true }); outline(g, 0.9, { noext: true, flat: true })
  }
  /** Round stone well: ring of blocks around dark water. */
  function well(x, y, rad) {
    const o1 = oval(x, y, rad, rad, 12), o2 = oval(x, y, rad * 0.55, rad * 0.55, 10)
    castShadow([o1], rad * 0.7)
    paint(o1, STONE(), 0.1); loop(o1, 1.2)
    fillPoly(o2, COL ? mix(T.water, '#2a3a38', 0.45) : INK)
  }
  /** A round bush or small tree: scalloped crown, darker on the shade side. */
  function bush(x, y, R) {
    const c = oval(x, y, R, R * 0.9, 9, 0.16)
    castShadow([c], R * 0.5)
    paint(c, mix(T.forest, T.grass, 0.3), 0.15); shadeBands(c, x, y, R, 2)
    if (det >= 1) { ctx.save(); path(c); ctx.clip(); for (let i = 0; i < 4; i++) { const a = rr(0, TAU), d = R * rr(0.2, 0.6); sg(x + cos(a) * d, y + sin(a) * d, x + cos(a + 1.2) * d * 0.6 + LX * R * 0.5, y + sin(a + 1.2) * d * 0.6 + LY * R * 0.5) } flush(0.45); ctx.restore() }
    loop(c, 1.0, { wob: 0.1 })
  }
  /** Still water inside rings (moat, channel, basin). */
  function water(rings) {
    fillPoly(rings, COL ? mix(T.water, PAPER, 0.3) : PAPER)
    if (COL) wash(rings, T.water, 0.6)
  }
  /** Ripple lines that follow a bank: broken thin lines along the given loops. */
  function ripples(loops, closed) { for (const l of loops) broken(l, 0.4, closed) }
  /** Moat round a wall: water from the outer face out by w. */
  function moat(outerFace, w) {
    const bank = offsetPoly(outerFace, w)
    water([bank, outerFace])
    if (det >= 1) ripples([offsetPoly(outerFace, w * 0.35), offsetPoly(outerFace, w * 0.7)], true)
    pl(bank.concat([bank[0]]), 0.7, { taper: 0, wob: 0.3 })
  }
  /** Road or path along a polyline: a pale band with broken edges. */
  function road(pts, w) {
    const p = ribbon(pts, w / 2)
    fillPoly(p, COL ? ROAD() : PAPER); if (COL) wash(p, mix(ROAD(), '#8a7048', 0.3), 0.3)
    const n = pts.length
    broken(p.slice(0, n), 0.45); broken(p.slice(n), 0.45)
    if (det >= 2) { broken(ribbon(pts, w * 0.18).slice(0, n), 0.3); broken(ribbon(pts, w * 0.18).slice(n), 0.3) }
  }
  /** Flight of steps between a and b, w wide: a tread line every few pixels. */
  function steps(a, b, w) {
    const L = hyp(b[0] - a[0], b[1] - a[1]), vx = (b[0] - a[0]) / L, vy = (b[1] - a[1]) / L, nx = -vy * w / 2, ny = vx * w / 2, g = Math.max(K(2.6), 0.7)
    const p = [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]]
    fillPoly(p, COL ? lighter(STONE(), 0.2) : PAPER)
    for (let t = g * 0.5; t < L; t += g) sg(a[0] + vx * t + nx, a[1] + vy * t + ny, a[0] + vx * t - nx, a[1] + vy * t - ny)
    flush(0.5)
    ln(p[0], p[1], 0.9, { taper: 0.2 }); ln(p[3], p[2], 0.9, { taper: 0.2 })
  }
  /** Timber bridge or drawbridge: planks across, a rail each side. */
  function plankBridge(a, b, w) {
    const L = hyp(b[0] - a[0], b[1] - a[1]), vx = (b[0] - a[0]) / L, vy = (b[1] - a[1]) / L, nx = -vy * w / 2, ny = vx * w / 2
    const p = [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]]
    castShadow([p], w * 0.25)
    paint(p, WOOD(), 0.1)
    if (det >= 1) { const g = Math.max(K(2.2), 0.6); for (let t = g * 0.6; t < L; t += g * rr(0.85, 1.2)) sg(a[0] + vx * t + nx * 0.92, a[1] + vy * t + ny * 0.92, a[0] + vx * t - nx * 0.92, a[1] + vy * t - ny * 0.92); flush(0.45) }
    ln(p[0], p[1], 1.2, { taper: 0.2 }); ln(p[3], p[2], 1.2, { taper: 0.2 })
  }
  /** Hachures round a mound: strokes running down the slope from r0 to r1, heavier and denser on the shaded side. */
  function hachures(cx, cy, r0, r1, ry) {
    ry = ry || 1
    const n = Math.max(14, Math.round((TAU * ((r0 + r1) / 2) * u) / 3.4)), lt = [], hv = []
    for (let i = 0; i < n; i++) {
      const a = (TAU * (i + jt(0.3))) / n, dk = cos(a) * LX + sin(a) * LY, f = clamp(0.5 + dk * 0.5, 0, 1)
      if (r() > 0.4 + f * 0.6) continue
      const span = r1 - r0, s0 = r0 + rr(0, span * 0.12), L = span * rr(0.5, 0.95) * (0.65 + f * 0.4)
      ;(dk > 0.1 ? hv : lt).push(cx + cos(a) * s0, cy + sin(a) * s0 * ry, cx + cos(a + jt(0.015)) * (s0 + L), cy + sin(a + jt(0.015)) * (s0 + L) * ry)
    }
    for (let i = 0; i < lt.length; i++) SG.push(lt[i]); flush(0.45)
    for (let i = 0; i < hv.length; i++) SG.push(hv[i]); flush(0.8)
  }
  /** Earth mound (motte): grassy slope with hachures and a flat top. Returns the top ring. */
  function motte(cx, cy, R, top, ry) {
    ry = ry || 1
    const foot = oval(cx, cy, R, R * ry, 0, 0.02), tp = oval(cx, cy, top, top * ry, 0, 0.01)
    castShadow([foot], R * 0.12)
    paint(foot, GRASS(), 0.1, 0.5); shadeBands(foot, cx, cy, R, 2)
    if (R * u > 8) hachures(cx, cy, top * 1.02, R * 0.98, ry)
    paint(tp, lighter(GRASS(), 0.12), 0, 0.4)
    loop(tp, 0.7, { flat: true, wob: 0.2 })
    pl(foot.concat([foot[0]]), 0.8, { taper: 0, wob: 0.35 })
    return tp
  }
  /** Rough rock (a crag): jagged outline, cliff ticks and stipple heavier on the shade side, a few cracks. */
  function crag(pts) {
    castShadow([pts], 3)
    paint(pts, mix(STONE(), T.sand, 0.3), 0.15, 0.6); shadeBands(pts, 0, 0, 50, 3)
    const n = pts.length, sgn = orient(pts)
    ctx.save(); path(pts); ctx.clip()
    for (let i = 0; i < n; i++) { // cliff ticks inside the edge
      const a = pts[i], b = pts[(i + 1) % n], d = hyp(b[0] - a[0], b[1] - a[1]) || 1, vx = (b[0] - a[0]) / d, vy = (b[1] - a[1]) / d, nx = vy * sgn, ny = -vx * sgn
      const f = clamp(0.5 + 0.5 * (nx * LX + ny * LY), 0, 1), g = Math.max(K(3.2), 0.8)
      for (let s2 = rr(0, g); s2 < d; s2 += g * rr(0.7, 1.4)) { if (r() > 0.35 + f * 0.65) continue; const L = rr(K(3), K(8)) * (0.6 + f * 0.6); sg(a[0] + vx * s2, a[1] + vy * s2, a[0] + vx * (s2 + L * 0.3) - nx * L, a[1] + vy * (s2 + L * 0.3) - ny * L) }
    }
    flush(0.55)
    if (det >= 1) { // cracks and stipple
      for (let i = 0; i < 6; i++) { const x = rr(-40, 40), y = rr(-35, 35), a = rr(0, TAU), L = rr(4, 10); pl([[x, y], [x + cos(a) * L * 0.5 + jt(1.5), y + sin(a) * L * 0.5 + jt(1.5)], [x + cos(a) * L, y + sin(a) * L]], 0.6, { taper: 0.8, wob: 0.3 }) }
      const [x0, y0, x1, y1] = bbox(pts), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rad = Math.max(x1 - x0, y1 - y0) / 2
      const ox = cx + LX * rad * 0.15, oy = cy + LY * rad * 0.15, px = -LY, py = LX, big = rad * 1.7
      stippleIn([[ox + px * big, oy + py * big], [ox - px * big, oy - py * big], [ox - px * big + LX * big, oy - py * big + LY * big], [ox + px * big + LX * big, oy + py * big + LY * big]], 0.7, K(0.55))
    }
    ctx.restore()
    pl(pts.concat([pts[0]]), 1.1, { taper: 0, wob: 0.5 })
  }
  /** Palisade: a line of post ends along the edges of a polygon (closed) or polyline. */
  function palisade(pts, closed, gapTest) {
    const n = pts.length, m = closed ? n : n - 1, g = Math.max(K(2.6), 0.9), rad = Math.max(K(0.9), 0.45)
    const band = closed ? [offsetPoly(pts, rad), offsetPoly(pts, -rad)] : null
    if (band) castShadow([band[0]], rad * 4)
    ctx.beginPath()
    for (let i = 0; i < m; i++) {
      const a = pts[i], b = pts[(i + 1) % n], d = hyp(b[0] - a[0], b[1] - a[1]) || 1
      for (let t = g * 0.5; t < d; t += g * rr(0.9, 1.1)) { const x = a[0] + ((b[0] - a[0]) * t) / d, y = a[1] + ((b[1] - a[1]) * t) / d; if (gapTest && gapTest(x, y)) continue; ctx.moveTo(x + rad, y); ctx.arc(x, y, rad * rr(0.85, 1.15), 0, TAU) }
    }
    ctx.fillStyle = INK; ctx.fill()
  }
  /** A loose stone or fallen block, seen from above. */
  function stone(x, y, rad) {
    const n = r() < 0.5 ? 5 : 6, ph = r() * 6, el = rr(0.65, 1), pts = []
    for (let i = 0; i < n; i++) { const a = ph + (TAU * i) / n + jt(0.28), k = rad * rr(0.72, 1.12); pts.push([x + cos(a) * k, y + sin(a) * k * el]) }
    if (det >= 2) castShadow([pts], Math.max(0.5, rad * 0.55))
    fillPoly(pts, COL ? mix(STONE(), PAPER, 0.3) : PAPER)
    outline(pts, 0.8, { noext: true, wob: 0.1 })
  }
  function rubble(x, y, spread, n) {
    for (let i = 0; i < n; i++) stone(x + jt(spread), y + jt(spread), Math.max(K(0.9), 0.5) * rr(0.8, 1.6))
    if (det >= 2) dots(Math.round(n * 1.5), x - spread, y - spread, x + spread, y + spread, 0.4)
  }
  /** Offset an open polyline into a wall band polygon with broken (jagged) ends. */
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
    const wob = t * 0.05
    const sub2 = (P) => { const o = [P[0]]; for (let i = 1; i < P.length; i++) { const a = P[i - 1], b = P[i], d = hyp(b[0] - a[0], b[1] - a[1]), m = Math.floor(d / Math.max(K(9), t)); for (let q = 1; q <= m; q++) { const f = q / (m + 1); o.push([a[0] + (b[0] - a[0]) * f + jt(wob), a[1] + (b[1] - a[1]) * f + jt(wob)]) } o.push(b) } return o }
    const Ls = sub2(L), Rs = sub2(R).reverse()
    const cap = (a, b, j) => (j ? [[(a[0] + b[0]) / 2 + (b[0] - a[0]) * 0.22 + jt(j), (a[1] + b[1]) / 2 + (b[1] - a[1]) * 0.22 + jt(j)], [(a[0] + b[0]) / 2 - (b[0] - a[0]) * 0.22 + jt(j), (a[1] + b[1]) / 2 - (b[1] - a[1]) * 0.22 + jt(j)]] : [])
    return [...cap(Rs[Rs.length - 1], Ls[0], jag0), ...Ls, ...cap(Ls[Ls.length - 1], Rs[0], jag1), ...Rs]
  }
  /** A standing piece of ruined wall along centre line c, thickness t: broken ends unless o.clean0 / clean1, rubble at the breaks. */
  function ruinBand(c, t, o) {
    o = o || {}
    const j = t * 0.35, poly = bandPoly(c, t, o.clean0 ? 0 : rr(0.6, 1) * j, o.clean1 ? 0 : rr(0.6, 1) * j)
    castShadow([poly], o.h == null ? t * 0.8 : o.h)
    paint(poly, lighter(STONE(), 0.1), 0.15, 0.65)
    if (det >= 1) {
      ctx.save(); path(poly); ctx.clip()
      const gg = Math.max(K(2.4), t * 0.14)
      for (let i = 0; i < c.length - 1; i++) {
        const a = c[i], b = c[i + 1], d = hyp(b[0] - a[0], b[1] - a[1]) || 1, vx = (b[0] - a[0]) / d, vy = (b[1] - a[1]) / d
        let nx = -vy, ny = vx; if (nx * LX + ny * LY < 0) { nx = -nx; ny = -ny }
        const f = clamp(nx * LX + ny * LY, 0, 1)
        for (let s2 = 0; s2 < d; s2 += gg * rr(0.8, 1.25)) { const e = t * rr(0.28, 0.5) * (0.5 + f); sg(a[0] + vx * s2, a[1] + vy * s2, a[0] + vx * (s2 + e * 0.5) + nx * e * 1.05, a[1] + vy * (s2 + e * 0.5) + ny * e * 1.05) }
      }
      flush(0.5)
      if (det >= 2) stippleIn(poly, 0.8, K(0.5))
      ctx.restore()
    }
    outline(poly, 1.2, { noext: true, wob: 0.18 })
    if (det >= 1) {
      if (!o.clean0) rubble(c[0][0], c[0][1], t * 0.9, 2)
      if (!o.clean1) rubble(c[c.length - 1][0], c[c.length - 1][1], t * 0.9, 2)
    }
    return poly
  }
  /** Pieces of a ring wall (a ruined round tower) between angles, as arcs of centre line. */
  function ringPieces(cx, cy, R, t, arcs, o) {
    for (const [a0, a1] of arcs) {
      const n = Math.max(3, Math.round(((a1 - a0) * R * u) / 6)), c = []
      for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; c.push([cx + cos(a) * R, cy + sin(a) * R]) }
      ruinBand(c, t, o)
    }
  }
  /** The mouth of a gate passage in a wall face: a dark arch, bulging towards dir (-1 = -y). */
  function archMark(cx, cy, w, dir) {
    const ry = w * 0.42 * dir, pts = []
    for (let i = 0; i <= 10; i++) { const a = (PI * i) / 10; pts.push([cx - cos(a) * w / 2, cy + sin(a) * ry]) }
    fillPoly(pts, COL ? darker(STONE(), 0.55) : mix(INK, PAPER, 0.2))
    pl(pts, 1.1, { taper: 0.2, wob: 0.1 })
  }
  /** Closed gate: the leaves as a heavy line across the passage with a pin in the middle. */
  function gateBar(a, b) {
    ln(a, b, 2.0, { taper: 0.15, wob: 0.1 })
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    fillPoly(oval(m[0], m[1], Math.max(0.4, K(0.9)), Math.max(0.4, K(0.9)), 6), INK)
  }
  /** Gate passage through a wall centred on (cx, cy); dir = unit vector pointing out of the enclosure. o.w width, o.len length,
      o.R flanking round towers of that radius (o.h their shadow), o.bar = 0 for an open gateway. */
  function gate(cx, cy, dir, o) {
    o = o || {}
    const w = o.w || 6, len = o.len || 8, px = -dir[1], py = dir[0]
    const P = (a, b) => [cx + px * a + dir[0] * b, cy + py * a + dir[1] * b]
    const pas = [P(-w / 2, -len / 2), P(w / 2, -len / 2), P(w / 2, len / 2), P(-w / 2, len / 2)]
    fillPoly(pas, COL ? ROAD() : PAPER); if (COL) wash(pas, mix(ROAD(), '#8a7048', 0.3), 0.3)
    if (o.R) for (const s2 of [-1, 1]) roundTower(...P(s2 * (w / 2 + o.R * 0.92), o.off || 0), o.R, { h: o.h })
    ln(P(-w / 2, -len / 2), P(-w / 2, len / 2), 1.1, { taper: 0.2 }); ln(P(w / 2, -len / 2), P(w / 2, len / 2), 1.1, { taper: 0.2 })
    if (o.bar !== 0) gateBar(P(-w / 2, len * 0.28), P(w / 2, len * 0.28))
  }
  /** A small roof hatch with an iron ring. */
  function hatchDoor(x, y, w) {
    const p = rect(x - w / 2, y - w / 2, x + w / 2, y + w / 2)
    castShadow([p], w * 0.12); paint(p, WOOD(), 0.1)
    outline(p, 1.0, { noext: true, wob: 0.1 })
    ctx.beginPath(); ctx.arc(x, y, w * 0.14, 0, TAU); ctx.lineWidth = W(0.7); ctx.strokeStyle = INK; ctx.stroke()
  }
  function chimney(cx, cy, w) {
    const sq = rect(cx - w / 2, cy - w / 2, cx + w / 2, cy + w / 2)
    castShadow([sq], w * 0.9); paint(sq, STONE(), 0.1)
    if (det >= 1) fillPoly(rect(cx - w * 0.23, cy - w * 0.23, cx + w * 0.23, cy + w * 0.23), INK)
    outline(sq, 1.3, { noext: true })
  }

  function reg(name, label, category, fns, dsc, size) {
    A.register(name, {
      label, category, kind: 'fixed', view: 'top', variants: fns.length, size,
      draw(c, x, y, s, rg, style, v) {
        open(c, x, y, s, rg, style, dsc)
        try { fns[(((v | 0) % fns.length) + fns.length) % fns.length]() } finally { ctx.restore() }
      },
    })
  }

  /* =====================================================================================================================
     CASTLE (ct-keep): default s = 350 px, about 250 ft, so 1 unit is about 2.5 ft
     ===================================================================================================================== */
  const SLATE = { kind: 'slate' }, TILE = { kind: 'tile' }, SHIN = { kind: 'shingle' }, THATCH = { kind: 'thatch' }

  /** 0: square keep with corner turrets in a square bailey; great hall on the east, stables on the west, a gate to the south. */
  function keep0() {
    const cl = rect(-47.5, -37.5, 47.5, 37.5), t = 4.5
    curtain(cl, t, { h: 5 })
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) roundTower(sx * 47.5, sy * 37.5, 8.5, { h: 7 })
    roundTower(0, -37.5, 6, { h: 6 }); roundTower(-47.5, 2, 6, { h: 6 }); roundTower(47.5, -2, 6, { h: 6 })
    // buildings against the walls
    hall(12, -33, 44, -19, 'x', Object.assign({ hip1: true, h: 4 }, SLATE))
    hall(-45, 6, -35, 34, 'y', Object.assign({ h: 3 }, SHIN))
    hall(16, 20, 32, 32, 'x', Object.assign({ h: 3 }, TILE))
    hall(26, -8, 39, 4, 'x', Object.assign({ h: 3 }, TILE)); apse(39, -2, 6, 0, { kind: 'tile', h: 2 })
    if (det >= 2) chimney(22, 26, 2.2)
    // the keep: square block with a paved top and four little turrets
    const kx = -17, ky = -10, H = 13
    const inner = crenBlock(rect(kx - H, ky - H, kx + H, ky + H), { h: 9 })
    if (det >= 2) hatchDoor(kx + 4, ky + 3, 4)
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) roundTower(kx + sx * H, ky + sy * H, 4.2, { h: 10, roof: sx + sy === 0 ? 'cren' : 'cone', kind: 'slate' })
    void inner
    well(-2, 14, 2.6)
    gate(0, 37.5, S, { w: 6, len: t + 3, R: 5.5, h: 6 })
  }
  /** 1: shell keep on a motte, a walled bailey beside it, a moat round the lot. */
  function keep1() {
    const mc = [-27, 2], MR = 21
    const bail = [[-6, -28], [14, -32], [33, -30], [43, -18], [44, 4], [38, 22], [22, 31], [4, 30], [-8, 18], [-10, -6]]
    const t = 3.8, outer = offsetPoly(bail, t / 2)
    // water first, then the mound, then the bailey
    moat(oval(mc[0], mc[1], MR + 1, MR + 1, 24, 0.02), 4.5)
    moat(outer, 4.5)
    const top = motte(mc[0], mc[1], MR, 13.5)
    void top
    curtain(bail, t, { h: 4 })
    roundTower(43, -18, 6, { h: 6 }); roundTower(38, 22, 6, { h: 6 }); roundTower(-8, 18, 5.5, { h: 6 }); roundTower(14, -32, 5.5, { h: 6 })
    hall(10, -25, 36, -14, 'x', Object.assign({ hip0: true, h: 4 }, SLATE))
    hall(6, 14, 26, 23, 'x', Object.assign({ h: 3 }, SHIN))
    hall(28, 0, 38, 9, 'x', Object.assign({ h: 3 }, TILE)); apse(38, 4.5, 4.5, 0, { kind: 'tile', h: 2 })
    hall(-2, -12, 6, 6, 'y', Object.assign({ h: 3 }, THATCH))
    well(16, 2, 2.4)
    gate(14, 30.8, S, { w: 5, len: t + 3, R: 4.8, h: 5 })
    plankBridge([14, 33], [14, 40], 5)
    // shell keep on the motte top
    const shell = oval(mc[0], mc[1], 10.5, 10.5, 24, 0.004)
    curtain(shell, 3, { h: 6, yard: YARD() })
    hall(mc[0] - 7, mc[1] - 1, mc[0] + 1, mc[1] + 6, 'x', Object.assign({ h: 3 }, SHIN))
    roundTower(mc[0] + 6, mc[1] - 6, 3.6, { h: 7 })
    steps([-14, 0], [-7, -2], 3.2)
  }
  /** 2: concentric castle: two rings of walls, big drum towers on the inner ward, a moat outside. */
  function keep2() {
    const oc = rect(-43.5, -34, 43.5, 34), ot = 3
    moat(offsetPoly(oc, ot / 2), 5)
    curtain(oc, ot, { h: 3.5 })
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) roundTower(sx * 43.5, sy * 34, 4.6, { h: 4.5 })
    roundTower(0, -34, 4, { h: 4 }); roundTower(-43.5, 0, 4, { h: 4 }); roundTower(43.5, 0, 4, { h: 4 })
    hall(-34, -31, -10, -24, 'x', Object.assign({ h: 2.5 }, SHIN))
    hall(14, 24, 36, 31, 'x', Object.assign({ h: 2.5 }, SHIN))
    const ic = rect(-27, -20, 27, 20), it = 4.5
    curtain(ic, it, { h: 6 })
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) roundTower(sx * 27, sy * 20, 8, { h: 8 })
    hall(-22, -16, 2, -6, 'x', Object.assign({ hip1: true, h: 4 }, SLATE))
    hall(8, -14, 18, -6, 'x', Object.assign({ h: 3 }, TILE)); apse(18, -10, 4, 0, { kind: 'tile', h: 2 })
    hall(-20, 6, -8, 14, 'x', Object.assign({ h: 3 }, TILE))
    well(4, 4, 2.2)
    gate(0, 20, S, { w: 5, len: it + 3, R: 5.5, h: 7 })
    gate(0, 34, S, { w: 4.5, len: ot + 3, R: 4, h: 4 })
    plankBridge([0, 36], [0, 41.5], 4.5)
  }
  /** 3: triangular castle on a crag: a great round tower at the apex, a hall along the base wall, a path winding down. */
  function keep3() {
    const rock = oval(0, 3, 49, 42, 26, 0.09)
    crag(rock)
    road([[11, 20], [18, 29], [28, 35], [38, 41]], 3.2)
    const cl = [[0, -27], [31, 17], [-31, 17]], t = 4
    curtain(cl, t, { h: 5 })
    roundTower(0, -27, 10.5, { h: 9 })
    roundTower(31, 17, 7, { h: 7 }); roundTower(-31, 17, 7, { h: 7 })
    hall(-21, 5, -1, 14, 'x', Object.assign({ hip0: true, h: 4 }, SLATE))
    hall(4, -8, 12, -1, 'x', Object.assign({ h: 3 }, SHIN))
    well(-6, -3, 2.2)
    gate(11, 17, S, { w: 5, len: t + 3 })
  }
  /** 4: tower house with a pitched roof inside its parapet and a cap-house turret, in a walled yard with a byre and stable. */
  function keep4() {
    const cl = rect(-47.5, -31, 47.5, 31)
    curtain(cl, 2.6, { h: 3, cren: false })
    hall(32, -27, 44, 4, 'y', Object.assign({ h: 3 }, THATCH))
    hall(-18, 16, 12, 27, 'x', Object.assign({ h: 3 }, SHIN))
    hall(-45, -26, -34, -8, 'y', Object.assign({ h: 2.5 }, SHIN))
    bush(24, -18, 4); bush(-30, 20, 3.2)
    well(10, -2, 2.4)
    // the tower house
    const tx0 = -30, ty0 = -22, tx1 = -4, ty1 = -2
    const inner = crenBlock(rect(tx0, ty0, tx1, ty1), { h: 10 })
    const [ix0, iy0] = inner[0], [ix1, iy1] = inner[2]
    gable(ix0 + 0.4, iy0 + 0.4, ix1 - 0.4, iy1 - 0.4, 'x', SLATE)
    outline(rect(ix0 + 0.4, iy0 + 0.4, ix1 - 0.4, iy1 - 0.4), 1.1, { noext: true })
    roundTower(tx1, ty1, 3.6, { h: 11, roof: 'cone', kind: 'slate' })
    if (det >= 2) chimney(tx0 + 3, (ty0 + ty1) / 2, 2.2)
    gate(24, 31, S, { w: 5, len: 5.5 })
  }
  /** 5: palace-fortress: four ranges round two courtyards, square corner towers under pyramids, a gate tower on the south. */
  function keep5() {
    const X = 50, Y = 35, w = 12
    const block = rect(-X, -Y, X, Y)
    castShadow([block], 6)
    baseOf(block, 'tile')
    // courtyards: paving on the west, garden on the east
    const cw = rect(-X + w, -Y + w, -6, Y - w), ce = rect(6, -Y + w, X - w, Y - w)
    deck(cw); innerShadow(cw, 5)
    lawn(ce); innerShadow(ce, 5)
    if (det >= 1) {
      const gx = 6 + (X - w - 6) / 2, gy = 0, pw = Math.max(K(1.6), 0.9)
      for (const p of [rect(gx - pw, -Y + w, gx + pw, Y - w), rect(6, gy - pw, X - w, gy + pw)]) fillPoly(p, COL ? ROAD() : PAPER)
      for (const [bx, by] of [[gx - 8, gy - 7], [gx + 8, gy - 7], [gx - 8, gy + 7], [gx + 8, gy + 7]]) { const b = rect(bx - 5, by - 4.5, bx + 5, by + 4.5); outline(b, 0.7, { flat: true, noext: true }); if (det >= 2) stippleIn(b, 2.5, K(0.5)) }
      well(gx, gy, 2.2)
      const f = oval(-X + w + (X - w - 6) / 2, 0, 4, 4, 14); paint(f, STONE(), 0.1); loop(f, 1.1); fillPoly(oval(f[0][0] - 4, 0, 2.6, 2.6, 10), COL ? mix(T.water, PAPER, 0.2) : PAPER); loop(oval(f[0][0] - 4, 0, 2.6, 2.6, 10), 0.6, { flat: true })
    }
    // ranges: roofs run along each side; the corners are left to the towers
    const C = 14
    gable(-X + C, -Y, X - C, -Y + w, 'x', TILE); gable(-X + C, Y - w, X - C, Y, 'x', TILE)
    gable(-X, -Y + C, -X + w, Y - C, 'y', TILE); gable(X - w, -Y + C, X, Y - C, 'y', TILE)
    gable(-6, -Y + w, 6, Y - w, 'y', Object.assign({ hip0: true, hip1: true }, TILE))
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const sq = rect(sx * X - (sx > 0 ? C : 0), sy * Y - (sy > 0 ? C : 0), sx * X + (sx < 0 ? C : 0), sy * Y + (sy < 0 ? C : 0))
      castShadow([sq], 7); baseOf(sq, 'slate')
      const b = bbox(sq); pyramid(b[0], b[1], b[2], b[3], SLATE); outline(sq, 1.6, { noext: true })
      fillPoly(oval((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, Math.max(0.5, K(1.1)), Math.max(0.5, K(1.1)), 6), INK)
    }
    outline(block, 1.9, { noext: true })
    outline(cw, 1.0, { noext: true, flat: true }); outline(ce, 1.0, { noext: true, flat: true })
    // gate tower over the south range
    const gt = rect(-8, Y - w - 4, 8, Y + 1)
    crenBlock(gt, { h: 9 })
    archMark(0, Y + 1, 6, 1)
  }
  /** 6: motte-and-bailey: a timber tower on the mound, a palisaded bank round the bailey, a bridge between them. */
  function keep6() {
    const mc = [26, 0], MR = 23
    const bail = oval(-21, 0, 26, 29, 14, 0.03)
    // ditches
    moat(offsetPoly(bail, 1.5), 4)
    moat(oval(mc[0], mc[1], MR + 0.5, MR + 0.5, 24, 0.02), 4)
    // bailey: bank with hachures, lawn inside, palisade on the crest
    const bank = offsetPoly(bail, 1.5)
    paint(bank, GRASS(), 0.1, 0.5)
    if (det >= 1) { const n = bank.length, sgn = orient(bank); for (let i = 0; i < n; i++) { const a = bank[i], b = bank[(i + 1) % n], d = hyp(b[0] - a[0], b[1] - a[1]) || 1, vx = (b[0] - a[0]) / d, vy = (b[1] - a[1]) / d, nx = vy * sgn, ny = -vx * sgn, g = Math.max(K(2.6), 0.9); for (let s2 = g * 0.5; s2 < d; s2 += g * rr(0.8, 1.3)) sg(a[0] + vx * s2 - nx * 0.4, a[1] + vy * s2 - ny * 0.4, a[0] + vx * s2 + nx * 3.2, a[1] + vy * s2 + ny * 3.2) } flush(0.5) }
    lawn(offsetPoly(bail, -1.2))
    hall(-32, -17, -10, -8, 'x', Object.assign({ h: 3 }, THATCH))
    hall(-42, 4, -28, 12, 'x', Object.assign({ h: 2.5 }, SHIN))
    const hut = (x, y, R) => { const c = oval(x, y, R, R, 14); castShadow([c], 2); fan(x, y, R, 0, TAU, { kind: 'thatch' }); loop(c, 1.1) }
    hut(-14, 10, 3.6); hut(-36, -6, 3.2)
    well(-22, 1, 2)
    palisade(bail, true, (x, y) => y > 24 && x > -30 && x < -22)
    // gate: two heavier posts and a little gate tower astride the gap
    hall(-30, 24, -22, 31, 'x', Object.assign({ h: 4 }, SHIN))
    // motte with its tower
    const top = motte(mc[0], mc[1], MR, 12)
    palisade(offsetPoly(top, -1), true)
    const tw = rect(mc[0] - 5, mc[1] - 5, mc[0] + 5, mc[1] + 5)
    castShadow([tw], 6); baseOf(tw, 'shingle'); pyramid(mc[0] - 5, mc[1] - 5, mc[0] + 5, mc[1] + 5, SHIN); outline(tw, 1.4, { noext: true })
    plankBridge([3.5, -1], [15, -1], 3.2)
  }
  /** 7: ruined castle: broken curtain, two tower stumps, one standing tower, a roofless hall and grass over the ward. */
  function keep7() {
    const t = 4
    const yardP = rect(-40, -30, 40, 30)
    lawn(yardP)
    // the curtain, as the pieces still standing (fractions of each side, clockwise from the north-west corner)
    const runs = [
      [[-42, -32], [-6, -32]], [[4, -32], [20, -32]], [[42, -32], [42, -8]], [[42, 8], [42, 32], [18, 32]], [[-4, 32], [-30, 32]], [[-42, 32], [-42, 10]], [[-42, -4], [-42, -32]],
    ]
    for (let i = 0; i < runs.length; i++) ruinBand(runs[i], t, { h: i === 0 || i === 6 ? 4.5 : 2.5, clean0: i === 6, clean1: i === 0 })
    // towers: one standing (NW), a stump (NE), a floor and rubble (SE), an open shell (SW)
    roundTower(-42, -32, 7.5, { h: 7 })
    ringPieces(42, -32, 6, 3.2, [[PI * 0.1, PI * 1.25]], { h: 3 })
    const fl = oval(42, 32, 6.5, 6.5, 16); paint(fl, lighter(STONE(), 0.2), 0, 0.5); loop(fl, 0.8, { flat: true }); rubble(42, 32, 4, 5)
    ringPieces(-42, 32, 6.5, 3.4, [[-PI * 0.2, PI * 0.9], [PI * 1.15, PI * 1.7]], { h: 4 })
    // roofless hall
    const hw = [[-28, -20], [2, -20], [2, -6], [-28, -6]]
    const fl2 = rect(-28, -20, 2, -6); deck(fl2, lighter(STONE(), 0.25)); if (det >= 1) stippleIn(fl2, 0.6, K(0.5))
    ruinBand([hw[0], hw[1], hw[2]], 2.6, { h: 3.5 }); ruinBand([[-12, -6], hw[3], [-28, -16]], 2.6, { h: 3 })
    rubble(-6, 4, 5, 4); rubble(22, -18, 4, 3); rubble(20, 24, 3, 3)
    bush(14, 6, 4.2); bush(-20, 18, 3.4); bush(30, -4, 2.8)
    if (det >= 1) { for (let i = 0; i < 14; i++) tuft(rr(-36, 36), rr(-26, 26), rr(0.9, 1.5)); flush(0.5) }
    gate(-17, 32, S, { w: 5, len: t + 2, bar: 0 })
  }
  reg('ct-keep', 'Castle', 'ct-castle', [keep0, keep1, keep2, keep3, keep4, keep5, keep6, keep7], 0.4, 350)

  /* =====================================================================================================================
     CATHEDRAL (ct-cathedral): default s = 300 px, about 210 ft, so 1 unit is about 2.1 ft
     ===================================================================================================================== */
  /** Pinnacle dots at the corners of a tower top. */
  function pinnacles(pts) { if (det < 1) return; ctx.beginPath(); const rad = Math.max(K(1.1), 0.5); for (const p of pts) { ctx.moveTo(p[0] + rad, p[1]); ctx.arc(p[0], p[1], rad, 0, TAU) } ctx.fillStyle = INK; ctx.fill() }
  /** Buttresses along a straight edge from a to b, standing proud of it on the outward side n, every `g` units. */
  function buttressRow(a, b, n, g, w, d) {
    if (det < 1) return
    const L = hyp(b[0] - a[0], b[1] - a[1]), vx = (b[0] - a[0]) / L, vy = (b[1] - a[1]) / L
    for (let s2 = g * 0.5; s2 < L - w; s2 += g) {
      const x = a[0] + vx * s2, y = a[1] + vy * s2
      const p = [[x, y], [x + vx * w, y + vy * w], [x + vx * w + n[0] * d, y + vy * w + n[1] * d], [x + n[0] * d, y + n[1] * d]]
      castShadow([p], d * 0.6); paint(p, STONE(), 0.1); outline(p, 0.9, { noext: true, wob: 0.1 })
    }
  }

  /** 0: Gothic cathedral: aisled nave, transepts, chancel with a polygonal apse, two west towers, a spire over the crossing. */
  function cath0() {
    const k = SLATE
    // silhouette of the main body, outlined once
    const sil = [[-38, -15], [10, -15], [10, -30], [24, -30], [24, -14], [36, -14], [36, -8], [40, -8]]
    const ap = ngon(40, 0, 9, 10, false).filter((p) => p[0] >= 40 - 0.01)
    ap.sort((p, q) => p[1] - q[1])
    for (const p of ap) sil.push(p)
    sil.push([40, 8], [36, 8], [36, 14], [24, 14], [24, 30], [10, 30], [10, 15], [-38, 15])
    castShadow([sil], 7)
    baseOf(sil, 'slate')
    buttressRow([-36, -15], [10, -15], N, 7.5, 1.6, 2.4); buttressRow([-36, 15], [10, 15], S, 7.5, 1.6, 2.4)
    buttressRow([24, -14], [36, -14], N, 6, 1.6, 2.2); buttressRow([24, 14], [36, 14], S, 6, 1.6, 2.2)
    if (det >= 1) for (let i = 1; i < 5; i++) { const a = -PI / 2 + (PI * i) / 5, x = 40 + cos(a) * 9, y = sin(a) * 9; const p = [[x, y], [x + cos(a) * 2.4, y + sin(a) * 2.4]]; const q = [[p[0][0] - sin(a) * 0.8, p[0][1] + cos(a) * 0.8], [p[1][0] - sin(a) * 0.8, p[1][1] + cos(a) * 0.8], [p[1][0] + sin(a) * 0.8, p[1][1] - cos(a) * 0.8], [p[0][0] + sin(a) * 0.8, p[0][1] - cos(a) * 0.8]]; castShadow([q], 1.4); paint(q, STONE(), 0.1); outline(q, 0.9, { noext: true }) }
    // aisles (lean-to), nave, transepts, chancel, apse
    plane([[-38, -15], [10, -15], [10, -8], [-38, -8]], N, k); plane([[-38, 15], [10, 15], [10, 8], [-38, 8]], S, k)
    plane([[24, -14], [36, -14], [36, -8], [24, -8]], N, k); plane([[24, 14], [36, 14], [36, 8], [24, 8]], S, k)
    gable(-38, -8, 17, 8, 'x', k)
    gable(17, -30, 31, 30, 'y', k)
    gable(17, -8, 40, 8, 'x', k)
    apse(40, 0, 8, 0, { kind: 'slate', sides: 10, noShadow: true })
    ln([-38, -8], [10, -8], 1.2, { taper: 0.3 }); ln([-38, 8], [10, 8], 1.2, { taper: 0.3 })
    ln([24, -8], [36, -8], 1.1, { taper: 0.3 }); ln([24, 8], [36, 8], 1.1, { taper: 0.3 })
    ln([17, -30], [17, 30], 0.8, { taper: 0.3 }); ln([31, -30], [31, 30], 0.8, { taper: 0.3 })
    outline(sil, 1.9, { noext: true })
    spire(24, 0, 7.5, 8, { kind: 'lead', h: 12 })
    // west towers
    for (const sy of [-1, 1]) { const sq = rect(-50, sy > 0 ? 3 : -15, -38, sy > 0 ? 15 : -3); const inner = crenBlock(sq, { h: 14, cren: false }); pinnacles(sq); void inner }
    // west front between the towers
    const wf = rect(-50, -3, -38, 3); castShadow([wf], 5); baseOf(wf, 'slate'); gable(-50, -3, -38, 3, 'x', k); outline(wf, 1.3, { noext: true })
  }
  /** 1: Romanesque church: tiled roofs, a westwork with two round stair turrets, a square crossing tower, round apse and apsidioles. */
  function cath1() {
    const k = TILE
    const sil = [[-44, -16], [18, -16], [18, -22], [30, -22], [30, -9], [40, -9]]
    const ap = oval(40, 0, 9, 9, 10, 0, -PI / 2, PI / 2)
    for (const p of ap) sil.push(p)
    sil.push([40, 9], [30, 9], [30, 22], [18, 22], [18, 16], [-44, 16])
    castShadow([sil], 6)
    baseOf(sil, 'tile')
    plane([[-44, -16], [18, -16], [18, -9], [-44, -9]], N, k); plane([[-44, 16], [18, 16], [18, 9], [-44, 9]], S, k)
    gable(-44, -9, 30, 9, 'x', k)
    gable(18, -22, 30, 22, 'y', Object.assign({ hip0: true, hip1: true }, k))
    gable(24, -9, 40, 9, 'x', k)
    apse(40, 0, 9, 0, { kind: 'tile', noShadow: true })
    ln([-44, -9], [18, -9], 1.2, { taper: 0.3 }); ln([-44, 9], [18, 9], 1.2, { taper: 0.3 })
    outline(sil, 1.9, { noext: true })
    apse(30, -16, 3.4, 0, { kind: 'tile', h: 1.5 }); apse(30, 16, 3.4, 0, { kind: 'tile', h: 1.5 })
    // crossing tower
    const ct = rect(18, -7, 30, 7); castShadow([ct], 9); baseOf(ct, 'tile'); pyramid(18, -7, 30, 7, k); outline(ct, 1.5, { noext: true })
    fillPoly(oval(24, 0, Math.max(0.5, K(1.1)), Math.max(0.5, K(1.1)), 6), INK)
    // westwork: a block with two round turrets
    const ww = rect(-50, -16, -44, 16); castShadow([ww], 8); baseOf(ww, 'tile'); gable(-50, -16, -44, 16, 'y', k); outline(ww, 1.5, { noext: true })
    roundTower(-47, -14, 3.6, { h: 9, roof: 'cone', kind: 'tile' }); roundTower(-47, 14, 3.6, { h: 9, roof: 'cone', kind: 'tile' })
  }
  /** 2: cathedral with a cloister on its south side, a chapter house and ranges round the garth. */
  function cath2() {
    const k = TILE, yN = -36, yS = -12 // the church runs along the top; nave between yN and yS
    // cloister and ranges first (lower), then the church over them
    hall(-46, -12, -36, 36, 'y', Object.assign({ hip1: true, h: 4 }, k))
    hall(-36, 26, 2, 36, 'x', Object.assign({ hip1: true, h: 4 }, k))
    cloister(-36, -12, 2, 26, 5, { kind: 'tile' })
    const ch = ngon(12, 12, 8, 8, true); castShadow([ch], 5); baseOf(ch, 'slate')
    for (let i = 0; i < 8; i++) { const a = -PI / 2 + PI / 8 + (TAU * (i + 0.5)) / 8; plane([ch[i], ch[(i + 1) % 8], [12, 12]], [cos(a), sin(a)], SLATE) }
    for (const p of ch) crease(p, [12, 12], 0.8)
    outline(ch, 1.4, { noext: true })
    const pas = rect(2, 9, 5, 15); castShadow([pas], 2); baseOf(pas, 'tile'); gable(2, 9, 5, 15, 'x', k); outline(pas, 1, { noext: true })
    // church
    const sil = [[-46, yN], [16, yN], [16, -46], [28, -46], [28, -30], [42, -30]]
    const ap = oval(42, -24, 7, 7, 8, 0, -PI / 2, PI / 2)
    for (const p of ap) sil.push(p)
    sil.push([42, -18], [28, -18], [28, 0], [16, 0], [16, yS], [-46, yS])
    castShadow([sil], 7)
    baseOf(sil, 'tile')
    buttressRow([-44, yN], [16, yN], N, 7, 1.5, 2.2)
    plane([[-46, yN], [16, yN], [16, yN + 6], [-46, yN + 6]], N, k); plane([[-46, yS], [16, yS], [16, yS - 6], [-46, yS - 6]], S, k)
    gable(-46, yN + 6, 22, yS - 6, 'x', k)
    gable(22, -46, 28, 0, 'y', k)
    gable(22, -30, 42, -18, 'x', k)
    apse(42, -24, 7, 0, { kind: 'tile', noShadow: true })
    ln([-46, yN + 6], [16, yN + 6], 1.2, { taper: 0.3 }); ln([-46, yS - 6], [16, yS - 6], 1.2, { taper: 0.3 })
    outline(sil, 1.9, { noext: true })
    spire(22, -24, 6, 8, { kind: 'lead', h: 10 })
    const tw = rect(-50, yN, -38, yN + 12); crenBlock(tw, { h: 13, cren: false }); pinnacles(tw)
  }
  /** 3: domed temple on a stepped platform: an octagonal drum under a great dome, four half-domes, a columned porch. */
  function cath3() {
    const pf = rect(-50, -40, 50, 40)
    castShadow([pf], 2.5)
    deck(pf, lighter(STONE(), 0.22))
    outline(pf, 1.5, { noext: true })
    if (det >= 1) { outline(rect(-47.5, -37.5, 47.5, 37.5), 0.7, { noext: true, flat: true }); outline(rect(-45, -35, 45, 35), 0.7, { noext: true, flat: true }) }
    const cy = -4
    // exedrae (half-domes) on the four sides of the drum
    for (const [a, x, y] of [[-PI / 2, 0, cy - 26], [PI, -26, cy], [0, 26, cy], [PI / 2, 0, cy + 26]]) {
      const half = fan(x, y, 10, a - PI / 2, a + PI / 2, { kind: 'lead', seams: 8 })
      castShadow([half], 4); fan(x, y, 10, a - PI / 2, a + PI / 2, { kind: 'lead', seams: 8 }); pl(half.slice(1), 1.3, { taper: 0.2 })
    }
    const drum = ngon(0, cy, 30, 8, true)
    castShadow([drum], 9); paint(drum, STONE(), 0.2); shadeBands(drum, 0, cy, 30, 3); outline(drum, 1.7, { noext: true })
    dome(0, cy, 25, { seams: 16 })
    // porch to the south, with a row of columns in front of it
    const po = rect(-20, 26, 20, 36); castShadow([po], 4); baseOf(po, 'tile'); gable(-20, 26, 20, 36, 'x', TILE); outline(po, 1.3, { noext: true })
    const cols = []; for (let i = 0; i < 6; i++) cols.push([-17.5 + i * 7, 38]); columns(cols, 1.3)
    steps([-20, 40], [20, 40], 0)
  }
  /** 4: ruined abbey: roofless cruciform church, pillar bases down the nave, grass over the floor, rubble at the breaks. */
  function cath4() {
    const t = 3
    const floor = [[-50, -14], [12, -14], [12, -30], [26, -30], [26, -14], [42, -14]]
    const ap = ngon(42, 0, 10, 10, false).filter((p) => p[0] >= 42 - 0.01); ap.sort((p, q) => p[1] - q[1])
    for (const p of ap) floor.push(p)
    floor.push([42, 14], [26, 14], [26, 30], [12, 30], [12, 14], [-50, 14])
    lawn(floor)
    if (det >= 1) { const fl = rect(-20, -8, 4, 8); deck(fl, lighter(STONE(), 0.25)); outline(fl, 0.5, { flat: true, noext: true }) }
    // standing walls
    const walls = [
      { c: [[-50, 14], [-50, -14], [-20, -14]], h: 6, clean1: false },
      { c: [[-8, -14], [12, -14], [12, -30]], h: 3 },
      { c: [[12, -30], [26, -30], [26, -22]], h: 7, clean0: true },
      { c: [[26, -14], [42, -14]], h: 3 },
      { c: ap.slice(0, 4), h: 5, clean0: false },
      { c: [[42, 14], [26, 14], [26, 30], [12, 30]], h: 3 },
      { c: [[12, 14], [-6, 14]], h: 2.5 },
      { c: [[-14, 14], [-34, 14]], h: 3 },
    ]
    for (const w of walls) ruinBand(w.c, t, { h: w.h, clean0: w.clean0, clean1: w.clean1 })
    // pillar bases down the nave arcade and round the apse
    const pil = []; for (let x = -44; x <= 6; x += 8) pil.push([x, -7], [x, 7])
    for (let i = 1; i < 5; i++) { const a = -PI / 2 + (PI * i) / 5; pil.push([42 + cos(a) * 5.5, sin(a) * 5.5]) }
    columns(pil, 1.5)
    rubble(-14, -14, 4, 3); rubble(34, 10, 4, 3); rubble(0, 20, 3, 2); rubble(-40, 0, 4, 3)
    bush(20, -4, 3.6); bush(-30, 6, 3); bush(8, 24, 2.6)
    if (det >= 1) { for (let i = 0; i < 12; i++) tuft(rr(-46, 40), rr(-12, 12), rr(0.9, 1.4)); flush(0.5) }
  }
  /** 5: small abbey: church with a crossing tower, a cloister with its ranges, kitchen and infirmary beyond. */
  function cath5() {
    const k = TILE
    // ranges and cloister
    hall(-50, -22, -40, 20, 'y', Object.assign({ hip1: true, h: 4 }, k))
    hall(14, -12, 28, 30, 'y', Object.assign({ hip1: true, h: 4 }, k))
    hall(-40, 20, 14, 32, 'x', Object.assign({ h: 4 }, k))
    hall(-30, 32, -16, 44, 'y', Object.assign({ hip1: true, h: 3.5 }, k)); if (det >= 1) chimney(-23, 40, 2.4)
    hall(30, 8, 46, 20, 'x', Object.assign({ hip1: true, h: 3 }, SHIN))
    cloister(-40, -22, 14, 20, 5.5, { kind: 'tile' })
    // church along the north
    const sil = [[-50, -40], [14, -40], [14, -50], [28, -50], [28, -37], [44, -37]]
    const ap = oval(44, -31, 6, 6, 8, 0, -PI / 2, PI / 2)
    for (const p of ap) sil.push(p)
    sil.push([44, -25], [28, -25], [28, -12], [14, -12], [14, -22], [-50, -22])
    castShadow([sil], 6)
    baseOf(sil, 'tile')
    gable(-50, -40, 21, -22, 'x', k)
    gable(21, -50, 28, -12, 'y', k)
    gable(21, -37, 44, -25, 'x', k)
    apse(44, -31, 6, 0, { kind: 'tile', noShadow: true })
    outline(sil, 1.8, { noext: true })
    const ct = rect(14, -38, 28, -24); castShadow([ct], 9); baseOf(ct, 'slate'); pyramid(14, -38, 28, -24, SLATE); outline(ct, 1.5, { noext: true })
    fillPoly(oval(21, -31, Math.max(0.5, K(1.1)), Math.max(0.5, K(1.1)), 6), INK)
    bush(38, 30, 3.4); bush(-44, 30, 3)
  }
  /** 6: classical temple: a stepped stylobate, a ring of columns round the cella under a tiled gable. */
  function cath6() {
    const sty = rect(-50, -24, 50, 24)
    castShadow([sty], 2.5)
    deck(sty, lighter(STONE(), 0.22))
    outline(sty, 1.5, { noext: true })
    if (det >= 1) { outline(rect(-48, -22, 48, 22), 0.7, { noext: true, flat: true }); outline(rect(-46, -20, 46, 20), 0.7, { noext: true, flat: true }) }
    const cella = rect(-40, -14, 40, 14)
    castShadow([cella], 6)
    baseOf(cella, 'tile')
    gable(-40, -14, 40, 14, 'x', TILE)
    outline(cella, 1.7, { noext: true })
    const cols = []
    for (let i = 0; i < 12; i++) { const x = -42 + (84 * i) / 11; cols.push([x, -17.3], [x, 17.3]) }
    for (let i = 1; i < 4; i++) { const y = -17.3 + (34.6 * i) / 4; cols.push([-42, y], [42, y]) }
    columns(cols, 1.6)
    if (det >= 1) { const alt = rect(-3, 19.5, 3, 22.5); castShadow([alt], 1.2); paint(alt, STONE(), 0.1); outline(alt, 0.9, { noext: true }) }
  }
  /** 7: great domed cathedral: a Greek cross under five lead domes, with four corner towers and an eastern apse. */
  function cath7() {
    const k = { kind: 'lead' }
    const X = 46, A = 17
    const sil = [[-X, -A], [-A, -A], [-A, -X], [A, -X], [A, -A], [X, -A]]
    const ap = oval(X, 0, 9, 9, 10, 0, -PI / 2, PI / 2)
    for (const p of ap) sil.push(p)
    sil.push([X, A], [A, A], [A, X], [-A, X], [-A, A], [-X, A])
    castShadow([sil], 7)
    baseOf(sil, 'lead')
    // barrel-vaulted arms: shallow gables in lead
    gable(-X, -A, X, A, 'x', k); gable(-A, -X, A, X, 'y', k)
    apse(X, 0, 9, 0, { kind: 'lead', noShadow: true })
    outline(sil, 1.9, { noext: true })
    // corner towers in the re-entrant angles
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const sq = rect(sx * A + (sx < 0 ? -13 : 0), sy * A + (sy < 0 ? -13 : 0), sx * A + (sx > 0 ? 13 : 0), sy * A + (sy > 0 ? 13 : 0))
      castShadow([sq], 10); paint(sq, STONE(), 0.25); outline(sq, 1.6, { noext: true })
      const b = bbox(sq); dome(( b[0] + b[2]) / 2, (b[1] + b[3]) / 2, 5.2, { seams: 8, lantern: 0 })
    }
    // the five domes: four on the arms, the great one on a drum in the middle
    for (const [x, y] of [[-32, 0], [32, 0], [0, -32], [0, 32]]) { const d0 = oval(x, y, 9.5, 9.5, 20); castShadow([d0], 4); paint(d0, STONE(), 0.2); loop(d0, 1.2); dome(x, y, 8.2, { seams: 10, lantern: 0.14 }) }
    const drum = oval(0, 0, 21, 21, 32, 0.003); castShadow([drum], 9); paint(drum, STONE(), 0.2); shadeBands(drum, 0, 0, 21, 3); loop(drum, 1.6)
    dome(0, 0, 18.5, { seams: 16 })
  }
  reg('ct-cathedral', 'Cathedral', 'ct-castle', [cath0, cath1, cath2, cath3, cath4, cath5, cath6, cath7], 0.5, 300)

  /* =====================================================================================================================
     GATEHOUSE (ct-gatehouse): default s = 75 px. The town wall runs along x through y = 0 (outside -y, inside +y) and is
     cut across x in [-44, 44]; the towers reach x = ±50 to hide the cut ends. 1 unit is about 0.54 ft; the passage is 22 wide.
     ===================================================================================================================== */
  const PW = 22 // passage width (about 12 ft)
  /** Passage floor between the towers, with its side walls; wall thickness wt each side of y = 0 (the town wall is about ±9). */
  function passageWalls(x0, x1, yOut, yIn, t, o) {
    o = o || {}
    const p = rect(-x1, yOut, x1, yIn)
    fillPoly(p, COL ? ROAD() : PAPER); if (COL) wash(p, mix(ROAD(), '#8a7048', 0.3), 0.3)
    for (const s2 of [-1, 1]) wallRun(rect(Math.min(s2 * x0, s2 * x1), yOut, Math.max(s2 * x0, s2 * x1), yIn), t, { h: o.h == null ? 5 : o.h, cren: o.cren })
  }
  /** Stub of town wall from |x| = a to 50, matching the wall's thickness (±hw), crenellated on the outside. */
  function wallStubs(a, hw, cren) {
    for (const s2 of [-1, 1]) { const p = s2 > 0 ? rect(a, -hw, 50, hw) : rect(-50, -hw, -a, hw); wallRun(p, hw * 2, { h: 6, cren: cren === false ? false : (i) => i !== 0 }) }
  }
  /** 0: twin round towers, the passage open between them, gates on the outer face. */
  function gate0() {
    passageWalls(PW / 2, 22, -11, 13, 11, { h: 6 })
    roundTower(-36, 0, 14, { h: 10 }); roundTower(36, 0, 14, { h: 10 })
    gateBar([-PW / 2, -5], [PW / 2, -5])
  }
  /** 1: twin square towers with a roofed block over the passage; the arch shows in both faces. */
  function gate1() {
    const blk = rect(-22, -10, 22, 14)
    castShadow([blk], 7); baseOf(blk, 'slate'); gable(-22, -10, 22, 14, 'x', SLATE); outline(blk, 1.5, { noext: true })
    archMark(0, -10, PW, -1); archMark(0, 14, PW * 0.9, 1)
    for (const s2 of [-1, 1]) { const sq = s2 > 0 ? rect(22, -14, 50, 14) : rect(-50, -14, -22, 14); crenBlock(sq, { h: 10 }) }
  }
  /** 2: barbican: twin towers on the wall, two arms running out to a smaller outer gate, the passage between. */
  function gate2() {
    road([[0, -52], [0, 14]], PW * 0.9)
    for (const s2 of [-1, 1]) wallRun(s2 > 0 ? rect(11, -46, 17, -4) : rect(-17, -46, -11, -4), 6, { h: 5, cren: (i) => (s2 > 0 ? i !== 3 : i !== 1) })
    passageWalls(PW / 2, 26, -10, 13, 15, { h: 6 })
    roundTower(-38, 0, 12, { h: 9 }); roundTower(38, 0, 12, { h: 9 })
    roundTower(-18, -44, 7.5, { h: 7 }); roundTower(18, -44, 7.5, { h: 7 })
    gateBar([-PW / 2, -4], [PW / 2, -4]); gateBar([-10, -40], [10, -40])
    if (det >= 1) plankBridge([0, -52], [0, -47], PW * 0.8)
  }
  /** 3: a single square gate tower with an arch, short lengths of town wall either side. */
  function gate3() {
    wallStubs(22, 9.5)
    const sq = rect(-22, -16, 22, 18)
    crenBlock(sq, { h: 11 })
    roundTower(-18, 14, 5.5, { h: 12, roof: 'cone', kind: 'slate' })
    archMark(0, -16, PW, -1); archMark(0, 18, PW * 0.9, 1)
  }
  /** 4: gate standing open, the road running through under the towers, the leaves swung back inside the town. */
  function gate4() {
    road([[0, -50], [0, 50]], PW * 1.1)
    passageWalls(PW / 2, 18, -10, 12, 7, { h: 5 })
    roundTower(-32, 0, 14, { h: 10 }); roundTower(32, 0, 14, { h: 10 })
    for (const s2 of [-1, 1]) { ln([s2 * PW / 2, 11], [s2 * (PW / 2 - 5), 20], 1.8, { taper: 0.15 }); ln([s2 * PW / 2, 11], [s2 * (PW / 2 - 5), 20], 0.6, { taper: 0.1, wob: 0 }) }
  }
  /** 5: ruined gatehouse: one tower mostly standing, the other a stump, the passage walls broken, rubble about. */
  function gate5() {
    for (const s2 of [-1, 1]) { const fl = oval(s2 * 36, 0, 14, 14, 20); paint(fl, lighter(STONE(), 0.2), 0, 0.5); loop(fl, 0.7, { flat: true }); if (det >= 1) stippleIn(fl, 0.5, K(0.5)) }
    const p = rect(-20, -11, 20, 13); fillPoly(p, COL ? ROAD() : PAPER)
    ruinBand([[-20, -11], [-11, -11], [-11, 13]], 5, { h: 3 }); ruinBand([[11, -11], [11, 4]], 5, { h: 3, clean0: true })
    ringPieces(-36, 0, 12, 4, [[-PI * 0.95, PI * 0.55]], { h: 7 })
    ringPieces(36, 0, 12, 4, [[PI * 0.15, PI * 0.6], [PI * 0.85, PI * 1.5]], { h: 3 })
    rubble(36, -3, 7, 5); rubble(14, 10, 5, 3); rubble(-24, 10, 4, 2)
    bush(-36, 4, 4); bush(30, 6, 3)
  }
  /** 6: water gate: a channel running through under a portcullis, towers on the quay either side. */
  function gate6() {
    const ch = rect(-10, -50, 10, 50)
    water([ch])
    if (det >= 1) ripples([[[-6, -50], [-6, 50]], [[0, -50], [0, 50]], [[6, -50], [6, 50]]], false)
    pl([[-10, -50], [-10, 50]], 0.8, { taper: 0, wob: 0.25 }); pl([[10, -50], [10, 50]], 0.8, { taper: 0, wob: 0.25 })
    for (const s2 of [-1, 1]) wallRun(s2 > 0 ? rect(10, -11, 22, 13) : rect(-22, -11, -10, 13), 12, { h: 6, cren: true })
    roundTower(-36, 0, 14, { h: 10 }); roundTower(36, 0, 14, { h: 10 })
    // portcullis across the channel
    ln([-10, -5], [10, -5], 1.6, { taper: 0.1, wob: 0.05 })
    if (det >= 1) { for (let x = -8; x <= 8; x += 4) sg(x, -8, x, -2); flush(0.6) }
  }
  /** 7: timber gate between two square palisade towers under shingle roofs, a plank walk over the gate. */
  function gate7() {
    for (const s2 of [-1, 1]) {
      const sq = s2 > 0 ? rect(22, -14, 50, 14) : rect(-50, -14, -22, 14)
      castShadow([sq], 10); baseOf(sq, 'shingle')
      const b = bbox(sq); pyramid(b[0], b[1], b[2], b[3], SHIN); outline(sq, 1.5, { noext: true })
    }
    const walk = rect(-22, -6, 22, 6)
    castShadow([walk], 6); paint(walk, WOOD(), 0.1)
    if (det >= 1) { const g = Math.max(K(2.2), 1.4); for (let x = -22 + g * 0.6; x < 22; x += g * rr(0.85, 1.2)) sg(x, -5.5, x + jt(0.2), 5.5); flush(0.45) }
    outline(walk, 1.4, { noext: true })
    if (det >= 1) { palisade([[-22, -6], [22, -6]], false); palisade([[-22, 6], [22, 6]], false) }
    archMark(0, -6, PW * 0.8, -1)
  }
  reg('ct-gatehouse', 'Gatehouse', 'ct-castle', [gate0, gate1, gate2, gate3, gate4, gate5, gate6, gate7], 1, 75)

  /* =====================================================================================================================
     WALL TOWER (ct-wall-tower): default s = 42 px. Sits on the town wall (along x through y = 0, outside -y), opaque and
     wider than the wall (about 31 units thick at this size). 1 unit is about 0.3 ft.
     ===================================================================================================================== */
  /** 0: round, crenellated. */
  function wt0() { roundTower(0, 0, 50, { h: 16 }); if (det >= 2) hatchDoor(8, 6, 9) }
  /** 1: square, crenellated. */
  function wt1() { crenBlock(rect(-45, -45, 45, 45), { h: 15 }); if (det >= 2) hatchDoor(8, 8, 9) }
  /** 2: D-shaped: round face outward (-y), flat back inside the town. */
  function wt2() {
    const pts = []
    const n = clamp(Math.round(48 * u * 0.9), 10, 40)
    for (let i = 0; i <= n; i++) { const a = PI + (PI * i) / n; pts.push([cos(a) * 48, sin(a) * 48]) }
    pts.push([48, 22], [-48, 22])
    castShadow([pts], 15); paint(pts, STONE(), 0.25)
    const pd = clamp(11, K(1.6), K(9)), big = det >= 1
    if (big) {
      const inner = offsetPoly(pts, -pd)
      deck(inner); innerShadow(inner, pd * 0.7); outline(inner, 0.8, { flat: true, noext: true, wob: 0.1 })
    } else { shadeBands(pts, 0, -8, 48, 3); shadeSide(pts) }
    outline(pts, 1.7, { noext: true, wob: 0.12 })
    if (big) merlons(pts, { maxDepth: pd * 0.85 })
  }
  /** 3: octagonal, crenellated. */
  function wt3() { crenBlock(ngon(0, 0, 50, 8, true), { h: 16 }) }
  /** 4: round under a conical slate roof. */
  function wt4() { roundTower(0, 0, 46, { h: 20, roof: 'cone', kind: 'slate', seams: 10 }) }
  /** 5: square under a hipped tile roof. */
  function wt5() {
    const sq = rect(-44, -44, 44, 44)
    castShadow([sq], 18); paint(sq, STONE(), 0.25); outline(sq, 1.8, { noext: true })
    pyramid(-38, -38, 38, 38, TILE); outline(rect(-38, -38, 38, 38), 1.3, { noext: true })
    fillPoly(oval(0, 0, Math.max(0.5, K(1.2)), Math.max(0.5, K(1.2)), 6), INK)
  }
  /** 6: corner bastion: an arrow-head platform pointing outward, parapet all round, a sentry turret in the middle. */
  function wt6() {
    const pts = [[0, -50], [34, -22], [40, 8], [40, 30], [-40, 30], [-40, 8], [-34, -22]]
    crenBlock(pts, { h: 14, pd: clamp(10, K(1.6), K(9)) })
    roundTower(0, 2, 10, { h: 9, roof: 'cone', kind: 'slate', seams: 6 })
  }
  /** 7: ruined stump: the floor and a broken ring of wall, rubble about. */
  function wt7() {
    const fl = oval(0, 0, 46, 46, 28, 0.01)
    paint(fl, lighter(STONE(), 0.2), 0, 0.5); loop(fl, 0.8, { flat: true })
    if (det >= 1) stippleIn(fl, 0.5, K(0.5))
    ringPieces(0, 0, 40, 12, [[PI * 0.55, PI * 1.55], [PI * 1.75, PI * 2.1]], { h: 10 })
    rubble(10, 14, 18, 5); rubble(-20, -10, 10, 3)
    if (det >= 1) { for (let i = 0; i < 6; i++) tuft(rr(-30, 30), rr(-25, 30), rr(2, 4)); flush(0.5) }
  }
  reg('ct-wall-tower', 'Wall tower', 'ct-castle', [wt0, wt1, wt2, wt3, wt4, wt5, wt6, wt7], 1.5, 42)
})(window.Atlas)
