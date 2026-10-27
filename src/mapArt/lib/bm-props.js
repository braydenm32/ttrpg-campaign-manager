/* Battle-map props, seen from directly above (view 'top'). Hand-inked: outlines swell toward the lower right (light from the
   upper left), parallel hatching and stipple for shade, plank grain and nails at close range. Colour mode puts translucent
   washes over the same linework. Everything is drawn in a 100-unit design space (100 units = s), so a piece reads from
   s=30 up to s=300: `det` drops small marks at small sizes and adds grain, nails and extra strokes when big.
   Shapes are polygons: each goes through obj() = [cast shadow] + opaque paper fill + wash + shading + outline,
   so pieces drawn later hide the ones under them. */
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
    const wood = mix(t.sand, t.roof, 0.46), straw = mix(t.sand, '#d2a23c', 0.62)
    p = {
      wood, woodL: mix(t.sand, t.roof, 0.26), woodD: mix(t.roof, '#3a2918', 0.42), woodX: mix(t.roof, '#2c1f12', 0.62),
      canvas: mix(t.snow, t.sand, 0.5), canvasD: mix(t.sand, t.rock, 0.45),
      stone: t.rock, stoneL: mix(t.rock, '#ffffff', 0.32), stoneD: mix(t.rock, '#2a2824', 0.38),
      iron: mix(t.rock, '#1e1c1a', 0.62), brass: mix(t.sand, '#b8862a', 0.7),
      straw, strawD: mix(straw, t.roof, 0.3), strawL: mix(straw, '#fff3c4', 0.4),
      red: mix(t.roof, t.sand, 0.12), blue: mix(t.water, '#4e6478', 0.6), green: mix(t.forest, t.grass, 0.2), ochre: mix(t.sand, '#c28a2c', 0.65), plum: mix(t.roof, '#4c3a5a', 0.55),
      water: t.water, waterD: mix(t.water, '#2c4a52', 0.45),
      earth: mix(t.rock, '#6b5236', 0.55), earthD: mix(t.rock, '#3a2c1e', 0.6), grass: t.grass, grassD: t.forest,
      leather: mix(t.roof, '#4a3420', 0.55), fur: mix(t.sand, '#7a5a38', 0.55), cloth: mix(t.snow, t.sand, 0.25),
      flame: '#dc8a3c', flameL: '#efc468', flameR: '#bd5236', ash: mix(t.rock, '#555048', 0.5), coal: '#4a3c32',
      gold: '#d2a83a', glass: mix(t.water, '#ffffff', 0.4), shade: '#46301a',
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
  const arcP = (cx, cy, rx, ry, a0, a1, ang, n) => { const f = F(cx, cy, ang), o = []; n = n || Math.max(4, Math.round(nSeg(max(rx, ry)) * abs(a1 - a0) / TAU)); for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; o.push(f(cos(a) * rx, sin(a) * (ry == null ? rx : ry))) } return o }
  /** Rounded rectangle. */
  function rrect(cx, cy, w, h, rad, ang, n) {
    const f = F(cx, cy, ang), a = w / 2, b = h / 2, o = []; rad = min(rad, a, b); n = n || (rad * k > 6 ? 5 : 3)
    const cs = [[a - rad, -b + rad, -PI / 2], [a - rad, b - rad, 0], [-a + rad, b - rad, PI / 2], [-a + rad, -b + rad, PI]]
    for (const [qx, qy, a0] of cs) for (let i = 0; i <= n; i++) { const t = a0 + (i / n) * (PI / 2); o.push(f(qx + cos(t) * rad, qy + sin(t) * rad)) }
    return o
  }
  const shift = (pts, dx, dy) => pts.map((p) => [p[0] + dx, p[1] + dy])
  const rot = (pts, cx, cy, a) => { const c = cos(a), s = sin(a); return pts.map((p) => [cx + (p[0] - cx) * c - (p[1] - cy) * s, cy + (p[0] - cx) * s + (p[1] - cy) * c]) }
  const scaleP = (pts, cx, cy, sx, sy) => pts.map((p) => [cx + (p[0] - cx) * sx, cy + (p[1] - cy) * (sy == null ? sx : sy)])
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
  /** Lumpy rounded outline (sacks, hay, fur, stones). irr = how lumpy. */
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
      const hw = (base / 2) * (1 - tp + tp * sin(PI * t)) * (o.fw ? o.fw(t) : 1) * (1 + j(0.07))
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
  /** Fill a clipped region with a flat translucent tone. */
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
  /** Cast shadow with an explicit outline (for tall thin things whose shadow is longer than the sweep of their footprint). */
  function castPoly(...polys) {
    if (!st.shadows) return
    ctx.save(); ctx.beginPath(); for (const pts of polys) sub(pts)
    if (COL) { ctx.fillStyle = 'rgba(40,30,15,0.25)'; ctx.fill() } else { ctx.clip(); const b = bbox([].concat(...polys)); hatchBox(b.x0, b.y0, b.x1, b.y1, -0.62, 2.3, 0.5) }
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
  const peg = (x, y, a) => { // tent peg: a little hammered stub with a tick of shadow
    const q = 1.1; ctx.beginPath(); ctx.moveTo(x + 0.6, y + 0.6); ctx.lineTo(x + 2.4, y + 2.6); ctx.lineWidth = px(0.55); ctx.strokeStyle = INK; ctx.stroke()
    ctx.beginPath(); ctx.arc(x, y, q, 0, TAU); ctx.fillStyle = PAPER; ctx.fill(); ctx.lineWidth = px(0.95); ctx.stroke()
  }
  /** Slack rope sagging between a and b. */
  function rope(a, b, sag, w, col) {
    const m = lerp(a, b, 0.5), d = hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / d, ny = (b[0] - a[0]) / d, sg = (sag == null ? 1.2 : sag) * (r() < 0.5 ? 1 : -1)
    line([a, [m[0] + nx * sg, m[1] + ny * sg], b], w || 0.5, { taper: 0.15, wob: 0.4, col })
  }
  /** Wood-grain strokes along a frame's u axis. */
  function grain(f, u0, u1, v0, v1, n, w) {
    for (let i = 0; i < n; i++) {
      const v = rr(v0, v1), a = rr(u0, u1), b = a + rr((u1 - u0) * 0.25, (u1 - u0) * 0.7), pts = []
      for (let u = a; u < min(b, u1); u += 4) pts.push(f(u, v + j(0.35)))
      if (pts.length > 1) { ctx.moveTo(pts[0][0], pts[0][1]); for (let q = 1; q < pts.length; q++) ctx.lineTo(pts[q][0], pts[q][1]) }
    }
  }
  const wavy = (f, u0, u1, v, amp) => { const pts = []; for (let u = u0; u <= u1; u += 3.5) pts.push(f(u, v + sin(u * 0.35 + v) * amp)); return pts }
  /** Planks laid across a rectangle (planks run along u). Draws each plank as its own inked, tinted piece. */
  function plankRect(cx, cy, w, h, ang, o) {
    o = o || {}
    const f = F(cx, cy, ang), pw = o.pw || 12, n = max(1, o.n || Math.round(h / pw)), cols = o.cols || [P.wood, P.woodL, P.woodD]
    const g = o.gap == null ? 0.5 : o.gap, grains = o.grain == null ? det >= 2 : o.grain
    ctx.beginPath()
    const ws = []
    for (let i = 0; i < n; i++) {
      const v0 = -h / 2 + (i * h) / n, v1 = v0 + h / n, e0 = o.stag ? rr(0, o.stag) : 0, e1 = o.stag ? rr(0, o.stag) : 0
      const pl = [f(-w / 2 + e0, v0 + g), f(w / 2 - e1, v0 + g), f(w / 2 - e1, v1 - g), f(-w / 2 + e0, v1 - g)]
      ws.push(pl)
      poly(pl); ctx.fillStyle = PAPER; ctx.fill()
      if (COL) tone(pl, cols[(i * 7 + (o.seed || 0)) % cols.length], 0.5)
    }
    // seams and grain in one batched pass
    ctx.beginPath()
    for (let i = 0; i < n; i++) { const p = ws[i]; ctx.moveTo(p[0][0], p[0][1]); ctx.lineTo(p[1][0], p[1][1]); ctx.lineTo(p[2][0], p[2][1]); ctx.lineTo(p[3][0], p[3][1]); ctx.closePath() }
    ctx.lineWidth = px(o.sw || 0.75); ctx.strokeStyle = INK; ctx.stroke()
    if (grains && h / n > 5) {
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
      // knots, and every other plank a touch darker in ink (light grain-wise hatching)
      for (let i = 0; i < n; i++) {
        const v0 = -h / 2 + (i * h) / n, v1 = v0 + h / n
        if (r() < (det >= 3 ? 0.4 : 0.25) && v1 - v0 > 7) { const kc = f(rr(-w * 0.3, w * 0.3), (v0 + v1) / 2 + j(1)), ke = ellP(kc[0], kc[1], 2.6, 1.6, ang, 8); pen(ke, 0.6, { flat: true, wob: 0.3 }); pen(ellP(kc[0], kc[1], 1.1, 0.6, ang, 6), 0.45, { flat: true, wob: 0.2, noCorner: true }) }
        if (!COL && i % 2 === 1 && det >= 2) { ctx.save(); clipTo(ws[i]); hatchBox(cx - w, cy - w, cx + w, cy + w, ang + 0.03, 3.4, 0.3, { minG: 2.6 }); ctx.restore() }
      }
    }
    if (o.nails !== false && det >= 2) for (let i = 0; i < n; i++) { const v = -h / 2 + ((i + 0.5) * h) / n; nail(...f(-w / 2 + 2.6, v)); nail(...f(w / 2 - 2.6, v)) }
    flushDots()
  }

  /* ---------- registration ---------- */
  const VAR = {}
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
     Tents
     ===================================================================================================== */
  /** Scalloped edge from a to b: n bulges pushed to the side `out` (+1 = left of a->b, -1 = right). */
  function scal(a, b, n, depth, out, sub) {
    const d = hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = (-(b[1] - a[1]) / d) * out, ny = ((b[0] - a[0]) / d) * out, pts = []
    sub = sub || 4
    for (let i = 0; i < n; i++) for (let q = 0; q < sub; q++) { const t = (i + q / sub) / n, e = Math.sin((PI * q) / sub) * depth; pts.push([a[0] + (b[0] - a[0]) * t + nx * e, a[1] + (b[1] - a[1]) * t + ny * e]) }
    pts.push(b); return pts
  }
  /** Canvas fold strokes: from points along a->b, short strokes heading in direction (dx, dy). */
  function folds(a, b, n, len, dx, dy, spread) {
    for (let i = 0; i < n; i++) {
      const t = (i + rr(0.15, 0.85)) / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, l = len * rr(0.35, 1)
      seg(x, y, x + dx * l + j(spread || 0.8), y + dy * l + j(spread || 0.8))
    }
  }
  /** Guy ropes then pegs. pairs = [[tentPt, pegPt], ...] */
  function guys(pairs, sag) {
    for (const [a, b] of pairs) rope(a, b, sag == null ? 1.0 : sag, 0.55)
    for (const [, b] of pairs) peg(b[0], b[1])
  }
  /** Ridge tent: the ridge runs along u. Upper slope lit, lower slope shaded, door flap tied back at the -u end. */
  function ridgeTent(cx, cy, L, W, ang, o) {
    o = o || {}
    const f = F(cx, cy, ang), hl = L / 2, hw = W / 2, sag = o.sag == null ? 2.2 : o.sag, rl = o.rl || 12
    const ca = o.col || P.canvas
    // ropes and pegs first (the canvas covers where they attach)
    if (o.ropes !== false) {
      const pr = []
      pr.push([f(hl + 3, 0), f(hl + 3 + rl, j(2))], [f(-hl - 3, 0), f(-hl - 3 - rl, j(2))])
      for (const sg of [-1, 1]) {
        pr.push([f(hl * 0.55, sg * hw), f(hl * 0.62, sg * (hw + rl * 0.9))], [f(-hl * 0.55, sg * hw), f(-hl * 0.62, sg * (hw + rl * 0.9))])
        pr.push([f(hl, sg * hw), f(hl + rl * 0.5, sg * (hw + rl * 0.7))], [f(-hl, sg * hw), f(-hl - rl * 0.5, sg * (hw + rl * 0.7))])
      }
      guys(pr)
    }
    // door flap, tied back, lying outside the -u end
    if (o.flap !== false) {
      const fl = [f(-hl + 1, -hw * 0.42), f(-hl - 8, -hw * 0.6), f(-hl - 12, -hw * 0.2), f(-hl - 10, hw * 0.35), f(-hl - 4, hw * 0.55), f(-hl + 1, hw * 0.42)]
      obj(cr(fl, true, 3), { h: 1.5, col: ca, shade: 1, sd: 5, line: 1 })
      if (det >= 1) { rule(f(-hl - 7, -hw * 0.5), f(-hl - 7, hw * 0.42), 0.7, { taper: 0.3 }) }
    }
    const top = [], bot = []
    for (let i = 0; i <= 8; i++) { const u = -hl + (L * i) / 8, e = sag * Math.sin((PI * i) / 8); top.push(f(u, -hw + e + (i && i < 8 ? j(0.3) : 0))); bot.push(f(u, hw - e + (i && i < 8 ? j(0.3) : 0))) }
    const body = top.concat(bot.slice().reverse())
    const loP = [f(-hl, 0), f(hl, 0), ...bot.slice().reverse()]
    shadow(body, o.h == null ? 7 : o.h)
    poly(body); ctx.fillStyle = PAPER; ctx.fill()
    if (COL) { tint(body, ca, 0.8); if (o.stripe) { for (let i = 0; i < o.stripe; i += 2) { const u0 = -hl + (L * i) / o.stripe, u1 = -hl + (L * (i + 1)) / o.stripe; tone([f(u0, -hw - 3), f(u1, -hw - 3), f(u1, hw + 3), f(u0, hw + 3)].map((p) => p), o.stripeCol || P.red, 0.55) } } }
    // the lower slope turns away from the light
    ctx.save(); clipTo(body)
    if (COL) tone(loP, P.shade, 0.2)
    ctx.restore()
    if (det >= 1) {
      ctx.save(); clipTo(body)
      if (o.stripe && !COL) for (let i = 0; i < o.stripe; i += 2) { const u0 = -hl + (L * i) / o.stripe, u1 = -hl + (L * (i + 1)) / o.stripe; hatchIn([f(u0, -hw - 3), f(u1, -hw - 3), f(u1, hw + 3), f(u0, hw + 3)], ang + PI / 2, 1.6, 0.4) }
      ctx.restore()
      hatchIn(loP, ang + PI / 2 + 0.1, o.stripe && !COL ? 6 : 2.7, 0.5, { minG: 1.7 })
      folds(f(-hl + 3, -hw + 1), f(hl - 3, -hw + 1), max(3, Math.round(L / (det >= 2 ? 6 : 10))), hw * 0.55, -sin(ang) * -1 * 0 + cos(ang + PI / 2), sin(ang + PI / 2), 0.7)
      flush(0.45)
      // a stitched repair patch and a couple of sag wrinkles on the lit slope
      if (det >= 2 && o.patch !== false && !o.stripe) {
        const pu = rr(-hl * 0.55, hl * 0.5), pv = -hw * rr(0.35, 0.62), pw = rr(5, 8), ph = rr(4, 6), pa = rr(-0.15, 0.15)
        const pf = F(...f(pu, pv), ang + pa), pc = [pf(-pw / 2, -ph / 2), pf(pw / 2, -ph / 2), pf(pw / 2, ph / 2), pf(-pw / 2, ph / 2)]
        poly(pc); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tone(pc, P.canvasD, 0.55); pen(pc, 0.6, { flat: true })
        const mid = pf(0, 0)
        for (let q = 0; q < 4; q++) { const a = lerp(pc[q], pc[(q + 1) % 4], 0.1), b = lerp(pc[q], pc[(q + 1) % 4], 0.9); ctx.beginPath(); ctx.setLineDash([1.2 / k * lw, 1.6 / k * lw]); ctx.moveTo(a[0] + (mid[0] - a[0]) * 0.18, a[1] + (mid[1] - a[1]) * 0.18); ctx.lineTo(b[0] + (mid[0] - b[0]) * 0.18, b[1] + (mid[1] - b[1]) * 0.18); ctx.lineWidth = px(0.4); ctx.stroke(); ctx.setLineDash([]) }
        for (let q = 0; q < 2; q++) { const u0 = rr(-hl * 0.7, hl * 0.6), v0 = -hw * rr(0.15, 0.8); line([f(u0, v0), f(u0 + rr(6, 12), v0 + rr(-1.5, 1.5) + 1), f(u0 + rr(14, 22), v0 + rr(-1, 2))], 0.5, { taper: 0.9, wob: 0.3 }) }
      }
    }
    // ridge pole and cap
    const ra = f(-hl - 5, 0), rb = f(hl + 5, 0)
    rule(ra, rb, 1.7, { taper: 0.25, over: 0.2 })
    if (det >= 1) { for (const sg of [-1, 1]) { const q = f(sg * (hl + 5), 0); solidDot(q[0], q[1], 1.9, PAPER); ctx.lineWidth = px(0.9); ctx.beginPath(); ctx.arc(q[0], q[1], 1.9, 0, TAU); ctx.stroke() } }
    pen(body, 1.45)
    if (det >= 2) { // eave pegs loops and stitched seam by the ridge
      ctx.beginPath(); for (let u = -hl + 4; u < hl - 3; u += 5) { ctx.moveTo(...f(u, 1.3)); ctx.lineTo(...f(u + 1.6, 1.3)) } ctx.lineWidth = px(0.4); ctx.stroke()
    }
  }
  /** Bell tent: circular canvas, panels (gores) running from the pole cap to the skirt, a door wedge, guy ropes all round. */
  function bellTent(cx, cy, R, o) {
    o = o || {}
    const n = o.n || 10, a0 = o.a0 == null ? 0.6 : o.a0, ca = o.col || P.canvas
    const guy = []; for (let i = 0; i < n; i++) { const a = a0 + ((i + 0.5) * TAU) / n; if (i === o.door) continue; guy.push([[cx + cos(a) * R * 0.97, cy + sin(a) * R * 0.97], [cx + cos(a + j(0.05)) * (R + 13), cy + sin(a) * (R + 13)]]) }
    if (o.ropes !== false) guys(guy)
    // door flap, tied back, curling out of the skirt
    const da = a0 + ((o.door == null ? 3 : o.door) + 0.5) * TAU / n
    const body = []
    for (let i = 0; i < n * 4; i++) { const a = (i / (n * 4)) * TAU, e = 1 + 0.018 * Math.sin(a * n * 0.5 * 2 + a0) + j(0.01); body.push([cx + cos(a) * R * e, cy + sin(a) * R * e]) }
    shadow(body, 8)
    if (o.door != null || o.door === undefined) {
      const fl = [], hw = (TAU / n) * 0.62
      for (let i = 0; i <= 8; i++) { const t = i / 8, a = da - hw + 2 * hw * t, rad = R * (0.9 + 0.2 * Math.sin(PI * t)); fl.push([cx + cos(a) * rad, cy + sin(a) * rad]) }
      fl.push([cx + cos(da) * R * 0.55, cy + sin(da) * R * 0.55])
      obj(cr(fl, true, 3), { h: 2, col: ca, shade: 1, sd: 4, line: 1 })
    }
    poly(body); ctx.fillStyle = PAPER; ctx.fill()
    if (COL) { tint(body, ca, 0.8); if (o.stripe) for (let i = 0; i < n; i += 2) { const a = a0 + (i * TAU) / n, b = a + TAU / n; tone([[cx, cy], [cx + cos(a) * R * 1.05, cy + sin(a) * R * 1.05], [cx + cos((a + b) / 2) * R * 1.1, cy + sin((a + b) / 2) * R * 1.1], [cx + cos(b) * R * 1.05, cy + sin(b) * R * 1.05]], o.stripeCol || P.red, 0.5) } }
    if (det >= 1) { shadeIn(body, R * 0.34, { gap: 2.6 }) }
    // gores: seams from the apex, each slightly bowed, and folds near the skirt
    ctx.beginPath()
    for (let i = 0; i < n; i++) {
      const a = a0 + (i * TAU) / n, pts = []
      for (let q = 0; q <= 6; q++) { const t = q / 6, rad = R * (0.1 + 0.88 * t); pts.push([cx + cos(a + 0.05 * Math.sin(PI * t)) * rad, cy + sin(a + 0.05 * Math.sin(PI * t)) * rad]) }
      ctx.moveTo(pts[0][0], pts[0][1]); for (let q = 1; q < pts.length; q++) ctx.lineTo(pts[q][0], pts[q][1])
    }
    ctx.lineWidth = px(0.7); ctx.strokeStyle = INK; ctx.stroke()
    if (det >= 1) { // folds fanning from the skirt toward the apex, between the seams
      for (let i = 0; i < n; i++) { const a = a0 + ((i + 0.5) * TAU) / n; for (const dd of [-0.08, 0.08]) { const l = R * rr(0.12, 0.28); seg(cx + cos(a + dd) * R * 0.95, cy + sin(a + dd) * R * 0.95, cx + cos(a + dd * 0.6) * (R * 0.95 - l), cy + sin(a + dd * 0.6) * (R * 0.95 - l)) } }
      flush(0.45)
    }
    pen(body, 1.45)
    // apex cap
    const cap = ellP(cx, cy, R * 0.1); poly(cap); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(cap, P.woodD, 0.7); pen(cap, 1)
    if (det >= 2) { solidDot(cx, cy, R * 0.025, INK) }
  }
  const tents = [
    // 0: big ridge tent with a tied-back door flap
    () => ridgeTent(0, 1, 70, 48, -0.06, { rl: 11, sag: 2.4 }),
    // 1: bell tent
    () => bellTent(-1, -1, 35, { n: 12, a0: 0.45, door: 5 }),
    // 2: lean-to: a canvas sheet hung from a ridge rope between two poles, pegged low
    () => {
      const top = [[-36, -20], [38, -23]], low = [[-44, 25], [44, 22]]
      guys([[top[0], [-49, -34]], [top[1], [49, -37]], [[-44, 25], [-50, 35]], [[44, 22], [50, 34]], [[-12, 24], [-14, 38]], [[16, 23], [18, 37]]])
      line([[-49, -34], top[0], top[1], [49, -37]], 0.8, { taper: 0.1, wob: 0.5 })
      const pts = [[-40, -20], [-18, -25], [10, -22], [40, -23], [46, 0], [47, 22], [20, 27], [-10, 25], [-47, 25], [-44, 2]]
      const cv = cr(pts, true, 3)
      shadow(cv, 6); obj(cv, { col: P.canvas, a: 0.8, sd: 12, line: 1.45 })
      // wrinkles radiating from the pegged corners, folds near the ridge
      for (const [px0, py0, ex, ey] of [[-46, 24, 0.55, -0.8], [46, 21, -0.5, -0.85]]) for (let i = 0; i < 6; i++) { const l = rr(14, 34), a = Math.atan2(ey, ex) + (i - 2.5) * 0.15; seg(px0 + j(1), py0 + j(1), px0 + cos(a) * l, py0 + sin(a) * l) }
      folds([-36, -20], [38, -22], 11, 14, 0, 1, 0.8)
      flush(0.5)
      for (const q of [[-37, -20], [38, -22]]) { solidDot(q[0], q[1], 3.6, PAPER); ctx.beginPath(); ctx.arc(q[0], q[1], 3.6, 0, TAU); ctx.lineWidth = px(1.1); ctx.stroke(); solidDot(q[0], q[1], 1.2, INK) }
    },
    // 3: square pavilion with a scalloped valance and a pennant
    () => {
      const a = 0.05, f = F(0, 0, a), h = 33
      guys([[f(-h, -h), f(-h - 11, -h - 10)], [f(h, -h), f(h + 10, -h - 10)], [f(h, h), f(h + 10, h + 11)], [f(-h, h), f(-h - 10, h + 11)], [f(0, -h), f(0, -h - 12)], [f(0, h), f(0, h + 12)], [f(-h, 0), f(-h - 12, 0)], [f(h, 0), f(h + 12, 0)]].map(([p, q]) => [p, q]))
      const body = [f(-h, -h), f(h, -h), f(h, h), f(-h, h)]
      shadow(body, 8)
      poly(body); ctx.fillStyle = PAPER; ctx.fill()
      const hip = [[f(-h, -h), f(h, -h)], [f(h, -h), f(h, h)], [f(h, h), f(-h, h)], [f(-h, h), f(-h, -h)]]
      const faces = hip.map(([p, q]) => [p, q, f(0, 0)])
      if (COL) { tint(body, P.canvas, 0.75); [0, 2].forEach((i) => tone(faces[i], P.red, 0.5)) }
      // lower-right faces turn from the light
      if (COL) { tone(faces[1], P.shade, 0.2); tone(faces[2], P.shade, 0.2) }
      if (det >= 1) { hatchIn(faces[1], a + PI / 2, 2.6, 0.5); hatchIn(faces[2], a, 2.6, 0.5); if (!COL) { hatchIn(faces[0], a, 1.7, 0.4); } }
      if (!COL && det >= 1) { hatchIn(faces[3], a + PI / 2, 1.9, 0.4) }
      for (const [p] of hip) rule(p, f(0, 0), 0.95, { taper: 0.25 })
      pen(body, 1.45)
      // valance: scalloped strip round the edge
      for (let i = 0; i < 4; i++) {
        const [p, q] = hip[i], d = hypot(q[0] - p[0], q[1] - p[1]), nx = (q[1] - p[1]) / d, ny = -(q[0] - p[0]) / d
        const sc = scal(p, q, 7, 3.6, -1, 4).map(([x, y]) => [x - nx * 0 , y - ny * 0])
        ctx.save(); ctx.beginPath(); ctx.moveTo(p[0], p[1]); for (const [x, y] of sc) ctx.lineTo(x, y); ctx.closePath()
        const mk = () => { ctx.beginPath(); ctx.moveTo(p[0], p[1]); for (const [x, y] of sc) ctx.lineTo(x, y); ctx.closePath() }
        mk(); ctx.fillStyle = PAPER; ctx.fill(); ctx.restore()
        if (COL) { ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = i % 2 ? P.canvas : P.ochre; ctx.beginPath(); ctx.moveTo(p[0], p[1]); for (const [x, y] of sc) ctx.lineTo(x, y); ctx.closePath(); ctx.fill(); ctx.restore() }
        line(sc, 0.9, { taper: 0.15, wob: 0.3 })
      }
      pen(body, 1.3, { wmul: 0.8 })
      // finial and pennant
      const c = ellP(0, 0, 3.3); poly(c); ctx.fillStyle = PAPER; ctx.fill(); pen(c, 1)
      if (det >= 1) { const fl = [[2, -1.2], [17, -2.6 + j(0.6)], [12.5, 0.2], [17, 3], [2, 1.2]]; poly(fl); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(fl, P.red, 0.85); pen(fl, 0.8, { flat: true }); if (!COL) hatchIn(fl, 0.2, 1.3, 0.4, { minG: 1.1 }) }
    },
    // 4: tipi: hide panels, pole tips crossing at the top, ear flaps
    () => {
      const cx = -2, cy = 1, R = 34, body = []
      for (let i = 0; i < 40; i++) { const a = (i / 40) * TAU, e = 1 + 0.05 * Math.sin(a * 2 + 1); body.push([cx + cos(a) * R * e * 0.96, cy + sin(a) * R * e * 1.02]) }
      guys([[[cx - 18, cy + 28], [cx - 28, cy + 44]], [[cx + 22, cy + 26], [cx + 30, cy + 43]], [[cx + 35, cy - 8], [cx + 47, cy - 12]]], 0.8)
      shadow(body, 8); poly(body); ctx.fillStyle = PAPER; ctx.fill()
      if (COL) { tint(body, P.canvasD, 0.7); tone(body, P.woodL, 0.25) }
      if (det >= 1) shadeIn(body, R * 0.36, { gap: 2.5 })
      // patchy hides: some panels mottled
      const pan = 9
      for (let i = 0; i < pan; i++) {
        const a = (i * TAU) / pan + 0.3, a2 = a + TAU / pan, pp = [[cx, cy], [cx + cos(a) * R * 1.05, cy + sin(a) * R * 1.05], [cx + cos((a + a2) / 2) * R * 1.1, cy + sin((a + a2) / 2) * R * 1.1], [cx + cos(a2) * R * 1.05, cy + sin(a2) * R * 1.05]]
        ctx.save(); clipTo(body)
        if (i % 3 === 0 && COL) tone(pp, P.woodD, 0.18)
        if (i % 3 === 1 && det >= 1) stipIn(pp, 26, 0.6)
        ctx.restore()
      }
      ctx.beginPath()
      for (let i = 0; i < pan; i++) { const a = (i * TAU) / pan + 0.3; ctx.moveTo(cx + cos(a) * 6, cy + sin(a) * 6); for (let q = 1; q <= 6; q++) { const t = q / 6, rad = 6 + (R * 0.97 - 6) * t; ctx.lineTo(cx + cos(a + 0.06 * Math.sin(PI * t)) * rad, cy + sin(a + 0.06 * Math.sin(PI * t)) * rad) } }
      ctx.lineWidth = px(0.75); ctx.strokeStyle = INK; ctx.stroke()
      // lacing along the door overlap
      if (det >= 1) { for (let q = 0; q < 6; q++) { const t = (q + 0.5) / 6, rad = 8 + (R - 11) * t, a = 0.3 + 0.12; seg(cx + cos(a - 0.09) * rad, cy + sin(a - 0.09) * rad, cx + cos(a + 0.09) * rad, cy + sin(a + 0.09) * rad) } flush(0.6) }
      pen(body, 1.45)
      // door flap (lower-right) and pole tips crossing at the top
      const da = 2.3, fa = [cx + cos(da) * R * 0.62, cy + sin(da) * R * 0.62], fe = [cx + cos(da) * R * 1.22, cy + sin(da) * R * 1.22], nx = -sin(da), ny = cos(da)
      const flc = cr([fa, [fa[0] * 0.5 + fe[0] * 0.5 + nx * 7, fa[1] * 0.5 + fe[1] * 0.5 + ny * 7], fe, [fa[0] * 0.5 + fe[0] * 0.5 - nx * 7, fa[1] * 0.5 + fe[1] * 0.5 - ny * 7]], true, 4)
      obj(flc, { h: 2, col: P.woodL, a: 0.7, shade: 1, sd: 3, line: 1.1 })
      if (det >= 1) { line([fa, fe], 0.6, { taper: 0.4, wob: 0.3 }); for (let q = 1; q < 4; q++) { const t = q / 4, p = lerp(fa, fe, t); line([[p[0] - nx * 2.4, p[1] - ny * 2.4], [p[0] + nx * 2.4, p[1] + ny * 2.4]], 0.6, { taper: 0.2, wob: 0.2 }) } }
      for (let i = 0; i < 9; i++) { const a = (i * TAU) / 9 + j(0.1), l = rr(6, 12); const p0 = [cx + cos(a) * 1, cy + sin(a) * 1]; line([p0, [cx + cos(a) * l, cy + sin(a) * l]], 1.7, { taper: 0.25, wob: 0.2 }) }
      for (const sg of [-1, 1]) { const ear = [[cx - 1, cy + sg * 3], [cx - 9, cy + sg * 9], [cx - 5, cy + sg * 2]]; poly(ear); ctx.fillStyle = PAPER; ctx.fill(); pen(ear, 0.8) }
    },
    // 5: two pup tents
    () => { ridgeTent(-9, -17, 56, 30, -0.1, { rl: 9, sag: 1.6, h: 5, flap: true }); ridgeTent(7, 25, 50, 28, 0.12, { rl: 8, sag: 1.5, h: 5, flap: true, col: P.canvasD }) },
    // 6: collapsed tent: slack canvas in a heap, a snapped pole, ropes lying in loops
    () => {
      const n = 7, ctl = [], base = 0.4
      for (let i = 0; i < n; i++) { const a = base + (i / n) * TAU + j(0.1); ctl.push([cos(a) * (37 + j(3)), sin(a) * (34 + j(3))]); const b = a + PI / n + j(0.1); ctl.push([cos(b) * (30 + j(2.5)), sin(b) * (27 + j(2.5))]) }
      const pts = cr(ctl, true, 2)
      // tangled ropes and the pegs that still hold
      const corners = ctl.filter((_, i) => i % 2 === 0)
      guys([[corners[0], [corners[0][0] + 12, corners[0][1] + 7]], [corners[2], [corners[2][0] - 3, corners[2][1] + 14]], [corners[4], [corners[4][0] - 13, corners[4][1] - 4]]], 2.4)
      line([corners[5], [corners[5][0] - 6, corners[5][1] - 6], [corners[5][0] - 3, corners[5][1] - 12], [corners[5][0] - 10, corners[5][1] - 11]], 0.7, { taper: 0.1, wob: 0.4 })
      line([corners[6], [corners[6][0] + 5, corners[6][1] - 7], [corners[6][0] + 12, corners[6][1] - 3], [corners[6][0] + 9, corners[6][1] - 10]], 0.7, { taper: 0.1, wob: 0.4 })
      shadow(pts, 4); poly(pts); ctx.fillStyle = PAPER; ctx.fill()
      if (COL) tint(pts, P.canvas, 0.8)
      // drapery: folds running from the collapsed ridge out to each corner
      ctx.save(); clipTo(pts)
      const hub = [-2, -3]
      corners.forEach((c, i) => {
        const mid = [(hub[0] + c[0]) / 2 + j(5), (hub[1] + c[1]) / 2 + j(5)], tip = [c[0] * 0.9, c[1] * 0.9]
        const fold = cr([hub, mid, tip], false, 4)
        line(fold, 1.25, { taper: 0.5, wob: 0.8 })
        if (det >= 1) { const sh = fold.map(([x, y]) => [x + 1.8, y + 2.2]); hatchIn(fold.concat(sh.slice().reverse()), -0.8, 1.7, 0.45, { minG: 1.3 }); if (COL) tone(fold.concat(sh.slice().reverse()), P.shade, 0.25) }
      })
      for (let i = 0; i < 6; i++) { const c = corners[(r() * corners.length) | 0], t = rr(0.35, 0.6), p0 = [c[0] * t, c[1] * t]; line([p0, [p0[0] + c[0] * 0.18 + j(3), p0[1] + c[1] * 0.18 + j(3)]], 0.6, { taper: 0.7, wob: 0.5 }) }
      ctx.restore()
      if (det >= 1) shadeIn(pts, 10, { gap: 2.4, cross: false })
      pen(pts, 1.45, { wob: 1.4 })
      for (const c of corners) { const g = ellP(c[0] * 0.93, c[1] * 0.93, 1.5); poly(g); ctx.fillStyle = PAPER; ctx.fill(); pen(g, 0.7, { flat: true }) }
      // snapped pole: a standing stump and the broken-off piece lying across
      const stump = bar(hub, [hub[0] + 1, hub[1] - 17], 2.8); obj(stump, { h: 3, col: P.woodL, shade: 0, line: 1 })
      line([[hub[0] + 1, hub[1] - 17], [hub[0] + 3, hub[1] - 21], [hub[0] - 1, hub[1] - 20], [hub[0] + 1, hub[1] - 24]], 0.8, { taper: 0.1, wob: 0.2 })
      const piece = bar([-10, 14], [16, 4], 2.8); obj(piece, { h: 3, col: P.woodL, shade: 0, line: 1 })
    },
    // 7: long striped marquee with scalloped valance
    () => {
      const a = 0.0, f = F(0, 2, a), L = 86, W = 50, hl = L / 2, hw = W / 2, ns = 8
      guys([[f(hl + 3, 0), f(hl + 14, 2)], [f(-hl - 3, 0), f(-hl - 14, -2)], [f(-hl * 0.5, -hw), f(-hl * 0.55, -hw - 10)], [f(hl * 0.5, -hw), f(hl * 0.55, -hw - 10)], [f(-hl * 0.5, hw), f(-hl * 0.55, hw + 10)], [f(hl * 0.5, hw), f(hl * 0.55, hw + 10)]])
      const body = rectP(0, 2, L, W - 6, a)
      shadow(body, 6)
      poly(body); ctx.fillStyle = PAPER; ctx.fill()
      const stripe = (i) => { const u0 = -hl + (L * i) / ns, u1 = -hl + (L * (i + 1)) / ns; return [f(u0, -hw + 3), f(u1, -hw + 3), f(u1, hw - 3), f(u0, hw - 3)] }
      if (COL) { tint(body, P.canvas, 0.7); for (let i = 0; i < ns; i += 2) tone(stripe(i), P.blue, 0.55) }
      const lo = [f(-hl, 0), f(hl, 0), f(hl, hw - 3), f(-hl, hw - 3)]
      if (COL) tone(lo, P.shade, 0.2)
      for (let i = 0; i < ns; i += 2) if (det >= 1 && !COL) hatchIn(stripe(i), PI / 2, 1.7, 0.4)
      if (det >= 1) { hatchIn(lo, PI / 2 + 0.05, 3.1, 0.5, { minG: 1.7 }); folds(f(-hl + 2, -hw + 4), f(hl - 2, -hw + 4), 12, 12, 0, 1, 0.5); flush(0.4) }
      pen(body, 1.4)
      // scalloped valance along both long edges, sagging poles at the centre
      for (const sg of [-1, 1]) { const p = f(-hl, sg * (hw - 3)), q = f(hl, sg * (hw - 3)), sc = scal(p, q, ns * 2, 3.8, sg > 0 ? -1 : 1, 4); ctx.beginPath(); ctx.moveTo(p[0], p[1]); for (const [x, y] of sc) ctx.lineTo(x, y); ctx.closePath(); ctx.fillStyle = PAPER; ctx.fill(); if (COL) { ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = P.blue; ctx.fill(); ctx.restore() } line(sc, 0.9, { taper: 0.1, wob: 0.3 }) }
      rule(f(-hl - 5, 0), f(hl + 5, 0), 1.7, { taper: 0.25 })
      for (const u of [-hl * 0.5, hl * 0.5]) { const q = f(u, 0); solidDot(q[0], q[1], 2.6, PAPER); ctx.beginPath(); ctx.arc(q[0], q[1], 2.6, 0, TAU); ctx.lineWidth = px(1); ctx.stroke(); solidDot(q[0], q[1], 0.9, INK) }
    },
  ]
  reg('bm-tent', 'Tent', 'bm-camp', 'fixed', tents)

  /* =====================================================================================================
     Campfire (recipe): scorched ground, stone ring, charred logs, layered flames, embers
     ===================================================================================================== */
  /** One flame tongue from (cx, cy) pointing along ang; curl bends the tip sideways. */
  function flameP(cx, cy, len, wid, ang, curl) {
    const f = F(cx, cy, ang); curl = curl || 0
    return cr([f(0, -wid * 0.35), f(len * 0.3, -wid * 0.62), f(len * 0.62, -wid * 0.4 + curl * len * 0.2), f(len * 0.9, curl * len * 0.3), f(len, curl * len * 0.46), f(len * 0.76, wid * 0.08 + curl * len * 0.28), f(len * 0.5, wid * 0.36), f(len * 0.25, wid * 0.62), f(0, wid * 0.35)], true, 3)
  }
  function charLog(cx, cy, L, Wd, ang, o) {
    o = o || {}
    const f = F(cx, cy, ang), pts = rrect(cx, cy, L, Wd, Wd * 0.4, ang)
    obj(pts, { h: 3, col: P.coal, a: 0.85, sd: Wd * 0.4, line: 1.3 })
    // charred hatching along the grain, bark cracks across
    if (det >= 1) { ctx.save(); clipTo(pts); hatchBox(cx - L, cy - L, cx + L, cy + L, ang, 2.4, 0.55); ctx.restore() }
    ctx.beginPath()
    for (let u = -L / 2 + 5; u < L / 2 - 3; u += rr(4, 8)) { const v = rr(-Wd * 0.35, Wd * 0.35); ctx.moveTo(...f(u, v)); ctx.lineTo(...f(u + rr(-1.5, 1.5), v + rr(2, 4) * (v > 0 ? 1 : -1) * 0.8)) }
    ctx.lineWidth = px(0.55); ctx.strokeStyle = COL ? P.woodL : PAPER; ctx.globalAlpha = 0.8; ctx.stroke(); ctx.globalAlpha = 1
    // cut end showing rings
    const e = ellP(...f(L / 2 - Wd * 0.18, 0), Wd * 0.2, Wd * 0.42, ang)
    poly(e); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(e, P.woodL, 0.7); pen(e, 0.7, { flat: true })
    if (det >= 2) { const e2 = ellP(...f(L / 2 - Wd * 0.18, 0), Wd * 0.09, Wd * 0.2, ang); pen(e2, 0.5, { flat: true }) }
  }
  reg('bm-campfire', 'Campfire', 'bm-camp', 'recipe', [() => {
    const ns = 9 + ((r() * 3) | 0), Rr = 35 + j(1.5), ph = r() * TAU
    // scorched ground, painted first so the stones sit in it
    const burn = blob(0, 0, 43, 43, 0, 14, 0.14, 3)
    if (COL) tint(burn, P.earthD, 0.3)
    if (det >= 1) { stipIn(burn, det >= 2 ? 110 : 50, 0.55) }
    const ash = blob(0, 0, Rr - 3, Rr - 3, 0, 12, 0.1, 3)
    poly(ash); ctx.fillStyle = PAPER; ctx.fill()
    if (COL) { tint(ash, P.coal, 0.75); tone(ash, P.ash, 0.25) }
    else if (det >= 1) { hatchIn(ash, 0.6, 4.4, 0.35, { minG: 2.6 }); stipIn(ash, 90, 0.7) }
    // ink: a close-hatched scorched heart under the logs so the paper-white flames stand out
    if (!COL && det >= 1) { const core = blob(0, 0, 21, 20, 0, 11, 0.12, 3); hatchIn(core, 1.8, 2.3, 0.6, { minG: 1.6 }); if (det >= 2) hatchIn(core, 0.4, 3, 0.45, { minG: 1.8 }) }
    // stones
    const stones = []
    for (let i = 0; i < ns; i++) { const a = ph + (i / ns) * TAU + j(0.08), rad = Rr + j(2.2); stones.push([Math.cos(a) * rad, Math.sin(a) * rad, a]) }
    stones.sort((p, q) => p[1] - q[1])
    for (const [x, y, a] of stones) {
      const rx = rr(8.2, 10.8), ry = rr(6.2, 8.2), b = blob(x, y, rx, ry, a + PI / 2, 9, 0.12, 3)
      obj(b, { h: 3.5, col: [P.stone, P.stoneL, P.stoneD][(r() * 3) | 0], a: 0.8, sd: ry * 0.55, line: 1.25 })
      if (det >= 1) { // soot on the fire side, a crack
        const sx = x - Math.cos(a) * ry * 0.5, sy = y - Math.sin(a) * ry * 0.5
        ctx.save(); clipTo(b); ctx.beginPath(); for (let q = 0; q < (det >= 2 ? 9 : 4); q++) { const px0 = sx + j(ry * 0.9), py0 = sy + j(ry * 0.9); ctx.moveTo(px0 + 0.7, py0); ctx.arc(px0, py0, 0.55 / k * lw * rr(0.7, 1.3), 0, TAU) } ctx.fillStyle = INK; ctx.fill(); ctx.restore()
        if (det >= 2 && r() < 0.6) { const c0 = [x + j(rx * 0.4), y + j(ry * 0.4)]; line([c0, [c0[0] + rr(2, 5), c0[1] + rr(-2, 3)], [c0[0] + rr(4, 8), c0[1] + rr(0, 5)]], 0.5, { taper: 0.5, wob: 0.3 }) }
      }
    }
    // logs: a pinwheel, a cross, or a lean-to, chosen by the seed
    const kind = (r() * 3) | 0, nl = kind === 1 ? 2 : 3 + ((r() * 2) | 0), a0 = r() * TAU, logs = []
    for (let i = 0; i < nl; i++) {
      const a = kind === 1 ? a0 + i * (PI / 2) + j(0.2) : a0 + (i / nl) * TAU + j(0.25), d = kind === 1 ? 0 : rr(8, 13)
      logs.push([Math.cos(a) * d + (kind === 1 ? 0 : -Math.sin(a) * 4), Math.sin(a) * d, a + (kind === 1 ? 0 : 0.35), rr(36, 46), rr(8, 10.5)])
    }
    logs.sort((p, q) => p[1] - q[1])
    for (const [x, y, a, L, Wd] of logs) charLog(x, y, L, Wd, a, {})
    // flames: three rings of tongues, each shorter and paler, then a couple of tall ones; no two alike
    if (COL) tint(blob(0, 0, 22, 21, 0, 9, 0.12, 3), P.flame, 0.2)
    const tongue = (len, wid, a, col, wgt, ink, curl) => {
      if (!COL) { len *= 1.1; wid *= 1.06 }
      const p = flameP(Math.cos(a) * len * 0.1, Math.sin(a) * len * 0.1, len, wid, a, curl)
      poly(p); ctx.fillStyle = PAPER; ctx.fill()
      if (COL) { ctx.save(); ctx.globalAlpha = 0.84; ctx.fillStyle = col; poly(p); ctx.fill(); ctx.restore() }
      if (ink) line(p.concat([p[0]]), wgt, { taper: 0.55, wob: 0.5 })
    }
    const ring = (n, l0, l1, wid, col, wgt, ink) => { const aa = r() * TAU; for (let i = 0; i < n; i++) tongue(rr(l0, l1), wid * rr(0.8, 1.2), aa + ((i + j(0.3)) / n) * TAU, col, wgt, ink, j(0.55)) }
    ring(6 + ((r() * 3) | 0), 14, 21, 10, P.flameR, 1.1, true)
    ring(5 + ((r() * 2) | 0), 9, 14.5, 8, P.flame, 0.9, true)
    tongue(rr(15, 19), 7.5, r() * TAU, P.flame, 0.9, true, j(0.6))
    ring(4, 5, 8.5, 5.5, P.flameL, 0.7, det >= 1)
    if (det >= 1) { // lick lines inside the flames
      for (let i = 0; i < 6; i++) { const a = r() * TAU, d = rr(2, 7); line([[Math.cos(a) * d, Math.sin(a) * d], [Math.cos(a + 0.3) * (d + rr(5, 9)), Math.sin(a + 0.3) * (d + rr(5, 9))]], 0.5, { taper: 0.8, wob: 0.3 }) }
    }
    // embers and sparks
    ctx.beginPath()
    for (let i = 0; i < (det >= 1 ? 16 : 6); i++) { const a = r() * TAU, d = rr(14, 40), q = rr(0.5, 1.15) / k * lw; ctx.moveTo(Math.cos(a) * d + q, Math.sin(a) * d); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, q, 0, TAU) }
    ctx.fillStyle = COL ? P.flameR : INK; ctx.fill()
  }])

  /* =====================================================================================================
     Bedrolls
     ===================================================================================================== */
  /** A rolled bedroll: a fat sausage of blanket with layers, woven end stripes and two leather straps. */
  function rolledBlanket(cx, cy, L, Wd, ang, col, o) {
    o = o || {}
    const f = F(cx, cy, ang), pts = rrect(cx, cy, L, Wd, Wd * 0.46, ang)
    obj(pts, { h: 4, col: col || P.canvasD, a: 0.8, sd: Wd * 0.34, line: 1.4 })
    ctx.save(); clipTo(pts)
    // layers of the roll and woven end bands
    ctx.beginPath(); for (const v of [-0.22, 0.12, 0.34]) { ctx.moveTo(...f(-L / 2 + 3, v * Wd)); ctx.lineTo(...f(L / 2 - 3 - rr(0, 6), v * Wd + j(0.5))) }
    ctx.lineWidth = px(0.5); ctx.stroke()
    for (const sg of [-1, 1]) { const u = sg * (L / 2 - Wd * 0.28); ctx.beginPath(); for (const d of [-1.6, 1.6]) { ctx.moveTo(...f(u + d, -Wd / 2)); ctx.lineTo(...f(u + d, Wd / 2)) } ctx.lineWidth = px(0.7); ctx.stroke(); if (COL) tone([f(u - 1.6, -Wd / 2), f(u + 1.6, -Wd / 2), f(u + 1.6, Wd / 2), f(u - 1.6, Wd / 2)], o.band || P.red, 0.5) }
    ctx.restore()
    // straps
    for (const sg of [-1, 1]) {
      const u = sg * L * 0.22, st = rectP(...f(u, 0), 4.6, Wd + 2.2, ang)
      poly(st); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tone(st, P.leather, 0.75); pen(st, 0.85, { flat: true })
      const bk = rectP(...f(u, Wd * 0.18), 3, 3.2, ang); poly(bk); ctx.fillStyle = PAPER; ctx.fill(); pen(bk, 0.7, { flat: true })
      if (det >= 2) { seg(...f(u + 1, Wd * 0.34), ...f(u + 1, Wd * 0.5)); flush(0.6) }
    }
  }
  /** A backpack from above: L along the pack (top at +u), W across. Pockets, a flap with two buckled straps, a bedroll on top. */
  function pack(cx, cy, L, W, ang, o) {
    o = o || {}
    const f = F(cx, cy, ang), lc = o.col || P.leather
    for (const sg of [-1, 1]) { const pk = rrect(...f(-L * 0.04, sg * (W * 0.5 + 0.2)), L * 0.5, W * 0.2, 2.4, ang); obj(pk, { h: sg > 0 ? 4 : 0, col: lc, a: 0.7, sd: 2, line: 1, flat: true }) }
    const body = rrect(cx, cy, L, W, W * 0.2, ang)
    obj(body, { h: 5, col: lc, a: 0.75, sd: W * 0.28, line: 1.4 })
    if (det >= 1) { ctx.beginPath(); for (const v of [-0.3, 0.3]) { ctx.moveTo(...f(-L * 0.46, v * W)); ctx.lineTo(...f(-L * 0.12, v * W + j(0.3))) } ctx.lineWidth = px(0.45); ctx.stroke() }
    const fl = rrect(...f(L * 0.16, 0), L * 0.62, W * 0.9, W * 0.22, ang)
    obj(fl, { h: 0, col: o.flap || P.woodD, a: 0.65, sd: W * 0.18, line: 1.2 })
    for (const sg of [-1, 1]) {
      const bs = bar(f(-L * 0.12, sg * W * 0.24), f(L * 0.4, sg * W * 0.24), 3.2); obj(bs, { h: 0, col: P.leather, a: 0.8, shade: 0, line: 0.7, flat: true })
      const bk = rectP(...f(-L * 0.04, sg * W * 0.24), 4.2, 5, ang); poly(bk); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tone(bk, P.brass, 0.8); pen(bk, 0.75, { flat: true })
    }
    if (det >= 2) { ctx.beginPath(); ctx.arc(...f(L * 0.5 + 1.2, 0), 3.4, -PI / 2 + ang, PI / 2 + ang); ctx.lineWidth = px(1.3); ctx.strokeStyle = INK; ctx.stroke() }
    if (o.roll) rolledBlanket(...f(L * 0.46, 0), W * 1.06, 12, ang + PI / 2, o.roll, { band: P.red })
  }
  /** A leather waterskin: round belly, narrow neck with a cork, a strap loop. */
  function waterskin(cx, cy, L, W, ang) {
    const f = F(cx, cy, ang)
    const pts = cr([f(-L / 2, 0), f(-L * 0.42, -W * 0.42), f(-L * 0.1, -W * 0.5), f(L * 0.16, -W * 0.36), f(L * 0.3, -W * 0.14), f(L * 0.46, -W * 0.1), f(L * 0.5, 0), f(L * 0.46, W * 0.1), f(L * 0.3, W * 0.14), f(L * 0.16, W * 0.36), f(-L * 0.1, W * 0.5), f(-L * 0.42, W * 0.42)], true, 3)
    obj(pts, { h: 3, col: P.leather, a: 0.75, sd: W * 0.28, line: 1.25 })
    const ck = ellP(...f(L * 0.5, 0), W * 0.11, W * 0.09, ang); obj(ck, { col: P.woodL, a: 0.8, shade: 0, line: 0.8, h: 0 })
    if (det >= 1) { ctx.beginPath(); ctx.moveTo(...f(-L * 0.45, -W * 0.1)); ctx.lineTo(...f(L * 0.3, -W * 0.06)); ctx.moveTo(...f(-L * 0.45, W * 0.12)); ctx.lineTo(...f(L * 0.3, W * 0.08)); ctx.lineWidth = px(0.45); ctx.stroke() }
    ctx.beginPath(); ctx.ellipse(...f(L * 0.3, 0), W * 0.2, W * 0.26, ang, 0, TAU); ctx.lineWidth = px(0.8); ctx.stroke()
  }
  /** A laid-out blanket with woven border stripes, a folded corner and wrinkles. */
  function blanket(cx, cy, w, h, ang, col, o) {
    o = o || {}
    const f = F(cx, cy, ang), hw = w / 2, hh = h / 2, d = o.fold == null ? 14 : o.fold
    const raw = o.fold === 0 ? [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]] : [[-hw, -hh], [hw - d, -hh], [hw, -hh + d], [hw, hh], [-hw, hh]]
    const dense = densify(raw, true, 6).map(([u, v], i) => f(u + Math.sin(i * 1.3) * 0.7 + j(0.5), v + Math.cos(i * 1.9) * 0.7 + j(0.5)))
    obj(dense, { h: 2.5, col: col || P.red, a: 0.7, sd: 6, line: 1.3 })
    ctx.save(); clipTo(dense)
    ctx.beginPath()
    for (const ins of [4.5, 7.5]) { ctx.moveTo(...f(-hw, -hh + ins)); ctx.lineTo(...f(hw, -hh + ins)); ctx.moveTo(...f(-hw, hh - ins)); ctx.lineTo(...f(hw, hh - ins)) }
    ctx.lineWidth = px(0.55); ctx.stroke()
    if (COL) { tone([f(-hw, -hh + 4.5), f(hw, -hh + 4.5), f(hw, -hh + 7.5), f(-hw, -hh + 7.5)], o.stripe || P.canvas, 0.7); tone([f(-hw, hh - 7.5), f(hw, hh - 7.5), f(hw, hh - 4.5), f(-hw, hh - 4.5)], o.stripe || P.canvas, 0.7) }
    else if (det >= 1) { hatchIn([f(-hw, -hh + 4.5), f(hw, -hh + 4.5), f(hw, -hh + 7.5), f(-hw, -hh + 7.5)], ang + PI / 2, 2.2, 0.4); hatchIn([f(-hw, hh - 7.5), f(hw, hh - 7.5), f(hw, hh - 4.5), f(-hw, hh - 4.5)], ang + PI / 2, 2.2, 0.4) }
    // wrinkles
    if (det >= 1) { for (let i = 0; i < 6; i++) { const u = rr(-hw * 0.8, hw * 0.7), v = rr(-hh * 0.45, hh * 0.45), l = rr(6, 14); line([f(u, v), f(u + l * 0.5, v + j(1.5)), f(u + l, v + j(2))], 0.6, { taper: 0.8, wob: 0.4 }) } }
    ctx.restore()
    if (o.fold !== 0) { // the folded-over corner shows the pale underside
      const fp = [f(hw - d, -hh), f(hw, -hh + d), f(hw - d, -hh + d)]
      obj(fp, { h: 1.5, col: P.cloth, a: 0.8, shade: 0, line: 1.1 })
      if (det >= 1) hatchIn(fp, 0.8, 2.2, 0.4)
    }
  }
  /** Fur pelt / straw bed: a ragged outline with fringe ticks. */
  function pelt(cx, cy, w, h, ang, col, o) {
    o = o || {}
    const f = F(cx, cy, ang), A = w / 2, B = h / 2, jt = () => j(0.04)
    // a hide laid flat: head at -u, four splayed legs, a tail to the right
    const hp = [[-1.04, 0.0], [-0.94, -0.2], [-0.78, -0.36], [-0.66, -0.78], [-0.46, -0.98], [-0.3, -0.72], [-0.1, -0.52], [0.2, -0.56], [0.4, -0.8], [0.64, -0.96], [0.8, -0.7], [0.82, -0.4], [1.0, -0.14], [1.1, 0.04], [0.98, 0.2], [0.84, 0.44], [0.78, 0.74], [0.6, 0.98], [0.38, 0.84], [0.2, 0.56], [-0.1, 0.52], [-0.3, 0.7], [-0.46, 0.96], [-0.68, 0.8], [-0.74, 0.4], [-0.92, 0.22]]
    const body = cr(hp.map(([u, v]) => f((u + jt()) * A, (v + jt()) * B)), true, 3)
    obj(body, { h: 2.5, col: col || P.fur, a: 0.75, sd: h * 0.2, line: 1.25, wob: 1.4 })
    // fur: short tapered strokes laid from the spine outward and slightly back; longer and denser toward the rim
    ctx.save(); clipTo(body)
    const cntF = det >= 3 ? 190 : det >= 2 ? 120 : det >= 1 ? 55 : 18
    ctx.beginPath()
    for (let i = 0; i < cntF; i++) {
      const u = rr(-0.95, 1.0) * A, v = rr(-1, 1) * B, sgn = v > 0 ? 1 : -1, l = rr(2.6, 5.4) * (0.6 + Math.abs(v) / B * 0.6)
      const x0 = u, y0 = v - sgn * l * 0.2, x1 = u + l * 0.55, y1 = v + sgn * l * 0.8
      const p0 = f(x0, y0), p1 = f(x1, y1), pm = f((x0 + x1) / 2 - sgn * 0.5, (y0 + y1) / 2)
      ctx.moveTo(p0[0], p0[1]); ctx.quadraticCurveTo(pm[0], pm[1], p1[0], p1[1])
    }
    ctx.lineWidth = px(0.5); ctx.strokeStyle = INK; ctx.stroke()
    // spine: a darker ridge of strokes down the middle
    if (det >= 1) { ctx.beginPath(); for (let u = -0.8; u < 0.95; u += 0.09) { ctx.moveTo(...f(u * A, j(1.5))); ctx.lineTo(...f(u * A + 3, j(1.5))) } ctx.lineWidth = px(0.55); ctx.stroke() }
    ctx.restore()
    // ragged fringe along the rim
    if (det >= 1) {
      ctx.beginPath()
      for (let i = 0; i < body.length; i++) {
        const p = body[i]; if (r() < 0.55) { const dx = p[0] - cx, dy = p[1] - cy, d = hypot(dx, dy) || 1, l = rr(1.2, 2.6); ctx.moveTo(p[0] - (dx / d) * 0.8, p[1] - (dy / d) * 0.8); ctx.lineTo(p[0] + (dx / d) * l + j(0.5), p[1] + (dy / d) * l + j(0.5)) }
      }
      ctx.lineWidth = px(0.55); ctx.stroke()
    }
  }
  const bedrolls = [
    // 0: rolled bedroll with straps
    () => rolledBlanket(0, 0, 90, 34, -0.3, P.canvasD, { band: P.red }),
    // 1: blanket laid out, folded corner, pillow roll
    () => { blanket(2, 2, 72, 46, 0.05, P.red, { fold: 15 }); rolledBlanket(-30, -2, 14, 30, 0.1, P.canvasD, { band: P.blue }) },
    // 2: blanket with a pack at the head
    () => { blanket(10, 0, 64, 42, -0.08, P.blue, { fold: 14, stripe: P.canvas }); pack(-30, -4, 42, 28, -PI / 2 + 0.1, { roll: P.canvasD }) },
    // 3: fur bed with a rolled cloak pillow
    () => { pelt(2, 4, 88, 56, 0.1, P.fur, {}); rolledBlanket(-26, -6, 14, 28, 0.15, P.leather, { band: P.canvas }) },
    // 4: quilted sleeping bag, tied hood
    () => {
      const f = F(0, 0, 0.3), pts = cr([f(-42, -17), f(-20, -21), f(20, -17), f(44, -9), f(46, 4), f(20, 17), f(-18, 21), f(-42, 17)], true, 4)
      obj(pts, { h: 3, col: P.green, a: 0.6, sd: 10, line: 1.4 })
      ctx.save(); clipTo(pts); ctx.beginPath()
      for (let u = -44; u < 48; u += 9) { ctx.moveTo(...f(u, -24)); ctx.lineTo(...f(u + 16, 24)); ctx.moveTo(...f(u + 16, -24)); ctx.lineTo(...f(u, 24)) }
      ctx.lineWidth = px(0.5); ctx.stroke(); ctx.restore()
      if (det >= 1) { ctx.beginPath(); ctx.moveTo(...f(-40, 0)); ctx.lineTo(...f(36, 3)); ctx.lineWidth = px(0.7); ctx.stroke() }
      pen(pts, 1.4)
      const hood = rrect(...f(-34, 0), 18, 30, 8, 0.3); obj(hood, { h: 2, col: P.canvasD, a: 0.7, sd: 6, line: 1.2 })
    },
    // 5: two bedrolls side by side with a pack between
    () => { blanket(0, -22, 78, 32, -0.04, P.red, { fold: 12 }); blanket(2, 23, 74, 32, 0.04, P.ochre, { fold: 0, stripe: P.canvas }); },
    // 6: straw pallet under a blanket
    () => {
      pelt(0, 3, 88, 54, 0.05, P.straw, {})
      blanket(12, 2, 54, 42, 0.08, P.plum, { fold: 12, stripe: P.canvas })
    },
    // 7: a rolled bedroll with pack and waterskin
    () => {
      rolledBlanket(-4, 24, 84, 26, -0.05, P.canvasD, { band: P.green })
      pack(-24, -18, 38, 28, 0.2 - PI / 2)
      waterskin(24, -22, 36, 24, 0.25)
    },
  ]
  reg('bm-bedroll', 'Bedroll', 'bm-camp', 'fixed', bedrolls)

  /* =====================================================================================================
     Woodpile: split logs, a chopping block and axe, sawbuck, kindling
     ===================================================================================================== */
  const woodTone = () => [P.wood, P.woodL, P.woodD, P.woodL][(r() * 4) | 0]
  /** A log lying on its side, seen from above: bark grain along it, a cut end with rings. */
  function logTop(cx, cy, L, Wd, ang, o) {
    o = o || {}
    const f = F(cx, cy, ang), pts = rrect(cx, cy, L, Wd, Wd * 0.42, ang)
    obj(pts, { h: o.h == null ? 3 : o.h, col: o.col || woodTone(), a: 0.75, sd: Wd * 0.34, line: o.line || 1.25 })
    if (det >= 1) {
      ctx.beginPath()
      const nb = det >= 2 ? 4 : 2
      for (let i = 0; i < nb; i++) { const v = rr(-Wd * 0.34, Wd * 0.34), a = rr(-L / 2 + 3, L * 0.1), b = a + rr(L * 0.25, L * 0.6); ctx.moveTo(...f(a, v)); for (let u = a + 3; u < min(b, L / 2 - 3); u += 3.5) ctx.lineTo(...f(u, v + j(0.5))) }
      ctx.lineWidth = px(0.5); ctx.stroke()
    }
    if (o.split) { // a freshly split face: pale, with the splitting hatch
      const fp = rectP(...f(0, -Wd * 0.12), L - Wd * 0.5, Wd * 0.44, ang); ctx.save(); clipTo(pts); poly(fp); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(fp, P.woodL, 0.6); ctx.restore(); if (det >= 1) hatchIn(fp, ang + 0.1, 2.8, 0.4)
    }
    if (o.cap !== false && det >= 1 && Wd * k > 6) { // end grain
      const sg = o.capSide || 1, e = ellP(...f(sg * (L / 2 - Wd * 0.14), 0), Wd * 0.11, Wd * 0.36, ang)
      poly(e); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(e, P.woodL, 0.6); pen(e, 0.6, { flat: true })
      if (det >= 2) { const e2 = ellP(...f(sg * (L / 2 - Wd * 0.14), 0), Wd * 0.045, Wd * 0.17, ang); pen(e2, 0.45, { flat: true }) }
    }
  }
  /** A round chopping block (a stump top): bark rim, growth rings, cracks, axe scars. */
  function stumpTop(cx, cy, R, o) {
    o = o || {}
    const b = blob(cx, cy, R, R * 0.95, 0, 14, 0.07, 3)
    obj(b, { h: 6, col: P.woodD, a: 0.6, sd: R * 0.25, line: 1.5, wob: 1.3 })
    // bark ticks round the rim
    if (det >= 1) { ctx.beginPath(); for (let i = 0; i < 30; i++) { const a = (i / 30) * TAU + j(0.05), r0 = R * 0.9, r1 = R * rr(0.94, 0.99); ctx.moveTo(cx + cos(a) * r0, cy + sin(a) * r0); ctx.lineTo(cx + cos(a) * r1, cy + sin(a) * r1) } ctx.lineWidth = px(0.5); ctx.stroke() }
    const face = blob(cx, cy, R * 0.82, R * 0.78, 0, 12, 0.06, 3)
    poly(face); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(face, P.woodL, 0.75)
    shadeIn(face, R * 0.2, { gap: 2.6 })
    // growth rings: a few closed wobbly curves, offset toward the lower left so the pith is off-centre
    const nr = det >= 2 ? 5 : 3
    for (let i = 1; i <= nr; i++) { const t = i / (nr + 0.8), rg = blob(cx - R * 0.04 * (1 - t), cy + R * 0.03 * (1 - t), R * 0.8 * t, R * 0.76 * t, 0, 10, 0.06, 3); line(rg.concat([rg[0]]), 0.5 + (i % 2) * 0.15, { taper: 0.1, wob: 0.5 }) }
    solidDot(cx - R * 0.04, cy + R * 0.03, 0.9 / k * lw + 0.4, INK)
    // radial checks and axe scars
    ctx.beginPath(); for (let i = 0; i < (det >= 1 ? 4 : 2); i++) { const a = r() * TAU, r0 = R * rr(0.12, 0.3), r1 = R * rr(0.55, 0.8); ctx.moveTo(cx + cos(a) * r0, cy + sin(a) * r0); ctx.lineTo(cx + cos(a + 0.05) * r1, cy + sin(a + 0.05) * r1) } ctx.lineWidth = px(0.55); ctx.stroke()
    if (det >= 1) for (let i = 0; i < 3; i++) { const x = cx + j(R * 0.45), y = cy + j(R * 0.4), a = rr(-0.5, 0.5); line([[x - 4, y - 2 + a], [x + 4, y + 2 - a]], 0.6, { taper: 0.6, wob: 0.2 }) }
    pen(face, 0.9, { swell: 0.35 })
  }
  /** An axe lying or embedded, seen from above: haft and a steel head. */
  function axeTop(x, y, ang, len, o) {
    o = o || {}
    const f = F(x, y, ang), haft = bar(f(0, 0), f(len, 0), 3.4)
    obj(haft, { h: o.h == null ? 3 : o.h, col: P.woodL, shade: 1, sd: 1.5, line: 0.9 })
    // grip swell at the end
    const hd = [f(-3, -3.2), f(1.5, -4.6), f(7, -9.5), f(8.4, 0), f(7, 9.5), f(1.5, 4.6), f(-3, 3.2)]
    obj(hd, { h: o.h == null ? 3 : o.h, col: P.stoneD, a: 0.75, sd: 3, line: 1.1 })
    if (det >= 1) { seg(...f(7, -8), ...f(7.6, 8)); flush(0.5); }
  }
  /** A bundle of kindling sticks tied with twine. */
  function kindling(cx, cy, L, ang, n) {
    const f = F(cx, cy, ang)
    for (let i = 0; i < n; i++) { const v = (i - (n - 1) / 2) * 2.3 + j(0.4), l = L * rr(0.9, 1.06), a = f(-l / 2, v), b = f(l / 2, v + j(0.8)); const bq = bar(a, b, 2.2); obj(bq, { h: i === n - 1 ? 3 : 0, col: woodTone(), shade: 0, line: 0.7 }) }
    for (const u of [-L * 0.18, L * 0.22]) { const bd = rectP(...f(u, 0), 3.2, n * 2.3 + 2.2, ang); poly(bd); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tone(bd, P.straw, 0.7); pen(bd, 0.8, { flat: true }); if (det >= 2) { seg(...f(u - 1.1, -n * 1.15), ...f(u - 1.1, n * 1.15)); seg(...f(u + 1.1, -n * 1.15), ...f(u + 1.1, n * 1.15)); flush(0.4) } }
  }
  /** A neat top layer of parallel logs. rows run along u. */
  function logStack(cx, cy, L, rows, Wd, ang, o) {
    o = o || {}
    const f = F(cx, cy, ang)
    for (let i = 0; i < rows; i++) {
      const v = (i - (rows - 1) / 2) * (Wd + 0.3), two = r() < (o.split == null ? 0.3 : o.split)
      if (two) { const l1 = L * rr(0.4, 0.55), l2 = L - l1 - 1.5; logTop(...f(-L / 2 + l1 / 2, v), l1, Wd, ang, { h: i === rows - 1 ? 3 : 0, cap: true, capSide: -1 }); logTop(...f(L / 2 - l2 / 2, v), l2, Wd, ang, { h: i === rows - 1 ? 3 : 0, cap: true }) }
      else { const l = L * rr(0.94, 1.02), du = j(L * 0.03); logTop(...f(du, v), l, Wd * rr(0.93, 1.05), ang, { h: i === rows - 1 ? 3 : 0, split: r() < 0.25 }) }
    }
  }
  const woodpiles = [
    // 0: a neat stack, top layer of split logs
    () => logStack(0, 0, 84, 7, 10.5, -0.12, {}),
    // 1: chopping block with the axe sunk in
    () => {
      for (const [x, y, a, l, w, c] of [[-28, 26, 0.5, 26, 9, 1], [32, -28, -0.3, 22, 8, 0], [30, 30, 1.2, 24, 9, 1]]) logTop(x, y, l, w, a, { split: c })
      stumpTop(-3, -3, 30)
      axeTop(-2, -2, 0.75, 46, {})
      if (det >= 1) { ctx.beginPath(); for (let i = 0; i < 18; i++) { const x = rr(-46, 46), y = rr(-46, 46); if (hypot(x, y) < 36) continue; ctx.moveTo(x + 1, y); ctx.arc(x, y, 0.9 / k * lw, 0, TAU) } ctx.fillStyle = COL ? P.woodD : INK; ctx.fill() }
    },
    // 2: a loose heap of logs, criss-crossed
    () => {
      const logs = []; for (let i = 0; i < 13; i++) { const a = r() * TAU, d = Math.sqrt(r()) * 25; logs.push([cos(a) * d, sin(a) * d, r() * PI, rr(32, 46), rr(8, 11)]) }
      for (const [x, y, a, l, w] of logs) logTop(x, y, l, w, a, { h: 3, split: r() < 0.2 })
    },
    // 3: leaning logs: a cone of firewood, seen from above as a star
    () => {
      const n = 10, base = r() * TAU, logs = []
      for (let i = 0; i < n; i++) { const a = base + (i / n) * TAU + j(0.12); logs.push([a, rr(36, 43)]) }
      logs.sort((p, q) => sin(p[0]) - sin(q[0]))
      for (const [a, l] of logs) logTop(cos(a) * (l / 2 - 2) , sin(a) * (l / 2 - 2), l, rr(8.5, 10.5), a, { h: 3, cap: true, capSide: 1 })
      const hub = ellP(0, 0, 4.5); poly(hub); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(hub, P.woodD, 0.8); pen(hub, 0.8); if (!COL) hatchIn(hub, 0.7, 1.6, 0.4, { minG: 1.2 })
    },
    // 4: short stack with a bundle of kindling
    () => { logStack(-4, -17, 76, 4, 10.5, 0.05, {}); kindling(6, 28, 54, -0.08, 8); for (let i = 0; i < 4; i++) { const x = rr(-40, 0), y = rr(26, 42); const q = bar([x, y], [x + rr(14, 22), y + rr(-4, 4)], 1.8); obj(q, { col: woodTone(), shade: 0, line: 0.6, h: 0 }) } },
    // 5: two stacks with a bow saw between
    () => {
      logStack(0, -30, 80, 3, 11, 0.02, {})
      logStack(0, 30, 80, 3, 11, -0.02, { split: 0.5 })
      const f = F(0, 0, 0.12), fr = [f(-24, -7), f(24, -7), f(24, -5), f(-22, -5), f(-22, 5), f(24, 5), f(24, 7), f(-24, 7)]
      obj(fr, { h: 3, col: P.woodL, shade: 0, line: 1 })
      ctx.beginPath(); for (let u = -22; u < 24; u += 2.4) { ctx.moveTo(...f(u, 0)); ctx.lineTo(...f(u + 1.2, 1.9)); ctx.lineTo(...f(u + 2.4, 0)) } ctx.lineWidth = px(0.55); ctx.stroke()
    },
    // 6: sawbuck with a log across it and a saw
    () => {
      const f = F(0, -2, 0.0)
      for (const u of [-20, 20]) { const b = rectP(...f(u, 0), 8, 56, 0); obj(b, { h: 4, col: P.woodD, a: 0.6, sd: 3, line: 1.2 }); if (det >= 2) { nail(...f(u, -22)); nail(...f(u, 22)); flushDots() } }
      const mid = rectP(...f(0, 0), 52, 6, 0); obj(mid, { col: P.wood, shade: 0, line: 1 })
      logTop(-2, -2, 80, 17, 0.0, { h: 5, cap: true, capSide: 1 })
      // saw lying below
      const g = F(0, 38, 0.04), fr = [g(-34, -5), g(34, -5), g(34, -3), g(-32, -3), g(-32, 3), g(34, 3), g(34, 5), g(-34, 5)]
      obj(fr, { h: 3, col: P.woodL, shade: 0, line: 1 })
      ctx.beginPath(); for (let u = -32; u < 34; u += 2.4) { ctx.moveTo(...g(u, 0)); ctx.lineTo(...g(u + 1.2, 1.7)); ctx.lineTo(...g(u + 2.4, 0)) } ctx.lineWidth = px(0.5); ctx.stroke()
    },
    // 7: a felled trunk with branch stubs, the axe in it, chips around
    () => {
      const f = F(0, 0, -0.18), L = 98, Wd = 30, pts = rrect(0, 0, L, Wd, 11, -0.18)
      obj(pts, { h: 6, col: P.woodD, a: 0.55, sd: 10, line: 1.5 })
      ctx.save(); clipTo(pts); ctx.beginPath()
      for (let i = 0; i < (det >= 1 ? 30 : 12); i++) { const v = rr(-13, 13), a = rr(-L / 2, L / 2 - 6), l = rr(6, 18); ctx.moveTo(...f(a, v)); ctx.lineTo(...f(a + l, v + j(0.8))) }
      ctx.lineWidth = px(0.55); ctx.stroke(); ctx.restore()
      for (const [u, v] of [[-20, -11], [8, 12], [30, -10]]) { const s = ellP(...f(u, v), 4.4, 3.6, 0); obj(s, { col: P.woodL, a: 0.7, shade: 0, line: 0.9 }); if (det >= 1) pen(ellP(...f(u, v), 2, 1.6), 0.5, { flat: true }) }
      const e = ellP(...f(L / 2 - 6, 0), 7, 13.5, -0.18); poly(e); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(e, P.woodL, 0.7); pen(e, 0.9, { flat: true })
      for (const t of [0.66, 0.36]) pen(ellP(...f(L / 2 - 6 - 0.5, 0), 7 * t, 13.5 * t, -0.18), 0.5, { flat: true })
      axeTop(-26, 6, 0.9, 38, { h: 2 })
    },
  ]
  reg('bm-woodpile', 'Woodpile', 'bm-camp', 'fixed', woodpiles)

  /* =====================================================================================================
     Carts and wagons. s is the length: pole or shafts at the left, the tail at the right.
     ===================================================================================================== */
  /** A wheel seen from above is its rim edge-on: a long narrow band with felloe joints, iron tyre and a hub cap. */
  function wheelTop(cx, cy, d, ang, thick, out) {
    const f = F(cx, cy, ang), rim = rrect(cx, cy, d, thick, thick * 0.35, ang)
    obj(rim, { h: 4, col: P.woodD, a: 0.7, sd: thick * 0.5, line: 1.3 })
    if (det >= 1) {
      ctx.beginPath()
      for (let u = -d / 2 + d / 7; u < d / 2 - 2; u += d / 7) { ctx.moveTo(...f(u, -thick / 2 + 0.6)); ctx.lineTo(...f(u + j(0.4), thick / 2 - 0.6)) }
      ctx.lineWidth = px(0.55); ctx.stroke()
      ctx.beginPath(); for (const v of [-1, 1]) { ctx.moveTo(...f(-d / 2 + 2.5, v * (thick / 2 - 0.5))); ctx.lineTo(...f(d / 2 - 2.5, v * (thick / 2 - 0.5))) } ctx.lineWidth = px(0.4); ctx.stroke()
    }
    const hub = rrect(...f(0, out * (thick / 2 + 1.6)), 6.4, 3.8, 1.2, ang); obj(hub, { col: P.iron, a: 0.7, shade: 0, line: 0.9, flat: true })
  }
  const axle = (x, W, th) => { for (const sg of [-1, 1]) { const b = rectP(x, sg * (W / 2 + 1.5), 3.6, 5.5, 0); obj(b, { col: P.woodD, a: 0.7, shade: 0, line: 0.8, flat: true }) } }
  /** Draw wheels for a body of width W: list of [x, diameter]. */
  function wheelsFor(list, W, th) { for (const [x, d] of list) for (const sg of [-1, 1]) wheelTop(x, sg * (W / 2 + th / 2 + 2.5), d, 0, th, sg) }
  function drawPole(x0, x1, y, yoke) { // draw pole/tongue from x1 (at the cart) to x0 (the animal end)
    const b = bar([x1, y], [x0, y], 3.6); obj(b, { h: 3, col: P.wood, a: 0.7, sd: 1.5, line: 1 })
    if (yoke) { const yk = bar([x0, y - 11], [x0, y + 11], 3.4); obj(yk, { h: 3, col: P.woodD, a: 0.7, sd: 1.5, line: 1 }); if (det >= 1) { for (const sg of [-1, 1]) { const q = ellP(x0, y + sg * 11, 1.8); poly(q); ctx.fillStyle = PAPER; ctx.fill(); pen(q, 0.6, { flat: true }) } } }
  }
  /** Open wagon bed: wall rim, plank floor, corner iron, optional seat. Cargo goes on top afterwards. */
  function wagonBed(cx, cy, L, W, o) {
    o = o || {}
    const body = rectP(cx, cy, L, W, 0), wl = o.wall || 5.5, inner = rectP(cx, cy, L - 2 * wl, W - 2 * wl, 0)
    shadow(body, o.h == null ? 6 : o.h)
    poly(body); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(body, P.woodD, 0.55)
    // wall boards
    ctx.beginPath(); for (let i = 1; i < Math.round(L / 14); i++) { const u = cx - L / 2 + (L * i) / Math.round(L / 14); for (const sg of [-1, 1]) { ctx.moveTo(u, cy + sg * (W / 2)); ctx.lineTo(u + j(0.4), cy + sg * (W / 2 - wl)) } } ctx.lineWidth = px(0.6); ctx.stroke()
    plankRect(cx, cy, L - 2 * wl, W - 2 * wl, 0, { pw: o.pw || 9, nails: det >= 3, cols: [P.woodL, P.wood, P.woodL], stag: 0, seed: o.seed })
    if (det >= 1) shadeIn(inner, wl * 1.1, { rev: true, col: 'rgba(30,18,8,0.3)', inkToo: true, gap: 1.7 })
    pen(inner, 0.9, { swell: 0.2 })
    if (det >= 2) { for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const q = rectP(cx + u * (L / 2 - 2.8), cy + v * (W / 2 - 2.8), 4.4, 4.4, 0); poly(q); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tone(q, P.iron, 0.6); pen(q, 0.6, { flat: true }) } }
    pen(body, 1.45)
    return { body, inner }
  }
  const driverBench = (x, W) => { const b = rectP(x, 0, 9, W - 4, 0); obj(b, { h: 3, col: P.wood, a: 0.7, sd: 2.5, line: 1.1 }); if (det >= 1) { seg(x - 1, -W / 2 + 4, x - 1, W / 2 - 4); flush(0.4) } }
  const carts = [
    // 0: two-wheeled handcart with a sack load
    () => {
      for (const sg of [-1, 1]) { const b = bar([-6, sg * 9], [-50, sg * 11], 3.4); obj(b, { h: 3, col: P.wood, a: 0.7, sd: 1.5, line: 1 }) }
      const gp = bar([-48, -12], [-48, 12], 3.4); obj(gp, { h: 3, col: P.woodD, a: 0.7, sd: 1.5, line: 1 })
      axle(20, 34)
      wheelTop(20, -22.5, 40, 0, 5, -1); wheelTop(20, 22.5, 40, 0, 5, 1)
      wagonBed(20, 0, 58, 34, { wall: 4.6 })
      sack(14, -6, 36, 22, 0.15, { col: P.canvasD, h: 4 }); sack(26, 7, 34, 21, -0.1, { col: P.woodL, h: 4 })
    },
    // 1: four-wheeled farm wagon, empty, with a driver's bench
    () => {
      drawPole(-50, -20, 0, true); axle(-8, 34); axle(32, 34)
      wheelsFor([[-8, 22], [32, 28]], 34, 5)
      wagonBed(13, 0, 70, 34, { wall: 5 })
      driverBench(-14, 34)
    },
    // 2: covered wagon, canvas on hoops
    () => {
      drawPole(-50, -22, 0, true); axle(-8, 36); axle(32, 36)
      wheelsFor([[-8, 22], [32, 28]], 36, 5)
      driverBench(-24, 36)
      const cv = rrect(14, 0, 66, 40, 14, 0)
      shadow(cv, 9); poly(cv); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(cv, P.canvas, 0.8)
      ctx.save(); clipTo(cv)
      // hoops: curved ribs across, each a faint ridge of canvas
      for (let u = -14; u <= 46; u += 8.6) { ctx.beginPath(); ctx.moveTo(u, -21); ctx.quadraticCurveTo(u + 2.2, 0, u, 21); ctx.lineWidth = px(0.8); ctx.stroke() }
      if (COL) tone([[-30, 0], [60, 0], [60, 22], [-30, 22]], P.shade, 0.18)
      ctx.beginPath(); ctx.moveTo(-18, 0.4); ctx.lineTo(48, 0); ctx.lineWidth = px(0.5); ctx.stroke()
      ctx.restore()
      if (det >= 1) shadeIn(cv, 14, { gap: 2.4 })
      pen(cv, 1.5)
      // gathered, laced ends
      for (const [ex, sg] of [[-18, -1], [47, 1]]) { ctx.beginPath(); for (let i = -3; i <= 3; i++) { ctx.moveTo(ex + sg * 1, i * 3.4); ctx.lineTo(ex - sg * rr(4, 7), i * 4.6) } ctx.lineWidth = px(0.5); ctx.stroke(); const kn = ellP(ex + sg * 1.5, 0, 1.8); poly(kn); ctx.fillStyle = PAPER; ctx.fill(); pen(kn, 0.7, { flat: true }) }
    },
    // 3: hay wagon piled high, a fork on top
    () => {
      drawPole(-50, -20, 0, true); axle(-6, 34); axle(32, 34)
      wheelsFor([[-6, 22], [32, 28]], 34, 5)
      wagonBed(13, 0, 70, 34, { wall: 5 })
      hayHeap(12, 0, 38, 26, 0.0, { det: true })
      // lashing ropes looped over the heap, and a pitchfork stuck in the top
      for (const u of [-10, 24]) line(cr([[u, -26], [u + 3, -9], [u + 1, 9], [u - 2, 26]], false, 4), 0.9, { taper: 0.05, wob: 0.6 })
      const fk = F(14, -6, -0.62); line([fk(-30, 0), fk(14, 0)], 1.5, { taper: 0.05, wob: 0.2 }); line([fk(14, -4.2), fk(14, 4.2)], 1.4, { taper: 0.1, wob: 0.1 })
      for (const v of [-4.2, 0, 4.2]) line([fk(14, v), fk(25, v)], 1.0, { taper: 0.4, wob: 0.1 })
    },
    // 4: dray loaded with barrels
    () => {
      drawPole(-50, -24, 0, true); axle(-12, 38); axle(30, 38)
      wheelsFor([[-12, 20], [30, 24]], 38, 4.6)
      wagonBed(8, 0, 80, 38, { wall: 4, pw: 8 })
      for (let i = 0; i < 3; i++) for (const sg of [-1, 1]) barrelTop(-12 + i * 21.5, sg * 9.6, 10, i + (sg > 0 ? 0.7 : 0.1), { h: 3, n: 3, seed: i })
      for (const v of [-9.6, 9.6]) { line([[-26, v], [38, v + 0.5]], 0.8, { taper: 0.05, wob: 0.4 }) }
      line([[-12, -20], [11, 20]], 0.7, { taper: 0.1 }); line([[30, -20], [9, 20]], 0.7, { taper: 0.1 })
    },
    // 5: wheelbarrow with a heap of earth and a spade
    () => {
      for (const sg of [-1, 1]) { const b = bar([-18, sg * 12], [-50, sg * 15], 3.6); obj(b, { h: 3, col: P.wood, a: 0.7, sd: 1.5, line: 1 }); const gp = rrect(-47, sg * 15, 9, 4.6, 2, 0); obj(gp, { h: 0, col: P.woodD, a: 0.7, shade: 0, line: 0.9 }) }
      for (const sg of [-1, 1]) { const lg = bar([-22, sg * 14], [-26, sg * 24], 3); obj(lg, { h: 2, col: P.woodD, a: 0.7, shade: 0, line: 0.8 }) }
      const fk = bar([22, -9], [42, -6], 3); void fk
      wheelTop(38, 0, 26, 0, 6, 1)
      for (const sg of [-1, 1]) { const b = bar([22, sg * 10], [40, sg * 4.4], 3); obj(b, { col: P.woodD, a: 0.7, shade: 0, line: 0.8, h: 2 }) }
      const tray = [[-22, -17], [22, -12.5], [26, 0], [22, 12.5], [-22, 17]]
      shadow(tray, 6); poly(tray); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(tray, P.iron, 0.55); if (det >= 1) shadeIn(tray, 6, { gap: 2.4 }); pen(tray, 1.5)
      const inn = [[-19, -13.5], [19, -9.5], [22, 0], [19, 9.5], [-19, 13.5]]; poly(inn); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(inn, P.earthD, 0.5); pen(inn, 0.8, { swell: 0.2 })
      const mound = blob(0, 0, 18, 10.5, 0, 9, 0.14, 3); ctx.save(); clipTo(inn); poly(mound); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(mound, P.earth, 0.8); stipIn(mound, det >= 1 ? 90 : 30, 0.7); if (det >= 1) shadeIn(mound, 5, { gap: 2.2 }); pen(mound, 0.9, { wob: 1.4 }); ctx.restore()
      // spade lying across the tray
      const f = F(0, 0, 0.35), sh = bar(f(-46 + 14, 0), f(-6, 0), 2.6); void sh
      line([[-26, -26], [8, -2]], 1.8, { taper: 0.05, wob: 0.3 }); const bl = rrect(14, 3, 13, 11, 4, 0.55); obj(bl, { h: 3, col: P.stoneD, a: 0.7, sd: 3, line: 1 })
    },
    // 6: prison cart: an iron cage on a wagon
    () => {
      drawPole(-50, -22, 0, true); axle(-8, 36); axle(30, 36)
      wheelsFor([[-8, 22], [30, 28]], 36, 5)
      wagonBed(10, 0, 70, 36, { wall: 4 })
      const cage = rectP(12, 0, 62, 30, 0)
      shadow(cage, 5); poly(cage); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(cage, P.iron, 0.25)
      ctx.save(); clipTo(cage); ctx.beginPath()
      for (let u = -17; u <= 41; u += 6.4) { ctx.moveTo(u, -15); ctx.lineTo(u, 15) } ctx.lineWidth = px(1.15); ctx.stroke()
      ctx.restore()
      for (const v of [-9, 0, 9]) { const b = bar([-19, v], [43, v], 2.6); obj(b, { col: P.iron, a: 0.6, shade: 0, line: 0.9, flat: true }) }
      if (det >= 2) for (let u = -17; u <= 41; u += 6.4) for (const v of [-9, 0, 9]) nail(u, v)
      flushDots(null, 1.2)
      pen(cage, 1.7)
      // the door at the tail: hatch with a padlock
      const dr = rectP(40, 0, 6, 20, 0); obj(dr, { col: P.iron, a: 0.5, shade: 0, line: 1 }); const pl = ellP(40, 4, 3); obj(pl, { col: P.brass, a: 0.8, shade: 0, line: 0.9 })
      line([[-22, 0], [-30, -1.5], [-38, 1], [-46, 0]], 1.1, { taper: 0.1 })
    },
    // 7: ox-cart: big wheels, flatbed with crates and a roped tarp
    () => {
      drawPole(-50, -18, 0, true); axle(14, 34)
      wheelTop(14, -22.5, 42, 0, 5.4, -1); wheelTop(14, 22.5, 42, 0, 5.4, 1)
      wagonBed(14, 0, 60, 34, { wall: 4, pw: 8 })
      crateTop(-4, -4, 24, 22, 0.05, { h: 3, pw: 7, noCleat: true })
      crateTop(-5, 13, 20, 16, -0.1, { h: 3, pw: 6, noCleat: true, seed: 1 })
      const tarp = cr([[10, -13], [26, -15], [40, -11], [43, 2], [38, 13], [22, 14], [10, 8]], true, 3)
      obj(tarp, { h: 4, col: P.canvas, a: 0.8, sd: 7, line: 1.3 })
      ctx.save(); clipTo(tarp); for (const [a0, b0] of [[[10, -13], [40, 11]], [[10, 8], [36, -14]]]) rule(a0, b0, 0.9); ctx.restore()
      if (det >= 1) { ctx.beginPath(); for (const [x, y] of [[16, -4], [28, 2], [20, 8], [34, -6]]) { ctx.moveTo(x, y); ctx.lineTo(x + 6, y + 2) } ctx.lineWidth = px(0.5); ctx.stroke() }
    },
  ]
  reg('bm-cart', 'Cart', 'bm-camp', 'fixed', carts)

  /* =====================================================================================================
     Shared small things
     ===================================================================================================== */
  /** A round fruit / ball / stone seen from above: opaque, tinted, a crescent of shade, a little outline. */
  function ball(x, y, rad, col, o) {
    o = o || {}
    const pts = ellP(x, y, rad, rad * (o.sq || 1), o.ang || 0, clamp(Math.round(rad * k * 1.5), 7, 18))
    if (o.h && st.shadows) shadow(pts, o.h)
    poly(pts); ctx.fillStyle = PAPER; ctx.fill()
    if (COL) tint(pts, col, o.a || 0.7)
    if (det >= 2 && rad * k > 4) shadeIn(pts, rad * 0.5, { col: o.shadeCol })
    pen(pts, o.line || 0.8, { wob: 0.4 })
  }
  /** Hoop: a flat iron or rope ring between two radii. */
  function ring(cx, cy, r0, r1, col, o) {
    o = o || {}
    const a = ellP(cx, cy, r1), b = ellP(cx, cy, r0)
    ctx.beginPath(); sub(a); sub(b); ctx.fillStyle = PAPER; ctx.fill('evenodd')
    if (COL) { ctx.save(); ctx.globalAlpha = 0.6; ctx.fillStyle = col || P.iron; ctx.fill('evenodd'); ctx.restore() }
    else if (o.solid) { ctx.fillStyle = INK; ctx.fill('evenodd') }
    pen(a, o.w || 0.8, { wob: 0.35 }); pen(b, o.w || 0.8, { wob: 0.35, swell: 0.3 })
  }
  /** Planked circle (barrel head, round table top): seams run along angle `ang`. */
  function plankDisc(cx, cy, R, ang, n, o) {
    o = o || {}
    const pts = ellP(cx, cy, R), f = F(cx, cy, ang)
    poly(pts); ctx.fillStyle = PAPER; ctx.fill()
    ctx.save(); clipTo(pts)
    const cols = [P.wood, P.woodL, P.woodD]
    ctx.beginPath()
    for (let i = 0; i < n; i++) {
      const v0 = -R + (i * 2 * R) / n, v1 = v0 + (2 * R) / n
      if (COL) tone([f(-R - 2, v0), f(R + 2, v0), f(R + 2, v1), f(-R - 2, v1)], cols[(i * 5 + (o.seed || 0)) % 3], 0.5)
      if (i) { ctx.moveTo(...f(-R - 2, v0)); ctx.lineTo(...f(R + 2, v0 + j(0.3))) }
    }
    ctx.lineWidth = px(0.8); ctx.strokeStyle = INK; ctx.stroke()
    if (det >= 2 && R * k > 12) {
      ctx.beginPath()
      for (let i = 0; i < n; i++) { const v0 = -R + (i * 2 * R) / n, w = (2 * R) / n; for (let q = 0; q < 2; q++) { const v = v0 + rr(0.25, 0.75) * w, a = rr(-R * 0.8, R * 0.2), b = a + rr(R * 0.3, R * 0.7); ctx.moveTo(...f(a, v)); for (let u = a + 3; u < b; u += 3.5) ctx.lineTo(...f(u, v + j(0.3))) } }
      ctx.lineWidth = px(0.4); ctx.globalAlpha = 0.7; ctx.stroke(); ctx.globalAlpha = 1
    }
    ctx.restore()
  }

  /* =====================================================================================================
     Crates
     ===================================================================================================== */
  /** Planked crate lid: planks along the length, two end cleats, nails; optional X / Z braces. */
  function crateTop(cx, cy, w, h, ang, o) {
    o = o || {}
    const body = rectP(cx, cy, w, h, ang), f = F(cx, cy, ang)
    if (o.h !== 0) shadow(body, o.h == null ? 5 : o.h)
    plankRect(cx, cy, w, h, ang, { pw: o.pw || 13, seed: o.seed, gap: 0.45, nails: false, cols: o.cols })
    const cw = max(6.5, w * 0.12), nailsOn = det >= 2
    if (!o.noCleat) for (const sg of [-1, 1]) {
      const c = rectP(...f(sg * (w / 2 - cw / 2 - 1.4), 0), cw, h - 3, ang)
      poly(c); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tone(c, P.woodD, 0.5)
      pen(c, 0.8, { flat: true })
      if (nailsOn) for (const v of [-1, 1]) nail(...f(sg * (w / 2 - cw / 2 - 1.4), v * (h / 2 - 5)))
    }
    if (o.brace) {
      const a = f(-w / 2 + 6, -h / 2 + 6), b = f(w / 2 - 6, h / 2 - 6), c = f(w / 2 - 6, -h / 2 + 6), d = f(-w / 2 + 6, h / 2 - 6)
      const bs = o.brace === 'z' ? [[c, d]] : [[a, b], [c, d]]
      for (const [p, q] of bs) { const bq = bar(p, q, max(6, w * 0.1)); poly(bq); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tone(bq, P.woodD, 0.5); pen(bq, 0.8, { flat: true }); if (nailsOn) { nail(...lerp(p, q, 0.08)); nail(...lerp(p, q, 0.92)) } }
    }
    flushDots()
    if (det >= 1) shadeIn(body, min(w, h) * 0.15)
    pen(body, 1.35)
  }
  /** Open crate: wall rim, dark interior with the upper-left wall throwing shade inside, contents drawn by fill(innerPts, f). */
  function crateOpen(cx, cy, w, h, ang, o) {
    o = o || {}
    const body = rectP(cx, cy, w, h, ang), f = F(cx, cy, ang), wl = o.wall || max(6, min(w, h) * 0.12)
    const inner = rectP(cx, cy, w - 2 * wl, h - 2 * wl, ang)
    shadow(body, o.h == null ? 5 : o.h)
    poly(body); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(body, P.woodL, 0.65)
    // wall tops: faint planking across the rim, nails
    if (det >= 2) { ctx.beginPath(); for (let i = 0; i < 3; i++) { const u0 = rr(-w / 2 + 3, w / 2 - 8); for (const v of [-1, 1]) { const ln = rr(8, 20), ua = Math.min(u0, w / 2 - 3 - ln); ctx.moveTo(...f(ua, v * (h / 2 - wl * 0.5) + j(0.3))); ctx.lineTo(...f(ua + ln, v * (h / 2 - wl * 0.5) + j(0.3))) } } ctx.lineWidth = px(0.4); ctx.stroke() }
    poly(inner); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(inner, o.floor || P.woodD, 0.75)
    if (!o.noInside) {
      ctx.save(); clipTo(inner); const b = bbox(inner)
      if (!COL) hatchBox(b.x0, b.y0, b.x1, b.y1, -0.79, 2.6, 0.45)
      ctx.restore()
      if (det >= 1) shadeIn(inner, wl * 1.1, { rev: true, col: 'rgba(30,18,8,0.5)', inkToo: true, gap: 1.6 })
    }
    if (o.fill) o.fill(inner, f, w - 2 * wl, h - 2 * wl)
    pen(inner, 0.95, { swell: 0.2 })
    if (det >= 2) { for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) nail(...f(u * (w / 2 - wl * 0.5), v * (h / 2 - wl * 0.5))); flushDots() }
    pen(body, 1.35)
  }
  /** Straw packing: lots of short strokes over a clip region. */
  function strawFill(pts, n, col, len) {
    const b = bbox(pts); ctx.save(); clipTo(pts); ctx.beginPath()
    for (let i = 0; i < n; i++) { const x = rr(b.x0, b.x1), y = rr(b.y0, b.y1), a = rr(0, PI), l = (len || 5) * rr(0.6, 1.4); ctx.moveTo(x, y); ctx.lineTo(x + cos(a) * l, y + sin(a) * l * 0.7) }
    ctx.lineWidth = px(0.5); ctx.strokeStyle = col || INK; ctx.stroke(); ctx.restore()
  }
  const crates = [
    // 0: single planked crate
    () => { crateTop(0, 0, 76, 70, j(0.03) - 0.06, { h: 6, pw: 14 }) },
    // 1: X-braced crate
    () => { crateTop(0, 0, 72, 72, 0.16 + j(0.03), { h: 6, pw: 15, brace: 'x', noCleat: false, seed: 1 }) },
    // 2: open crate of apples on straw
    () => {
      crateOpen(0, 0, 80, 66, -0.08 + j(0.02), { h: 6, fill: (inner, f, iw, ih) => {
        strawFill(inner, det >= 1 ? 90 : 30, COL ? P.strawD : INK, 6)
        if (COL) tone(inner, P.straw, 0.4)
        const pts = []; for (let a = -iw / 2 + 9; a < iw / 2 - 5; a += 14) for (let b = -ih / 2 + 9; b < ih / 2 - 5; b += 13) pts.push(f(a + j(2), b + j(2)))
        for (const p of pts) if (r() < 0.9) ball(p[0], p[1], rr(5.2, 6.4), r() < 0.25 ? P.green : P.red, { shadeCol: 'rgba(60,20,10,.35)' })
      } })
    },
    // 3: two crates stacked, the top one turned
    () => {
      crateTop(-4, 4, 80, 66, -0.04, { h: 4, pw: 14 })
      crateTop(4, -4, 50, 46, 0.34, { h: 9, pw: 12, noCleat: false, brace: 'z', seed: 2 })
    },
    // 4: three small crates
    () => {
      crateTop(-20, -19, 44, 40, -0.12, { h: 4, pw: 12, seed: 0 })
      crateTop(24, -12, 38, 38, 0.2, { h: 4, pw: 12, seed: 1, brace: 'x' })
      crateTop(-4, 24, 46, 36, 0.05, { h: 4, pw: 11, seed: 2 })
    },
    // 5: long weapons crate with rope handles and a stencil
    () => {
      const a = -0.5, f = F(0, 0, a)
      for (const sg of [-1, 1]) { // rope handles at the ends
        ctx.beginPath(); ctx.ellipse(...f(sg * 48, 0), 5, 7, a, 0, TAU); ctx.lineWidth = px(1.2); ctx.strokeStyle = INK; ctx.stroke()
        if (COL) { ctx.beginPath(); ctx.ellipse(...f(sg * 48, 0), 5, 7, a, 0, TAU); ctx.lineWidth = px(0.8); ctx.strokeStyle = P.woodL; ctx.stroke() }
      }
      crateTop(0, 0, 90, 38, a, { h: 5, pw: 12, brace: null })
      // stencil
      const f2 = F(0, 0, a); ctx.beginPath(); ctx.moveTo(...f2(-12, -7)); ctx.lineTo(...f2(-2, 7)); ctx.moveTo(...f2(-2, -7)); ctx.lineTo(...f2(-12, 7)); ctx.moveTo(...f2(6, -7)); ctx.lineTo(...f2(6, 7)); ctx.moveTo(...f2(6, -7)); ctx.lineTo(...f2(14, -7)); ctx.moveTo(...f2(6, 0)); ctx.lineTo(...f2(12, 0)); ctx.lineWidth = px(1.2); ctx.strokeStyle = INK; ctx.stroke()
    },
    // 6: slatted produce crate, you can see the dark inside between the slats
    () => {
      const w = 78, h = 66, a = 0.07, f = F(0, 0, a), body = rectP(0, 0, w, h, a)
      shadow(body, 5)
      poly(body); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(body, P.woodD, 0.75)
      ctx.save(); clipTo(body); const b = bbox(body); if (!COL) hatchBox(b.x0, b.y0, b.x1, b.y1, 0.9, 2.2, 0.55); ctx.restore()
      const n = 6, sw = (h - 6) / n * 0.72, gp = (h - 6) / n
      for (let i = 0; i < n; i++) {
        const v = -h / 2 + 3 + gp * (i + 0.5), s2 = rectP(...f(0, v), w - 2, sw, a)
        poly(s2); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tone(s2, [P.wood, P.woodL, P.woodD][i % 3], 0.55); pen(s2, 0.75, { flat: true })
        if (det >= 2) { ctx.beginPath(); ctx.moveTo(...f(rr(-30, -10), v)); ctx.lineTo(...f(rr(0, 28), v + j(0.3))); ctx.lineWidth = px(0.4); ctx.stroke() }
      }
      for (const sg of [-1, 1]) { const c = rectP(...f(sg * (w / 2 - 5), 0), 9, h, a); poly(c); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tone(c, P.woodD, 0.5); pen(c, 0.9); if (det >= 2) { nail(...f(sg * (w / 2 - 5), -h / 2 + 6)); nail(...f(sg * (w / 2 - 5), h / 2 - 6)); nail(...f(sg * (w / 2 - 5), 0)) } }
      flushDots()
      if (det >= 1) shadeIn(body, 9)
      pen(body, 1.3)
    },
    // 7: a tumble of crates with a pried-off lid beside them
    () => {
      crateTop(-12, 8, 56, 52, -0.2, { h: 4, pw: 13, seed: 0 })
      crateTop(24, -16, 40, 38, 0.3, { h: 4, pw: 12, seed: 2, brace: 'x' })
      crateTop(-20, -26, 30, 26, 0.55, { h: 7, pw: 10, seed: 1, noCleat: true })
      const lid = rectP(32, 28, 40, 18, -0.9); obj(lid, { h: 2, col: P.wood, shade: 1, sd: 5, line: 1 })
      if (det >= 1) { ctx.beginPath(); const f = F(32, 28, -0.9); for (let u = -16; u < 18; u += 8) { ctx.moveTo(...f(u, -9)); ctx.lineTo(...f(u, 9)) } ctx.lineWidth = px(0.5); ctx.stroke() }
    },
  ]
  reg('bm-crate', 'Crate', 'bm-objects', 'fixed', crates)

  /* =====================================================================================================
     Barrels
     ===================================================================================================== */
  /** A barrel seen from above: bulge ring with staves, iron hoops, then the planked head (or open top). */
  function barrelTop(cx, cy, R, ang, o) {
    o = o || {}
    const belly = ellP(cx, cy, R), lidR = R * 0.8
    obj(belly, { h: o.h == null ? 7 : o.h, col: P.woodD, a: 0.5, sd: R * 0.22, line: 1.3, shade: det >= 1 ? 1 : 0 })
    if (det >= 1) {
      const n = clamp(Math.round((R * k) / 1.5), 12, 30)
      for (let i = 0; i < n; i++) { const a = ang + (i / n) * TAU + j(0.02); seg(cx + cos(a) * lidR, cy + sin(a) * lidR, cx + cos(a) * R * 0.97, cy + sin(a) * R * 0.97) }
      flush(0.5)
    }
    if (det >= 1 && R * k > 9) ring(cx, cy, R * 0.9, R * 0.94, P.iron, { w: 0.6 })
    if (o.open) {
      const lid = ellP(cx, cy, lidR)
      ring(cx, cy, lidR * 0.9, lidR * 1.02, P.iron, { w: 0.8 })
      const inn = ellP(cx, cy, lidR * 0.9)
      poly(inn); ctx.fillStyle = PAPER; ctx.fill()
      o.open(inn, lidR * 0.9)
      pen(inn, 0.95, { swell: 0.3 })
    } else {
      plankDisc(cx, cy, lidR, ang, o.n || 4, { seed: o.seed })
      ring(cx, cy, lidR * 0.93, lidR * 1.02, P.iron, { w: 0.7 })
      if (o.bung !== false && det >= 1 && R * k > 11) { const bx = cx + cos(ang + 1.0) * lidR * 0.45, by = cy + sin(ang + 1.0) * lidR * 0.45; ball(bx, by, R * 0.075, P.woodD, { line: 0.7 }); }
      if (det >= 2) { for (let i = 0; i < 4; i++) { const a = ang + PI / 4 + (i * PI) / 2; nail(cx + cos(a) * lidR * 0.8, cy + sin(a) * lidR * 0.8) } flushDots() }
      shadeIn(ellP(cx, cy, lidR), lidR * 0.22, { gap: 2.2 })
      pen(ellP(cx, cy, lidR), 0.9, { swell: 0.4 })
    }
  }
  /** Barrel lying on its side. */
  function barrelSide(cx, cy, L, W, ang, o) {
    o = o || {}
    const f = F(cx, cy, ang), pts = []
    const prof = (t) => { const e = Math.sin(PI * clamp(t, 0, 1)); return W / 2 * (0.62 + 0.38 * Math.pow(e, 0.6)) }
    for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(f(-L / 2 + L * t, -prof(t))) }
    for (let i = 12; i >= 0; i--) { const t = i / 12; pts.push(f(-L / 2 + L * t, prof(t))) }
    obj(pts, { h: 6, col: P.wood, sd: W * 0.2 })
    ctx.save(); clipTo(pts)
    // staves run along the length, bowing with the profile
    const ns = 7; ctx.beginPath()
    for (let s = 1; s < ns; s++) { const q = -1 + (2 * s) / ns; ctx.moveTo(...f(-L / 2, q * prof(0))); for (let i = 1; i <= 12; i++) { const t = i / 12; ctx.lineTo(...f(-L / 2 + L * t, q * prof(t))) } }
    ctx.lineWidth = px(0.55); ctx.stroke()
    ctx.restore()
    // hoops: bands across
    for (const t of [0.17, 0.33, 0.67, 0.83]) { const u = -L / 2 + L * t, hw = prof(t), a = f(u - 2.2, -hw), b = f(u + 2.2, -hw), c = f(u + 2.2, hw), d = f(u - 2.2, hw); const band = [a, b, c, d]; ctx.save(); clipTo(pts); poly(band); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tone(band, P.iron, 0.55); pen(band, 0.7, { flat: true }); ctx.restore() }
    if (det >= 1) ball(...f(L * 0.0, -W * 0.05), W * 0.06, P.woodD, { line: 0.7 }) // bung
    shadeIn(pts, W * 0.16, { gap: 2.2 })
    pen(pts, 1.3)
    // chocks
    for (const t of [0.22, 0.78]) { const u = -L / 2 + L * t, hw = prof(t); const ck = rectP(...f(u, hw + 3), 9, 5, ang); obj(ck, { col: P.woodD, shade: 0, line: 0.9 }) }
  }
  const barrels = [
    // 0: sealed barrel, planked head and bung
    () => barrelTop(0, 0, 47, 0.25 + j(0.03), { n: 4 }),
    // 1: open barrel of water
    () => {
      barrelTop(0, 0, 47, 0.1, { open: (inn, R) => {
        poly(inn); if (COL) { tint(inn, P.water, 0.8) }
        ctx.save(); clipTo(inn)
        if (!COL) hatchBox(-R, -R, R, R, -0.05, 2.8, 0.45)
        shadeIn(inn, R * 0.3, { rev: true, col: 'rgba(20,40,40,0.4)', inkToo: true, gap: 1.7 })
        ctx.restore()
        // ripples and a glint
        for (let i = 0; i < (det >= 1 ? 3 : 1); i++) { const q = R * (0.28 + i * 0.22); ctx.beginPath(); ctx.arc(R * 0.08, R * 0.1, q, rr(0.2, 1), rr(1.8, 3.2)); ctx.lineWidth = px(0.55); ctx.strokeStyle = INK; ctx.stroke() }
        if (det >= 1) { ctx.beginPath(); ctx.arc(-R * 0.25, -R * 0.22, R * 0.34, 3.4, 4.5); ctx.lineWidth = px(1); ctx.strokeStyle = COL ? '#f4f1e8' : PAPER; ctx.stroke() }
      } })
    },
    // 2: barrel brimming with apples
    () => {
      barrelTop(0, 0, 47, 0.1, { open: (inn, R) => {
        if (COL) tint(inn, P.straw, 0.5)
        ctx.save(); clipTo(inn); const pts = []
        for (let q = 0; q < 14; q++) { const a = q * 2.399 + 0.4, rad = R * 0.86 * Math.sqrt((q + 0.5) / 14); pts.push([Math.cos(a) * rad, Math.sin(a) * rad]) }
        pts.sort((a, b) => a[1] - b[1])
        for (const [x, y] of pts) ball(x, y, R * 0.24, r() < 0.2 ? P.green : P.red, { shadeCol: 'rgba(60,20,10,.35)', line: 0.7 })
        ctx.restore()
      } })
    },
    // 3: barrel on its side, on chocks
    () => barrelSide(0, 0, 92, 62, -0.18, {}),
    // 4: two barrels
    () => { barrelTop(-16, -16, 33, 0.3, { h: 6, n: 3 }); barrelTop(17, 15, 31, 0.9, { h: 6, n: 4, seed: 1 }) },
    // 5: three barrels
    () => { barrelTop(-17, -17, 29, 0.2, { h: 6, n: 3 }); barrelTop(22, -8, 26, 1.1, { h: 6, n: 3, seed: 1 }); barrelTop(-2, 22, 28, 0.6, { h: 6, n: 4, seed: 2 }) },
    // 6: four: three upright and a small keg
    () => { barrelTop(-20, -20, 26, 0.5, { h: 5, n: 3 }); barrelTop(17, -22, 23, 0.0, { h: 5, n: 3, seed: 1 }); barrelTop(-22, 15, 24, 1.4, { h: 5, n: 3, seed: 2 }); barrelTop(10, 12, 28, 0.8, { h: 5, n: 4, seed: 1 }); },
    // 7: lid knocked askew, grain showing in the gap
    () => {
      barrelTop(0, 0, 47, 0.2, { open: (inn, R) => { poly(inn); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(inn, P.straw, 0.7); grainSpill(0, 0, R * 0.95, R * 0.95, det >= 1 ? 90 : 30, 0, COL ? P.strawD : INK) } })
      const lc = [15, 13], lidR = 33, lid = ellP(lc[0], lc[1], lidR)
      shadow(lid, 5)
      plankDisc(lc[0], lc[1], lidR, 1.1, 4, { seed: 1 })
      ring(lc[0], lc[1], lidR * 0.9, lidR * 0.98, P.iron, { w: 0.7 })
      if (det >= 2) { for (let i = 0; i < 4; i++) { const a = PI / 4 + (i * PI) / 2; nail(lc[0] + cos(a) * lidR * 0.78, lc[1] + sin(a) * lidR * 0.78) } flushDots() }
      shadeIn(lid, lidR * 0.22, { gap: 2.2 }); pen(lid, 1.3)
    },
  ]
  reg('bm-barrel', 'Barrel', 'bm-objects', 'fixed', barrels)

  /* =====================================================================================================
     Sacks
     ===================================================================================================== */
  const sackTone = () => [P.canvasD, P.woodL, P.straw, P.canvas][(r() * 4) | 0]
  /** Cord with a knot. a to b is the band across the neck. */
  function tie(a, b, o) {
    o = o || {}
    line([a, lerp(a, b, 0.5), b], 1.5, { taper: 0.2, wob: 0.3 })
    const m = lerp(a, b, 0.5 + (o.at || 0)), q = ellP(m[0], m[1], 1.9); poly(q); ctx.fillStyle = PAPER; ctx.fill(); pen(q, 0.8, { flat: true })
    if (det >= 1) { const d = hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / d, ny = (b[0] - a[0]) / d; line([m, [m[0] + nx * 5 + 1, m[1] + ny * 5 + 3]], 0.7, { taper: 0.4, wob: 0.3 }); line([m, [m[0] + nx * 3 - 2, m[1] + ny * 3 + 4]], 0.7, { taper: 0.4, wob: 0.3 }) }
  }
  /** A sack lying down, the tied neck at +u, or standing (seen from above, the neck gathers in the middle). */
  function sack(cx, cy, w, h, ang, o) {
    o = o || {}
    const f = F(cx, cy, ang), col = o.col || sackTone()
    if (o.up) {
      // a standing sack from above: a squarish pillow whose mouth is gathered into a knot, folds running to the corners
      const body = jig(rrect(cx, cy, w, h, w * 0.3, ang, 5), 0.5)
      obj(body, { h: o.h == null ? 5 : o.h, col, a: 0.75, sd: w * 0.2, line: 1.4, wob: 1.3 })
      ctx.beginPath()
      const nf = det >= 1 ? 8 : 4
      for (let i = 0; i < nf; i++) {
        const a0 = ang + PI / 4 + (i / nf) * TAU + j(0.1), corner = i % 2 === 0, r1 = (corner ? 0.4 : 0.3) * w
        ctx.moveTo(cx + cos(a0) * w * 0.07, cy + sin(a0) * w * 0.07)
        ctx.quadraticCurveTo(cx + cos(a0 + 0.35) * r1 * 0.55, cy + sin(a0 + 0.35) * r1 * 0.55, cx + cos(a0 + 0.12) * r1, cy + sin(a0 + 0.12) * r1)
      }
      ctx.lineWidth = px(0.6); ctx.stroke()
      if (det >= 2) { ctx.save(); clipTo(body); ctx.beginPath(); for (let i = 0; i < 26; i++) { const x = rr(-w * 0.45, w * 0.45), y = rr(-h * 0.45, h * 0.45); ctx.moveTo(cx + x, cy + y); ctx.lineTo(cx + x + 1.4, cy + y + 1.4); ctx.moveTo(cx + x + 1.4, cy + y); ctx.lineTo(cx + x, cy + y + 1.4) } ctx.lineWidth = px(0.3); ctx.globalAlpha = 0.6; ctx.stroke(); ctx.restore() }
      const nk = 5 + ((r() * 3) | 0)
      for (let i = 0; i < nk; i++) { const a = (i / nk) * TAU + j(0.3), l = w * rr(0.1, 0.16); const fr = [[cx + cos(a - 0.4) * w * 0.05, cy + sin(a - 0.4) * w * 0.05], [cx + cos(a) * l, cy + sin(a) * l], [cx + cos(a + 0.4) * w * 0.05, cy + sin(a + 0.4) * w * 0.05]]; poly(fr); ctx.fillStyle = PAPER; ctx.fill(); pen(fr, 0.6, { flat: true }) }
      const kn = ellP(cx, cy, w * 0.055); poly(kn); ctx.fillStyle = PAPER; ctx.fill(); pen(kn, 0.8, { flat: true })
      if (det >= 1) line([[cx + w * 0.03, cy + w * 0.04], [cx + w * 0.13, cy + w * 0.1], [cx + w * 0.17, cy + w * 0.07]], 0.7, { taper: 0.3, wob: 0.3 })
      return
    }
    const ctl = [[-0.5, -0.36], [-0.42, -0.48], [-0.2, -0.5], [0.15, -0.49], [0.35, -0.42], [0.46, -0.26], [0.5, -0.12], [0.62, -0.09], [0.68, -0.12], [0.73, -0.18], [0.8, -0.16], [0.79, -0.05], [0.82, 0.04], [0.79, 0.15], [0.73, 0.17], [0.68, 0.12], [0.62, 0.09], [0.5, 0.12], [0.46, 0.26], [0.35, 0.42], [0.15, 0.49], [-0.2, 0.5], [-0.42, 0.48], [-0.5, 0.36], [-0.52, 0]]
    const body = cr(ctl.map(([u, v]) => f(u * w + j(0.5), v * h + j(0.5))), true, 3)
    obj(body, { h: o.h == null ? 4 : o.h, col, a: 0.75, sd: h * 0.22, line: 1.3, wob: 1.2 })
    if (det >= 1) {
      // the stitched bottom seam and creases sweeping back from the neck
      ctx.beginPath(); ctx.moveTo(...f(-0.4 * w, -0.46 * h)); ctx.lineTo(...f(-0.4 * w + j(0.5), 0.46 * h)); ctx.lineWidth = px(0.7); ctx.stroke()
      if (det >= 2) { ctx.beginPath(); for (let v = -0.42; v < 0.44; v += 0.085) { ctx.moveTo(...f(-0.44 * w, v * h)); ctx.lineTo(...f(-0.36 * w, v * h + 0.5)) } ctx.lineWidth = px(0.4); ctx.stroke() }
      for (const [a0, a1, c] of [[[0.44, -0.08], [0.05, -0.3], [-0.1, -0.14]], [[0.44, 0.08], [0.06, 0.28], [-0.12, 0.14]], [[0.4, -0.02], [-0.1, 0.04], [-0.3, -0.06]]]) line(cr([f(a0[0] * w, a0[1] * h), f(a1[0] * w, a1[1] * h), f(c[0] * w, c[1] * h)], false, 4), 0.6, { taper: 0.8, wob: 0.4 })
      if (det >= 2) { ctx.save(); clipTo(body); ctx.beginPath(); for (let i = 0; i < 40; i++) { const u = rr(-0.36, 0.4) * w, v = rr(-0.45, 0.45) * h; ctx.moveTo(...f(u, v)); ctx.lineTo(...f(u + 1.4, v + 1.4)); ctx.moveTo(...f(u + 1.4, v)); ctx.lineTo(...f(u, v + 1.4)) } ctx.lineWidth = px(0.3); ctx.globalAlpha = 0.6; ctx.stroke(); ctx.restore() }
    }
    tie(f(0.62 * w, -0.1 * h), f(0.62 * w, 0.1 * h))
    if (det >= 1) { ctx.beginPath(); for (let i = 0; i < 6; i++) { const v = (i / 5 - 0.5) * h * 0.3, u0 = 0.7 * w, u1 = 0.7 * w + w * rr(0.05, 0.1); ctx.moveTo(...f(u0, v * 0.6)); ctx.lineTo(...f(u1, v)) } ctx.lineWidth = px(0.45); ctx.stroke() }
  }
  /** Loose grain: dots, thicker toward the heap. */
  function grainSpill(cx, cy, rx, ry, n, ang, col) {
    ctx.beginPath(); const f = F(cx, cy, ang || 0)
    for (let i = 0; i < n; i++) { const a = r() * TAU, d = Math.pow(r(), 0.75), p = f(cos(a) * rx * d, sin(a) * ry * d), q = rr(0.5, 0.95) / k * lw; ctx.moveTo(p[0] + q, p[1]); ctx.arc(p[0], p[1], q, 0, TAU) }
    ctx.fillStyle = col || INK; ctx.fill()
  }
  function potato(x, y, rx, ry, ang) {
    const b = blob(x, y, rx, ry, ang, 8, 0.13, 3)
    obj(b, { h: 1.5, col: P.ochre, a: 0.6, sd: ry * 0.5, line: 0.8 })
    if (det >= 2) { const f = F(x, y, ang); seg(...f(rx * 0.1, -ry * 0.2), ...f(rx * 0.35, -ry * 0.1)); seg(...f(-rx * 0.4, ry * 0.2), ...f(-rx * 0.15, ry * 0.3)); flush(0.4) }
  }
  const sacks = [
    // 0: one standing sack, tied
    () => sack(0, 0, 76, 74, 0.0, { up: true, col: P.canvasD, h: 6 }),
    // 1: one lying sack
    () => sack(-6, 0, 78, 58, -0.32, { col: P.woodL, h: 5 }),
    // 2: three in a heap
    () => { sack(-14, 15, 62, 44, 0.25, { col: P.canvasD }); sack(14, -22, 60, 42, -0.15, { col: P.straw }); sack(16, 20, 50, 46, 0, { up: true, col: P.woodL }) },
    // 3: five stacked up
    () => {
      sack(-16, 20, 50, 38, 0.12, { col: P.canvasD }); sack(24, 22, 50, 40, -0.1, { col: P.woodL })
      sack(-24, -14, 48, 38, 0.7, { col: P.straw }); sack(10, -5, 52, 42, -0.2, { col: P.canvas })
      sack(2, -28, 40, 36, 0, { up: true, col: P.canvasD })
    },
    // 4: an open sack of grain, cuff rolled down, grain spilled
    () => {
      grainSpill(14, 18, 36, 28, det >= 1 ? 70 : 26, 0.4, COL ? P.strawD : INK)
      const body = blob(-6, -4, 31, 29, 0, 11, 0.07, 3); obj(body, { h: 5, col: P.canvasD, a: 0.75, sd: 8, line: 1.35, wob: 1.2 })
      const cuff = ellP(-6, -4, 24, 22); obj(cuff, { col: P.woodL, a: 0.7, sd: 5, line: 1.1, shade: 1 })
      const inn = ellP(-6, -4, 18, 16.5); poly(inn); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(inn, P.straw, 0.9)
      ctx.save(); clipTo(inn); ctx.beginPath(); for (let i = 0; i < (det >= 1 ? 130 : 40); i++) { const a = r() * TAU, d = Math.sqrt(r()) * 18, q = rr(0.5, 0.9) / k * lw; ctx.moveTo(-6 + cos(a) * d + q, -4 + sin(a) * 16 * d / 18); ctx.arc(-6 + cos(a) * d, -4 + sin(a) * 16 * d / 18, q, 0, TAU) } ctx.fillStyle = COL ? P.strawD : INK; ctx.fill(); ctx.restore()
      shadeIn(inn, 6, { rev: true, col: 'rgba(60,40,10,0.3)', inkToo: true, gap: 2 })
      pen(inn, 0.9, { swell: 0.2 })
    },
    // 5: a row of four lying sacks (as loaded on a cart)
    () => { for (let i = 0; i < 4; i++) sack(-6, -37 + i * 24.5, 78, 27, j(0.04) + (i % 2 ? 0.04 : -0.03), { col: [P.canvasD, P.woodL, P.straw, P.canvas][i], h: i === 3 ? 4 : 0 }) },
    // 6: a burst sack and a drift of flour
    () => {
      const dr = blob(8, 12, 36, 24, 0.5, 11, 0.16, 3)
      obj(dr, { h: 2, col: P.cloth, a: 0.45, sd: 6, line: 0.9, wob: 1.4 })
      if (det >= 1) stipIn(dr, 90, 0.55)
      sack(-12, -14, 60, 44, -0.28, { col: P.canvasD, h: 4 })
      // flour fans out of a torn seam
      if (det >= 1) { ctx.beginPath(); for (let i = 0; i < 14; i++) { const a = rr(0.1, 1.6), d = rr(24, 40); ctx.moveTo(14, 4); ctx.lineTo(14 + cos(a) * d * 0.5, 4 + sin(a) * d * 0.5) } ctx.lineWidth = px(0.35); ctx.stroke() }
    },
    // 7: a big sack and a small potato sack with potatoes spilled
    () => {
      for (let i = 0; i < 9; i++) potato(rr(-4, 40), rr(-4, 38), rr(5, 7), rr(4, 5.5), r() * PI)
      sack(-18, -12, 62, 54, 0.4, { col: P.canvasD, h: 5 }); sack(8, 24, 50, 34, -0.2, { col: P.woodL, h: 3 })
    },
  ]
  reg('bm-sacks', 'Sacks', 'bm-objects', 'fixed', sacks)

  /* =====================================================================================================
     Chests
     ===================================================================================================== */
  function coin(x, y, rad, o) {
    o = o || {}
    ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fillStyle = PAPER; ctx.fill()
    if (COL) { ctx.save(); ctx.globalAlpha = 0.85; ctx.fillStyle = o.col || P.gold; ctx.fill(); ctx.restore() }
    ctx.lineWidth = px(0.6); ctx.strokeStyle = INK; ctx.stroke()
    if (det >= 2 && rad * k > 2.6) { ctx.beginPath(); ctx.arc(x, y, rad * 0.6, 3.5, 5.1); ctx.lineWidth = px(0.4); ctx.stroke() }
  }
  function gem(x, y, rad, col, ang) {
    const pts = []; for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + (ang || 0); pts.push([x + cos(a) * rad, y + sin(a) * rad * 0.85]) }
    poly(pts); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(pts, col, 0.85)
    pen(pts, 0.7, { flat: true }); if (det >= 1) { seg(x - rad * 0.5, y - rad * 0.4, x + rad * 0.1, y + rad * 0.1); seg(x + rad * 0.5, y - rad * 0.4, x + rad * 0.1, y + rad * 0.1); flush(0.4) }
  }
  /** A heap of coins filling region poly: coins sorted top to bottom so the lower ones overlap. */
  function coinHeap(region, n, o) {
    o = o || {}
    const b = bbox(region), cs = []
    ctx.save(); clipTo(region)
    for (let i = 0; i < n; i++) { const x = rr(b.x0, b.x1), y = rr(b.y0, b.y1); cs.push([x, y, rr(2.3, 3.2)]) }
    cs.sort((p, q) => p[1] - q[1])
    for (const [x, y, rad] of cs) coin(x, y, rad, o)
    ctx.restore()
  }
  const hinge = (x, y, ang) => { const h = rectP(x, y, 7, 3.4, ang); poly(h); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tone(h, P.iron, 0.6); pen(h, 0.7, { flat: true }) }
  const ironBar = (cx, cy, w, h, ang, rivets) => {
    const f = F(cx, cy, ang), b = rectP(cx, cy, w, h, ang)
    poly(b); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tone(b, P.iron, 0.62); else if (det >= 1) hatchIn(b, ang + PI / 2, 2.4, 0.4, { minG: 1.5 })
    pen(b, 0.9, { flat: true })
    if (rivets && det >= 2) for (const v of rivets) nail(...f(0, v))
  }
  /** Closed chest: planked lid, iron bands, hinges at the back (up), lock and hasp at the front (down). */
  function chestBox(cx, cy, w, h, ang, o) {
    o = o || {}
    const f = F(cx, cy, ang), body = rrect(cx, cy, w, h, o.rad == null ? 3.5 : o.rad, ang)
    shadow(body, o.h == null ? 6 : o.h)
    poly(body); ctx.fillStyle = PAPER; ctx.fill()
    ctx.save(); clipTo(body); plankRect(cx, cy, w + 4, h + 4, ang, { pw: o.pw || 11, nails: false, seed: o.seed, cols: o.cols }); ctx.restore()
    const nb = o.bands == null ? 2 : o.bands
    for (let i = 0; i < nb; i++) { const u = nb === 1 ? 0 : -w / 2 + 8 + ((w - 16) * i) / (nb - 1); ironBar(...f(u, 0), o.bw || 6.4, h + 2.5, ang, [-h * 0.34, 0, h * 0.34]) }
    if (!o.noLock) {
      const lp = [f(-6, h / 2 - 7), f(6, h / 2 - 7), f(5, h / 2 + 2.5), f(-5, h / 2 + 2.5)]
      ironBar(...f(0, h / 2 - 12), 5, 10, ang, null)
      poly(lp); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tone(lp, o.lock || P.brass, 0.75); pen(lp, 0.9, { flat: true })
      const kh = ellP(...f(0, h / 2 - 3), 1.3); poly(kh); ctx.fillStyle = INK; ctx.fill()
    }
    hinge(...f(-w * 0.26, -h / 2 + 2), ang); hinge(...f(w * 0.26, -h / 2 + 2), ang)
    flushDots()
    if (det >= 1) shadeIn(body, o.dome ? h * 0.42 : h * 0.17, { gap: 2.3 })
    if (o.studs && det >= 1) { for (let u = -w / 2 + 4; u < w / 2 - 2; u += 7) { nail(...f(u, -h / 2 + 3)); nail(...f(u, h / 2 - 3)) } flushDots(null, 1.2) }
    pen(body, 1.4)
  }
  /** Open chest: lid propped up behind, wall rim, a heap of treasure inside. */
  function chestOpen(cx, cy, w, h, ang, o) {
    o = o || {}
    const f = F(cx, cy, ang), lidH = h * 0.78
    // lid, laid back: we look at the inside of the lid
    const lid = rrect(...f(0, -h / 2 - lidH / 2 + 2), w * 0.98, lidH, 3, ang)
    shadow(lid, 4)
    poly(lid); ctx.fillStyle = PAPER; ctx.fill()
    ctx.save(); clipTo(lid); plankRect(...f(0, -h / 2 - lidH / 2 + 2), w, lidH, ang, { pw: 11, nails: false, cols: [P.woodD, P.wood, P.woodD] }); ctx.restore()
    for (const u of [-w * 0.32, w * 0.32]) ironBar(...f(u, -h / 2 - lidH / 2 + 2), 5.5, lidH, ang, [-lidH * 0.3, lidH * 0.3])
    flushDots()
    if (det >= 1) shadeIn(lid, 5, { gap: 2.4, rev: true })
    pen(lid, 1.3)
    // box
    const body = rrect(cx, cy, w, h, 3, ang), inn = rrect(cx, cy, w - 14, h - 13, 2, ang)
    shadow(body, 5)
    poly(body); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(body, P.wood, 0.7)
    ctx.save(); clipTo(body); ctx.beginPath(); for (let i = 0; i < 6; i++) { const u = rr(-w / 2 + 3, w / 2 - 14), v = rr(h / 2 - 5.5, h / 2 - 1.5); ctx.moveTo(...f(u, v)); ctx.lineTo(...f(u + rr(6, 14), v + j(0.3))) } ctx.lineWidth = px(0.4); ctx.stroke(); ctx.restore()
    poly(inn); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(inn, P.woodX, 0.85)
    ctx.save(); clipTo(inn); if (!COL) hatchBox(...Object.values(bbox(inn)).slice(0, 4), -0.79, 2.4, 0.45); ctx.restore()
    if (o.fill) o.fill(inn, f, w - 14, h - 13)
    pen(inn, 0.95, { swell: 0.2 })
    for (const u of [-w * 0.32, w * 0.32]) ironBar(...f(u, 0), 6, h + 2, ang, [-h * 0.38, h * 0.38])
    const lp = [f(-5.5, h / 2 - 6), f(5.5, h / 2 - 6), f(4.5, h / 2 + 2), f(-4.5, h / 2 + 2)]; poly(lp); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tone(lp, P.brass, 0.75); pen(lp, 0.9, { flat: true })
    flushDots()
    pen(body, 1.4)
  }
  const chests = [
    // 0: closed chest, three iron bands
    () => chestBox(0, 0, 80, 52, -0.06, { bands: 3, pw: 12 }),
    // 1: open chest of coins
    () => chestOpen(0, 13, 76, 40, 0.0, { fill: (inn, f, iw, ih) => { const heap = blob(...f(0, 0), iw * 0.46, ih * 0.44, 0, 9, 0.12, 3); coinHeap(heap.length ? heap : inn, det >= 1 ? 46 : 14); pen(heap, 0.7, { wob: 0.8 }) } }),
    // 2: open chest, treasure spilling out the front
    () => {
      chestOpen(0, -2, 72, 38, -0.04, { fill: (inn, f, iw, ih) => {
        const heap = blob(...f(0, 2), iw * 0.5, ih * 0.5, 0, 9, 0.1, 3); coinHeap(heap, det >= 1 ? 44 : 12)
        gem(...f(-14, -4), 4.2, P.red); gem(...f(12, 2), 4.6, P.blue, 0.4); gem(...f(2, -8), 3.6, P.green, 0.2)
      } })
      for (let i = 0; i < (det >= 1 ? 14 : 5); i++) coin(rr(-20, 26), rr(24, 44), rr(2.3, 3), {})
      gem(-26, 34, 3.8, P.red, 0.3); gem(30, 40, 3.4, P.blue)
    },
    // 3: small strongbox with a padlock
    () => {
      chestBox(0, 0, 58, 42, 0.12, { bands: 2, pw: 10, bw: 8, lock: P.iron, seed: 1, cols: [P.iron, P.stoneD, P.iron], noLock: true })
      const f = F(0, 0, 0.12), pl = ellP(...f(0, 26), 5.2, 5.2); obj(pl, { h: 2, col: P.brass, a: 0.8, sd: 3, line: 1.1 }); const pk = rrect(...f(0, 17), 8, 8, 2, 0.12); obj(pk, { col: P.iron, a: 0.8, shade: 0, line: 1 })
      solidDot(...f(0, 26), 1.3, INK)
    },
    // 4: round-lidded trunk with brass studs and leather handles
    () => {
      const f = F(0, 0, 0.04)
      for (const sg of [-1, 1]) { ctx.beginPath(); ctx.ellipse(...f(sg * 46, 0), 4.4, 8, 0.04, 0, TAU); ctx.lineWidth = px(1.7); ctx.strokeStyle = INK; ctx.stroke(); if (COL) { ctx.beginPath(); ctx.ellipse(...f(sg * 46, 0), 4.4, 8, 0.04, 0, TAU); ctx.lineWidth = px(1); ctx.strokeStyle = P.leather; ctx.stroke() } }
      chestBox(0, 0, 84, 54, 0.04, { bands: 4, pw: 54, dome: true, studs: true, rad: 14, bw: 4.6, seed: 2, cols: [P.leather, P.leather, P.woodD] })
    },
    // 5: chest with the lid just lifted: a dark slit and a gleam of coins at the front
    () => {
      const w = 78, h = 50, f = F(0, 0, 0.0), body = rrect(0, 4, w, h, 3.5, 0)
      shadow(body, 6); poly(body); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(body, P.woodD, 0.8)
      // the dark opening along the front, with coins just showing
      const sl = rectP(0, 4 + h / 2 - 6, w - 8, 7, 0); poly(sl); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(sl, P.woodX, 0.95); else hatchIn(sl, 0.0, 1.3, 0.5, { minG: 1.2 })
      ctx.save(); clipTo(sl); for (let x = -30; x < 32; x += 7.5) coin(x + j(1.5), 4 + h / 2 - 5.2 + j(0.6), 2.4, {}); ctx.restore()
      pen(sl, 0.9, { swell: -0.5 })
      pen(body, 1.4)
      chestBox(0, -3, w - 2, h - 8, 0, { bands: 3, pw: 12, noLock: true, h: 4 })
      ctx.save(); ctx.beginPath(); ctx.restore()
      const lp = [f(-6, 14), f(6, 14), f(5, 24), f(-5, 24)]; poly(lp); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tone(lp, P.brass, 0.75); pen(lp, 0.9, { flat: true }); solidDot(0, 19, 1.1, INK)
    },
    // 6: wide sea chest with rope handles and a curved lid
    () => {
      const f = F(0, 0, 0.0)
      for (const sg of [-1, 1]) { ctx.beginPath(); ctx.arc(...f(sg * 46, 0), 6, 0, TAU); ctx.lineWidth = px(1.7); ctx.strokeStyle = INK; ctx.stroke() }
      chestBox(0, 0, 86, 46, 0, { bands: 3, pw: 11, dome: true, rad: 9, bw: 7, seed: 1, cols: [P.woodD, P.wood, P.woodD] })
      for (let i = 0; i < 3; i++) { const u = [-27, 0, 27][i]; if (det >= 2) { nail(u - 4, -18); nail(u + 4, -18); flushDots() } }
    },
    // 7: closed chest, a trail of spilled coins and a pouch
    () => {
      chestBox(-8, -10, 66, 44, -0.1, { bands: 2, pw: 11, h: 6 })
      for (let i = 0; i < (det >= 1 ? 13 : 5); i++) { const t = i / 12; coin(-14 + t * 46 + j(5), 26 + t * 10 + j(4), rr(2.3, 3), {}) }
      const f = F(0, 0, 0.0), pouch = cr([f(28, 8), f(40, 4), f(48, 14), f(44, 28), f(32, 30), f(26, 20)], true, 3)
      obj(pouch, { h: 3, col: P.leather, a: 0.75, sd: 5, line: 1.2 }); line([[30, 10], [42, 6]], 1.2, { taper: 0.1 })
      gem(36, 40, 3.5, P.green, 0.4)
    },
  ]
  reg('bm-chest', 'Chest', 'bm-objects', 'fixed', chests)

  /* =====================================================================================================
     Tables, benches, chairs and what is on them
     ===================================================================================================== */
  /** A chair seen from above, facing direction `face` (the seat looks that way, the back is behind it). */
  function chair(cx, cy, size, face, o) {
    o = o || {}
    const f = F(cx, cy, face), s = size
    const back = rrect(...f(-s * 0.5, 0), s * 0.2, s * 1.0, 1.5, face)
    const seat = rrect(...f(s * 0.04, 0), s * 0.82, s * 0.86, 2.5, face)
    obj(back, { h: 3, col: P.woodD, a: 0.7, shade: 0, line: 1.1 })
    obj(seat, { h: 3, col: o.col || P.wood, a: 0.65, sd: s * 0.2, line: 1.2 })
    if (det >= 1 && s * k > 14) { ctx.beginPath(); for (const v of [-0.22, 0.22]) { ctx.moveTo(...f(-s * 0.3, s * v)); ctx.lineTo(...f(s * 0.36, s * v)) } ctx.lineWidth = px(0.4); ctx.stroke() }
    if (o.cushion) { const cu = rrect(...f(s * 0.04, 0), s * 0.58, s * 0.6, 4, face); obj(cu, { col: P.red, a: 0.6, shade: 0, line: 0.8 }) }
  }
  function stool(cx, cy, R) {
    const c = ellP(cx, cy, R)
    obj(c, { h: 3, col: P.wood, a: 0.65, sd: R * 0.35, line: 1.2 })
    if (det >= 1 && R * k > 6) { ctx.beginPath(); for (const a of [0.3, 1.5, 2.6]) { ctx.moveTo(cx + cos(a) * R * 0.15, cy + sin(a) * R * 0.15); ctx.lineTo(cx + cos(a) * R * 0.86, cy + sin(a) * R * 0.86) } ctx.lineWidth = px(0.4); ctx.stroke() }
  }
  function bench(cx, cy, L, Wd, ang, o) {
    o = o || {}
    const body = rectP(cx, cy, L, Wd, ang), f = F(cx, cy, ang)
    shadow(body, 3.5)
    plankRect(cx, cy, L, Wd, ang, { n: 1, pw: Wd, nails: false, cols: o.cols || [P.wood, P.woodL] })
    if (det >= 1) { for (const sg of [-1, 1]) { const lg = rectP(...f(sg * L * 0.38, 0), 3.4, Wd + 1.6, ang); poly(lg); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tone(lg, P.woodD, 0.6); pen(lg, 0.7, { flat: true }) } }
    if (det >= 1) shadeIn(body, Wd * 0.3, { gap: 2.2 })
    pen(body, 1.2)
  }
  /** Plate with food: ring, a dab of food. */
  function plate(x, y, R, o) {
    o = o || {}
    const c = ellP(x, y, R); if (st.shadows) shadow(c, 1.2)
    poly(c); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(c, o.col || P.canvas, 0.6)
    pen(c, 0.8, { wob: 0.4 })
    if (R * k > 5) { pen(ellP(x, y, R * 0.66), 0.45, { flat: true }) }
    if (o.food) o.food(x, y, R)
  }
  /** Tankard from above: round rim, handle, ale. */
  function tankard(x, y, R, ang) {
    const f = F(x, y, ang || 0), hd = ellP(...f(R * 1.25, 0), R * 0.45, R * 0.55, ang)
    if (st.shadows) shadow(ellP(x, y, R), 2)
    ctx.beginPath(); ctx.arc(...f(R * 1.15, 0), R * 0.5, 0, TAU); ctx.lineWidth = px(1.3); ctx.strokeStyle = INK; ctx.stroke()
    const c = ellP(x, y, R); poly(c); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(c, P.woodL, 0.7); pen(c, 0.9, { wob: 0.3 })
    const a = ellP(x, y, R * 0.76); poly(a); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(a, P.ochre, 0.9)
    if (det >= 1) { pen(a, 0.45, { flat: true }); ctx.beginPath(); ctx.arc(x, y, R * 0.45, 3.5, 4.6); ctx.lineWidth = px(0.5); ctx.strokeStyle = COL ? '#f6f0dc' : INK; ctx.stroke() }
  }
  function candle(x, y, R) {
    const c = ellP(x, y, R); if (st.shadows) shadow(c, 1.6)
    poly(c); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(c, P.cloth, 0.6); pen(c, 0.8, { wob: 0.3 })
    solidDot(x, y, R * 0.38, COL ? P.flame : INK)
    if (det >= 1) { ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.3; ctx.moveTo(x + cos(a) * R * 1.45, y + sin(a) * R * 1.45); ctx.lineTo(x + cos(a) * R * 2.0, y + sin(a) * R * 2.0) } ctx.lineWidth = px(0.45); ctx.strokeStyle = COL ? P.flameR : INK; ctx.stroke() }
  }
  const loaf = (x, y, L, ang) => { const b = rrect(x, y, L, L * 0.52, L * 0.24, ang); obj(b, { h: 1.5, col: P.ochre, a: 0.65, sd: 2.2, line: 0.85 }); if (det >= 1) { const f = F(x, y, ang); for (const u of [-0.22, 0, 0.22]) seg(...f(u * L - 1, -L * 0.15), ...f(u * L + 1, L * 0.15)); flush(0.45) } }
  const cheese = (x, y, R) => { const c = ellP(x, y, R); obj(c, { h: 2, col: P.ochre, a: 0.55, sd: R * 0.35, line: 0.9 }); if (det >= 1) { seg(x, y, x + R * 0.9, y - R * 0.2); seg(x, y, x + R * 0.5, y + R * 0.8); flush(0.5) } }
  const jug = (x, y, R) => { const c = ellP(x, y, R); if (st.shadows) shadow(c, 3); poly(c); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(c, P.blue, 0.65); pen(c, 0.9, { wob: 0.3 }); pen(ellP(x, y, R * 0.55), 0.6, { flat: true }); ctx.beginPath(); ctx.arc(x + R * 1.1, y, R * 0.55, -1.2, 1.2); ctx.lineWidth = px(1.3); ctx.strokeStyle = INK; ctx.stroke() }
  const dice = (x, y, a) => { const d = rectP(x, y, 3.4, 3.4, a); poly(d); ctx.fillStyle = PAPER; ctx.fill(); pen(d, 0.6, { flat: true }); const f = F(x, y, a); dot(...f(-0.7, -0.7), 0.4); dot(...f(0.7, 0.7), 0.4); flushDots() }
  /** Table top: planked, optional cloth, edge shade. Rect or round. */
  function tableTop(cx, cy, w, h, ang, o) {
    o = o || {}
    if (o.round) {
      const c = ellP(cx, cy, w / 2); shadow(c, o.h == null ? 5 : o.h)
      plankDisc(cx, cy, w / 2, ang, o.n || 5, { seed: o.seed })
      if (det >= 1) shadeIn(c, w * 0.14, { gap: 2.4 })
      pen(c, 1.4)
      if (det >= 1) pen(ellP(cx, cy, w / 2 - 2.6), 0.5, { swell: 0.2 })
      return
    }
    const body = rectP(cx, cy, w, h, ang); shadow(body, o.h == null ? 5 : o.h)
    plankRect(cx, cy, w, h, ang, { pw: o.pw || 11, nails: false, seed: o.seed, cols: o.cols })
    if (det >= 2) { const f = F(cx, cy, ang); for (const sg of [-1, 1]) for (const v of [-1, 1]) nail(...f(sg * (w / 2 - 3), v * (h / 2 - 3))); flushDots() }
    if (det >= 1) shadeIn(body, min(w, h) * 0.15, { gap: 2.3 })
    pen(body, 1.4)
    if (det >= 1) { const inset = rectP(cx, cy, w - 5, h - 5, ang); pen(inset, 0.45, { swell: 0.2, flat: true }) }
  }
  const tables = [
    // 0: long table, a bench down each side, ale, bread
    () => {
      bench(0, -29, 84, 12, 0.0); bench(0, 29, 84, 12, 0.0)
      tableTop(0, 0, 86, 34, 0, { pw: 11 })
      tankard(-26, -8, 3.6, 0.3); tankard(-6, 9, 3.6, 2.9); tankard(30, -7, 3.6, 0.1); tankard(18, 8, 3.6, 3.4)
      plate(-8, -7, 5.4, { food: (x, y, R) => { ctx.beginPath(); ctx.arc(x, y, R * 0.34, 0, TAU); ctx.fillStyle = COL ? P.ochre : INK; ctx.globalAlpha = COL ? 0.8 : 0.9; ctx.fill(); ctx.globalAlpha = 1 } })
      plate(8, 8, 5.4); loaf(2, -2, 12, 0.4); cheese(-30, 6, 4.4)
    },
    // 1: round table, four chairs
    () => {
      const R = 24
      for (let i = 0; i < 4; i++) { const a = PI / 4 + (i * PI) / 2 + j(0.06); chair(cos(a) * 38, sin(a) * 38, 18, a + PI, { cushion: i === 2 }) }
      tableTop(0, 0, R * 2, R * 2, 0.4, { round: true, n: 5 })
      plate(-9, -8, 5.2); plate(9, 8, 5.2); tankard(8, -11, 3.4, 0.5); tankard(-10, 10, 3.4, 3.0); candle(0, 0, 3.2)
    },
    // 2: small square table, two stools, a candle and cards
    () => {
      stool(-40, 0, 9.5); stool(41, 6, 9.5)
      tableTop(0, 2, 50, 50, 0.06, { pw: 12, n: 4 })
      candle(-4, -4, 3.6)
      const f = F(8, 8, 0.4); for (let i = 0; i < 3; i++) { const c = rectP(...f(i * 4.5 - 4, 0), 7, 10, i * 0.25 - 0.2); obj(c, { col: P.cloth, a: 0.5, shade: 0, line: 0.7 }) }
      tankard(-14, 14, 3.6, 0.2); dice(14, -14, 0.3)
    },
    // 3: banquet table with chairs down both sides and at the head
    () => {
      for (let i = 0; i < 3; i++) { const u = -26 + i * 26; chair(u, -29, 17, PI / 2, { cushion: false }); chair(u, 29, 17, -PI / 2) }
      chair(-44, 0, 17, 0, { cushion: true })
      tableTop(2, 0, 82, 34, 0, { pw: 11 })
      candle(-2, 0, 2.8); candle(26, 0, 2.8)
      for (const [u, v] of [[-26, -9], [0, -9], [26, -9], [-26, 9], [0, 9], [26, 9]]) { plate(u, v, 4.6); }
      tankard(-14, -8, 3.2, 0.3); tankard(14, 8, 3.2, 3.0); tankard(-12, 7, 3.2, 3.2); loaf(12, -2, 11, 0.1); cheese(40, 2, 4.4)
    },
    // 4: tavern table, a bench, a spilled tankard and dice
    () => {
      bench(0, 36, 70, 12, 0.08); stool(-36, -30, 8.5); stool(34, -34, 8.5)
      tableTop(0, 0, 64, 46, 0.1, { pw: 11 })
      // spilled ale
      const sp = blob(14, -2, 9, 6, 0.5, 8, 0.2, 3); poly(sp); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(sp, P.ochre, 0.55); pen(sp, 0.5, { flat: true, wob: 1.2 }); if (!COL) hatchIn(sp, 0.4, 1.8, 0.35, { minG: 1.3 })
      tankard(6, -2, 3.8, -0.6); tankard(-20, 10, 3.8, 2.6); tankard(-14, -12, 3.8, 0.4)
      dice(-2, 12, 0.3); dice(3, 14, 1.0); dice(26, 12, 0.5)
      plate(-24, -6, 5)
    },
    // 5: round war table with a spread map
    () => {
      tableTop(0, 0, 90, 90, 0.2, { round: true, n: 7, h: 6 })
      const f = F(0, 0, -0.14), mp = [f(-30, -22), f(31, -24), f(33, 21), f(-28, 23)]
      obj(jig(mp, 0.6), { h: 1.5, col: P.cloth, a: 0.7, sd: 6, line: 1 })
      if (det >= 1) {
        line(cr([f(-26, -6), f(-14, -12), f(-2, -4), f(8, -14), f(24, -8)], false, 4), 0.8, { taper: 0.3, wob: 0.6 })
        for (const [u, v] of [[-18, 6], [-8, 12], [4, 8], [16, 14]]) { line([f(u - 3, v + 2), f(u, v - 3), f(u + 3, v + 2)], 0.7, { taper: 0.1 }) }
        ctx.beginPath(); ctx.moveTo(...f(-20, 14)); ctx.lineTo(...f(24, 4)); ctx.setLineDash([2, 2.5]); ctx.lineWidth = px(0.5); ctx.stroke(); ctx.setLineDash([])
      }
      for (const [u, v, c] of [[-14, -2, P.red], [10, 6, P.blue], [20, -10, P.green]]) { const t = ellP(...f(u, v), 2.7); obj(t, { h: 2, col: c, a: 0.8, sd: 1.5, line: 0.8 }) }
      tankard(-28, 34, 4, 0.3); tankard(30, 36, 4, 2.7); candle(-40, -14, 3.2); candle(40, -8, 3.2)
      const dg = [f(34, -8), f(42, -14), f(35, -6)]; line([f(30, 16), f(40, 8)], 1.5, { taper: 0.3 })
    },
    // 6: small bistro table, two chairs, a bottle and cups
    () => {
      chair(-34, -4, 22, 0.15, { cushion: true }); chair(34, 6, 22, PI + 0.1)
      tableTop(0, 0, 44, 44, 0.3, { round: true, n: 4, h: 5 })
      const bt = ellP(-3, -2, 3.6); if (st.shadows) shadow(bt, 4); poly(bt); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(bt, P.green, 0.8); pen(bt, 0.9); pen(ellP(-3, -2, 1.6), 0.6, { flat: true })
      tankard(9, -8, 3.4, 0.5); tankard(-10, 10, 3.4, 3.0); plate(8, 9, 4.6)
    },
    // 7: trestle table laid for a feast
    () => {
      bench(0, -31, 82, 11, 0.0, { cols: [P.woodL, P.wood] }); bench(0, 33, 82, 11, 0.0, { cols: [P.woodL, P.wood] })
      for (const u of [-34, 34]) { const t = bar([u, -21], [u, 21], 5.5); obj(t, { h: 3, col: P.woodD, shade: 0, line: 1 }) }
      tableTop(0, 0, 82, 32, 0, { pw: 16, n: 2, cols: [P.woodL, P.wood] })
      // roast bird on a platter, cheese, loaves, bowl, jug
      const pl = ellP(-4, 0, 11, 8, 0); poly(pl); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(pl, P.canvasD, 0.6); pen(pl, 0.8)
      const bd = blob(-4, 0, 7, 5, 0.3, 8, 0.1, 3); obj(bd, { h: 1, col: P.ochre, a: 0.75, sd: 2, line: 0.8 })
      loaf(-28, -6, 12, 0.2); loaf(-24, 8, 11, -0.3); cheese(22, 7, 5); jug(30, -8, 3.4)
      const bowl = ellP(12, -7, 5.5); poly(bowl); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(bowl, P.woodD, 0.5); pen(bowl, 0.8); for (let i = 0; i < 4; i++) ball(12 + j(2.5), -7 + j(2.5), 2, i % 2 ? P.red : P.green, { line: 0.5 })
      tankard(-12, 10, 3.2, 3.0); tankard(34, 8, 3.2, 0.2)
    },
  ]
  reg('bm-table', 'Table', 'bm-objects', 'fixed', tables)

  /* =====================================================================================================
     Rowboats
     ===================================================================================================== */
  const HULL = [[-50, 8], [-47, 12], [-38, 15], [-22, 16.5], [-2, 16.5], [20, 14], [36, 9.5], [46, 4], [52, 0]] // stern (left) to bow (right): [u, half-beam]
  /** Hull outline from stations, inset by `ins` (to get the gunwale's inner edge). */
  function hullPts(ins, st2) {
    const H = st2 || HULL, top = [], bot = []
    for (const [u, hw] of H) { const uu = u < -45 ? u + ins : u > 48 ? u - ins * 1.6 : u; const v = max(0, hw - ins); top.push([uu, -v]); bot.push([uu, v]) }
    return cr(top.concat(bot.reverse()), true, 3)
  }
  const hwAt = (u, H) => { H = H || HULL; if (u <= H[0][0]) return H[0][1]; for (let i = 1; i < H.length; i++) if (u <= H[i][0]) { const t = (u - H[i - 1][0]) / (H[i][0] - H[i - 1][0]); return H[i - 1][1] + (H[i][1] - H[i - 1][1]) * t } return 0 }
  /** Water ripples around a hull: short arcs and dashes, in ink on both looks. */
  function ripples(pts, n) {
    ctx.beginPath()
    for (let i = 0; i < n; i++) { const p = pts[(r() * pts.length) | 0], a = Math.atan2(p[1], p[0]), d = rr(5, 11), x = p[0] + cos(a) * d, y = p[1] + sin(a) * d, l = rr(4, 9) * 1.3; ctx.moveTo(x - l, y); ctx.quadraticCurveTo(x, y + rr(-1.2, 1.2), x + l, y + j(0.5)) }
    ctx.lineWidth = px(0.5); ctx.strokeStyle = COL ? P.waterD : INK; ctx.globalAlpha = 0.8; ctx.stroke(); ctx.globalAlpha = 1
  }
  function oar(a, b, bladeLen, o) { // shaft from a (inboard handle) to b (blade tip)
    o = o || {}
    const d = hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / d, uy = (b[1] - a[1]) / d, ang = Math.atan2(uy, ux)
    const bs = [a[0] + ux * (d - bladeLen), a[1] + uy * (d - bladeLen)]
    const sh = bar(a, bs, 1.9); obj(sh, { h: o.h == null ? 2 : o.h, col: P.woodL, shade: 0, line: 0.8 })
    const bl = cr([[bs[0], bs[1]], [bs[0] + ux * bladeLen * 0.3 - uy * 2.6, bs[1] + uy * bladeLen * 0.3 + ux * 2.6], [b[0] - uy * 2.2, b[1] + ux * 2.2], [b[0] + uy * 2.2, b[1] - ux * 2.2], [bs[0] + ux * bladeLen * 0.3 + uy * 2.6, bs[1] + uy * bladeLen * 0.3 - ux * 2.6]], true, 3)
    obj(bl, { h: o.h == null ? 2 : o.h, col: P.wood, a: 0.7, sd: 2, line: 0.9 })
    if (det >= 1) { line([bs, b], 0.5, { taper: 0.5, wob: 0.2 }) }
  }
  /** Boat interior: floor slats, ribs, thwarts. */
  function hullInterior(o) {
    o = o || {}
    const outer = hullPts(0), inner = hullPts(o.gun || 3.6)
    if (st.shadows) shadow(outer, 3)
    poly(outer); ctx.fillStyle = PAPER; ctx.fill()
    if (COL) tint(outer, P.woodD, 0.75)
    pen(outer, 1.5)
    poly(inner); ctx.fillStyle = PAPER; ctx.fill()
    if (COL) tint(inner, o.floor || P.woodL, 0.8)
    ctx.save(); clipTo(inner)
    // ribs across, floor strakes along
    ctx.beginPath()
    if (!o.noRibs) for (let u = -44; u < 50; u += o.rib || 8) { const hw = hwAt(u) + 1; ctx.moveTo(u + j(0.4), -hw); ctx.quadraticCurveTo(u + 1.2, 0, u + j(0.4), hw) }
    ctx.lineWidth = px(0.55); ctx.stroke()
    ctx.beginPath()
    for (const q of [-0.62, -0.3, 0.3, 0.62]) { ctx.moveTo(-44, q * hwAt(-44)); for (let u = -44; u <= 50; u += 3) ctx.lineTo(u, q * hwAt(u)) }
    ctx.lineWidth = px(0.45); ctx.stroke()
    if (det >= 1) shadeIn(inner, 6, { rev: true, gap: 2.2, col: 'rgba(30,18,8,0.25)', inkToo: true })
    ctx.restore()
    pen(inner, 1.0, { swell: 0.3 })
    return { outer, inner }
  }
  const thwart = (u, w) => { const hw = hwAt(u) - 1.6, b = rectP(u, 0, w || 7.5, hw * 2, 0); obj(b, { h: 2, col: P.wood, a: 0.7, sd: 3, line: 1.05 }); if (det >= 2) { nail(u, -hw + 3); nail(u, hw - 3); flushDots() } }
  const rowlock = (u, sg) => { const hw = hwAt(u); const q = ellP(u, sg * (hw - 1.7), 1.6); poly(q); ctx.fillStyle = PAPER; ctx.fill(); pen(q, 0.7, { flat: true }) }
  const boats = [
    // 0: classic rowboat, oars out
    () => {
      const o = hullPts(0); ripples(o, det >= 1 ? 7 : 3)
      oar([-3, -10], [-16, -49], 14); oar([3, 10], [-10, 49], 14)
      hullInterior({})
      thwart(-26); thwart(-3); thwart(20)
      const sn = [[-50, -8], [-40, -13], [-35, -12], [-35, 12], [-40, 13], [-50, 8]]; obj(sn, { col: P.woodL, a: 0.7, shade: 0, line: 0.9, h: 0 })
      rowlock(-3, -1); rowlock(3, 1)
      // bow deck
      const bd = [[34, -10], [46, -4.5], [51, 0], [46, 4.5], [34, 10]]; obj(cr(bd, true, 3), { col: P.wood, a: 0.7, sd: 3, line: 1, h: 0 })
    },
    // 1: fishing boat: oars shipped, net and catch
    () => {
      ripples(hullPts(0), det >= 1 ? 6 : 3)
      hullInterior({})
      thwart(-24); thwart(10)
      const net = blob(30, 0, 14, 8.5, 0, 9, 0.15, 3); poly(net); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(net, P.canvasD, 0.7)
      hatchIn(net, 0.7, 2.6, 0.45, { minG: 1.6 }); hatchIn(net, -0.8, 2.6, 0.45, { minG: 1.6 }); pen(net, 0.9, { wob: 1.1 })
      for (const sg of [-1, 1]) oar([-40, sg * 5.5], [8, sg * 5.5], 12, { h: 0 })
      for (const [x, y, a] of [[-14, -6, 0.4], [-18, 6, -0.3], [-4, 5, 0.2]]) { const f = F(x, y, a), fb = cr([f(-6, 0), f(-2, -2.6), f(3, -2), f(7, -0.2), f(4, 0.2), f(7, 2.2), f(3, 2), f(-2, 2.6)], true, 3); obj(fb, { col: P.canvasD, a: 0.6, sd: 1.5, line: 0.7, h: 0 }); solidDot(...f(2, -0.6), 0.5, INK) }
      const bk = ellP(-36, 4, 6.2); obj(bk, { h: 2, col: P.woodD, a: 0.7, sd: 3, line: 1 }); pen(ellP(-36, 4, 4), 0.6, { flat: true })
    },
    // 2: sailing dinghy: mast step, furled sail on the boom, tiller
    () => {
      ripples(hullPts(0), 5)
      hullInterior({ gun: 3.4 })
      thwart(-20, 8)
      const sail = rrect(0, 0, 76, 8.5, 4, 0.0); obj(sail, { h: 3, col: P.canvas, a: 0.8, sd: 3, line: 1.2 })
      if (det >= 1) for (let u = -32; u <= 32; u += 8) { ctx.beginPath(); ctx.moveTo(u, -4.8); ctx.lineTo(u + 0.5, 4.8); ctx.lineWidth = px(0.8); ctx.strokeStyle = INK; ctx.stroke() }
      const mast = ellP(14, 0, 4.2); obj(mast, { h: 3, col: P.woodD, a: 0.8, sd: 2, line: 1.2 }); solidDot(14, 0, 1.1, INK)
      for (const [x, y] of [[40, 0], [-6, -15], [-6, 15]]) rope([14, 0], [x, y], 0.4, 0.5)
      line([[-50, 0], [-42, 0.8], [-33, 2]], 2.2, { taper: 0.2, wob: 0.3 })
    },
    // 3: dugout canoe: narrow, hollowed, chisel marks, paddle across
    () => {
      const C = [[-50, 2], [-44, 6], [-30, 9.2], [-4, 10.5], [24, 9], [40, 5.5], [51, 0]]
      const out = hullPts(0, C), inn = hullPts(3.4, C)
      ripples(out, 6)
      if (st.shadows) shadow(out, 3)
      poly(out); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(out, P.woodD, 0.75); pen(out, 1.6, { wob: 1.2 })
      poly(inn); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(inn, P.woodL, 0.75)
      ctx.save(); clipTo(inn); ctx.beginPath()
      for (let i = 0; i < 46; i++) { const u = rr(-48, 48), q = rr(-1, 1), hw = hwAt(u, C), l = rr(3, 7); ctx.moveTo(u, q * hw); ctx.lineTo(u + l, q * hw + j(1.6)) }
      ctx.lineWidth = px(0.5); ctx.stroke()
      shadeIn(inn, 5, { rev: true, gap: 2.1, col: 'rgba(30,18,8,0.28)', inkToo: true }); ctx.restore()
      pen(inn, 1, { swell: 0.3 })
      oar([-14, -4], [14, 3], 10, { h: 1.5 })
      const p2 = [[-14, -5], [-30, -3]]; void p2
    },
    // 4: flat-bottomed punt with a pole
    () => {
      const o = [[-50, -15], [-47, -17], [44, -17], [50, -14], [50, 14], [44, 17], [-47, 17], [-50, 15]]
      ripples(cr(o, true, 2), 6)
      shadow(o, 3); poly(o); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(o, P.woodD, 0.7); pen(o, 1.5)
      const inn = [[-46, -12], [44, -12], [47, -10], [47, 10], [44, 12], [-46, 12]]; poly(inn); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(inn, P.woodL, 0.75)
      ctx.save(); clipTo(inn); ctx.beginPath(); for (let v = -8; v <= 8; v += 5.3) { ctx.moveTo(-50, v); ctx.lineTo(50, v) } ctx.lineWidth = px(0.6); ctx.stroke()
      ctx.beginPath(); for (let u = -40; u < 46; u += 26) { ctx.moveTo(u, -12); ctx.lineTo(u + j(0.4), 12) } ctx.stroke(); if (det >= 1) shadeIn(inn, 5, { rev: true, gap: 2.2, col: 'rgba(30,18,8,0.25)', inkToo: true }); ctx.restore()
      pen(inn, 0.95, { swell: 0.3 })
      if (det >= 2) { ctx.beginPath(); for (let u = -40; u < 46; u += 8.7) for (const v of [-5.3, 5.3]) { ctx.moveTo(u + 0.6, v); ctx.arc(u, v, 0.55 / k * lw, 0, TAU) } ctx.fillStyle = INK; ctx.fill() }
      const pole = bar([-44, 3], [60, -9], 2.2); void pole
      line([[-40, 4], [20, 1.5], [60, -1]], 2.4, { taper: 0.15, wob: 0.4 })
      thwart(-8, 7)
      const seat = rectP(-40, 0, 8, 22, 0); obj(seat, { col: P.wood, a: 0.7, sd: 3, line: 1, h: 2 })
    },
    // 5: small longboat, shields along the rail, oars through the oar-ports
    () => {
      const L = [[-50, 1.5], [-46, 8], [-34, 13.5], [-8, 15.5], [18, 13.5], [38, 8], [48, 3], [51, 0]]
      const out = hullPts(0, L), inn = hullPts(3.2, L)
      ripples(out, 7)
      for (let i = 0; i < 6; i++) { const u = -30 + i * 12; for (const sg of [-1, 1]) oar([u, sg * 5], [u - 6, sg * 39], 9, { h: 0 }) }
      if (st.shadows) shadow(out, 3)
      poly(out); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(out, P.woodD, 0.8); pen(out, 1.6)
      poly(inn); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(inn, P.woodL, 0.8)
      ctx.save(); clipTo(inn); ctx.beginPath(); for (let u = -44; u < 48; u += 6.5) { const hw = hwAt(u, L) + 1; ctx.moveTo(u, -hw); ctx.quadraticCurveTo(u + 1, 0, u, hw) } ctx.lineWidth = px(0.5); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(-46, 0); ctx.lineTo(48, 0); ctx.lineWidth = px(1.0); ctx.stroke(); if (det >= 1) shadeIn(inn, 5, { rev: true, gap: 2.2, col: 'rgba(30,18,8,0.25)', inkToo: true }); ctx.restore()
      pen(inn, 0.95, { swell: 0.3 })
      for (const u of [-34, -22, -10, 2, 14, 26]) { for (const sg of [-1, 1]) { const hw = hwAt(u, L); const sh = ellP(u + 3, sg * (hw - 2.5), 5.2, 3.4, 0); obj(sh, { col: [P.red, P.canvas, P.ochre, P.blue][((u + 40) / 12) % 4 | 0], a: 0.75, sd: 1.5, line: 0.9, h: 0 }); solidDot(u + 3, sg * (hw - 2.5), 0.9, INK) } }
      const mast = ellP(-2, 0, 3.6); obj(mast, { h: 3, col: P.woodD, a: 0.8, sd: 2, line: 1.2 })
      for (const [x, y] of [[-50, 0], [51, 0]]) { const q = ellP(x, y, 2.4); poly(q); ctx.fillStyle = PAPER; ctx.fill(); pen(q, 0.9, { flat: true }) }
    },
    // 6: cargo boat: crates, barrels and a roped tarp
    () => {
      ripples(hullPts(0), 6)
      hullInterior({})
      crateTop(-24, 0, 24, 22, 0.1, { h: 3, pw: 7, noCleat: true, seed: 1 })
      barrelTop(2, -6, 11.5, 0.3, { h: 3, n: 3 }); barrelTop(3, 10, 10, 0.9, { h: 3, n: 3, seed: 1 })
      const tarp = cr([[16, -10], [30, -12], [40, -6], [38, 4], [28, 11], [16, 8]], true, 3)
      obj(tarp, { h: 3, col: P.canvas, a: 0.8, sd: 6, line: 1.2 })
      ctx.save(); clipTo(tarp); for (const [a0, b0] of [[[16, -10], [40, 4]], [[16, 8], [38, -6]]]) rule(a0, b0, 0.8); ctx.restore()
      oar([-38, -9], [-5, -9], 9, { h: 0 })
    },
    // 7: beached boat, upside down: keel and strakes
    () => {
      const o = hullPts(0)
      shadow(o, 4); poly(o); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(o, P.woodD, 0.7)
      ctx.save(); clipTo(o); ctx.beginPath()
      for (const q of [-0.84, -0.64, -0.44, -0.22, 0.22, 0.44, 0.64, 0.84]) { ctx.moveTo(-50, q * hwAt(-50)); for (let u = -50; u <= 52; u += 3) ctx.lineTo(u, q * hwAt(u)) }
      ctx.lineWidth = px(0.8); ctx.stroke()
      if (det >= 1) { ctx.beginPath(); for (let i = 0; i < 70; i++) { const u = rr(-48, 46), q = rr(-0.9, 0.9), hw = hwAt(u); ctx.moveTo(u, q * hw); ctx.lineTo(u + rr(3, 7), q * hw + j(0.4)) } ctx.lineWidth = px(0.4); ctx.stroke() }
      shadeIn(o, 9, { gap: 2.3 }); ctx.restore()
      line([[-49, 0], [0, 0], [51, 0]], 2.6, { taper: 0.3, wob: 0.4 })
      pen(o, 1.6)
      oar([-30, 27], [30, 30], 12, { h: 2 })
    },
  ]
  reg('bm-rowboat', 'Rowboat', 'bm-objects', 'fixed', boats)

  /* =====================================================================================================
     Haystack (recipe) and hay heaps
     ===================================================================================================== */
  /** Straw strokes inside a clipped shape: lines running from an axis (or a centre) outward, slightly curved. */
  function strawStrokes(pts, n, o) {
    o = o || {}
    const b = bbox(pts), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2
    ctx.save(); clipTo(pts); ctx.beginPath()
    for (let i = 0; i < n; i++) {
      const x = rr(b.x0, b.x1), y = rr(b.y0, b.y1)
      let a
      if (o.radial) a = Math.atan2(y - cy, x - cx) + 0.35 + j(0.3)
      else a = (y > cy ? 1 : -1) * (PI / 2) * 0.8 + (o.ang || 0) + j(0.5)
      const l = (o.len || 8) * rr(0.55, 1.35)
      ctx.moveTo(x, y); ctx.quadraticCurveTo(x + cos(a + 0.2) * l * 0.5, y + sin(a + 0.2) * l * 0.5, x + cos(a) * l, y + sin(a) * l)
    }
    ctx.lineWidth = px(o.w || 0.5); ctx.strokeStyle = o.col || INK; ctx.stroke(); ctx.restore()
  }
  /** A heap of hay: ragged outline, straw strokes falling away from the ridge, loose straws at the edge. */
  function hayHeap(cx, cy, rx, ry, ang, o) {
    o = o || {}
    const body = blob(cx, cy, rx, ry, ang, 12, 0.07, 3)
    obj(body, { h: o.h == null ? 7 : o.h, col: P.straw, a: 0.8, sd: min(rx, ry) * 0.3, line: 1.3, wob: 2.2 })
    if (det >= 1) {
      strawStrokes(body, det >= 3 ? 220 : det >= 2 ? 130 : 50, { len: 9, w: 0.5 })
      if (COL) strawStrokes(body, 40, { len: 10, w: 0.9, col: P.strawD })
      ctx.save(); clipTo(body); ctx.beginPath(); const f = F(cx, cy, ang); ctx.moveTo(...f(-rx * 0.8, 0)); ctx.quadraticCurveTo(...f(0, ry * 0.08), ...f(rx * 0.8, 0)); ctx.lineWidth = px(0.8); ctx.stroke(); ctx.restore()
      // stray straws poking out
      ctx.beginPath(); for (let i = 0; i < 26; i++) { const t = r() * TAU, p = [cx + cos(t) * rx * 0.97, cy + sin(t) * ry * 0.97], l = rr(2.5, 6); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0] + cos(t + j(0.6)) * l, p[1] + sin(t + j(0.6)) * l) } ctx.lineWidth = px(0.5); ctx.stroke()
    }
  }
  reg('bm-haystack', 'Haystack', 'bm-village', 'recipe', [() => {
    const rick = r() < 0.25, R = 43 + j(2), ang = r() * TAU
    const rx = rick ? 47 + j(2) : R, ry = rick ? 29 + j(2) : R * (0.95 + j(0.04))
    const body = blob(0, 0, rx, ry, rick ? ang : 0, 14, rick ? 0.05 : 0.07, 3)
    // loose straw scattered round the base
    if (det >= 1) { ctx.beginPath(); for (let i = 0; i < (det >= 2 ? 34 : 12); i++) { const t = r() * TAU, d = rr(0.98, 1.2), x = cos(t) * rx * d, y = sin(t) * ry * d, a = r() * PI, l = rr(2.5, 6); const q = F(0, 0, rick ? ang : 0)(x, y); ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0] + cos(a) * l, q[1] + sin(a) * l * 0.8) } ctx.lineWidth = px(0.5); ctx.stroke() }
    obj(body, { h: 9, col: P.straw, a: 0.8, sd: R * 0.3, line: 1.4, wob: 2.4 })
    {
      const n = det >= 3 ? 420 : det >= 2 ? 240 : det >= 1 ? 80 : 32
      if (rick) {
        strawStrokes(body, n, { len: 9, w: 0.5, ang })
        if (COL && det >= 1) strawStrokes(body, 50, { len: 11, w: 0.95, col: P.strawD, ang })
        ctx.save(); clipTo(body); const f = F(0, 0, ang); ctx.beginPath(); ctx.moveTo(...f(-rx, 0)); ctx.quadraticCurveTo(...f(0, j(2)), ...f(rx, 0)); ctx.lineWidth = px(0.9); ctx.stroke(); ctx.restore()
      } else {
        // round stack: strokes spiral off the crown; the lower-right is combed darker
        ctx.save(); clipTo(body); ctx.beginPath()
        for (let i = 0; i < n; i++) { const a = r() * TAU, d = Math.pow(r(), 0.8) * R * 0.97, x = cos(a) * d, y = sin(a) * d, l = R * rr(0.07, 0.17) * (0.5 + d / R), a2 = a + 0.4 + j(0.25); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + cos(a2 + 0.25) * l * 0.5, y + sin(a2 + 0.25) * l * 0.5, x + cos(a2) * l, y + sin(a2) * l) }
        ctx.lineWidth = px(0.5); ctx.strokeStyle = INK; ctx.stroke()
        if (COL && det >= 1) { ctx.beginPath(); for (let i = 0; i < 60; i++) { const a = r() * TAU, d = Math.sqrt(r()) * R * 0.95, x = cos(a) * d, y = sin(a) * d, l = R * rr(0.1, 0.18), a2 = a + 0.4; ctx.moveTo(x, y); ctx.lineTo(x + cos(a2) * l, y + sin(a2) * l) } ctx.lineWidth = px(1.0); ctx.strokeStyle = P.strawD; ctx.globalAlpha = 0.55; ctx.stroke(); ctx.globalAlpha = 1 }
        // layered arcs where the thatching overlaps
        ctx.beginPath(); for (let i = 0; i < (det >= 2 ? 7 : det >= 1 ? 3 : 0); i++) { const rad = R * rr(0.3, 0.88), a0 = r() * TAU; ctx.moveTo(cos(a0) * rad, sin(a0) * rad); ctx.arc(0, 0, rad, a0, a0 + rr(0.7, 1.7)) } ctx.lineWidth = px(0.6); ctx.stroke()
        ctx.restore()
        // a binding rope looped over the crown (sagging, not ruler-straight), and the pole tip
        if (det >= 1 && r() < 0.5) { const t = r() * PI, s1 = [cos(t) * R * 0.99, sin(t) * R * 0.99], s2 = [-cos(t) * R * 0.99, -sin(t) * R * 0.99]; line(cr([s1, [cos(t) * R * 0.5 + sin(t) * 3, sin(t) * R * 0.5 - cos(t) * 3], [0, 0], [-cos(t) * R * 0.5 + sin(t) * 2, -sin(t) * R * 0.5 - cos(t) * 2], s2], false, 4), 0.8, { taper: 0.05, wob: 0.8 }); const kn = ellP(s1[0] * 0.97, s1[1] * 0.97, 1.7); poly(kn); ctx.fillStyle = PAPER; ctx.fill(); pen(kn, 0.6, { flat: true }) }
        if (det >= 1) solidDot(0, 0, 1.3, INK)
      }
      ctx.beginPath(); for (let i = 0; i < 24; i++) { const t = r() * TAU, d = rr(0.95, 1.0), p = [cos(t) * rx * d, sin(t) * ry * d], p2 = rick ? F(0, 0, ang)(p[0], p[1]) : p, l = rr(2.5, 6); ctx.moveTo(p2[0], p2[1]); ctx.lineTo(p2[0] + cos(t + j(0.6)) * l, p2[1] + sin(t + j(0.6)) * l) } ctx.lineWidth = px(0.5); ctx.stroke()
    }
  }])

  /* =====================================================================================================
     Wells
     ===================================================================================================== */
  /** Round ring of cut stones: two staggered courses of wedge stones around a hole. */
  function stoneRing(cx, cy, Ro, Ri, o) {
    o = o || {}
    const outer = blob(cx, cy, Ro, Ro, 0, 18, o.irr == null ? 0.025 : o.irr, 3), inner = ellP(cx, cy, Ri)
    shadow(outer, o.h == null ? 8 : o.h)
    ctx.beginPath(); sub(outer); sub(inner); ctx.fillStyle = PAPER; ctx.fill('evenodd')
    const Rm = (Ro + Ri) / 2, courses = [[Rm, Ro, 0], [Ri, Rm, 0.5]]
    for (const [r0, r1, off] of courses) {
      const n = Math.max(7, Math.round((TAU * (r0 + r1) / 2) / (o.stone || 11.5)))
      ctx.beginPath()
      for (let i = 0; i < n; i++) {
        const a0 = ((i + off) / n) * TAU + j(0.03), a1 = ((i + 1 + off) / n) * TAU + j(0.03)
        if (COL) { const q = [[cx + cos(a0) * r0, cy + sin(a0) * r0], [cx + cos(a0) * r1, cy + sin(a0) * r1], [cx + cos(a1) * r1, cy + sin(a1) * r1], [cx + cos(a1) * r0, cy + sin(a1) * r0]]; tone(q, [o.col || P.stone, P.stoneL, P.stoneD, o.col || P.stone][(r() * 4) | 0], 0.5) }
        ctx.moveTo(cx + cos(a0) * r0, cy + sin(a0) * r0); ctx.lineTo(cx + cos(a0 + j(0.01)) * r1, cy + sin(a0) * r1)
      }
      ctx.lineWidth = px(0.8); ctx.strokeStyle = INK; ctx.stroke()
    }
    // course line, wobbly
    const mid = []; for (let i = 0; i < 40; i++) { const a = (i / 40) * TAU; mid.push([cx + cos(a) * (Rm + j(0.6)), cy + sin(a) * (Rm + j(0.6))]) }
    pen(mid, 0.7, { flat: true, wob: 0.6 })
    ctx.save(); ctx.beginPath(); sub(outer); sub(inner); ctx.clip('evenodd')
    if (det >= 1) shadeIn(outer, (Ro - Ri) * 0.62, { gap: 2.3 })
    if (det >= 2) { ctx.beginPath(); for (let i = 0; i < 60; i++) { const a = r() * TAU, d = rr(Ri + 1, Ro - 1), q = 0.5 / k * lw * rr(0.7, 1.3); ctx.moveTo(cx + cos(a) * d + q, cy + sin(a) * d); ctx.arc(cx + cos(a) * d, cy + sin(a) * d, q, 0, TAU) } ctx.fillStyle = INK; ctx.fill() }
    ctx.restore()
    pen(outer, 1.5)
    return { outer, inner }
  }
  /** Water or a dark pit inside a hole. */
  function wellWater(cx, cy, Ri, o) {
    o = o || {}
    const inner = o.poly || ellP(cx, cy, Ri - 0.5)
    poly(inner); ctx.fillStyle = PAPER; ctx.fill()
    if (COL) tint(inner, o.dry ? P.woodX : P.waterD, 0.85)
    ctx.save(); clipTo(inner)
    if (!COL || o.dry) hatchBox(cx - Ri, cy - Ri, cx + Ri, cy + Ri, o.dry ? -0.79 : 0.0, o.dry ? 1.9 : 2.7, 0.45)
    if (!o.dry) {
      shadeIn(inner, Ri * 0.45, { rev: true, gap: 1.8, col: 'rgba(20,35,38,0.35)', inkToo: true })
      ctx.beginPath(); for (let i = 0; i < (det >= 1 ? 3 : 1); i++) { const q = Ri * (0.25 + i * 0.22); ctx.moveTo(cx + Ri * 0.1 + q * cos(0.4), cy + Ri * 0.12 + q * sin(0.4)); ctx.arc(cx + Ri * 0.1, cy + Ri * 0.12, q, 0.4, 0.4 + rr(1.4, 2.6)) } ctx.lineWidth = px(0.55); ctx.strokeStyle = COL ? '#d8e6df' : PAPER; ctx.stroke()
    } else shadeIn(inner, Ri * 0.5, { rev: true, gap: 1.5, col: 'rgba(0,0,0,0.4)', inkToo: true })
    ctx.restore()
    pen(inner, 1.2, { swell: -0.6 })
  }
  function bucket(x, y, R) {
    const c = ellP(x, y, R); shadow(c, 3); poly(c); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(c, P.wood, 0.7); pen(c, 1)
    const in2 = ellP(x, y, R * 0.78); poly(in2); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(in2, P.waterD, 0.8); if (!COL && det >= 1) hatchIn(in2, 0.3, 1.6, 0.4, { minG: 1.2 }); pen(in2, 0.7, { swell: -0.5 })
    ctx.beginPath(); ctx.arc(x, y, R * 0.98, -0.7, 0.7); ctx.arc(x, y, R * 0.98, PI - 0.7, PI + 0.7); ctx.lineWidth = px(0.8); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(x - R, y); ctx.lineTo(x + R, y); ctx.lineWidth = px(1.0); ctx.stroke()
  }
  function gableRoof(cx, cy, L, W, ang, o) {
    o = o || {}
    const f = F(cx, cy, ang), hl = L / 2, hw = W / 2, body = rectP(cx, cy, L, W, ang)
    shadow(body, o.h == null ? 10 : o.h)
    poly(body); ctx.fillStyle = PAPER; ctx.fill()
    const up = [f(-hl, -hw), f(hl, -hw), f(hl, 0), f(-hl, 0)], lo = [f(-hl, 0), f(hl, 0), f(hl, hw), f(-hl, hw)]
    if (COL) { tint(body, o.col || P.roof, 0.7); tone(lo, P.shade, 0.22) }
    // shingle rows: scalloped courses running along the ridge
    const rows = det >= 2 ? 5 : 3
    for (const sgn of [-1, 1]) {
      ctx.save(); clipTo(sgn < 0 ? up : lo); ctx.beginPath()
      for (let i = 0; i < rows; i++) { const v = sgn * (hw - ((i + 0.4) * hw) / rows); let first = true; for (let u = -hl; u <= hl; u += 3.2) { const vv = v + (((u / 3.2) | 0) % 2 ? 0.7 : -0.1); if (first) { ctx.moveTo(...f(u, vv)); first = false } else ctx.lineTo(...f(u, vv)) } }
      ctx.lineWidth = px(0.55); ctx.stroke()
      if (sgn > 0) hatchBox(...Object.values(bbox(lo)).slice(0, 4), ang + PI / 2, 2.4, 0.5, { minG: 1.6 })
      ctx.restore()
    }
    rule(f(-hl - 2, 0), f(hl + 2, 0), 1.6, { taper: 0.2 })
    pen(body, 1.5)
    return { body, f }
  }
  const post = (x, y, s) => { const b = rectP(x, y, s, s, 0); obj(b, { h: 3, col: P.woodD, a: 0.75, sd: s * 0.4, line: 1 }) }
  const wells = [
    // 0: plain round well, a bucket on the rim
    () => {
      stoneRing(0, 0, 44, 25)
      wellWater(0, 0, 25)
      bucket(30, -27, 6.2); line([[33, -24], [27, -6]], 0.9, { taper: 0.1 })
    },
    // 1: well under a gabled roof
    () => {
      stoneRing(0, 0, 40, 25, { h: 5 })
      wellWater(0, 0, 25)
      post(-35, 0, 7); post(35, 0, 7)
      gableRoof(0, 0, 88, 40, 0.0, { h: 10 })
    },
    // 2: open well with a windlass, rope and bucket
    () => {
      stoneRing(0, 0, 38, 24, { h: 6 })
      wellWater(0, 0, 24)
      post(-36, 1, 8); post(36, 1, 8)
      // crank beam across, drum in the middle with rope wound on, handle at the left
      const beam = bar([-46, 0], [40, 0], 4.4); obj(beam, { h: 7, col: P.woodL, a: 0.75, sd: 2, line: 1.15 })
      const drum = rectP(-2, 0, 22, 9, 0); obj(drum, { h: 7, col: P.wood, a: 0.8, sd: 3, line: 1.2 })
      ctx.beginPath(); for (let u = -11; u <= 9; u += 2.8) { ctx.moveTo(u, -4.5); ctx.lineTo(u + 1.3, 4.5) } ctx.lineWidth = px(0.55); ctx.stroke()
      line([[-46, 0], [-50, 10], [-42, 14]], 1.9, { taper: 0.1, wob: 0.2 }); line([[-44, 14], [-36, 11]], 1.9, { taper: 0.1, wob: 0.2 })
      line([[-2, 4.5], [3, 16], [3, 22]], 0.9, { taper: 0.05 })
      bucket(3, 25, 5.6)
    },
    // 3: square stone well, moss in the joints
    () => {
      const sq = rectP(0, 0, 80, 80, 0.03), sin2 = rectP(0, 0, 44, 44, 0.03), f = F(0, 0, 0.03)
      shadow(sq, 8)
      ctx.beginPath(); sub(sq); sub(sin2); ctx.fillStyle = PAPER; ctx.fill('evenodd')
      ctx.save(); ctx.beginPath(); sub(sq); sub(sin2); ctx.clip('evenodd')
      // two courses of blocks, the outer one staggered
      ctx.beginPath()
      for (const [a, b, off] of [[22, 31, 0], [31, 40, 6]]) for (let i = -4; i <= 4; i++) {
        const t = i * 12 + 2 + off
        ctx.moveTo(...f(t, -a)); ctx.lineTo(...f(t, -b)); ctx.moveTo(...f(t, a)); ctx.lineTo(...f(t, b)); ctx.moveTo(...f(-a, t)); ctx.lineTo(...f(-b, t)); ctx.moveTo(...f(a, t)); ctx.lineTo(...f(b, t))
      }
      ctx.lineWidth = px(0.7); ctx.strokeStyle = INK; ctx.stroke()
      line([f(-31, -31), f(31, -31), f(31, 31), f(-31, 31), f(-31, -31)], 0.7, { taper: 0, wob: 0.6 })
      if (COL) for (let i = 0; i < 9; i++) tint(blob(...f(rr(-34, 34), rr(-34, 34)), rr(4, 8), rr(3, 6), r() * PI, 8, 0.2, 3), P.green, 0.5)
      if (det >= 1) shadeIn(sq, 17, { gap: 2.3 })
      ctx.restore()
      pen(sq, 1.6)
      wellWater(0, 0, 22, { poly: rectP(0, 0, 43, 43, 0.03) })
      pen(sin2, 1.2, { swell: -0.6 })
    },
    // 4: round well with a wooden lid half slid off
    () => {
      stoneRing(0, 0, 44, 26, { h: 6 })
      wellWater(0, 0, 26, { dry: false })
      const lidR = 25, f = F(10, 12, 0.5)
      const lid = ellP(10, 12, lidR); shadow(lid, 4)
      plankDisc(10, 12, lidR, 0.5, 4, { seed: 1 })
      shadeIn(lid, 7, { gap: 2.3 }); pen(lid, 1.4)
      ring(10, 12, lidR * 0.88, lidR * 0.95, P.iron, { w: 0.6 })
      // iron ring handle
      ctx.beginPath(); ctx.arc(...f(-6, 0), 4.2, 0, TAU); ctx.lineWidth = px(1.4); ctx.strokeStyle = INK; ctx.stroke(); solidDot(...f(-6, -4), 1, INK)
    },
    // 5: ruined, dry well: a broken ring, rubble, weeds
    () => {
      const Ro = 41, Ri = 24, outer = blob(0, 0, Ro, Ro, 0, 18, 0.05, 3), inner = ellP(0, 0, Ri)
      shadow(outer, 6)
      ctx.beginPath(); sub(outer); sub(inner); ctx.fillStyle = PAPER; ctx.fill('evenodd')
      // pit
      wellWater(0, 0, Ri, { dry: true })
      // surviving stones of the ring: several irregular blocks and gaps
      const arcs = [[-0.2, 1.4], [1.7, 2.7], [3.05, 3.9], [4.2, 5.25], [5.5, 6.0]]
      for (const [a0, a1] of arcs) {
        const n = Math.max(1, Math.round(((a1 - a0) * (Ri + Ro) / 2) / 11))
        for (let i = 0; i < n; i++) {
          const q0 = a0 + ((a1 - a0) * i) / n, q1 = a0 + ((a1 - a0) * (i + 1)) / n, ro = Ro - rr(0, 5) * (i % 2), ri = Ri + rr(0, 2.5)
          const bl = [[cos(q0) * ri, sin(q0) * ri], [cos(q0 + 0.02) * ro, sin(q0 + 0.02) * ro], [cos((q0 + q1) / 2) * (ro + 1), sin((q0 + q1) / 2) * (ro + 1)], [cos(q1) * ro, sin(q1) * ro], [cos(q1) * ri, sin(q1) * ri]]
          obj(jig(bl, 0.7), { h: 3, col: [P.stone, P.stoneL, P.stoneD][i % 3], a: 0.75, sd: 4, line: 1.1 })
          if (det >= 1) { sinCrack(bl) }
        }
      }
      // fallen rubble
      for (const [x, y, rx0, ry0] of [[-44, 20, 6, 4.5], [32, 40, 5, 3.5], [-26, -42, 5.5, 4], [44, -18, 4, 3.2], [0, 46, 4.5, 3.5], [-48, -4, 3.6, 3]]) { const b = blob(x, y, rx0, ry0, r() * PI, 8, 0.15, 3); obj(b, { h: 2, col: P.stone, a: 0.7, sd: 3, line: 0.9 }) }
      if (det >= 1) { // weeds and moss
        for (const [x, y] of [[-35, 22], [30, -34], [38, 12], [-14, 40]]) { ctx.beginPath(); for (let i = 0; i < 5; i++) { ctx.moveTo(x, y); ctx.quadraticCurveTo(x + (i - 2) * 2, y - 5, x + (i - 2) * 3.4, y - rr(6, 10)) } ctx.lineWidth = px(0.6); ctx.stroke() }
        if (COL) for (const [x, y] of [[-30, -28], [36, 20], [-4, 36]]) tint(blob(x, y, 8, 5, r() * PI, 8, 0.2, 3), P.green, 0.5)
      }
    },
    // 6: village pump, with a stone trough
    () => {
      const trough = rectP(2, 30, 82, 24, 0.0), tin = rectP(2, 30, 72, 14, 0.0)
      shadow(trough, 6); poly(trough); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(trough, P.stone, 0.7)
      poly(tin); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(tin, P.waterD, 0.85)
      if (!COL) hatchIn(tin, 0.0, 2.6, 0.45); shadeIn(tin, 5, { rev: true, gap: 1.8, col: 'rgba(20,35,38,0.35)', inkToo: true }); pen(tin, 0.9, { swell: -0.5 })
      ctx.save(); clipTo(trough); ctx.beginPath(); for (const u of [-30, -8, 16, 36]) { ctx.moveTo(u, 18); ctx.lineTo(u, 21); ctx.moveTo(u + 5, 39); ctx.lineTo(u + 5, 42) } ctx.lineWidth = px(0.6); ctx.stroke(); ctx.restore()
      if (det >= 1) shadeIn(trough, 5, { gap: 2.3 }); pen(trough, 1.5)
      // pump base: a round stone slab, the pump body, the lever
      const slab = blob(-8, -14, 29, 27, 0, 14, 0.04, 3); obj(slab, { h: 5, col: P.stone, a: 0.7, sd: 8, line: 1.4 })
      if (det >= 1) { ctx.beginPath(); for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU + 0.3; ctx.moveTo(-8 + cos(a) * 14, -14 + sin(a) * 13); ctx.lineTo(-8 + cos(a) * 27, -14 + sin(a) * 25) } ctx.lineWidth = px(0.55); ctx.stroke() }
      const spout = bar([-8, -14], [8, 6], 4.6); obj(spout, { h: 4, col: P.iron, a: 0.7, sd: 2, line: 1.1 })
      const body = ellP(-8, -14, 8); obj(body, { h: 7, col: P.iron, a: 0.75, sd: 3, line: 1.3 }); pen(ellP(-8, -14, 4.2), 0.7, { flat: true })
      const lever = [[-9, -16], [-40, -34], [-43, -31], [-10, -11]]; obj(lever, { h: 6, col: P.iron, a: 0.75, shade: 0, line: 1.1 }); ball(-42, -33, 3.6, P.iron, { line: 0.9 })
      solidDot(-8, -14, 1.5, INK)
    },
    // 7: well-house: an octagonal tiled roof on four posts
    () => {
      stoneRing(0, 0, 44, 22, { h: 5 })
      for (const [x, y] of [[0, -38], [38, 0], [0, 38], [-38, 0]]) post(x, y, 7)
      const R = 33, oct = []; for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + PI / 8; oct.push([cos(a) * R, sin(a) * R]) }
      shadow(oct, 11); poly(oct); ctx.fillStyle = PAPER; ctx.fill()
      if (COL) { tint(oct, P.roof, 0.7); for (let i = 0; i < 8; i++) { const a = oct[i], b = oct[(i + 1) % 8]; if (i === 5 || i === 6 || i === 7 || i === 0) tone([[0, 0], a, b], P.shade, 0.2) } }
      for (let i = 0; i < 8; i++) { const a = oct[i], b = oct[(i + 1) % 8], fc = [[0, 0], a, b]; if (det >= 1) { ctx.save(); clipTo(fc); const ang = Math.atan2(b[1] - a[1], b[0] - a[0]); hatchBox(-R, -R, R, R, ang, (i >= 4 && i <= 7 ? 2.2 : 3.2), 0.45, { minG: 1.7 }); ctx.restore() } rule([0, 0], a, 0.9, { over: 0 }) }
      pen(oct, 1.5)
      const c = ellP(0, 0, 3.2); obj(c, { col: P.iron, a: 0.7, shade: 0, line: 1 })
    },
  ]
  /** Little crack on a stone. */
  function sinCrack(bl) { const a = bl[(r() * bl.length) | 0], b = bl[((r() * bl.length) | 0)]; line([a, lerp(a, b, 0.5), [a[0] + (b[0] - a[0]) * 0.5 + j(2), a[1] + (b[1] - a[1]) * 0.5 + j(2)]].slice(0, 2), 0.4, { taper: 0.5 }) }
  reg('bm-well', 'Well', 'bm-village', 'fixed', wells)

  /* =====================================================================================================
     Market stalls: s is the width. Table at the front (bottom), awning over the back, goods on the table.
     ===================================================================================================== */
  function basket(x, y, R, fruit) {
    const c = ellP(x, y, R); shadow(c, 2.5); poly(c); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(c, P.woodL, 0.75); pen(c, 0.95, { wob: 0.4 })
    if (det >= 1) { ctx.beginPath(); for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; ctx.moveTo(x + cos(a) * R * 0.86, y + sin(a) * R * 0.86); ctx.lineTo(x + cos(a) * R * 0.99, y + sin(a) * R * 0.99) } ctx.lineWidth = px(0.45); ctx.stroke() }
    const in2 = ellP(x, y, R * 0.8); poly(in2); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(in2, P.woodD, 0.5)
    if (fruit) { const n = det >= 1 ? 7 : 3; for (let i = 0; i < n; i++) { const a = i * 2.4, d = R * 0.5 * Math.sqrt((i + 0.4) / n); ball(x + cos(a) * d, y + sin(a) * d, R * 0.27, fruit[i % fruit.length], { line: 0.6, shadeCol: 'rgba(50,20,10,.3)' }) } }
  }
  function bottle(x, y, R, col) {
    const c = ellP(x, y, R); shadow(c, 2.5); poly(c); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(c, col, 0.85); pen(c, 0.8, { wob: 0.3 })
    const nk = ellP(x, y, R * 0.42); obj(nk, { col: P.woodD, a: 0.8, shade: 0, line: 0.6, flat: true })
    if (det >= 1) { ctx.beginPath(); ctx.arc(x, y, R * 0.7, 3.6, 4.7); ctx.lineWidth = px(0.5); ctx.strokeStyle = COL ? '#f4f1e8' : INK; ctx.stroke() }
  }
  function fishP(x, y, ang, L, col) {
    const f = F(x, y, ang), pts = cr([f(-L / 2, 0), f(-L * 0.32, -L * 0.2), f(L * 0.05, -L * 0.2), f(L * 0.4, -L * 0.04), f(L / 2, 0), f(L * 0.4, L * 0.04), f(L * 0.05, L * 0.2), f(-L * 0.32, L * 0.2)], true, 3)
    const tail = [f(-L / 2 + 1, 0), f(-L / 2 - L * 0.2, -L * 0.18), f(-L / 2 - L * 0.12, 0), f(-L / 2 - L * 0.2, L * 0.18)]
    obj(tail, { col: col || P.stoneL, a: 0.7, shade: 0, line: 0.6, h: 0, flat: true }); obj(pts, { h: 2, col: col || P.stoneL, a: 0.75, sd: L * 0.12, line: 0.8 })
    if (det >= 1) { solidDot(...f(L * 0.33, -L * 0.04), 0.7, INK); ctx.beginPath(); for (let u = -L * 0.2; u < L * 0.25; u += 2.4) { ctx.moveTo(...f(u, -L * 0.14)); ctx.lineTo(...f(u + 1.2, L * 0.12)) } ctx.lineWidth = px(0.35); ctx.stroke() }
  }
  function bolt(x, y, w, h, ang, col) { const b = rrect(x, y, w, h, 2, ang); obj(b, { h: 1.5, col, a: 0.7, sd: h * 0.25, line: 0.8 }); if (det >= 1) { const f = F(x, y, ang); ctx.beginPath(); for (let u = -w * 0.35; u < w * 0.4; u += 3) { ctx.moveTo(...f(u, -h * 0.4)); ctx.lineTo(...f(u, h * 0.4)) } ctx.lineWidth = px(0.35); ctx.stroke() } }
  function sword(x, y, ang, L) {
    const f = F(x, y, ang)
    obj([f(0, -1.5), f(L, -1.5), f(L + 5, 0), f(L, 1.5), f(0, 1.5)], { h: 2, col: P.stoneL, a: 0.7, shade: 0, line: 0.8 })
    const g = bar(f(-2, -5), f(-2, 5), 2.4); obj(g, { col: P.iron, a: 0.7, shade: 0, line: 0.7, h: 0 }); const gr = bar(f(-2, 0), f(-12, 0), 2.6); obj(gr, { col: P.leather, a: 0.8, shade: 0, line: 0.7, h: 0 }); solidDot(...f(-13, 0), 1.6, INK)
  }
  function shield(x, y, R, col) { const c = ellP(x, y, R); obj(c, { h: 3, col, a: 0.75, sd: R * 0.35, line: 1.1 }); pen(ellP(x, y, R * 0.8), 0.5, { flat: true }); const bs = ellP(x, y, R * 0.28); obj(bs, { col: P.iron, a: 0.8, shade: 0, line: 0.8 }) }
  function awningShape(x0, y0, x1, y1, n, depth) {
    const top = [[x0, y0], [x1, y0]], front = scal([x1, y1], [x0, y1], n, depth, -1, 4)
    return [...top, [x1, y1 - 0.2], ...front.slice(1)]
  }
  /** Table at the front of a stall. */
  function stallTable(o) {
    o = o || {}
    const w = o.w || 90, h = o.h || 28, cy = o.cy == null ? 18 : o.cy
    tableTop(0, cy, w, h, o.ang || 0, { pw: o.pw || 9, h: 6, cols: o.cols })
  }
  function canopy(pts, o) {
    o = o || {}
    shadow(pts, o.h == null ? 10 : o.h); poly(pts); ctx.fillStyle = PAPER; ctx.fill()
    const b = bbox(pts)
    if (COL) tint(pts, o.col || P.canvas, 0.78)
    ctx.save(); clipTo(pts)
    if (o.stripes) { const n = o.stripes; for (let i = 0; i < n; i += 2) { const x0 = b.x0 + (b.w * i) / n, x1 = b.x0 + (b.w * (i + 1)) / n, q = [[x0, b.y0], [x1, b.y0], [x1, b.y1 + 6], [x0, b.y1 + 6]]; if (COL) tone(q, o.stripeCol || P.red, 0.55); else if (det >= 1) hatchIn(q, PI / 2, 1.7, 0.4) } }
    if (o.patches) o.patches()
    // the canvas slopes toward the viewer: the lower-right is in shade, folds run front to back
    if (COL) tone([[b.x0, b.y0 + b.h * 0.55], [b.x1, b.y0 + b.h * 0.55], [b.x1, b.y1 + 8], [b.x0, b.y1 + 8]], P.shade, 0.16)
    if (det >= 1) { ctx.beginPath(); const nf = Math.round(b.w / 7); for (let i = 0; i < nf; i++) { const x = b.x0 + (b.w * (i + rr(0.2, 0.8))) / nf, l = rr(8, 20); ctx.moveTo(x, b.y1 - 1); ctx.lineTo(x + j(1.5), b.y1 - l) } ctx.lineWidth = px(0.45); ctx.stroke() }
    if (det >= 1 && !COL) hatchBox(b.x0, b.y0 + b.h * 0.6, b.x1, b.y1 + 8, 1.4, 4.2, 0.4, { minG: 2 })
    ctx.restore()
    pen(pts, 1.45)
  }
  const capPost = (x, y) => { const c = ellP(x, y, 2.5); poly(c); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(c, P.woodD, 0.8); pen(c, 0.9, { flat: true }); if (det >= 1) solidDot(x, y, 0.8, INK) }
  const stalls = [
    // 0: striped awning, baskets of fruit
    () => {
      stallTable({})
      basket(-30, 21, 9, [P.red, P.red, P.green]); basket(-6, 22, 9, [P.green, P.ochre]); basket(18, 21, 9, [P.plum, P.red]); basket(36, 23, 6.5, [P.ochre])
      canopy(awningShape(-46, -38, 46, 9, 9, 3.4), { stripes: 9, stripeCol: P.red, col: P.canvas })
      for (const [x, y] of [[-44, -36], [44, -36], [-44, 7], [44, 7]]) capPost(x, y)
    },
    // 1: patchwork awning, potions on the table
    () => {
      stallTable({ cols: [P.woodD, P.wood, P.woodD] })
      for (let i = 0; i < 7; i++) bottle(-34 + i * 11.5, 17 + (i % 2) * 6, 3.6, [P.red, P.green, P.blue, P.plum, P.ochre, P.green, P.blue][i])
      const mo = ellP(34, 26, 6); obj(mo, { h: 2, col: P.stoneD, a: 0.7, sd: 3, line: 0.9 }); pen(ellP(34, 26, 3.6), 0.6, { swell: -0.5 })
      canopy(awningShape(-46, -38, 46, 9, 8, 3.6), { col: P.canvasD, patches: () => {
        const pts = [[[-46, -38], [-14, -38], [-18, -14], [-46, -10]], [[-14, -38], [20, -38], [14, -18], [-18, -14]], [[20, -38], [46, -38], [46, -6], [10, -4], [14, -18]], [[-46, -10], [-18, -14], [-8, 12], [-46, 12]], [[10, -4], [46, -6], [46, 12], [14, 12]]]
        const cl = [P.red, P.green, P.blue, P.ochre, P.plum]
        pts.forEach((p, i) => { if (COL) tone(p, cl[i], 0.4); else if (i % 2) hatchIn(p, 0.9, 2.2, 0.4); ctx.beginPath(); sub(p); ctx.lineWidth = px(0.8); ctx.setLineDash([2.2, 1.4]); ctx.stroke(); ctx.setLineDash([]) })
      } })
      for (const [x, y] of [[-44, -36], [44, -36], [-44, 7], [44, 7]]) capPost(x, y)
    },
    // 2: open stall, cloth bolts, a pennant line between two poles
    () => {
      stallTable({ cy: 8, h: 32 })
      const cs = [P.red, P.blue, P.ochre, P.green, P.plum, P.canvas]
      for (let i = 0; i < 6; i++) { bolt(-36 + i * 13.5, 2 + (i % 2) * 2, 11, 18, 0.0, cs[i]); }
      for (let i = 0; i < 5; i++) bolt(-30 + i * 14, 22, 12, 9, 0.1, cs[(i + 3) % 6])
      // poles and pennants
      for (const x of [-46, 46]) { const c = ellP(x, -36, 2.8); obj(c, { h: 14, col: P.woodD, a: 0.8, sd: 1, line: 1 }) }
      line([[-46, -36], [-22, -33], [0, -34], [24, -33], [46, -36]], 0.9, { taper: 0, wob: 0.5 })
      for (let i = 0; i < 8; i++) { const x = -40 + i * 11.5, y = -35 + 1.2 * Math.sin(i), tri = [[x - 2.6, y], [x + 2.6, y], [x, y + 8]]; poly(tri); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(tri, [P.red, P.canvas, P.blue, P.ochre][i % 4], 0.8); pen(tri, 0.6, { flat: true }) }
    },
    // 3: parasol stall, spice bowls and sacks
    () => {
      stallTable({ cy: 14, h: 34, w: 92 })
      sack(-34, 28, 22, 16, 0.2, { col: P.canvasD, h: 2 }); sack(36, 26, 22, 16, -0.2, { col: P.woodL, h: 2 })
      for (const [x, y, c] of [[-14, 24, P.red], [0, 28, P.ochre], [14, 24, P.green], [-2, 18, P.plum]]) { const bw = ellP(x, y, 6); obj(bw, { h: 2, col: P.woodD, a: 0.6, sd: 2, line: 0.9 }); const hp = blob(x, y, 4.6, 4.6, 0, 7, 0.1, 3); poly(hp); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(hp, c, 0.85); pen(hp, 0.6, { flat: true }); if (!COL && det >= 1) hatchIn(hp, 0.6, 1.5, 0.35, { minG: 1.2 }) }
      const R = 36, cx = 0, cy = -10, n = 8, body = ellP(cx, cy, R)
      shadow(body, 12); poly(body); ctx.fillStyle = PAPER; ctx.fill()
      for (let i = 0; i < n; i++) { const a0 = (i / n) * TAU + 0.2, a1 = ((i + 1) / n) * TAU + 0.2, q = [[cx, cy], [cx + cos(a0) * R * 1.05, cy + sin(a0) * R * 1.05], [cx + cos((a0 + a1) / 2) * R * 1.1, cy + sin((a0 + a1) / 2) * R * 1.1], [cx + cos(a1) * R * 1.05, cy + sin(a1) * R * 1.05]]; ctx.save(); clipTo(body); if (COL) tone(q, i % 2 ? P.canvas : P.blue, 0.65); else if (i % 2 && det >= 1) hatchIn(q, a0 + 0.4, 1.8, 0.4); ctx.restore() }
      if (COL) tint(body, P.canvas, 0.3)
      if (det >= 1) shadeIn(body, 12, { gap: 2.4 })
      ctx.beginPath(); for (let i = 0; i < n; i++) { const a = (i / n) * TAU + 0.2; ctx.moveTo(cx, cy); ctx.lineTo(cx + cos(a) * R, cy + sin(a) * R) } ctx.lineWidth = px(0.8); ctx.stroke()
      // scalloped hem
      const hem = []; for (let i = 0; i < n * 3; i++) { const a = (i / (n * 3)) * TAU + 0.2; hem.push([cx + cos(a) * (R + 1 - 2.2 * Math.abs(Math.sin(a * n * 1.5))), cy + sin(a) * (R + 1 - 2.2 * Math.abs(Math.sin(a * n * 1.5)))]) }
      pen(hem, 1.4); const cap = ellP(cx, cy, 3.4); obj(cap, { col: P.woodD, a: 0.8, shade: 0, line: 1 })
    },
    // 4: fishmonger: fish on a slab, a bucket, wet canvas
    () => {
      stallTable({ cols: [P.stoneL, P.stone, P.stoneL], pw: 14 })
      const fs = [[-34, 15, 0.1, 17, P.canvasD], [-14, 19, -0.2, 15, P.stoneL], [6, 15, 0.15, 18, P.canvasD], [-28, 26, -0.05, 16, P.stoneL], [-5, 27, 0.1, 15, P.canvasD], [14, 26, -0.15, 17, P.stoneL]]
      for (const [x, y, a, L, c] of fs) fishP(x, y, a, L, c)
      const bk = ellP(36, 22, 8); obj(bk, { h: 4, col: P.woodD, a: 0.7, sd: 3, line: 1.2 }); const wt = ellP(36, 22, 6); poly(wt); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(wt, P.waterD, 0.8); else hatchIn(wt, 0.2, 1.8, 0.4, { minG: 1.3 }); pen(wt, 0.6, { swell: -0.4 }); fishP(36, 22, 0.9, 9, P.canvasD)
      canopy(awningShape(-46, -38, 46, 8, 7, 3.2), { col: P.canvasD, patches: () => { if (COL) { tone(blob(-20, -10, 16, 10, 0.3, 8, 0.2, 3), P.waterD, 0.2); tone(blob(24, -20, 14, 9, 0, 8, 0.2, 3), P.waterD, 0.2) } else if (det >= 1) { stipIn(blob(-20, -10, 16, 10, 0.3, 8, 0.2, 3), 40, 0.6); stipIn(blob(24, -20, 14, 9, 0, 8, 0.2, 3), 40, 0.6) } } })
      for (const [x, y] of [[-44, -36], [44, -36], [-44, 6], [44, 6]]) capPost(x, y)
    },
    // 5: weaponsmith: a shingled roof, blades laid out
    () => {
      stallTable({ cols: [P.woodD, P.wood, P.woodD], pw: 10 })
      sword(-34, 14, 0.04, 28); sword(-30, 22, -0.03, 26); sword(0, 16, 0.05, 24); shield(26, 20, 8, P.red); shield(41, 22, 6, P.blue)
      const ax = bar([-4, 26], [18, 26], 1.8); obj(ax, { h: 1.5, col: P.woodL, shade: 0, line: 0.7 }); obj([[16, 21], [22, 22], [22, 30], [16, 31]], { h: 1.5, col: P.stoneL, a: 0.7, shade: 0, line: 0.8 })
      gableRoof(0, -18, 94, 40, 0.0, { h: 9, col: P.woodD })
      for (const [x, y] of [[-44, 3], [44, 3]]) capPost(x, y)
    },
    // 6: baker's lean-to: planked single slope, loaves and pies
    () => {
      stallTable({ cols: [P.woodL, P.wood, P.woodL] })
      for (let i = 0; i < 4; i++) loaf(-36 + i * 12, 14, 11, i * 0.2 - 0.3); for (let i = 0; i < 3; i++) loaf(-30 + i * 12, 25, 11, 0.2 - i * 0.2)
      for (const [x, y] of [[20, 17], [36, 24]]) { const pie = ellP(x, y, 7); obj(pie, { h: 2, col: P.ochre, a: 0.65, sd: 3, line: 1 }); if (det >= 1) { ctx.save(); clipTo(pie); ctx.beginPath(); for (let u = -7; u <= 7; u += 3.6) { ctx.moveTo(x + u, y - 7); ctx.lineTo(x + u + 3, y + 7); ctx.moveTo(x + u + 3, y - 7); ctx.lineTo(x + u, y + 7) } ctx.lineWidth = px(0.45); ctx.stroke(); ctx.restore() } }
      basket(2, 26, 6, [P.ochre])
      const f = F(0, -16, 0)
      const top = rectP(0, -16, 92, 46, 0)
      shadow(top, 9); plankRect(0, -16, 92, 46, 0, { pw: 9, nails: false, cols: [P.woodD, P.wood, P.woodD] })
      for (const u of [-34, 0, 34]) ironBar(...f(u, 0), 5, 46, 0, null)
      if (det >= 1) shadeIn(top, 14, { gap: 2.3 }); pen(top, 1.5)
      const rg = bar([-46, -38], [46, -38], 4); void rg
      for (const [x, y] of [[-44, 5], [44, 5]]) capPost(x, y)
    },
    // 7: cloth merchant: dyed lengths hung over the awning's front edge
    () => {
      stallTable({ })
      for (let i = 0; i < 4; i++) bolt(-34 + i * 14, 22, 12, 9, 0.05, [P.red, P.blue, P.ochre, P.green][i])
      const rod = bar([-40, 28], [42, 28], 1.4); void rod
      canopy(awningShape(-46, -38, 46, 8, 1, 0), { col: P.canvas })
      // lengths of cloth hanging over the front edge, each a wavy strip
      const cl = [P.red, P.blue, P.ochre, P.green, P.plum, P.red, P.blue, P.ochre]
      for (let i = 0; i < 8; i++) {
        const x = -41 + i * 11.7, w = 7.6, y0 = 3, L = rr(14, 21), strip = [[x - w / 2, y0], [x + w / 2, y0], [x + w / 2 + j(1), y0 + L], [x, y0 + L + 2.5], [x - w / 2 + j(1), y0 + L]]
        obj(strip, { h: 1.5, col: cl[i], a: 0.7, sd: 2.5, line: 0.9 })
        if (det >= 1) { seg(x - 1.5, y0 + 2, x - 1.5 + j(0.5), y0 + L - 2); seg(x + 1.5, y0 + 2, x + 1.5 + j(0.5), y0 + L - 2); flush(0.4) }
      }
      for (const [x, y] of [[-44, -36], [44, -36]]) capPost(x, y)
    },
  ]
  reg('bm-stall', 'Market stall', 'bm-village', 'fixed', stalls)

  /* =====================================================================================================
     Gravestones: thin slabs, so we see the top edge, a sliver of side and the shadow
     ===================================================================================================== */
  /** A thin standing slab: lower-right side face visible as a dark band, top face lit; optional footing stone beneath. */
  function slab(cx, cy, w, t, ang, o) {
    o = o || {}
    const top = rrect(cx, cy, w, t, min(t * 0.45, 2.6), ang), thick = o.thick == null ? 2.4 : o.thick
    if (o.base !== false) { const bs = rrect(...F(cx, cy, ang)(0, t * 0.15), w * 1.24, t * 1.5, 1.8, ang); obj(bs, { h: o.h == null ? 13 : o.h * 0.6, col: P.stoneL, a: 0.6, sd: 3, line: 1.1 }) }
    else if (st.shadows) shadow(top, o.h == null ? 13 : o.h)
    if (o.base !== false && st.shadows) shadow(top, o.h == null ? 13 : o.h)
    const side = shift(top, thick * 0.7, thick)
    poly(side); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(side, P.stoneD, 0.9); else hatchIn(side, 0.9, 1.3, 0.5, { minG: 1.1 }); pen(side, 0.9)
    poly(top); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(top, o.col || P.stone, 0.7)
    if (det >= 2) stipIn(top, 14, 0.5)
    if (det >= 1 && w * k > 20) { const f = F(cx, cy, ang); line([f(-w * 0.28, 0), f(w * 0.28, 0.2)], 0.45, { taper: 0.6, wob: 0.3 }) }
    pen(top, 1.3)
  }
  function moundEarth(cx, cy, rx, ry, ang, o) {
    o = o || {}
    const f = F(cx, cy, ang), sq = []
    for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU, c = cos(a), s2 = sin(a), q = 1 + j(0.05); sq.push(f(Math.sign(c) * Math.pow(abs(c), 0.62) * rx * q, Math.sign(s2) * Math.pow(abs(s2), 0.62) * ry * q)) }
    const b = cr(sq, true, 2)
    obj(b, { h: 2, col: P.earth, a: 0.6, sd: min(rx, ry) * 0.5, line: 1, wob: 1.6 })
    if (COL) { ctx.save(); clipTo(b); tone(blob(cx - rx * 0.1, cy - ry * 0.1, rx * 0.7, ry * 0.7, ang, 8, 0.1, 3), P.grass, 0.35); ctx.restore() }
    if (det >= 1) stipIn(b, det >= 2 ? 50 : 20, 0.6)
    if (det >= 1) { ctx.beginPath(); for (let i = 0; i < (det >= 2 ? 26 : 8); i++) { const a = r() * TAU, d = rr(0.55, 1.0), x = cx + cos(a) * rx * d, y = cy + sin(a) * ry * d; ctx.moveTo(x, y); ctx.lineTo(x + j(1.2), y - rr(2, 4.5)); ctx.moveTo(x, y); ctx.lineTo(x + rr(0.5, 1.8), y - rr(1.5, 3.5)); ctx.moveTo(x, y); ctx.lineTo(x - rr(0.5, 1.8), y - rr(1.5, 3)) } ctx.lineWidth = px(0.5); ctx.stroke() }
    return b
  }
  const flower = (x, y, col) => { for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; ctx.beginPath(); ctx.arc(x + cos(a) * 1.6, y + sin(a) * 1.6, 1.3, 0, TAU); ctx.fillStyle = PAPER; ctx.fill(); if (COL) { ctx.save(); ctx.globalAlpha = 0.85; ctx.fillStyle = col; ctx.fill(); ctx.restore() } ctx.lineWidth = px(0.45); ctx.stroke() } solidDot(x, y, 0.9, COL ? P.ochre : INK) }
  const stoneBlock = (cx, cy, w, h, ang, col, o) => { const b = rectP(cx, cy, w, h, ang); obj(jig(b, 0.3), { h: o && o.h != null ? o.h : 4, col: col || P.stone, a: 0.7, sd: min(w, h) * 0.3, line: 1.25 }); return b }
  const graves = [
    // 0: a headstone and a mound with flowers
    () => {
      moundEarth(0, 12, 19, 33, 0.0)
      slab(0, -33, 38, 9, 0.0, { h: 15, thick: 3 })
      flower(-6, 2, P.red); flower(5, 9, P.ochre); flower(-3, 20, P.plum)
      if (det >= 1) { ctx.beginPath(); for (const [x, y] of [[-32, 10], [30, -4], [32, 30], [-30, 36]]) { for (let i = 0; i < 4; i++) { ctx.moveTo(x, y); ctx.quadraticCurveTo(x + (i - 1.5) * 1.5, y - 4, x + (i - 1.5) * 2.8, y - rr(5, 8)) } } ctx.lineWidth = px(0.55); ctx.stroke() }
    },
    // 1: a stone cross on a small footing; its long shadow shows the whole cross
    () => {
      moundEarth(0, 20, 19, 29, 0.0)
      const bx = 0, by = -26
      stoneBlock(bx, by, 26, 15, 0.0, P.stone, { h: 4 })
      castPoly(bar([bx, by], [bx + 22, by + 27], 5.6), rectP(bx + 17, by + 20 - 6, 36, 5.6, 0))
      const a2 = rrect(bx, by, 38, 6, 2, 0); obj(a2, { h: 0, col: P.stone, a: 0.7, sd: 2, line: 1.2 })
      const hd = rrect(bx, by, 6.4, 6.4, 1.2, 0); obj(hd, { h: 0, col: P.stoneL, a: 0.7, shade: 0, line: 1 })
      if (det >= 1) line([[bx - 15, by - 0.4], [bx + 15, by + 0.2]], 0.45, { taper: 0.6 })
      flower(-8, 6, P.red); flower(6, 14, P.canvas)
    },
    // 2: a flat ledger slab with an engraved cross and lines of lettering
    () => {
      const w = 44, h = 80, b = rrect(0, 0, w, h, 3, 0.04)
      shadow(b, 3); const side = shift(b, 1.6, 1.8); poly(side); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(side, P.stoneD, 0.9); else hatchIn(side, 0.9, 1.3, 0.5, { minG: 1.1 }); pen(side, 0.9)
      poly(b); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(b, P.stoneL, 0.65)
      const f = F(0, 0, 0.04), inner = rrect(0, 0, w - 9, h - 9, 2, 0.04)
      pen(inner, 0.7, { swell: 0.3, flat: true }); if (det >= 1) shadeIn(b, 6, { gap: 2.2 })
      line([f(0, -33), f(0, -8)], 1.6, { taper: 0.1, wob: 0.3 }); line([f(-7, -26), f(7, -26)], 1.6, { taper: 0.1, wob: 0.3 })
      for (let i = 0; i < 4; i++) { ctx.beginPath(); let u = -13; while (u < 13) { const l = rr(2, 6); ctx.moveTo(...f(u, 6 + i * 6.5)); ctx.lineTo(...f(min(u + l, 14), 6 + i * 6.5 + j(0.2))); u += l + rr(1.5, 3) } ctx.lineWidth = px(0.8); ctx.stroke() }
      pen(b, 1.4)
      if (det >= 1) { line([f(-16, 30), f(-10, 22), f(-14, 12)], 0.5, { taper: 0.5 }) }
      if (det >= 1) { ctx.beginPath(); for (const [x, y] of [[-26, -34], [25, 30], [-27, 40]]) for (let i = 0; i < 4; i++) { ctx.moveTo(x, y); ctx.quadraticCurveTo(x + (i - 1.5) * 1.5, y - 4, x + (i - 1.5) * 2.8, y - rr(5, 8)) } ctx.lineWidth = px(0.55); ctx.stroke() }
    },
    // 3: two small headstones side by side, a mound each
    () => {
      moundEarth(-22, 14, 14, 28, 0.04); moundEarth(24, 18, 14, 27, -0.05)
      slab(-22, -22, 26, 7, 0.04, { h: 12, thick: 2.6 }); slab(24, -16, 28, 7.5, -0.05, { h: 12, thick: 2.6 })
      flower(-22, 4, P.ochre); flower(25, 12, P.red); flower(23, 22, P.canvas)
    },
    // 4: leaning, broken headstone with the top lying beside it
    () => {
      moundEarth(2, 18, 20, 32, 0.1)
      const stub = [[-14, -24], [-6, -30], [2, -26], [9, -31], [15, -24], [15, -17], [-14, -16]]
      const f = F(-4, -26, 0.38)
      if (st.shadows) shadow(f ? rot(stub.map(([x, y]) => [x + 2, y + 5]), -4, -26, 0.38) : stub, 7)
      const st2 = rot(stub, -4, -22, 0.38)
      const side = shift(st2, 1.6, 2.2); poly(side); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(side, P.stoneD, 0.9); else hatchIn(side, 0.9, 1.3, 0.5, { minG: 1.1 }); pen(side, 0.9)
      obj(st2, { h: 0, col: P.stone, a: 0.7, sd: 3, line: 1.3 })
      if (det >= 1) line([[-9, -26], [-4, -20], [-8, -14]].map(([x, y]) => rot([[x, y]], -4, -22, 0.38)[0]), 0.6, { taper: 0.5, wob: 0.8 })
      const frag = rot([[0, 0], [10, -5], [22, -2], [26, 5], [18, 9], [6, 10], [-2, 6]].map(([x, y]) => [x + 22, y + 34]), 30, 40, -0.7)
      obj(frag, { h: 6, col: P.stone, a: 0.7, sd: 4, line: 1.2, wob: 1.2 })
      if (det >= 1) { ctx.beginPath(); const fc = F(30, 40, -0.7); ctx.moveTo(...fc(-4, -2)); ctx.lineTo(...fc(6, 2)); ctx.moveTo(...fc(-1, 3)); ctx.lineTo(...fc(8, 5)); ctx.lineWidth = px(0.6); ctx.stroke() }
      for (const [x, y] of [[-24, -10], [30, 6], [-26, 38]]) { ctx.beginPath(); for (let i = 0; i < 5; i++) { ctx.moveTo(x, y); ctx.quadraticCurveTo(x + (i - 2) * 1.4, y - 4, x + (i - 2) * 3, y - rr(5, 9)) } ctx.lineWidth = px(0.55); ctx.stroke() }
      if (COL) tint(blob(-6, -22, 7, 3.5, 0.4, 8, 0.2, 3), P.green, 0.55)
    },
    // 5: a wooden grave marker, flowers, kerb stones
    () => {
      const m = moundEarth(0, 16, 20, 32, 0.0)
      const kerb = []; for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU, x = cos(a) * 25, y = 16 + sin(a) * 38; kerb.push([x, y, a]) }
      for (const [x, y, a] of kerb) { const b = blob(x, y, 4.2, 3.4, a, 7, 0.15, 3); obj(b, { h: 2, col: P.stoneL, a: 0.6, sd: 2, line: 0.9 }) }
      const f = F(0, -26, -0.06)
      castPoly(bar(f(0, -12), f(14, 11), 4.4), rectP(...f(11, 2), 28, 4.6, -0.06))
      const arm = rectP(...f(0, -12), 29, 5, -0.06), hd = rectP(...f(0, -12), 5, 5, -0.06)
      obj(arm, { h: 0, col: P.woodL, a: 0.7, sd: 2, line: 1.1 }); obj(hd, { h: 0, col: P.wood, a: 0.7, shade: 0, line: 0.9 })
      if (det >= 2) { nail(...f(0, -12)); flushDots() }
      flower(-6, 8, P.red); flower(6, 14, P.ochre); flower(-2, 24, P.plum); flower(8, 30, P.canvas); flower(-8, 34, P.red)
    },
    // 6: three small markers in a row
    () => {
      for (const [x, y, w, a] of [[-32, 4, 17, 0.06], [0, -4, 18, -0.04], [32, 8, 17, -0.1]]) {
        moundEarth(x, y + 26, 11, 24, a); slab(x, y - 16, w, 5.4, a, { h: 9 })
      }
      flower(-32, 24, P.ochre); flower(1, 16, P.red); flower(31, 32, P.canvas)
    },
    // 7: a tomb: carved lid, an effigy, stepped base
    () => {
      const f = F(0, 0, 0.0)
      const base = rectP(0, 0, 66, 90, 0.0); obj(base, { h: 9, col: P.stone, a: 0.7, sd: 8, line: 1.5 })
      const lid = rectP(0, 0, 54, 78, 0.0); obj(lid, { h: 0, col: P.stoneL, a: 0.7, sd: 6, line: 1.3 })
      const pan = rectP(0, 0, 40, 64, 0.0); pen(pan, 0.7, { flat: true, swell: 0.3 })
      // effigy: head, body, hands on the chest
      const hd = ellP(0, -22, 6.4); obj(hd, { h: 0, col: P.stoneL, a: 0.6, sd: 2, line: 0.9 })
      const bd = cr([[-8, -14], [8, -14], [10, 0], [8, 22], [5, 30], [-5, 30], [-8, 22], [-10, 0]], true, 3); obj(bd, { h: 0, col: P.stone, a: 0.6, sd: 4, line: 1 })
      if (det >= 1) { line([[-6, -6], [0, -3], [6, -6]], 0.8, { taper: 0.3 }); line([[-4, -3], [4, 1]], 0.7, { taper: 0.3 }); line([[-5, 8], [-5, 26]], 0.5, { taper: 0.5 }); line([[5, 8], [5, 26]], 0.5, { taper: 0.5 }) }
      if (det >= 2) { ctx.beginPath(); for (let i = 0; i < 7; i++) { const y = -30 + i * 10; ctx.moveTo(-31, y); ctx.lineTo(-31 + 2.6, y); ctx.moveTo(31, y); ctx.lineTo(31 - 2.6, y) } ctx.lineWidth = px(0.5); ctx.stroke() }
      if (det >= 1) { ctx.beginPath(); for (const [x, y] of [[-37, 20], [36, -30], [38, 38]]) for (let i = 0; i < 4; i++) { ctx.moveTo(x, y); ctx.quadraticCurveTo(x + (i - 1.5) * 1.4, y - 4, x + (i - 1.5) * 2.8, y - rr(5, 8)) } ctx.lineWidth = px(0.55); ctx.stroke() }
    },
  ]
  /** Rough swept hull of a shape and its offset copy (shadow outline of a tall thin thing). */
  function hull2(pts, dx, dy) {
    const all = pts.concat(shift(pts, dx, dy)); all.sort((a, b) => a[0] - b[0] || a[1] - b[1])
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = []
    for (const p of all) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p) }
    for (let i = all.length - 1; i >= 0; i--) { const p = all[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p) }
    return lo.slice(0, -1).concat(up.slice(0, -1))
  }
  reg('bm-gravestone', 'Gravestone', 'bm-village', 'fixed', graves)

  /* =====================================================================================================
     Statues and monuments
     ===================================================================================================== */
  /** A stepped square plinth. steps = [[size, h], ...] outermost first. */
  function plinthSq(cx, cy, steps, ang, o) {
    o = o || {}
    steps.forEach(([sz, h], i) => { const p = rectP(cx, cy, sz, sz * (o.aspect || 1), ang || 0); obj(jig(p, 0.25), { h: i === 0 ? h : 0, col: i % 2 ? P.stoneL : P.stone, a: 0.7, sd: sz * 0.14, line: 1.3 - i * 0.1 }); if (det >= 2) { stipIn(p, 12, 0.5) } })
  }
  function plinthRound(cx, cy, radii, o) {
    o = o || {}
    radii.forEach((R, i) => { const p = ellP(cx, cy, R); obj(p, { h: i === 0 ? (o.h || 8) : 0, col: i % 2 ? P.stoneL : P.stone, a: 0.7, sd: R * 0.18, line: 1.3 - i * 0.1 }) })
  }
  /** A standing figure's long cast shadow (head furthest along the shadow direction), as a polygon. */
  function humanShadow(x, y, L, wd) {
    const d = [0.64, 0.77], n = [-0.77, 0.64], prof = [[0, 3.2], [0.12, 3.8], [0.42, 4.2], [0.5, 6.6], [0.66, 7.4], [0.78, 9.4], [0.82, 3.2], [0.86, 4.6], [0.93, 4.4], [1, 1.2]]
    const A = [], B = []
    for (const [t, hw] of prof) { const w = hw * (wd || 1); A.push([x + d[0] * L * t + n[0] * w, y + d[1] * L * t + n[1] * w]); B.push([x + d[0] * L * t - n[0] * w, y + d[1] * L * t - n[1] * w]) }
    return A.concat(B.reverse())
  }
  /** Spoked, shaded cap (pyramid, tent or conical roof seen from above). */
  function pyramid(cx, cy, R, n, rot0, o) {
    o = o || {}
    const pts = []; for (let i = 0; i < n; i++) { const a = (i / n) * TAU + rot0; pts.push([cx + cos(a) * R, cy + sin(a) * R]) }
    poly(pts); ctx.fillStyle = PAPER; ctx.fill()
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n], fc = [[cx, cy], a, b], mx = (a[0] + b[0]) / 2 - cx, my = (a[1] + b[1]) / 2 - cy, lit = mx + my < 0
      if (COL) { tone(fc, o.col || P.stoneL, 0.4); if (!lit) tone(fc, P.shade, 0.25) }
      if (det >= 1) { ctx.save(); clipTo(fc); hatchBox(cx - R, cy - R, cx + R, cy + R, Math.atan2(b[1] - a[1], b[0] - a[0]), lit ? 4.4 : 1.9, lit ? 0.35 : 0.5, { minG: 1.4 }); ctx.restore() }
      rule([cx, cy], a, 0.9, { over: 0 })
    }
    pen(pts, 1.3)
  }
  const statues = [
    // 0: a knight on a square plinth, both hands on a planted sword, cloak spread down his back
    () => {
      plinthSq(0, 6, [[70, 8], [54, 4]], 0.0)
      castPoly(humanShadow(-2, -2, 56, 1.0))
      // the cloak: a bell spreading up the page from the shoulders, folds running back
      const cl = cr([[-14, -4], [-20, -16], [-14, -28], [0, -31], [14, -28], [20, -16], [14, -4], [0, 0]], true, 3); obj(cl, { h: 0, col: P.stoneD, a: 0.55, sd: 7, line: 1.25 })
      if (det >= 1) for (const [x0, x1] of [[-9, -15], [-4, -7], [2, 3], [7, 9], [11, 16]]) line([[x0, -8], [x1, -27 + Math.abs(x1) * 0.4]], 0.55, { taper: 0.6, wob: 0.4 })
      // sword planted in front: blade down, crossguard and pommel at the hands
      obj([[-1.7, 13], [1.7, 13], [1.7, 34], [0, 38], [-1.7, 34]], { h: 5, col: P.stoneL, a: 0.7, shade: 0, line: 0.9 })
      if (det >= 1) { seg(0, 15, 0, 33); flush(0.4) }
      const shP = cr([[-18, -3], [-13, -10], [-5, -11], [5, -11], [13, -10], [18, -3], [16, 3], [8, 5], [-8, 5], [-16, 3]], true, 3)
      obj(shP, { h: 0, col: P.stone, a: 0.7, sd: 5, line: 1.3 })
      for (const sg of [-1, 1]) { const ar = bar([sg * 13, 1], [sg * 3, 11], 5.4); obj(ar, { col: P.stone, a: 0.7, sd: 2.5, line: 1 }); const hn = ellP(sg * 2.6, 11.5, 2.6); obj(hn, { col: P.stoneL, a: 0.7, shade: 0, line: 0.8 }) }
      const g = bar([-8, 13.5], [8, 13.5], 2.8); obj(g, { col: P.iron, a: 0.75, shade: 0, line: 0.8 })
      const hd = ellP(0, -3.5, 6.2); obj(hd, { h: 0, col: P.stoneL, a: 0.7, sd: 3, line: 1.2 })
      if (det >= 1) { line([[0, -9.5], [0, 2.5]], 0.9, { taper: 0.4 }); line([[-4.2, -3.5], [4.2, -3.5]], 0.6, { taper: 0.4 }) }
    },
    // 1: an obelisk on stepped plinths, with its long thin shadow
    () => {
      plinthSq(-4, -4, [[68, 5], [54, 4], [42, 3]], 0.0)
      castPoly(hull2([[-9, -9], [9, -9], [9, 9], [-9, 9]], 40, 48).concat([]))
      const base = rectP(-4, -4, 24, 24, 0.0); obj(base, { h: 0, col: P.stone, a: 0.7, sd: 4, line: 1.3 })
      const top = rectP(-4, -4, 12, 12, 0.0)
      for (let i = 0; i < 4; i++) { const a = base[i], b = base[(i + 1) % 4], c = top[(i + 1) % 4], d = top[i]; const fc = [a, b, c, d]; if (COL && (i === 1 || i === 2)) tone(fc, P.shade, 0.25); if (det >= 1) { ctx.save(); clipTo(fc); hatchBox(-40, -40, 40, 40, i % 2 ? PI / 2 + 0.1 : 0.05, i === 1 || i === 2 ? 1.9 : 4.2, 0.45, { minG: 1.4 }); ctx.restore() } rule(a, d, 0.9, { over: 0 }) }
      pen(top, 1.1, { flat: true })
      for (let i = 0; i < 4; i++) rule(top[i], [-4, -4], 0.9, { over: 0 })
      pen(base, 1.3)
      solidDot(-4, -4, 0.9, INK)
    },
    // 2: a robed wizard on a round plinth, staff held out
    () => {
      plinthRound(0, 0, [44, 34])
      castPoly(humanShadow(0, -2, 58, 1.5))
      // staff: a thin pole out to the right with a knob at the end
      const staff = bar([4, 2], [36, -22], 2.6); obj(staff, { h: 3, col: P.woodL, a: 0.7, shade: 0, line: 0.9 }); ball(37, -24, 4, P.blue, { line: 0.9, h: 2 })
      // robe flowing behind and sleeves
      const rb = cr([[-18, -4], [-8, -20], [10, -20], [20, -4], [22, 14], [10, 26], [-10, 24], [-22, 12]], true, 3); obj(rb, { h: 0, col: P.blue, a: 0.65, sd: 7, line: 1.3 })
      if (det >= 1) { for (const [x, y, x2, y2] of [[-14, 4, -12, 20], [-6, 0, -5, 22], [6, 2, 8, 22], [14, 4, 16, 18]]) line([[x, y], [x2, y2]], 0.5, { taper: 0.6, wob: 0.5 }) }
      const sl = cr([[10, -6], [24, -10], [30, -6], [24, 2], [12, 2]], true, 3); obj(sl, { col: P.blue, a: 0.65, sd: 3, line: 1 })
      // the pointed hat: a wide brim circle, spoked crown tipped to the lower right
      const brim = ellP(-2, -6, 15); obj(brim, { h: 0, col: P.plum, a: 0.7, sd: 6, line: 1.3 })
      if (det >= 1) { for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; seg(-2 + cos(a) * 3, -6 + sin(a) * 3, -2 + cos(a) * 13, -6 + sin(a) * 13) } flush(0.45) }
      const crown = ellP(0, -4, 4.6); obj(crown, { col: P.plum, a: 0.75, sd: 2, line: 1.1 }); solidDot(1, -3, 1.2, INK)
    },
    // 3: an angel with spread wings
    () => {
      plinthRound(0, 2, [26, 19])
      castPoly(hull2(ellP(0, 0, 10), 24, 28).concat([]))
      // wings: two big fans of feathers
      for (const sg of [-1, 1]) {
        const root = [sg * 6, -2], fan = []
        for (let i = 0; i <= 7; i++) { const t = i / 7, a = -1.45 + t * 1.3, l = 36 + 10 * Math.sin(PI * Math.min(1, t * 1.15)); fan.push([root[0] + sg * cos(a) * l, root[1] + sin(a) * l * 0.95 - 6 + 18 * t]) }
        const wing = [root, ...fan, [sg * 8, 16]]
        obj(cr(wing, true, 2), { h: 6, col: P.stoneL, a: 0.65, sd: 8, line: 1.3 })
        if (det >= 1) for (let q = 0; q < 6; q++) { const t = (q + 0.5) / 6, p = fan[Math.round(t * 7)]; line([[root[0] + sg * 6, root[1] + 2 + 11 * t], [p[0] * 0.92, p[1] * 0.95]], 0.55, { taper: 0.6, wob: 0.4 }) }
        if (det >= 2) for (let q = 0; q < 5; q++) { const t = (q + 0.5) / 5, p = fan[Math.round(t * 7)]; line([[p[0] * 0.55 + sg * 2, p[1] * 0.5 + 4], [p[0] * 0.86, p[1] * 0.88 + 1]], 0.4, { taper: 0.7 }) }
      }
      const sh = cr([[-11, -4], [-5, -10], [5, -10], [11, -4], [10, 8], [0, 12], [-10, 8]], true, 3); obj(sh, { h: 0, col: P.stone, a: 0.7, sd: 4, line: 1.2 })
      const hd = ellP(0, -2, 6.2); obj(hd, { col: P.stoneL, a: 0.7, sd: 3, line: 1.1 }); if (det >= 1) { for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; seg(cos(a) * 1.5, -2 + sin(a) * 1.5, cos(a) * 5.6, -2 + sin(a) * 5.6) } flush(0.4) }
      ctx.beginPath(); ctx.ellipse(0, -2, 10, 9, 0, 0, TAU); ctx.lineWidth = px(0.8); ctx.stroke()
    },
    // 4: a toppled statue: the empty plinth, feet, a lying torso and a head
    () => {
      plinthSq(-10, -8, [[56, 7], [42, 4]], 0.06)
      // two stumps of the ankles still on the plinth
      for (const sg of [-1, 1]) { const ft = blob(-10 + sg * 6, -4, 5.4, 8, 0.1, 8, 0.15, 3); obj(ft, { h: 4, col: P.stoneL, a: 0.7, sd: 3, line: 1.1 }); if (det >= 1) line([[-10 + sg * 6 - 3, -9], [-10 + sg * 6 + 2, -5]], 0.5, { taper: 0.5 }) }
      line([[-34, -22], [-26, -16], [-30, -10]], 0.7, { taper: 0.4, wob: 0.6 })
      // the torso lying on the ground, an arm, the head
      const tr = cr([[10, 22], [28, 18], [44, 22], [46, 34], [30, 40], [12, 36]], true, 3); obj(tr, { h: 5, col: P.stone, a: 0.7, sd: 6, line: 1.3 })
      const ar = rrect(36, 42, 22, 8, 3, -0.5); obj(ar, { h: 3, col: P.stone, a: 0.7, sd: 3, line: 1.1 })
      const hd = ellP(-30, 32, 8); obj(hd, { h: 5, col: P.stoneL, a: 0.7, sd: 4, line: 1.2 }); if (det >= 1) { line([[-35, 29], [-30, 32], [-26, 31]], 0.6, { taper: 0.4 }); line([[-32, 36], [-27, 36]], 0.6, { taper: 0.4 }) }
      for (const [x, y, rx, ry] of [[-14, 40, 4, 3], [14, 8, 3.5, 3], [48, 8, 5, 3.6], [-44, 8, 4, 3]]) { const b = blob(x, y, rx, ry, r() * PI, 7, 0.15, 3); obj(b, { h: 2, col: P.stone, a: 0.7, sd: 2, line: 0.9 }) }
      if (det >= 1) { ctx.beginPath(); for (const [x, y] of [[-38, -20], [20, 36], [42, -22]]) for (let i = 0; i < 5; i++) { ctx.moveTo(x, y); ctx.quadraticCurveTo(x + (i - 2) * 1.4, y - 4, x + (i - 2) * 3, y - rr(5, 9)) } ctx.lineWidth = px(0.55); ctx.stroke() }
    },
    // 5: a lion lying on a long plinth, mane in curls
    () => {
      plinthSq(0, 0, [[84, 8], [70, 4]], 0.0, { aspect: 0.6 })
      castPoly(hull2(rectP(0, 2, 56, 22, 0), 15, 19))
      const tail = cr([[22, 5], [34, 9], [40, 0], [36, -9]], false, 4); line(tail, 2.4, { taper: 0.2, wob: 0.4 }); const tf = blob(36, -10, 3.2, 3.8, 0.3, 7, 0.2, 3); obj(tf, { col: P.stone, a: 0.7, shade: 0, line: 0.8 })
      const body = cr([[-6, -13], [14, -14], [28, -9], [31, 3], [18, 12], [-4, 12], [-12, 0]], true, 3); obj(body, { h: 0, col: P.stone, a: 0.7, sd: 6, line: 1.3 })
      if (det >= 1) { for (let i = 0; i < 6; i++) { const x = -2 + i * 5; line([[x, -11], [x + 2, 9]], 0.45, { taper: 0.7, wob: 0.4 }) } line([[-6, -2], [28, -1]], 0.6, { taper: 0.3, wob: 0.5 }) }
      for (const sg of [-1, 1]) { const pw = rrect(-27, sg * 7.5, 16, 5.6, 2.4, 0); obj(pw, { h: 0, col: P.stoneL, a: 0.7, sd: 2, line: 0.9 }); if (det >= 1) { seg(-30, sg * 7.5 - 1.4, -30, sg * 7.5 + 1.4); seg(-26, sg * 7.5 - 1.4, -26, sg * 7.5 + 1.4); flush(0.5) } }
      const mane = []; for (let i = 0; i < 48; i++) { const a = (i / 48) * TAU, rad = 14 + 2.6 * Math.abs(Math.sin(a * 6)); mane.push([-19 + cos(a) * rad, sin(a) * rad]) }
      obj(mane, { h: 0, col: P.ochre, a: 0.55, sd: 6, line: 1.2 })
      if (det >= 1) for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU + 0.2; line([[-19 + cos(a) * 8.5, sin(a) * 8.5], [-19 + cos(a + 0.25) * 14, sin(a + 0.25) * 14]], 0.5, { taper: 0.7, wob: 0.3 }) }
      const hd = ellP(-20, 0, 7.6, 7, 0); obj(hd, { col: P.stoneL, a: 0.7, sd: 3, line: 1.1 }); solidDot(-24.5, -3, 0.9, INK); solidDot(-24.5, 3, 0.9, INK); line([[-27.4, 0], [-23, 0]], 0.9, { taper: 0.3 }); line([[-24, -6], [-21, -3]], 0.5, { taper: 0.3 }); line([[-24, 6], [-21, 3]], 0.5, { taper: 0.3 })
    },
    // 6: a fountain: octagonal basin, jets, a figure on a pedestal
    () => {
      const oct = (R, rot) => { const p = []; for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + rot; p.push([cos(a) * R, sin(a) * R]) } return p }
      const o1 = oct(46, PI / 8), o2 = oct(36, PI / 8)
      shadow(o1, 6); ctx.beginPath(); sub(o1); sub(o2); ctx.fillStyle = PAPER; ctx.fill('evenodd')
      ctx.save(); ctx.beginPath(); sub(o1); sub(o2); ctx.clip('evenodd'); if (COL) tone(o1, P.stone, 0.5)
      ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + PI / 8; ctx.moveTo(cos(a) * 36, sin(a) * 36); ctx.lineTo(cos(a) * 46, sin(a) * 46) } ctx.lineWidth = px(0.7); ctx.stroke()
      if (det >= 1) shadeIn(o1, 8, { gap: 2.3 }); ctx.restore()
      pen(o1, 1.5)
      poly(o2); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(o2, P.waterD, 0.8)
      ctx.save(); clipTo(o2); if (!COL) hatchBox(-40, -40, 40, 40, 0.0, 3, 0.45)
      if (det >= 0) { ctx.beginPath(); for (let i = 0; i < 4; i++) { const q = 14 + i * 5.5; ctx.moveTo(q * cos(0.3), q * sin(0.3)); ctx.arc(0, 0, q, 0.3, 0.3 + rr(1.4, 3.4)); ctx.moveTo(q * cos(3.6), q * sin(3.6)); ctx.arc(0, 0, q, 3.6, 3.6 + rr(0.8, 2)) } ctx.lineWidth = px(0.55); ctx.strokeStyle = COL ? '#dde9e2' : PAPER; ctx.stroke() }
      ctx.restore(); pen(o2, 1.1, { swell: -0.6 })
      // water arcs falling from the centre
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + 0.2; line([[cos(a) * 11, sin(a) * 11], [cos(a + 0.12) * 21, sin(a + 0.12) * 21], [cos(a + 0.2) * 28, sin(a + 0.2) * 28]], 0.7, { taper: 0.6, wob: 0.3, col: COL ? P.waterD : INK }) }
      plinthRound(0, 0, [12, 8], { h: 5 })
      const fg = ellP(0, 0, 5); obj(fg, { col: P.stoneL, a: 0.7, sd: 2, line: 1 })
    },
    // 7: a standing stone ringed by small stones
    () => {
      for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU + 0.3, x = cos(a) * 40, y = sin(a) * 40, b = blob(x, y, rr(5, 7), rr(4, 6), r() * PI, 8, 0.15, 3); obj(b, { h: 4, col: [P.stone, P.stoneL, P.stoneD][i % 3], a: 0.7, sd: 3, line: 1 }) }
      const big = blob(0, 0, 18, 14, 0.5, 11, 0.12, 3)
      castPoly(hull2(blob(0, 0, 18, 14, 0.5, 11, 0.12, 3), 24, 30))
      obj(big, { h: 0, col: P.stoneD, a: 0.55, sd: 8, line: 1.5, wob: 1.8 })
      if (det >= 1) { ctx.save(); clipTo(big); ctx.beginPath(); for (let i = 0; i < 40; i++) { const x = rr(-18, 18), y = rr(-14, 14), l = rr(2, 5), a = rr(0, TAU); ctx.moveTo(x, y); ctx.lineTo(x + cos(a) * l, y + sin(a) * l) } ctx.lineWidth = px(0.45); ctx.stroke(); ctx.restore() }
      if (COL) { ctx.save(); clipTo(big); tint(blob(-8, -4, 8, 5, 0.3, 8, 0.2, 3), P.green, 0.55); ctx.restore() }
      line([[-4, -8], [0, -2], [3, 3], [8, 6]], 0.6, { taper: 0.5, wob: 0.8 })
      // carved spiral on the weathered top
      if (det >= 1) { const sp = []; for (let i = 0; i < 28; i++) { const a = i * 0.45, rad = 0.4 + i * 0.16; sp.push([-6 + cos(a) * rad, 1 + sin(a) * rad * 0.8]) } line(sp, 0.6, { taper: 0.2, wob: 0.1 }) }
    },
  ]
  reg('bm-statue', 'Statue', 'bm-village', 'fixed', statues)

  /* =====================================================================================================
     Signposts
     ===================================================================================================== */
  /** A fingerboard: plank with a pointed end, lettering ticks, nails. pointing along ang. */
  function arm(x, y, ang, len, w, o) {
    o = o || {}
    const f = F(x, y, ang), hw = w / 2, tip = o.flat ? [] : [f(len, 0)]
    const pts = o.flat ? [f(0, -hw), f(len, -hw), f(len, hw), f(0, hw)] : [f(0, -hw), f(len - w * 0.85, -hw), f(len, 0), f(len - w * 0.85, hw), f(0, hw)]
    void tip
    obj(pts, { h: o.h == null ? 7 : o.h, col: o.col || P.wood, a: 0.7, sd: w * 0.4, line: 1.25 })
    if (det >= 1) {
      ctx.beginPath(); let u = 6 + (o.pad || 0); const e = len - w * 0.9 - 2
      while (u < e - 2) { const l = rr(2, 5.5); ctx.moveTo(...f(u, -hw * 0.22 + j(0.3))); ctx.lineTo(...f(min(u + l, e), -hw * 0.22 + j(0.3))); u += l + rr(1.3, 2.6) }
      u = 6 + (o.pad || 0); while (u < e - 8 && w > 7) { const l = rr(2, 5); ctx.moveTo(...f(u, hw * 0.35)); ctx.lineTo(...f(min(u + l, e - 6), hw * 0.35 + j(0.3))); u += l + rr(1.3, 2.6) }
      ctx.lineWidth = px(0.55); ctx.stroke()
      if (det >= 2) { ctx.beginPath(); for (let i = 0; i < 6; i++) { const u2 = rr(6, len - 10), v = rr(-hw * 0.7, hw * 0.7); ctx.moveTo(...f(u2, v)); ctx.lineTo(...f(u2 + rr(4, 9), v + j(0.4))) } ctx.lineWidth = px(0.35); ctx.globalAlpha = 0.7; ctx.stroke(); ctx.globalAlpha = 1 }
    }
  }
  /** The post: a square top with a cap, throwing a long thin shadow. */
  function postTop(x, y, s, o) {
    o = o || {}
    if (st.shadows) castPoly(bar([x, y], [x + (o.sh || 24), y + (o.sh || 24) * 1.2], s * 0.8).concat([]))
    const b = rectP(x, y, s, s, o.ang || 0.1); obj(b, { h: 0, col: P.woodD, a: 0.75, sd: s * 0.4, line: 1.2 })
    pen(rectP(x, y, s * 0.5, s * 0.5, o.ang || 0.1), 0.6, { flat: true })
    if (det >= 2) solidDot(x, y, 0.7, INK)
  }
  const tuft = (x, y) => { ctx.beginPath(); for (let i = 0; i < 5; i++) { ctx.moveTo(x, y); ctx.quadraticCurveTo(x + (i - 2) * 1.4, y - 4, x + (i - 2) * 3, y - rr(5, 9)) } ctx.lineWidth = px(0.55); ctx.stroke() }
  const signs = [
    // 0: two arms pointing different ways
    () => { arm(-2, 0, -0.5, 44, 9, {}); arm(2, 3, 2.75, 40, 8.5, { col: P.woodL }); postTop(0, 1, 8); tuft(-26, 30); tuft(30, 32) },
    // 1: three arms
    () => { arm(0, 0, 0.35, 42, 8.5, { col: P.woodL }); arm(0, 0, 2.2, 40, 8.5, {}); arm(0, 1, -1.9, 38, 8, { col: P.wood }); postTop(0, 1, 8); tuft(-30, 32); tuft(32, 34) },
    // 2: single long arm, a finial on the post
    () => { arm(-4, 0, 0.12, 50, 11, { pad: 1 }); postTop(-2, 0, 8.5); const c = ellP(-2, 0, 3); obj(c, { col: P.woodL, a: 0.7, sd: 2, line: 0.9 }); tuft(-34, 26); tuft(26, 30); tuft(-20, -28) },
    // 3: a milestone: a rounded stone with carved lettering
    () => {
      const b = blob(0, 0, 20, 14, 0.15, 10, 0.05, 3); castPoly(hull2(b, 16, 20))
      const side = shift(b, 2.6, 3.2); poly(side); ctx.fillStyle = PAPER; ctx.fill(); if (COL) tint(side, P.stoneD, 0.9); else hatchIn(side, 0.9, 1.4, 0.5, { minG: 1.1 }); pen(side, 1)
      obj(b, { h: 0, col: P.stone, a: 0.7, sd: 5, line: 1.4, wob: 1.2 })
      if (det >= 1) { const f = F(0, 0, 0.15); for (let i = 0; i < 3; i++) { ctx.beginPath(); let u = -12; while (u < 11) { const l = rr(2, 5); ctx.moveTo(...f(u, -5 + i * 5)); ctx.lineTo(...f(min(u + l, 12), -5 + i * 5 + j(0.2))); u += l + rr(1.3, 2.4) } ctx.lineWidth = px(0.65); ctx.stroke() } }
      if (COL) { ctx.save(); clipTo(b); tint(blob(-10, -6, 6, 3.5, 0.3, 7, 0.2, 3), P.green, 0.55); ctx.restore() }
      tuft(-26, 14); tuft(24, 20); tuft(-12, 24); tuft(18, -20); tuft(-24, -14)
      for (const [x, y, r0] of [[28, 6, 3.4], [-28, 4, 3], [4, 26, 3.6]]) { const s2 = blob(x, y, r0, r0 * 0.8, r() * PI, 7, 0.15, 3); obj(s2, { h: 2, col: P.stoneL, a: 0.6, sd: 1.5, line: 0.8 }) }
    },
    // 4: four-way fingerpost
    () => { arm(0, 0, 0.0, 40, 8, {}); arm(0, 0, PI / 2 + 0.08, 36, 8, { col: P.woodL }); arm(0, 0, PI + 0.05, 40, 8, { col: P.wood }); arm(0, 0, -PI / 2 + 0.1, 36, 8, {}); postTop(0, 0, 9); const c = ellP(0, 0, 3); obj(c, { col: P.iron, a: 0.7, sd: 2, line: 0.9 }) },
    // 5: an inn sign on a bracket: post, scrolled arm, hanging board (thin from above)
    () => {
      const f = F(-34, -10, 0.0)
      if (st.shadows) castPoly(hull2(rectP(0, 8, 36, 22, 0), 8, 10))
      castPoly(bar([-34, -10], [-12, 14], 6).concat([]).length ? hull2(bar([-34, -10], [-34, -10 + 1], 6), 20, 24) : [])
      const br = bar([-34, -10], [32, -10], 4.4); obj(br, { h: 0, col: P.woodD, a: 0.75, sd: 2, line: 1.1 })
      const sc = cr([[-30, -6], [-24, 0], [-20, -3], [-22, -8]], false, 4); line(sc, 1.2, { taper: 0.1, wob: 0.3 })
      // the board hangs below the arm: seen from above its thin top edge, a little drop and the chains
      const bd = rrect(8, -10, 40, 6, 2, 0); obj(bd, { h: 8, col: P.red, a: 0.65, sd: 3, line: 1.25 })
      if (det >= 1) { line([[-6, -9], [22, -9]], 0.6, { taper: 0.2 }); }
      for (const x of [-8, 24]) { const c = ellP(x, -10, 1.9); poly(c); ctx.fillStyle = PAPER; ctx.fill(); pen(c, 0.8, { flat: true }) }
      postTop(-34, -10, 9)
    },
    // 6: a fallen signpost lying in the grass
    () => {
      const a = 0.5, f = F(0, 0, a), ps = bar(f(-44, 0), f(34, 0), 7)
      obj(jig(ps, 0.3), { h: 4, col: P.woodD, a: 0.7, sd: 2.5, line: 1.3 })
      if (det >= 1) { ctx.beginPath(); for (let i = 0; i < 6; i++) { const u = rr(-42, 20), v = rr(-2, 2); ctx.moveTo(...f(u, v)); ctx.lineTo(...f(u + rr(4, 12), v + j(0.4))) } ctx.lineWidth = px(0.5); ctx.stroke() }
      // the splintered break and the end of the post
      const bk = [f(34, -3.5), f(38, -2), f(36, -0.5), f(41, 1), f(37, 2.4), f(34, 3.5)]; obj(bk, { h: 0, col: P.woodL, a: 0.7, shade: 0, line: 1 })
      const g = F(-28, 14, 0.0); arm(-6, 30, -0.35, 44, 9, { h: 3 })
      arm(...f(-14, 0), a - 0.3 + PI * 0.0, 30, 8.5, { h: 3, col: P.woodL, flat: false })
      tuft(34, 22); tuft(-30, -20); tuft(-44, 20); tuft(8, -24)
      for (const [x, y] of [[28, -28], [-4, 12]]) { const s2 = blob(x, y, 3.6, 3, r() * PI, 7, 0.15, 3); obj(s2, { h: 2, col: P.stoneL, a: 0.6, sd: 1.5, line: 0.8 }) }
    },
    // 7: a signpost at a cairn of stones
    () => {
      const stones = []
      for (let i = 0; i < 11; i++) { const a = (i / 11) * TAU + 0.15, d = i % 2 ? 30 : 26; stones.push([cos(a) * d, sin(a) * d, a]) }
      stones.sort((p, q) => p[1] - q[1])
      for (const [x, y, a] of stones) { const b = blob(x, y, rr(7, 9.5), rr(5.5, 7.5), a + PI / 2, 8, 0.12, 3); obj(b, { h: 4, col: [P.stone, P.stoneL, P.stoneD][(r() * 3) | 0], a: 0.75, sd: 3.5, line: 1.1 }) }
      for (const [x, y, a] of [[-6, -8, 0.3], [8, -2, 1.2], [-2, 8, 2.2]]) { const b = blob(x, y, 8, 6.5, a, 8, 0.12, 3); obj(b, { h: 3, col: P.stoneL, a: 0.7, sd: 3, line: 1.1 }) }
      arm(0, 0, -0.55, 46, 9, { h: 9, col: P.woodL }); arm(0, 1, 2.3, 42, 8.5, { h: 9 }); postTop(0, 0, 8, { sh: 28 })
    },
  ]
  reg('bm-signpost', 'Signpost', 'bm-village', 'fixed', signs)
})(window.Atlas)
