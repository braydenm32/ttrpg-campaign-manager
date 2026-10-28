/* Dungeon doors and floor hatches, seen from directly above (view 'top'). Same hand as bm-props.js: tapered inked
   outlines that swell toward the lower right (light from the upper left), parallel hatching and stipple for shade,
   translucent washes over the same linework in colour mode. Everything is drawn in a 100-unit design space
   (100 units = s), so a piece reads from s=35 up to s=300: `det` drops small marks when small and adds grain, rivets
   and extra strokes when big.
   Doors sit in a dungeon wall: the wall runs along the x axis through y = 0 and the doorway spans x in [-50, 50]
   (one 5 ft square for a single door, two for the double door). The map renderer cuts the wall line across that
   span, so every door draws jambs at each end (about x = +-[40, 54], |y| <= 11) to hide the cut ends, and the
   leaf or bars fill the opening between them. Open leaves swing into +y. */
;(function (A) {
  'use strict'
  const PI = Math.PI, TAU = PI * 2, sin = Math.sin, cos = Math.cos, hypot = Math.hypot, abs = Math.abs, min = Math.min, max = Math.max
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
  let ctx, r, st, k, S, det, INK, PAPER, COL, T, P, lw
  const rr = (a, b) => a + r() * (b - a)
  const j = (a) => (r() - 0.5) * 2 * a
  const px = (b) => (b * lw) / k // nominal pen width b (about 1 px at s=90) in design units

  /* ---------- colour ---------- */
  const _rgb = {}
  const rgb = (h) => {
    let v = _rgb[h]
    if (!v) { let s = h.charAt(0) === '#' ? h.slice(1) : h; if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2]; v = _rgb[h] = [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)] }
    return v
  }
  const hx = (n) => (n < 16 ? '0' : '') + Math.round(clamp(n, 0, 255)).toString(16)
  const mix = (a, b, t) => { const p = rgb(a), q = rgb(b); return '#' + hx(p[0] + (q[0] - p[0]) * t) + hx(p[1] + (q[1] - p[1]) * t) + hx(p[2] + (q[2] - p[2]) * t) }
  const _pal = new WeakMap()
  function palette(t) {
    let p = _pal.get(t)
    if (p) return p
    const wood = mix(t.sand, t.roof, 0.46)
    p = {
      wood, woodL: mix(t.sand, t.roof, 0.26), woodD: mix(t.roof, '#3a2918', 0.42), woodX: mix(t.roof, '#2c1f12', 0.62),
      stone: t.rock, stoneL: mix(t.rock, '#ffffff', 0.32), stoneD: mix(t.rock, '#2a2824', 0.38),
      iron: mix(t.rock, '#1e1c1a', 0.62), ironL: mix(t.rock, '#1e1c1a', 0.4), brass: mix(t.sand, '#b8862a', 0.7), rust: mix(t.roof, '#8a4a22', 0.5),
      red: mix(t.roof, t.sand, 0.12), plum: mix(t.roof, '#4c3a5a', 0.55), ochre: mix(t.sand, '#c28a2c', 0.65),
      water: t.water, waterD: mix(t.water, '#2c4a52', 0.45), wet: mix(t.water, '#4a4a40', 0.6), bone: mix(t.snow, t.sand, 0.35),
      pit: '#2a1f16', shade: '#46301a',
    }
    _pal.set(t, p); return p
  }

  function begin(c, x, y, s, rg, style) {
    ctx = c; r = rg; st = style; S = s; k = s / 100
    det = s < 38 ? 0 : s < 75 ? 1 : s < 140 ? 2 : 3
    INK = st.ink; PAPER = st.paper; COL = st.mode === 'colour'; T = st.tint; P = palette(T)
    lw = st.line * clamp(0.66 + s / 190, 0.72, 2.1)
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.lineJoin = 'round'; ctx.lineCap = 'round'
  }
  const end = () => ctx.restore()

  /* ---------- geometry ---------- */
  /** Local frame: maps (u, v) along/across a rotated axis to design space. */
  const F = (cx, cy, ang) => { const c = cos(ang || 0), s = sin(ang || 0); return (u, v) => [cx + u * c - v * s, cy + u * s + v * c] }
  /** Quad for a thick bar between two points. */
  const bar = (a, b, wd) => { const d = hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = (-(b[1] - a[1]) / d) * wd / 2, ny = ((b[0] - a[0]) / d) * wd / 2; return [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]] }
  const rectP = (cx, cy, w, h, ang) => { const f = F(cx, cy, ang), a = w / 2, b = h / 2; return [f(-a, -b), f(a, -b), f(a, b), f(-a, b)] }
  const nSeg = (rad) => clamp(Math.round((TAU * rad * k) / 3.6), 10, 80)
  const ellP = (cx, cy, rx, ry, ang, n) => { n = n || nSeg(max(rx, ry || rx)); ry = ry == null ? rx : ry; const f = F(cx, cy, ang), o = []; for (let i = 0; i < n; i++) { const a = (i / n) * TAU; o.push(f(cos(a) * rx, sin(a) * ry)) } return o }
  /** Rounded rectangle. */
  function rrect(cx, cy, w, h, rad, ang, n) {
    const f = F(cx, cy, ang), a = w / 2, b = h / 2, o = []; rad = min(rad, a, b); n = n || (rad * k > 6 ? 5 : 3)
    const cs = [[a - rad, -b + rad, -PI / 2], [a - rad, b - rad, 0], [-a + rad, b - rad, PI / 2], [-a + rad, -b + rad, PI]]
    for (const [qx, qy, a0] of cs) for (let i = 0; i <= n; i++) { const t = a0 + (i / n) * (PI / 2); o.push(f(qx + cos(t) * rad, qy + sin(t) * rad)) }
    return o
  }
  const shift = (pts, dx, dy) => pts.map((p) => [p[0] + dx, p[1] + dy])
  const rot = (pts, cx, cy, a) => { const c = cos(a), s = sin(a); return pts.map((p) => [cx + (p[0] - cx) * c - (p[1] - cy) * s, cy + (p[0] - cx) * s + (p[1] - cy) * c]) }
  const jig = (pts, a) => pts.map((p) => [p[0] + j(a), p[1] + j(a)])
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
  const bbox = (pts) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const p of pts) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1] } return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 } }
  /** Catmull-Rom through points, as a dense polyline. */
  function cr(pts, closed, sub) {
    sub = sub || 4; const n = pts.length, out = [], m = closed ? n : n - 1
    for (let i = 0; i < m; i++) {
      const p0 = pts[closed ? (i - 1 + n) % n : max(0, i - 1)], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[closed ? (i + 2) % n : min(n - 1, i + 2)]
      for (let q = 0; q < sub; q++) {
        const t = q / sub, t2 = t * t, t3 = t2 * t
        out.push([0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)])
      }
    }
    if (!closed) out.push(pts[n - 1])
    return out
  }
  /** Lumpy rounded outline (stones, stains, rubble). irr = how lumpy. */
  function blob(cx, cy, rx, ry, ang, n, irr, sub) {
    const pts = [], ph = r() * TAU, f = F(cx, cy, ang)
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU, q = 1 + irr * (sin(a * 2 + ph) * 0.5 + sin(a * 3 + ph * 1.7) * 0.3 + j(0.55)); pts.push(f(cos(a) * rx * q, sin(a) * ry * q)) }
    return cr(pts, true, sub || 3)
  }

  /* ---------- path helpers ---------- */
  function sub(pts, dx, dy) { dx = dx || 0; dy = dy || 0; ctx.moveTo(pts[0][0] + dx, pts[0][1] + dy); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] + dx, pts[i][1] + dy); ctx.closePath() }
  const poly = (pts) => { ctx.beginPath(); sub(pts) }
  const clipTo = (pts) => { poly(pts); ctx.clip() }

  /* ---------- batched thin marks ---------- */
  const SG = [], DT = []
  const seg = (x0, y0, x1, y1) => { SG.push(x0, y0, x1, y1) }
  const flush = (w, col) => {
    if (!SG.length) return
    ctx.beginPath(); for (let i = 0; i < SG.length; i += 4) { ctx.moveTo(SG[i], SG[i + 1]); ctx.lineTo(SG[i + 2], SG[i + 3]) }
    ctx.lineWidth = px(w || 0.55); ctx.strokeStyle = col || INK; ctx.stroke(); SG.length = 0
  }
  const dot = (x, y, rad) => { DT.push(x, y, rad) }
  const flushDots = (col, mul) => {
    if (!DT.length) return
    ctx.beginPath(); for (let i = 0; i < DT.length; i += 3) { const q = DT[i + 2] * (mul || 1) / k * lw; ctx.moveTo(DT[i] + q, DT[i + 1]); ctx.arc(DT[i], DT[i + 1], q, 0, TAU) }
    ctx.fillStyle = col || INK; ctx.fill(); DT.length = 0
  }
  const solidDot = (x, y, rad, col) => { ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fillStyle = col || INK; ctx.fill() }

  /* ---------- inked lines ---------- */
  const wobAmp = () => (0.22 + S * 0.0026) / k
  /** Open hand-inked stroke: ribbon that tapers at both ends (taper 0 = even width). */
  function line(pts, w, o) {
    o = o || {}
    if (pts.length < 2) return
    const step = max(2.5, 6 / k), Q = densify(pts, false, step), n = Q.length, amp = wobAmp() * (o.wob == null ? 1 : o.wob)
    const Lp = [], Rp = [], base = px(w) * (o.wmul || 1), tp = o.taper == null ? 0.65 : o.taper
    let tot = 0; const acc = [0]
    for (let i = 1; i < n; i++) { tot += hypot(Q[i][0] - Q[i - 1][0], Q[i][1] - Q[i - 1][1]); acc.push(tot) }
    let nz = 0
    for (let i = 0; i < n; i++) {
      const a = Q[max(0, i - 1)], b = Q[min(n - 1, i + 1)], d = hypot(b[0] - a[0], b[1] - a[1]) || 1
      const nx = -(b[1] - a[1]) / d, ny = (b[0] - a[0]) / d, t = tot ? acc[i] / tot : 0
      nz = nz * 0.6 + j(0.6); const off = i === 0 || i === n - 1 ? 0 : nz * amp
      const hw = (base / 2) * (1 - tp + tp * sin(PI * t)) * (1 + j(0.07))
      const cx = Q[i][0] + nx * off, cy = Q[i][1] + ny * off
      Lp.push([cx + nx * hw, cy + ny * hw]); Rp.push([cx - nx * hw, cy - ny * hw])
    }
    ctx.beginPath(); ctx.moveTo(Lp[0][0], Lp[0][1]); for (let i = 1; i < n; i++) ctx.lineTo(Lp[i][0], Lp[i][1]); for (let i = n - 1; i >= 0; i--) ctx.lineTo(Rp[i][0], Rp[i][1]); ctx.closePath()
    ctx.fillStyle = o.col || INK; ctx.fill()
  }
  function densify(pts, closed, step) {
    const out = [], n = pts.length, m = closed ? n : n - 1
    for (let i = 0; i < m; i++) {
      const a = pts[i], b = pts[(i + 1) % n], d = hypot(b[0] - a[0], b[1] - a[1]), c = max(1, Math.round(d / step))
      for (let q = 0; q < c; q++) out.push([a[0] + ((b[0] - a[0]) * q) / c, a[1] + ((b[1] - a[1]) * q) / c])
    }
    if (!closed) out.push(pts[n - 1])
    return out
  }
  const SHD = [0.7071, 0.7071]
  /** Closed outline whose weight swells on the lower-right (shade) side and thins to the upper left (light). */
  function pen(pts, w, o) {
    o = o || {}
    const Q = densify(pts, true, max(2.5, 6.5 / k)), n = Q.length
    if (n < 3) return
    let area = 0; for (let i = 0; i < n; i++) { const a = Q[i], b = Q[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1] }
    const sg = area > 0 ? 1 : -1, en = []
    for (let i = 0; i < n; i++) { const a = Q[i], b = Q[(i + 1) % n], d = hypot(b[0] - a[0], b[1] - a[1]) || 1; en.push([((b[1] - a[1]) / d) * sg, (-(b[0] - a[0]) / d) * sg]) }
    const amp = wobAmp() * (o.wob == null ? 1 : o.wob), base = px(w) * (o.wmul || 1), Lo = [], Li = []
    const swell = o.swell == null ? 0.62 : o.swell
    let nz = 0
    for (let i = 0; i < n; i++) {
      const n1 = en[(i - 1 + n) % n], n2 = en[i]; let mx = n1[0] + n2[0], my = n1[1] + n2[1]; const d = hypot(mx, my) || 1; mx /= d; my /= d
      const mit = min(1.8, 1 / max(0.5, mx * n2[0] + my * n2[1]))
      nz = nz * 0.62 + j(0.6)
      const sh = o.flat ? 1 : 1 - swell * 0.5 + swell * 1.1 * (mx * SHD[0] + my * SHD[1] + 1) * 0.5
      const hw = (base / 2) * sh * (1 + nz * 0.18) * mit
      const cx = Q[i][0] + mx * nz * amp, cy = Q[i][1] + my * nz * amp
      Lo.push([cx + mx * hw, cy + my * hw]); Li.push([cx - mx * hw, cy - my * hw])
    }
    ctx.beginPath(); ctx.moveTo(Lo[0][0], Lo[0][1]); for (let i = 1; i < n; i++) ctx.lineTo(Lo[i][0], Lo[i][1]); ctx.closePath()
    ctx.moveTo(Li[0][0], Li[0][1]); for (let i = 1; i < n; i++) ctx.lineTo(Li[i][0], Li[i][1]); ctx.closePath()
    ctx.fillStyle = o.col || INK; ctx.fill('evenodd')
    if (pts.length <= 12 && det >= 1 && !o.noCorner) { // the pen pools a little at sharp corners
      ctx.beginPath()
      for (let i = 0; i < pts.length; i++) {
        const a = pts[(i - 1 + pts.length) % pts.length], b = pts[i], c = pts[(i + 1) % pts.length]
        const d1 = Math.atan2(b[1] - a[1], b[0] - a[0]), d2 = Math.atan2(c[1] - b[1], c[0] - b[0]); let da = abs(d2 - d1); if (da > PI) da = TAU - da
        if (da > 0.7) { const q = (base / 2) * 0.62 * (0.8 + r() * 0.5); ctx.moveTo(b[0] + q, b[1]); ctx.arc(b[0], b[1], q, 0, TAU) }
      }
      ctx.fillStyle = o.col || INK; ctx.fill()
    }
  }
  /** A straight hand-ruled line (nominal width w) with a small overshoot at each end. */
  const rule = (a, b, w, o) => { o = o || {}; const d = hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / d, uy = (b[1] - a[1]) / d, e = o.over == null ? 0.4 : o.over; line([[a[0] - ux * rr(0, e), a[1] - uy * rr(0, e)], [b[0] + ux * rr(0, e), b[1] + uy * rr(0, e)]], w, { taper: o.taper == null ? 0.45 : o.taper, wob: o.wob == null ? 0.7 : o.wob, col: o.col, wmul: o.wmul }) }

  /* ---------- fills, washes, shade ---------- */
  /** Translucent watercolour wash with slight mis-registration and a pooled edge (colour mode). */
  function tint(pts, col, a) {
    if (!COL || !col) return
    ctx.save(); ctx.fillStyle = col
    ctx.globalAlpha = a * 0.62; poly(pts); ctx.fill()
    ctx.translate(j(0.6) / k, j(0.6) / k); ctx.globalAlpha = a * 0.5; poly(pts); ctx.fill()
    ctx.restore()
    ctx.save(); ctx.globalAlpha = a * 0.32; ctx.strokeStyle = col; ctx.lineWidth = 1.5 / k; poly(pts); ctx.stroke(); ctx.restore()
  }
  /** Fill a region with a flat translucent tone (colour mode). */
  const tone = (pts, col, a) => { if (!COL) return; ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = col; poly(pts); ctx.fill(); ctx.restore() }
  function hatchBox(x0, y0, x1, y1, ang, gap, w, o) {
    o = o || {}
    const g = max(gap, (o.minG || 2.1) / k), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, L = hypot(x1 - x0, y1 - y0) / 2 + 1
    const dx = cos(ang), dy = sin(ang), nx = -dy, ny = dx
    ctx.beginPath()
    let t = -L, cnt = 0
    while (t < L && cnt++ < 500) {
      const e = j(L * 0.035), ox = cx + nx * t, oy = cy + ny * t
      ctx.moveTo(ox - dx * L, oy - dy * L); ctx.lineTo(ox + dx * L + nx * e, oy + dy * L + ny * e)
      t += g * (1 + j(0.22))
    }
    ctx.lineWidth = px(w || 0.5); ctx.strokeStyle = o.col || INK; ctx.stroke()
  }
  /** Hatch inside a polygon. */
  function hatchIn(pts, ang, gap, w, o) { const b = bbox(pts); ctx.save(); clipTo(pts); hatchBox(b.x0, b.y0, b.x1, b.y1, ang, gap, w, o); ctx.restore() }
  function stipIn(pts, n, size, col) {
    const b = bbox(pts); ctx.save(); clipTo(pts); ctx.beginPath()
    for (let i = 0; i < n; i++) { const q = size * rr(0.6, 1.3) / k * lw; const x = rr(b.x0, b.x1), y = rr(b.y0, b.y1); ctx.moveTo(x + q, y); ctx.arc(x, y, q, 0, TAU) }
    ctx.fillStyle = col || INK; ctx.fill(); ctx.restore()
  }
  /** Shade the lower-right crescent of a shape: hatching in ink, a darker wash in colour. d = crescent thickness. */
  function shadeIn(pts, d, o) {
    o = o || {}
    const b = bbox(pts), dd = d == null ? min(b.w, b.h) * 0.2 : d
    ctx.save(); clipTo(pts)
    ctx.beginPath(); ctx.rect(b.x0 - 4, b.y0 - 4, b.w + 8, b.h + 8); sub(pts, -dd * 0.78 * (o.rev ? -1 : 1), -dd * 0.78 * (o.rev ? -1 : 1)); ctx.clip('evenodd')
    if (COL) { ctx.fillStyle = o.col || 'rgba(70,45,25,0.2)'; ctx.globalAlpha = o.col ? 0.3 : 1; ctx.fillRect(b.x0 - 4, b.y0 - 4, b.w + 8, b.h + 8) }
    if (!COL || o.inkToo) hatchBox(b.x0 - 4, b.y0 - 4, b.x1 + 4, b.y1 + 4, o.ang == null ? -0.79 : o.ang, o.gap || 2.3, o.w || 0.5)
    ctx.restore()
    if (!COL && det >= 2 && o.cross !== false && !o.rev && dd * k > 7) { // the deepest shade, cross-hatched
      ctx.save(); clipTo(pts); ctx.beginPath(); ctx.rect(b.x0 - 4, b.y0 - 4, b.w + 8, b.h + 8); sub(pts, -dd * 0.36, -dd * 0.36); ctx.clip('evenodd')
      hatchBox(b.x0 - 4, b.y0 - 4, b.x1 + 4, b.y1 + 4, (o.ang == null ? -0.79 : o.ang) + 1.25, (o.gap || 2.3) * 1.25, (o.w || 0.5) * 0.9)
      ctx.restore()
    }
  }
  /** Cast shadow: the shape swept down-right by h design units. Hatched in ink, a dark wash in colour. */
  function shadow(pts, h) {
    if (!st.shadows) return
    const dx = h * 0.66, dy = h * 0.8
    ctx.save(); ctx.beginPath(); for (let t = 0; t <= 1.001; t += 0.5) sub(pts, dx * t, dy * t)
    if (COL) { ctx.fillStyle = 'rgba(40,30,15,0.25)'; ctx.fill() } else {
      ctx.clip(); const b = bbox(pts); hatchBox(b.x0, b.y0, b.x1 + dx, b.y1 + dy, -0.62, 2.3, 0.5)
    }
    ctx.restore()
  }
  /** The standard solid object: shadow, opaque paper, wash, shade crescent, inked outline. */
  function obj(pts, o) {
    o = o || {}
    if (o.h) shadow(pts, o.h)
    poly(pts); ctx.fillStyle = PAPER; ctx.fill()
    if (COL && o.col) tint(pts, o.col, o.a || 0.62)
    if (o.shade !== 0 && det >= 1) shadeIn(pts, o.sd, o)
    if (o.line !== 0) pen(pts, o.line || 1.4, { wob: o.wob, swell: o.swell, flat: o.flat, wmul: o.wmul })
  }

  /* ---------- small marks ---------- */
  const nail = (x, y) => dot(x, y, 0.55)
  /** Planks laid across a rectangle (planks run along u). Draws each plank as its own inked, tinted piece. */
  function plankRect(cx, cy, w, h, ang, o) {
    o = o || {}
    const f = F(cx, cy, ang), pw = o.pw || 12, n = max(1, o.n || Math.round(h / pw)), cols = o.cols || [P.wood, P.woodL, P.woodD]
    const g = o.gap == null ? 0.5 : o.gap, grains = o.grain == null ? det >= 2 : o.grain
    const ws = []
    for (let i = 0; i < n; i++) {
      const v0 = -h / 2 + (i * h) / n, v1 = v0 + h / n, e0 = o.stag ? rr(0, o.stag) : 0, e1 = o.stag ? rr(0, o.stag) : 0
      const pl = [f(-w / 2 + e0, v0 + g), f(w / 2 - e1, v0 + g), f(w / 2 - e1, v1 - g), f(-w / 2 + e0, v1 - g)]
      ws.push(pl)
      poly(pl); ctx.fillStyle = PAPER; ctx.fill()
      if (COL) tone(pl, cols[(i * 7 + (o.seed || 0)) % cols.length], 0.5)
    }
    ctx.beginPath()
    for (let i = 0; i < n; i++) { const p = ws[i]; ctx.moveTo(p[0][0], p[0][1]); ctx.lineTo(p[1][0], p[1][1]); ctx.lineTo(p[2][0], p[2][1]); ctx.lineTo(p[3][0], p[3][1]); ctx.closePath() }
    ctx.lineWidth = px(o.sw || 0.75); ctx.strokeStyle = INK; ctx.stroke()
    if (grains && h / n > 5 && w > 10) {
      ctx.beginPath()
      const ng = det >= 3 ? 3 : 2
      for (let i = 0; i < n; i++) {
        const v0 = -h / 2 + (i * h) / n, v1 = v0 + h / n
        for (let q = 0; q < ng; q++) {
          const v = v0 + ((q + 0.5 + j(0.2)) / ng) * (v1 - v0), a = -w / 2 + rr(2, w * 0.25), b2 = w / 2 - rr(2, w * 0.3); let first = true
          for (let u = a; u < b2; u += 4) { const p = f(u, v + Math.sin(u * 0.17 + i * 1.7 + q) * 0.55); if (first) { ctx.moveTo(p[0], p[1]); first = false } else ctx.lineTo(p[0], p[1]) }
        }
      }
      ctx.lineWidth = px(0.4); ctx.strokeStyle = INK; ctx.globalAlpha = 0.7; ctx.stroke(); ctx.globalAlpha = 1
      for (let i = 0; i < n; i++) {
        const v0 = -h / 2 + (i * h) / n, v1 = v0 + h / n
        if (r() < (det >= 3 ? 0.4 : 0.25) && v1 - v0 > 7) { const kc = f(rr(-w * 0.3, w * 0.3), (v0 + v1) / 2 + j(1)), ke = ellP(kc[0], kc[1], 2.6, 1.6, ang, 8); pen(ke, 0.6, { flat: true, wob: 0.3 }); pen(ellP(kc[0], kc[1], 1.1, 0.6, ang, 6), 0.45, { flat: true, wob: 0.2, noCorner: true }) }
        if (!COL && i % 2 === 1 && det >= 2) { ctx.save(); clipTo(ws[i]); hatchBox(cx - w, cy - w, cx + w, cy + w, ang + 0.03, 3.4, 0.3, { minG: 2.6 }); ctx.restore() }
      }
    }
    if (o.nails !== false && det >= 2) for (let i = 0; i < n; i++) { const v = -h / 2 + ((i + 0.5) * h) / n; nail(...f(-w / 2 + 2.6, v)); nail(...f(w / 2 - 2.6, v)) }
    flushDots()
    return ws
  }

  /* ---------- registration ---------- */
  function reg(name, label, category, kind, fns) {
    A.register(name, {
      label, category, kind, view: 'top', variants: kind === 'fixed' ? 8 : 1,
      draw(c, x, y, s, rg, style, v) {
        begin(c, x, y, s, rg, style)
        try { fns[kind === 'fixed' ? (((v | 0) % fns.length) + fns.length) % fns.length : 0]() } finally { SG.length = 0; DT.length = 0; end() }
      },
    })
  }

  /* =====================================================================================================
     Shared door parts
     ===================================================================================================== */
  /** Dark opening, pit or gap: paper, a deep wash in colour, dense hatching in ink, deeper toward the upper left. */
  function pit(pts, o) {
    o = o || {}
    poly(pts); ctx.fillStyle = PAPER; ctx.fill()
    if (COL) tint(pts, o.col || P.pit, o.a == null ? 0.8 : o.a)
    ctx.save(); clipTo(pts); const b = bbox(pts)
    if (!COL) { hatchBox(b.x0, b.y0, b.x1, b.y1, o.ang == null ? -0.79 : o.ang, o.gap || 2.2, 0.5); if (det >= 1) hatchBox(b.x0, b.y0, b.x1, b.y1, (o.ang == null ? -0.79 : o.ang) + 1.3, (o.gap || 2.2) * 1.4, 0.4) }
    if (det >= 1 && o.d !== 0) shadeIn(pts, o.d || min(b.w, b.h) * 0.25, { rev: true, col: 'rgba(0,0,0,0.45)', inkToo: true, gap: 1.6 })
    ctx.restore()
    if (o.line !== 0) pen(pts, o.line || 1.1, { swell: -0.5, wob: o.wob })
  }
  /** Stone jamb block at one end of a doorway: a solid block a little wider than the wall. sg = -1 left, +1 right. */
  function jambStone(sg, o) {
    o = o || {}
    const w = o.w || 14, h = o.h || 22, cx = sg * (o.x || 47), p = jig(rectP(cx, o.y || 0, w, h, 0), 0.3)
    obj(p, { h: o.sh == null ? 3.5 : o.sh, col: o.col || P.stone, a: 0.7, sd: min(w, h) * 0.28, line: o.line || 1.35, wob: 1.1 })
    if (det >= 2 && o.plain !== true) { // a joint across the block and a few pits in the stone
      rule([cx - w / 2 + 1.5, (o.y || 0) + j(2)], [cx + w / 2 - 1.5, (o.y || 0) + j(2)], 0.55, { over: 0, taper: 0.5 })
      stipIn(p, det >= 3 ? 9 : 5, 0.42)
    }
    return p
  }
  /** Timber post jamb: a squared beam end with grain along y. */
  function jambPost(sg, o) {
    o = o || {}
    const w = o.w || 11, h = o.h || 22, cx = sg * (o.x || 46), p = jig(rectP(cx, 0, w, h, 0), 0.25)
    obj(p, { h: 3.5, col: o.col || P.woodD, a: 0.72, sd: w * 0.3, line: 1.3 })
    if (det >= 2) { for (let i = 0; i < 3; i++) { const u = cx + j(w * 0.3); seg(u, rr(-h * 0.45, -h * 0.1), u + j(0.6), rr(0.1, h * 0.45)) } flush(0.4) }
    if (det >= 1) { nail(cx, -h * 0.3); nail(cx, h * 0.3); flushDots() }
    return p
  }
  /** Both jambs of a doorway. kind: 'stone' | 'post'. */
  function jambs(kind, o) { for (const sg of [-1, 1]) (kind === 'post' ? jambPost : jambStone)(sg, o) }
  /** A dotted swing arc: the path the free edge of a leaf sweeps, centred on the hinge. */
  function swingArc(cx, cy, R, a0, a1) {
    const stepA = (det >= 2 ? 4.2 : 6.5) / R, n = Math.max(3, Math.round(abs(a1 - a0) / stepA)), d = a1 > a0 ? 1 : -1
    for (let i = 1; i < n; i++) { const a = a0 + d * (abs(a1 - a0) * i) / n; dot(cx + cos(a) * R + j(0.25), cy + sin(a) * R + j(0.25), 0.52) }
    flushDots(INK)
  }
  /** Iron strap along a leaf's u axis with rivets. f = leaf frame, u0..u1 along, v across, th strap width. */
  function strap(f, u0, u1, v, th, o) {
    o = o || {}
    const p = [f(u0, v - th / 2), f(u1, v - th / 2), f(u1, v + th / 2), f(u0, v + th / 2)]
    poly(p); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tone(p, o.col || P.iron, 0.62); else if (det >= 2 && th >= 3.6) hatchIn(p, 0.0, 2.4, 0.35, { minG: 2 })
    pen(p, 0.75, { flat: true, wob: 0.4 })
    if (det >= 2 || th >= 3.6) { const n = max(2, Math.round((u1 - u0) / (o.gap || 9))); for (let i = 0; i < n; i++) nail(...f(u0 + ((i + 0.5) * (u1 - u0)) / n, v)); flushDots() }
  }
  /** Ring pull: an iron ring on a staple at (x, y). */
  function ringPull(x, y, R, o) {
    o = o || {}
    const c = ellP(x, y, R, R, 0, 10)
    ctx.beginPath(); sub(c); ctx.lineWidth = px(o.w || 1.3); ctx.strokeStyle = INK; ctx.stroke()
    if (COL) { ctx.beginPath(); sub(c); ctx.lineWidth = px((o.w || 1.3) * 0.55); ctx.strokeStyle = P.iron; ctx.stroke() }
    solidDot(x + (o.sx || 0), y - R + (o.sy || 0), max(0.7, px(0.55)), INK)
  }
  /**
   * A door leaf hanging from a hinge pin at (hx, hy), reaching length L along `ang`, with its thickness on the
   * `side` of that axis (+1 = +v, -1 = -v). style: 'plank' | 'banded' | 'studded' | 'window' | 'warped' | 'bars' | 'carved'.
   */
  function leaf(hx, hy, ang, L, th, side, o) {
    o = o || {}
    const f = F(hx, hy, ang), v0 = side < 0 ? -th : 0, v1 = v0 + th, vm = (v0 + v1) / 2, warp = o.style === 'warped'
    let body = [f(0, v0), f(L, v0), f(L, v1), f(0, v1)]
    if (warp) { body = cr([f(0, v0), f(L * 0.5, v0 - th * 0.12), f(L, v0 + th * 0.08), f(L - th * 0.1, vm), f(L, v1), f(L * 0.5, v1 + th * 0.1), f(0, v1)], true, 3) }
    const broken = o.broken // 0..1: where along u the leaf is snapped off
    if (broken) {
      const bu = L * broken, teeth = [], n = det >= 1 ? 5 : 3
      for (let i = 0; i <= n; i++) teeth.push(f(bu + (i % 2 ? rr(2, 5) : rr(-4, -1)), v0 + (th * i) / n))
      body = [f(0, v0), ...teeth, f(0, v1)]
    }
    shadow(body, o.h == null ? 2.5 : o.h)
    poly(body); ctx.fillStyle = PAPER; ctx.fill()
    const uEnd = broken ? L * broken : L
    ctx.save(); clipTo(body)
    if (o.style === 'bars') {
      // an iron gate leaf: frame rails along u, bars across
      if (COL) tone(body, P.stoneL, 0.25)
      const n = max(3, Math.round(uEnd / (o.gap || 7.5)))
      for (let i = 1; i < n; i++) { const u = (uEnd * i) / n; const bq = [f(u - 1.1, v0), f(u + 1.1, v0), f(u + 1.1, v1), f(u - 1.1, v1)]; poly(bq); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tone(bq, P.iron, 0.7); pen(bq, 0.7, { flat: true, wob: 0.3, noCorner: true }) }
      strap(f, 0, uEnd, v0 + th * 0.2, th * 0.22, { gap: 12 }); strap(f, 0, uEnd, v1 - th * 0.2, th * 0.22, { gap: 12 })
    } else {
      const pw = o.pw || (det >= 2 ? 9 : 11)
      plankRect(...f(uEnd / 2, vm), th + 2, uEnd + 2, ang + PI / 2, { pw, nails: false, grain: false, seed: o.seed || 0, stag: warp ? 1.2 : 0, cols: o.cols })
      if (o.style === 'carved' && det >= 1) { // a carved panel: a border line and a lozenge in each half
        const bp = [f(4, v0 + th * 0.22), f(uEnd - 4, v0 + th * 0.22), f(uEnd - 4, v1 - th * 0.22), f(4, v1 - th * 0.22)]; pen(bp, 0.55, { flat: true, wob: 0.3 })
        for (const uq of [uEnd * 0.3, uEnd * 0.7]) { const d = [f(uq - th * 0.45, vm), f(uq, v0 + th * 0.3), f(uq + th * 0.45, vm), f(uq, v1 - th * 0.3)]; poly(d); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tone(d, P.woodD, 0.45); pen(d, 0.6, { flat: true, wob: 0.3 }) }
      }
      if (o.style === 'banded') {
        strap(f, 1, uEnd - 1, v0 + th * 0.27, th * 0.17, { gap: det >= 2 ? 9 : 14 })
        strap(f, 1, uEnd - 1, v1 - th * 0.27, th * 0.17, { gap: det >= 2 ? 9 : 14 })
      }
      if (o.style === 'studded' && det >= 1) { const g = det >= 3 ? 6 : 8; for (let u = 5; u < uEnd - 3; u += g) { nail(...f(u, v0 + th * 0.25)); nail(...f(u, v1 - th * 0.25)); if (det >= 2 && u + g / 2 < uEnd - 3) nail(...f(u + g / 2, vm)) } flushDots(null, 1.15) }
      if (o.style === 'window') {
        const wu = uEnd * 0.5, ww = min(16, uEnd * 0.2), wh = th * 0.5
        const wp = [f(wu - ww / 2, vm - wh / 2), f(wu + ww / 2, vm - wh / 2), f(wu + ww / 2, vm + wh / 2), f(wu - ww / 2, vm + wh / 2)]
        pit(wp, { d: 0, line: 0.8 })
        if (det >= 1) { for (let i = 1; i < 4; i++) { const u = wu - ww / 2 + (ww * i) / 4; seg(...f(u, vm - wh / 2), ...f(u, vm + wh / 2)) } flush(0.7) }
      }
      if (warp) { // a dark gap where the leaf has shrunk from the latch jamb, and a split along one seam
        const gp = [f(L - 3.5, v0 + th * 0.15), f(L + 0.5, v0 + th * 0.1), f(L + 0.5, v1 - th * 0.1), f(L - 2, v1 - th * 0.2)]
        pit(gp, { d: 0, line: 0.7 })
        if (det >= 1) line([f(L * 0.35, v0 + 0.5), f(L * 0.38, vm), f(L * 0.34, v1 - 0.5)], 0.7, { taper: 0.4, wob: 1.2 })
      }
    }
    ctx.restore()
    if (det >= 1 && o.style !== 'bars') shadeIn(body, th * 0.28, { gap: 2.1, cross: false })
    pen(body, o.line || 1.3, { wob: warp ? 1.6 : 0.9 })
    // hinge knuckles at the pin end, a handle at the free end
    if (det >= 1) { nail(...f(2.2, v0 + th * 0.25)); nail(...f(2.2, v1 - th * 0.25)); flushDots(null, 1.3) }
    if (!broken && o.handle !== false) {
      const hp = f(L - th * 0.6, vm)
      if (o.style === 'bars') { const pl = [f(L - th * 0.95, vm - th * 0.18), f(L - th * 0.25, vm - th * 0.18), f(L - th * 0.25, vm + th * 0.18), f(L - th * 0.95, vm + th * 0.18)]; poly(pl); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tone(pl, P.iron, 0.7); pen(pl, 0.7, { flat: true }) }
      else if (det >= 1) ringPull(hp[0], hp[1], min(2.6, th * 0.22), { w: 1.1 })
      else solidDot(hp[0], hp[1], 1.1, INK)
    }
    return { body, f }
  }
  /** Splinters and a snapped plank or two lying on the floor near (x, y). */
  function splinters(x, y, n, spread) {
    for (let i = 0; i < n; i++) {
      const a = rr(0, PI), l = rr(3, 8), cx = x + j(spread), cy = y + j(spread), p = [[cx - cos(a) * l / 2, cy - sin(a) * l / 2], [cx + cos(a) * l / 2 + j(0.5), cy + sin(a) * l / 2 - 1], [cx + cos(a) * l / 2, cy + sin(a) * l / 2 + 1]]
      obj(p, { h: 1, col: P.woodL, a: 0.7, shade: 0, line: 0.7 })
    }
  }

  /* =====================================================================================================
     Door (single, one square wide)
     ===================================================================================================== */
  const TH = 12, DL = 80 // single leaf thickness and length (hinge to latch)
  const doors = [
    // 0: plain plank door, closed
    () => { jambs('stone'); leaf(-40, TH / 2, 0, DL, TH, -1, { style: 'plank', seed: 0 }) },
    // 1: iron-banded door
    () => { jambs('stone'); leaf(-40, TH / 2, 0, DL, TH, -1, { style: 'banded', seed: 1 }) },
    // 2: studded heavy oak
    () => { jambs('stone', { w: 15 }); leaf(-40, TH / 2 + 0.5, 0, DL, TH + 1, -1, { style: 'studded', seed: 2, cols: [P.woodD, P.wood, P.woodD], line: 1.45 }) },
    // 3: swung fully open, lying along +y against the wall, swing arc
    () => { jambs('stone'); swingArc(-40, TH / 2, DL, 0, PI / 2); leaf(-40, TH / 2, PI / 2, DL, TH, -1, { style: 'plank', seed: 3, h: 3 }) },
    // 4: half open (~40 degrees)
    () => { jambs('stone'); swingArc(-40, TH / 2, DL, 0, 0.7); leaf(-40, TH / 2, 0.7, DL, TH, -1, { style: 'banded', seed: 4, h: 3 }) },
    // 5: broken, hanging off one hinge, splinters on the floor
    () => {
      jambs('stone')
      splinters(10, 26, det >= 1 ? 7 : 3, 16); splinters(-8, 50, det >= 1 ? 4 : 2, 10)
      const frag = rot([[0, 0], [26, -2], [30, 4], [29, 9], [3, 11]], 0, 0, 0.9); obj(shift(frag, 18, 40), { h: 2, col: P.wood, a: 0.65, sd: 3, line: 1 })
      if (det >= 1) { const g = F(18, 40, 0.9); seg(...g(8, 2), ...g(22, 2.5)); seg(...g(6, 7), ...g(24, 7.5)); flush(0.5) }
      leaf(-40, TH / 2, 1.15, DL, TH, -1, { style: 'plank', seed: 5, broken: 0.62, h: 3 })
    },
    // 6: door with a small barred window
    () => { jambs('stone'); leaf(-40, TH / 2, 0, DL, TH, -1, { style: 'window', seed: 6 }) },
    // 7: old warped door with a gap
    () => { jambs('post'); leaf(-40, TH / 2, 0, DL - 2, TH - 1, -1, { style: 'warped', seed: 7, cols: [P.woodL, P.wood, P.woodL] }) },
  ]
  reg('dg-door', 'Door', 'dg-doors', 'fixed', doors)

  /* =====================================================================================================
     Double door (two squares wide: x in [-50, 50] spans both)
     ===================================================================================================== */
  const DT2 = 8, DL2 = 45, DJ = { x: 48.5, w: 7, h: 20 }
  const dLeft = (ang, o) => leaf(-45, DT2 / 2, ang, DL2, DT2, -1, Object.assign({ pw: det >= 2 ? 5.5 : 7 }, o))
  const dRight = (ang, o) => leaf(45, DT2 / 2, ang, DL2, DT2, 1, Object.assign({ pw: det >= 2 ? 5.5 : 7 }, o))
  const doubles = [
    // 0: both closed
    () => { jambs('stone', DJ); dLeft(0, { style: 'plank', seed: 0 }); dRight(PI, { style: 'plank', seed: 1 }) },
    // 1: both open, swing arcs
    () => { jambs('stone', DJ); swingArc(-45, DT2 / 2, DL2, 0, PI / 2); swingArc(45, DT2 / 2, DL2, PI, PI / 2); dLeft(PI / 2, { style: 'plank', seed: 2, h: 3 }); dRight(PI / 2, { style: 'plank', seed: 3, h: 3 }) },
    // 2: one open
    () => { jambs('stone', DJ); swingArc(45, DT2 / 2, DL2, PI, PI / 2); dLeft(0, { style: 'banded', seed: 4 }); dRight(PI / 2, { style: 'banded', seed: 5, h: 3 }) },
    // 3: grand carved doors
    () => { jambs('stone', Object.assign({}, DJ, { w: 8, h: 22, col: P.stoneL })); dLeft(0, { style: 'carved', seed: 6, cols: [P.woodD, P.woodD, P.wood], pw: 45, line: 1.4 }); dRight(PI, { style: 'carved', seed: 7, cols: [P.woodD, P.woodD, P.wood], pw: 45, line: 1.4 }) },
    // 4: iron-bound
    () => { jambs('stone', DJ); dLeft(0, { style: 'banded', seed: 8 }); dRight(PI, { style: 'banded', seed: 9 }) },
    // 5: barred: a timber beam across both leaves in its brackets
    () => {
      jambs('stone', DJ); dLeft(0, { style: 'plank', seed: 10, handle: false }); dRight(PI, { style: 'plank', seed: 11, handle: false })
      for (const x of [-30, 30]) { const br = rectP(x, 0, 4.5, DT2 + 3, 0); obj(br, { col: P.iron, a: 0.7, shade: 0, line: 0.8 }) }
      const bm = rectP(0, 0, 76, 4.2, 0.01); obj(bm, { h: 2.5, col: P.woodD, a: 0.75, sd: 1.4, line: 1.1 })
      if (det >= 2) { seg(-34, -0.6, -4, -0.4); seg(2, 0.8, 32, 0.6); flush(0.4) }
    },
    // 6: one broken off its hinges, the other closed
    () => {
      jambs('stone', DJ); dLeft(0, { style: 'plank', seed: 12 })
      splinters(28, 18, det >= 1 ? 6 : 3, 12)
      const frag = rot([[0, 0], [16, -1], [18, 3], [17, 6], [2, 6.5]], 0, 0, -0.5); obj(shift(frag, 6, 30), { h: 2, col: P.wood, a: 0.65, sd: 2, line: 0.9 })
      dRight(PI - 1.0, { style: 'plank', seed: 13, broken: 0.58, h: 3 })
    },
    // 7: studded
    () => { jambs('stone', DJ); dLeft(0, { style: 'studded', seed: 14, cols: [P.woodD, P.wood, P.woodD] }); dRight(PI, { style: 'studded', seed: 15, cols: [P.woodD, P.wood, P.woodD] }) },
  ]
  reg('dg-double-door', 'Double door', 'dg-doors', 'fixed', doubles)

  /* =====================================================================================================
     Portcullis and iron gates (single square)
     ===================================================================================================== */
  /** Lattice of iron bars across the opening: uprights every `gap`, two rails, square heads at the crossings. */
  function lattice(x0, x1, th, o) {
    o = o || {}
    const body = [[x0, -th / 2], [x1, -th / 2], [x1, th / 2], [x0, th / 2]]
    shadow(body, 2)
    poly(body); ctx.fillStyle = PAPER; ctx.fill()
    if (COL) tone(body, P.stoneL, 0.22); else if (det >= 1) hatchIn(body, -0.79, 2.6, 0.35, { minG: 2 })
    const gap = o.gap || 8, n = Math.round((x1 - x0) / gap), skip = o.skip || [], rails = [-th * 0.28, th * 0.28]
    const ironQ = (p) => { poly(p); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tone(p, o.rust ? P.rust : P.iron, 0.72); pen(p, 0.75, { flat: true, wob: 0.3, noCorner: true }) }
    for (const v of rails) ironQ([[x0, v - 1.1], [x1, v - 1.1], [x1, v + 1.1], [x0, v + 1.1]])
    const xs = []
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n
      if (skip.includes(i)) { if (o.stubs) { ironQ([[x - 1.1, -th / 2], [x + 1.1, -th / 2], [x + 1.4, -th / 2 + rr(2, 3.5)], [x - 1.3, -th / 2 + rr(1.5, 3)]]); ironQ([[x - 1.2, th / 2 - rr(1.5, 3)], [x + 1.3, th / 2 - rr(2, 3.5)], [x + 1.1, th / 2], [x - 1.1, th / 2]]) } continue }
      if (o.bend && o.bend.includes(i)) { // bowed sideways in the middle
        const d = (i < n / 2 ? -1 : 1) * 3.2, pts = []; for (let q = 0; q <= 6; q++) { const t = q / 6; pts.push([x + d * sin(PI * t), -th / 2 + th * t]) }
        line(pts, 2.2, { taper: 0.1, wob: 0.3 }); if (COL) line(pts, 1.2, { taper: 0.1, wob: 0.2, col: P.iron })
        continue
      }
      xs.push(x); ironQ([[x - 1.1, -th / 2], [x + 1.1, -th / 2], [x + 1.1, th / 2], [x - 1.1, th / 2]])
    }
    if (det >= 1) for (const x of xs) for (const v of rails) { const q = rectP(x, v, 2.9, 2.9, 0); poly(q); ctx.fillStyle = COL ? P.iron : INK; ctx.fill(); if (COL) { ctx.lineWidth = px(0.5); ctx.strokeStyle = INK; ctx.stroke() } }
    if (o.rust && det >= 1) { ctx.save(); clipTo(body); for (let i = 0; i < 6; i++) tint(blob(rr(x0, x1), rr(-th / 2, th / 2), rr(3, 6), rr(2, 4), 0, 7, 0.2, 2), P.rust, 0.45); ctx.restore(); if (!COL) stipIn(body, 26, 0.4) }
    pen(body, 0.9, { flat: true, wob: 0.5 })
    return body
  }
  /** The floor slot a portcullis drops into, with the spike tips showing. */
  function slot(x0, x1, o) {
    o = o || {}
    const g = [[x0, -2.4], [x1, -2.4], [x1, 2.4], [x0, 2.4]]
    pit(g, { d: 0, line: 0.8, gap: 1.5 })
    if (o.spikes !== false) {
      const n = Math.round((x1 - x0) / 8)
      for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n, t = [[x - 2, 2.6], [x + 2, 2.6], [x + 0.2, -3.6]]
        poly(t); ctx.fillStyle = COL ? PAPER : INK; ctx.fill(); if (COL) tone(t, P.iron, 0.8)
        ctx.lineWidth = px(0.6); ctx.strokeStyle = INK; ctx.stroke()
      }
    }
  }
  /** Chain links from a to b, and a padlock at the end. */
  function chain(a, b, n) {
    for (let i = 0; i < n; i++) { const p = lerp(a, b, (i + 0.5) / n); const e = ellP(p[0], p[1], 1.9, 1.2, Math.atan2(b[1] - a[1], b[0] - a[0]) + (i % 2 ? PI / 2 : 0), 8); ctx.beginPath(); sub(e); ctx.lineWidth = px(0.75); ctx.strokeStyle = INK; ctx.stroke() }
  }
  function padlock(x, y) {
    const sh = ellP(x, y - 2.6, 2.4, 2.4, 0, 10); ctx.beginPath(); sub(sh); ctx.lineWidth = px(1); ctx.strokeStyle = INK; ctx.stroke()
    const bd = rrect(x, y + 0.8, 5.6, 5, 1, 0); obj(bd, { h: 1.5, col: P.brass, a: 0.8, sd: 1.6, line: 1 }); solidDot(x, y + 1, 0.8, INK)
  }
  const portcullises = [
    // 0: portcullis down
    () => { jambs('stone', { w: 15 }); lattice(-40, 40, 14, { gap: 8 }) },
    // 1: raised: only the floor slot and the spike tips
    () => { jambs('stone', { w: 15 }); slot(-39, 39) },
    // 2: iron gate, closed
    () => { jambs('stone'); leaf(-40, TH / 2, 0, DL, TH, -1, { style: 'bars', gap: 7.5, h: 2 }) },
    // 3: iron gate swung open
    () => { jambs('stone'); swingArc(-40, TH / 2, DL, 0, PI / 2); leaf(-40, TH / 2, PI / 2, DL, TH, -1, { style: 'bars', gap: 7.5, h: 3 }) },
    // 4: bars with a bent gap in the middle
    () => { jambs('stone', { w: 15 }); lattice(-40, 40, 14, { gap: 8, bend: [4, 6], skip: [5] }) },
    // 5: rusty broken bars
    () => { jambs('stone', { w: 15 }); lattice(-40, 40, 14, { gap: 8, skip: [3, 4, 7], stubs: true, rust: true }); splinters(-2, 16, 0, 0); for (const [x, y, a] of [[-6, 20, 0.4], [10, 24, -1.1]]) { const b = bar([x, y], [x + cos(a) * 11, y + sin(a) * 11], 2.1); obj(b, { h: 1.5, col: P.rust, a: 0.7, shade: 0, line: 0.8 }) } },
    // 6: gate closed with a chain and padlock
    () => { jambs('stone'); leaf(-40, TH / 2, 0, DL, TH, -1, { style: 'bars', gap: 7.5, h: 2, handle: false }); chain([-10, -7], [10, 7], det >= 1 ? 7 : 4); chain([-10, 7], [10, -7], det >= 1 ? 7 : 4); padlock(0, 10) },
    // 7: wooden palisade gate: round poles side by side, two cross-bars, rope lashings
    () => {
      jambs('post', { w: 13, h: 24 })
      const n = 9, w = 80 / n
      for (let i = 0; i < n; i++) { const x = -40 + (i + 0.5) * w, p = rrect(x, 0, w - 0.8, 15, w * 0.45, 0); obj(p, { h: i === 0 ? 2.5 : 0, col: [P.wood, P.woodL, P.woodD][i % 3], a: 0.6, sd: w * 0.3, line: 1.05 }); if (det >= 2) { seg(x + j(1), -5, x + j(1), 5); flush(0.35) } }
      for (const v of [-4, 4]) { const bm = rectP(0, v, 82, 3.2, 0); obj(bm, { col: P.woodD, a: 0.7, sd: 1.1, line: 0.95 }) }
      if (det >= 1) for (const x of [-30, 0, 30]) for (const v of [-4, 4]) { ctx.beginPath(); ctx.moveTo(x - 1.5, v - 2.4); ctx.lineTo(x + 1.5, v + 2.4); ctx.moveTo(x + 1.5, v - 2.4); ctx.lineTo(x - 1.5, v + 2.4); ctx.lineWidth = px(0.6); ctx.strokeStyle = INK; ctx.stroke() }
    },
  ]
  reg('dg-portcullis', 'Portcullis', 'dg-doors', 'fixed', portcullises)

  /* =====================================================================================================
     Archway: an open doorway, only the jambs
     ===================================================================================================== */
  /** A rough stone block lying on the floor. */
  function block(x, y, w, h, a) { const p = jig(rectP(x, y, w, h, a), 0.5); obj(p, { h: 2.5, col: [P.stone, P.stoneL, P.stoneD][(r() * 3) | 0], a: 0.72, sd: min(w, h) * 0.3, line: 1.1, wob: 1.2 }); if (det >= 2) stipIn(p, 4, 0.4); return p }
  function rubbleStone(x, y, rx, ry) { const b = blob(x, y, rx, ry, r() * PI, 8, 0.18, 3); obj(b, { h: 1.5, col: [P.stone, P.stoneL][(r() * 2) | 0], a: 0.65, sd: min(rx, ry) * 0.5, line: 0.85 }) }
  /** Jagged crack from a across a block. */
  function crack(a, b, n) { const pts = [a]; for (let i = 1; i < n; i++) { const p = lerp(a, b, i / n); pts.push([p[0] + j(1.4), p[1] + j(1.4)]) } pts.push(b); line(pts, 0.6, { taper: 0.5, wob: 0.4 }) }
  /** Threshold slab across the gap. */
  function sill(th, o) { o = o || {}; const p = jig(rectP(0, 0, 80, th, 0), 0.3); obj(p, { h: o.h == null ? 1.5 : o.h, col: o.col || P.stoneL, a: 0.6, sd: th * 0.25, line: 1.1, wob: 1 }); return p }
  const arches = [
    // 0: plain stone jambs
    () => { jambs('stone', { w: 15, h: 24 }) },
    // 1: fluted pilasters: a base step and flutes notched into the face toward the opening
    () => {
      for (const sg of [-1, 1]) {
        const p = jambStone(sg, { x: 46, w: 16, h: 26, plain: true, col: P.stoneL })
        void p
        const inner = rectP(sg * 41.5, 0, 5, 22, 0); obj(inner, { col: P.stone, a: 0.55, sd: 1.6, line: 0.9 })
        if (det >= 1) { ctx.beginPath(); for (let y = -8; y <= 8; y += 4) { ctx.moveTo(sg * 44, y); ctx.arc(sg * 44, y, 1.3, 0, TAU) } ctx.fillStyle = PAPER; ctx.fill(); ctx.lineWidth = px(0.55); ctx.strokeStyle = INK; ctx.stroke() }
      }
    },
    // 2: worn threshold step across the gap
    () => { jambs('stone', { w: 15, h: 24 }); const s2 = sill(9); if (det >= 1) { ctx.save(); clipTo(s2); const hollow = ellP(2, 0.5, 22, 3, 0, 14); if (COL) tone(hollow, P.stoneD, 0.22); else hatchIn(hollow, 0.05, 2.4, 0.3, { minG: 1.9 }); ctx.restore() } if (det >= 2) { crack([-26, -4.5], [-22, 4.5], 4); crack([30, -4.5], [27, 4.5], 3) } },
    // 3: rubble half-choking it
    () => {
      jambs('stone', { w: 15, h: 24 })
      for (const [x, y, rx, ry] of [[-30, 3, 6, 4], [-22, -4, 5, 4], [-14, 4, 5.5, 3.6], [-6, -3, 4.5, 3.5], [-26, 12, 4, 3], [-12, 13, 3.6, 2.8], [-34, -10, 3.5, 3]]) rubbleStone(x, y, rx, ry)
      block(-18, 1, 13, 8, 0.35); block(-30, -5, 10, 7, -0.6); block(-6, 6, 9, 6.5, 1.1)
      if (det >= 1) { for (let i = 0; i < 10; i++) dot(rr(-38, 4), rr(-9, 14), 0.4); flushDots() }
    },
    // 4: hanging curtain across the gap
    () => {
      jambs('stone', { w: 15, h: 24 })
      // the rod and its finials, then the cloth with folds
      const rod = bar([-42, -5], [42, -5], 1.6); obj(rod, { col: P.iron, a: 0.7, shade: 0, line: 0.7 })
      const top = [], bot = []; for (let x = -40; x <= 40; x += 5) { top.push([x, -4 + j(0.3)]); bot.push([x, 5 + sin(x * 0.55) * 1.6]) }
      const cloth = cr(top.concat(bot.reverse()), true, 2)
      shadow(cloth, 2); poly(cloth); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(cloth, P.red, 0.7)
      ctx.save(); clipTo(cloth); if (det >= 1) { for (let x = -36; x < 40; x += det >= 2 ? 4 : 6.5) line([[x + j(0.5), -3.5], [x + j(0.8), 1], [x + j(1.2), 5.5]], 0.5, { taper: 0.5, wob: 0.6 }) } if (!COL) for (let x = -34; x < 40; x += 8) hatchIn([[x, -5], [x + 3, -5], [x + 3, 7], [x, 7]], 1.4, 1.5, 0.3, { minG: 1.2 }); ctx.restore()
      pen(cloth, 1.1, { wob: 0.8 })
      for (const x of [-43, 43]) solidDot(x, -5, 1.5, INK)
    },
    // 5: bead or rope curtain: a rod and many strands with beads
    () => {
      jambs('stone', { w: 15, h: 24 })
      const rod = bar([-42, -5.5], [42, -5.5], 1.8); obj(rod, { col: P.woodD, a: 0.7, shade: 0, line: 0.75 })
      const g = det >= 2 ? 3 : 4.5
      for (let x = -39; x <= 39; x += g) { const d = rr(-0.6, 0.6); if (det >= 1) { for (let y = -3.5; y <= 6; y += 2.1) dot(x + d + j(0.3), y, 0.46) } else seg(x + d, -4, x + d, 5) }
      flushDots(); flush(0.6)
      if (COL && det >= 1) { for (let x = -39; x <= 39; x += g * 2) for (let y = -2; y <= 6; y += 4.2) solidDot(x + j(0.4), y + j(0.6), 0.65, [P.red, P.plum, P.ochre][((x + 40) / g) % 3 | 0]) }
    },
    // 6: cracked, collapsing jambs with fallen blocks
    () => {
      for (const sg of [-1, 1]) {
        const p = jambStone(sg, { w: 15, h: 24, plain: true })
        if (det >= 1) crack(p[sg < 0 ? 1 : 0], [sg * 47 + j(3), 11], 5)
        // a corner knocked off: a bite of floor showing
        const bite = sg < 0 ? [[-54.5, -12.5], [-47, -12.5], [-50, -7], [-54.5, -8]] : [[54.5, 12.5], [48, 12.5], [49.5, 7], [54.5, 6]]
        poly(bite); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tone(bite, P.stoneD, 0.25); else hatchIn(bite, 0.6, 1.8, 0.35, { minG: 1.4 }); pen(bite, 0.8, { wob: 1 })
      }
      block(-36, 22, 12, 8, 0.5); block(36, 20, 10, 7, -0.7); block(30, 32, 8, 6, 0.2)
      for (const [x, y, rx, ry] of [[-24, 14, 3.5, 2.6], [20, 14, 3, 2.4], [-46, 28, 3.2, 2.5], [46, 30, 2.8, 2.2]]) rubbleStone(x, y, rx, ry)
      if (det >= 1) { for (let i = 0; i < 8; i++) dot(rr(-44, 44), rr(10, 30), 0.4); flushDots() }
    },
    // 7: rune-carved threshold
    () => {
      jambs('stone', { w: 15, h: 24, col: P.stoneD })
      const s2 = sill(10, { col: P.stone })
      ctx.save(); clipTo(s2)
      const g = det >= 2 ? 6 : 8.5
      for (let x = -35; x <= 35; x += g) { // angular rune strokes, each a little different
        const q = (r() * 5) | 0, t = 3.3
        ctx.beginPath()
        if (q === 0) { ctx.moveTo(x, -t); ctx.lineTo(x, t); ctx.moveTo(x, -t); ctx.lineTo(x + 2.4, -0.5) } else if (q === 1) { ctx.moveTo(x - 2, -t); ctx.lineTo(x + 2, t); ctx.moveTo(x + 2, -t); ctx.lineTo(x - 2, t) } else if (q === 2) { ctx.moveTo(x, -t); ctx.lineTo(x, t); ctx.moveTo(x - 2.4, 0); ctx.lineTo(x, -2); ctx.lineTo(x + 2.4, 0) } else if (q === 3) { ctx.moveTo(x - 2, t); ctx.lineTo(x, -t); ctx.lineTo(x + 2, t); ctx.moveTo(x - 1, 0.8); ctx.lineTo(x + 1, 0.8) } else { ctx.moveTo(x, -t); ctx.lineTo(x, t); ctx.moveTo(x - 2.2, -1.8); ctx.lineTo(x + 2.2, 1.8) }
        ctx.lineWidth = px(0.8); ctx.strokeStyle = INK; ctx.stroke()
      }
      ctx.restore()
      if (det >= 1) { rule([-38, -3.4], [38, -3.4], 0.5, { over: 0, taper: 0.3 }); rule([-38, 3.4], [38, 3.4], 0.5, { over: 0, taper: 0.3 }) }
    },
  ]
  reg('dg-arch', 'Archway', 'dg-doors', 'fixed', arches)

  /* =====================================================================================================
     Trapdoor (category dg-features): a hatch in the floor, about 60 x 60 units
     ===================================================================================================== */
  /** Stone kerb around a floor opening. */
  function kerb(cx, cy, w, h, o) { o = o || {}; const p = jig(rectP(cx, cy, w, h, o.ang || 0), 0.25); obj(p, { col: o.col || P.stoneL, a: 0.5, sd: 2, line: 1.0, flat: true, cross: false }); return p }
  /** Planked square lid, planks running along y, optional battens across. Returns the lid polygon. */
  function plankLid(cx, cy, w, h, ang, o) {
    o = o || {}
    const lid = rectP(cx, cy, w, h, ang)
    if (o.h) shadow(lid, o.h)
    plankRect(cx, cy, h, w, ang + PI / 2, { pw: o.pw || (det >= 2 ? 9.5 : 12.5), nails: o.nails == null ? det >= 2 : o.nails, seed: o.seed || 0, cols: o.cols })
    const f = F(cx, cy, ang)
    if (o.battens) for (const v of [-h * 0.32, h * 0.32]) { const b = rectP(...f(0, v), w - 5, 5.5, ang); obj(b, { col: P.woodD, a: 0.6, sd: 1.8, line: 0.9 }); if (det >= 2) { for (let u = -w / 2 + 8; u < w / 2 - 4; u += 9.5) nail(...f(u, v)); flushDots() } }
    if (o.straps) for (const v of [-h * 0.3, h * 0.3]) strap(f, -w / 2 + 1, w / 2 - 1, v, 4.4, { gap: 8 })
    if (det >= 1) shadeIn(lid, min(w, h) * 0.1, { gap: 2.3 })
    pen(lid, o.line || 1.35)
    return lid
  }
  /** Two hinge straps on the top edge of a lid. */
  function hinges(cx, cy, w, h, o) { o = o || {}; const f = F(cx, cy, PI / 2); for (const x of [-w * 0.3, w * 0.3]) strap(f, -h / 2 + 1, -h / 2 + (o.len || 13), -x, 4, { gap: 6 }) }
  /** Iron bars over an opening: nx uprights and ny cross-bars, rivets at the crossings. skip/bend as in lattice. */
  function barGrid(cx, cy, w, h, nx, ny, o) {
    o = o || {}
    const f = F(cx, cy, 0), ironQ = (p) => { poly(p); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tone(p, o.rust ? P.rust : P.iron, 0.72); pen(p, 0.75, { flat: true, wob: 0.3, noCorner: true }) }
    const bw = o.bw || 2.4, xs = [], ys = []
    for (let i = 0; i <= ny; i++) { const v = -h / 2 + (h * i) / ny; ys.push(v) }
    for (let i = 0; i <= nx; i++) {
      const u = -w / 2 + (w * i) / nx; xs.push(u)
      if (o.skip && o.skip.includes(i)) { ironQ([f(u - bw / 2, -h / 2), f(u + bw / 2, -h / 2), f(u + bw / 2, -h / 2 + rr(5, 9)), f(u - bw / 2, -h / 2 + rr(4, 8))]); ironQ([f(u - bw / 2, h / 2 - rr(4, 9)), f(u + bw / 2, h / 2 - rr(5, 8)), f(u + bw / 2, h / 2), f(u - bw / 2, h / 2)]); continue }
      if (o.bend && o.bend.includes(i)) { const pts = []; for (let q = 0; q <= 8; q++) { const t = q / 8; pts.push(f(u + 5 * sin(PI * t) * (i % 2 ? 1 : -1), -h / 2 + h * t)) } line(pts, 2.4, { taper: 0.05, wob: 0.3 }); if (COL) line(pts, 1.3, { taper: 0.05, wob: 0.2, col: P.iron }); continue }
      ironQ([f(u - bw / 2, -h / 2), f(u + bw / 2, -h / 2), f(u + bw / 2, h / 2), f(u - bw / 2, h / 2)])
    }
    for (const v of ys) ironQ([f(-w / 2, v - bw / 2), f(w / 2, v - bw / 2), f(w / 2, v + bw / 2), f(-w / 2, v + bw / 2)])
    if (det >= 1) { for (const u of xs) for (const v of ys) if (!(o.skip && o.skip.includes(xs.indexOf(u)))) dot(...f(u, v), 0.6); flushDots() }
  }
  const trapdoors = [
    // 0: closed plank hatch with battens and a ring pull
    () => { kerb(0, 0, 66, 66); plankLid(0, 0, 60, 60, 0, { battens: true, seed: 0 }); hinges(0, 0, 60, 60); ringPull(0, 9, 4.4, { w: 1.5 }) },
    // 1: open: a dark hole, the lid thrown back beside it
    () => {
      kerb(-10, 0, 58, 62); pit(rectP(-10, 0, 52, 56, 0), { d: 12 })
      plankLid(31, 1, 34, 56, 0.05, { h: 4, seed: 1, battens: false, pw: det >= 2 ? 8.5 : 11 }); const f = F(31, 1, 0.05); for (const v of [-17, 17]) strap(f, -16, 16, v, 4.2, { gap: 8 }); ringPull(...f(-4, 0), 3.6, { w: 1.3 })
    },
    // 2: iron-bound hatch, corner plates
    () => {
      kerb(0, 0, 66, 66); plankLid(0, 0, 60, 60, 0, { straps: true, seed: 2, cols: [P.woodD, P.wood, P.woodD] })
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const c = [[sx * 29, sy * 29], [sx * 17, sy * 29], [sx * 29, sy * 17]]; poly(c); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tone(c, P.iron, 0.65); else if (det >= 2) hatchIn(c, 0.0, 1.6, 0.35, { minG: 1.3 }); pen(c, 0.8, { flat: true }); if (det >= 1) { nail(sx * 24, sy * 24); flushDots() } }
      ringPull(0, 0, 4.6, { w: 1.5 }); const hp = rectP(0, -5.5, 8, 3.2, 0); obj(hp, { col: P.iron, a: 0.7, shade: 0, line: 0.8 })
    },
    // 3: iron grate over darkness
    () => { const fr = kerb(0, 0, 64, 64, { col: P.stone }); void fr; pit(rectP(0, 0, 56, 56, 0), { d: 10 }); barGrid(0, 0, 54, 54, 4, 4, {}) },
    // 4: a flagstone that is really a hatch: a seam all round and a sunk ring at one edge
    () => {
      const fl = jig(rectP(0, 0, 60, 58, 0.02), 1.2); obj(fl, { col: P.stone, a: 0.55, sd: 5, line: 1.0, wob: 1.3 })
      if (det >= 1) { ctx.save(); ctx.setLineDash([2.2 / k * lw, 2.6 / k * lw]); ctx.beginPath(); sub(shift(rectP(0, 0, 54, 52, 0.02), 0, 0)); ctx.lineWidth = px(0.55); ctx.strokeStyle = INK; ctx.stroke(); ctx.restore() }
      if (det >= 2) { stipIn(fl, 14, 0.4); crack([-22, -24], [-10, -8], 4) }
      const rec = rrect(0, 20, 12, 7, 2, 0); pit(rec, { d: 0, line: 0.7 }); ringPull(0, 20.5, 3.2, { w: 1.2 })
    },
    // 5: open hole with a ladder going down
    () => {
      kerb(0, 0, 62, 62); const hole = rectP(0, 0, 54, 54, 0); pit(hole, { d: 12 })
      // the ladder leans in from the near edge: rails converge as they go down, rungs crowd together
      const L = [[-10, 33], [-5, -12]], R = [[10, 33], [5, -12]]
      for (let i = 0; i < (det >= 1 ? 7 : 4); i++) { const t = 0.08 + 0.92 * (1 - Math.pow(1 - i / 7, 1.6)); const a = lerp(L[0], L[1], t), b = lerp(R[0], R[1], t); const rg = bar(a, b, 1.9); poly(rg); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tone(rg, P.woodL, 0.7); pen(rg, 0.7, { flat: true, noCorner: true }) }
      for (const rl of [L, R]) { const q = bar(rl[0], rl[1], 2.6); poly(q); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tone(q, P.wood, 0.75); pen(q, 0.9, { flat: true, noCorner: true }) }
      if (det >= 1) { ctx.save(); clipTo(hole); shadeIn(hole, 10, { rev: true, col: 'rgba(0,0,0,0.3)', inkToo: true, gap: 1.8 }); ctx.restore() }
    },
    // 6: broken hatch: planks stove in, a jagged hole, splinters
    () => {
      kerb(0, 0, 66, 66); plankLid(0, 0, 60, 60, 0, { battens: true, seed: 6, cols: [P.woodL, P.wood, P.woodL] })
      const hole = cr([[-14, -12], [-2, -20], [10, -14], [16, -2], [12, 10], [2, 16], [-10, 12], [-18, 2]].map((p) => [p[0] + j(1.5), p[1] + j(1.5)]), true, 2)
      pit(hole, { d: 6, line: 0.9, wob: 1.6 })
      if (det >= 1) { for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU + 0.3, p0 = [cos(a) * 15, sin(a) * 15], p1 = [cos(a) * rr(19, 24), sin(a) * rr(19, 24)]; line([p0, p1], 0.6, { taper: 0.6, wob: 0.5 }) } }
      // one plank end lifted: a sliver of its underside standing proud
      const up = [[2, -22], [10, -24], [14, -14], [8, -12]]; obj(up, { h: 3, col: P.woodD, a: 0.7, sd: 2, line: 1 })
      splinters(24, 26, det >= 1 ? 5 : 2, 10); splinters(-26, -24, det >= 1 ? 4 : 2, 8)
    },
    // 7: round wooden hatch with an iron hoop
    () => {
      const R = 31, c = ellP(0, 0, R)
      obj(ellP(0, 0, R + 3), { col: P.stoneL, a: 0.5, sd: 2, line: 0.9, flat: true })
      poly(c); ctx.fillStyle = PAPER; ctx.fill()
      ctx.save(); clipTo(c); plankRect(0, 0, 2 * R + 4, 2 * R + 4, PI / 2, { pw: det >= 2 ? 9 : 12, nails: false, seed: 7 }); ctx.restore()
      if (det >= 1) shadeIn(c, 7, { gap: 2.3 }); pen(c, 1.4)
      const a = ellP(0, 0, R * 0.9), b = ellP(0, 0, R * 0.78); ctx.beginPath(); sub(a); sub(b); ctx.fillStyle = PAPER; ctx.fill('evenodd'); if (COL) { ctx.save(); ctx.globalAlpha = 0.62; ctx.fillStyle = P.iron; ctx.fill('evenodd'); ctx.restore() } else if (det >= 2) { ctx.save(); ctx.clip('evenodd'); hatchBox(-R, -R, R, R, 0.3, 1.8, 0.35, { minG: 1.4 }); ctx.restore() }
      pen(a, 0.8, { wob: 0.35 }); pen(b, 0.8, { wob: 0.35, swell: 0.3 })
      if (det >= 1) { for (let i = 0; i < 8; i++) { const q = (i / 8) * TAU + 0.2; nail(cos(q) * R * 0.84, sin(q) * R * 0.84) } flushDots(null, 1.2) }
      const bm = rectP(0, 0, R * 1.5, 5, 0); obj(bm, { col: P.woodD, a: 0.6, sd: 1.6, line: 0.9 }); ringPull(0, 0, 4, { w: 1.4 })
    },
  ]
  reg('dg-trapdoor', 'Trapdoor', 'dg-features', 'fixed', trapdoors)

  /* =====================================================================================================
     Drain grate (category dg-features): a floor drain, about 50 units
     ===================================================================================================== */
  /** Iron plate with dark slots across it. */
  function slotPlate(pts, n, w, h, o) {
    o = o || {}
    poly(pts); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(pts, o.col || P.iron, 0.6); else if (det >= 1) hatchIn(pts, 0.6, 2.8, 0.35, { minG: 2 })
    ctx.save(); clipTo(pts)
    for (let i = 0; i < n; i++) { const y = -h / 2 + ((i + 0.5) * h) / n; const sl = rrect(0, y, w, min(h / n * 0.5, 4.2), 1.6, 0); pit(sl, { d: 0, line: 0.6, gap: 1.4 }) }
    ctx.restore()
    if (det >= 1) shadeIn(pts, 3.5, { gap: 2, cross: false })
    pen(pts, o.line || 1.25)
  }
  function bone(a, b, w) { const q = bar(a, b, w); obj(q, { h: 1, col: P.bone, a: 0.75, shade: 0, line: 0.7 }); for (const p of [a, b]) { const d = hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / d, ny = (b[0] - a[0]) / d; for (const s of [-1, 1]) { const e = ellP(p[0] + nx * s * w * 0.5, p[1] + ny * s * w * 0.5, w * 0.62, w * 0.62, 0, 7); obj(e, { col: P.bone, a: 0.75, shade: 0, line: 0.65 }) } } }
  function skull(x, y, R) { const c = ellP(x, y, R, R * 0.92, 0, 12); obj(c, { h: 1.5, col: P.bone, a: 0.75, sd: R * 0.4, line: 0.9 }); const jw = rrect(x, y + R * 0.75, R * 1.1, R * 0.6, 1, 0); obj(jw, { col: P.bone, a: 0.7, shade: 0, line: 0.7 }); solidDot(x - R * 0.35, y - R * 0.05, R * 0.24, INK); solidDot(x + R * 0.35, y - R * 0.05, R * 0.24, INK); if (det >= 1) { seg(x - 1, y + R * 0.75, x - 1, y + R); seg(x + 1, y + R * 0.75, x + 1, y + R); flush(0.4) } }
  const grates = [
    // 0: square iron grate
    () => { slotPlate(rrect(0, 0, 50, 50, 2.5, 0), 5, 40, 44, {}); if (det >= 1) { for (const [x, y] of [[-21, -21], [21, -21], [21, 21], [-21, 21]]) nail(x, y); flushDots(null, 1.3) } },
    // 1: round grate
    () => { const c = ellP(0, 0, 25); slotPlate(c, 5, 40, 40, {}); pen(ellP(0, 0, 21.5), 0.7, { flat: true, wob: 0.4 }); if (det >= 1) { for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.5; nail(cos(a) * 23, sin(a) * 23) } flushDots(null, 1.2) } },
    // 2: slot drain
    () => { const fr = rrect(0, 0, 58, 14, 2, 0); obj(fr, { col: P.stone, a: 0.55, sd: 2.5, line: 1.1 }); const sl = rrect(0, 0, 50, 5.5, 2, 0); pit(sl, { d: 0, line: 0.8, gap: 1.4 }); if (det >= 1) { for (let x = -22; x <= 22; x += det >= 2 ? 4.5 : 7) seg(x, -2.6, x + j(0.3), 2.6); flush(0.8) } },
    // 3: round grate with a puddle stain spreading from it
    () => {
      const stain = blob(3, 3, 32, 27, 0.4, 12, 0.2, 3)
      ctx.save(); clipTo(stain); if (COL) { tint(stain, P.wet, 0.26); tint(blob(1, 1, 22, 19, 0.4, 10, 0.2, 3), P.wet, 0.22) } else { hatchBox(-36, -32, 40, 36, 0.15, 3.4, 0.35, { minG: 2.4 }); if (det >= 1) hatchIn(blob(1, 1, 22, 19, 0.4, 10, 0.2, 3), 0.15 + 1.2, 3.6, 0.3, { minG: 2.6 }) } ctx.restore()
      line(stain.concat([stain[0]]), 0.5, { taper: 0, wob: 1.4 })
      const c = ellP(0, 0, 21); slotPlate(c, 4, 34, 32, {}); if (det >= 1) { for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU + 0.3; nail(cos(a) * 19, sin(a) * 19) } flushDots(null, 1.2) }
    },
    // 4: broken grate: bars bent and missing over the dark drain
    () => { const fr = rrect(0, 0, 52, 52, 2.5, 0); obj(fr, { col: P.stone, a: 0.5, sd: 3, line: 1.1 }); pit(rectP(0, 0, 44, 44, 0), { d: 8 }); barGrid(0, 0, 42, 42, 6, 1, { skip: [3], bend: [2, 4] }); for (const [x, y, a] of [[18, 32, 0.6], [-26, 30, -0.3]]) { const b = bar([x, y], [x + cos(a) * 12, y + sin(a) * 12], 2.3); obj(b, { h: 1.5, col: P.iron, a: 0.7, shade: 0, line: 0.8 }) } },
    // 5: ornate grate: a quatrefoil of curved bars in a round rim
    () => {
      const R = 25, c = ellP(0, 0, R)
      obj(c, { col: P.iron, a: 0.55, sd: 4, line: 1.3 })
      const inner = ellP(0, 0, R * 0.8); pit(inner, { d: 0, line: 0.8, gap: 1.6 })
      ctx.save(); clipTo(inner)
      const petals = []; for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + PI / 4; petals.push(ellP(cos(a) * R * 0.36, sin(a) * R * 0.36, R * 0.3, R * 0.2, a, 12)) }
      for (const p of petals) { poly(p); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tone(p, P.iron, 0.62); pen(p, 0.8, { flat: true, wob: 0.3 }); const q = ellP(p === petals[0] ? 0 : 0, 0, 1, 1, 0, 6); void q }
      for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU; const b = bar([cos(a) * R * 0.1, sin(a) * R * 0.1], [cos(a) * R * 0.82, sin(a) * R * 0.82], 2.2); poly(b); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tone(b, P.iron, 0.62); pen(b, 0.7, { flat: true, noCorner: true }) }
      const hub = ellP(0, 0, R * 0.18); obj(hub, { col: P.iron, a: 0.7, shade: 0, line: 0.9 })
      ctx.restore()
      pen(inner, 0.9, { swell: -0.5 })
      if (det >= 1) { for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + 0.2; nail(cos(a) * R * 0.9, sin(a) * R * 0.9) } flushDots(null, 1.2) }
    },
    // 6: grate with bones caught in it
    () => { slotPlate(rrect(0, 0, 50, 50, 2.5, 0), 5, 40, 44, {}); bone([-16, -6], [6, 4], 2.4); bone([4, 14], [20, -2], 2.1); if (det >= 1) bone([-18, 16], [-6, 20], 1.6); skull(12, -14, 6) },
    // 7: a plain hole with a chipped stone rim
    () => {
      const rim = blob(0, 0, 25, 23, 0.3, 14, 0.06, 3), hole = blob(0, 0, 17, 16, 0.3, 12, 0.1, 3)
      obj(rim, { col: P.stone, a: 0.55, sd: 5, line: 1.2, wob: 1.2 })
      if (det >= 1) { for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU + 0.4; seg(cos(a) * 17.5, sin(a) * 16.5, cos(a + j(0.1)) * rr(22, 25), sin(a + j(0.1)) * rr(20, 23)) } flush(0.5) }
      pit(hole, { d: 7, wob: 1.4 })
      if (det >= 2) { crack([22, -8], [34, -16], 4); crack([-24, 6], [-33, 14], 3) }
    },
  ]
  reg('dg-grate', 'Drain grate', 'dg-features', 'fixed', grates)
})(window.Atlas)
