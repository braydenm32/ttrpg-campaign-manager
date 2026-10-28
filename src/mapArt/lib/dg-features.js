/* Dungeon features, seen from directly above (view 'top'): stairs, spiral stairs, pillars, pits, rubble, bones, braziers
   and wall torches. Drawn with the same hand as bm-props.js: tapered inked outlines that swell toward the lower right
   (light from the upper left), parallel hatching and stipple for shade, translucent washes over the same linework in
   colour. Everything is in a 100-unit design space (100 units = s); `det` drops small marks at small sizes and adds more
   when big. Opaque paper first, so a piece put down later hides what is under it. Depth is the theme: anything that goes
   down (steps, pits) darkens toward the bottom, with close cross-hatching in ink and a deep wash in colour. */
;(function (A) {
  'use strict'
  const PI = Math.PI, TAU = PI * 2, sin = Math.sin, cos = Math.cos, hypot = Math.hypot, abs = Math.abs, min = Math.min, max = Math.max, atan2 = Math.atan2, sqrt = Math.sqrt
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
      iron: mix(t.rock, '#1e1c1a', 0.62), brass: mix(t.sand, '#b8862a', 0.7), rust: mix(t.roof, '#5a3a22', 0.5),
      red: mix(t.roof, t.sand, 0.12), blue: mix(t.water, '#4e6478', 0.6), green: mix(t.forest, t.grass, 0.2), ochre: mix(t.sand, '#c28a2c', 0.65),
      water: t.water, waterD: mix(t.water, '#2c4a52', 0.45),
      earth: mix(t.rock, '#6b5236', 0.55), earthD: mix(t.rock, '#3a2c1e', 0.6), moss: mix(t.forest, t.rock, 0.35),
      leather: mix(t.roof, '#4a3420', 0.55), canvas: mix(t.snow, t.sand, 0.5),
      flame: '#dc8a3c', flameL: '#efc468', flameR: '#bd5236', ash: mix(t.rock, '#555048', 0.5), coal: '#4a3c32',
      cold: mix(t.water, '#6f8ed8', 0.55), coldL: mix(t.water, '#e8f2ff', 0.6),
      bone: mix(t.snow, t.sand, 0.42), boneD: mix(t.sand, t.rock, 0.5),
      pit: mix(t.rock, '#241b12', 0.72), deep: '#1b140d', shade: '#46301a',
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
  /** Lumpy rounded outline (stones, heaps, holes). irr = how lumpy. */
  function blob(cx, cy, rx, ry, ang, n, irr, sub) {
    const pts = [], ph = r() * TAU, f = F(cx, cy, ang)
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU, q = 1 + irr * (sin(a * 2 + ph) * 0.5 + sin(a * 3 + ph * 1.7) * 0.3 + j(0.55)); pts.push(f(cos(a) * rx * q, sin(a) * ry * q)) }
    return cr(pts, true, sub || 3)
  }
  /** Points every `step` units round a closed outline. */
  function resample(pts, step) {
    const out = [], n = pts.length; let carry = 0
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n], d = hypot(b[0] - a[0], b[1] - a[1]); let t = carry
      while (t < d) { out.push(lerp(a, b, t / d)); t += step }
      carry = t - d
    }
    return out
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
        const d1 = atan2(b[1] - a[1], b[0] - a[0]), d2 = atan2(c[1] - b[1], c[0] - b[0]); let da = abs(d2 - d1); if (da > PI) da = TAU - da
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
    paper(pts)
    if (COL && o.col) tint(pts, o.col, o.a || 0.62)
    if (o.shade !== 0 && det >= 1) shadeIn(pts, o.sd, o)
    if (o.line !== 0) pen(pts, o.line || 1.4, { wob: o.wob, swell: o.swell, flat: o.flat, wmul: o.wmul })
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
  /** Hoop: a flat iron ring between two radii. */
  function ring(cx, cy, r0, r1, col, o) {
    o = o || {}
    const a = ellP(cx, cy, r1), b = ellP(cx, cy, r0)
    ctx.beginPath(); sub(a); sub(b); ctx.fillStyle = PAPER; ctx.fill('evenodd')
    if (COL) { ctx.save(); ctx.globalAlpha = 0.6; ctx.fillStyle = col || P.iron; ctx.fill('evenodd'); ctx.restore() }
    pen(a, o.w || 0.8, { wob: 0.35 }); pen(b, o.w || 0.8, { wob: 0.35, swell: 0.3 })
  }
  /** Planks laid across a rectangle (planks run along u). Draws each plank as its own inked, tinted piece. */
  function plankRect(cx, cy, w, h, ang, o) {
    o = o || {}
    const f = F(cx, cy, ang), pw = o.pw || 12, n = max(1, o.n || Math.round(h / pw)), cols = o.cols || [P.wood, P.woodL, P.woodD]
    const g = o.gap == null ? 0.5 : o.gap, grains = o.grain == null ? det >= 2 : o.grain
    const ws = []
    for (let i = 0; i < n; i++) {
      const v0 = -h / 2 + (i * h) / n, v1 = v0 + h / n
      const pl = [f(-w / 2, v0 + g), f(w / 2, v0 + g), f(w / 2, v1 - g), f(-w / 2, v1 - g)]
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
          for (let u = a; u < b2; u += 4) { const p = f(u, v + sin(u * 0.17 + i * 1.7 + q) * 0.55); if (first) { ctx.moveTo(p[0], p[1]); first = false } else ctx.lineTo(p[0], p[1]) }
        }
      }
      ctx.lineWidth = px(0.4); ctx.strokeStyle = INK; ctx.globalAlpha = 0.7; ctx.stroke(); ctx.globalAlpha = 1
      if (!COL) for (let i = 1; i < n; i += 2) { ctx.save(); clipTo(ws[i]); hatchBox(cx - w, cy - w, cx + w, cy + w, ang + 0.03, 3.4, 0.3, { minG: 2.6 }); ctx.restore() }
    }
    if (o.nails !== false && det >= 2) for (let i = 0; i < n; i++) { const v = -h / 2 + ((i + 0.5) * h) / n; nail(...f(-w / 2 + 2.6, v)); nail(...f(w / 2 - 2.6, v)) }
    flushDots()
  }
  /** One flame tongue from (cx, cy) pointing along ang; curl bends the tip sideways. */
  function flameP(cx, cy, len, wid, ang, curl) {
    const f = F(cx, cy, ang); curl = curl || 0
    return cr([f(0, -wid * 0.35), f(len * 0.3, -wid * 0.62), f(len * 0.62, -wid * 0.4 + curl * len * 0.2), f(len * 0.9, curl * len * 0.3), f(len, curl * len * 0.46), f(len * 0.76, wid * 0.08 + curl * len * 0.28), f(len * 0.5, wid * 0.36), f(len * 0.25, wid * 0.62), f(0, wid * 0.35)], true, 3)
  }
  /** A burst of flames centred at (cx, cy); sc scales it (1 = the campfire). cool = a magical, cold flame. */
  function flames(cx, cy, sc, o) {
    o = o || {}
    const cool = o.cool, cR = cool ? P.cold : P.flameR, cM = cool ? mix(P.cold, '#ffffff', 0.3) : P.flame, cL = cool ? P.coldL : P.flameL
    if (COL) tint(blob(cx, cy, 22 * sc, 21 * sc, 0, 9, 0.12, 3), cM, 0.2)
    const tongue = (len, wid, a, col, wgt, ink, curl) => {
      if (!COL) { len *= 1.1; wid *= 1.06 }
      const p = flameP(cx + cos(a) * len * 0.1, cy + sin(a) * len * 0.1, len, wid, a, curl)
      paper(p)
      if (COL) { ctx.save(); ctx.globalAlpha = 0.84; ctx.fillStyle = col; poly(p); ctx.fill(); ctx.restore() }
      if (ink) line(p.concat([p[0]]), wgt, { taper: 0.55, wob: 0.5 })
    }
    const ringOf = (n, l0, l1, wid, col, wgt, ink) => { const aa = r() * TAU; for (let i = 0; i < n; i++) tongue(rr(l0, l1) * sc, wid * sc * rr(0.8, 1.2), aa + ((i + j(0.3)) / n) * TAU, col, wgt, ink, j(0.55)) }
    const few = det === 0 || o.few, wg = cool ? 0.75 : 1
    ringOf(few ? 5 : 6 + ((r() * 3) | 0), 14, 21, 10, cR, 1.1 * wg, true)
    ringOf(few ? 3 : 5 + ((r() * 2) | 0), 9, 14.5, 8, cM, 0.9 * wg, true)
    tongue(rr(15, 19) * sc, 7.5 * sc, r() * TAU, cM, 0.9 * wg, true, j(0.6))
    if (!few) ringOf(4, 5, 8.5, 5.5, cL, 0.7, det >= 1)
    if (det >= 1 && !few) for (let i = 0; i < 6; i++) { const a = r() * TAU, d = rr(2, 7) * sc, e = d + rr(5, 9) * sc; line([[cx + cos(a) * d, cy + sin(a) * d], [cx + cos(a + 0.3) * e, cy + sin(a + 0.3) * e]], 0.5, { taper: 0.8, wob: 0.3 }) }
    if (o.sparks !== false) { ctx.beginPath(); for (let i = 0; i < (det >= 1 ? 10 : 4); i++) { const a = r() * TAU, d = rr(14, 34) * sc, q = rr(0.5, 1.1) / k * lw; ctx.moveTo(cx + cos(a) * d + q, cy + sin(a) * d); ctx.arc(cx + cos(a) * d, cy + sin(a) * d, q, 0, TAU) } ctx.fillStyle = COL ? cR : INK; ctx.fill() }
  }
  /** Firelight on the floor (colour only): two flat warm discs, no gradient. */
  function glow(x, y, R, col) { if (!COL) return; tone(ellP(x, y, R), col || P.flameL, 0.11); tone(ellP(x, y, R * 0.58), col || P.flameL, 0.1) }

  /* ---------- depth ---------- */
  /** Darken a tread or wedge by how far down it is (d 0..1): a deepening wash in colour, denser hatching in ink. */
  function depthTone(pts, d) {
    if (d <= 0.02) return
    const b = bbox(pts)
    if (COL) { tone(pts, P.pit, Math.pow(d, 1.3) * 0.78); if (d > 0.7) tone(pts, P.deep, (d - 0.7) * 2.4); return }
    if (d < 0.22) return
    ctx.save(); clipTo(pts)
    hatchBox(b.x0 - 2, b.y0 - 2, b.x1 + 2, b.y1 + 2, -0.79, 7.2 - 5.2 * d, 0.5, { minG: 1.5 })
    if (d > 0.5) hatchBox(b.x0 - 2, b.y0 - 2, b.x1 + 2, b.y1 + 2, 0.55, 6 - 3.6 * d, 0.5, { minG: 1.6 })
    if (d > 0.85 && det >= 1) hatchBox(b.x0 - 2, b.y0 - 2, b.x1 + 2, b.y1 + 2, -0.1, 2.6, 0.45, { minG: 1.6 })
    ctx.restore()
  }
  /** The dark inside of a hole. deep 0..1: 0 = a shadowed floor you can still make out, 1 = black. */
  function dark(pts, deep) {
    const b = bbox(pts)
    paper(pts)
    if (COL) { tint(pts, P.pit, 0.5 + 0.4 * deep); if (deep > 0.5) tone(pts, P.deep, (deep - 0.5) * (deep >= 1 ? 1.7 : 1.1)); return }
    const X0 = b.x0 - 2, Y0 = b.y0 - 2, X1 = b.x1 + 2, Y1 = b.y1 + 2
    ctx.save(); clipTo(pts)
    hatchBox(X0, Y0, X1, Y1, -0.79, 2.5 - 0.6 * deep, 0.55, { minG: 1.4 })
    if (deep > 0.3) hatchBox(X0, Y0, X1, Y1, 0.55, 3.0 - 0.8 * deep, 0.5, { minG: 1.5 })
    if (deep > 0.65 && det >= 1) hatchBox(X0, Y0, X1, Y1, -0.1, 2.6, 0.45, { minG: 1.5 })
    if (deep >= 1) { ctx.globalAlpha = 0.82; ctx.fillStyle = INK; ctx.fillRect(X0, Y0, X1 - X0, Y1 - Y0); ctx.globalAlpha = 1 }
    ctx.restore()
  }
  /** The far wall of a hole, seen down its upper-left inside edge: a band d wide between the rim and the dark,
      with the joints of its stones running down it and a course or two running round. */
  function wallFace(pts, d, o) {
    o = o || {}
    const b = bbox(pts), dx = d * 0.72, dy = d * 0.72, inner = shift(pts, dx, dy)
    const X0 = b.x0 - 4, Y0 = b.y0 - 4, X1 = b.x1 + 4, Y1 = b.y1 + 4
    ctx.save(); clipTo(pts)
    ctx.beginPath(); ctx.rect(X0, Y0, X1 - X0, Y1 - Y0); sub(inner); ctx.clip('evenodd')
    ctx.fillStyle = PAPER; ctx.fillRect(X0, Y0, X1 - X0, Y1 - Y0)
    if (COL) { ctx.globalAlpha = 0.5; ctx.fillStyle = o.col || P.stoneD; ctx.fillRect(X0, Y0, X1 - X0, Y1 - Y0); ctx.globalAlpha = 1 }
    ctx.beginPath()
    for (const p of resample(pts, o.joint || 6.5)) { ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0] + dx * 1.05 + j(0.3), p[1] + dy * 1.05 + j(0.3)) }
    ctx.lineWidth = px(0.5); ctx.strokeStyle = INK; ctx.stroke()
    if (det >= 1) { poly(shift(pts, dx * 0.45, dy * 0.45)); ctx.lineWidth = px(0.45); ctx.stroke() }
    if (!COL && det >= 1) hatchBox(X0, Y0, X1, Y1, 0.785, 3.6, 0.35, { minG: 2 })
    ctx.restore()
    ctx.save(); clipTo(pts); pen(inner, 0.9, { flat: true, wob: 0.8, noCorner: true }); ctx.restore()
  }
  /** A hole in the floor: dark inside, the far wall showing on the upper-left, a firm rim. */
  function pit(pts, o) {
    o = o || {}
    dark(pts, o.deep == null ? 0.8 : o.deep)
    if (o.face !== false) wallFace(pts, o.fw || 9, o)
    if (o.inside) o.inside()
    pen(pts, o.line || 1.6, { swell: 0.5, wob: o.wob })
  }
  /** A squared block of masonry lying on the floor. */
  function block(x, y, w, h, ang, o) {
    o = o || {}
    const pts = jig(rectP(x, y, w, h, ang), o.jig == null ? 0.5 : o.jig), f = F(x, y, ang)
    obj(pts, { h: o.h == null ? min(w, h) * 0.3 : o.h, col: o.col || [P.stone, P.stoneL, P.stoneD][(r() * 3) | 0], a: 0.75, sd: min(w, h) * 0.35, line: o.line || 1.05 })
    if (det >= 2 && r() < 0.45 && w > 6) line([f(rr(-w * 0.4, -w * 0.1), -h / 2), f(rr(-w * 0.1, w * 0.2), j(h * 0.2)), f(rr(0, w * 0.4), h / 2)], 0.45, { taper: 0.5, wob: 0.6 })
    return pts
  }
  /** A splinter of stone. */
  function chip(x, y, s, ang) {
    const f = F(x, y, ang), pts = [f(-s, -s * 0.4), f(s * 0.7, -s * 0.6), f(s, s * 0.5), f(-s * 0.4, s * 0.6)]
    obj(pts, { h: 0, col: P.stoneL, a: 0.7, shade: 0, line: 0.7 })
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
     Stairs: a straight flight one square wide and two long (s = 140 at a 70 px grid), going DOWN toward +y.
     x in [-25, 25], y in [-50, 50]. Steps draw closer together as they descend and the foot dissolves into hatching.
     ===================================================================================================== */
  const SY0 = -50, SY1 = 50
  /** Step edges from y0 to y1: n treads, each a little shallower than the last (taper 0..1). */
  function stepYs(y0, y1, n, taper) {
    const ws = []; let acc = 0
    for (let i = 0; i < n; i++) { const w = 1 - taper * (i / max(1, n - 1)); ws.push(w); acc += w }
    const ys = [y0]; let y = y0
    for (let i = 0; i < n; i++) { y += ((y1 - y0) * ws[i]) / acc; ys.push(y) }
    return ys
  }
  const depOf = (n) => { const o = []; for (let i = 0; i < n; i++) o.push(i / (n - 1)); return o }
  /** Treads across x0..x1 between the ys (down is +y). dep[i] 0..1 says how far down tread i is; deeper treads darken
      and the last dissolves. o.up = climbing away instead (no shade thrown by the step above). */
  function treads(x0, x1, ys, dep, o) {
    o = o || {}
    const n = ys.length - 1
    for (let i = 0; i < n; i++) {
      const y0 = ys[i], y1 = ys[i + 1], d = dep[i], tr = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
      paper(tr)
      if (COL && o.col !== null) tone(tr, o.col || P.stoneL, 0.4)
      depthTone(tr, d)
      if (o.tread) o.tread(i, tr, d)
      // the step above throws a strip of shade across the top of this tread
      if (!o.up && i > 0 && d < 0.95 && det >= 1) {
        const bw = min(y1 - y0 - 1, 2.2 + 2.2 * d), bd = [[x0, y0], [x1, y0], [x1, y0 + bw], [x0, y0 + bw]]
        if (COL) tone(bd, P.shade, 0.26); else { ctx.save(); clipTo(bd); hatchBox(x0 - 2, y0 - 1, x1 + 2, y0 + bw + 1, -0.79, 1.7, 0.5, { minG: 1.3 }); ctx.restore() }
      }
    }
    for (let i = 0; i < n; i++) {
      const y = ys[i], d = dep[i]
      if (d > 0.95) continue
      if (o.worn) line([[x0, y], [(x0 + x1) / 2, y + o.worn * (0.7 + r() * 0.6)], [x1, y]], 0.9, { taper: 0.3, wob: 1.1 })
      else rule([x0, y], [x1, y], o.w || 0.95, { over: 0, taper: 0.35 })
      if (o.nosing && det >= 1 && d < 0.85 && ys[i + 1] - y > 4) rule([x0 + 1, y + 1.6], [x1 - 1, y + 1.6], 0.45, { over: 0, taper: 0.3 })
    }
  }
  /** Side walls of a stairwell: two strips of coursed stone down the long sides. */
  function stairWalls(x0, x1, y0, y1, t) {
    for (const [a, b] of [[x0, x0 + t], [x1 - t, x1]]) {
      const w = [[a, y0], [b, y0], [b, y1], [a, y1]]
      paper(w); if (COL) tint(w, P.stone, 0.6)
      if (det >= 1) { ctx.beginPath(); for (let y = y0 + rr(3, 7); y < y1 - 2; y += rr(7, 12)) { ctx.moveTo(a + 0.3, y); ctx.lineTo(b - 0.3, y + j(0.4)) } ctx.lineWidth = px(0.6); ctx.strokeStyle = INK; ctx.stroke() }
      if (!COL && det >= 1) hatchIn(w, -0.79, 3.6, 0.4, { minG: 2 })
      pen(w, 1.2, { flat: true })
    }
  }
  const sideLines = (x0, x1, w) => { rule([x0, SY0], [x0, SY1], w || 1.1, { over: 0, taper: 0.2 }); rule([x1, SY0], [x1, SY1], w || 1.1, { over: 0, taper: 0.2 }) }
  const arrow = (x, y0, y1) => { line([[x, y0], [x, y1]], 0.7, { taper: 0.3 }); line([[x - 3.5, y1 - 4], [x, y1], [x + 3.5, y1 - 4]], 0.7, { taper: 0.3 }) }
  const stairs = [
    // 0: stone steps between side walls
    () => { const ys = stepYs(SY0, SY1, 9, 0.36); treads(-20, 20, ys, depOf(9), {}); stairWalls(-25, 25, SY0, SY1, 5) },
    // 1: worn stone: hollowed treads, chipped edges, grit
    () => {
      const ys = stepYs(SY0, SY1, 8, 0.36)
      treads(-24, 24, ys, depOf(8), { worn: 1.7, tread: (i, tr, d) => { if (det >= 2 && d < 0.8) stipIn(tr, 9, 0.45); if (det >= 1 && d < 0.7 && r() < 0.6) { const x = rr(-20, 18), y = tr[0][1] + 0.5; line([[x, y], [x + rr(2, 5), y + rr(1.5, 3)]], 0.45, { taper: 0.5 }) } } })
      sideLines(-24, 24)
    },
    // 2: wooden steps on two stringers, the dark gap between the boards showing
    () => {
      const ys = stepYs(SY0, SY1, 9, 0.3)
      treads(-21, 21, ys, depOf(9), { col: P.wood, w: 1.1, tread: (i, tr, d) => {
        const y0 = tr[0][1], y1 = tr[2][1]
        if (COL) tone(tr, [P.wood, P.woodL, P.woodD][i % 3], 0.3)
        if (i > 0) { const gp = [[-21, y0], [21, y0], [21, y0 + 1.5], [-21, y0 + 1.5]]; if (COL) tone(gp, P.deep, 0.7); else { ctx.save(); clipTo(gp); hatchBox(-23, y0 - 1, 23, y0 + 3, 0.1, 1.2, 0.5, { minG: 1 }); ctx.restore() } }
        if (det >= 2 && d < 0.9 && y1 - y0 > 5) { ctx.beginPath(); for (let q = 0; q < 2; q++) { const v = y0 + (y1 - y0) * (0.3 + q * 0.4) + j(0.6), a = rr(-19, -8), b = rr(6, 19); ctx.moveTo(a, v); for (let u = a + 4; u < b; u += 4) ctx.lineTo(u, v + sin(u * 0.2 + i) * 0.5) } ctx.lineWidth = px(0.4); ctx.globalAlpha = 0.75; ctx.strokeStyle = INK; ctx.stroke(); ctx.globalAlpha = 1 }
        if (det >= 2 && d < 0.9) { nail(-18, (y0 + y1) / 2); nail(18, (y0 + y1) / 2); flushDots() }
      } })
      for (const [a, b] of [[-25, -21], [21, 25]]) { const w = [[a, SY0], [b, SY0], [b, SY1], [a, SY1]]; obj(w, { h: 2, col: P.woodD, a: 0.75, sd: 1.5, line: 1.15 }) }
    },
    // 3: steps with a landing halfway
    () => {
      const a = stepYs(SY0, -14, 4, 0.2), b = stepYs(14, SY1, 4, 0.36), ys = a.concat(b)
      treads(-20, 20, ys, [0, 0.08, 0.16, 0.24, 0.3, 0.5, 0.68, 0.86, 1], { tread: (i) => { if (i === 4 && det >= 2) { rule([-20, 0], [20, 0.3], 0.5, { over: 0 }); rule([-2, -14], [-1.5, 0], 0.5, { over: 0 }); rule([8, 0], [8.4, 14], 0.5, { over: 0 }) } } })
      stairWalls(-25, 25, SY0, SY1, 5)
    },
    // 4: steps going up: lighter as they climb away, a quiet arrow
    () => {
      const ys = stepYs(SY0, SY1, 9, 0.3), dep = []
      for (let i = 0; i < 9; i++) dep.push(0.2 * (1 - i / 8))
      treads(-24, 24, ys, dep, { up: true, tread: (i, tr) => { if (COL) tone(tr, '#ffffff', (i / 8) * 0.28) } })
      sideLines(-24, 24)
      arrow(0, 22, 42)
    },
    // 5: stone steps with one broken through
    () => {
      const ys = stepYs(SY0, SY1, 9, 0.36)
      treads(-20, 20, ys, depOf(9), { tread: (i, tr) => {
        if (i !== 3) return
        const y0 = tr[0][1], y1 = tr[2][1], hole = jig(cr([[-16, y0 + 0.5], [-4, y0 + 0.8], [8, y0 + 1.5], [10, (y0 + y1) / 2], [6, y1 - 0.5], [-8, y1 - 0.8], [-17, y1 - 2]], true, 2), 0.9)
        dark(hole, 0.75); pen(hole, 0.9, { flat: true, wob: 1.4 })
        line([[10, y0 + 2], [15, y0 - 1], [19, y0 - 3]], 0.5, { taper: 0.5, wob: 0.8 })
      } })
      for (const [x, y, s, a] of [[-6, 4, 2.6, 0.4], [4, 7, 2, 1.3], [12, 16, 3, 2.1], [-14, 19, 2.2, 0.2]]) chip(x, y, s, a)
      block(13, 11, 7, 5, 0.3, { h: 1.5 })
      stairWalls(-25, 25, SY0, SY1, 5)
    },
    // 6: wide shallow ceremonial steps, each with a nosing line, between low curbs
    () => {
      const ys = stepYs(SY0, SY1, 14, 0.2)
      treads(-22, 22, ys, depOf(14), { w: 0.85, nosing: true })
      for (const [a, b] of [[-25, -22], [22, 25]]) { const w = [[a, SY0], [b, SY0], [b, SY1], [a, SY1]]; obj(w, { h: 1.5, col: P.stone, a: 0.6, sd: 1.2, line: 1.1 }) }
    },
    // 7: a ladder down a hatch
    () => {
      const hole = [[-22, SY0], [22, SY0], [22, SY1], [-22, SY1]]
      dark(hole, 0.82); wallFace(hole, 7); pen(hole, 1.5, { swell: 0.5 })
      for (let y = -43; y < 48; y += 9.5) { const rg = bar([-13, y], [13, y], 3.2); obj(rg, { h: 2, col: P.wood, a: 0.75, shade: 0, line: 0.9 }) }
      for (const x of [-13, 13]) { const rl = bar([x, SY0 + 1], [x, SY1 - 1], 4.4); obj(rl, { h: 3, col: P.woodD, a: 0.75, sd: 1.6, line: 1.1 }); if (det >= 2) { ctx.beginPath(); for (let q = 0; q < 4; q++) { const y = rr(-45, 30); ctx.moveTo(x + j(0.8), y); ctx.lineTo(x + j(0.8), y + rr(6, 14)) } ctx.lineWidth = px(0.4); ctx.globalAlpha = 0.7; ctx.strokeStyle = INK; ctx.stroke(); ctx.globalAlpha = 1 } }
    },
  ]
  reg('dg-stairs', 'Stairs', 'dg-features', 'fixed', stairs)

  /* =====================================================================================================
     Spiral stairs (s = 140, within a circle of radius 46): wedge treads round a newel, going down clockwise.
     ===================================================================================================== */
  const P2 = (rad, a) => [cos(a) * rad, sin(a) * rad]
  /** Wedge between two radii and two angles; g = a gap (in units) left at each radial edge. */
  const wedgeP = (r0, r1, b0, b1, g) => { g = g || 0; return arcP(0, 0, r0, r0, b0 + g / r0, b1 - g / r0).concat(arcP(0, 0, r1, r1, b1 - g / r1, b0 + g / r1)) }
  /** The staircase: n treads (o.spans widens some), top step at o.start, descending clockwise; drawn deepest first. */
  function spiralStairs(R, Rn, n, o) {
    o = o || {}
    const a0 = o.start == null ? -PI / 2 + 0.25 : o.start, spans = [], disc = ellP(0, 0, R)
    let tot = 0
    for (let i = 0; i < n; i++) { const sp = o.spans ? o.spans(i) : 1; spans.push(sp); tot += sp }
    const ang = [a0]; for (let i = 0; i < n; i++) ang.push(ang[i] + (TAU * spans[i]) / tot)
    if (!o.ruin) paper(disc)
    if (o.gap) dark(disc, 0.85)
    const missing = o.missing || [], outer = []
    for (let i = n - 1; i >= 0; i--) {
      const d = i / (n - 1), b0 = ang[i], b1 = ang[i + 1]
      if (missing.includes(i)) { const hole = jig(wedgeP(Rn - 2, R + 0.5, b0 - 0.04, b1 + 0.04), 1.2); dark(hole, 0.9); pen(hole, 0.8, { flat: true, wob: 1.5, noCorner: true }); outer[i] = arcP(0, 0, R + 0.5, R + 0.5, b0, b1); continue }
      let Ro = R
      if (o.ruin && r() < 0.5) Ro = R * rr(0.84, 0.97)
      outer[i] = arcP(0, 0, Ro, Ro, b0, b1)
      const w = o.ruin ? jig(wedgeP(Rn - 1, Ro, b0, b1, o.gap), 0.5) : wedgeP(Rn - 1, Ro, b0, b1, o.gap)
      paper(w)
      if (COL) tone(w, o.col || P.stoneL, o.a || 0.4)
      depthTone(w, d)
      if (o.tread) o.tread(i, w, b0, b1, d)
      if (o.gap) pen(w, o.lineW || 0.8, { flat: true, wob: 0.4, noCorner: true })
      // the step above throws shade across this one along its upper edge
      if (i > 0 && d < 0.95 && det >= 1 && !missing.includes(i - 1)) {
        const bw = 2.2 + 2.4 * d, bd = [P2(Rn, b0), P2(Ro, b0), P2(Ro, b0 + bw / Ro), P2(Rn, b0 + bw / Rn)]
        if (COL) tone(bd, P.shade, 0.26); else hatchIn(bd, b0 + PI / 2 + 0.3, 1.7, 0.5, { minG: 1.3 })
      }
      if (i === n - 1 && det >= 1) { const bw = 7, bd = [P2(Rn, b1), P2(Ro, b1), P2(Ro, b1 - bw / Ro), P2(Rn, b1 - bw / Rn)]; if (COL) tone(bd, P.deep, 0.4); else hatchIn(bd, b1 + PI / 2, 1.4, 0.5, { minG: 1.2 }) }
    }
    if (!o.gap) for (let i = 0; i < n; i++) {
      const d = i / (n - 1)
      if (d > 0.95 || missing.includes(i)) continue
      rule(P2(Rn - 0.5, ang[i]), P2(R, ang[i]), i === 0 ? 1.4 : 1.0, { over: 0.2, taper: 0.3, wob: o.ruin ? 1.3 : 0.7 })
    }
    if (o.rubble) { for (const [x, y, w, h, a] of [[-26, 24, 9, 6, 0.4], [-14, 33, 7, 5, 1.1], [-32, 10, 6, 4, 2.0]]) block(x, y, w, h, a, {}); for (const [x, y, s, a] of [[-20, 14, 2.4, 0.3], [-8, 28, 2, 1.5], [-30, 32, 2.2, 0.9], [-4, 40, 1.8, 2]]) chip(x, y, s, a) }
    // newel post
    const nw = o.ruin ? jig(ellP(0, 0, Rn), 0.6) : ellP(0, 0, Rn)
    obj(nw, { h: o.newelH == null ? 7 : o.newelH, col: o.newelCol || P.stone, a: 0.7, sd: Rn * 0.45, line: 1.25 })
    if (det >= 2 && Rn > 6) pen(ellP(0, 0, Rn * 0.5), 0.6, { flat: true, wob: 0.4 })
    if (o.ruin) pen([].concat(...outer), 1.5, { swell: 0.5, wob: 1.6, noCorner: true })
    else pen(disc, 1.5, { swell: 0.5 })
  }
  /** Plank grain across a wooden wedge, running out from the newel. */
  function woodWedge(i, w, b0, b1, d) {
    if (COL) tone(w, [P.wood, P.woodL, P.woodD][i % 3], 0.3)
    if (det < 2 || d > 0.9) return
    ctx.beginPath()
    for (let q = 0; q < 2; q++) { const a = b0 + (b1 - b0) * (0.3 + q * 0.4) + j(0.03), r0 = rr(10, 16), r1 = rr(34, 43); ctx.moveTo(...P2(r0, a)); for (let rad = r0 + 4; rad < r1; rad += 4) ctx.lineTo(...P2(rad, a + sin(rad * 0.3 + i) * 0.012)) }
    ctx.lineWidth = px(0.4); ctx.globalAlpha = 0.75; ctx.strokeStyle = INK; ctx.stroke(); ctx.globalAlpha = 1
    nail(...P2(40, (b0 + b1) / 2)); flushDots()
  }
  /** A ring of wall round the stair: coursed stone between two radii. */
  function wallRing(R0, R1) {
    const a = ellP(0, 0, R1), b = ellP(0, 0, R0)
    ctx.beginPath(); sub(a); sub(b); ctx.fillStyle = PAPER; ctx.fill('evenodd')
    ctx.save(); ctx.beginPath(); sub(a); sub(b); ctx.clip('evenodd')
    if (COL) tone(a, P.stone, 0.55)
    const n = Math.round((TAU * (R0 + R1)) / 2 / 9.5); ctx.beginPath()
    for (let i = 0; i < n; i++) { const q = (i / n) * TAU + j(0.02); ctx.moveTo(...P2(R0, q)); ctx.lineTo(...P2(R1, q)) }
    ctx.lineWidth = px(0.7); ctx.strokeStyle = INK; ctx.stroke()
    if (!COL && det >= 1) hatchIn(a, -0.79, 3.4, 0.4, { minG: 2 })
    ctx.restore()
    pen(a, 1.5); pen(b, 1.0, { swell: 0.3 })
  }
  const spirals = [
    // 0: stone
    () => spiralStairs(46, 8, 12, {}),
    // 1: wooden treads round a timber post
    () => spiralStairs(46, 7, 12, { col: P.wood, a: 0.35, tread: woodWedge, newelCol: P.woodD }),
    // 2: inside a ring of wall
    () => { spiralStairs(39, 7, 12, {}); wallRing(39, 46) },
    // 3: tight and narrow
    () => spiralStairs(36, 9, 9, {}),
    // 4: a collapsed stretch, rubble on the steps below
    () => spiralStairs(46, 8, 12, { missing: [5, 6], rubble: true }),
    // 5: iron: thin treads with the dark showing between them
    () => spiralStairs(46, 5, 14, { gap: 1.3, col: P.iron, a: 0.55, newelCol: P.iron, newelH: 5, tread: (i, w, b0, b1, d) => { if (det >= 2 && d < 0.85) { const m = (b0 + b1) / 2; for (const rad of [18, 27, 36]) dot(...P2(rad, m), 0.5); flushDots() } } }),
    // 6: with a landing at the top
    () => spiralStairs(46, 8, 11, { spans: (i) => (i === 0 ? 2.6 : 1) }),
    // 7: ruined
    () => spiralStairs(46, 8, 12, { ruin: true, missing: [7], rubble: true, tread: (i, w, b0, b1, d) => { if (det >= 1 && d < 0.8 && r() < 0.5) { const m = (b0 + b1) / 2; line([P2(rr(14, 20), m + j(0.1)), P2(rr(26, 32), m + j(0.1)), P2(rr(36, 42), m + j(0.1))], 0.5, { taper: 0.5, wob: 0.9 }) } } }),
  ]
  reg('dg-spiral', 'Spiral stairs', 'dg-features', 'fixed', spirals)

  /* =====================================================================================================
     Pillars (s = 50): a round column seen from above, radius ~35, on a base ring; and a square one, ~70 across.
     ===================================================================================================== */
  function column(cx, cy, R, o) {
    o = o || {}
    if (o.base !== 0) obj(ellP(cx, cy, o.base || R * 1.26), { h: 3, col: P.stone, a: 0.6, sd: R * 0.26, line: 1.1 })
    const top = o.pts || ellP(cx, cy, R)
    obj(top, { h: o.h == null ? 11 : o.h, col: o.col || P.stoneL, a: 0.7, sd: o.sd == null ? R * 0.4 : o.sd, line: 1.5, wob: o.wob })
    if (o.inner !== false && det >= 1) pen(ellP(cx, cy, R * 0.7), 0.7, { flat: true, wob: 0.5 })
    return top
  }
  /** The rough face of a break: stipple and short scratches, in colour a darker stone. */
  function breakFace(pts) {
    if (COL) tone(pts, P.stoneD, 0.3)
    if (det >= 1) { stipIn(pts, det >= 2 ? 40 : 16, 0.5); const b = bbox(pts); ctx.save(); clipTo(pts); ctx.beginPath(); for (let i = 0; i < (det >= 2 ? 26 : 10); i++) { const x = rr(b.x0, b.x1), y = rr(b.y0, b.y1), a = rr(0, TAU), l = rr(2, 5); ctx.moveTo(x, y); ctx.lineTo(x + cos(a) * l, y + sin(a) * l) } ctx.lineWidth = px(0.45); ctx.strokeStyle = INK; ctx.stroke(); ctx.restore() }
  }
  /** A fallen column drum lying on the floor: a short cylinder with flutes along it and a cut face at one end. */
  function drum(cx, cy, L, W, ang) {
    const f = F(cx, cy, ang), pts = rrect(cx, cy, L, W, W * 0.3, ang)
    obj(pts, { h: 4, col: P.stoneL, a: 0.7, sd: W * 0.35, line: 1.25 })
    if (det >= 1) { ctx.beginPath(); for (const v of [-0.28, 0, 0.28]) { ctx.moveTo(...f(-L / 2 + 2, v * W)); ctx.lineTo(...f(L / 2 - W * 0.3, v * W + j(0.3))) } ctx.lineWidth = px(0.5); ctx.strokeStyle = INK; ctx.stroke() }
    const e = ellP(...f(L / 2 - W * 0.16, 0), W * 0.16, W * 0.44, ang); paper(e); if (COL) tint(e, P.stone, 0.6); pen(e, 0.7, { flat: true })
  }
  const pillars = [
    // 0: plain
    () => column(0, 0, 35, {}),
    // 1: fluted
    () => {
      column(0, 0, 35, { inner: false })
      if (det >= 1) { const n = det >= 2 ? 20 : 12, a0 = r() * TAU; for (let i = 0; i < n; i++) { const a = a0 + (i / n) * TAU; seg(cos(a) * 24.5, sin(a) * 24.5, cos(a) * 33.5, sin(a) * 33.5) } flush(0.55) }
      pen(ellP(0, 0, 24), 0.7, { flat: true, wob: 0.5 })
    },
    // 2: cracked, a chip out of the rim
    () => {
      column(0, 0, 35, {})
      line([[-31, -10], [-16, -4], [-7, 7], [4, 10], [8, 18]], 0.75, { taper: 0.4, wob: 0.9 })
      line([[-16, -4], [-12, -14]], 0.5, { taper: 0.5, wob: 0.8 })
      if (det >= 1) line([[9, -30], [12, -18], [20, -12]], 0.55, { taper: 0.5, wob: 0.8 })
      const notch = [P2(35.5, 0.75), [cos(0.9) * 28, sin(0.9) * 28], [cos(1.05) * 31, sin(1.05) * 31], P2(35.5, 1.15)]
      paper(notch); if (COL) tone(notch, P.stoneD, 0.35); else hatchIn(notch, 0.3, 1.8, 0.45, { minG: 1.3 }); pen(notch, 0.8, { flat: true, wob: 1.2 })
    },
    // 3: a broken stump with fallen drums beside it
    () => {
      obj(ellP(0, -4, 40), { h: 3, col: P.stone, a: 0.6, sd: 9, line: 1.1 })
      const stump = jig(blob(0, -4, 27, 26, 0, 14, 0.07, 3), 0.6)
      obj(stump, { h: 6, col: P.stoneD, a: 0.45, sd: 8, line: 1.4, wob: 1.6 })
      breakFace(scaleP(stump, 0, -4, 0.9))
      drum(14, 34, 46, 20, -0.12)
      drum(-33, 22, 26, 17, 1.0)
      for (const [x, y, s, a] of [[-14, 42, 2.4, 0.3], [38, 18, 2, 1.2], [-40, -8, 1.8, 2.2], [34, -24, 2.2, 0.6]]) chip(x, y, s, a)
    },
    // 4: on a square plinth
    () => { obj(jig(rectP(0, 0, 82, 82, 0.0), 0.3), { h: 3, col: P.stone, a: 0.6, sd: 10, line: 1.2 }); column(0, 0, 33, { base: 0 }) },
    // 5: roots and ivy over it
    () => {
      column(0, 0, 35, {})
      const rootCol = COL ? P.woodD : INK
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU + 0.4 + j(0.2), pts = [P2(18 + j(4), a), P2(29, a + j(0.12)), P2(37, a + j(0.15)), P2(46, a + j(0.2))]
        line(cr(pts, false, 4), 1.5, { taper: 0.25, wob: 0.8, col: rootCol })
        if (det >= 1) { const q = pts[2]; line([q, [q[0] + cos(a + 0.9) * 6, q[1] + sin(a + 0.9) * 6]], 0.7, { taper: 0.5, wob: 0.6, col: rootCol }) }
      }
      if (det >= 1) for (let i = 0; i < (det >= 2 ? 9 : 5); i++) { const a = r() * TAU, d = rr(10, 40), lf = ellP(cos(a) * d, sin(a) * d, 3.2, 2, a + 0.6, 7); paper(lf); if (COL) tint(lf, P.moss, 0.7); pen(lf, 0.55, { flat: true }) }
    },
    // 6: carved rosette on the capital
    () => {
      column(0, 0, 35, { inner: false })
      pen(ellP(0, 0, 27), 0.7, { flat: true, wob: 0.5 })
      if (det >= 1) { for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + PI / 8, pt = ellP(cos(a) * 14, sin(a) * 14, 7.5, 4, a, 9); paper(pt); if (COL) tint(pt, P.stone, 0.45); pen(pt, 0.6, { flat: true, wob: 0.4 }) } }
      ball(0, 0, 5, P.stone, { line: 0.8 })
      if (det >= 2) { for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; seg(cos(a) * 29, sin(a) * 29, cos(a) * 33, sin(a) * 33) } flush(0.5) }
    },
    // 7: a slim pair on one oval base
    () => { obj(ellP(0, 0, 46, 28, 0), { h: 3, col: P.stone, a: 0.6, sd: 7, line: 1.1 }); column(-20, 0, 17, { base: 0, h: 9, sd: 7 }); column(20, 0, 17, { base: 0, h: 9, sd: 7 }) },
  ]
  reg('dg-pillar', 'Pillar', 'dg-features', 'fixed', pillars)

  function sqColumn(pts, o) {
    o = o || {}
    obj(pts, { h: o.h == null ? 11 : o.h, col: o.col || P.stoneL, a: 0.7, sd: o.sd == null ? 13 : o.sd, line: 1.5, wob: o.wob })
    if (o.innerPts && det >= 1) pen(o.innerPts, 0.7, { flat: true, wob: 0.5 })
  }
  const sqBase = (s, ang) => obj(jig(rectP(0, 0, s, s, ang || 0.02), 0.3), { h: 3, col: P.stone, a: 0.6, sd: s * 0.12, line: 1.1 })
  const sqPillars = [
    // 0: plain
    () => { sqBase(84); sqColumn(rectP(0, 0, 68, 68, 0.02), { innerPts: rectP(0, 0, 48, 48, 0.02) }) },
    // 1: chamfered corners
    () => { sqBase(84); const c = 11, s = 34, pts = [[-s + c, -s], [s - c, -s], [s, -s + c], [s, s - c], [s - c, s], [-s + c, s], [-s, s - c], [-s, -s + c]]; sqColumn(pts, { innerPts: scaleP(pts, 0, 0, 0.68) }) },
    // 2: buttressed: a cross-shaped footprint
    () => {
      const s = 26, a = 10, e = 38
      const pts = [[-a, -e], [a, -e], [a, -s], [s, -s], [s, -a], [e, -a], [e, a], [s, a], [s, s], [a, s], [a, e], [-a, e], [-a, s], [-s, s], [-s, a], [-e, a], [-e, -a], [-s, -a], [-s, -s], [-a, -s]]
      obj(jig(scaleP(pts, 0, 0, 1.18), 0.3), { h: 3, col: P.stone, a: 0.6, sd: 7, line: 1.1 })
      sqColumn(pts, { sd: 9, innerPts: rectP(0, 0, 36, 36, 0) })
    },
    // 3: cracked, a corner gone
    () => {
      sqBase(84)
      const pts = [[-34, -34], [34, -34], [34, 22], [27, 26], [30, 34], [-34, 34]]
      sqColumn(pts, { innerPts: rectP(0, 0, 48, 48, 0) })
      line([[-34, -6], [-18, -2], [-10, 8], [2, 12], [6, 24], [4, 34]], 0.75, { taper: 0.4, wob: 0.9 })
      if (det >= 1) { line([[-18, -2], [-14, -16]], 0.5, { taper: 0.5, wob: 0.8 }); line([[20, -34], [16, -22], [22, -14]], 0.55, { taper: 0.5, wob: 0.8 }) }
      const corner = [[34, 22], [27, 26], [30, 34], [34, 34]]; paper(corner); if (COL) tone(corner, P.stoneD, 0.35); else hatchIn(corner, 0.4, 1.8, 0.45, { minG: 1.3 }); pen(corner, 0.8, { flat: true, wob: 1.2 })
      chip(42, 42, 2.4, 0.5)
    },
    // 4: a ruined stump
    () => {
      sqBase(82)
      const stump = jig([[-28, -30], [-6, -29], [10, -24], [27, -27], [30, -4], [24, 14], [28, 29], [4, 26], [-12, 31], [-29, 24], [-25, 2]], 1.2)
      obj(stump, { h: 5, col: P.stoneD, a: 0.45, sd: 8, line: 1.4, wob: 1.6 })
      breakFace(scaleP(stump, 0, 0, 0.88))
      block(40, 30, 10, 7, 0.4, { h: 2 }); block(-40, -30, 8, 6, 1.9, { h: 2 })
      for (const [x, y, s, a] of [[-38, 36, 2.4, 0.3], [40, -36, 2, 1.2], [36, 44, 1.8, 2.2]]) chip(x, y, s, a)
    },
    // 5: carved capital: a diamond and a boss
    () => {
      sqBase(84)
      sqColumn(rectP(0, 0, 68, 68, 0.0), {})
      pen(rectP(0, 0, 44, 44, PI / 4), 0.8, { flat: true, wob: 0.5 })
      if (det >= 1) { pen(rectP(0, 0, 50, 50, 0), 0.6, { flat: true, wob: 0.5 }); for (const [x, y] of [[-25, -25], [25, -25], [25, 25], [-25, 25]]) { ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.lineWidth = px(0.6); ctx.strokeStyle = INK; ctx.stroke() } }
      ball(0, 0, 6, P.stone, { line: 0.9 })
    },
    // 6: brick
    () => {
      sqBase(84)
      const pts = rectP(0, 0, 68, 68, 0.0)
      obj(pts, { h: 11, col: P.ochre, a: 0.35, sd: 13, line: 1.5 })
      ctx.save(); clipTo(pts); ctx.beginPath()
      const ch = det >= 2 ? 8.5 : 11.3, bl = ch * 2.1
      let row = 0
      for (let y = -34; y < 34; y += ch, row++) { ctx.moveTo(-34, y); ctx.lineTo(34, y + j(0.3)); for (let x = -34 + (row % 2 ? bl / 2 : 0); x < 34; x += bl) { ctx.moveTo(x, y); ctx.lineTo(x + j(0.2), y + ch) } }
      ctx.lineWidth = px(0.55); ctx.strokeStyle = INK; ctx.stroke()
      if (COL) { row = 0; for (let y = -34; y < 34; y += ch, row++) for (let x = -34 + (row % 2 ? bl / 2 : 0) - bl; x < 34; x += bl) if (r() < 0.4) tone([[x, y], [x + bl, y], [x + bl, y + ch], [x, y + ch]], r() < 0.5 ? P.red : P.rust, 0.28) }
      ctx.restore()
      if (det >= 1) shadeIn(pts, 13)
      pen(pts, 1.5)
    },
    // 7: a wooden post on a stone footing
    () => {
      obj(jig(rectP(0, 0, 66, 66, 0.0), 0.3), { h: 2, col: P.stone, a: 0.6, sd: 7, line: 1.1 })
      const post = rectP(0, 0, 46, 46, 0.04)
      obj(post, { h: 10, col: P.woodD, a: 0.65, sd: 9, line: 1.4 })
      // end grain: rings round a heart off to one side, a drying crack
      if (det >= 1) { for (let i = 1; i <= (det >= 2 ? 4 : 2); i++) { const q = i * (det >= 2 ? 4.2 : 8); ctx.beginPath(); ctx.ellipse(-5, -3, q * 1.1, q, 0.3, 0, TAU); ctx.lineWidth = px(0.45); ctx.strokeStyle = INK; ctx.stroke() } }
      line([[-5, -3], [8, 6], [21, 10]], 0.7, { taper: 0.4, wob: 0.7 })
      pen(rectP(0, 0, 40, 40, 0.04), 0.6, { flat: true, wob: 0.4 })
    },
  ]
  reg('dg-pillar-square', 'Square pillar', 'dg-features', 'fixed', sqPillars)

  /* =====================================================================================================
     Pits (s = 140): an opening in the floor, dark inside, the far wall showing on the upper-left.
     ===================================================================================================== */
  const pitRound = (R) => blob(0, 0, R || 44, (R || 44) * 0.98, 0, 16, 0.025, 3)
  /** A bed of sharpened stakes, tips toward the viewer and the light. */
  function stakes(region) {
    const b = bbox(region), ps = []
    for (let y = b.y0 + 8; y < b.y1 - 4; y += 13) for (let x = b.x0 + 8; x < b.x1 - 4; x += 13) ps.push([x + j(2.5), y + j(2.5)])
    ps.sort((p, q) => p[1] - q[1])
    ctx.save(); clipTo(scaleP(region, 0, 0, 0.9))
    for (const [x, y] of ps) {
      const a = -2.1 + j(0.25), L = rr(10, 14), f = F(x, y, a), pts = [f(0, -1.8), f(L * 0.5, -1.0), f(L, 0), f(L * 0.5, 1.0), f(0, 1.8), f(-1.2, 0)]
      paper(pts); if (COL) tint(pts, P.boneD, 0.6); pen(pts, 0.65, { flat: true, wob: 0.5 })
      if (det >= 2) { seg(...f(1.5, -0.3), ...f(L * 0.6, -0.2)); flush(0.35) }
    }
    ctx.restore()
    if (det >= 2) { skull(-6, 20, 5.5, 0.9); longBone([14, 26], [30, 18], 2.4, {}) }
  }
  /** Boards laid across a hole; o.broken = index of one that has given way. */
  function planksAcross(ys, L, w, o) {
    o = o || {}
    ys.forEach((y, i) => {
      if (i === o.broken) {
        const a = [[-L / 2, y - w / 2], [-4, y - w / 2 + 1], [-9, y + 1], [-3, y + w / 2], [-L / 2, y + w / 2]]
        shadow(a, 4); paper(a); if (COL) tone(a, P.wood, 0.5); pen(a, 1.1, { wob: 1.2 })
        const f = F(2, y + 2, 0.12), bq = [f(0, -w / 2 + 1), f(L / 2 - 1, -w / 2 - 2), f(L / 2, w / 2 - 1), f(5, w / 2 - 1), f(2, 0)]
        paper(bq); if (COL) { tone(bq, P.wood, 0.5); tone(bq, P.shade, 0.3) } else hatchIn(bq, 0.12, 2.6, 0.4, { minG: 1.8 }); pen(bq, 1.1, { wob: 1.0 })
        return
      }
      const pts = rectP(0, y, L, w, 0)
      shadow(pts, 4)
      plankRect(0, y, L, w, 0, { n: 1, pw: w, seed: i, nails: false })
      if (det >= 2) { nail(-L / 2 + 5, y); nail(L / 2 - 5, y); flushDots() }
      pen(pts, 1.15)
    })
  }
  const pits = [
    // 0: round pit
    () => pit(pitRound(), { deep: 0.8 }),
    // 1: square pit, its walls built of blocks
    () => pit(jig(rectP(0, 0, 86, 86, 0.01), 0.5), { deep: 0.8, fw: 10, joint: 8.5 }),
    // 2: spiked pit
    () => { const p = jig(rectP(0, 0, 84, 84, 0), 0.5); pit(p, { deep: 0.5, fw: 8, inside: () => stakes(p) }) },
    // 3: planks laid across, one broken through
    () => { pit(pitRound(), { deep: 0.8 }); planksAcross([-27, -9, 9, 27], 104, 11, { broken: 2 }) },
    // 4: the floor has fallen in: cracked flags tilting over the edge
    () => {
      const hole = blob(0, 0, 36, 32, 0.4, 10, 0.26, 3)
      pit(hole, { deep: 0.86, fw: 6, wob: 1.6 })
      const rim = resample(hole, 1)
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + 0.3 + j(0.15); let best = rim[0], bd = 1e9
        for (const p of rim) { const d = abs(((atan2(p[1], p[0]) - a + PI * 3) % TAU) - PI); if (d < bd) { bd = d; best = p } }
        const d0 = hypot(best[0], best[1]), cx = cos(a) * (d0 + 4), cy = sin(a) * (d0 + 4), w = rr(13, 19), h = rr(10, 14)
        const sl = jig(rectP(cx, cy, w, h, a + PI / 2 + j(0.2)), 0.8), f = F(cx, cy, a)
        obj(sl, { h: 1.5, col: [P.stone, P.stoneL][i % 2], a: 0.7, sd: 3.5, line: 1.1 })
        if (i % 3 === 0) { const inn = [f(-w / 2, -h / 2), f(-w * 0.1, -h / 2), f(-w * 0.1, h / 2), f(-w / 2, h / 2)]; ctx.save(); clipTo(sl); if (COL) tone(inn, P.shade, 0.35); else hatchIn(inn, a + 0.3, 2, 0.45, { minG: 1.5 }); ctx.restore() }
      }
      for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU + 0.9 + j(0.3), p0 = P2(42 + j(4), a), p1 = P2(49 + j(3), a + j(0.1)), p2 = P2(rr(54, 62), a + j(0.15)); line([p0, p1, p2], 0.7, { taper: 0.5, wob: 1 }); if (det >= 2 && r() < 0.6) line([p1, P2(rr(52, 58), a + j(0.3) + 0.2)], 0.45, { taper: 0.6, wob: 0.8 }) }
      for (let i = 0; i < (det >= 2 ? 9 : 4); i++) { const a = r() * TAU, d = rr(40, 52); chip(cos(a) * d, sin(a) * d, rr(1.6, 2.6), r() * PI) }
    },
    // 5: water at the bottom
    () => {
      const p = pitRound()
      pit(p, { deep: 0.3, inside: () => {
        const w = scaleP(p, 5, 5, 0.76)
        paper(w); if (COL) tint(w, P.waterD, 0.85)
        ctx.save(); clipTo(w)
        if (!COL) hatchBox(-40, -40, 50, 50, 0.0, 2.6, 0.45)
        shadeIn(w, 14, { rev: true, col: 'rgba(10,20,25,0.5)', inkToo: true, gap: 1.5 })
        ctx.beginPath(); for (let i = 0; i < (det >= 1 ? 3 : 1); i++) { const q = 8 + i * 7; ctx.moveTo(8 + q * cos(0.4), 7 + q * sin(0.4)); ctx.arc(8, 7, q, 0.4, 0.4 + rr(1.4, 2.6)) } ctx.lineWidth = px(0.55); ctx.strokeStyle = COL ? '#d8e6df' : PAPER; ctx.stroke()
        ctx.restore()
        pen(w, 1.0, { swell: -0.5 })
      } })
    },
    // 6: bottomless
    () => pit(blob(0, 0, 44, 43, 0, 16, 0.04, 3), { deep: 1, face: false, line: 1.8 }),
    // 7: a rope tied off to a ring in the floor and dropped down
    () => {
      const p = pitRound(40)
      /** Rope as a pale ribbon with an inked edge and twist marks (ochre in colour), so it shows on dark and light alike. */
      const rope = (pts, w, fade) => {
        line(pts, w + 1.2, { taper: fade ? 0.9 : 0.15, wob: 0.4, col: INK })
        line(pts, w, { taper: fade ? 0.9 : 0.15, wob: 0.4, col: COL ? P.ochre : PAPER })
        if (det >= 2) { const Q = densify(pts, false, 2.6); ctx.beginPath(); for (let i = 1; i < Q.length - 1; i += 1) { const a = Q[i - 1], b = Q[i + 1], d = hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / d, ny = (b[0] - a[0]) / d; ctx.moveTo(Q[i][0] - nx * w * 0.4 + (b[0] - a[0]) / d * 0.5, Q[i][1] - ny * w * 0.4 + (b[1] - a[1]) / d * 0.5); ctx.lineTo(Q[i][0] + nx * w * 0.4 - (b[0] - a[0]) / d * 0.5, Q[i][1] + ny * w * 0.4 - (b[1] - a[1]) / d * 0.5) } ctx.lineWidth = px(0.4); ctx.strokeStyle = INK; ctx.stroke() }
      }
      pit(p, { deep: 0.8, fw: 8, inside: () => {
        // over the rim, down the far wall, then lost in the dark
        rope([[-29, -27], [-24.5, -22.5], [-20, -18], [-13, -11]], 2.2, true)
      } })
      const an = [-43, -40]
      ring(an[0], an[1], 2.4, 4.8, P.iron, { w: 1.1 })
      rope([[an[0] + 3, an[1] + 3], [-35, -33], [-29, -27]], 2.2, false)
      // the slack, coiled beside the ring
      const coil = []; for (let i = 0; i < 44; i++) { const a = i * 0.42 + 1.2, rad = 2.4 + i * 0.16; coil.push([-42 + cos(a) * rad, -24 + sin(a) * rad * 0.72]) }
      rope(coil, 1.9, false)
    },
  ]
  reg('dg-pit', 'Pit', 'dg-features', 'fixed', pits)

  /* =====================================================================================================
     Rubble (recipe, s = 100): a heap and scatter of broken masonry, thickest in the middle.
     ===================================================================================================== */
  reg('dg-rubble', 'Rubble', 'dg-features', 'recipe', [() => {
    const heap = blob(0, 0, 40, 34, r() * PI, 12, 0.3, 3)
    if (COL) tint(heap, P.earthD, 0.16)
    if (det >= 1) stipIn(heap, det >= 2 ? 80 : 30, 0.5)
    const N = det >= 2 ? 26 : det >= 1 ? 17 : 10, bs = []
    // a few big slabs under everything, then the heap: bigger blocks toward the middle, piled higher
    for (let i = 0; i < 3; i++) { const a = r() * TAU, d = rr(4, 16); bs.push([cos(a) * d, sin(a) * d * 0.85, rr(20, 30), rr(12, 18), r() * PI, 60 + d]) }
    for (let i = 0; i < N; i++) { const a = r() * TAU, d = 38 * Math.pow(r(), 0.7), sc = 1 - (d / 38) * 0.5; bs.push([cos(a) * d, sin(a) * d * 0.85, rr(10, 20) * sc, rr(7, 13) * sc, r() * PI, d]) }
    bs.sort((p, q) => q[5] - p[5]) // outer first, the heap's crown on top
    for (const [x, y, w, h, a, d] of bs) block(x, y, w, h, a, { h: d > 50 ? 2 : 2 + (1 - d / 38) * 4 })
    for (let i = 0; i < N; i++) { const a = r() * TAU, d = rr(10, 50); chip(cos(a) * d, sin(a) * d * 0.9, rr(1.6, 3.4), r() * PI) }
    if (det >= 1) { ctx.beginPath(); for (let i = 0; i < (det >= 2 ? 40 : 16); i++) { const a = r() * TAU, d = rr(20, 52), q = rr(0.4, 0.9) / k * lw; ctx.moveTo(cos(a) * d + q, sin(a) * d * 0.9); ctx.arc(cos(a) * d, sin(a) * d * 0.9, q, 0, TAU) } ctx.fillStyle = INK; ctx.fill() }
  }])

  /* =====================================================================================================
     Bones (recipe, s = 70): a scatter of bones and a skull or two; sometimes a whole skeleton lying there.
     ===================================================================================================== */
  function longBone(a, b, w, o) {
    o = o || {}
    const L = hypot(b[0] - a[0], b[1] - a[1]), ang = atan2(b[1] - a[1], b[0] - a[0]), f = F(a[0], a[1], ang)
    const pts = cr([f(0, -w * 0.95), f(L * 0.14, -w * 0.42), f(L * 0.86, -w * 0.42), f(L, -w), f(L + w * 0.45, -w * 0.2), f(L + w * 0.4, w * 0.3), f(L, w), f(L * 0.86, w * 0.42), f(L * 0.14, w * 0.42), f(0, w * 0.95), f(-w * 0.45, w * 0.3), f(-w * 0.4, -w * 0.2)], true, 3)
    obj(pts, { h: o.h == null ? 1.5 : o.h, col: P.bone, a: 0.75, sd: w * 0.45, line: o.line || 0.85, wob: 0.6 })
    if (det >= 2 && L > 14) { seg(...f(w * 0.3, -w * 0.5), ...f(w * 0.6, w * 0.5)); seg(...f(L - w * 0.3, -w * 0.5), ...f(L - w * 0.6, w * 0.5)); flush(0.4) }
  }
  /** A skull lying face up; the face points along ang. */
  function skull(x, y, R, ang) {
    const f = F(x, y, ang)
    const cr0 = cr([f(-R, 0), f(-R * 0.85, -R * 0.75), f(-R * 0.2, -R), f(R * 0.5, -R * 0.8), f(R * 0.9, -R * 0.45), f(R, 0), f(R * 0.9, R * 0.45), f(R * 0.5, R * 0.8), f(-R * 0.2, R), f(-R * 0.85, R * 0.75)], true, 3)
    obj(cr0, { h: 2.5, col: P.bone, a: 0.75, sd: R * 0.45, line: 1.0, wob: 0.5 })
    for (const v of [-1, 1]) { const e = ellP(...f(R * 0.3, v * R * 0.36), R * 0.24, R * 0.3, ang, 8); poly(e); ctx.fillStyle = INK; ctx.fill() }
    if (det >= 1) { const n = [f(R * 0.66, -R * 0.1), f(R * 0.8, R * 0.04), f(R * 0.66, R * 0.14)]; poly(n); ctx.fillStyle = INK; ctx.fill() }
    if (det >= 1) { ctx.beginPath(); for (let v = -0.4; v <= 0.41; v += 0.2) { ctx.moveTo(...f(R * 0.88, v * R)); ctx.lineTo(...f(R, v * R)) } ctx.lineWidth = px(0.45); ctx.strokeStyle = INK; ctx.stroke() }
  }
  /** A rib: a thin curved bone. */
  function rib(cx, cy, R, a0, a1, w) {
    const pts = arcP(cx, cy, R + w / 2, (R + w / 2) * 0.85, a0, a1).concat(arcP(cx, cy, R - w / 2, (R - w / 2) * 0.85, a1, a0))
    obj(pts, { h: 1, col: P.bone, a: 0.75, shade: 0, line: 0.7, wob: 0.5 })
  }
  const vertebra = (x, y, ang) => obj(ellP(x, y, 2.6, 2, ang, 8), { col: P.bone, a: 0.75, shade: 0, line: 0.6 })
  /** A whole skeleton lying on its back, head at u = -44, feet at u = +46, along angle ang. */
  function skeleton(ang) {
    const f = F(0, 0, ang), g = (u, v) => f(u, v)
    if (COL) tint(blob(0, 0, 50, 22, ang, 10, 0.2, 3), P.earthD, 0.1)
    // legs, then arms, under the trunk
    for (const sg of [-1, 1]) {
      longBone(g(10, sg * 5), g(28, sg * 9), 3.2, {}); longBone(g(29, sg * 9.5), g(46, sg * 10), 2.6, {}); longBone(g(29, sg * 7.5), g(45, sg * 7.5), 1.6, { line: 0.6 })
      for (let q = 0; q < 3; q++) longBone(g(47 + q * 0.5, sg * (8 + q * 2)), g(51 + q * 0.6, sg * (9 + q * 2.4)), 0.9, { line: 0.5, h: 0 })
      longBone(g(-26, sg * 8), g(-14, sg * 16), 2.8, {}); longBone(g(-13, sg * 16), g(-1, sg * 20), 2.2, {}); longBone(g(-13, sg * 14.5), g(-2, sg * 17.8), 1.5, { line: 0.6 })
      for (let q = 0; q < 4; q++) longBone(g(0 + q * 1.4, sg * (21 + q * 1.2)), g(4 + q * 1.6, sg * (23 + q * 1.6)), 0.9, { line: 0.5, h: 0 })
      longBone(g(-28, sg * 2), g(-26, sg * 9), 1.6, { line: 0.6, h: 0 })
    }
    // spine, ribs, pelvis
    for (let u = -29; u <= 2; u += 3.6) vertebra(...g(u, 0), ang)
    for (let i = 0; i < 6; i++) { const u = -26 + i * 3.4, R = 10 + 2.2 * sin((i / 5) * PI); for (const sg of [-1, 1]) rib(...g(u + 4, sg * 2), R, ang + (sg < 0 ? -PI / 2 - 1.3 : PI / 2 + 1.3), ang + (sg < 0 ? -PI / 2 - 0.1 : PI / 2 + 0.1), 1.6) }
    for (const sg of [-1, 1]) obj(cr([g(2, sg * 1.5), g(4, sg * 8), g(10, sg * 9), g(12, sg * 4), g(9, sg * 1.5)], true, 3), { h: 1.5, col: P.bone, a: 0.75, sd: 2.5, line: 0.8 })
    skull(...g(-39, 0), 7.5, ang + PI + 0.35)
  }
  reg('dg-bones', 'Bones', 'dg-furnishings', 'recipe', [() => {
    if (r() < 0.35) { skeleton(rr(-0.6, 0.6) + (r() < 0.5 ? PI : 0)); return }
    const pts = []
    for (let t = 0; pts.length < (det >= 1 ? 12 : 7) && t < 200; t++) { const a = r() * TAU, d = 40 * sqrt(r()); const p = [cos(a) * d, sin(a) * d * 0.9]; if (pts.every((q) => hypot(q[0] - p[0], q[1] - p[1]) > 9)) pts.push(p) }
    pts.sort((p, q) => p[1] - q[1])
    if (det >= 1) { ctx.beginPath(); for (let i = 0; i < 18; i++) { const a = r() * TAU, d = rr(8, 46), q = rr(0.35, 0.7) / k * lw; ctx.moveTo(cos(a) * d + q, sin(a) * d); ctx.arc(cos(a) * d, sin(a) * d, q, 0, TAU) } ctx.fillStyle = INK; ctx.fill() }
    const ns = r() < 0.3 ? 2 : 1
    pts.forEach((p, i) => {
      if (i < ns) { skull(p[0], p[1], rr(6.5, 8), r() * TAU); return }
      const q = r()
      if (q < 0.42) { const a = r() * TAU, L = rr(14, 30); longBone([p[0] - cos(a) * L / 2, p[1] - sin(a) * L / 2], [p[0] + cos(a) * L / 2, p[1] + sin(a) * L / 2], rr(2.4, 3.6), {}) }
      else if (q < 0.64) { const a = r() * TAU; rib(p[0], p[1], rr(8, 12), a, a + rr(1.4, 2.2), 1.6) }
      else if (q < 0.8) { const a = r() * TAU; for (let v = 0; v < 3; v++) vertebra(p[0] + cos(a) * v * 4, p[1] + sin(a) * v * 4, a) }
      else { const a = r() * TAU, L = rr(6, 10); longBone([p[0] - cos(a) * L / 2, p[1] - sin(a) * L / 2], [p[0] + cos(a) * L / 2, p[1] + sin(a) * L / 2], rr(1.4, 2), { line: 0.6 }) }
    })
  }])

  /* =====================================================================================================
     Braziers (s = 50): an iron bowl of coals on legs, lit or cold.
     ===================================================================================================== */
  /** The coal bed in a bowl of radius R; o.ash = cold grey ash instead. */
  function coals(cx, cy, R, o) {
    o = o || {}
    const bed = ellP(cx, cy, R)
    if (COL) tint(bed, o.ash ? P.ash : P.coal, o.ash ? 0.55 : 0.85)
    else { ctx.save(); clipTo(bed); hatchBox(cx - R, cy - R, cx + R, cy + R, 0.7, o.ash ? 3.4 : 1.9, 0.5, { minG: 1.4 }); if (!o.ash) hatchBox(cx - R, cy - R, cx + R, cy + R, -0.6, 2.4, 0.45, { minG: 1.5 }); ctx.restore() }
    const n = det >= 1 ? (o.n || 7) : 4, u = R / 24
    for (let i = 0; i < n; i++) {
      const a = r() * TAU, d = R * 0.72 * sqrt(r()), x = cx + cos(a) * d, y = cy + sin(a) * d, b = blob(x, y, rr(2.6, 4.4) * u, rr(2, 3.4) * u, r() * PI, 7, 0.2, 3)
      paper(b); if (COL) tint(b, o.ash ? P.stoneD : P.coal, 0.85); else if (!o.ash) hatchIn(b, 1.2, 1.6, 0.5, { minG: 1.2 })
      pen(b, 0.6, { flat: true, wob: 0.6 })
      if (!o.ash && COL && det >= 1) solidDot(x + j(1), y + j(1), 0.9 * u, P.flameR)
    }
    if (o.ash && det >= 1) stipIn(bed, det >= 2 ? 50 : 20, 0.5)
  }
  /** The bowl: a flat iron rim round a dark bed. */
  function bowl(cx, cy, R, o) {
    o = o || {}
    const rim = o.rim || ellP(cx, cy, R), Ri = R * (o.inner || 0.74), inn = ellP(cx, cy, Ri)
    shadow(rim, o.h == null ? 9 : o.h)
    paper(rim); if (COL) tint(rim, P.iron, 0.7)
    if (!COL && det >= 1) hatchIn(rim, 0.9, 3.2, 0.4, { minG: 2 })
    if (det >= 1) shadeIn(rim, R * 0.26, { gap: 2.0 })
    pen(rim, 1.5)
    paper(inn)
    if (o.inside) o.inside(inn, Ri); else coals(cx, cy, Ri, o)
    pen(inn, 0.9, { swell: -0.5 })
  }
  /** n legs splayed out from under the bowl. */
  function legs(n, r0, r1, w, o) {
    o = o || {}
    for (let i = 0; i < n; i++) {
      const a = (o.a0 == null ? -PI / 2 : o.a0) + (i / n) * TAU, bq = bar(P2(r0, a), P2(r1, a), w)
      obj(bq, { h: o.h == null ? 3 : o.h, col: P.iron, a: 0.7, sd: w * 0.4, line: 1 })
      if (o.feet) ball(...P2(r1, a), w * 0.75, P.iron, { line: 0.8 })
    }
  }
  const braziers = [
    // 0: an iron bowl on three legs, burning
    () => { glow(0, 0, 50); legs(3, 20, 42, 6, { feet: true }); bowl(0, 0, 32, {}); flames(0, 0, 0.72, {}) },
    // 1: cold, full of ash
    () => { legs(3, 20, 42, 6, { feet: true }); bowl(0, 0, 32, { ash: true }); if (det >= 1) { line([[-12, 4], [8, -6]], 1.6, { taper: 0.2, wob: 0.5, col: COL ? P.coal : INK }); line([[-4, -10], [6, 8]], 1.4, { taper: 0.2, wob: 0.5, col: COL ? P.coal : INK }) } },
    // 2: a tall tripod
    () => { glow(0, 0, 50); legs(3, 14, 47, 4.2, { feet: true, h: 6, a0: -PI / 2 + 0.3 }); bowl(0, 0, 24, { h: 12 }); flames(0, 0, 0.6, {}) },
    // 3: a standing stone bowl on a round foot
    () => { glow(0, 0, 50); obj(ellP(0, 0, 40), { h: 4, col: P.stone, a: 0.6, sd: 9, line: 1.2 }); if (det >= 1) pen(ellP(0, 0, 34), 0.6, { flat: true, wob: 0.5 }); bowl(0, 0, 29, { h: 8, inner: 0.7, rim: null }); flames(0, 0, 0.68, {}) },
    // 4: a stone fire pit ring
    () => {
      glow(0, 0, 52)
      const burn = blob(0, 0, 30, 30, 0, 12, 0.1, 3); paper(burn); coals(0, 0, 28, { n: 6 })
      const ns = 9, ph = r() * TAU, sts = []
      for (let i = 0; i < ns; i++) { const a = ph + (i / ns) * TAU + j(0.06); sts.push([cos(a) * 36, sin(a) * 36, a]) }
      sts.sort((p, q) => p[1] - q[1])
      for (const [x, y, a] of sts) { const b = blob(x, y, rr(9, 11.5), rr(6.5, 8.5), a + PI / 2, 9, 0.12, 3); obj(b, { h: 3.5, col: [P.stone, P.stoneL, P.stoneD][(r() * 3) | 0], a: 0.8, sd: 4.5, line: 1.25 }) }
      flames(0, 0, 0.72, {})
    },
    // 5: large and ornate: a scalloped rim, a band of studs, four clawed legs
    () => {
      glow(0, 0, 54)
      legs(4, 26, 44, 7, { feet: true, a0: PI / 4 })
      const rim = []; for (let i = 0; i < 64; i++) { const a = (i / 64) * TAU; rim.push(P2(38 + 1.6 * abs(sin(a * 6)), a)) }
      bowl(0, 0, 38, { rim, inner: 0.7, h: 10 })
      if (det >= 1) { for (let i = 0; i < 12; i++) dot(...P2(32.5, (i / 12) * TAU), 0.6); flushDots() }
      flames(0, 0, 0.8, {})
    },
    // 6: hung from chains
    () => {
      glow(0, 0, 50)
      for (let i = 0; i < 3; i++) {
        const a = -PI / 2 + 0.5 + (i / 3) * TAU, p0 = P2(22, a), p1 = P2(47, a)
        for (let t = 0; t < 1; t += 0.11) { const q = lerp(p0, p1, t), e = ellP(q[0], q[1], 1.9, 1.1, a, 6); paper(e); if (COL) tone(e, P.iron, 0.6); pen(e, 0.55, { flat: true, noCorner: true }) }
        solidDot(p1[0], p1[1], 1.6, INK)
      }
      bowl(0, 0, 27, { h: 14 })
      flames(0, 0, 0.64, {})
    },
    // 7: cold and kicked over, the coals spilled out
    () => {
      const a = 0.5, f = F(0, 0, a)
      // spill: ash and coals fanning out of the mouth
      const fan = cr([f(10, -8), f(30, -22), f(46, -8), f(44, 12), f(28, 20), f(10, 8)], true, 3)
      if (COL) tint(fan, P.ash, 0.35); if (det >= 1) stipIn(fan, det >= 2 ? 70 : 25, 0.5)
      for (let i = 0; i < (det >= 1 ? 8 : 4); i++) { const b = blob(...f(rr(12, 40), rr(-14, 12)), rr(2.4, 4), rr(1.8, 3), r() * PI, 7, 0.2, 3); paper(b); if (COL) tint(b, P.coal, 0.85); else hatchIn(b, 1.2, 1.6, 0.5, { minG: 1.2 }); pen(b, 0.6, { flat: true }) }
      // legs sticking out behind, the bowl on its side
      for (const v of [-1, 1]) { const bq = bar(f(-14, v * 8), f(-34, v * 22), 5.5); obj(bq, { h: 3, col: P.iron, a: 0.7, sd: 2, line: 1 }) }
      const body = ellP(-10, 0, 30, 21, a); obj(body, { h: 5, col: P.iron, a: 0.7, sd: 8, line: 1.5 })
      const mouth = ellP(...f(8, 0), 7, 21, a); paper(mouth); if (COL) tint(mouth, P.coal, 0.75); else hatchIn(mouth, a + 0.3, 1.8, 0.5, { minG: 1.3 }); pen(mouth, 1.0, { swell: 0.4 })
      if (det >= 1) { ctx.beginPath(); ctx.ellipse(-10, 0, 26, 17, a, 0, TAU); ctx.lineWidth = px(0.5); ctx.strokeStyle = INK; ctx.stroke() }
      const leg3 = bar(f(-30, 0), f(-46, -4), 5.5); obj(leg3, { h: 3, col: P.iron, a: 0.7, sd: 2, line: 1 })
    },
  ]
  reg('dg-brazier', 'Brazier', 'dg-furnishings', 'fixed', braziers)

  /* =====================================================================================================
     Wall torches (s = 35): a sconce on a wall that runs along y = -40, the bracket reaching out toward +y.
     ===================================================================================================== */
  const WALL = -40
  function plate(w, h) { const p = rectP(0, WALL + h / 2, w, h, 0); obj(p, { col: P.iron, a: 0.7, shade: 0, line: 0.9 }); if (det >= 1) { nail(-w / 2 + 2.5, WALL + h / 2); nail(w / 2 - 2.5, WALL + h / 2); flushDots() } }
  function bracket(x0, y0, x1, y1, w) { obj(bar([x0, y0], [x1, y1], w || 4.6), { h: 3, col: P.iron, a: 0.7, sd: 1.6, line: 1 }) }
  /** The bound head of a torch, seen from above. */
  function torchHead(x, y, o) {
    o = o || {}
    const hd = rrect(x, y, 13, 17, 5, 0)
    obj(hd, { h: 4, col: o.col || P.woodD, a: 0.78, sd: 4, line: 1.1 })
    if (det >= 1) { seg(x - 6, y - 3, x + 6, y - 2); seg(x - 6, y + 3, x + 6, y + 4); flush(0.5) }
  }
  const torches = [
    // 0: a lit torch
    () => { glow(0, -2, 44); plate(18, 5); bracket(0, WALL + 4, 0, -14); torchHead(0, -6, {}); flames(0, -2, 0.74, {}) },
    // 1: unlit
    () => { plate(18, 5); bracket(0, WALL + 4, 0, -14); torchHead(0, -6, { col: P.coal }) },
    // 2: a lantern on an arm
    () => {
      glow(0, -4, 40)
      plate(14, 5); bracket(0, WALL + 4, 0, -22, 4)
      const bx = rrect(0, -8, 19, 19, 3, 0); obj(bx, { h: 5, col: P.iron, a: 0.65, sd: 4, line: 1.2 })
      const win = rectP(0, -8, 12, 12, 0); paper(win); if (COL) tint(win, P.flameL, 0.8); pen(win, 0.7, { flat: true })
      if (det >= 1) { rule([-6, -8], [6, -8], 0.5, { over: 0 }); rule([0, -14], [0, -2], 0.5, { over: 0 }) }
      solidDot(0, -8, 1.6, COL ? P.flameR : INK)
    },
    // 3: a candle sconce
    () => {
      glow(0, -22, 36)
      plate(26, 5)
      const sh = rectP(0, -29, 28, 9, 0); obj(sh, { h: 4, col: P.iron, a: 0.7, sd: 3, line: 1.1 })
      for (const x of [-9, 0, 9]) { ball(x, -29, 3.4, P.canvas, { line: 0.8 }); const p = flameP(x, -27, 7, 4.5, PI / 2 + j(0.3), j(0.4)); paper(p); if (COL) { ctx.save(); ctx.globalAlpha = 0.85; ctx.fillStyle = P.flame; poly(p); ctx.fill(); ctx.restore() } line(p.concat([p[0]]), 0.8, { taper: 0.5, wob: 0.4 }) }
      if (det >= 1) { dot(-6, -26, 0.5); dot(3, -25, 0.45); dot(12, -26, 0.5); flushDots() }
    },
    // 4: burned out, a smear of soot on the wall and the last of the smoke
    () => {
      plate(18, 5); bracket(0, WALL + 4, 0, -14)
      const soot = cr([[-14, WALL], [-10, WALL + 2], [0, WALL + 4], [10, WALL + 2], [14, WALL]], true, 2)
      if (COL) tone(soot, P.coal, 0.35); else if (det >= 1) stipIn(soot, 30, 0.5)
      torchHead(0, -6, { col: P.coal })
      if (det >= 1) { const sm = []; for (let i = 0; i <= 8; i++) sm.push([3 + sin(i * 0.9) * 3.5 + i * 0.6, 2 + i * 3.2]); line(sm, 0.7, { taper: 0.7, wob: 0.8 }) }
    },
    // 5: a double sconce
    () => { glow(0, -2, 50); plate(24, 5); bracket(0, WALL + 4, -11, -14); bracket(0, WALL + 4, 11, -14); torchHead(-11, -6, {}); torchHead(11, -6, {}); flames(-11, -2, 0.58, {}); flames(11, -2, 0.58, {}) },
    // 6: held in a skull's jaws
    () => {
      glow(0, 0, 44); plate(18, 5); bracket(0, WALL + 4, 0, -22)
      skull(0, -16, 9, PI / 2)
      torchHead(0, -2, {}); flames(0, 2, 0.7, {})
    },
    // 7: a cold magic flame
    () => {
      glow(0, -2, 44, P.cold); plate(18, 5); bracket(0, WALL + 4, 0, -14); torchHead(0, -6, { col: P.stoneD })
      flames(0, -2, 0.72, { cool: true, sparks: false })
      for (let i = 0; i < (det >= 1 ? 5 : 3); i++) { const a = r() * TAU, d = rr(14, 26), x = cos(a) * d, y = -2 + sin(a) * d, s = rr(1.2, 2.2); seg(x - s, y, x + s, y); seg(x, y - s, x, y + s) }
      flush(0.5, COL ? P.cold : INK)
    },
  ]
  reg('dg-torch', 'Wall torch', 'dg-furnishings', 'fixed', torches)
})(window.Atlas)
