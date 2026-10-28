/* Dungeon furnishings, seen from directly above (view 'top'): altars, tombs, coffins, shelves, beds, thrones, cages, rugs,
   weapon racks, cauldrons and magic circles. Hand-inked like bm-props.js: outlines swell toward the lower right (light from
   the upper left), parallel hatching and stipple for shade, colour mode = translucent washes over the same linework.
   Everything is drawn in a 100-unit design space (100 units = s); `det` drops small marks at small sizes and adds grain,
   nails and extra strokes when big. Every piece is 'fixed' with 8 hand-designed versions; r() only adds hand-jitter. */
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
      bone: mix(t.snow, t.sand, 0.4), boneD: mix(t.sand, t.rock, 0.5), blood: mix(t.roof, '#4a1210', 0.55), brew: mix(t.forest, '#3c5a3a', 0.5),
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
  const F = (cx, cy, ang) => { const c = cos(ang || 0), s = sin(ang || 0); return (u, v) => [cx + u * c - v * s, cy + u * s + v * c] }
  const bar = (a, b, wd) => { const d = hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = (-(b[1] - a[1]) / d) * wd / 2, ny = ((b[0] - a[0]) / d) * wd / 2; return [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]] }
  const rectP = (cx, cy, w, h, ang) => { const f = F(cx, cy, ang), a = w / 2, b = h / 2; return [f(-a, -b), f(a, -b), f(a, b), f(-a, b)] }
  const nSeg = (rad) => clamp(Math.round((TAU * rad * k) / 3.6), 10, 80)
  const ellP = (cx, cy, rx, ry, ang, n) => { n = n || nSeg(max(rx, ry || rx)); ry = ry == null ? rx : ry; const f = F(cx, cy, ang), o = []; for (let i = 0; i < n; i++) { const a = (i / n) * TAU; o.push(f(cos(a) * rx, sin(a) * ry)) } return o }
  const arcP = (cx, cy, rx, ry, a0, a1, ang, n) => { const f = F(cx, cy, ang), o = []; n = n || Math.max(4, Math.round(nSeg(max(rx, ry)) * abs(a1 - a0) / TAU)); for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; o.push(f(cos(a) * rx, sin(a) * (ry == null ? rx : ry))) } return o }
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
  function blob(cx, cy, rx, ry, ang, n, irr, sub) {
    const pts = [], ph = r() * TAU, f = F(cx, cy, ang)
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU, q = 1 + irr * (sin(a * 2 + ph) * 0.5 + sin(a * 3 + ph * 1.7) * 0.3 + j(0.55)); pts.push(f(cos(a) * rx * q, sin(a) * ry * q)) }
    return cr(pts, true, sub || 3)
  }
  /** Rough swept hull of a shape and its offset copy (shadow outline of a tall thin thing). */
  function hull2(pts, dx, dy) {
    const all = pts.concat(shift(pts, dx, dy)); all.sort((a, b) => a[0] - b[0] || a[1] - b[1])
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = []
    for (const p of all) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p) }
    for (let i = all.length - 1; i >= 0; i--) { const p = all[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p) }
    return lo.slice(0, -1).concat(up.slice(0, -1))
  }

  /* ---------- path helpers ---------- */
  function sub(pts, dx, dy) { dx = dx || 0; dy = dy || 0; ctx.moveTo(pts[0][0] + dx, pts[0][1] + dy); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] + dx, pts[i][1] + dy); ctx.closePath() }
  const poly = (pts) => { ctx.beginPath(); sub(pts) }
  const clipTo = (pts) => { poly(pts); ctx.clip() }
  const paper = (pts) => { poly(pts); ctx.fillStyle = PAPER; ctx.fill() }

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
  function tint(pts, col, a) {
    if (!COL || !col) return
    ctx.save(); ctx.fillStyle = col
    ctx.globalAlpha = a * 0.62; poly(pts); ctx.fill()
    ctx.translate(j(0.6) / k, j(0.6) / k); ctx.globalAlpha = a * 0.5; poly(pts); ctx.fill()
    ctx.restore()
    ctx.save(); ctx.globalAlpha = a * 0.32; ctx.strokeStyle = col; ctx.lineWidth = 1.5 / k; poly(pts); ctx.stroke(); ctx.restore()
  }
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
    if (!COL && det >= 2 && o.cross !== false && !o.rev && dd * k > 7) {
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
    paper(pts)
    if (COL && o.col) tint(pts, o.col, o.a || 0.62)
    if (o.shade !== 0 && det >= 1) shadeIn(pts, o.sd, o)
    if (o.line !== 0) pen(pts, o.line || 1.4, { wob: o.wob, swell: o.swell, flat: o.flat, wmul: o.wmul })
  }
  /** A dark hollow (open box, pit, the inside of a tomb): paper, dark wash, hatching, shade thrown in from the upper-left wall. */
  function hollow(pts, o) {
    o = o || {}
    paper(pts); if (COL) tint(pts, o.col || P.woodX, o.a || 0.85)
    ctx.save(); clipTo(pts); const b = bbox(pts)
    if (!COL) hatchBox(b.x0, b.y0, b.x1, b.y1, o.ang == null ? -0.79 : o.ang, o.gap || 2.4, 0.45)
    ctx.restore()
    if (det >= 1) shadeIn(pts, o.sd == null ? min(b.w, b.h) * 0.22 : o.sd, { rev: true, col: 'rgba(20,12,6,0.5)', inkToo: true, gap: 1.6 })
  }

  /* ---------- small marks ---------- */
  const nail = (x, y) => dot(x, y, 0.55)
  function ball(x, y, rad, col, o) {
    o = o || {}
    const pts = ellP(x, y, rad, rad * (o.sq || 1), o.ang || 0, clamp(Math.round(rad * k * 1.5), 7, 18))
    if (o.h && st.shadows) shadow(pts, o.h)
    paper(pts)
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
  /** Planks laid across a rectangle (planks run along u). */
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
      paper(pl)
      if (COL) tone(pl, cols[(i * 7 + (o.seed || 0)) % cols.length], 0.5)
    }
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
      for (let i = 0; i < n; i++) {
        const v0 = -h / 2 + (i * h) / n, v1 = v0 + h / n
        if (r() < (det >= 3 ? 0.4 : 0.25) && v1 - v0 > 7) { const kc = f(rr(-w * 0.3, w * 0.3), (v0 + v1) / 2 + j(1)), ke = ellP(kc[0], kc[1], 2.6, 1.6, ang, 8); pen(ke, 0.6, { flat: true, wob: 0.3 }); pen(ellP(kc[0], kc[1], 1.1, 0.6, ang, 6), 0.45, { flat: true, wob: 0.2, noCorner: true }) }
        if (!COL && i % 2 === 1 && det >= 2) { ctx.save(); clipTo(ws[i]); hatchBox(cx - w, cy - w, cx + w, cy + w, ang + 0.03, 3.4, 0.3, { minG: 2.6 }); ctx.restore() }
      }
    }
    if (o.nails !== false && det >= 2) for (let i = 0; i < n; i++) { const v = -h / 2 + ((i + 0.5) * h) / n; nail(...f(-w / 2 + 2.6, v)); nail(...f(w / 2 - 2.6, v)) }
    flushDots()
  }
  /** Straw packing: lots of short strokes over a clip region. */
  function strawFill(pts, n, col, len) {
    const b = bbox(pts); ctx.save(); clipTo(pts); ctx.beginPath()
    for (let i = 0; i < n; i++) { const x = rr(b.x0, b.x1), y = rr(b.y0, b.y1), a = rr(0, PI), l = (len || 5) * rr(0.6, 1.4); ctx.moveTo(x, y); ctx.lineTo(x + cos(a) * l, y + sin(a) * l * 0.7) }
    ctx.lineWidth = px(0.5); ctx.strokeStyle = col || INK; ctx.stroke(); ctx.restore()
  }
  /** Scalloped edge from a to b: n bulges pushed to the side `out` (+1 = left of a->b, -1 = right). */
  function scal(a, b, n, depth, out, sub) {
    const d = hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = (-(b[1] - a[1]) / d) * out, ny = ((b[0] - a[0]) / d) * out, pts = []
    sub = sub || 4
    for (let i = 0; i < n; i++) for (let q = 0; q < sub; q++) { const t = (i + q / sub) / n, e = Math.sin((PI * q) / sub) * depth; pts.push([a[0] + (b[0] - a[0]) * t + nx * e, a[1] + (b[1] - a[1]) * t + ny * e]) }
    pts.push(b); return pts
  }
  function candle(x, y, R) {
    const c = ellP(x, y, R); if (st.shadows) shadow(c, 1.6)
    paper(c); if (COL) tint(c, P.cloth, 0.6); pen(c, 0.8, { wob: 0.3 })
    solidDot(x, y, R * 0.38, COL ? P.flame : INK)
    if (det >= 1) { ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.3; ctx.moveTo(x + cos(a) * R * 1.45, y + sin(a) * R * 1.45); ctx.lineTo(x + cos(a) * R * 2.0, y + sin(a) * R * 2.0) } ctx.lineWidth = px(0.45); ctx.strokeStyle = COL ? P.flameR : INK; ctx.stroke() }
  }
  /** One flame tongue from (cx, cy) pointing along ang; curl bends the tip sideways. */
  function flameP(cx, cy, len, wid, ang, curl) {
    const f = F(cx, cy, ang); curl = curl || 0
    return cr([f(0, -wid * 0.35), f(len * 0.3, -wid * 0.62), f(len * 0.62, -wid * 0.4 + curl * len * 0.2), f(len * 0.9, curl * len * 0.3), f(len, curl * len * 0.46), f(len * 0.76, wid * 0.08 + curl * len * 0.28), f(len * 0.5, wid * 0.36), f(len * 0.25, wid * 0.62), f(0, wid * 0.35)], true, 3)
  }
  const tongue = (x, y, len, wid, a, col, wgt, curl) => {
    if (!COL) { len *= 1.1; wid *= 1.06 }
    const p = flameP(x, y, len, wid, a, curl)
    paper(p)
    if (COL) { ctx.save(); ctx.globalAlpha = 0.84; ctx.fillStyle = col; poly(p); ctx.fill(); ctx.restore() }
    line(p.concat([p[0]]), wgt, { taper: 0.55, wob: 0.5 })
  }
  /** Charred log. */
  function charLog(cx, cy, L, Wd, ang) {
    const f = F(cx, cy, ang), pts = rrect(cx, cy, L, Wd, Wd * 0.4, ang)
    obj(pts, { h: 2.5, col: P.coal, a: 0.85, sd: Wd * 0.4, line: 1.1 })
    if (det >= 1) { ctx.save(); clipTo(pts); hatchBox(cx - L, cy - L, cx + L, cy + L, ang, 2.4, 0.55); ctx.restore() }
    if (det >= 2) { ctx.beginPath(); for (let u = -L / 2 + 4; u < L / 2 - 3; u += rr(4, 7)) { const v = rr(-Wd * 0.35, Wd * 0.35); ctx.moveTo(...f(u, v)); ctx.lineTo(...f(u + rr(-1.5, 1.5), v + rr(2, 3.5) * (v > 0 ? 1 : -1) * 0.8)) } ctx.lineWidth = px(0.55); ctx.strokeStyle = COL ? P.woodL : PAPER; ctx.globalAlpha = 0.8; ctx.stroke(); ctx.globalAlpha = 1 }
    const e = ellP(...f(L / 2 - Wd * 0.18, 0), Wd * 0.2, Wd * 0.42, ang)
    paper(e); if (COL) tint(e, P.woodL, 0.7); pen(e, 0.7, { flat: true })
  }
  /** Fur pelt: a hide laid flat, head at -u, fur strokes, ragged fringe. */
  function pelt(cx, cy, w, h, ang, col, o) {
    o = o || {}
    const f = F(cx, cy, ang), A = w / 2, B = h / 2, jt = () => j(0.04)
    const hp = [[-1.04, 0.0], [-0.94, -0.2], [-0.78, -0.36], [-0.66, -0.78], [-0.46, -0.98], [-0.3, -0.72], [-0.1, -0.52], [0.2, -0.56], [0.4, -0.8], [0.64, -0.96], [0.8, -0.7], [0.82, -0.4], [1.0, -0.14], [1.1, 0.04], [0.98, 0.2], [0.84, 0.44], [0.78, 0.74], [0.6, 0.98], [0.38, 0.84], [0.2, 0.56], [-0.1, 0.52], [-0.3, 0.7], [-0.46, 0.96], [-0.68, 0.8], [-0.74, 0.4], [-0.92, 0.22]]
    const body = cr(hp.map(([u, v]) => f((u + jt()) * A, (v + jt()) * B)), true, 3)
    obj(body, { h: o.h == null ? 2.5 : o.h, col: col || P.fur, a: 0.75, sd: h * 0.2, line: 1.25, wob: 1.4, shade: o.shade })
    furIn(body, f, A, B, o.n)
    return body
  }
  /** Fur strokes inside a region laid out in frame f: from the spine outward and slightly back, denser toward the rim. */
  function furIn(body, f, A, B, n) {
    ctx.save(); clipTo(body)
    const cntF = n || (det >= 3 ? 190 : det >= 2 ? 120 : det >= 1 ? 55 : 18)
    ctx.beginPath()
    for (let i = 0; i < cntF; i++) {
      const u = rr(-0.95, 1.0) * A, v = rr(-1, 1) * B, sgn = v > 0 ? 1 : -1, l = rr(2.6, 5.4) * (0.6 + Math.abs(v) / B * 0.6)
      const x0 = u, y0 = v - sgn * l * 0.2, x1 = u + l * 0.55, y1 = v + sgn * l * 0.8
      const p0 = f(x0, y0), p1 = f(x1, y1), pm = f((x0 + x1) / 2 - sgn * 0.5, (y0 + y1) / 2)
      ctx.moveTo(p0[0], p0[1]); ctx.quadraticCurveTo(pm[0], pm[1], p1[0], p1[1])
    }
    ctx.lineWidth = px(0.5); ctx.strokeStyle = INK; ctx.stroke()
    if (det >= 1) { ctx.beginPath(); for (let u = -0.8; u < 0.95; u += 0.09) { ctx.moveTo(...f(u * A, j(1.5))); ctx.lineTo(...f(u * A + 3, j(1.5))) } ctx.lineWidth = px(0.55); ctx.stroke() }
    ctx.restore()
    if (det >= 1) {
      const c = bbox(body), cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2
      ctx.beginPath()
      for (let i = 0; i < body.length; i++) { const p = body[i]; if (r() < 0.55) { const dx = p[0] - cx, dy = p[1] - cy, d = hypot(dx, dy) || 1, l = rr(1.2, 2.6); ctx.moveTo(p[0] - (dx / d) * 0.8, p[1] - (dy / d) * 0.8); ctx.lineTo(p[0] + (dx / d) * l + j(0.5), p[1] + (dy / d) * l + j(0.5)) } }
      ctx.lineWidth = px(0.55); ctx.stroke()
    }
  }

  /** Draw fn with the design space scaled by sc; pen widths and small marks keep their size in pixels. */
  function scaled(sc, fn) { const k0 = k; ctx.save(); ctx.scale(sc, sc); k = k0 * sc; try { fn() } finally { k = k0; ctx.restore() } }

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
     Dungeon helpers: stone, bone, runes, iron, cloth, books, weapons
     ===================================================================================================== */
  /** Top of a cut stone block: wash, pits, a few chisel ticks, shade crescent, inked edge. */
  function stoneTop(pts, o) {
    o = o || {}
    obj(pts, { h: o.h, col: o.col || P.stone, a: o.a || 0.7, sd: o.sd, line: o.line || 1.4, wob: o.wob, shade: o.shade })
    if (det >= 2 && o.stip !== 0) stipIn(pts, o.stip || 12, 0.5)
    if (det >= 3 && o.chisel !== false) { const b = bbox(pts); ctx.save(); clipTo(pts); ctx.beginPath(); for (let i = 0; i < 5; i++) { const x = rr(b.x0, b.x1), y = rr(b.y0, b.y1), a = rr(-0.3, 0.3); ctx.moveTo(x, y); ctx.lineTo(x + cos(a) * rr(2, 5), y + sin(a) * rr(2, 5)) } ctx.lineWidth = px(0.4); ctx.strokeStyle = INK; ctx.globalAlpha = 0.6; ctx.stroke(); ctx.restore() }
  }
  /** A jagged crack from a to b. */
  function crack(a, b, w, amp) {
    const d = hypot(b[0] - a[0], b[1] - a[1]), n = max(2, Math.round(d / 6)), nx = -(b[1] - a[1]) / (d || 1), ny = (b[0] - a[0]) / (d || 1), pts = [a]
    for (let i = 1; i < n; i++) { const t = i / n, e = j(amp == null ? 1.6 : amp); pts.push([a[0] + (b[0] - a[0]) * t + nx * e, a[1] + (b[1] - a[1]) * t + ny * e]) }
    pts.push(b); line(pts, w || 0.7, { taper: 0.5, wob: 0.3 })
    if (det >= 2 && n > 2) { const q = pts[1 + ((r() * (n - 2)) | 0)]; line([q, [q[0] + nx * rr(2, 4) + j(1), q[1] + ny * rr(2, 4) + j(1)]], 0.45, { taper: 0.6 }) }
  }
  /** Rubble: a few small stones. */
  function rubble(spots) { for (const [x, y, rx, ry] of spots) { const b = blob(x, y, rx, ry, r() * PI, 7, 0.15, 3); obj(b, { h: 1.5, col: [P.stone, P.stoneL, P.stoneD][(r() * 3) | 0], a: 0.7, sd: min(rx, ry) * 0.6, line: 0.85 }) } }
  /** A small skull seen from above, face toward +v of its frame. */
  function skull(x, y, R, ang) {
    const f = F(x, y, ang || 0), cr0 = cr([f(-R * 0.95, -R * 0.1), f(-R * 0.75, -R * 0.8), f(0, -R * 1.05), f(R * 0.75, -R * 0.8), f(R * 0.95, -R * 0.1), f(R * 0.7, R * 0.55), f(R * 0.45, R * 1.0), f(-R * 0.45, R * 1.0), f(-R * 0.7, R * 0.55)], true, 3)
    obj(cr0, { h: 0, col: P.bone, a: 0.75, sd: R * 0.45, line: 0.85, wob: 0.5 })
    if (R * k > 2.4) {
      const e = R * 0.26; for (const sg of [-1, 1]) { const q = ellP(...f(sg * R * 0.36, R * 0.05), e, e * 1.15, ang || 0, 8); ctx.beginPath(); sub(q); ctx.fillStyle = INK; ctx.fill() }
      solidDot(...f(0, R * 0.5), R * 0.11, INK)
      if (det >= 2) { ctx.beginPath(); ctx.moveTo(...f(-R * 0.32, R * 0.85)); ctx.lineTo(...f(R * 0.32, R * 0.85)); for (const u of [-0.16, 0, 0.16]) { ctx.moveTo(...f(u * R, R * 0.78)); ctx.lineTo(...f(u * R, R * 0.98)) } ctx.lineWidth = px(0.45); ctx.strokeStyle = INK; ctx.stroke() }
    }
  }
  /** A long bone between a and b with knobbed ends. */
  function bone(a, b, w) {
    w = w || 2
    const d = hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / d, uy = (b[1] - a[1]) / d
    const sh = bar([a[0] + ux * w, a[1] + uy * w], [b[0] - ux * w, b[1] - uy * w], w * 0.8)
    paper(sh); if (COL) tone(sh, P.bone, 0.6)
    for (const p of [a, b]) { const nx = -uy, ny = ux; for (const sg of [-1, 1]) { const q = ellP(p[0] + nx * sg * w * 0.45, p[1] + ny * sg * w * 0.45, w * 0.62, w * 0.62, 0, 7); paper(q); if (COL) tone(q, P.bone, 0.6); pen(q, 0.5, { flat: true, noCorner: true }) } }
    pen(sh, 0.6, { flat: true, noCorner: true })
  }
  /** A skeleton lying along +u of frame f (head at u = -L/2). */
  function skeleton(f, L, o) {
    o = o || {}
    const R = L * 0.085, hu = -L / 2 + R * 1.1
    const spine = [f(hu + R, 0), f(hu + L * 0.5, 0)]
    // spine: a dotted line of vertebrae
    if (det >= 1) { ctx.beginPath(); for (let u = hu + R * 1.3; u < hu + L * 0.5; u += 2.2) { const p = f(u, 0); ctx.moveTo(p[0] + 0.7, p[1]); ctx.arc(p[0], p[1], 0.7 / k * lw, 0, TAU) } ctx.fillStyle = INK; ctx.fill() }
    else line(spine, 0.8, { taper: 0.2 })
    // ribs: pairs of arcs
    const nr = det >= 2 ? 5 : 3
    for (let i = 0; i < nr; i++) { const u = hu + R * 1.9 + i * (L * 0.21 / nr); for (const sg of [-1, 1]) { const wdt = L * 0.11 * (1 - i * 0.08); line([f(u, 0), f(u + wdt * 0.5, sg * wdt * 0.55), f(u + wdt * 0.85, sg * wdt * 0.9)], 0.65, { taper: 0.4, wob: 0.4 }) } }
    // pelvis
    const pu = hu + L * 0.47; for (const sg of [-1, 1]) { const pv = blob(...f(pu, sg * L * 0.055), L * 0.045, L * 0.06, 0, 7, 0.12, 3); paper(pv); if (COL) tone(pv, P.bone, 0.5); pen(pv, 0.6, { flat: true, wob: 0.5 }) }
    // arms: along the sides (or folded over the chest), legs: two long bones each
    const bw = max(1.4, L * 0.022)
    for (const sg of [-1, 1]) {
      if (o.fold) { bone(f(hu + R * 1.6, sg * L * 0.13), f(hu + L * 0.28, sg * L * 0.07), bw); bone(f(hu + L * 0.28, sg * L * 0.07), f(hu + L * 0.3, -sg * L * 0.03), bw * 0.9) }
      else { bone(f(hu + R * 1.6, sg * L * 0.13), f(hu + L * 0.28, sg * L * 0.15), bw); bone(f(hu + L * 0.28, sg * L * 0.15), f(hu + L * 0.47, sg * L * 0.13), bw * 0.9) }
      bone(f(pu + L * 0.03, sg * L * 0.06), f(pu + L * 0.26, sg * L * 0.07), bw * 1.15); bone(f(pu + L * 0.26, sg * L * 0.07), f(pu + L * 0.5 - R * 0.6, sg * L * 0.075), bw)
      if (det >= 1) line([f(pu + L * 0.5 - R * 0.6, sg * L * 0.075), f(pu + L * 0.5 + R * 0.4, sg * L * 0.11)], 0.7, { taper: 0.3 })
    }
    skull(...f(hu, 0), R, (o.ang || 0) + PI / 2 + (o.tilt || 0))
  }
  /** Rune alphabet: angular strokes in a unit box, v = -1 at the top. */
  const RUNES = [
    [[[0, -1], [0, 1]], [[0, -1], [0.7, -0.4]], [[0, -0.4], [0.7, 0.2]]],
    [[[-0.5, -1], [-0.5, 1]], [[0.5, -1], [0.5, 1]], [[-0.5, -0.3], [0.5, 0.3]]],
    [[[-0.6, 1], [0, -1], [0.6, 1]]],
    [[[-0.5, -1], [0.5, 1]], [[0.5, -1], [-0.5, 1]]],
    [[[0, -1], [0, 1]], [[0, -0.2], [-0.6, -0.9]], [[0, -0.2], [0.6, -0.9]]],
    [[[-0.4, -1], [-0.4, 1]], [[-0.4, -0.8], [0.5, -0.1], [-0.4, 0.6]]],
    [[[0, -1], [0, 1]], [[-0.6, -0.1], [0.6, -0.1]]],
    [[[-0.5, -1], [0.5, -1], [-0.5, 1], [0.5, 1]]],
    [[[-0.5, -1], [0.5, -1]], [[0, -1], [0, 1]]],
    [[[-0.6, 0.6], [0, -1], [0.6, 0.6]], [[-0.3, 0], [0.3, 0]]],
    [[[-0.5, -1], [-0.5, 1]], [[-0.5, 0], [0.5, -1]], [[-0.5, 0], [0.5, 1]]],
    [[[-0.5, 1], [-0.5, -1], [0.5, 1], [0.5, -1]]],
    [[[-0.5, -1], [-0.5, 1]], [[-0.5, -1], [0.5, 0]]],
    [[[0, -1], [0.6, -0.2], [0, 0.6], [-0.6, -0.2], [0, -1]]],
    [[[-0.5, -1], [0.5, 0], [-0.5, 1]], [[0.5, 0], [0, 0]]],
    [[[0, -1], [0, 1]], [[-0.5, 1], [0.5, 1]], [[-0.3, -0.5], [0.3, -0.5]]],
  ]
  function rune(x, y, sz, ang, i, w, col) {
    const f = F(x, y, ang || 0), g = RUNES[((i | 0) % RUNES.length + RUNES.length) % RUNES.length]
    for (const strk of g) line(strk.map(([u, v]) => f(u * sz * 0.5 + j(sz * 0.04), v * sz * 0.5 + j(sz * 0.04))), w || 0.7, { taper: 0.35, wob: 0.5, col })
  }
  /** A line of runes along a->b. */
  function runeRow(a, b, sz, n, w, col) {
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0])
    for (let i = 0; i < n; i++) { const p = lerp(a, b, (i + 0.5) / n); rune(p[0], p[1], sz, ang, (r() * 99) | 0, w, col) }
  }
  /** A solid iron bar between a and b: ink in ink mode, dark iron with inked edges in colour. */
  function ironLine(a, b, w, o) {
    o = o || {}
    line([a, b], w, { taper: o.taper == null ? 0.06 : o.taper, wob: o.wob == null ? 0.3 : o.wob })
    if (COL && w * lw > 1.6) line([a, b], w * 0.5, { taper: o.taper == null ? 0.06 : o.taper, wob: 0.2, col: o.col || P.iron })
  }
  /** Flat iron strap (bands on chests, coffins). */
  const ironBar = (cx, cy, w, h, ang, rivets) => {
    const f = F(cx, cy, ang), b = rectP(cx, cy, w, h, ang)
    paper(b); if (COL) tone(b, P.iron, 0.62); else if (det >= 1) hatchIn(b, ang + PI / 2, 2.4, 0.4, { minG: 1.5 })
    pen(b, 0.9, { flat: true })
    if (rivets && det >= 2) { for (const v of rivets) nail(...f(0, v)); flushDots() }
  }
  /** Chain of links from a to b. */
  function chain(a, b, L) {
    const d = hypot(b[0] - a[0], b[1] - a[1]) || 1, n = max(2, Math.round(d / (L || 3.2))), ux = (b[0] - a[0]) / d, uy = (b[1] - a[1]) / d, ang = Math.atan2(uy, ux), l = d / n
    ctx.beginPath()
    for (let i = 0; i < n; i++) { const c = [a[0] + ux * (i + 0.5) * l, a[1] + uy * (i + 0.5) * l]; if (i % 2) ctx.ellipse(c[0], c[1], l * 0.62, l * 0.3, ang, 0, TAU); else ctx.ellipse(c[0], c[1], l * 0.62, l * 0.18, ang, 0, TAU); ctx.closePath() }
    ctx.lineWidth = px(0.85); ctx.strokeStyle = INK; ctx.stroke()
  }
  /** Iron ring (shackle, door ring) lying flat. */
  const ringFlat = (x, y, R, w) => { ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.lineWidth = px(w || 1.4); ctx.strokeStyle = INK; ctx.stroke(); if (COL) { ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.lineWidth = px((w || 1.4) * 0.5); ctx.strokeStyle = P.iron; ctx.stroke() } }
  /** A laid cloth: wash, fold lines, optional fringe along two ends (frame f, cloth w along u, h along v). */
  function cloth(f, w, h, col, o) {
    o = o || {}
    const hw = w / 2, hh = h / 2
    const raw = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]]
    const dense = densify(raw, true, 5).map(([u, v], i) => f(u + sin(i * 1.3) * 0.5 + j(0.4), v + cos(i * 1.9) * 0.5 + j(0.4)))
    obj(dense, { h: o.h == null ? 1.5 : o.h, col: col || P.red, a: o.a || 0.7, sd: o.sd == null ? min(w, h) * 0.18 : o.sd, line: o.line || 1.1, shade: o.shade })
    ctx.save(); clipTo(dense)
    if (o.border) { const ins = o.border; ctx.beginPath(); ctx.moveTo(...f(-hw + ins, -hh + ins)); ctx.lineTo(...f(hw - ins, -hh + ins)); ctx.lineTo(...f(hw - ins, hh - ins)); ctx.lineTo(...f(-hw + ins, hh - ins)); ctx.closePath(); ctx.lineWidth = px(0.55); ctx.strokeStyle = INK; ctx.stroke(); if (COL && o.borderCol) { const bp = [f(-hw, -hh), f(hw, -hh), f(hw, hh), f(-hw, hh)], ip = [f(-hw + ins, -hh + ins), f(hw - ins, -hh + ins), f(hw - ins, hh - ins), f(-hw + ins, hh - ins)]; ctx.save(); ctx.beginPath(); sub(bp); sub(ip); ctx.clip('evenodd'); tone(bp, o.borderCol, 0.5); ctx.restore() } }
    if (det >= 1 && o.folds !== 0) for (let i = 0; i < (o.folds || 3); i++) { const u = rr(-hw * 0.7, hw * 0.7), v = rr(-hh * 0.6, hh * 0.6), l = rr(min(w, h) * 0.25, min(w, h) * 0.6), a = o.foldAng == null ? rr(-0.4, 0.4) : o.foldAng; line([f(u, v), f(u + cos(a) * l * 0.5, v + sin(a) * l * 0.5 + j(1)), f(u + cos(a) * l, v + sin(a) * l + j(1.5))], 0.55, { taper: 0.8, wob: 0.4 }) }
    ctx.restore()
    if (o.fringe && det >= 1) { ctx.beginPath(); for (const sg of [-1, 1]) for (let v = -hh + 1.5; v < hh - 1; v += 2.4) { ctx.moveTo(...f(sg * hw, v)); ctx.lineTo(...f(sg * (hw + o.fringe) + j(0.4), v + j(0.6))) } ctx.lineWidth = px(0.5); ctx.strokeStyle = INK; ctx.stroke() }
    return dense
  }
  /** Books standing in a row along u from u0 to u1 (their backs at v = vBack, spines toward +v), seen from above. */
  function books(f, u0, u1, vBack, depth, o) {
    o = o || {}
    const cols = o.cols || [P.red, P.blue, P.green, P.ochre, P.plum, P.leather, P.woodD, P.canvasD], gapP = o.gap == null ? 0.06 : o.gap
    let u = u0, i = 0
    while (u < u1 - 1.6) {
      if (r() < gapP) { u += rr(2, 7); continue }
      const w = rr(2.2, 4.4), d = depth * rr(0.7, 1), lean = r() < 0.14 && u + w + 3 < u1 ? rr(0.1, 0.35) : 0
      if (u + w + lean * d > u1) break
      const p = [f(u, vBack), f(u + w, vBack), f(u + w + lean * d, vBack + d), f(u + lean * d, vBack + d)]
      paper(p); if (COL) tone(p, cols[(i * 5 + (o.seed || 0)) % cols.length], 0.62)
      else if (det >= 2 && i % 3 === 1) hatchIn(p, PI / 2 + 0.2, 1.6, 0.35, { minG: 1.3 })
      pen(p, 0.55, { flat: true, noCorner: true, wob: 0.4 })
      if (det >= 2 && w > 2.8) { seg(...f(u + 0.5, vBack + d * 0.82), ...f(u + w - 0.5, vBack + d * 0.82)) }
      u += w + 0.5; i++
    }
    flush(0.4)
  }
  /** A book lying flat. */
  function bookFlat(x, y, w, h, ang, col, open) {
    const f = F(x, y, ang), p = rectP(x, y, w, h, ang)
    obj(p, { h: 1.5, col: open ? P.cloth : col || P.red, a: 0.7, sd: 2, line: 0.9 })
    if (open) { rule(f(0, -h / 2), f(0, h / 2), 0.7, { over: 0 }); if (det >= 2) { ctx.beginPath(); for (const sg of [-1, 1]) for (let v = -h / 2 + 2; v < h / 2 - 1.5; v += 1.8) { ctx.moveTo(...f(sg * 1.5, v)); ctx.lineTo(...f(sg * (w / 2 - 1.5), v)) } ctx.lineWidth = px(0.35); ctx.strokeStyle = INK; ctx.globalAlpha = 0.6; ctx.stroke(); ctx.globalAlpha = 1 } }
    else { rule(f(-w / 2 + 1.5, -h / 2), f(-w / 2 + 1.5, h / 2), 0.6, { over: 0 }); if (det >= 2) { ctx.beginPath(); ctx.moveTo(...f(-w / 2 + 3, -h / 2 + 2)); ctx.lineTo(...f(-w / 2 + 3, h / 2 - 2)); ctx.lineWidth = px(0.4); ctx.strokeStyle = INK; ctx.stroke() } }
  }
  /** A rolled scroll pointing along ang. */
  function scroll(x, y, L, R, ang, col) {
    const f = F(x, y, ang), p = rrect(x, y, L, R * 2, R, ang)
    obj(p, { h: 1.5, col: col || P.cloth, a: 0.7, sd: R * 0.6, line: 0.85 })
    if (det >= 1) { ctx.beginPath(); ctx.moveTo(...f(-L / 2 + R * 0.6, -R * 0.4)); ctx.lineTo(...f(L / 2 - R * 0.6, -R * 0.4)); ctx.lineWidth = px(0.4); ctx.strokeStyle = INK; ctx.stroke() }
    if (det >= 1) { const t = bar(f(0, -R - 0.3), f(0, R + 0.3), 1.6); paper(t); if (COL) tone(t, P.red, 0.6); pen(t, 0.5, { flat: true, noCorner: true }) }
  }
  /** Bottle or jar from above: a round body with a cork or stopper dot. */
  function bottle(x, y, R, col) { const c = ellP(x, y, R); if (st.shadows) shadow(c, 2); paper(c); if (COL) tint(c, col || P.green, 0.75); pen(c, 0.8, { wob: 0.3 }); const n = ellP(x, y, R * 0.42); paper(n); if (COL) tint(n, P.woodL, 0.8); pen(n, 0.5, { flat: true }); if (det >= 2 && R * k > 3) { ctx.beginPath(); ctx.arc(x, y, R * 0.72, 3.5, 4.4); ctx.lineWidth = px(0.6); ctx.strokeStyle = COL ? '#f6f0dc' : PAPER; ctx.stroke() } }
  /** A bowl from above: rim, inner ring, filler(x, y, R) for the contents. */
  function bowl(x, y, R, col, fill) {
    const c = ellP(x, y, R); if (st.shadows) shadow(c, 2.5)
    paper(c); if (COL) tint(c, col || P.woodD, 0.6); pen(c, 0.9, { wob: 0.3 })
    const inn = ellP(x, y, R * 0.72); paper(inn)
    if (fill) fill(inn, x, y, R * 0.72)
    else if (COL) tint(inn, P.woodX, 0.5)
    if (det >= 1) shadeIn(inn, R * 0.3, { rev: true, gap: 1.7, col: 'rgba(30,18,8,0.4)', inkToo: true })
    pen(inn, 0.6, { swell: -0.4 })
  }
  function coin(x, y, rad) {
    ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fillStyle = PAPER; ctx.fill()
    if (COL) { ctx.save(); ctx.globalAlpha = 0.85; ctx.fillStyle = P.gold; ctx.fill(); ctx.restore() }
    ctx.lineWidth = px(0.6); ctx.strokeStyle = INK; ctx.stroke()
  }
  /** Weapons in frame f: +u runs from grip to tip. */
  function sword(f, L, o) {
    o = o || {}
    const bw = o.bw || 3.2, ang = o.ang || 0
    const grip = bar(f(-L * 0.2, 0), f(0, 0), 2.2); obj(grip, { h: o.h, col: P.leather, a: 0.8, shade: 0, line: 0.7, flat: true })
    const blade = [f(0, -bw / 2), f(L * 0.8, -bw * 0.42), f(L, 0), f(L * 0.8, bw * 0.42), f(0, bw / 2)]
    obj(blade, { h: o.h, col: P.stoneL, a: 0.6, shade: 0, line: 0.8 })
    if (det >= 1 && L * k > 14) line([f(L * 0.08, 0), f(L * 0.7, 0)], 0.45, { taper: 0.3 })
    const g = bar(f(0, -bw * 1.7), f(0, bw * 1.7), 2); obj(g, { col: P.iron, a: 0.8, shade: 0, line: 0.75, flat: true })
    ball(...f(-L * 0.22, 0), 1.7, P.brass, { line: 0.6, ang })
  }
  function spear(f, L, o) {
    o = o || {}
    const sh = bar(f(-L * 0.5, 0), f(L * 0.38, 0), 1.7); obj(sh, { h: o.h, col: P.wood, a: 0.75, shade: 0, line: 0.65, flat: true })
    const hd = cr([f(L * 0.36, 0), f(L * 0.4, -2.2), f(L * 0.5, 0), f(L * 0.4, 2.2)], true, 3); obj(hd, { h: o.h, col: P.stoneL, a: 0.6, shade: 0, line: 0.8 })
    if (det >= 2) { const b = bar(f(L * 0.34, -1.4), f(L * 0.34, 1.4), 1.4); paper(b); if (COL) tone(b, P.iron, 0.7); pen(b, 0.5, { flat: true, noCorner: true }) }
  }
  function axe(f, L, o) {
    o = o || {}
    const sh = bar(f(-L * 0.5, 0), f(L * 0.42, 0), 2); obj(sh, { h: o.h, col: P.wood, a: 0.75, shade: 0, line: 0.7, flat: true })
    const hu = L * 0.32, hd = cr([f(hu - 2, -0.8), f(hu - 4.5, -5.5), f(hu + 1, -8), f(hu + 5, -6), f(hu + 3.5, -0.8)], true, 3)
    obj(hd, { h: o.h, col: P.iron, a: 0.7, shade: 0, line: 0.9 })
    if (o.double) { const hd2 = cr([f(hu - 2, 0.8), f(hu - 4.5, 5.5), f(hu + 1, 8), f(hu + 5, 6), f(hu + 3.5, 0.8)], true, 3); obj(hd2, { h: o.h, col: P.iron, a: 0.7, shade: 0, line: 0.9 }) }
    if (det >= 1) line([f(hu - 2.5, -5.2), f(hu + 3.8, -5.6)], 0.4, { taper: 0.4, col: COL ? PAPER : INK })
  }
  function mace(f, L, o) {
    o = o || {}
    const sh = bar(f(-L * 0.5, 0), f(L * 0.3, 0), 2); obj(sh, { h: o.h, col: P.woodD, a: 0.75, shade: 0, line: 0.7, flat: true })
    const hc = f(L * 0.36, 0), R = max(3.2, L * 0.09)
    if (o.flanged) { const pts = []; for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU, q = i % 2 ? R : R * 0.62; pts.push([hc[0] + cos(a) * q, hc[1] + sin(a) * q]) } obj(pts, { h: o.h, col: P.iron, a: 0.75, sd: R * 0.4, line: 0.85 }) }
    else { ball(hc[0], hc[1], R, P.iron, { line: 0.9, h: o.h }); if (det >= 2) { for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.4; dot(hc[0] + cos(a) * R * 0.55, hc[1] + sin(a) * R * 0.55, 0.5) } flushDots() } }
  }
  function shieldRound(x, y, R, col, o) {
    o = o || {}
    const c = ellP(x, y, R); obj(c, { h: o.h == null ? 3 : o.h, col: col || P.red, a: 0.65, sd: R * 0.3, line: 1.2 })
    if (det >= 1) pen(ellP(x, y, R * 0.8), 0.5, { flat: true, swell: 0.2 })
    if (o.quarter && COL) { ctx.save(); clipTo(c); tone([[x, y], [x + R, y], [x + R, y - R], [x, y - R]], P.cloth, 0.7); tone([[x, y], [x - R, y], [x - R, y + R], [x, y + R]], P.cloth, 0.7); ctx.restore() }
    if (o.quarter) { rule([x - R, y], [x + R, y], 0.6, { over: 0 }); rule([x, y - R], [x, y + R], 0.6, { over: 0 }) }
    ball(x, y, R * 0.22, P.iron, { line: 0.7 })
    if (det >= 2) { for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + 0.2; dot(x + cos(a) * R * 0.9, y + sin(a) * R * 0.9, 0.45) } flushDots() }
  }
  function bow(f, L, o) {
    o = o || {}
    const arc = arcP(...f(-L * 0.18, 0), L * 0.62, L * 0.5, -1.1, 1.1, o.ang || 0, 10)
    line(arc, 1.6, { taper: 0.5, wob: 0.3 })
    rule(arc[0], arc[arc.length - 1], 0.4, { over: 0, taper: 0 })
    if (COL) line(arc.slice(2, -2), 0.7, { taper: 0.5, wob: 0.1, col: P.woodL })
  }
  function quiver(x, y, L, W, ang) {
    const f = F(x, y, ang), p = rrect(x, y, L, W, W * 0.3, ang)
    obj(p, { h: 2.5, col: P.leather, a: 0.75, sd: W * 0.3, line: 1 })
    if (det >= 1) { const b = bar(f(L * 0.2, -W / 2 - 0.3), f(L * 0.2, W / 2 + 0.3), 2); paper(b); if (COL) tone(b, P.woodD, 0.6); pen(b, 0.5, { flat: true, noCorner: true }) }
    for (const v of [-W * 0.25, 0.1, W * 0.28]) { line([f(L / 2 - 2, v), f(L / 2 + rr(5, 8), v + j(0.6))], 0.6, { taper: 0.1 }); if (det >= 1) { const e = f(L / 2 + 6.5, v); line([[e[0] - 2.2, e[1] - 1.4], e, [e[0] - 2.2, e[1] + 1.4]], 0.5, { taper: 0.2 }) } }
  }
  /** A rough ring of small flames and logs under a pot of radius R (drawn before the pot). */
  function fireUnder(cx, cy, R, o) {
    o = o || {}
    if (COL) tint(blob(cx, cy, R * 1.25, R * 1.2, 0, 10, 0.15, 3), P.earthD, 0.25)
    if (det >= 1) stipIn(blob(cx, cy, R * 1.3, R * 1.25, 0, 10, 0.15, 3), det >= 2 ? 50 : 20, 0.5)
    const nl = o.logs == null ? 3 : o.logs, a0 = o.a0 == null ? 0.5 : o.a0
    for (let i = 0; i < nl; i++) { const a = a0 + (i / nl) * TAU + j(0.2); charLog(cx + cos(a) * R * 0.85, cy + sin(a) * R * 0.85, R * 0.9, max(3.4, R * 0.17), a) }
    if (!o.cold) { const nt = det >= 1 ? 7 : 4; for (let i = 0; i < nt; i++) { const a = rr(0, TAU) + (i / nt) * TAU, d = R * 0.78; tongue(cx + cos(a) * d, cy + sin(a) * d, rr(R * 0.3, R * 0.5), R * 0.26, a, i % 2 ? P.flame : P.flameR, 0.75, j(0.5)) } }
  }
  /** Bubbles on a liquid surface. */
  function bubbles(inn, n, col) {
    const b = bbox(inn); ctx.save(); clipTo(inn); ctx.beginPath()
    for (let i = 0; i < n; i++) { const x = rr(b.x0, b.x1), y = rr(b.y0, b.y1), q = rr(0.9, 2.4); ctx.moveTo(x + q, y); ctx.arc(x, y, q, 0, TAU) }
    ctx.lineWidth = px(0.55); ctx.strokeStyle = col || INK; ctx.stroke(); ctx.restore()
  }
  /** Steam: two or three thin wisps rising off to the upper right. */
  function steam(x, y, L) { for (let i = 0; i < 3; i++) { const x0 = x + j(L * 0.3), pts = []; for (let t = 0; t <= 1.001; t += 0.2) pts.push([x0 + t * L * 0.5 + sin(t * 7 + i) * L * 0.1, y - t * L]); line(pts, 0.5, { taper: 0.8, wob: 0.6 }) } }
  /** A wooden board (plain, with grain), as a solid object. */
  function board(pts, o) { o = o || {}; obj(pts, { h: o.h, col: o.col || P.wood, a: o.a || 0.7, sd: o.sd, line: o.line || 1.2, shade: o.shade, flat: o.flat }); if (det >= 2 && o.grain !== false) { const b = bbox(pts), ang = o.ang || 0; ctx.save(); clipTo(pts); ctx.beginPath(); for (let i = 0; i < (o.n || 3); i++) { const f = F((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, ang), L = max(b.w, b.h), v = rr(-min(b.w, b.h) * 0.4, min(b.w, b.h) * 0.4); let first = true; for (let u = -L * 0.45; u < L * 0.45; u += 4) { const p = f(u, v + sin(u * 0.2 + i) * 0.5); if (first) { ctx.moveTo(p[0], p[1]); first = false } else ctx.lineTo(p[0], p[1]) } } ctx.lineWidth = px(0.4); ctx.strokeStyle = INK; ctx.globalAlpha = 0.65; ctx.stroke(); ctx.restore() } }
  /** Cobweb in a corner: radial threads from (x, y) between angles a0..a1 with sagging cross threads. */
  function cobweb(x, y, R, a0, a1) {
    ctx.beginPath(); const n = 5
    for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; ctx.moveTo(x, y); ctx.lineTo(x + cos(a) * R, y + sin(a) * R) }
    for (let q = 1; q <= 3; q++) { const d = (R * q) / 3.4; for (let i = 0; i < n; i++) { const b0 = a0 + ((a1 - a0) * i) / n, b1 = a0 + ((a1 - a0) * (i + 1)) / n, p0 = [x + cos(b0) * d, y + sin(b0) * d], p1 = [x + cos(b1) * d, y + sin(b1) * d], m = lerp(p0, p1, 0.5); ctx.moveTo(p0[0], p0[1]); ctx.quadraticCurveTo(m[0] - (m[0] - x) * 0.15, m[1] - (m[1] - y) * 0.15, p1[0], p1[1]) } }
    ctx.lineWidth = px(0.35); ctx.strokeStyle = INK; ctx.globalAlpha = 0.75; ctx.stroke(); ctx.globalAlpha = 1
  }
  /** A square post seen from above with its long shadow. */
  const post = (x, y, s, h, col) => { const b = rectP(x, y, s, s, 0); if (st.shadows) castPoly(hull2(b, (h || 8) * 0.66, (h || 8) * 0.8)); obj(b, { h: 0, col: col || P.woodD, a: 0.75, sd: s * 0.4, line: 1 }) }
  const stain = (x, y, rx, ry, col, n) => { const b = blob(x, y, rx, ry, r() * PI, 9, 0.25, 3); if (COL) tint(b, col || P.blood, 0.45); else stipIn(b, n || 40, 0.55); return b }

  /* =====================================================================================================
     Altar: a stone block two squares wide, one deep. x in [-45, 45], y in [-22, 22].
     ===================================================================================================== */
  /** The altar block: a cut stone top with a chamfer line and a moulded edge. */
  function altarBlock(cx, cy, w, h, ang, o) {
    o = o || {}
    const body = rectP(cx, cy, w, h, ang)
    stoneTop(jig(body, 0.25), { h: o.h == null ? 8 : o.h, col: o.col || P.stone, sd: h * 0.2, line: 1.5, stip: o.stip })
    if (det >= 1) pen(rectP(cx, cy, w - 5, h - 5, ang), 0.5, { flat: true, swell: 0.2 })
    return body
  }
  const chalice = (x, y, R) => { const c = ellP(x, y, R); if (st.shadows) shadow(c, 3); paper(c); if (COL) tint(c, P.brass, 0.8); pen(c, 0.9, { wob: 0.3 }); const inn = ellP(x, y, R * 0.6); paper(inn); if (COL) tint(inn, P.blood, 0.7); else if (det >= 1) hatchIn(inn, 0.3, 1.4, 0.4, { minG: 1.1 }); pen(inn, 0.5, { flat: true }) }
  const altars = [
    // 0: plain slab
    () => { altarBlock(0, 0, 86, 40, j(0.01)); if (det >= 2) { crack([-30, -20], [-22, -8], 0.5, 1); line([[20, 14], [30, 18]], 0.45, { taper: 0.6 }) } },
    // 1: carved, a cloth runner and candles
    () => {
      const body = altarBlock(0, 0, 86, 40, 0, { col: P.stoneL })
      if (det >= 2) { ctx.save(); clipTo(body); ctx.beginPath(); for (let x = -38; x < 40; x += 6) { ctx.moveTo(x, -17.5); ctx.arc(x + 3, -17.5, 3, PI, 0); ctx.moveTo(x, 17.5); ctx.arc(x + 3, 17.5, 3, 0, PI) } ctx.lineWidth = px(0.45); ctx.strokeStyle = INK; ctx.stroke(); ctx.restore() }
      cloth(F(0, 0, 0), 66, 15, P.red, { h: 1.5, border: 2.4, borderCol: P.gold, fringe: 2.4, folds: 2, foldAng: 1.5 })
      if (det >= 1) { for (const [x, y] of [[-14, 0], [0, 0], [14, 0]]) rune(x, y, 5, 0, 13 + (x > 0 ? 1 : 0), 0.55, COL ? P.gold : undefined) }
      candle(-36, -9, 3.4); candle(36, -9, 3.4); candle(-36, 10, 2.8); chalice(26, 8, 4.6)
    },
    // 2: blood-stained sacrificial stone with channels
    () => {
      const body = altarBlock(0, 0, 86, 40, 0, { col: P.stoneD, stip: 20 })
      ctx.save(); clipTo(body)
      const d = [[-20, -6, 14, 9], [6, 4, 18, 10], [-4, -12, 8, 5]]; for (const [x, y, rx, ry] of d) stain(x, y, rx, ry, P.blood, det >= 2 ? 90 : 35)
      // channels cut into the stone: a gutter down the middle and two to the front edge
      for (const [a, b] of [[[-30, 0], [30, 0]], [[0, 0], [0, 20]], [[-26, 0], [-26, 20]], [[26, 0], [26, 20]]]) { rule(a, b, 1.5, { over: 0, taper: 0.1 }); if (COL) line([a, b], 0.7, { taper: 0.1, col: P.blood }) }
      ctx.restore()
      if (COL) { for (const x of [-26, 0, 26]) tint(blob(x, 22, 2.6, 2, 0, 7, 0.3, 3), P.blood, 0.6) }
      else if (det >= 1) { for (const x of [-26, 0, 26]) { ctx.beginPath(); for (let i = 0; i < 4; i++) { ctx.moveTo(x + j(2), 20); ctx.lineTo(x + j(2.5), 22 + rr(0, 1.5)) } ctx.lineWidth = px(0.5); ctx.strokeStyle = INK; ctx.stroke() } }
      for (const [x, y] of [[-38, -14], [38, -14], [-38, 14], [38, 14]]) ringFlat(x, y, 2.6, 1.3)
    },
    // 3: with an idol on it
    () => {
      altarBlock(0, 2, 80, 38, 0.0)
      const base = ellP(0, 0, 9, 8); if (st.shadows) castPoly(hull2(ellP(0, 0, 6, 5), 12, 15))
      obj(base, { h: 0, col: P.stoneD, a: 0.7, sd: 3, line: 1.2 })
      const body = cr([[-6, -2], [-4, -9], [0, -11], [4, -9], [6, -2], [5, 6], [-5, 6]], true, 3); obj(body, { h: 0, col: P.brass, a: 0.7, sd: 3, line: 1.1 })
      const hd = ellP(0, -3, 3.6); obj(hd, { h: 0, col: P.brass, a: 0.75, sd: 1.6, line: 0.9 })
      line([[-3, -5.5], [-6, -11], [-4.5, -13]], 0.8, { taper: 0.2 }); line([[3, -5.5], [6, -11], [4.5, -13]], 0.8, { taper: 0.2 })
      if (det >= 1) { solidDot(-1.3, -3.6, 0.6, INK); solidDot(1.3, -3.6, 0.6, INK) }
      candle(-28, -8, 3); candle(28, -8, 3); bowl(-24, 9, 4.6, P.woodD, (inn) => { if (COL) tint(inn, P.earthD, 0.6); else stipIn(inn, 20, 0.5) })
      if (det >= 1) { for (const x of [-14, 14]) coin(x + j(2), 10 + j(2), 2.2) }
    },
    // 4: round stone altar between two candle stands
    () => {
      for (const sg of [-1, 1]) { const b = ellP(sg * 36, 4, 5.5); if (st.shadows) castPoly(hull2(ellP(sg * 36, 4, 2.5), 14, 17)); obj(b, { h: 0, col: P.iron, a: 0.7, sd: 2.5, line: 1.1 }); candle(sg * 36, 4, 2.6) }
      const outer = blob(0, 0, 21, 21, 0, 16, 0.02, 3)
      stoneTop(outer, { h: 8, col: P.stone, sd: 6, line: 1.5, stip: 16 })
      if (det >= 1) pen(ellP(0, 0, 16), 0.55, { flat: true, swell: 0.2 })
      const bowlP = ellP(0, 0, 7); paper(bowlP); if (COL) tint(bowlP, P.stoneD, 0.6); if (det >= 1) shadeIn(bowlP, 3, { rev: true, inkToo: true, gap: 1.6 }); pen(bowlP, 0.9, { swell: -0.5 })
      if (det >= 2) { for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + 0.2; rune(cos(a) * 11.5, sin(a) * 11.5, 3.6, a + PI / 2, i * 3, 0.5) } }
    },
    // 5: altar on a stepped dais
    () => {
      stoneTop(jig(rectP(0, 0, 90, 44, 0), 0.2), { h: 3, col: P.stoneL, sd: 5, line: 1.3, stip: 10 })
      stoneTop(jig(rectP(0, 0, 76, 34, 0), 0.2), { h: 3, col: P.stone, sd: 4, line: 1.2, stip: 8 })
      if (det >= 1) { ctx.beginPath(); for (const x of [-44, 44]) for (const y of [-9, 0, 9]) { ctx.moveTo(x * 0.85, y); ctx.lineTo(x, y) } ctx.lineWidth = px(0.45); ctx.strokeStyle = INK; ctx.stroke() }
      altarBlock(0, 0, 56, 22, 0, { h: 7, col: P.stoneL })
      candle(-20, -4, 2.6); candle(20, -4, 2.6)
    },
    // 6: broken altar
    () => {
      const L = rot([[-43, -20], [-2, -20], [-6, -8], [2, 2], [-4, 20], [-43, 20]], -22, 0, 0.03), Rt = rot([[4, -20], [43, -20], [43, 20], [3, 20], [8, 3], [0, -7]], 26, 4, -0.09)
      stoneTop(jig(L, 0.3), { h: 7, col: P.stone, sd: 7, line: 1.4, stip: 10 })
      stoneTop(jig(shift(Rt, 2, 3), 0.3), { h: 5, col: P.stoneL, sd: 6, line: 1.4, stip: 10 })
      if (det >= 1) { crack([-30, -12], [-18, 6], 0.55, 1.2); crack([20, -14], [32, -2], 0.5, 1) }
      rubble([[2, -4, 3.4, 2.6], [0, 10, 2.6, 2], [-20, 24, 2.2, 1.8], [40, 24, 3, 2.2], [46, -16, 2.2, 1.8]])
      if (det >= 2) { ctx.beginPath(); for (let i = 0; i < 24; i++) { const x = rr(-8, 10), y = rr(-18, 20), q = 0.5 / k * lw; ctx.moveTo(x + q, y); ctx.arc(x, y, q, 0, TAU) } ctx.fillStyle = INK; ctx.fill() }
    },
    // 7: with offering bowls
    () => {
      altarBlock(0, 0, 84, 38, 0.0)
      bowl(-26, 0, 7, P.woodD, (inn) => { if (COL) tint(inn, P.straw, 0.5); const b = bbox(inn); ctx.save(); clipTo(inn); for (let i = 0; i < 7; i++) coin(rr(b.x0 + 1, b.x1 - 1), rr(b.y0 + 1, b.y1 - 1), 1.9); ctx.restore() })
      bowl(0, 2, 7.4, P.stoneD, (inn, x, y, R) => { ctx.save(); clipTo(inn); for (const [dx, dy, c] of [[-2, -1.5, P.red], [2.2, -0.5, P.green], [0, 2.4, P.red], [-2.6, 2.2, P.ochre]]) ball(x + dx, y + dy, R * 0.42, c, { line: 0.6 }); ctx.restore() })
      bowl(26, -1, 6.4, P.woodD, (inn) => { if (COL) tint(inn, P.ash, 0.5); stipIn(inn, det >= 1 ? 30 : 10, 0.5) })
      candle(-40, -12, 2.6); candle(40, 12, 2.6)
      if (det >= 2) { line([[8, 14], [16, 15]], 0.45, { taper: 0.5 }); for (let i = 0; i < 5; i++) dot(rr(14, 36), rr(10, 16), 0.45); flushDots() }
    },
  ]
  reg('dg-altar', 'Altar', 'dg-furnishings', 'fixed', altars)

  /* =====================================================================================================
     Sarcophagus: one square wide, two long. x in [-24, 24], y in [-48, 48].
     ===================================================================================================== */
  /** Stone base with a raised lid; returns frames for the lid panel. */
  function sarcBase(cx, cy, w, h, ang, o) {
    o = o || {}
    const body = rectP(cx, cy, w, h, ang)
    stoneTop(jig(body, 0.25), { h: o.h == null ? 10 : o.h, col: o.col || P.stone, sd: w * 0.16, line: 1.5, stip: 10 })
    return body
  }
  function sarcLid(cx, cy, w, h, ang, o) {
    o = o || {}
    const lid = rectP(cx, cy, w, h, ang)
    stoneTop(jig(lid, 0.2), { h: o.h == null ? 0 : o.h, col: o.col || P.stoneL, sd: w * 0.14, line: 1.3, stip: 8 })
    if (det >= 1 && o.panel !== false) pen(rectP(cx, cy, w - 8, h - 8, ang), 0.6, { flat: true, swell: 0.3 })
    return lid
  }
  /** Carved effigy on a lid: head, folded hands, a sword down the middle, feet. */
  function effigy(f, L) {
    const W = L * 0.26
    const bd = cr([f(-W * 0.9, -L * 0.3), f(W * 0.9, -L * 0.3), f(W, -L * 0.05), f(W * 0.85, L * 0.3), f(W * 0.55, L * 0.42), f(-W * 0.55, L * 0.42), f(-W * 0.85, L * 0.3), f(-W, -L * 0.05)], true, 3)
    obj(bd, { h: 0, col: P.stone, a: 0.6, sd: W * 0.4, line: 1 })
    if (det >= 1) { line([f(-W * 0.5, -L * 0.1), f(0, -L * 0.04), f(W * 0.5, -L * 0.1)], 0.8, { taper: 0.3 }); line([f(-W * 0.35, -L * 0.03), f(W * 0.35, 0.02 * L)], 0.7, { taper: 0.3 }); line([f(-W * 0.5, L * 0.1), f(-W * 0.5, L * 0.36)], 0.5, { taper: 0.5 }); line([f(W * 0.5, L * 0.1), f(W * 0.5, L * 0.36)], 0.5, { taper: 0.5 }) }
    const sw = bar(f(0, -L * 0.16), f(0, L * 0.38), 1.9); obj(sw, { col: P.stoneL, a: 0.7, shade: 0, line: 0.7, flat: true }); const g = bar(f(-W * 0.45, -L * 0.14), f(W * 0.45, -L * 0.14), 1.6); obj(g, { col: P.stoneD, a: 0.6, shade: 0, line: 0.7, flat: true })
    const hd = ellP(...f(0, -L * 0.38), W * 0.42); obj(hd, { h: 0, col: P.stoneL, a: 0.6, sd: W * 0.2, line: 0.9 })
    if (det >= 2) { line([f(-W * 0.2, -L * 0.4), f(W * 0.2, -L * 0.4)], 0.5, { taper: 0.4 }); line([f(0, -L * 0.46), f(0, -L * 0.36)], 0.5, { taper: 0.4 }) }
  }
  const sarcophagi = [
    // 0: carved effigy lid
    () => { sarcBase(0, 0, 46, 94, 0); sarcLid(0, 0, 40, 86, 0); effigy(F(0, 0, 0), 86); if (det >= 2) { ctx.beginPath(); for (let y = -36; y <= 36; y += 9) { ctx.moveTo(-17, y); ctx.lineTo(-14.5, y); ctx.moveTo(17, y); ctx.lineTo(14.5, y) } ctx.lineWidth = px(0.5); ctx.strokeStyle = INK; ctx.stroke() } },
    // 1: plain lid with corner bosses
    () => {
      sarcBase(0, 0, 46, 94, 0.01); const lid = sarcLid(0, 0, 40, 86, 0.01, { panel: false })
      if (det >= 1) { shadeIn(lid, 9, { gap: 2.4 }); pen(rectP(0, 0, 32, 78, 0.01), 0.55, { flat: true, swell: 0.3 }) }
      if (det >= 2) for (const [x, y] of [[-16, -39], [16, -39], [16, 39], [-16, 39]]) ball(x, y, 1.8, P.stoneD, { line: 0.6 })
      if (det >= 1) line([[-6, -20], [0, -22], [6, -20], [0, -12], [-6, -20]], 0.6, { taper: 0.2 })
    },
    // 2: lid slid half open, bones inside
    () => {
      const body = sarcBase(0, 0, 46, 94, 0)
      const cav = rectP(0, 0, 36, 84, 0); hollow(cav, { sd: 8 })
      ctx.save(); clipTo(cav); skeleton(F(0, -2, PI / 2), 76, { fold: true, ang: PI / 2 }); ctx.restore()
      pen(cav, 1.0, { swell: -0.5 })
      const lid = rectP(3, 26, 40, 86, 0.08); shadow(lid, 6)
      stoneTop(jig(lid, 0.2), { h: 0, col: P.stoneL, sd: 6, line: 1.3, stip: 8 }); if (det >= 1) pen(rectP(3, 26, 32, 78, 0.08), 0.6, { flat: true, swell: 0.3 })
      pen(body, 1.5)
    },
    // 3: lid off and leaning beside it, the inside visible
    () => {
      const cx = -7, body = sarcBase(cx, 0, 34, 92, 0)
      const cav = rectP(cx, 0, 26, 84, 0); hollow(cav, { sd: 6 })
      ctx.save(); clipTo(cav); skeleton(F(cx, 0, PI / 2), 78, { ang: PI / 2, tilt: 0.3 }); ctx.restore()
      pen(cav, 1.0, { swell: -0.5 }); pen(body, 1.5)
      // the lid stands on edge against the right side: we see it foreshortened
      const lid = rectP(17, 2, 12, 84, -0.03); shadow(lid, 5)
      paper(lid); if (COL) tint(lid, P.stoneL, 0.7); if (det >= 1) hatchIn(lid, 1.2, 2.4, 0.45); pen(lid, 1.3)
      if (det >= 1) { ctx.beginPath(); ctx.moveTo(14.5, -36); ctx.lineTo(14, 38); ctx.lineWidth = px(0.5); ctx.strokeStyle = INK; ctx.stroke() }
    },
    // 4: cracked, a corner broken away
    () => {
      sarcBase(0, 0, 46, 94, 0)
      const lid = [[-20, -43], [20, -43], [20, 28], [12, 32], [16, 43], [-20, 43]]
      const hole = [[12, 32], [20, 28], [20, 43], [16, 43]]; hollow(hole, { sd: 3 })
      stoneTop(jig(lid, 0.2), { h: 0, col: P.stoneL, sd: 6, line: 1.3, stip: 10 })
      if (det >= 1) pen(rectP(0, -3, 32, 72, 0), 0.6, { flat: true, swell: 0.3 })
      crack([-20, -8], [-4, 2], 0.9, 1.6); crack([-4, 2], [18, 6], 0.9, 1.6); crack([-4, 2], [2, 24], 0.6, 1.4)
      if (det >= 1) crack([-12, 30], [-2, 43], 0.5, 1)
      rubble([[22, 36, 2.4, 1.8], [19, 45, 2, 1.6]])
    },
    // 5: with runes
    () => {
      sarcBase(0, 0, 46, 94, 0); sarcLid(0, 0, 40, 86, 0, { panel: false })
      if (det >= 1) { runeRow([-15, -39], [15, -39], 4.2, 6, 0.6); runeRow([15, 39], [-15, 39], 4.2, 6, 0.6); runeRow([17, -34], [17, 34], 4.2, 13, 0.6); runeRow([-17, 34], [-17, -34], 4.2, 13, 0.6) }
      pen(ellP(0, 0, 11), 0.8, { flat: true, wob: 0.6 }); pen(ellP(0, 0, 8), 0.5, { flat: true, wob: 0.6 })
      rune(0, 0, 9, 0, 13, 0.9); if (det >= 1) { for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; rune(cos(a) * 9.5, sin(a) * 9.5, 2.6, a + PI / 2, i * 5, 0.45) } }
    },
    // 6: on a plinth
    () => {
      stoneTop(jig(rectP(0, 0, 48, 96, 0), 0.2), { h: 4, col: P.stoneD, sd: 5, line: 1.3, stip: 10 })
      sarcBase(0, 0, 38, 84, 0, { h: 8 }); sarcLid(0, 0, 32, 76, 0)
      line([[0, -26], [0, 10]], 1.5, { taper: 0.1 }); line([[-8, -16], [8, -16]], 1.5, { taper: 0.1 })
      if (det >= 2) { ctx.beginPath(); for (const x of [-22, 22]) for (let y = -40; y <= 40; y += 16) { ctx.moveTo(x, y); ctx.lineTo(x * 0.85, y) } ctx.lineWidth = px(0.45); ctx.strokeStyle = INK; ctx.stroke() }
    },
    // 7: wooden, coffin-like, iron bands and a carved cross
    () => {
      const body = rectP(0, 0, 44, 90, 0); shadow(body, 8)
      plankRect(0, 0, 90, 44, PI / 2, { pw: 15, n: 3, nails: false, seed: 2 })
      for (const y of [-28, 28]) ironBar(0, y, 46, 5.5, 0, [-16, 0, 16])
      if (det >= 1) { const cr1 = bar([0, -16], [0, 14], 3.4), cr2 = bar([-9, -6], [9, -6], 3.2); obj(cr1, { col: P.brass, a: 0.7, shade: 0, line: 0.8, flat: true }); obj(cr2, { col: P.brass, a: 0.7, shade: 0, line: 0.8, flat: true }) }
      if (det >= 2) { for (const [x, y] of [[-19, -42], [19, -42], [19, 42], [-19, 42]]) nail(x, y); flushDots() }
      if (det >= 1) shadeIn(body, 7, { gap: 2.3 }); pen(body, 1.5)
    },
  ]
  reg('dg-sarcophagus', 'Sarcophagus', 'dg-furnishings', 'fixed', sarcophagi)

  /* =====================================================================================================
     Coffin: a hexagonal box one square wide. x in [-20, 20], y in [-45, 45].
     ===================================================================================================== */
  /** Coffin outline, head at -v; sc scales the standard 40 x 90 shape. */
  const coffinP = (cx, cy, sc, ang) => { const f = F(cx, cy, ang); return [[-11, -45], [11, -45], [20, -26], [13, 45], [-13, 45], [-20, -26]].map(([u, v]) => f(u * sc, v * sc)) }
  function coffinLid(cx, cy, sc, ang, o) {
    o = o || {}
    const pts = coffinP(cx, cy, sc, ang)
    if (o.h !== 0) shadow(pts, o.h == null ? 6 : o.h)
    paper(pts); ctx.save(); clipTo(pts); plankRect(cx, cy, 92 * sc, 42 * sc, ang + PI / 2, { pw: 14 * sc, n: 3, nails: false, seed: o.seed, cols: o.cols }); ctx.restore()
    if (det >= 1 && o.cross !== false) { const f = F(cx, cy, ang); rule(f(0, -30 * sc), f(0, 6 * sc), 1.4, { over: 0, taper: 0.1 }); rule(f(-7 * sc, -18 * sc), f(7 * sc, -18 * sc), 1.4, { over: 0, taper: 0.1 }) }
    if (det >= 2) { for (const p of pts) nail(p[0] + (cx - p[0]) * 0.12, p[1] + (cy - p[1]) * 0.08); flushDots() }
    if (det >= 1) shadeIn(pts, 5 * sc, { gap: 2.3 })
    pen(pts, 1.4)
    return pts
  }
  /** Open coffin: walls, dark inside, contents via fill(innerPts, f). */
  function coffinOpen(cx, cy, sc, ang, fill) {
    const outer = coffinP(cx, cy, sc, ang), inner = coffinP(cx, cy, sc * 0.82, ang)
    shadow(outer, 5); paper(outer); if (COL) tint(outer, P.wood, 0.65)
    if (det >= 2) { ctx.save(); clipTo(outer); ctx.beginPath(); for (let i = 0; i < outer.length; i++) { const a = outer[i], b = outer[(i + 1) % outer.length]; ctx.moveTo(...lerp(lerp(a, b, 0.2), [cx, cy], 0.09)); ctx.lineTo(...lerp(lerp(a, b, 0.8), [cx, cy], 0.09)) } ctx.lineWidth = px(0.4); ctx.strokeStyle = INK; ctx.stroke(); ctx.restore() }
    hollow(inner, { sd: 6 * sc })
    if (fill) { ctx.save(); clipTo(inner); fill(inner, F(cx, cy, ang)); ctx.restore() }
    pen(inner, 0.95, { swell: -0.4 }); pen(outer, 1.4)
    return outer
  }
  const coffins = [
    // 0: closed plank coffin
    () => coffinLid(0, 0, 1, 0.0),
    // 1: open with a skeleton
    () => coffinOpen(0, 0, 1, 0, () => skeleton(F(0, 0, PI / 2), 72, { fold: true, ang: PI / 2 })),
    // 2: lid ajar
    () => {
      coffinOpen(0, 0, 1, 0, (inner) => { ctx.save(); clipTo(inner); skeleton(F(0, 0, PI / 2), 72, { fold: true, ang: PI / 2 }); ctx.restore() })
      coffinLid(6, 9, 0.98, 0.16, { h: 5, seed: 1 })
    },
    // 3: iron-banded
    () => {
      const pts = coffinLid(0, 0, 1, 0, { cross: false, h: 6 })
      for (const y of [-30, 0, 30]) { const w = y < -26 ? 30 : y < 0 ? 40 : 34; ironBar(0, y, w + 3, 5.5, 0, [-w * 0.38, 0, w * 0.38]) }
      if (det >= 1) { for (const p of pts) { const q = ellP(p[0] + (0 - p[0]) * 0.1, p[1] + (0 - p[1]) * 0.07, 2.2, 2.2, 0, 6); paper(q); if (COL) tone(q, P.iron, 0.7); pen(q, 0.6, { flat: true }) } }
      if (det >= 2) { ringFlat(0, -14, 2.8, 1.2) }
    },
    // 4: rotten and broken
    () => {
      const outer = coffinP(0, 0, 1, 0); shadow(outer, 4)
      hollow(coffinP(0, 0, 0.84, 0), { sd: 5 })
      ctx.save(); clipTo(outer)
      // planks, some fallen in: three long planks with gaps and splintered ends
      const planks = [[-13, -42, -14, 14, 0], [0, -43, -2, 44, 1], [13, -40, 12, 20, 2]]
      for (const [x0, y0, x1, y1, i] of planks) {
        if (i === 1) { const p = [[-5, -43], [5, -43], [6, -10], [2, -4], [5, 6], [6, 44], [-6, 44], [-5, 6], [-2, -4], [-6, -10]]; obj(jig(p, 0.4), { col: [P.woodD, P.wood, P.woodD][i], a: 0.6, sd: 2, line: 0.9 }); continue }
        const w = 10, f = F((x0 + x1) / 2, (y0 + y1) / 2, Math.atan2(y1 - y0, x1 - x0)), L = hypot(x1 - x0, y1 - y0)
        const p = [f(-L / 2, -w / 2), f(L / 2 - 3, -w / 2), f(L / 2 + 1, -w / 6), f(L / 2 - 2, w / 6), f(L / 2 + 2, w / 2), f(-L / 2, w / 2)]
        obj(p, { col: [P.woodD, P.wood, P.woodD][i], a: 0.6, sd: 2, line: 0.9 })
        if (det >= 1) { ctx.beginPath(); for (let q = 0; q < 3; q++) { ctx.moveTo(...f(-L / 2 + 3, -w / 2 + 2 + q * 3)); ctx.lineTo(...f(L / 2 - 6, -w / 2 + 2.5 + q * 3 + j(0.5))) } ctx.lineWidth = px(0.4); ctx.strokeStyle = INK; ctx.globalAlpha = 0.6; ctx.stroke(); ctx.globalAlpha = 1 }
      }
      // what shows through the gaps: a skull and bones
      skull(2, 30, 4.4, 0.3); bone([-12, 24], [-4, 40], 1.8); bone([10, 26], [16, 40], 1.6)
      ctx.restore()
      // splintered edges and rot stains
      if (det >= 1) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const y = rr(-20, 44), sg = r() < 0.5 ? -1 : 1; ctx.moveTo(sg * (19 - abs(y) * 0.06), y); ctx.lineTo(sg * (16 - abs(y) * 0.06) + j(1), y + rr(-3, 3)) } ctx.lineWidth = px(0.5); ctx.strokeStyle = INK; ctx.stroke() }
      if (COL) { tint(blob(-6, -30, 7, 5, 0.3, 8, 0.25, 3), P.earthD, 0.35); tint(blob(8, 10, 5, 7, 0.1, 8, 0.25, 3), P.green, 0.3) }
      else if (det >= 2) stipIn(blob(-6, -30, 7, 5, 0.3, 8, 0.25, 3), 30, 0.5)
      pen(outer, 1.3, { wob: 1.6 })
    },
    // 5: draped with a cloth
    () => {
      coffinLid(0, 0, 1, 0, { cross: false })
      const f = F(0, 0, 0), raw = [[-14, -47], [14, -47], [23, -28], [24, 30], [17, 40], [14, 47], [-14, 47], [-17, 40], [-24, 30], [-23, -28]]
      const dense = densify(raw, true, 5).map(([u, v], i) => f(u + sin(i * 1.1) * 0.6 + j(0.4), v + cos(i * 1.7) * 0.6 + j(0.4)))
      obj(dense, { h: 2, col: P.plum, a: 0.7, sd: 6, line: 1.2 })
      ctx.save(); clipTo(dense)
      if (COL) { tone([f(-3, -40), f(3, -40), f(3, 40), f(-3, 40)], P.gold, 0.45); tone([f(-18, -22), f(18, -22), f(18, -16), f(-18, -16)], P.gold, 0.45) }
      rule(f(-3, -42), f(-3, 42), 0.6, { over: 0 }); rule(f(3, -42), f(3, 42), 0.6, { over: 0 }); rule(f(-20, -22), f(20, -22), 0.6, { over: 0 }); rule(f(-20, -16), f(20, -16), 0.6, { over: 0 })
      if (det >= 1) for (const [u, v, l] of [[-12, -5, 14], [10, 10, 12], [-10, 25, 10], [12, -32, 9]]) line([f(u, v), f(u + 1, v + l * 0.5), f(u - 1, v + l)], 0.55, { taper: 0.8, wob: 0.5 })
      ctx.restore()
      if (det >= 1) { ctx.beginPath(); for (let v = -44; v < 46; v += 3) { for (const sg of [-1, 1]) { const u = sg * (abs(v + 28) < 2 ? 23 : v < -28 ? 14 + (v + 47) * 0.47 : v > 30 ? 24 - (v - 30) * 0.6 : 24); ctx.moveTo(...f(u, v)); ctx.lineTo(...f(u + sg * 2 + j(0.5), v + j(0.6))) } } ctx.lineWidth = px(0.45); ctx.strokeStyle = INK; ctx.stroke() }
    },
    // 6: candles at the head
    () => {
      coffinLid(0, 6, 0.87, 0.0, { h: 6 })
      candle(-13, -40, 3.2); candle(13, -40, 3.2); candle(0, -44, 2.6)
      if (det >= 1) { for (let i = 0; i < 5; i++) dot(rr(-16, 16), rr(-38, -30), 0.45); flushDots() }
    },
    // 7: a small coffin with a wreath on the lid
    () => {
      coffinLid(0, 2, 0.62, 0.02, { h: 5, cross: false })
      ring(0, -6, 4.2, 7.6, P.green, { w: 0.6 })
      if (det >= 1) { ctx.save(); ctx.beginPath(); sub(ellP(0, -6, 7.8)); sub(ellP(0, -6, 4)); ctx.clip('evenodd'); ctx.beginPath(); for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU; ctx.moveTo(cos(a) * 4.2, -6 + sin(a) * 4.2); ctx.quadraticCurveTo(cos(a + 0.3) * 6, -6 + sin(a + 0.3) * 6, cos(a + 0.15) * 7.8, -6 + sin(a + 0.15) * 7.8) } ctx.lineWidth = px(0.5); ctx.strokeStyle = INK; ctx.stroke(); ctx.restore() }
      for (const [x, y] of [[-4, -11], [5, -2], [6, -10]]) { const c = ellP(x, y, 1.4, 1.4, 0, 6); paper(c); if (COL) tint(c, P.red, 0.8); pen(c, 0.5, { flat: true }) }
    },
  ]
  reg('dg-coffin', 'Coffin', 'dg-furnishings', 'fixed', coffins)

  /* =====================================================================================================
     Bookshelf: against a wall along y = -12, books facing +y. x in [-48, 48], y in [-12, 12].
     ===================================================================================================== */
  /** Shelf carcass: back board along the wall, two ends, dividers; returns the bays [u0, u1] in design x. */
  function shelfFrame(x0, x1, yBack, depth, bays, o) {
    o = o || {}
    const w = x1 - x0, cx = (x0 + x1) / 2, body = rectP(cx, yBack + depth / 2, w, depth, 0)
    if (o.h !== 0) shadow(body, o.h == null ? 7 : o.h)
    paper(body); if (COL) tint(body, o.floor || P.woodX, 0.55)
    if (!COL && det >= 1) hatchIn(body, -0.79, 2.6, 0.4)
    const t = o.t || 3, parts = [rectP(cx, yBack + t / 2, w, t, 0), rectP(x0 + t / 2, yBack + depth / 2, t, depth, 0), rectP(x1 - t / 2, yBack + depth / 2, t, depth, 0)]
    const out = [], bw = (w - t) / bays
    for (let i = 1; i < bays; i++) parts.push(rectP(x0 + bw * i + t / 2, yBack + depth / 2, t, depth, 0))
    for (let i = 0; i < bays; i++) out.push([x0 + bw * i + t + 0.4, x0 + bw * (i + 1) - 0.4])
    for (const p of parts) { paper(p); if (COL) tone(p, o.col || P.woodD, 0.6); pen(p, 0.8, { flat: true, noCorner: true }) }
    if (det >= 2) { for (const p of parts.slice(1)) { const b = bbox(p); nail((b.x0 + b.x1) / 2, b.y0 + 2); nail((b.x0 + b.x1) / 2, b.y1 - 2) } flushDots() }
    pen(body, 1.3)
    return out
  }
  const bookshelves = [
    // 0: full shelves
    () => { const bays = shelfFrame(-48, 48, -12, 22, 2); const f = F(0, 0, 0); for (const [u0, u1] of bays) books(f, u0, u1, -9, 17, { gap: 0.02 }) },
    // 1: half empty, fallen books on the floor in front
    () => {
      const bays = shelfFrame(-48, 48, -12, 16, 2), f = F(0, 0, 0)
      books(f, bays[0][0], bays[0][1], -9, 12, { gap: 0.03 })
      books(f, bays[1][0], bays[1][0] + 14, -9, 12, { gap: 0 }); const p = [f(bays[1][0] + 15, -9), f(bays[1][0] + 17.5, -9), f(bays[1][0] + 24, 2.5), f(bays[1][0] + 21.5, 2.5)]; paper(p); if (COL) tone(p, P.blue, 0.6); pen(p, 0.55, { flat: true, noCorner: true })
      bookFlat(14, 9, 9, 6, 0.3, P.red); bookFlat(30, 8, 10, 6.5, -0.5, P.green, true); bookFlat(40, 8.5, 8, 5.5, 0.9, P.plum); bookFlat(-30, 9, 9, 6, 0.1, P.ochre)
      if (det >= 1) { for (let i = 0; i < 5; i++) dot(rr(-10, 44), rr(5, 11), 0.4); flushDots() }
    },
    // 2: scroll rack
    () => {
      const body = rectP(0, 0, 96, 24, 0); shadow(body, 7); paper(body); if (COL) tint(body, P.woodD, 0.6)
      const cols = 9, cw = 92 / cols
      for (let i = 0; i < cols; i++) for (const row of [0, 1]) {
        const x = -46 + cw * (i + 0.5), y = -6 + row * 12, cell = rectP(x, y, cw - 1.6, 10.6, 0)
        hollow(cell, { sd: 2.5, col: P.woodX, a: 0.7 })
        if ((i * 7 + row * 3) % 5 !== 1) { const sc = i % 3 === 1; scroll(x + j(0.4), y + j(0.3), 9.2, sc ? 2.6 : 3.4, PI / 2 + j(0.08), sc ? P.canvasD : P.cloth) }
        pen(cell, 0.6, { flat: true, swell: 0.2, noCorner: true })
      }
      if (det >= 1) shadeIn(body, 4, { gap: 2.3 }); pen(body, 1.3)
    },
    // 3: toppled shelf
    () => {
      const ang = 0.05, f = F(0, 2, ang), body = rectP(0, 2, 94, 20, ang); shadow(body, 3)
      paper(body); if (COL) tint(body, P.wood, 0.6)
      // the carcass lying flat: back board and three shelves now seen edge-on, one broken
      plankRect(0, 2, 94, 20, ang, { pw: 5, n: 4, nails: false, seed: 1, cols: [P.wood, P.woodL, P.wood] })
      const brk = [f(-10, -10), f(-6, -10), f(-3, -3), f(-8, 1), f(-4, 10), f(-12, 10), f(-9, 3), f(-13, -4)]; hollow(brk, { sd: 2 }); pen(brk, 0.8, { wob: 1.2 })
      pen(body, 1.3)
      for (const p of [[-40, -7, 0.4, P.red], [-30, -9, -0.3, P.blue], [-22, 6, 1.1, P.green], [20, -8, 0.2, P.plum], [30, 6, -0.9, P.ochre], [40, -4, 0.5, P.leather]]) bookFlat(p[0], p[1], 8.5, 5.8, p[2], p[3], p[2] > 1)
      bookFlat(6, 7, 9, 6, 2.2, P.red); if (det >= 1) { for (let i = 0; i < 6; i++) dot(rr(-44, 44), rr(-11, 11), 0.4); flushDots() }
    },
    // 4: potion shelf with bottles
    () => {
      const bays = shelfFrame(-48, 48, -12, 22, 3)
      const cols = [P.green, P.blue, P.red, P.plum, P.ochre, P.glass, P.water]
      let i = 0
      for (const [u0, u1] of bays) { for (let x = u0 + 3.6; x < u1 - 3; x += 7) for (const y of [-4.5, 4.5]) { if ((i * 7) % 11 === 3) { i++; continue } bottle(x + j(0.6), y + j(0.6), rr(2.6, 3.3), cols[i % cols.length]); i++ } }
      const jar = ellP(-36, 0, 4.4); if (st.shadows) shadow(jar, 3); paper(jar); if (COL) tint(jar, P.glass, 0.6); pen(jar, 0.9); pen(ellP(-36, 0, 3.2), 0.5, { flat: true }); if (det >= 1) stipIn(ellP(-36, 0, 3), 8, 0.5)
    },
    // 5: dusty, with a cobweb
    () => {
      const bays = shelfFrame(-48, 48, -12, 22, 2, { col: P.woodD }); const f = F(0, 0, 0)
      books(f, bays[0][0], bays[0][1], -9, 17, { gap: 0.1, cols: [P.canvasD, P.woodD, P.cloth, P.leather, P.canvasD] })
      books(f, bays[1][0] + 10, bays[1][1], -9, 17, { gap: 0.14, cols: [P.canvasD, P.cloth, P.woodD, P.canvasD] })
      if (det >= 1) { cobweb(45, -10, 17, PI / 2 + 0.05, PI - 0.05); cobweb(1.6, -10, 11, 0.05, PI / 2 - 0.05) }
      if (det >= 1) { ctx.save(); clipTo(rectP(0, 0, 92, 20, 0)); ctx.beginPath(); for (let q = 0; q < (det >= 2 ? 60 : 25); q++) { const x = rr(-46, 46), y = rr(-10, 10), s2 = 0.35 / k * lw; ctx.moveTo(x + s2, y); ctx.arc(x, y, s2, 0, TAU) } ctx.fillStyle = INK; ctx.globalAlpha = 0.6; ctx.fill(); ctx.restore(); ctx.globalAlpha = 1 }
    },
    // 6: double-sided, free-standing
    () => {
      const body = rectP(0, 0, 96, 24, 0); shadow(body, 8); paper(body); if (COL) tint(body, P.woodX, 0.55); if (!COL && det >= 1) hatchIn(body, -0.79, 2.6, 0.4)
      const parts = [rectP(0, 0, 96, 3, 0), rectP(-46.5, 0, 3, 24, 0), rectP(46.5, 0, 3, 24, 0), rectP(0, 0, 3, 24, 0)]
      for (const p of parts) { paper(p); if (COL) tone(p, P.woodD, 0.6); pen(p, 0.8, { flat: true, noCorner: true }) }
      pen(body, 1.3)
      const f = F(0, 0, 0), g = F(0, 0, PI)
      for (const [u0, u1] of [[-44.6, -1.9], [1.9, 44.6]]) { books(f, u0, u1, 1.5, 9.5, { gap: 0.04 }); books(g, -u1, -u0, 1.5, 9.5, { gap: 0.04, seed: 3 }) }
    },
    // 7: tall bookcase with a ladder
    () => {
      const bays = shelfFrame(-48, 48, -12, 22, 3, { h: 12 }); const f = F(0, 0, 0)
      for (const [u0, u1] of bays) books(f, u0, u1, -9, 17, { gap: 0.03 })
      // a ladder leaning against the case: two rails running toward the wall, rungs across, a long shadow
      const lf = F(22, 2, -0.08), rails = [bar(lf(-4.5, -11), lf(-4.5, 11), 2.2), bar(lf(4.5, -11), lf(4.5, 11), 2.2)]
      if (st.shadows) castPoly(hull2(rectP(22, 2, 11, 22, -0.08), 9, 11))
      for (let i = 0; i < 4; i++) { const v = -8 + i * 5.4, rg = bar(lf(-4.5, v), lf(4.5, v), 1.8); obj(rg, { h: 0, col: P.woodL, a: 0.75, shade: 0, line: 0.7, flat: true }) }
      for (const rl of rails) obj(rl, { h: 0, col: P.wood, a: 0.75, shade: 0, line: 0.9, flat: true })
    },
  ]
  reg('dg-bookshelf', 'Bookshelf', 'dg-furnishings', 'fixed', bookshelves)

  /* =====================================================================================================
     Bed: one square wide, two long, headboard at -y. x in [-24, 24], y in [-48, 48].
     ===================================================================================================== */
  /** Wooden bed frame with a headboard (tall, long shadow) and footboard; returns the mattress rectangle. */
  function bedFrame(w, h, o) {
    o = o || {}
    const body = rectP(0, 0, w, h, 0); shadow(body, o.h == null ? 6 : o.h)
    paper(body); if (COL) tint(body, o.col || P.wood, 0.65)
    const head = rectP(0, -h / 2 + 2.5, w + 2, 5, 0), foot = rectP(0, h / 2 - 2, w + 1, 4, 0)
    if (st.shadows && o.headH !== 0) castPoly(hull2(head, (o.headH || 12) * 0.66, (o.headH || 12) * 0.8))
    const inner = rectP(0, 0.5, w - 6, h - 9, 0)
    paper(inner); if (COL) tint(inner, o.mattress || P.canvas, 0.6)
    if (det >= 1 && o.rails !== false) { ctx.beginPath(); for (const sg of [-1, 1]) { ctx.moveTo(sg * (w / 2 - 1.5), -h / 2 + 5); ctx.lineTo(sg * (w / 2 - 1.5), h / 2 - 4) } ctx.lineWidth = px(0.45); ctx.strokeStyle = INK; ctx.stroke() }
    board(foot, { col: P.woodD, a: 0.7, shade: 0, line: 0.9, grain: false })
    board(head, { col: P.woodD, a: 0.75, sd: 1.5, line: 1.1, n: 2 })
    if (det >= 2 && o.finials !== false) for (const sg of [-1, 1]) ball(sg * (w / 2 + 0.5), -h / 2 + 2.5, 2.2, P.woodD, { line: 0.7 })
    pen(body, 1.4)
    return inner
  }
  const pillow = (x, y, w, h, ang, col) => { const p = rrect(x, y, w, h, h * 0.4, ang); obj(p, { h: 2, col: col || P.cloth, a: 0.8, sd: h * 0.3, line: 1 }); if (det >= 1) { const f = F(x, y, ang); line([f(-w * 0.3, -h * 0.1), f(0, h * 0.15), f(w * 0.3, -h * 0.05)], 0.5, { taper: 0.8, wob: 0.6 }) } }
  /** Blanket over the lower part of the bed; fold = turned-down top edge. */
  function blanketOn(w, y0, y1, col, o) {
    o = o || {}
    const f = F(0, 0, 0)
    const raw = [[-w / 2, y0], [w / 2, y0], [w / 2, y1], [-w / 2, y1]]
    const dense = densify(raw, true, 5).map(([u, v], i) => f(u + sin(i * 1.3) * 0.5 + j(0.5), v + cos(i * 1.9) * 0.4 + j(0.5)))
    obj(dense, { h: 1.5, col: col || P.red, a: 0.7, sd: 5, line: 1.2 })
    ctx.save(); clipTo(dense)
    if (o.fold !== 0) { const fd = o.fold || 7, fp = [[-w / 2, y0], [w / 2, y0], [w / 2, y0 + fd], [-w / 2, y0 + fd]]; paper(fp); if (COL) tint(fp, o.foldCol || P.cloth, 0.7); else if (det >= 1) hatchIn(fp, 0.3, 2, 0.4); rule([-w / 2, y0 + fd], [w / 2, y0 + fd], 0.8, { over: 0 }) }
    if (o.stripes) { for (let i = 0; i < o.stripes; i++) { const y = y0 + 12 + i * 7, sp = [[-w / 2, y], [w / 2, y], [w / 2, y + 2.5], [-w / 2, y + 2.5]]; if (COL) tone(sp, o.stripeCol || P.canvas, 0.6); else if (det >= 1) hatchIn(sp, PI / 2, 1.8, 0.35); rule([-w / 2, y], [w / 2, y], 0.5, { over: 0 }); rule([-w / 2, y + 2.5], [w / 2, y + 2.5], 0.5, { over: 0 }) } }
    if (det >= 1) for (let i = 0; i < (o.wrinkles == null ? 4 : o.wrinkles); i++) { const u = rr(-w * 0.4, w * 0.4), v = rr(y0 + 10, y1 - 6), l = rr(6, 14), a = rr(-0.5, 0.5) + PI / 2; line([[u, v], [u + cos(a) * l * 0.5 + j(1), v + sin(a) * l * 0.5], [u + cos(a) * l + j(1.5), v + sin(a) * l]], 0.55, { taper: 0.8, wob: 0.5 }) }
    ctx.restore()
    return dense
  }
  const beds = [
    // 0: straw pallet
    () => {
      const pal = blob(0, 2, 20, 42, 0, 16, 0.06, 3)
      obj(pal, { h: 3, col: P.straw, a: 0.6, sd: 6, line: 1.2, wob: 1.6 })
      strawFill(pal, det >= 2 ? 160 : det >= 1 ? 70 : 25, COL ? P.strawD : INK, 6)
      if (det >= 1) { ctx.beginPath(); for (let i = 0; i < pal.length; i += 2) { const p = pal[i]; if (r() < 0.5) { const dx = p[0], dy = p[1] - 2, d = hypot(dx, dy) || 1; ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0] + (dx / d) * rr(1.5, 3.5) + j(0.6), p[1] + (dy / d) * rr(1.5, 3.5) + j(0.6)) } } ctx.lineWidth = px(0.5); ctx.strokeStyle = INK; ctx.stroke() }
      blanketOn(34, -4, 40, P.canvasD, { fold: 0, wrinkles: 3 })
      pillow(0, -30, 26, 10, 0.05, P.canvasD)
    },
    // 1: wooden bed, blanket and pillow
    () => { bedFrame(46, 94); blanketOn(40, -16, 42, P.red, { fold: 7 }); pillow(0, -32, 30, 11, 0) },
    // 2: slept in, rumpled
    () => {
      bedFrame(46, 94)
      blanketOn(40, -12, 42, P.blue, { fold: 0, wrinkles: 7 })
      // the corner thrown back shows the pale underside
      const fp = [[20, -12], [20, 12], [0, 2], [-2, -12]]; obj(jig(fp, 0.4), { h: 1, col: P.cloth, a: 0.8, sd: 2, line: 1 }); if (det >= 1) hatchIn(fp, 0.8, 2.2, 0.4)
      pillow(-3, -31, 30, 11, 0.22); if (det >= 1) line([[-16, -22], [-8, -24], [2, -21]], 0.5, { taper: 0.8 })
    },
    // 3: camp cot: canvas on crossed wooden poles
    () => {
      const body = rectP(0, 0, 40, 92, 0); shadow(body, 5)
      const cv = densify([[-18, -44], [18, -44], [18, 44], [-18, 44]], true, 6).map(([x, y], i) => [x + sin(i * 1.7) * 0.4 + j(0.4), y + j(0.4)])
      obj(cv, { h: 0, col: P.canvas, a: 0.7, sd: 5, line: 1.1 })
      if (det >= 1) { ctx.save(); clipTo(cv); ctx.beginPath(); for (let y = -40; y < 44; y += 8) { ctx.moveTo(-18, y); ctx.lineTo(18, y + j(0.5)) } ctx.lineWidth = px(0.35); ctx.strokeStyle = INK; ctx.globalAlpha = 0.5; ctx.stroke(); ctx.restore(); ctx.globalAlpha = 1 }
      for (const sg of [-1, 1]) { const pl = bar([sg * 19, -46], [sg * 19, 46], 3); obj(pl, { h: 0, col: P.wood, a: 0.75, shade: 0, line: 1, flat: true }) }
      for (const y of [-40, 40]) { const pl = bar([-21, y], [21, y], 3); obj(pl, { h: 0, col: P.woodD, a: 0.75, shade: 0, line: 1, flat: true }) }
      const fold = rrect(0, 32, 30, 14, 2, 0.03); obj(fold, { h: 2, col: P.canvasD, a: 0.7, sd: 3, line: 1 }); if (det >= 1) { rule([-15, 29], [15, 29], 0.5, { over: 0 }); rule([-15, 35], [15, 35], 0.5, { over: 0 }) }
      pillow(0, -32, 22, 9, 0.02, P.canvasD)
    },
    // 4: four-poster with a canopy frame
    () => {
      for (const [x, y] of [[-22, -46], [22, -46], [-22, 46], [22, 46]]) post(x, y, 5.5, 22, P.woodD)
      bedFrame(42, 90, { headH: 0, finials: false })
      blanketOn(36, -18, 40, P.plum, { fold: 7, foldCol: P.cloth })
      pillow(-8, -31, 16, 10, 0.05); pillow(9, -31, 16, 10, -0.05)
      // the tester rails joining the posts, with a scalloped valance along the open sides
      for (const [a, b, out] of [[[-22, -46], [22, -46], -1], [[22, -46], [22, 46], -1], [[22, 46], [-22, 46], -1], [[-22, 46], [-22, -46], -1]]) { line([a, b], 1.5, { taper: 0.1, wob: 0.3 }); if (det >= 1) line(scal(a, b, 8, 2.2, out, 4), 0.6, { taper: 0.1, wob: 0.4 }) }
    },
    // 5: prison cot with a chain
    () => {
      const body = rectP(2, 0, 36, 90, 0); shadow(body, 4)
      paper(body); if (COL) tint(body, P.iron, 0.45); else if (det >= 1) hatchIn(body, -0.79, 2.8, 0.4)
      const pad = rrect(2, 1, 30, 82, 2, 0); obj(pad, { h: 0, col: P.canvasD, a: 0.55, sd: 4, line: 1 })
      if (det >= 1) { stain(4, 10, 7, 5, P.earthD, 25); line([[-6, -10], [-2, 6]], 0.5, { taper: 0.8 }); line([[8, 14], [10, 30]], 0.5, { taper: 0.8 }) }
      pen(body, 1.3)
      for (const y of [-44, 44]) ironLine([-16, y], [20, y], 2.6)
      ringFlat(-18, -36, 2.4, 1.3); chain([-18, -34], [-22, -6], 3.2); chain([-22, -6], [-14, 18], 3.2); ringFlat(-13, 21, 3.6, 1.3)
      if (det >= 1) { const sh = rrect(-13, 21, 6, 3, 1.2, 0.4); obj(sh, { col: P.iron, a: 0.7, shade: 0, line: 0.8 }) }
    },
    // 6: fur-covered bed
    () => {
      bedFrame(46, 94)
      pelt(0, 4, 44, 78, PI / 2, P.fur, { h: 2 })
      pillow(0, -32, 28, 11, 0.03, P.leather)
    },
    // 7: rotted bed
    () => {
      const body = rectP(0, 0, 46, 94, 0); shadow(body, 4)
      paper(body); if (COL) tint(body, P.woodD, 0.5)
      // slats with gaps, the dark floor between them
      hollow(rectP(0, 2, 36, 80, 0), { sd: 4 })
      for (let i = 0; i < 9; i++) { if (i === 3 || i === 6) continue; const y = -34 + i * 9.4, sl = rectP(j(1), y, 36 - (i === 4 ? 10 : 0), 5.5, j(0.03)); board(sl, { col: [P.wood, P.woodD][i % 2], a: 0.6, shade: 0, line: 0.8, grain: det >= 3 }) }
      const half = [[-18, -30], [2, -29], [6, -22], [-2, -16], [8, -8], [4, 10], [-6, 16], [-18, 14]]; obj(jig(half, 0.4), { h: 0, col: P.canvasD, a: 0.5, sd: 3, line: 0.9, wob: 1.4 }); strawFill(half, det >= 2 ? 40 : 15, COL ? P.strawD : INK, 4)
      for (const sg of [-1, 1]) { const rl = bar([sg * 21.5, -40], [sg * 21.5, 44], 3); obj(rl, { h: 0, col: P.woodD, a: 0.7, shade: 0, line: 0.9, flat: true }) }
      const hb = [[-24, -47], [24, -47], [24, -42], [8, -42], [4, -45], [-2, -42], [-24, -42]]; board(hb, { col: P.woodD, a: 0.7, sd: 1.5, line: 1.1, n: 2 })
      const fb = bar([-23, 45], [12, 45], 4); obj(fb, { h: 0, col: P.woodD, a: 0.7, shade: 0, line: 0.9, flat: true })
      if (det >= 1) { cobweb(-22, -42, 12, 0.05, PI / 2 - 0.05); if (COL) tint(blob(8, 20, 7, 10, 0.2, 8, 0.25, 3), P.green, 0.3) }
      pen(body, 1.3, { wob: 1.4 })
    },
  ]
  reg('dg-bed', 'Bed', 'dg-furnishings', 'fixed', beds)

  /* =====================================================================================================
     Throne: seat facing +y, tall back at -y. s = 90.
     ===================================================================================================== */
  /** Seat, two arms and a tall back (long shadow). sc scales the whole chair. */
  function throneBase(sc, o) {
    o = o || {}
    const seat = rectP(0, 6 * sc, 38 * sc, 34 * sc, 0), back = rectP(0, -18 * sc, 46 * sc, 10 * sc, 0)
    const arms = [-1, 1].map((sg) => rectP(sg * 21 * sc, 2 * sc, 7 * sc, 36 * sc, 0))
    if (st.shadows) { castPoly(hull2(back, 14 * sc, 17 * sc)); for (const a of arms) shadow(a, 7 * sc); shadow(seat, 4 * sc) }
    const col = o.col || P.stone
    obj(seat, { h: 0, col: o.seatCol || col, a: 0.7, sd: 5 * sc, line: 1.3 })
    if (o.cushion) { const cu = rrect(0, 7 * sc, 28 * sc, 24 * sc, 4 * sc, 0); obj(cu, { h: 0, col: o.cushion, a: 0.65, sd: 4 * sc, line: 0.9 }); if (det >= 1) { solidDot(0, 7 * sc, 0.8, INK); line([[-6 * sc, 3 * sc], [-2 * sc, 7 * sc], [-6 * sc, 11 * sc]], 0.5, { taper: 0.8 }); line([[6 * sc, 3 * sc], [2 * sc, 7 * sc], [6 * sc, 11 * sc]], 0.5, { taper: 0.8 }) } }
    for (const a of arms) obj(a, { h: 0, col, a: 0.7, sd: 2.5 * sc, line: 1.1 })
    if (o.knobs !== false) for (const sg of [-1, 1]) ball(sg * 21 * sc, 19 * sc, 3.6 * sc, o.knobCol || col, { line: 0.9 })
    obj(back, { h: 0, col: o.backCol || col, a: 0.75, sd: 3 * sc, line: 1.3 })
    return { seat, back, arms }
  }
  const thronesRaw = [
    // 0: carved stone throne
    () => {
      const t = throneBase(1, { col: P.stone })
      if (det >= 1) { pen(rectP(0, 6, 30, 26, 0), 0.5, { flat: true, swell: 0.3 }); runeRow([-18, -18], [18, -18], 4.5, 7, 0.6) }
      if (det >= 2) { stipIn(t.seat, 12, 0.5); ctx.beginPath(); for (let x = -22; x <= 22; x += 5.5) { ctx.moveTo(x, -23); ctx.lineTo(x, -21) } ctx.lineWidth = px(0.5); ctx.strokeStyle = INK; ctx.stroke() }
    },
    // 1: wooden high seat with finials
    () => {
      for (const sg of [-1, 1]) post(sg * 23, -18, 5, 12)
      const t = throneBase(1, { col: P.wood, backCol: P.woodD, seatCol: P.woodL, knobCol: P.woodD })
      if (det >= 1) { ctx.beginPath(); for (const x of [-9, 0, 9]) { ctx.moveTo(x, -10); ctx.lineTo(x + j(0.3), 22) } ctx.lineWidth = px(0.5); ctx.strokeStyle = INK; ctx.stroke() }
      if (det >= 2) { ctx.save(); clipTo(t.back); ctx.beginPath(); for (let x = -20; x < 20; x += 6.5) { ctx.moveTo(x, -22.5); ctx.lineTo(x + 3, -13.5) } ctx.lineWidth = px(0.4); ctx.strokeStyle = INK; ctx.stroke(); ctx.restore() }
    },
    // 2: bone throne
    () => {
      const t = throneBase(1, { col: P.boneD, seatCol: P.bone, knobs: false })
      ctx.save(); clipTo(t.seat); furIn(t.seat, F(0, 6, 0), 19, 17, det >= 2 ? 60 : 25); ctx.restore(); pen(t.seat, 1.2)
      // the back is a fan of long bones; skulls cap the arms
      for (let i = 0; i < 7; i++) { const a = -PI / 2 + (i - 3) * 0.26, L = 11 + (3 - abs(i - 3)) * 2; bone([(i - 3) * 6, -14], [(i - 3) * 6 + cos(a) * L, -14 + sin(a) * L], 2.2) }
      for (const sg of [-1, 1]) { skull(sg * 21, 19, 4.4, 0); bone([sg * 21, -14], [sg * 21, 14], 2) }
      if (det >= 1) { for (const [x, y] of [[-12, -4], [10, 12]]) bone([x, y], [x + 8, y + 3], 1.5) }
    },
    // 3: gilded, with a cushion
    () => {
      throneBase(1, { col: P.brass, cushion: P.red, knobCol: P.gold })
      if (det >= 1) { pen(rectP(0, -18, 40, 6, 0), 0.5, { flat: true, swell: 0.3 }); for (let i = 0; i < 5; i++) { const x = -16 + i * 8, g = ellP(x, -18, 1.6, 1.6, 0, 6); paper(g); if (COL) tint(g, [P.red, P.blue, P.green][i % 3], 0.85); pen(g, 0.5, { flat: true }) } }
      if (det >= 2) { ctx.beginPath(); for (let x = -22; x <= 22; x += 4) { ctx.moveTo(x, -23); ctx.lineTo(x, -25.5) } ctx.lineWidth = px(0.6); ctx.strokeStyle = INK; ctx.stroke() }
    },
    // 4: broken throne
    () => {
      const seat = [[-19, -11], [19, -11], [19, 10], [10, 14], [12, 23], [-19, 23]]; shadow(seat, 4)
      const back = [[-23, -23], [8, -23], [10, -15], [4, -13], [-23, -13]]; if (st.shadows) castPoly(hull2(back, 12, 15))
      const arm = rectP(-21, 2, 7, 36, 0); shadow(arm, 7)
      stoneTop(seat, { h: 0, col: P.stone, sd: 5, line: 1.3, stip: 14 }); crack([-8, -11], [2, 4], 0.8, 1.6); crack([2, 4], [-4, 23], 0.6, 1.4)
      obj(arm, { h: 0, col: P.stone, a: 0.7, sd: 2.5, line: 1.1 }); ball(-21, 19, 3.6, P.stone, { line: 0.9 })
      // the other arm lies broken on the floor
      const fallen = rot(rectP(25, 16, 7, 22, 0), 25, 16, 0.9); obj(fallen, { h: 3, col: P.stoneL, a: 0.7, sd: 2.5, line: 1.1 })
      stoneTop(back, { h: 0, col: P.stone, sd: 3, line: 1.3, stip: 8 })
      rubble([[20, -20, 3.2, 2.4], [24, -10, 2.4, 2], [30, 2, 2.6, 2], [16, 28, 2, 1.6]])
    },
    // 5: on a round dais
    () => {
      stoneTop(blob(0, 0, 46, 46, 0, 18, 0.015, 3), { h: 3, col: P.stoneL, sd: 7, line: 1.4, stip: 20 })
      stoneTop(blob(0, 0, 36, 36, 0, 16, 0.015, 3), { h: 3, col: P.stone, sd: 6, line: 1.3, stip: 14 })
      if (det >= 1) { ctx.beginPath(); for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + 0.1; ctx.moveTo(cos(a) * 37, sin(a) * 37); ctx.lineTo(cos(a) * 45, sin(a) * 45) } ctx.lineWidth = px(0.5); ctx.strokeStyle = INK; ctx.stroke() }
      throneBase(0.95, { col: P.stoneD, cushion: P.red })
    },
    // 6: iron throne of blades
    () => {
      // the back and arms bristle with sword blades; their shadow is long and spiky
      const spikes = []; for (let i = 0; i < 11; i++) { const x = -23 + i * 4.6; spikes.push([x, -13]); spikes.push([x + 2.3, -23 - (i % 3) * 4 - (i % 2) * 2]) } spikes.push([24, -13])
      if (st.shadows) castPoly(hull2(spikes, 14, 17))
      throneBase(1, { col: P.iron, seatCol: P.iron, knobs: false })
      paper(spikes); if (COL) tint(spikes, P.iron, 0.6); else if (det >= 1) hatchIn(spikes, 1.2, 1.8, 0.45); pen(spikes, 1.2, { wob: 0.4 })
      if (det >= 1) { ctx.beginPath(); for (let i = 0; i < 11; i++) { const x = -23 + i * 4.6 + 2.3; ctx.moveTo(x, -14); ctx.lineTo(x, -21 - (i % 3) * 4) } ctx.lineWidth = px(0.45); ctx.strokeStyle = COL ? P.stoneL : INK; ctx.stroke() }
      for (const sg of [-1, 1]) { for (let i = 0; i < 4; i++) { const y = -10 + i * 8, bl = [[sg * 18, y], [sg * 27, y + 1.5], [sg * 18, y + 3]]; paper(bl); if (COL) tone(bl, P.stoneL, 0.6); pen(bl, 0.6, { flat: true }) } }
    },
    // 7: chieftain's chair with furs
    () => {
      throneBase(0.84, { col: P.woodD, seatCol: P.wood, knobs: false })
      pelt(0, 2, 30, 46, PI / 2, P.fur, { h: 1.5, n: det >= 2 ? 80 : 30 })
      if (det >= 1) { for (const sg of [-1, 1]) line([[sg * 8, -19], [sg * 14, -26], [sg * 12, -31]], 1.1, { taper: 0.3, wob: 0.4 }); line([[-10, -20], [10, -20]], 0.8, { taper: 0.2 }) }
    },
  ]
  // the chair itself is designed about 48 units wide; drawn half as big again so a throne fills most of its square
  const thrones = thronesRaw.map((fn, i) => () => scaled(i === 5 ? 1 : 1.5, fn))
  reg('dg-throne', 'Throne', 'dg-furnishings', 'fixed', thrones)

  /* =====================================================================================================
     Cage: iron bars seen from above, the floor showing through. s = 120.
     ===================================================================================================== */
  /** Square cage: the floor inside, a grid of bars, a heavy frame with rivets. skip = [[i, side], ...] bars left out. */
  function cageSq(cx, cy, w, h, n, o) {
    o = o || {}
    const body = rectP(cx, cy, w, h, 0), f = F(cx, cy, 0)
    shadow(body, o.h == null ? 10 : o.h)
    paper(body); if (COL) tint(body, o.floor || P.earth, 0.22); if (det >= 1) stipIn(body, det >= 2 ? 40 : 14, 0.45)
    if (o.inside) { ctx.save(); clipTo(rectP(cx, cy, w - 4, h - 4, 0)); o.inside(f); ctx.restore() }
    const bw = o.bw || 1.9, skip = o.skip || []
    for (let i = 1; i < n; i++) {
      const u = -w / 2 + (w * i) / n, v = -h / 2 + (h * i) / n
      if (!skip.some((s) => s[0] === i && s[1] === 'v')) ironLine(f(u, -h / 2), f(u, h / 2), bw)
      if (!skip.some((s) => s[0] === i && s[1] === 'h')) ironLine(f(-w / 2, v), f(w / 2, v), bw)
    }
    if (o.after) o.after(f)
    const fr = o.frame || 4
    for (const [a, b] of [[f(-w / 2, -h / 2), f(w / 2, -h / 2)], [f(w / 2, -h / 2), f(w / 2, h / 2)], [f(w / 2, h / 2), f(-w / 2, h / 2)], [f(-w / 2, h / 2), f(-w / 2, -h / 2)]]) { const q = bar(a, b, fr); paper(q); if (COL) tone(q, P.iron, 0.7); else if (det >= 1) hatchIn(q, 0.9, 1.6, 0.45, { minG: 1.2 }); pen(q, 0.9, { flat: true, noCorner: true }) }
    if (det >= 2) { for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { nail(...f(u * (w / 2), v * (h / 2))); nail(...f(u * w * 0.25, v * (h / 2))); nail(...f(u * (w / 2), v * h * 0.25)) } flushDots(null, 1.3) }
    return body
  }
  const cages = [
    // 0: square cage, empty, padlocked
    () => { cageSq(0, 0, 80, 80, 4); const pl = ellP(0, 43, 3.6); obj(pl, { h: 2, col: P.brass, a: 0.8, sd: 2, line: 1 }); const pk = rrect(0, 37.5, 5.5, 6, 1.5, 0); obj(pk, { col: P.iron, a: 0.8, shade: 0, line: 0.9 }); solidDot(0, 43.5, 0.9, INK) },
    // 1: with straw and a bowl
    () => cageSq(0, 0, 80, 80, 4, { inside: () => { const s = blob(-6, 8, 26, 20, 0.3, 10, 0.2, 3); if (COL) tint(s, P.straw, 0.5); strawFill(s, det >= 2 ? 120 : 45, COL ? P.strawD : INK, 6); bowl(20, -18, 6, P.woodD, (inn) => { if (COL) tint(inn, P.waterD, 0.6); else hatchIn(inn, 0.2, 1.6, 0.4, { minG: 1.2 }) }) } }),
    // 2: round hanging cage, chain to the middle
    () => {
      const R = 38, body = ellP(0, 0, R); shadow(body, 18)
      paper(body); if (COL) tint(body, P.earth, 0.2); if (det >= 1) stipIn(body, 30, 0.45)
      const n = det >= 1 ? 12 : 8
      for (let i = 0; i < n; i++) { const a = (i / n) * TAU; ironLine([cos(a) * 6, sin(a) * 6], [cos(a) * R, sin(a) * R], 1.9) }
      ring(0, 0, R - 3.5, R, P.iron, { w: 1 }); if (det >= 1) ring(0, 0, R * 0.55 - 1.2, R * 0.55 + 1.2, P.iron, { w: 0.7 })
      ring(0, 0, 4, 7, P.iron, { w: 0.9 }); chain([0, -7], [-14, -30], 3.6); ringFlat(-15, -31, 2.6, 1.4)
      if (det >= 2) { for (let i = 0; i < n; i++) { const a = (i / n) * TAU; nail(cos(a) * (R - 1.7), sin(a) * (R - 1.7)) } flushDots(null, 1.2) }
    },
    // 3: door swung open
    () => {
      const w = 76, h = 76
      cageSq(-2, 0, w, h, 4, { after: (f) => {
        // the right-hand bay of the front wall is the door, missing from the frame line
        const gap = [f(w / 2 - 2.2, w * 0.25 - 0.5), f(w / 2 + 2.2, w * 0.25 - 0.5), f(w / 2 + 2.2, h / 2 + 2.2), f(w / 2 - 2.2, h / 2 + 2.2)]
        paper(gap); if (COL) tint(gap, P.earth, 0.22)
      } })
      // the door, a barred panel swung out around its hinge at the corner
      const hf = F(36, 38, 1.15), door = [hf(0, -2.5), hf(24, -2.5), hf(24, 2.5), hf(0, 2.5)]
      shadow(door, 8); paper(door); if (COL) tint(door, P.earth, 0.15)
      for (let i = 1; i < 4; i++) ironLine(hf(i * 6, -2.5), hf(i * 6, 2.5), 1.8)
      for (const v of [-2.5, 2.5]) ironLine(hf(0, v), hf(24, v), 2.4)
      ringFlat(36, 38, 2.4, 1.3); if (det >= 1) { ringFlat(...hf(22, 0), 1.8, 1) }
    },
    // 4: with a skeleton
    () => cageSq(0, 0, 80, 80, 4, { inside: () => { const f = F(-4, 2, 0.5); skeleton(f, 56, { fold: true, ang: 0.5, tilt: 0.4 }); if (det >= 1) { bone([14, -24], [26, -16], 1.8); skull(24, 20, 4, 1.2) } } }),
    // 5: small animal cage with a carrying loop
    () => {
      cageSq(0, 4, 52, 40, 6, { h: 6, frame: 3, bw: 1.3, inside: () => { bowl(14, 10, 4, P.canvasD, (inn) => { if (COL) tint(inn, P.straw, 0.5); else stipIn(inn, 8, 0.5) }); if (COL) tint(blob(-10, 4, 10, 7, 0.2, 8, 0.2, 3), P.straw, 0.45); strawFill(blob(-10, 4, 11, 8, 0.2, 8, 0.2, 3), det >= 2 ? 40 : 15, COL ? P.strawD : INK, 4) } })
      ctx.beginPath(); ctx.ellipse(0, 4, 14, 5, 0, PI, TAU); ctx.lineWidth = px(1.6); ctx.strokeStyle = INK; ctx.stroke(); if (COL) { ctx.beginPath(); ctx.ellipse(0, 4, 14, 5, 0, PI, TAU); ctx.lineWidth = px(0.7); ctx.strokeStyle = P.iron; ctx.stroke() }
      for (const sg of [-1, 1]) solidDot(sg * 14, 4, 1.2, INK)
    },
    // 6: wooden cage, poles lashed with rope
    () => {
      const w = 78, h = 78, body = rectP(0, 0, w, h, 0); shadow(body, 9)
      paper(body); if (COL) tint(body, P.earth, 0.22); if (det >= 1) stipIn(body, 30, 0.45)
      const n = 4
      for (let i = 1; i < n; i++) { const u = -w / 2 + (w * i) / n; const p1 = bar([u, -h / 2], [u, h / 2], 3); obj(p1, { h: 0, col: P.wood, a: 0.75, shade: 0, line: 0.9, flat: true }) }
      for (let i = 1; i < n; i++) { const v = -h / 2 + (h * i) / n; const p2 = bar([-w / 2, v], [w / 2, v], 3); obj(p2, { h: 0, col: P.woodL, a: 0.75, shade: 0, line: 0.9, flat: true }) }
      for (const [a, b] of [[[-w / 2, -h / 2], [w / 2, -h / 2]], [[w / 2, -h / 2], [w / 2, h / 2]], [[w / 2, h / 2], [-w / 2, h / 2]], [[-w / 2, h / 2], [-w / 2, -h / 2]]]) { const q = bar(a, b, 5); obj(q, { h: 0, col: P.woodD, a: 0.75, shade: 0, line: 1, flat: true }) }
      if (det >= 1) { ctx.beginPath(); for (let i = 0; i <= n; i++) for (let q = 0; q <= n; q++) { const x = -w / 2 + (w * i) / n, y = -h / 2 + (h * q) / n; ctx.moveTo(x - 2.6, y - 2.6); ctx.lineTo(x + 2.6, y + 2.6); ctx.moveTo(x + 2.6, y - 2.6); ctx.lineTo(x - 2.6, y + 2.6) } ctx.lineWidth = px(0.7); ctx.strokeStyle = INK; ctx.stroke() }
    },
    // 7: broken bars
    () => {
      cageSq(0, 0, 80, 80, 4, { skip: [[2, 'v'], [1, 'h']], after: (f) => {
        // the bent bars: kinked stubs where the missing ones were
        line([f(0, -40), f(0, -22), f(-5, -14), f(-3, -6)], 1.9, { taper: 0.08 }); line([f(0, 40), f(1, 24), f(7, 18)], 1.9, { taper: 0.08 })
        line([f(-40, -20), f(-24, -20), f(-16, -26), f(-10, -24)], 1.9, { taper: 0.08 }); line([f(40, -20), f(26, -21), f(20, -14)], 1.9, { taper: 0.08 })
        if (det >= 1) { const q = bar(f(16, 6), f(34, 30), 2); obj(q, { h: 2, col: P.iron, a: 0.75, shade: 0, line: 0.7, flat: true }) }
        if (det >= 1) { stipIn(rectP(-12, -18, 26, 20, 0), 24, 0.5) }
      } })
      if (det >= 1) { line([[-40, 20], [-46, 14], [-44, 6]], 1.8, { taper: 0.1 }) }
    },
  ]
  reg('dg-cage', 'Cage', 'dg-furnishings', 'fixed', cages)

  /* =====================================================================================================
     Rug: flat weave, no cast shadow. x in [-48, 48], y in [-32, 32].
     ===================================================================================================== */
  /** Flat rug: paper, wash, slightly uneven inked edge (no shade, no shadow). */
  function rugBase(pts, col, o) {
    o = o || {}
    paper(pts); if (COL) tint(pts, col, o.a || 0.6)
    if (!COL && det >= 1 && o.hatch !== false) hatchIn(pts, o.hAng == null ? 0.2 : o.hAng, 3.6, 0.3, { minG: 2.4 })
    pen(pts, o.line || 0.95, { flat: true, wob: 0.8 })
  }
  /** A band between two rectangles, toned; plus its two inked edges. */
  function band(cx, cy, w, h, d, col, o) {
    o = o || {}
    const out = rectP(cx, cy, w, h, 0), inn = rectP(cx, cy, w - 2 * d, h - 2 * d, 0)
    if (COL && col) { ctx.save(); ctx.beginPath(); sub(out); sub(inn); ctx.clip('evenodd'); tone(out, col, o.a || 0.5); ctx.restore() }
    else if (!COL && o.hatch) { ctx.save(); ctx.beginPath(); sub(out); sub(inn); ctx.clip('evenodd'); hatchBox(cx - w, cy - h, cx + w, cy + h, o.hAng == null ? 0.78 : o.hAng, o.gap || 2, 0.35, { minG: 1.5 }); ctx.restore() }
    pen(out, o.w || 0.55, { flat: true, wob: 0.5 }); pen(inn, o.w || 0.55, { flat: true, wob: 0.5 })
    return inn
  }
  const diamond = (x, y, w, h) => [[x, y - h / 2], [x + w / 2, y], [x, y + h / 2], [x - w / 2, y]]
  const fringeEnds = (x0, x1, y0, y1, len, step) => { ctx.beginPath(); for (let y = y0 + 1; y < y1; y += step || 2.4) { ctx.moveTo(x0, y); ctx.lineTo(x0 - len + j(0.4), y + j(0.6)); ctx.moveTo(x1, y); ctx.lineTo(x1 + len + j(0.4), y + j(0.6)) } ctx.lineWidth = px(0.5); ctx.strokeStyle = INK; ctx.stroke() }
  const rugs = [
    // 0: patterned border rug
    () => {
      const W = 92, H = 60; rugBase(jig(rectP(0, 0, W, H, 0), 0.4), P.red)
      band(0, 0, W - 6, H - 6, 6, P.ochre, { hatch: true })
      if (det >= 1) { for (let x = -40; x <= 40; x += 8) for (const y of [-27, 27]) { const d = diamond(x, y, 4.4, 4.4); if (COL) tone(d, P.red, 0.6); pen(d, 0.45, { flat: true, noCorner: true }) } for (let y = -18; y <= 18; y += 9) for (const x of [-43, 43]) { const d = diamond(x, y, 4.4, 4.4); if (COL) tone(d, P.red, 0.6); pen(d, 0.45, { flat: true, noCorner: true }) } }
      const med = diamond(0, 0, 36, 22); if (COL) tone(med, P.ochre, 0.5); pen(med, 0.7, { flat: true }); const med2 = diamond(0, 0, 24, 14); if (COL) tone(med2, P.red, 0.5); pen(med2, 0.5, { flat: true }); pen(ellP(0, 0, 4), 0.5, { flat: true })
      if (det >= 1) for (const [x, y] of [[-32, -14], [32, -14], [32, 14], [-32, 14]]) { pen(diamond(x, y, 7, 7), 0.5, { flat: true, noCorner: true }) }
      if (det >= 1) fringeEnds(-W / 2, W / 2, -H / 2, H / 2, 2.6)
    },
    // 1: round rug
    () => {
      const R = 31, c = ellP(0, 0, R); rugBase(c, P.blue, { hAng: 0.6 })
      ring(0, 0, R - 5, R - 1.5, COL ? P.ochre : null, { w: 0.55 })
      if (det >= 1) { ctx.beginPath(); for (let i = 0; i < 36; i++) { const a = (i / 36) * TAU; ctx.moveTo(cos(a) * (R - 5), sin(a) * (R - 5)); ctx.lineTo(cos(a) * (R - 1.5), sin(a) * (R - 1.5)) } ctx.lineWidth = px(0.4); ctx.strokeStyle = INK; ctx.stroke() }
      pen(ellP(0, 0, R * 0.55), 0.6, { flat: true, wob: 0.5 })
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; const pt = ellP(cos(a) * R * 0.3, sin(a) * R * 0.3, R * 0.2, R * 0.1, a, 10); if (COL) tone(pt, P.ochre, 0.55); pen(pt, 0.5, { flat: true, noCorner: true }) }
      pen(ellP(0, 0, R * 0.1), 0.6, { flat: true })
      if (det >= 2) { for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU + 0.2; pen(diamond(cos(a) * R * 0.76, sin(a) * R * 0.76, 3.4, 3.4), 0.4, { flat: true, noCorner: true }) } }
    },
    // 2: runner
    () => {
      const W = 94, H = 22; rugBase(jig(rectP(0, 0, W, H, 0), 0.4), P.plum)
      band(0, 0, W - 4, H - 4, 3, P.ochre, { hatch: true })
      if (det >= 1) { for (let x = -40; x <= 40; x += 10) { const d = diamond(x, 0, 7, 9); if (COL) tone(d, P.ochre, 0.55); pen(d, 0.5, { flat: true, noCorner: true }); if (det >= 2) pen(diamond(x, 0, 3, 4), 0.4, { flat: true, noCorner: true }) } }
      if (det >= 1) fringeEnds(-W / 2, W / 2, -H / 2, H / 2, 3)
    },
    // 3: bear skin
    () => {
      pelt(3, 0, 86, 58, 0, P.fur, { h: 0, shade: 0 })
      const hd = cr([[-40, -6], [-46, -8], [-49, -3], [-48, 4], [-44, 8], [-38, 7], [-36, 0]], true, 3)
      obj(hd, { h: 0, col: P.fur, a: 0.75, sd: 3, line: 1.1, wob: 1 })
      for (const sg of [-1, 1]) { const ear = ellP(-40, sg * 8.5, 2.8, 2.4, 0, 8); obj(ear, { h: 0, col: P.fur, a: 0.75, shade: 0, line: 0.8 }) }
      furIn(hd, F(-42, 0, 0), 7, 7, det >= 2 ? 30 : 12)
      solidDot(-44, -2.6, 0.9, INK); solidDot(-44, 2.6, 0.9, INK); solidDot(-48.2, 0, 1.1, INK)
      if (det >= 1) { ctx.beginPath(); for (const sg of [-1, 1]) for (let i = 0; i < 4; i++) { ctx.moveTo(-44 + i * 1.2, sg * (3.8 + i * 0.3)); ctx.lineTo(-44 + i * 1.2 + 0.6, sg * (5.8 + i * 0.3)) } ctx.lineWidth = px(0.5); ctx.strokeStyle = INK; ctx.stroke() }
    },
    // 4: worn and torn
    () => {
      const W = 90, H = 58, raw = [[-45, -29], [45, -29], [45, 20], [38, 29], [-45, 29]]
      const outer = densify(raw, true, 6).map(([x, y], i) => [x + j(0.5) + sin(i * 1.7) * 0.4, y + j(0.5)])
      const hole = blob(-12, 6, 9, 6, 0.3, 9, 0.3, 3)
      ctx.save(); ctx.beginPath(); sub(outer); sub(hole); ctx.clip('evenodd')
      rugBase(outer, P.canvasD, { line: 0 })
      band(0, 0, W - 6, H - 6, 5, P.earth, { hatch: true, gap: 2.6 })
      if (det >= 1) { for (let x = -30; x <= 30; x += 15) { const d = diamond(x, 0, 10, 12); pen(d, 0.5, { flat: true, noCorner: true }) } }
      // threadbare patches: the weave shows as fine cross lines
      for (const [x, y, rx, ry] of [[22, -12, 11, 7], [-28, -14, 8, 5], [14, 18, 9, 5]]) { const p = blob(x, y, rx, ry, 0.2, 8, 0.2, 3); if (COL) tone(p, P.cloth, 0.45); hatchIn(p, 0.05, 1.5, 0.3, { minG: 1.2 }); hatchIn(p, PI / 2 + 0.05, 1.5, 0.3, { minG: 1.2 }) }
      ctx.restore()
      pen(outer, 0.95, { flat: true, wob: 1.2 }); pen(hole, 0.8, { flat: true, wob: 1.4 })
      // loose threads at the hole and the torn corner
      if (det >= 1) { ctx.beginPath(); for (let i = 0; i < hole.length; i += 2) { const p = hole[i]; const dx = p[0] + 12, dy = p[1] - 6, d = hypot(dx, dy) || 1; ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0] - (dx / d) * rr(1.5, 3) + j(0.6), p[1] - (dy / d) * rr(1.5, 3) + j(0.6)) } for (let i = 0; i < 6; i++) { ctx.moveTo(40 + i, 29 - i * 1.4); ctx.lineTo(42 + i + j(1), 31 - i * 1.4 + j(1)) } ctx.lineWidth = px(0.5); ctx.strokeStyle = INK; ctx.stroke() }
      if (det >= 1) fringeEnds(-W / 2, W / 2, -H / 2, H / 2 - 10, 2.6, 3.2)
    },
    // 5: woven sigil
    () => {
      const W = 92, H = 62; rugBase(jig(rectP(0, 0, W, H, 0), 0.4), P.plum)
      band(0, 0, W - 5, H - 5, 2.4, P.gold, { hatch: true })
      const R = 22
      if (COL) tone(ellP(0, 0, R), P.gold, 0.4); pen(ellP(0, 0, R), 0.8, { flat: true, wob: 0.5 }); pen(ellP(0, 0, R - 2.6), 0.5, { flat: true, wob: 0.5 })
      // an eye within a star
      const star = []; for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU - PI / 2, q = i % 2 ? R * 0.5 : R * 0.86; star.push([cos(a) * q, sin(a) * q]) }
      if (COL) tone(star, P.plum, 0.5); pen(star, 0.7, { flat: true })
      const eye = cr([[-9, 0], [-4, -4.5], [4, -4.5], [9, 0], [4, 4.5], [-4, 4.5]], true, 3); if (COL) tone(eye, P.cloth, 0.6); pen(eye, 0.7, { flat: true }); pen(ellP(0, 0, 3.2), 0.6, { flat: true }); solidDot(0, 0, 1.3, INK)
      if (det >= 1) { for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; rune(cos(a) * (R + 6), sin(a) * (R + 6), 4, a + PI / 2, i * 3 + 1, 0.55, COL ? P.gold : undefined) } }
      if (det >= 1) fringeEnds(-W / 2, W / 2, -H / 2, H / 2, 2.6)
    },
    // 6: checkered
    () => {
      const W = 90, H = 60; rugBase(jig(rectP(0, 0, W, H, 0), 0.4), P.cloth, { hatch: false })
      const cols = 9, rows = 6, cw = (W - 8) / cols, ch = (H - 8) / rows
      ctx.save(); clipTo(rectP(0, 0, W - 8, H - 8, 0))
      for (let i = 0; i < cols; i++) for (let q = 0; q < rows; q++) { if ((i + q) % 2) continue; const c = rectP(-W / 2 + 4 + cw * (i + 0.5), -H / 2 + 4 + ch * (q + 0.5), cw, ch, 0); if (COL) tone(c, P.red, 0.6); else hatchIn(c, 0.78, 1.8, 0.35, { minG: 1.4 }) }
      ctx.restore()
      ctx.beginPath(); for (let i = 1; i < cols; i++) { const x = -W / 2 + 4 + cw * i; ctx.moveTo(x, -H / 2 + 4); ctx.lineTo(x + j(0.3), H / 2 - 4) } for (let q = 1; q < rows; q++) { const y = -H / 2 + 4 + ch * q; ctx.moveTo(-W / 2 + 4, y); ctx.lineTo(W / 2 - 4, y + j(0.3)) } ctx.lineWidth = px(0.4); ctx.strokeStyle = INK; ctx.stroke()
      band(0, 0, W - 2, H - 2, 3, P.red, { hatch: true, gap: 1.8 })
    },
    // 7: frayed edges with tassels
    () => {
      const W = 88, H = 58, raw = [[-44, -29], [44, -29], [44, 29], [-44, 29]]
      const outer = densify(raw, true, 4).map(([x, y], i) => [x + j(0.8) + sin(i * 2.1) * 0.6, y + j(0.8) + cos(i * 1.3) * 0.5])
      rugBase(outer, P.green)
      band(0, 0, W - 8, H - 8, 4, P.ochre, { hatch: true })
      if (det >= 1) { for (let x = -28; x <= 28; x += 14) for (const y of [-11, 11]) { const d = diamond(x, y, 8, 8); if (COL) tone(d, P.ochre, 0.5); pen(d, 0.5, { flat: true, noCorner: true }) } pen(diamond(0, 0, 14, 12), 0.6, { flat: true }) }
      // tassels: knotted cords at both ends
      for (const sg of [-1, 1]) for (let y = -26; y <= 26; y += 5.2) { const x0 = sg * 44, x1 = sg * 49 + j(0.6); line([[x0, y], [x1, y + j(1)]], 0.7, { taper: 0.1, wob: 0.6 }); solidDot(sg * 46.2, y, 0.8, INK); if (det >= 1) { line([[x1, y], [x1 + sg * 1, y - 1.5]], 0.45, { taper: 0.4 }); line([[x1, y], [x1 + sg * 1, y + 1.5]], 0.45, { taper: 0.4 }) } }
      if (det >= 2) { ctx.beginPath(); for (let i = 0; i < 14; i++) { const x = rr(-40, 40), sg = r() < 0.5 ? -1 : 1; ctx.moveTo(x, sg * 29); ctx.lineTo(x + j(1.2), sg * (30.5 + rr(0, 1.5))) } ctx.lineWidth = px(0.45); ctx.strokeStyle = INK; ctx.stroke() }
    },
  ]
  reg('dg-rug', 'Rug', 'dg-furnishings', 'fixed', rugs)

  /* =====================================================================================================
     Weapon rack: against a wall along y = -12. x in [-48, 48], y in [-14, 14].
     ===================================================================================================== */
  /** The rack itself: back rail at the wall, a front rail, end posts; returns the frame. */
  function rackFrame(x0, x1, o) {
    o = o || {}
    const w = x1 - x0, cx = (x0 + x1) / 2
    const back = rectP(cx, -10, w, 3.6, 0), front = rectP(cx, o.frontY == null ? 6 : o.frontY, w, 2.8, 0)
    if (st.shadows) { castPoly(hull2(back, 8, 10)); shadow(front, 4) }
    for (const sg of [-1, 1]) { const p = rectP(cx + sg * (w / 2 - 2.5), -2, 5, 16, 0); obj(p, { h: 5, col: P.woodD, a: 0.75, sd: 2, line: 1 }) }
    board(front, { h: 0, col: P.wood, a: 0.7, shade: 0, line: 0.9, n: 2 })
    board(back, { h: 0, col: P.woodD, a: 0.75, sd: 1.2, line: 1.1, n: 2 })
    if (det >= 2 && o.slots !== false) { ctx.beginPath(); for (let x = x0 + 8; x < x1 - 6; x += o.slot || 8) { ctx.moveTo(x, 4.8); ctx.lineTo(x, 7.2) } ctx.lineWidth = px(0.6); ctx.strokeStyle = INK; ctx.stroke() }
  }
  /** A weapon standing in the rack, foreshortened: its grip toward the room (+y), tip at the wall. */
  const stand = (x, L, fn, o) => { const f = F(x, 4 - L * 0.3, -PI / 2 + j(0.03) + (o && o.lean || 0)); fn(f, L, Object.assign({ h: 3 }, o || {})) }
  const racks = [
    // 0: swords
    () => { rackFrame(-48, 48); for (let i = 0; i < 7; i++) stand(-36 + i * 12, 30 + (i % 2) * 2, sword, { bw: 3 }) },
    // 1: spears
    () => { rackFrame(-48, 48, { slot: 7 }); for (let i = 0; i < 9; i++) stand(-40 + i * 10, 46 + (i % 3) * 3, spear) },
    // 2: axes and maces
    () => { rackFrame(-48, 48, { slot: 11 }); for (let i = 0; i < 7; i++) { const x = -36 + i * 12; if (i % 2) stand(x, 34, mace, { flanged: i === 3 }); else stand(x, 36, axe, { double: i === 2 }) } },
    // 3: shields on the wall with crossed weapons between
    () => {
      rackFrame(-48, 48, { slots: false })
      for (const [x, c, q] of [[-33, P.red, true], [0, P.blue, false], [33, P.ochre, true]]) shieldRound(x, -3, 9.5, c, { h: 3, quarter: q })
      for (const x of [-16, 16]) { const f1 = F(x - 5, 8, -PI / 2 + 0.35), f2 = F(x + 5, 8, -PI / 2 - 0.35); sword(f1, 24, { bw: 2.6, h: 2 }); sword(f2, 24, { bw: 2.6, h: 2 }) }
    },
    // 4: empty rack
    () => { rackFrame(-48, 48, { slot: 8 }); if (det >= 1) { for (const x of [-30, -6, 20]) { ball(x, -10, 1.4, P.woodD, { line: 0.6 }) } line([[26, -3], [34, 1]], 0.5, { taper: 0.6 }); for (let i = 0; i < 5; i++) dot(rr(-40, 40), rr(-6, 4), 0.4); flushDots() } },
    // 5: mixed arms
    () => { rackFrame(-48, 48, { slot: 12 }); stand(-38, 32, sword, { bw: 3 }); stand(-26, 46, spear); stand(-13, 36, axe); stand(0, 32, mace, { flanged: true }); stand(13, 30, sword, { bw: 3.4 }); stand(26, 36, axe, { double: true }); stand(39, 44, spear) },
    // 6: bows and quivers
    () => {
      rackFrame(-48, 48, { slots: false })
      for (const x of [-34, -14, 6]) { const f = F(x, -2, -PI / 2 + j(0.04)); bow(f, 24) }
      quiver(24, -2, 22, 7, -PI / 2 + 0.12); quiver(38, -1, 20, 6.5, -PI / 2 - 0.1)
      if (det >= 1) { for (let i = 0; i < 3; i++) line([[-44 + i * 2, 2 + i], [-44 + i * 2, -11]], 0.6, { taper: 0.1 }) }
    },
    // 7: armour stand in the middle
    () => {
      rackFrame(-48, -14, { slot: 8 }); rackFrame(14, 48, { slot: 8 })
      stand(-38, 30, sword, { bw: 3 }); shieldRound(-25, -3, 8, P.green, { h: 3 }); stand(26, 44, spear); stand(40, 34, axe)
      // the stand: a round base, the shoulders of a breastplate, a helm; a man-tall shadow
      if (st.shadows) castPoly(hull2(ellP(0, 0, 9, 5), 20, 24))
      const base = ellP(0, 4, 9.5, 5.5); obj(base, { h: 0, col: P.woodD, a: 0.7, sd: 2.5, line: 1.1 })
      const sh = cr([[-13, 2], [-12, -5], [-7, -8], [7, -8], [12, -5], [13, 2], [8, 6], [-8, 6]], true, 3); obj(sh, { h: 0, col: P.iron, a: 0.6, sd: 4, line: 1.2 })
      if (det >= 1) { line([[-11, -1], [-7, 3]], 0.5, { taper: 0.5 }); line([[11, -1], [7, 3]], 0.5, { taper: 0.5 }); for (const sg of [-1, 1]) { const pd = ellP(sg * 11.5, -3, 3.6, 3, 0, 8); obj(pd, { h: 0, col: P.iron, a: 0.6, sd: 1.5, line: 0.8 }) } }
      const helm = ellP(0, -3, 5.6); obj(helm, { h: 0, col: P.stoneL, a: 0.6, sd: 2.5, line: 1.1 }); if (det >= 1) { line([[0, -8.5], [0, 2]], 0.7, { taper: 0.3 }); line([[-4, -3], [4, -3]], 0.5, { taper: 0.4 }) }
    },
  ]
  reg('dg-weapon-rack', 'Weapon rack', 'dg-furnishings', 'fixed', racks)

  /* =====================================================================================================
     Cauldron: a round iron pot. s = 70.
     ===================================================================================================== */
  /** The pot: belly, rim ring, liquid inside (fill(inner, R)), ear handles, three feet. */
  function pot(cx, cy, R, o) {
    o = o || {}
    const belly = ellP(cx, cy, R)
    if (o.feet !== false) for (let i = 0; i < 3; i++) { const a = -PI / 2 + 0.4 + (i / 3) * TAU; const ft = rrect(cx + cos(a) * (R - 1), cy + sin(a) * (R - 1), 6, 5, 2, a); obj(ft, { h: 2, col: P.iron, a: 0.75, shade: 0, line: 0.9 }) }
    obj(belly, { h: o.h == null ? 7 : o.h, col: P.iron, a: 0.7, sd: R * 0.22, line: 1.4 })
    const Ri = R * (o.ri || 0.8), inn = ellP(cx, cy, Ri)
    ring(cx, cy, Ri, R * 0.94, P.iron, { w: 0.8 })
    if (det >= 2 && o.studs !== false) { const n = clamp(Math.round(R * k / 2.4), 8, 18); for (let i = 0; i < n; i++) { const a = (i / n) * TAU; nail(cx + cos(a) * R * 0.87, cy + sin(a) * R * 0.87) } flushDots() }
    paper(inn)
    if (o.fill) o.fill(inn, Ri); else { if (COL) tint(inn, P.woodX, 0.85); ctx.save(); clipTo(inn); if (!COL) hatchBox(cx - Ri, cy - Ri, cx + Ri, cy + Ri, -0.79, 2.2, 0.45); ctx.restore(); if (det >= 1) shadeIn(inn, Ri * 0.4, { rev: true, inkToo: true, gap: 1.6, col: 'rgba(0,0,0,0.4)' }) }
    pen(inn, 1.1, { swell: -0.6 })
    if (o.ears !== false) for (const sg of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + sg * (R + 1.5), cy, R * 0.12, 0, TAU); ctx.lineWidth = px(1.3); ctx.strokeStyle = INK; ctx.stroke() }
    return inn
  }
  /** Liquid filler: wash, a few ripple arcs, bubbles. */
  const brew = (col, nb, o) => (inn, Ri) => {
    o = o || {}
    const b = bbox(inn), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2
    if (COL) tint(inn, col, 0.85)
    ctx.save(); clipTo(inn)
    if (!COL) hatchBox(b.x0, b.y0, b.x1, b.y1, 0.05, 2.8, 0.4)
    if (det >= 1) shadeIn(inn, Ri * 0.35, { rev: true, inkToo: true, gap: 1.8, col: 'rgba(10,20,10,0.4)' })
    if (det >= 1) { ctx.beginPath(); for (let i = 0; i < 2; i++) { const q = Ri * (0.3 + i * 0.3); ctx.moveTo(cx + Ri * 0.1 + q * cos(0.5), cy + Ri * 0.1 + q * sin(0.5)); ctx.arc(cx + Ri * 0.1, cy + Ri * 0.1, q, 0.5, 0.5 + rr(1.2, 2.4)) } ctx.lineWidth = px(0.5); ctx.strokeStyle = COL ? '#e4e8d6' : PAPER; ctx.stroke() }
    ctx.restore()
    if (nb) bubbles(inn, det >= 1 ? nb : Math.ceil(nb / 3), COL ? mix(col, '#ffffff', 0.5) : INK)
    if (o.ladle) ladle(cx, cy, Ri, o.ladle)
  }
  function ladle(cx, cy, Ri, ang) {
    const f = F(cx, cy, ang), cup = ellP(...f(Ri * 0.3, 0), Ri * 0.2, Ri * 0.17, ang)
    const hd = bar(f(Ri * 0.4, 0), f(Ri * 1.75, 0), 1.6); obj(hd, { h: 2, col: P.woodD, a: 0.75, shade: 0, line: 0.7, flat: true })
    paper(cup); if (COL) tint(cup, P.iron, 0.7); pen(cup, 0.8, { wob: 0.3 })
  }
  const cauldrons = [
    // 0: bubbling over a fire
    () => { fireUnder(0, 0, 36, { logs: 3 }); pot(0, 0, 34, { fill: brew(P.brew, 9) }); if (det >= 1) steam(8, -22, 14) },
    // 1: cold, on dead embers
    () => { fireUnder(2, 2, 36, { logs: 2, cold: true, a0: 1.2 }); pot(0, 0, 36, { fill: brew(P.waterD, 0) }) },
    // 2: tipped over and spilled
    () => {
      const spill = blob(26, 6, 22, 15, 0.1, 10, 0.3, 3); if (COL) tint(spill, P.brew, 0.5); else hatchIn(spill, 0.3, 2.2, 0.4); pen(spill, 0.6, { flat: true, wob: 1.6 })
      const f = F(-8, 0, 0.15), body = ellP(-8, 0, 30, 28, 0.15); obj(body, { h: 6, col: P.iron, a: 0.7, sd: 8, line: 1.4 })
      for (let i = 0; i < 3; i++) { const u = -10 + i * 10; line([f(u, -27), f(u + 1, 27)], 0.5, { taper: 0.4, wob: 0.5 }) }
      const rim = ellP(...f(24, 0), 9, 26, 0.15); shadow(rim, 2); paper(rim); if (COL) tint(rim, P.iron, 0.8); pen(rim, 1.2)
      const mouth = ellP(...f(24, 0), 6, 21, 0.15); hollow(mouth, { sd: 3 }); pen(mouth, 0.9, { swell: -0.5 })
      for (const sg of [-1, 1]) { const ft = rrect(...f(-18, sg * 20), 6, 5, 2, 0.15); obj(ft, { h: 2, col: P.iron, a: 0.75, shade: 0, line: 0.9 }) }
      ctx.beginPath(); ctx.arc(...f(-8, -30), 3.4, 0, TAU); ctx.lineWidth = px(1.3); ctx.strokeStyle = INK; ctx.stroke()
    },
    // 3: hung from a tripod over a small fire
    () => {
      fireUnder(0, 2, 24, { logs: 3, a0: 0.2 })
      const legs = [[-40, 32], [40, 32], [0, -44]]
      if (st.shadows) for (const l of legs) castPoly(hull2(bar([0, 0], l, 3), 10, 12))
      pot(0, 0, 25, { feet: false, h: 10, fill: brew(P.brew, 5) })
      for (const l of legs) { const b = bar([l[0] * 0.08, l[1] * 0.08], l, 3); obj(b, { h: 0, col: P.woodD, a: 0.75, shade: 0, line: 1, flat: true }) }
      ringFlat(0, 0, 3.6, 1.3); if (det >= 1) chain([0, -3], [0, -14], 2.6)
      if (det >= 1) { for (const l of legs) { const e = [l[0] * 0.96, l[1] * 0.96]; ctx.beginPath(); ctx.arc(e[0], e[1], 2.4, 0, TAU); ctx.lineWidth = px(0.8); ctx.strokeStyle = INK; ctx.stroke() } }
    },
    // 4: large witch's cauldron, bubbling
    () => { pot(0, 0, 45, { fill: brew(P.plum, 16, { ladle: -0.7 }), h: 9 }); if (det >= 1) { steam(-6, -34, 14); steam(14, -30, 12) } },
    // 5: small pot with a bail handle
    () => {
      pot(0, 0, 22, { fill: brew(P.ochre, 4), ears: false, h: 5 })
      ctx.beginPath(); ctx.moveTo(-23, 0); ctx.lineTo(23, 0); ctx.lineWidth = px(1.5); ctx.strokeStyle = INK; ctx.stroke(); if (COL) { ctx.beginPath(); ctx.moveTo(-23, 0); ctx.lineTo(23, 0); ctx.lineWidth = px(0.7); ctx.strokeStyle = P.iron; ctx.stroke() }
      for (const sg of [-1, 1]) solidDot(sg * 23, 0, 1.4, INK)
      if (det >= 1) { const sp = ellP(-30, 8, 4.6); obj(sp, { h: 1.5, col: P.woodL, a: 0.7, sd: 1.5, line: 0.8 }); line([[-30, 12], [-28, 30]], 1.2, { taper: 0.2 }) }
    },
    // 6: with a ladle
    () => { pot(0, 0, 34, { fill: brew(P.brew, 6, { ladle: -0.85 }) }) },
    // 7: cracked and leaking
    () => {
      const leak = blob(28, 20, 8, 6, 0.6, 8, 0.3, 3); if (COL) tint(leak, P.waterD, 0.5); else hatchIn(leak, 0.3, 2, 0.4); pen(leak, 0.5, { flat: true, wob: 1.4 })
      pot(0, 0, 36, { fill: brew(P.waterD, 0) })
      crack([34, -6], [26, 8], 1, 1.4); crack([26, 8], [30, 20], 0.9, 1.4); if (det >= 1) crack([27, 4], [18, 10], 0.5, 1)
      if (det >= 1) stipIn(ellP(24, 8, 10, 12), 26, 0.5)
    },
  ]
  reg('dg-cauldron', 'Cauldron', 'dg-furnishings', 'fixed', cauldrons)

  /* =====================================================================================================
     Magic circle: inked or chalked on the floor, no cast shadow. s = 280.
     ===================================================================================================== */
  /** A chalk or ink ring: a flat wobbly circle, lighter in colour mode. */
  function mring(R, w, o) {
    o = o || {}
    const pts = []; const n = nSeg(R); for (let i = 0; i < n; i++) { const a = (i / n) * TAU + (o.a0 || 0); if (o.gap && a > o.gap[0] && a < o.gap[1]) continue; pts.push([cos(a) * R + j(o.rough || 0.3), sin(a) * R + j(o.rough || 0.3)]) }
    if (o.gap) line(pts, w, { taper: 0.3, wob: o.wob == null ? 1.2 : o.wob, col: o.col })
    else pen(pts, w, { flat: true, wob: o.wob == null ? 1.2 : o.wob, col: o.col, noCorner: true })
  }
  /** Straight chalk line. */
  const mline = (a, b, w, col) => line([a, lerp(a, b, 0.5), b], w, { taper: 0.25, wob: 1.0, col })
  /** A ring of runes at radius R, their tops pointing outward. */
  function runeRing(R, n, sz, w, col, a0) { for (let i = 0; i < n; i++) { const a = (a0 || 0) + (i / n) * TAU; rune(cos(a) * R, sin(a) * R, sz, a + PI / 2, (i * 7 + 3) % RUNES.length, w, col) } }
  /** Star polygon: p points, every q-th joined. */
  function star(R, p, q, w, col, a0) { const pts = []; for (let i = 0; i < p; i++) { const a = (a0 == null ? -PI / 2 : a0) + (i / p) * TAU; pts.push([cos(a) * R, sin(a) * R]) } for (let i = 0; i < p; i++) mline(pts[i], pts[(i + q) % p], w, col); return pts }
  /** Colour mode draws the chalk a touch fainter; ink mode is just ink. */
  const chalk = () => { if (COL) ctx.globalAlpha = 0.82 }
  const circles = [
    // 0: pentagram with candles at the points
    () => {
      ctx.save(); chalk()
      if (COL) tone(ellP(0, 0, 46), P.plum, 0.08)
      mring(46, 1.4); mring(41, 0.8)
      if (det >= 1) runeRing(43.5, 24, 3.6, 0.55)
      const pts = star(40, 5, 2, 1.1)
      if (det >= 1) mring(15, 0.7)
      ctx.restore()
      for (const p of pts) candle(p[0] * 0.92, p[1] * 0.92, 3.4)
      if (det >= 1) { ctx.save(); chalk(); for (let i = 0; i < 5; i++) { const a = -PI / 2 + PI / 5 + (i / 5) * TAU; rune(cos(a) * 22, sin(a) * 22, 5, a + PI / 2, i * 4, 0.7) } ctx.restore() }
    },
    // 1: summoning circle with runes
    () => {
      ctx.save(); chalk()
      if (COL) tone(ellP(0, 0, 47), P.red, 0.06)
      mring(47, 1.5); mring(40, 1.0); mring(30, 0.8)
      runeRing(43.5, det >= 1 ? 28 : 14, 4.6, 0.65)
      const tri = star(29, 3, 1, 1.2, undefined, -PI / 2)
      for (const p of tri) { const c = ellP(p[0], p[1], 5.5); paper(c); if (COL) tone(c, P.plum, 0.12); pen(c, 0.9, { flat: true, wob: 1 }); rune(p[0], p[1], 5, 0, 13, 0.7) }
      if (det >= 1) { mring(9, 0.8); for (let i = 0; i < 3; i++) { const a = PI / 2 + (i / 3) * TAU; rune(cos(a) * 18, sin(a) * 18, 5, a + PI / 2, i * 5 + 2, 0.7) } }
      solidDot(0, 0, 1.6, INK)
      ctx.restore()
    },
    // 2: hexagram
    () => {
      ctx.save(); chalk()
      if (COL) tone(ellP(0, 0, 46), P.blue, 0.07)
      mring(46, 1.4); if (det >= 1) mring(43, 0.6)
      star(42, 3, 1, 1.2, undefined, -PI / 2); star(42, 3, 1, 1.2, undefined, PI / 2)
      mring(21, 0.9); if (det >= 1) { runeRing(32, 12, 4.4, 0.6, undefined, PI / 6); mring(12, 0.6) }
      const eye = cr([[-7, 0], [-3, -3.6], [3, -3.6], [7, 0], [3, 3.6], [-3, 3.6]], true, 3); pen(eye, 0.9, { flat: true, wob: 0.6 }); pen(ellP(0, 0, 2.6), 0.7, { flat: true }); solidDot(0, 0, 1.1, INK)
      ctx.restore()
    },
    // 3: simple chalk ring
    () => {
      ctx.save(); if (COL) ctx.globalAlpha = 0.7
      mring(44, 2.2, { rough: 0.8, wob: 1.8 }); if (det >= 1) mring(42, 0.7, { rough: 0.6, gap: [1.1, 2.0], wob: 1.5 })
      if (det >= 1) { for (let i = 0; i < 7; i++) { const a = rr(0, TAU), d = rr(40, 47); line([[cos(a) * d, sin(a) * d], [cos(a + 0.05) * d + j(3), sin(a + 0.05) * d + j(3)]], 0.5, { taper: 0.6 }) } }
      if (det >= 2) { ctx.beginPath(); for (let i = 0; i < 40; i++) { const a = rr(0, TAU), d = rr(42, 46); const q = 0.4 / k * lw; ctx.moveTo(cos(a) * d + q, sin(a) * d); ctx.arc(cos(a) * d, sin(a) * d, q, 0, TAU) } ctx.fillStyle = INK; ctx.fill() }
      ctx.restore()
      candle(0, -8, 3.2); if (det >= 1) { const bt = ellP(6, 6, 3); paper(bt); if (COL) tint(bt, P.cloth, 0.6); pen(bt, 0.7); line([[7, 3], [10, -1]], 0.8, { taper: 0.1 }) }
    },
    // 4: triple ring with sigils
    () => {
      ctx.save(); chalk()
      if (COL) tone(ellP(0, 0, 47), P.ochre, 0.08)
      mring(47, 1.4); mring(38, 1.0); mring(29, 1.0); if (det >= 1) mring(26, 0.6)
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, x = cos(a) * 42.5, y = sin(a) * 42.5; const c = ellP(x, y, 3.6); pen(c, 0.7, { flat: true, wob: 0.8 }); if (det >= 1) rune(x, y, 3.6, a + PI / 2, i * 3 + 1, 0.55) }
      if (det >= 1) { for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + PI / 6, x = cos(a) * 33.5, y = sin(a) * 33.5; const c = ellP(x, y, 3.4); pen(c, 0.7, { flat: true, wob: 0.8 }); rune(x, y, 3.4, a + PI / 2, i * 5 + 2, 0.5) } }
      if (det >= 1) { mline([-42.5, 0], [-38, 0], 0.6); mline([38, 0], [42.5, 0], 0.6); mline([0, -42.5], [0, -38], 0.6); mline([0, 38], [0, 42.5], 0.6) }
      star(24, 6, 2, 1.0)
      mring(8, 0.8); solidDot(0, 0, 1.4, INK)
      ctx.restore()
    },
    // 5: broken circle, a smudged gap
    () => {
      ctx.save(); chalk()
      if (COL) tone(ellP(0, 0, 46), P.plum, 0.07)
      mring(46, 1.4, { gap: [0.35, 1.0] }); mring(40, 0.9, { gap: [0.3, 1.05] })
      for (let i = 0; i < 22; i++) { const a = (i / 22) * TAU; if (a > 0.25 && a < 1.1) continue; rune(cos(a) * 43, sin(a) * 43, 4, a + PI / 2, (i * 7 + 3) % RUNES.length, 0.6) }
      star(39, 5, 2, 1.1)
      // the smudge: smears dragged outward through the gap
      if (det >= 1) { ctx.save(); ctx.globalAlpha = COL ? 0.5 : 0.75; ctx.beginPath(); for (let i = 0; i < 9; i++) { const a = rr(0.3, 1.05), d0 = rr(36, 44); ctx.moveTo(cos(a) * d0, sin(a) * d0); ctx.lineTo(cos(a + j(0.08)) * (d0 + rr(4, 9)), sin(a + j(0.08)) * (d0 + rr(4, 9))) } ctx.lineWidth = px(1.6); ctx.strokeStyle = INK; ctx.stroke(); ctx.restore() }
      ctx.restore()
      if (det >= 1) { const rag = cr([[36, 28], [44, 26], [47, 34], [40, 38], [34, 34]], true, 3); obj(rag, { h: 1, col: P.canvasD, a: 0.6, sd: 2, line: 0.8, wob: 1.2 }) }
    },
    // 6: teleport circle with arrows and marks
    () => {
      ctx.save(); chalk()
      if (COL) tone(ellP(0, 0, 46), P.blue, 0.08)
      mring(46, 1.4); mring(41, 0.8)
      if (det >= 1) { ctx.beginPath(); for (let i = 0; i < 48; i++) { const a = (i / 48) * TAU, l = i % 4 ? 2 : 3.6; ctx.moveTo(cos(a) * 41.5, sin(a) * 41.5); ctx.lineTo(cos(a) * (41.5 + l), sin(a) * (41.5 + l)) } ctx.lineWidth = px(0.55); ctx.strokeStyle = INK; ctx.stroke() }
      const sq1 = rectP(0, 0, 52, 52, 0), sq2 = rectP(0, 0, 52, 52, PI / 4); pen(sq1, 1.0, { flat: true, wob: 1 }); pen(sq2, 1.0, { flat: true, wob: 1 })
      for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU, a1 = [cos(a) * 27, sin(a) * 27], a2 = [cos(a) * 38, sin(a) * 38]; mline(a1, a2, 1.0); line([[a2[0] + cos(a + 2.6) * 3.5, a2[1] + sin(a + 2.6) * 3.5], a2, [a2[0] + cos(a - 2.6) * 3.5, a2[1] + sin(a - 2.6) * 3.5]], 0.9, { taper: 0.2 }) }
      mring(18, 0.9); if (det >= 1) { runeRing(22.5, 8, 3.6, 0.55, undefined, PI / 8); mring(6, 0.7) }
      solidDot(0, 0, 1.4, INK)
      ctx.restore()
    },
    // 7: blood-red runes (ink mode: the same circle in ink)
    () => {
      const col = COL ? P.blood : undefined
      ctx.save()
      if (COL) tone(ellP(0, 0, 46), P.blood, 0.07)
      mring(46, 1.5, { col }); mring(40, 0.9, { col })
      runeRing(43, det >= 1 ? 26 : 13, 4.2, 0.7, col)
      star(39, 5, 2, 1.1, col); mring(14, 0.8, { col })
      if (det >= 1) { for (let i = 0; i < 5; i++) { const a = -PI / 2 + PI / 5 + (i / 5) * TAU; rune(cos(a) * 21, sin(a) * 21, 5, a + PI / 2, i * 4 + 2, 0.7, col) } rune(0, 0, 8, 0, 13, 0.9, col) }
      if (det >= 1) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = rr(0, TAU), d = rr(20, 44), q = rr(0.5, 1.1) / k * lw; ctx.moveTo(cos(a) * d + q, sin(a) * d); ctx.arc(cos(a) * d, sin(a) * d, q, 0, TAU) } ctx.fillStyle = col || INK; ctx.fill() }
      ctx.restore()
    },
  ]
  reg('dg-magic-circle', 'Magic circle', 'dg-furnishings', 'fixed', circles)
})(window.Atlas)
