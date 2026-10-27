/* Map furniture and sea decoration for the Warded Atlas: compass roses, cartouches, scale bars,
   ships, sea serpents, clouds, wave marks and whirlpools. Hand-inked pen look, same linework in
   ink and colour mode (colour only adds soft washes). Needs common.js (window.Atlas). */
;(function (A) {
  'use strict'
  const R = A.R
  const TAU = Math.PI * 2
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
  const lerp = (a, b, t) => a + (b - a) * t
  const lerpP = (p, q, t) => [lerp(p[0], q[0], t), lerp(p[1], q[1], t)]

  /* accent colours for colour mode (washes only) */
  const GOLD = '#c9a24a', RED = '#a63d2b', PARCH = '#d9bb7c', WOOD = '#a98258', CLOUD = '#b9c6c6', STEEL = '#b4bcc0'
  const FONT = (px, italic) => `${italic ? 'italic ' : ''}${px}px "IM Fell English", Georgia, serif`

  /* ---------- geometry helpers: everything works in a 100-unit design box ---------- */
  const bez = (a, b, c, d, n = 10) => {
    const o = []
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t
      o.push([u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]])
    }
    return o
  }
  const arc = (cx, cy, rx, ry, a0, a1, n = 14) => {
    const o = []
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; o.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]) }
    return o
  }
  /* Catmull-Rom through points */
  const cr = (pts, n = 6, closed = false) => {
    const out = [], m = pts.length
    const g = (i) => closed ? pts[(i + m) % m] : pts[clamp(i, 0, m - 1)]
    const segs = closed ? m : m - 1
    for (let i = 0; i < segs; i++) {
      const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2)
      for (let k = 0; k < n; k++) {
        const t = k / n, t2 = t * t, t3 = t2 * t
        out.push([0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)])
      }
    }
    if (!closed) out.push(pts[m - 1])
    return out
  }
  const rotP = (pts, a, ox = 0, oy = 0) => { const c = Math.cos(a), s = Math.sin(a); return pts.map(([x, y]) => [ox + (x - ox) * c - (y - oy) * s, oy + (x - ox) * s + (y - oy) * c]) }
  const mirX = (pts) => pts.map(([x, y]) => [-x, y])
  const rev = (pts) => pts.slice().reverse()
  const shift = (pts, dx, dy) => pts.map(([x, y]) => [x + dx, y + dy])
  /* a polygon ribbon around a centreline; hw(t) is the half-width */
  const tube = (c, hw) => {
    const L = [], Rr = []
    for (let i = 0; i < c.length; i++) {
      const a = c[Math.max(0, i - 1)], b = c[Math.min(c.length - 1, i + 1)], d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
      const nx = -(b[1] - a[1]) / d, ny = (b[0] - a[0]) / d, w = hw(i / (c.length - 1))
      L.push([c[i][0] + nx * w, c[i][1] + ny * w]); Rr.push([c[i][0] - nx * w, c[i][1] - ny * w])
    }
    return { L, R: Rr, poly: L.concat(Rr.slice().reverse()) }
  }
  const sine = (x0, y0, len, amp, per = 1.5, n = 14, ph = 0) => {
    const o = []
    for (let i = 0; i <= n; i++) { const t = i / n; o.push([x0 + len * t, y0 + Math.sin(ph + t * per * TAU) * amp]) }
    return o
  }
  const star = (ro, ri, n, rot = 0) => {
    const o = []
    for (let i = 0; i < n * 2; i++) { const a = rot - Math.PI / 2 + i * Math.PI / n, rr = i % 2 ? ri : ro; o.push([Math.cos(a) * rr, Math.sin(a) * rr]) }
    return o
  }
  const volute = (cx, cy, r0, turns, dir = 1, a0 = 0) => {
    const pts = [], n = Math.max(8, Math.round(turns * 9))
    for (let i = 0; i <= n; i++) { const t = i / n, a = a0 + dir * t * turns * TAU, rad = r0 * (1 - 0.86 * t); pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]) }
    return pts
  }

  /* ---------- the pen: maps design units to pixels and draws hand-inked marks ---------- */
  function makePen(ctx, x, y, s, r, st, flip = false, wmul = 1, unit = 100) {
    const k = s / unit, f = clamp(Math.sqrt(s / 60), 0.62, 1.5), lw = st.line * f * wmul, fx = flip ? -1 : 1
    const pt = (p) => [x + fx * p[0] * k, y + p[1] * k]
    const pp = (pts) => pts.map(pt)
    const P = {
      ctx, r, st, k, f, lw, s, pt, pp, ink: st.ink, paper: st.paper,
      move(dx, dy) { x += dx * k * fx; y += dy * k },
      detail: s < 30 ? 0 : s < 52 ? 1 : 2,
      colour: st.mode === 'colour',
      /* w is a pen width in px at s=60 (scaled by size and st.line); {units:true} makes it design units */
      stroke(pts, w = 1.1, o = {}) {
        const wpx = o.units ? Math.max(0.45, w * k) : w * lw
        A.inkStroke(ctx, pp(pts), r, { w: wpx, wob: (o.wob === undefined ? 0.3 : o.wob) * f, taper: o.taper === undefined ? 0.55 : o.taper, color: o.color || st.ink })
      },
      fill(pts, color) { ctx.fillStyle = color || st.paper; A.poly(ctx, pp(pts)); ctx.fill() },
      solid(pts) { P.fill(pts, st.ink) },
      wash(pts, color, alpha = 0.5) { if (!P.colour) return; const q = pp(pts); A.wash(ctx, () => A.poly(ctx, q), color, r, alpha) },
      dot(p, rad, color) { const q = pt(p); ctx.fillStyle = color || st.ink; ctx.beginPath(); ctx.arc(q[0], q[1], Math.max(0.42, rad * k), 0, TAU); ctx.fill() },
      ring(p, rad, w = 0.7, o = {}) { P.stroke(arc(p[0], p[1], rad, rad, 0, TAU, Math.max(10, Math.round(rad * 2.2))), w, { taper: 0.15, wob: 0.15, ...o }) },
      /* hatching inside polygon `poly` (units), optionally also clipped to `and` */
      hatch(poly, o = {}) {
        const gap = Math.max((o.gap || 3) * k, 1.9 * f), q = pp(poly)
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
        for (const p of q) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1] }
        const q2 = o.and ? pp(o.and) : null
        let ang = o.angle === undefined ? 1.0 : o.angle
        if (flip) ang = Math.PI - ang
        A.hatch(ctx, () => { if (q2) { A.poly(ctx, q2); ctx.clip() } A.poly(ctx, q) }, [x0, y0, x1, y1], r, { angle: ang, gap, w: (o.w || 0.6) * lw, wob: 0.25 * f, color: st.ink, jitter: 0.25 })
      },
      stipple(poly, n, size = 0.55) {
        const q = pp(poly); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
        for (const p of q) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1] }
        A.stipple(ctx, () => A.poly(ctx, q), [x0, y0, x1, y1], r, { n, size: Math.max(0.4, size * f), color: st.ink })
      },
      /* text at a design-unit position; size in design units; skipped when too tiny to read */
      text(str, p, size, o = {}) {
        const px = size * k; if (px < 6.5) return
        const q = pt(p); ctx.save(); ctx.font = FONT(Math.round(px), o.italic); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = o.color || st.ink; ctx.fillText(str, q[0], q[1]); ctx.restore()
      },
      textPx(str, p, px, o = {}) {
        const q = pt(p); ctx.save(); ctx.font = FONT(Math.round(px), o.italic); ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = o.color || st.ink; ctx.fillText(str, q[0], q[1]); ctx.restore()
      },
    }
    return P
  }

  /* =====================================================================
     COMPASS ROSES
     ===================================================================== */
  /* one rose point: kite from the centre to a tip at angle a (0 = north, clockwise).
     Left half is inked solid (or hatched), right half stays light, as on printed roses. */
  function kite(P, a, len, wid, sh, o = {}) {
    const c = Math.cos(a), sn = Math.sin(a), T = (lx, ly) => [lx * c - ly * sn, lx * sn + ly * c]
    const tip = T(0, -len), Lp = T(-wid, -sh), Rp = T(wid, -sh), C = [0, 0]
    P.fill([tip, Lp, C, Rp])
    if (P.colour && o.col) P.wash([tip, C, Rp], o.col, o.alpha || 0.55)
    if (o.hatch && P.detail >= 1) {
      P.hatch([tip, Lp, C], { angle: a + Math.PI / 2, gap: o.hatch, w: 0.5 })
      P.stroke([C, Lp, tip], o.w || 0.8, { taper: 0.3, wob: 0.15 })
    } else P.solid([tip, Lp, C])
    P.stroke([tip, Rp, C], o.w || 0.8, { taper: 0.3, wob: 0.15 })
  }
  function fleur(P, cx, y0, h) {
    const w = h * 0.27
    P.solid(cr([[cx, y0 - h], [cx + w, y0 - h * 0.66], [cx + w * 0.6, y0 - h * 0.34], [cx, y0 - h * 0.14], [cx - w * 0.6, y0 - h * 0.34], [cx - w, y0 - h * 0.66]], 5, true))
    for (const sg of [-1, 1]) {
      P.stroke(bez([cx + sg * w * 0.3, y0 - h * 0.24], [cx + sg * h * 0.4, y0 - h * 0.7], [cx + sg * h * 0.7, y0 - h * 0.55], [cx + sg * h * 0.52, y0 - h * 0.28], 9), h * 0.12, { units: true, taper: 0.8, wob: 0.08 })
      P.stroke(bez([cx + sg * h * 0.52, y0 - h * 0.28], [cx + sg * h * 0.44, y0 - h * 0.14], [cx + sg * h * 0.26, y0 - h * 0.2], [cx + sg * h * 0.3, y0 - h * 0.3], 6), h * 0.07, { units: true, taper: 0.4, wob: 0.05 })
    }
    P.stroke([[cx - w * 1.05, y0 - h * 0.2], [cx + w * 1.05, y0 - h * 0.2]], h * 0.09, { units: true, taper: 0.2, wob: 0.05 })
    P.solid([[cx - w * 0.55, y0 - h * 0.12], [cx + w * 0.55, y0 - h * 0.12], [cx, y0 + h * 0.06]])
  }
  const polar = (a, rr) => [Math.sin(a) * rr, -Math.cos(a) * rr]
  const letters = (P, dist, size, set, o = {}) => {
    const L = set || ['N', 'E', 'S', 'W']
    L.forEach((ch, i) => { if (ch) P.text(ch, polar(i * Math.PI / 2, dist), size, o) })
  }
  const ticks = (P, r0, r1, n, w = 0.5, every = 0) => {
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU, big = every && i % every === 0
      P.stroke([polar(a, r0), polar(a, big ? r1 + 1.6 : r1)], w, { taper: 0.1, wob: 0.05 })
    }
  }
  const disc = (rr, n = 36) => arc(0, 0, rr, rr, 0, TAU, n)

  const COMPASS = [
    /* 0: ornate 16-point rose, fleur-de-lis north (Middle-earth) */
    (P) => {
      const rr = 28
      P.fill(disc(rr)); P.wash(disc(rr, 30), GOLD, 0.4)
      for (let i = 0; i < 8; i++) kite(P, (i + 0.5) / 8 * TAU, 24, 2.9, 6, { w: 0.5 })
      for (let i = 0; i < 4; i++) kite(P, (i + 0.5) / 4 * TAU, 31, 4.6, 8.5, { col: GOLD, w: 0.7 })
      P.ring([0, 0], rr, 1.1); P.ring([0, 0], rr - 2.6, 0.55)
      if (P.detail) ticks(P, rr - 2.6, rr, 48, 0.4)
      for (let i = 0; i < 4; i++) kite(P, i * Math.PI / 2, i ? 37 : 33, 6.6, 9.5, { col: i ? GOLD : RED })
      P.ring([0, 0], 3.2, 0.7); P.dot([0, 0], 1.2)
      fleur(P, 0, -32.5, 16)
      letters(P, 44.5, 9.5, [null, 'E', 'S', 'W'])
    },
    /* 1: simple star with N/E/S/W letters, hollow centre (Midkemia) */
    (P) => {
      for (let i = 0; i < 4; i++) kite(P, (i + 0.5) * Math.PI / 2, 27, 2.7, 6.5, { col: GOLD })
      for (let i = 0; i < 4; i++) kite(P, i * Math.PI / 2, 34, 7.8, 11.5, { col: i ? GOLD : RED })
      P.solid(star(12.5, 5.8, 8, Math.PI / 8)); P.fill(star(8, 3.6, 8, Math.PI / 8)); P.ring([0, 0], 2, 0.6)
      P.ring([0, 0], 14.5, 0.5)
      letters(P, 43, 12, ['n', 'e', 's', 'w'])
    },
    /* 2: dagger-shaped north arrow (Genabackis) */
    (P) => {
      P.text('N', [0, -46], 13)
      const blade = [[0, -41], [3.3, -26], [5.3, -5], [5.3, 9], [-5.3, 9], [-5.3, -5], [-3.3, -26]]
      P.fill(blade); P.wash(blade, STEEL, 0.5)
      P.solid([[0, -41], [-3.3, -26], [-5.3, -5], [-5.3, 9], [0, 9]])
      if (P.detail) {
        P.stroke([[0.7, -35], [0.7, 7]], 0.55, { taper: 0.5, wob: 0.1 })
        P.hatch([[0.9, -34], [4.8, -22], [4.8, 8], [0.9, 8]], { angle: 1.52, gap: 1.8, w: 0.4, and: blade })
      }
      P.stroke([[0, -41], [3.3, -26], [5.3, -5], [5.3, 9]], 0.9, { taper: 0.25, wob: 0.12 })
      // guard with end balls
      const guard = [[-17, 9], [17, 9], [17, 13.2], [-17, 13.2]]
      P.fill(guard); P.wash(guard, GOLD, 0.6)
      P.stroke([[-17, 9], [17, 9]], 0.9, { taper: 0.2, wob: 0.08 }); P.stroke([[-17, 13.2], [17, 13.2]], 0.9, { taper: 0.2, wob: 0.08 })
      P.solid([[-17, 9], [-17, 13.2], [-0.5, 13.2], [-0.5, 12]])
      for (const sg of [-1, 1]) { const c = [sg * 19.4, 11.1]; P.fill(disc3(c[0], c[1], 3.6)); P.wash(disc3(c[0], c[1], 3.6), GOLD, 0.6); P.ring(c, 3.6, 0.9); P.dot([c[0] - 0.7, c[1] - 0.6], 1.1) }
      // grip with wrapped bands
      const grip = [[-3, 13.2], [3, 13.2], [3.6, 30], [-3.6, 30]]
      P.fill(grip); P.solid([[-3, 13.2], [0, 13.2], [0, 30], [-3.6, 30]])
      P.stroke([[3, 13.2], [3.6, 30]], 0.8, { taper: 0.2, wob: 0.08 })
      if (P.detail) for (let yy = 15; yy < 30; yy += 2.7) P.stroke([[-3.4, yy], [3.5, yy + 1.2]], 0.55, { taper: 0.3, wob: 0.03, color: P.paper })
      // pommel: three balls
      for (const [px, py, rd] of [[0, 35.4, 4.5], [-5.6, 31.6, 2.7], [5.6, 31.6, 2.7]]) { P.fill(disc3(px, py, rd)); P.wash(disc3(px, py, rd), GOLD, 0.6); P.ring([px, py], rd, 0.9); P.dot([px - rd * 0.2, py - rd * 0.15], rd * 0.3) }
    },
    /* 3: eight-point rose in double ring with N arrow (sepia Middle-earth) */
    (P) => {
      const rr = 27
      P.fill(disc(rr)); P.wash(disc(rr, 30), PARCH, 0.45)
      for (let i = 0; i < 4; i++) kite(P, (i + 0.5) / 4 * TAU, 25, 3.8, 7, { hatch: 1.7, w: 0.6 })
      P.ring([0, 0], rr, 1.0); P.ring([0, 0], rr - 3.3, 0.5)
      if (P.detail) ticks(P, rr - 3.3, rr, 64, 0.35, 8)
      for (let i = 0; i < 4; i++) kite(P, i * Math.PI / 2, i ? 35 : 38, 6.2, 9, { col: i ? GOLD : RED })
      P.ring([0, 0], 4.4, 0.7); P.ring([0, 0], 2, 0.5)
      letters(P, 44.5, 9.5, [null, 'E', 'S', 'W'], { italic: true })
      P.text('N', [0, -46], 10, { italic: true })
    },
    /* 4: spear-shaped north arrow with two interlocked rings (Wheel of Time) */
    (P) => {
      const spear = cr([[0, -45], [4.6, -35], [5, -27], [0, -23], [-5, -27], [-4.6, -35]], 5, true)
      P.fill(spear); P.wash(spear, STEEL, 0.55)
      P.solid([[0, -45], [-4.6, -35], [-5, -27], [0, -23]])
      if (P.detail) P.hatch([[0.8, -40], [4.4, -34], [4.6, -27], [0.8, -24.5]], { angle: 1.4, gap: 1.5, w: 0.4, and: spear })
      P.stroke([[0, -45], [4.6, -35], [5, -27], [0, -23]], 0.9, { taper: 0.3, wob: 0.1 })
      // shaft with a socket collar
      P.fill([[-1.4, -23], [1.4, -23], [1.5, 46], [-1.5, 46]]); P.stroke([[-1.4, -23], [-1.5, 46]], 0.8, { taper: 0.2, wob: 0.08 }); P.stroke([[1.4, -23], [1.5, 46]], 0.8, { taper: 0.2, wob: 0.08 })
      P.solid([[-2.8, -24], [2.8, -24], [2.2, -18.5], [-2.2, -18.5]])
      P.stroke([[-2.6, -16], [2.6, -16]], 1.0, { taper: 0.2, wob: 0.03 })
      // two interlocked rings (double-lined), woven with paper patches over the under-strand
      const rad = 12.5, rin = 10.6, c1 = [-6.8, 8], c2 = [6.8, 8], ia = Math.acos(6.8 / rad)
      const ringBoth = (c, a0, a1) => { P.stroke(arc(c[0], c[1], rad, rad, a0, a1, 24), 1.1, { taper: 0.15, wob: 0.05 }); P.stroke(arc(c[0], c[1], rin, rin, a0, a1, 24), 0.7, { taper: 0.15, wob: 0.05 }) }
      ringBoth(c1, 0, TAU); ringBoth(c2, 0, TAU)
      const weave = (under, over, ua, oa) => {
        const cp = polar2(under, ua, (rad + rin) / 2)
        P.fill(arc(cp[0], cp[1], 2.7, 2.7, 0, TAU, 10), P.paper)
        ringBoth(over, oa - 0.34, oa + 0.34)
      }
      weave(c2, c1, Math.PI + ia, -ia) // top crossing: ring 1 passes over ring 2
      weave(c1, c2, ia, Math.PI - ia) // bottom crossing: ring 2 passes over ring 1
      // ribbon curl and tassel beneath the rings
      P.stroke(bez([-13, 29], [-4, 24], [5, 35], [14, 30], 12), 1.2, { taper: 0.7, wob: 0.1 })
      P.stroke(bez([-10, 33], [-2, 30], [5, 39], [11, 36], 12), 0.8, { taper: 0.7, wob: 0.1 })
      P.solid([[0, 47], [-1.8, 42], [1.8, 42]])
      P.text('N', [10, -37], 9, { italic: true })
    },
    /* 5: four-point star in a ring with ticks and a cross-bar */
    (P) => {
      const rr = 30
      P.fill(disc(rr)); P.wash(disc(rr, 30), PARCH, 0.4)
      P.ring([0, 0], rr, 1.1); P.ring([0, 0], rr - 3, 0.5); P.ring([0, 0], 15, 0.5)
      if (P.detail) ticks(P, rr - 3, rr, 72, 0.35, 9)
      P.stroke([[-rr + 3, 0], [rr - 3, 0]], 0.45, { taper: 0.1, wob: 0.05 }); P.stroke([[0, -rr + 3], [0, rr - 3]], 0.45, { taper: 0.1, wob: 0.05 })
      for (let i = 0; i < 4; i++) kite(P, (i + 0.5) / 4 * TAU, 20, 2.6, 5, { w: 0.5, hatch: 1.4 })
      for (let i = 0; i < 4; i++) kite(P, i * Math.PI / 2, 31, 5.2, 8.5, { hatch: 1.5, col: i ? GOLD : RED })
      P.dot([0, 0], 1.6)
      P.solid([[0, -41.5], [-2.6, -36], [0, -33.5], [2.6, -36]])
      letters(P, 43.5, 9.5, [null, 'E', 'S', 'W'])
    },
    /* 6: portolan rose with long rhumb lines */
    (P) => {
      const n = 16
      for (let i = 0; i < n; i++) {
        const a = i / n * TAU, long = i % 2 === 0
        P.stroke([polar(a, 6), polar(a, long ? 49 : 39)], long ? 0.6 : 0.4, { taper: 0.3, wob: 0.1 })
        if (long && P.detail) P.dot(polar(a, 49.5), 0.9)
      }
      const rr = 19
      P.fill(disc(rr)); P.wash(disc(rr, 30), GOLD, 0.35)
      P.ring([0, 0], rr, 0.9); P.ring([0, 0], rr - 2.4, 0.45)
      for (let i = 0; i < 4; i++) kite(P, (i + 0.5) / 4 * TAU, 25, 3.2, 6.2, { w: 0.5 })
      for (let i = 0; i < 4; i++) kite(P, i * Math.PI / 2, i ? 31 : 35, 5.4, 8.6, { col: i ? GOLD : RED })
      P.ring([0, 0], 2.6, 0.6); P.dot([0, 0], 1)
      fleur(P, 0, -33, 11)
    },
    /* 7: laurel wreath around an eight-point rose with an arrowhead north */
    (P) => {
      const rr = 29.5, n = P.detail ? 20 : 10
      P.fill(disc(rr + 4)); P.wash(disc(rr + 4, 30), PARCH, 0.35)
      for (let i = 0; i < n; i++) {
        const a = (i + 0.5) / n * TAU, c = polar(a, rr), tx = Math.cos(a), ty = Math.sin(a)
        for (const side of [-1, 1]) { // two leaves per node, leaning along the circle
          const lx = c[0] - side * 0 * tx, ly = c[1]
          const ang = Math.atan2(ty, tx) + side * 0.5 + (side > 0 ? 0 : 0)
          leaf(P, lx, ly, ang + (side > 0 ? 0 : Math.PI), 5.6, 1.6, false)
        }
      }
      P.ring([0, 0], rr, 0.9); P.ring([0, 0], rr - 3.4, 0.5)
      for (let i = 0; i < 4; i++) kite(P, (i + 0.5) / 4 * TAU, 22, 3.3, 6.3, { w: 0.5, hatch: 1.5 })
      for (let i = 0; i < 4; i++) kite(P, i * Math.PI / 2, i ? 33 : 36, 6, 9, { col: i ? GOLD : RED })
      P.ring([0, 0], 4, 0.7); P.dot([0, 0], 1.3)
      // barbed arrowhead above the wreath
      P.solid([[0, -49], [-4.6, -38.5], [0, -41.4], [4.6, -38.5]])
      P.stroke([[0, -42], [0, -35]], 1.3, { taper: 0.2, wob: 0.05 })
    },
  ]
  const polar2 = (c, a, rr) => [c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr]
  const disc3 = (cx, cy, rr) => arc(cx, cy, rr, rr, 0, TAU, 14)

  A.register('compass-rose', {
    label: 'Compass rose', category: 'furniture', kind: 'fixed', view: 'furniture',
    draw(ctx, x, y, s, r, st, variant = 0) {
      ctx.save()
      const P = makePen(ctx, x, y, s, r, st)
      COMPASS[((variant % 8) + 8) % 8](P)
      ctx.restore()
    },
  })

  /* =====================================================================
     CARTOUCHES: title frames, 100 x 50 design units, centre left empty (filled with paper)
     ===================================================================== */
  const edge = (P, pts, w = 1.1, o = {}) => P.stroke(pts, w, { taper: 0.4, wob: 0.2, ...o })
  /* a scroll roll seen from the side, with its end cap showing the spiral */
  function roll(P, x0, x1, yc, h, capRight) {
    const ry = h / 2, cx = capRight ? x1 : x0, ox = capRight ? x0 : x1
    const body = [[x0, yc - ry], [x1, yc - ry], [x1, yc + ry], [x0, yc + ry]]
    P.fill(body); P.wash(body, PARCH, 0.6)
    if (P.detail) P.hatch([[x0, yc + ry * 0.1], [x1, yc + ry * 0.1], [x1, yc + ry], [x0, yc + ry]], { angle: 1.45, gap: 1.7, w: 0.45 })
    edge(P, [[x0, yc - ry], [x1, yc - ry]], 1.1); edge(P, [[x0, yc + ry], [x1, yc + ry]], 1.1)
    // open end: curved edge
    edge(P, arc(ox, yc, ry * 0.3, ry, capRight ? Math.PI / 2 : -Math.PI / 2, capRight ? Math.PI * 1.5 : Math.PI / 2, 8), 0.9)
    const cap = arc(cx, yc, ry * 0.92, ry, 0, TAU, 18)
    P.fill(cap); P.wash(cap, PARCH, 0.75); edge(P, cap, 0.9, { taper: 0.15 })
    const sp = []
    for (let i = 0; i <= 18; i++) { const a = i * 0.62 + 0.6, rad = 0.82 * (1 - i / 21); sp.push([cx + Math.cos(a) * rad * ry * 0.92, yc + Math.sin(a) * rad * ry]) }
    edge(P, sp, 0.6, { taper: 0.3, wob: 0.05 })
  }
  const leaf = (P, x, y, ang, len, wid, solid = true) => {
    const pts = [[0, 0], [len * 0.35, -wid], [len * 0.75, -wid * 0.7], [len, 0], [len * 0.75, wid * 0.7], [len * 0.35, wid]]
    const q = rotP(cr(pts, 3, true), ang).map(([a, b]) => [a + x, b + y])
    if (solid) P.solid(q); else { P.fill(q); edge(P, q.concat([q[0]]), 0.6, { taper: 0.2 }) }
  }

  const CARTOUCHE = [
    /* 0: unrolled scroll (Midkemia) */
    (P) => {
      const body = [].concat(
        bez([-41, -19], [-43.5, -8], [-39, 6], [-41.5, 19], 6),
        bez([-41.5, 19], [-16, 22.5], [16, 16], [40, 19], 12).slice(1),
        bez([40, 19], [42.5, 8], [38, -6], [41, -19], 6).slice(1),
        bez([41, -19], [16, -16.5], [-16, -22], [-41, -19], 12).slice(1))
      P.fill(body); P.wash(body, PARCH, 0.5)
      if (P.detail) {
        P.hatch([[-41, -17], [41, -17], [41, -13.2], [-41, -13.2]], { angle: 0.05, gap: 1.9, w: 0.4, and: body })
        P.hatch([[-41, 15.5], [41, 15.5], [41, 20], [-41, 20]], { angle: -0.05, gap: 2.2, w: 0.4, and: body })
      }
      edge(P, bez([-41, -19], [-43.5, -8], [-39, 6], [-41.5, 19], 8), 1.2)
      edge(P, bez([40, 19], [42.5, 8], [38, -6], [41, -19], 8), 1.2)
      roll(P, -42, 43, -22, 8.2, true)
      roll(P, -43, 42, 22.4, 8.2, false)
    },
    /* 1: ornate scrolled frame with twining vines (sepia Middle-earth) */
    (P) => {
      const X = 34.5, top = bez([-X, -14.6], [-14, -16.4], [14, -16.4], [X, -14.6], 14), bot = bez([X, 14.6], [14, 16.4], [-14, 16.4], [-X, 14.6], 14)
      const right = bez([X, -14.6], [X - 2.2, -5], [X - 2.2, 5], [X, 14.6], 8), left = bez([-X, 14.6], [-X + 2.2, 5], [-X + 2.2, -5], [-X, -14.6], 8)
      const panel = top.concat(right.slice(1), bot.slice(1), left.slice(1))
      // swooping ribbon under the panel, hatched like the originals
      for (const sg of [-1, 1]) {
        const rb = tube(bez([sg * 37, 12], [sg * 33, 22], [sg * 16, 24], [sg * 4, 19.5], 14), (t) => 1.2 + 2.6 * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (1 - t * 0.4))
        P.fill(rb.poly); P.wash(rb.poly, PARCH, 0.5)
        if (P.detail) P.hatch(rb.poly, { angle: sg < 0 ? 0.55 : -0.55, gap: 1.3, w: 0.5 })
        P.stroke(rb.L, 0.9, { taper: 0.3, wob: 0.1 }); P.stroke(rb.R, 0.9, { taper: 0.3, wob: 0.1 })
      }
      P.fill(panel); P.wash(panel, PARCH, 0.55)
      if (P.detail) P.stipple(panel.concat(rev(panel.map(([a1, c1]) => [a1 * 0.93, c1 * 0.8]))), P.detail >= 2 ? 90 : 40, 0.5)
      P.stroke(panel.concat([panel[0]]), 1.5, { taper: 0.1, wob: 0.2 })
      const ip = panel.map(([a1, c1]) => [a1 * 0.95, c1 * 0.84])
      P.stroke(ip.concat([ip[0]]), 0.55, { taper: 0.1, wob: 0.1 })
      // twining vines up each side, with thorns and curled tips
      for (const sg of [-1, 1]) {
        for (let k = 0; k < 2; k++) {
          const pts = []
          for (let i = 0; i <= 26; i++) { const t = i / 26; pts.push([sg * (X + 1.2 + Math.sin(t * TAU * 1.7 + k * Math.PI) * 2.4), -21 + t * 42]) }
          P.stroke(pts, 1.25, { taper: 0.5, wob: 0.1 })
          if (P.detail) for (let i = 3; i < 24; i += 4) { const q = pts[i + k], t2 = pts[i + k + 1]; P.solid([[q[0], q[1]], [q[0] + sg * 2.6, q[1] - 0.8], [t2[0], t2[1]]]) }
        }
        P.stroke(volute(sg * (X - 1.5), -21, 3.6, 1.4, sg, sg < 0 ? 0 : Math.PI), 1.0, { taper: 0.5, wob: 0.05 })
        P.stroke(volute(sg * (X - 1.5), 21.5, 3.6, 1.4, -sg, sg < 0 ? 0 : Math.PI), 1.0, { taper: 0.5, wob: 0.05 })
      }
      // top diamond with quatrefoil and tendrils
      const dm = [[0, -26.5], [6, -20], [0, -13.8], [-6, -20]]
      P.fill(dm); P.wash(dm, GOLD, 0.5); P.stroke(dm.concat([dm[0]]), 1.4, { taper: 0.1, wob: 0.1 })
      const dm2 = dm.map(([a1, c1]) => [a1 * 0.72, (c1 + 20) * 0.72 - 20])
      P.stroke(dm2.concat([dm2[0]]), 0.5, { taper: 0.1, wob: 0.05 })
      for (let i = 0; i < 4; i++) leaf(P, 0, -20, i * Math.PI / 2 - Math.PI / 4, 3.3, 1.1)
      for (const sg of [-1, 1]) {
        P.stroke(cr([[sg * 6, -20], [sg * 9.5, -23.5], [sg * 14, -22], [sg * 15, -19]], 5), 1.0, { taper: 0.7, wob: 0.05 })
        P.stroke(volute(sg * 15, -20, 2.6, 1.3, sg, sg < 0 ? 0.3 : Math.PI - 0.3), 0.8, { taper: 0.4, wob: 0.03 })
        P.stroke(cr([[sg * 6, -20], [sg * 12, -17.5], [sg * 18, -15.5]], 4), 0.6, { taper: 0.8, wob: 0.05 })
      }
      // bottom diamond, darker, with filigree
      const bd = [[0, 18.2], [4.2, 22], [0, 26.2], [-4.2, 22]]
      P.fill(bd); P.solid(bd); P.solid(arc(0, 22, 1, 1, 0, TAU, 6)); P.fill(arc(0, 22, 1.1, 1.1, 0, TAU, 6))
      for (const sg of [-1, 1]) {
        P.stroke(cr([[sg * 4, 22], [sg * 8, 25], [sg * 12, 24], [sg * 13.5, 21.5]], 5), 0.9, { taper: 0.7, wob: 0.05 })
        P.stroke(volute(sg * 13.2, 22, 2.2, 1.3, -sg, sg < 0 ? 0.3 : Math.PI - 0.3), 0.7, { taper: 0.4, wob: 0.03 })
      }
    },
    /* 2: ribbon banner with folded swallow-tails and a leaf cluster (Wheel of Time) */
    (P) => {
      P.move(0, -9.5)
      const topE = bez([-33, 1.5], [-20, -12.5], [20, -12.5], [33, 1.5], 16), botE = bez([-33, 17.5], [-20, 3.5], [20, 3.5], [33, 17.5], 16)
      // oak-style leaves fanning out beneath the middle
      const lobed = (cx, cy, size, phi) => {
        const dx = Math.sin(phi), dy = Math.cos(phi), px = Math.cos(phi), py = -Math.sin(phi), N = 22
        const W = size * 0.3, at = (u, v) => [cx + dx * size * u + px * v, cy + dy * size * u + py * v]
        const wid = (u) => W * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.72)), 0.85) * (0.8 + 0.2 * Math.cos(TAU * 3 * (u - 0.12)))
        const up = [], dn = []
        for (let i = 0; i <= N; i++) { const u = i / N; up.push(at(u, -wid(u))); dn.push(at(u, wid(u))) }
        const cl = up.concat(rev(dn))
        P.fill(cl); P.wash(cl, '#7d8c55', 0.55)
        if (P.detail) {
          P.hatch(cl, { angle: Math.atan2(dy, dx) + 0.5, gap: 1.5, w: 0.4, and: up.concat(rev(at(0.5, 0) ? dn.map(([a1, c1], i) => lerpP([a1, c1], at(i / N, 0), 0.35)) : dn)) })
          P.stroke([at(0.02, 0), at(0.96, 0)], 0.5, { taper: 0.7, wob: 0.03 })
          for (const u of [0.22, 0.42, 0.62, 0.8]) for (const sg of [-1, 1]) P.stroke([at(u, 0), at(u + 0.13, sg * wid(u + 0.13) * 0.85)], 0.4, { taper: 0.6, wob: 0.02 })
        }
        P.stroke(cl.concat([cl[0]]), 0.9, { taper: 0.15, wob: 0.08 })
      }
      for (const sg of [-1, 1]) {
        const tail = [[sg * 30, 3], [sg * 46, -2], [sg * 41, 7.5], [sg * 48, 16], [sg * 30, 19.5]]
        P.fill(tail); P.wash(tail, PARCH, 0.6)
        if (P.detail) P.hatch(tail, { angle: sg < 0 ? 0.8 : -0.8, gap: 1.35, w: 0.5 })
        P.stroke(tail, 1.1, { taper: 0.3, wob: 0.1 })
        P.solid([[sg * 33, 17.5], [sg * 29.5, 20.2], [sg * 33, 20.2]]); P.solid([[sg * 33, 1.5], [sg * 29.5, 4.2], [sg * 33, 4.2]])
      }
      const band = topE.concat(rev(botE))
      P.fill(band); P.wash(band, PARCH, 0.55)
      P.stroke(topE, 1.5, { taper: 0.25, wob: 0.12 }); P.stroke(botE, 1.5, { taper: 0.25, wob: 0.12 })
      P.stroke([[-33, 1.5], [-33, 17.5]], 1.2, { taper: 0.2, wob: 0.08 }); P.stroke([[33, 1.5], [33, 17.5]], 1.2, { taper: 0.2, wob: 0.08 })
      if (P.detail) { P.stroke(shift(topE, 0, 2.2), 0.5, { taper: 0.35, wob: 0.08 }); P.stroke(shift(botE, 0, -2.2), 0.5, { taper: 0.35, wob: 0.08 }) }
      for (const phi of [-1.15, 1.15, -0.6, 0.6, 0]) lobed(0, 12, phi === 0 ? 22 : 20, phi)
      P.fill(disc3(0, 16, 4.6)); P.wash(disc3(0, 16, 4.6), GOLD, 0.6); P.ring([0, 16], 4.6, 1.0)
      P.solid(arc(0, 16, 4.6, 4.6, -Math.PI / 2, Math.PI / 2, 8)); P.dot([0, 14], 0.8, P.paper); P.dot([0, 18], 0.8)
      // small curled tendrils either side of the leaves
      for (const sg of [-1, 1]) { P.stroke(volute(sg * 22, 12, 3, 1.3, -sg, sg < 0 ? 0.4 : Math.PI - 0.4), 0.9, { taper: 0.5, wob: 0.03 }); P.stroke(cr([[sg * 14, 10], [sg * 18, 14], [sg * 22, 12.5]], 5), 0.8, { taper: 0.7, wob: 0.03 }) }
    },
    /* 3: ruled double frame with inward sunburst wedges and corner flourishes (Malazan) */
    (P) => {
      const rect = (hx, hy) => [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]]
      const outer = rect(48, 24)
      P.fill(outer); P.wash(outer, PARCH, 0.5)
      // fine ornamental border
      P.stroke(rect(48, 24).concat([[-48, -24]]), 1.0, { taper: 0.05, wob: 0.15 }); P.stroke(rect(46.2, 22.2).concat([[-46.2, -22.2]]), 0.5, { taper: 0.05, wob: 0.1 })
      // heavy double rule
      P.stroke(rect(41.4, 19.6).concat([[-41.4, -19.6]]), 2.2, { taper: 0.05, wob: 0.2 }); P.stroke(rect(38.2, 16.6).concat([[-38.2, -16.6]]), 1.0, { taper: 0.05, wob: 0.15 })
      P.fill(rect(37.8, 16.2))
      // tapering wedges radiating inward from the frame toward the centre, in irregular bursts
      const wedge = (bx, by, len, wid) => {
        const dx = -bx / Math.hypot(bx, by), dy = -by / Math.hypot(bx, by)
        const nx = -dy, ny = dx
        P.solid([[bx + nx * wid, by + ny * wid], [bx + dx * len, by + dy * len], [bx - nx * wid, by - ny * wid]])
      }
      const hash = (i) => { const v = Math.sin(i * 12.9898 + 4.1) * 43758.5453; return v - Math.floor(v) }
      const nT = P.detail >= 2 ? 17 : P.detail ? 11 : 6, nS = P.detail >= 2 ? 7 : P.detail ? 5 : 3
      for (let i = 0; i < nT; i++) {
        const t = (i + 0.5) / nT, x = -36.5 + 73 * t, mid = Math.abs(t - 0.5) * 2, l = (3.8 + 9 * Math.pow(mid, 1.4)) * (0.65 + 0.7 * hash(i)), w = 0.9 + 0.9 * hash(i + 40)
        wedge(x, -15.8, l, w); wedge(x + 1.3 * (hash(i + 9) - 0.5), 15.8, l * (0.7 + 0.5 * hash(i + 20)), w)
      }
      for (let i = 0; i < nS; i++) {
        const t = (i + 0.5) / nS, y = -14.6 + 29.2 * t, mid = Math.abs(t - 0.5) * 2, l = (4 + 10 * Math.pow(mid, 1.2)) * (0.65 + 0.7 * hash(i + 60)), w = 0.9 + 0.8 * hash(i + 80)
        wedge(-36.5, y, l, w); wedge(36.5, y, l * (0.7 + 0.5 * hash(i + 70)), w)
      }
      // corner flourishes: little knots outside the rule
      for (const [sx2, sy2] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const cx = sx2 * 44.3, cy = sy2 * 21.6
        P.fill(disc3(cx, cy, 3.1)); P.ring([cx, cy], 3.1, 0.7); if (P.detail) { for (let i = 0; i < 4; i++) leaf(P, cx, cy, i * Math.PI / 2 + 0.78, 2.5, 0.8); P.dot([cx, cy], 0.55) }
      }
      for (const sy2 of [-1, 1]) {
        const dm = [[0, sy2 * 17], [4.6, sy2 * 21], [0, sy2 * 25], [-4.6, sy2 * 21]]
        P.fill(dm); P.wash(dm, RED, 0.5); P.stroke(dm.concat([dm[0]]), 0.9, { taper: 0.1, wob: 0.08 }); P.dot([0, sy2 * 21], 1.0)
      }
    },
    /* 4: oval baroque frame with beaded rim */
    (P) => {
      const E = (rx, ry, n = 48) => arc(0, 0, rx, ry, 0, TAU, n)
      for (const sg of [-1, 1]) {
        // side scrolls and leaves
        edge(P, volute(sg * 45, -6, 4.8, 1.5, -sg, sg > 0 ? Math.PI * 0.9 : Math.PI * 0.1), 1.0, { taper: 0.5 })
        edge(P, volute(sg * 45, 6, 4.8, 1.5, sg, sg > 0 ? Math.PI * 1.1 : Math.PI * 1.9), 1.0, { taper: 0.5 })
        leaf(P, sg * 40.5, -1.6, sg > 0 ? -0.2 : Math.PI + 0.2, 6, 1.6); leaf(P, sg * 40.5, 1.6, sg > 0 ? 0.2 : Math.PI - 0.2, 6, 1.6)
      }
      P.fill(E(41, 21)); P.wash(E(41, 21), PARCH, 0.55)
      edge(P, E(41, 21), 1.6, { taper: 0.1, wob: 0.15 })
      edge(P, E(38.6, 18.7), 0.6, { taper: 0.1, wob: 0.1 })
      const nb = P.detail >= 2 ? 44 : P.detail ? 30 : 18
      for (let i = 0; i < nb; i++) { const a = i / nb * TAU; P.dot([Math.cos(a) * 39.8, Math.sin(a) * 19.85], 0.95) }
      edge(P, E(34.8, 14.8), 0.8, { taper: 0.1, wob: 0.1 })
      if (P.detail) edge(P, E(33.2, 13.4), 0.4, { taper: 0.1, wob: 0.05 })
      // top and bottom fleurons
      for (const sy of [-1, 1]) {
        const cy = sy * 23.4
        P.fill(disc3(0, cy, 2.7)); P.wash(disc3(0, cy, 2.7), RED, 0.5); P.ring([0, cy], 2.7, 0.8); P.dot([0, cy], 0.9)
        for (const sg of [-1, 1]) { leaf(P, sg * 3, cy, sg > 0 ? 0 : Math.PI, 6, 1.5) }
      }
    },
    /* 5: torn parchment pinned with nails */
    (P) => {
      const pts = []
      const jit = () => R(P.r, -1.3, 1.3)
      for (let x = -44; x < 44; x += 5.5) pts.push([x + jit(), -21 + jit()])
      for (let y = -21; y < 21; y += 5.5) pts.push([44 + jit(), y + jit()])
      for (let x = 44; x > -44; x -= 5.5) pts.push([x + jit(), 21 + jit()])
      for (let y = 21; y > -21; y -= 5.5) pts.push([-44 + jit(), y + jit()])
      P.fill(pts); P.wash(pts, PARCH, 0.6)
      if (P.detail) {
        const inner = pts.map(([a, c]) => [a * 0.93, c * 0.88])
        P.stipple(pts.concat(rev(inner)), P.detail >= 2 ? 240 : 110, 0.55)
      }
      edge(P, pts.concat([pts[0]]), 1.0, { taper: 0.1, wob: 0.3 })
      // curled bottom-right corner
      P.fill([[44, 14], [37, 21], [44, 21]]); edge(P, [[44, 14], [37, 21]], 0.8, { taper: 0.4 })
      if (P.detail) P.hatch([[44, 14], [37, 21], [44, 21]], { angle: 0.8, gap: 1.8, w: 0.4 })
      // nails
      for (const [nx, ny] of [[-39, -16.5], [39, -16.5], [-39, 16.5]]) {
        P.stroke([[nx + 0.8, ny + 1.6], [nx + 3, ny + 3.4]], 0.7, { taper: 0.6, wob: 0.05 })
        P.fill(disc3(nx, ny, 2.2)); P.ring([nx, ny], 2.2, 0.8); P.solid(arc(nx + 0.5, ny + 0.5, 1.1, 1.1, 0, TAU, 8)); P.dot([nx - 0.7, ny - 0.7], 0.5, P.paper)
      }
    },
    /* 6: hanging wooden sign on chains */
    (P) => {
      const beam = [[-45, -26], [45, -26], [45, -21.5], [-45, -21.5]]
      P.fill(beam); P.wash(beam, WOOD, 0.5); edge(P, [[-45, -26], [45, -26]], 1.1); edge(P, [[-45, -21.5], [45, -21.5]], 1.1); edge(P, [[-45, -26], [-45, -21.5]], 0.8); edge(P, [[45, -26], [45, -21.5]], 0.8)
      if (P.detail) for (let i = 0; i < 5; i++) edge(P, sine(-43 + i * 18 + R(P.r, -3, 3), -23.8 + R(P.r, -0.4, 0.4), R(P.r, 8, 14), 0.4, 1.2, 8), 0.4, { taper: 0.8, wob: 0.05 })
      // chains
      for (const sg of [-1, 1]) {
        const cx = sg * 34
        for (let i = 0; i < 4; i++) {
          const cy = -20.3 + i * 2.4
          if (i % 2 === 0) { P.ring([cx, cy + 1.2], 1.25, 0.7, {}); P.stroke(arc(cx, cy + 1.2, 1.3, 1.9, 0, TAU, 8), 0.6, { taper: 0.1, wob: 0.03 }) } else P.stroke([[cx, cy - 0.2], [cx, cy + 2.4]], 1.1, { taper: 0.1, wob: 0.03 })
        }
        P.fill(disc3(cx, -23.8, 1.1)); P.dot([cx, -23.8], 0.7)
      }
      const board = [[-41.4, -15], [41.4, -15], [43, -13.4], [43, 13.4], [41.4, 15], [-41.4, 15], [-43, 13.4], [-43, -13.4]]
      P.fill(board); P.wash(board, WOOD, 0.4)
      if (P.detail) {
        for (const [x0, x1] of [[-42, -30], [30, 42]]) for (let i = 0; i < 4; i++) { const yy = -11 + i * 7.5 + R(P.r, -1, 1); edge(P, sine(x0 + R(P.r, 0, 2), yy, x1 - x0 - R(P.r, 0, 3), 0.5, 1.4, 10, R(P.r, 0, 3)), 0.4, { taper: 0.8, wob: 0.05 }) }
        P.hatch([[-43, 11.6], [43, 11.6], [43, 15], [-43, 15]], { angle: 0.04, gap: 1.8, w: 0.45 })
      }
      edge(P, board.concat([board[0]]), 1.5, { taper: 0.1, wob: 0.2 })
      const ib = [[-39, -12], [39, -12], [39, 12], [-39, 12], [-39, -12]]
      edge(P, ib, 0.6, { taper: 0.1, wob: 0.1 })
      for (const [nx, ny] of [[-40.4, -13.4], [40.4, -13.4], [-40.4, 13.4], [40.4, 13.4]]) { P.dot([nx, ny], 0.9) }
    },
    /* 7: draped banner hung from a rod, dagged edge */
    (P) => {
      // cloth
      const cloth = []
      cloth.push(...bez([-40, -20], [-41.5, -8], [-38.5, 4], [-40, 16], 6))
      for (let i = 0; i <= 8; i++) { const x = -40 + i * 10; cloth.push([x, i % 2 === 0 ? 16.5 : 24]) }
      cloth.push(...bez([40, 16], [38.5, 4], [41.5, -8], [40, -20], 6))
      P.fill(cloth); P.wash(cloth, RED, 0.28)
      if (P.detail) {
        for (const x of [-35, 35]) {
          const fx = sx(x)
          edge(P, bez([x, -20], [x + fx * 2.5, -8], [x - fx * 2, 6], [x + fx * 1, 19], 8), 0.6, { taper: 0.6, wob: 0.1 })
          P.hatch([[x, -20], [x + fx * 7, -20], [x + fx * 7, 19], [x, 19]], { angle: 1.5, gap: 1.8, w: 0.4, and: cloth })
        }
      }
      edge(P, cloth.slice(0, 7), 1.2, { taper: 0.3 })
      edge(P, cloth.slice(6, 16), 1.2, { taper: 0.1, wob: 0.15 })
      edge(P, cloth.slice(15), 1.2, { taper: 0.3 })
      // tassels at the points of the dagged edge
      for (const x of [-30, -10, 10, 30]) { edge(P, [[x, 24], [x, 26.6]], 0.8, { taper: 0.2, wob: 0.05 }); P.solid(arc(x, 27.6, 1.2, 1.5, 0, TAU, 7)) }
      // rod with ball finials and rings
      P.fill([[-46, -24.4], [46, -24.4], [46, -21.4], [-46, -21.4]]); edge(P, [[-46, -24.4], [46, -24.4]], 1.4, { taper: 0.1 }); edge(P, [[-46, -21.4], [46, -21.4]], 1.4, { taper: 0.1 })
      for (const sg of [-1, 1]) { P.fill(disc3(sg * 48, -22.9, 2.6)); P.ring([sg * 48, -22.9], 2.6, 1.0); P.dot([sg * 48 - sg * 0.7, -23.6], 0.7, P.paper) }
      for (let i = 0; i < 7; i++) { const rx = -36 + i * 12; P.ring([rx, -20.2], 1.5, 0.7) }
      // hanging cord
      edge(P, bez([-46, -24.4], [-30, -34], [30, -34], [46, -24.4], 14), 0.7, { taper: 0.3, wob: 0.1 })
    },
  ]
  const sx = (x) => (x < 0 ? 1 : -1)

  A.register('cartouche', {
    label: 'Cartouche', category: 'furniture', kind: 'fixed', view: 'furniture',
    draw(ctx, x, y, s, r, st, variant = 0) {
      ctx.save()
      const P = makePen(ctx, x, y, s, r, st, false, 1.3)
      CARTOUCHE[((variant % 8) + 8) % 8](P)
      ctx.restore()
    },
  })

  /* =====================================================================
     SCALE BARS
     ===================================================================== */
  const SCALES = [
    { nums: [0, 10, 20, 30], unit: 'leagues', caption: 'SCALE' },
    { nums: [0, 5, 10, 15], unit: 'miles' },
    { nums: [0, 25, 50, 75, 100], unit: 'leagues' },
    { nums: [0, 20, 40, 60], unit: 'miles' },
    { nums: [0, 10, 20, 30], unit: 'miles', caption: 'SCALE' },
    { nums: [0, 50, 100, 150], unit: 'leagues' },
    { nums: [0, 5, 10, 15, 20], unit: 'leagues', caption: 'SCALE' },
    { nums: [0, 100, 200, 300], unit: 'miles' },
  ]
  function drawScale(P, v) {
    const cfg = SCALES[v], n = cfg.nums.length - 1, xL = -43, xR = 43, seg = (xR - xL) / n
    const px = clamp(P.s * 0.133, 8, 14), tu = px / P.k // 12px at s=90
    const yNum = -(tu * 0.5 + 6.5), yBar = 0, hB = 6
    const top = yBar - hB / 2, bot = yBar + hB / 2
    const X = (i) => xL + i * seg
    const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
    const box = (x0, y0, x1, y1, w = 0.9) => {
      P.stroke([[x0, y0], [x1, y0]], w, { taper: 0.15, wob: 0.1 }); P.stroke([[x1, y0], [x1, y1]], w, { taper: 0.15, wob: 0.1 })
      P.stroke([[x1, y1], [x0, y1]], w, { taper: 0.15, wob: 0.1 }); P.stroke([[x0, y1], [x0, y0]], w, { taper: 0.15, wob: 0.1 })
    }
    const tick = (x, y0, y1, w = 0.7) => P.stroke([[x, y0], [x, y1]], w, { taper: 0.15, wob: 0.05 })
    const checker = (x0, x1, y0, y1, cols, rows = 2, flip = 0) => {
      const cw = (x1 - x0) / cols, rh = (y1 - y0) / rows
      for (let c = 0; c < cols; c++) for (let rr = 0; rr < rows; rr++) if ((c + rr + flip) % 2 === 0) P.solid(rect(x0 + c * cw, y0 + rr * rh, x0 + (c + 1) * cw, y0 + (rr + 1) * rh))
    }
    const maxLen = Math.max(...cfg.nums.map((nm) => String(nm).length)), stride = Math.max(1, Math.ceil(maxLen * px * 0.62 / (seg * P.k)))
    const labels = (yy) => cfg.nums.forEach((nm, i) => { if (i % stride === 0 || i === n && (n % stride === 0)) P.textPx(String(nm), [X(i), yy], px, { italic: true }) })
    const unitLabel = (yy, x = 0) => P.textPx(cfg.unit, [x, yy], px, { italic: true })
    const cap = (yy) => { if (cfg.caption) P.textPx(cfg.caption, [0, yy], px * 0.9, { italic: false }) }
    const wash = (x0, y0, x1, y1, col, a = 0.45) => P.wash(rect(x0, y0, x1, y1), col, a)

    switch (v) {
      case 0: { // Genabackis: checkered first league, then ruled bars
        P.fill(rect(xL, top, xR, bot)); wash(xL, top, xR, bot, PARCH, 0.4)
        checker(xL, X(1), top, bot, 12, 2)
        P.hatch(rect(X(2), top, X(3), bot), { angle: 0.8, gap: 1.6, w: 0.5 })
        P.solid(rect(X(1), top, X(2), top + 1.3)); P.solid(rect(X(1), bot - 1.3, X(2), bot))
        box(xL, top, xR, bot, 1.0)
        for (let i = 0; i <= n; i++) { tick(X(i), top - 3.4, top, 0.8) }
        labels(yNum); cap(yNum - tu * 1.0 - 1.5); unitLabel(bot + tu * 0.5 + 6.5)
        break
      }
      case 1: { // alternating black and white blocks
        const h = 4.4, y0 = -h / 2, y1 = h / 2
        P.fill(rect(xL, y0, xR, y1))
        for (let i = 0; i < n; i += 2) P.solid(rect(X(i), y0, X(i + 1), y1))
        for (let i = 1; i < n; i += 2) wash(X(i), y0, X(i + 1), y1, GOLD, 0.35)
        box(xL, y0, xR, y1, 1.0)
        for (let i = 0; i <= n; i++) tick(X(i), y0 - 2.8, y0, 0.7)
        labels(y0 - 2.8 - tu * 0.5 - 1); unitLabel(y1 + tu * 0.5 + 3.5)
        break
      }
      case 2: { // measuring rule with fine ticks
        const y = 1.2
        P.stroke([[xL - 1, y], [xR + 1, y]], 1.2, { taper: 0.3, wob: 0.1 })
        P.stroke([[xL, y + 2.2], [xR, y + 2.2]], 0.5, { taper: 0.3, wob: 0.05 })
        for (let i = 0; i < n; i++) {
          for (let k = 0; k < 5; k++) { const x = X(i) + seg * k / 5; tick(x, y - (k === 0 ? 5 : k === 2 || k === 3 ? 2.2 : 1.6), y + (k === 0 ? 2.2 : 0), k === 0 ? 0.9 : 0.5) }
        }
        tick(X(n), y - 5, y + 2.2, 0.9)
        P.solid([[xL - 3, y], [xL - 0.5, y - 1.5], [xL - 0.5, y + 1.5]]); P.solid([[xR + 3, y], [xR + 0.5, y - 1.5], [xR + 0.5, y + 1.5]])
        labels(y - 5 - tu * 0.5 - 1); unitLabel(y + tu * 0.5 + 5)
        break
      }
      case 3: { // engraved hatched segments
        const h = 5
        P.fill(rect(xL, -h / 2, xR, h / 2)); wash(xL, -h / 2, xR, h / 2, PARCH, 0.4)
        for (let i = 0; i < n; i++) {
          const r4 = rect(X(i), -h / 2, X(i + 1), h / 2)
          if (i % 2 === 0) { P.hatch(r4, { angle: 1.1, gap: 1.2, w: 0.55 }) } else if (P.detail) P.hatch(r4, { angle: -1.1, gap: 2.4, w: 0.4 })
        }
        box(xL, -h / 2, xR, h / 2, 1.0)
        for (let i = 0; i <= n; i++) tick(X(i), -h / 2 - 3, -h / 2, 0.8)
        labels(-h / 2 - 3 - tu * 0.5 - 1)
        unitLabel(h / 2 + tu * 0.5 + 4)
        // end flourishes
        P.stroke([[xL - 5, 0], [xL - 1, 0]], 0.8, { taper: 0.5, wob: 0.05 }); P.stroke([[xR + 1, 0], [xR + 5, 0]], 0.8, { taper: 0.5, wob: 0.05 })
        break
      }
      case 4: { // railway: two rails with ties, first segment checkered
        cap(yNum - tu * 1.0 - 1.5)
        const y0 = -3, y1 = 3
        P.stroke([[xL, y0], [xR, y0]], 1.1, { taper: 0.15, wob: 0.1 }); P.stroke([[xL, y1], [xR, y1]], 1.1, { taper: 0.15, wob: 0.1 })
        const nt = P.detail >= 2 ? 22 : 14
        for (let i = 0; i <= nt; i++) { const x = xL + (xR - xL) * i / nt; P.stroke([[x, y0 - 1.2], [x, y1 + 1.2]], i % 2 ? 0.5 : 0.7, { taper: 0.1, wob: 0.05 }) }
        for (let i = 0; i < n; i += 2) P.solid(rect(X(i), y0, X(i + 1), y0 + 1.1)), P.solid(rect(X(i), y1 - 1.1, X(i + 1), y1))
        for (let i = 0; i <= n; i++) tick(X(i), y0 - 4.6, y0 - 1.2, 0.8)
        labels(yNum + 0.5); unitLabel(y1 + tu * 0.5 + 4.5)
        break
      }
      case 5: { // ruled line with diamond ends, hatched shade under alternate segments
        const y = 0
        P.stroke([[xL, y - 1.7], [xR, y - 1.7]], 0.9, { taper: 0.2, wob: 0.1 }); P.stroke([[xL, y + 1.7], [xR, y + 1.7]], 0.9, { taper: 0.2, wob: 0.1 })
        for (let i = 0; i < n; i += 2) P.solid(rect(X(i), y - 1.7, X(i + 1), y + 1.7))
        for (let i = 1; i < n; i += 2) wash(X(i), y - 1.7, X(i + 1), y + 1.7, GOLD, 0.4)
        for (const sg of [-1, 1]) {
          const cx = sg * (xR + 3.2), dm = [[cx - 3.2, 0], [cx, -3.4], [cx + 3.2, 0], [cx, 3.4]]
          P.fill(dm); P.wash(dm, RED, 0.5); P.stroke(dm.concat([dm[0]]), 0.9, { taper: 0.1, wob: 0.05 }); P.dot([cx, 0], 0.8)
        }
        for (let i = 0; i <= n; i++) tick(X(i), -1.7 - 3, -1.7, 0.8)
        labels(-1.7 - 3 - tu * 0.5 - 1); unitLabel(1.7 + tu * 0.5 + 3.5)
        break
      }
      case 6: { // checkered throughout, first league subdivided
        cap(yNum - tu * 1.0 - 1.5)
        const y0 = -3.2, y1 = 3.2
        P.fill(rect(xL, y0, xR, y1))
        checker(xL, X(1), y0, y1, 10, 2)
        checker(X(1), xR, y0, y1, (n - 1) * 5, 2, 1)
        box(xL, y0, xR, y1, 1.0)
        P.stroke([[xL, 0], [X(1), 0]], 0.4, { taper: 0.1, wob: 0.03 })
        for (let i = 0; i <= n; i++) tick(X(i), y0 - 3.2, y0, 0.8)
        labels(yNum + 0.5); unitLabel(y1 + tu * 0.5 + 4.5)
        break
      }
      case 7: { // arrow bar: alternate solid and open boxes, arrow head to the right
        const h = 4
        P.fill(rect(xL, -h / 2, xR, h / 2)); box(xL, -h / 2, xR, h / 2, 1.0)
        for (let i = 0; i < n; i++) { if (i % 2 === 0) P.solid(rect(X(i), -h / 2, X(i + 1), h / 2)); else wash(X(i), -h / 2, X(i + 1), h / 2, PARCH, 0.5) }
        P.solid([[xR, -3.6], [xR + 6, 0], [xR, 3.6]])
        for (let i = 0; i <= n; i++) tick(X(i), -h / 2 - 3, -h / 2, 0.8)
        labels(-h / 2 - 3 - tu * 0.5 - 1); unitLabel(h / 2 + tu * 0.5 + 4)
        break
      }
    }
  }
  A.register('scale-bar', {
    label: 'Scale bar', category: 'furniture', kind: 'fixed', view: 'furniture',
    draw(ctx, x, y, s, r, st, variant = 0) {
      ctx.save()
      const P = makePen(ctx, x, y, s, r, st, false, 1.2)
      drawScale(P, ((variant % 8) + 8) % 8)
      ctx.restore()
    },
  })

  /* =====================================================================
     SHIPS: small sailing ships in pen, bow to the right, riding on a few wave marks
     ===================================================================== */
  const WL = 22 // waterline y
  /* hull from sheer line S (stern to bow) and keel line K (stern to bow), both sampled */
  function hull(P, S, K, o = {}) {
    const s = cr(S, 5), k = cr(K, 5), poly = s.concat(rev(k))
    P.fill(poly); P.wash(poly, WOOD, 0.5)
    const planks = o.planks === undefined ? 2 : o.planks
    if (P.detail >= 1) for (let j = 1; j <= planks; j++) {
      const t = j / (planks + 1), ln = s.map((p, i) => lerpP(p, k[i], t))
      P.stroke(ln.slice(2, -2), 0.5, { taper: 0.6, wob: 0.1 })
    }
    if (P.detail >= 1) {
      // shade the lower hull: short strokes following the form, heavier toward the stern-right
      const lo = s.map((p, i) => lerpP(p, k[i], 0.62)).concat(rev(k))
      P.hatch(lo, { angle: 1.25, gap: 2.2, w: 0.5 })
    }
    P.stroke(s, o.sw || 1.3, { taper: 0.35, wob: 0.15 })
    P.stroke(k, 1.1, { taper: 0.45, wob: 0.15 })
    P.stroke([s[0], k[0]], 1.0, { taper: 0.2, wob: 0.1 }); P.stroke([s[s.length - 1], k[k.length - 1]], 0.9, { taper: 0.3, wob: 0.1 })
    return { s, k }
  }
  const sheerY = (s, x) => { for (let i = 1; i < s.length; i++) if (s[i][0] >= x) return lerp(s[i - 1][1], s[i][1], (x - s[i - 1][0]) / (s[i][0] - s[i - 1][0] || 1)); return s[s.length - 1][1] }
  const mast = (P, x, y0, y1, w = 1.2) => { P.fill([[x - w * 0.6, y1], [x + w * 0.6, y1], [x + w * 0.9, y0], [x - w * 0.9, y0]], P.ink) }
  /* square sail seen face-on, billowing; opts: stripes (alternate stripes inked), col (colour mode wash) */
  function sailSq(P, cx, top, w, h, o = {}) {
    const bl = o.bulge === undefined ? 2.4 : o.bulge, hw = w / 2
    const L = bez([cx - hw, top], [cx - hw + bl, top + h * 0.35], [cx - hw + bl * 0.4, top + h * 0.7], [cx - hw * 0.94, top + h], 6)
    const B = bez([cx - hw * 0.94, top + h], [cx - hw * 0.4, top + h - bl * 1.5], [cx + hw * 0.4, top + h - bl * 1.5], [cx + hw * 0.94, top + h], 8)
    const Rr = bez([cx + hw * 0.94, top + h], [cx + hw - bl * 0.4, top + h * 0.7], [cx + hw - bl, top + h * 0.35], [cx + hw, top], 6)
    const poly = L.concat(B.slice(1), Rr.slice(1))
    P.fill(poly)
    if (P.colour && o.col) P.wash(poly, o.col, 0.45)
    if (o.stripes) {
      const ns = o.stripes
      for (let i = 0; i < ns; i += 2) {
        const x0 = cx - hw + w * i / ns, x1 = cx - hw + w * (i + 1) / ns
        const q = [[x0, top], [x1, top], [x1, top + h + 2], [x0, top + h + 2]]
        if (P.colour) P.wash(q, o.col2 || RED, 0.5)
        if (P.detail >= 1) P.hatch(q, { angle: Math.PI / 2, gap: 1.6, w: 0.5, and: poly }); else P.hatch(q, { angle: Math.PI / 2, gap: 2, w: 0.7, and: poly })
      }
    } else {
      if (P.detail >= 1) for (const t of [0.34, 0.67]) P.stroke([[cx - hw + w * t, top + 1], [cx - hw + w * t + bl * 0.3, top + h - bl * 1.3]], 0.4, { taper: 0.6, wob: 0.1 })
      if (P.detail >= 1) P.hatch([[cx + hw * 0.3, top], [cx + hw + 1, top], [cx + hw + 1, top + h + 1], [cx + hw * 0.3, top + h + 1]], { angle: 1.52, gap: 2.1, w: 0.45, and: poly })
    }
    P.stroke(L, 0.9, { taper: 0.3, wob: 0.12 }); P.stroke(B, 0.9, { taper: 0.3, wob: 0.12 }); P.stroke(Rr, 0.9, { taper: 0.3, wob: 0.12 })
    P.stroke([[cx - hw - 2.4, top], [cx + hw + 2.4, top]], 1.2, { taper: 0.4, wob: 0.1 })
  }
  function pennant(P, x, y, len, h, solid = true) {
    const a = bez([x, y], [x + len * 0.35, y - h * 0.6], [x + len * 0.65, y + h * 0.5], [x + len, y + h * 0.1], 8)
    const b = bez([x + len, y + h * 0.1], [x + len * 0.65, y + h * 1.5], [x + len * 0.35, y + h * 0.5], [x, y + h], 8)
    const q = a.concat(b.slice(1))
    if (solid) P.solid(q); else { P.fill(q); P.stroke(q, 0.6, { taper: 0.2 }) }
    if (P.colour) P.wash(q, RED, 0.6)
  }
  const waterline = (P, o = {}) => {
    const x0 = o.x0 === undefined ? -48 : o.x0, x1 = o.x1 === undefined ? 48 : o.x1
    if (P.colour) {
      const lens = arc(0, WL + 1, (x1 - x0) / 2 + 2, 6.5, 0, TAU, 20)
      P.wash(lens, P.st.tint.water, 0.55)
    }
    const nrow = P.detail >= 2 ? 3 : 2
    for (let row = 0; row < nrow; row++) {
      const yy = WL + 0.8 + row * 3.6, span = (x1 - x0) * (row === 0 ? 1 : 0.8), xs = x0 + (x1 - x0 - span) / 2 + (row % 2 ? 3 : -2)
      const nseg = row === 0 ? 5 : 4
      for (let i = 0; i < nseg; i++) {
        const l = span / nseg, xa = xs + i * l + R(P.r, -1, 1)
        P.stroke(sine(xa, yy + R(P.r, -0.5, 0.5), l * R(P.r, 0.7, 0.95), 1.15, 1.3, 10, R(P.r, 0, 2)), row === 0 ? 0.9 : 0.7, { taper: 0.85, wob: 0.1 })
      }
    }
    // bow wave curl
    if (o.curl !== false && P.detail >= 1) P.stroke(cr([[o.cx || 42, WL + 0.5], [(o.cx || 42) + 4, WL - 1.5], [(o.cx || 42) + 6, WL - 4.5], [(o.cx || 42) + 3.5, WL - 6], [(o.cx || 42) + 1.6, WL - 4.3]], 4), 0.8, { taper: 0.8, wob: 0.05 })
  }
  const bowsprit = (P, x0, y0, x1, y1) => P.stroke([[x0, y0], [x1, y1]], 1.5, { taper: 0.3, wob: 0.1 })
  const rigging = (P, a, b, w = 0.4) => P.stroke([a, b], w, { taper: 0.1, wob: 0.05 })

  const SHIPS = [
    /* 0: three-masted galleon */
    (P) => {
      const { s } = hull(P, [[-39, -8], [-31, 0], [-15, 6.5], [5, 8.5], [24, 5.5], [38, -1], [46, -6]], [[-37, 14], [-28, 19.5], [-12, 22.5], [8, 22.5], [26, 19.5], [38, 12.5], [46, 3.5]], { planks: 3 })
      // stern castle and forecastle
      const aft = [[-39, -8], [-38, -16], [-22, -16], [-21, -2]]
      P.fill(aft); P.wash(aft, WOOD, 0.5); P.stroke(aft, 1.0, { taper: 0.2, wob: 0.1 })
      if (P.detail) { P.stroke([[-38.4, -12], [-22, -12]], 0.5, { taper: 0.4 }); for (const wx of [-35, -30, -25]) P.solid(arc(wx, -6.5, 1.1, 1.4, 0, TAU, 6)) }
      const fore = [[34, -3], [34, -9], [42, -9], [46, -6]]
      P.fill(fore); P.stroke([[34, -9], [42, -9], [46, -6]], 0.9, { taper: 0.3, wob: 0.1 })
      if (P.detail) for (let i = 0; i < 6; i++) P.dot([-11 + i * 7.5, sheerY(s, -11 + i * 7.5) + 5.2], 0.9)
      // masts
      mast(P, -27, -16, -37, 1.1); mast(P, -4, 8, -47, 1.5); mast(P, 21, 6, -41, 1.3)
      bowsprit(P, 40, -4, 50, -12)
      // sails
      sailSq(P, -27, -34, 15, 14, { bulge: 1.6 })
      sailSq(P, -4, -17, 27, 21, { bulge: 2.6 }); sailSq(P, -4, -38, 17, 14, { bulge: 1.8 })
      sailSq(P, 21, -14, 20, 17, { bulge: 2.2 }); sailSq(P, 21, -34, 13, 11, { bulge: 1.4 })
      P.stroke([[46, -9], [50, -12]], 0.5)
      pennant(P, -4, -48, 11, 3.2); pennant(P, 21, -42, 9, 2.8); pennant(P, -27, -38, 8, 2.6)
      if (P.detail) { rigging(P, [-4, -45], [38, -4]); rigging(P, [-4, -45], [-37, -15]); rigging(P, [21, -40], [41, -4]) }
      waterline(P, { cx: 44 })
    },
    /* 1: longship with dragon prow and striped sail (Middle-earth) */
    (P) => {
      const { s } = hull(P, [[-42, -15], [-38, -3], [-22, 4], [0, 6.5], [22, 4], [38, -3], [44, -19]], [[-39, -6], [-33, 8], [-16, 15], [0, 17], [16, 15], [33, 8], [40, -7]], { planks: 2, sw: 1.5 })
      // dragon head at the bow, curled post at the stern
      P.stroke(cr([[42, -8], [45, -16], [44, -23], [39, -25]], 5), 2.0, { taper: 0.3, wob: 0.05 })
      P.solid(cr([[39, -25.5], [43, -28.5], [49, -27.5], [49, -24.5], [44.5, -23.4], [41, -22.5]], 3, true))
      P.dot([44.3, -26.2], 0.8, P.paper); P.stroke([[40.5, -28], [37, -31.5]], 1.1, { taper: 0.8, wob: 0.05 })
      P.stroke(volute(-40, -19, 4.5, 1.2, -1, 0.6), 1.5, { taper: 0.4, wob: 0.05 })
      P.stroke([[-39, -14], [-42, -17]], 1.5, { taper: 0.3, wob: 0.05 })
      // shields along the sheer
      const n = P.detail >= 1 ? 9 : 5
      for (let i = 0; i < n; i++) {
        const x = -28 + i * 56 / (n - 1), y = sheerY(s, x) + 4
        P.fill(disc3(x, y, 3.3)); P.ring([x, y], 3.3, 0.7); if (P.detail) { P.dot([x, y], 1.1); if (i % 2) P.wash(disc3(x, y, 3.2), RED, 0.5) }
      }
      // oars
      if (P.detail >= 1) for (let i = 0; i < 6; i++) { const x = -22 + i * 9; P.stroke([[x, 11], [x - 6, 23]], 0.7, { taper: 0.4, wob: 0.05 }) }
      mast(P, 0, 7, -44, 1.5)
      sailSq(P, 0, -40, 40, 33, { stripes: 8, bulge: 3.4, col2: RED })
      pennant(P, 1, -45, 10, 3)
      if (P.detail) { rigging(P, [0, -44], [-39, -13]); rigging(P, [0, -44], [41, -17]) }
      waterline(P, { cx: 45 })
    },
    /* 2: cog with castles and a crow's nest */
    (P) => {
      const { s } = hull(P, [[-35, -6], [-27, 1], [-10, 5], [10, 5], [28, 1], [37, -5]], [[-31, 15], [-21, 21], [0, 23.5], [20, 21], [32, 15], [37, 5]], { planks: 2 })
      const castle = (x0, x1, y0, y1) => {
        const q = [[x0, y1], [x0, y0], [x1, y0], [x1, y1]]
        P.fill(q); P.wash(q, WOOD, 0.45); P.stroke(q, 1.0, { taper: 0.2, wob: 0.1 })
        const m = Math.max(2, Math.round((x1 - x0) / 4))
        for (let i = 0; i < m; i++) { const a = x0 + (x1 - x0) * i / m; P.solid([[a + 0.3, y0], [a + (x1 - x0) / m * 0.55, y0], [a + (x1 - x0) / m * 0.55, y0 - 2.3], [a + 0.3, y0 - 2.3]]) }
        if (P.detail) P.hatch([[x0, y0 + 2], [x1, y0 + 2], [x1, y1], [x0, y1]], { angle: 1.5, gap: 2.6, w: 0.4, and: q })
      }
      castle(-36, -20, -15, -2); castle(24, 38, -13, -4)
      mast(P, 2, 6, -43, 1.5)
      // crow's nest barrel
      const nest = [[-3.5, -40], [3.5, -40], [4.4, -34], [-4.4, -34]]
      P.fill(nest); P.stroke(nest.concat([nest[0]]), 0.8, { taper: 0.1, wob: 0.05 }); if (P.detail) P.stroke([[-4, -37], [4, -37]], 0.4)
      sailSq(P, 2, -31, 30, 25, { bulge: 3, col: null })
      // red cross on the sail
      P.stroke([[2, -27], [2, -9]], 2.0, { taper: 0.1, wob: 0.05 }); P.stroke([[-7, -19], [11, -19]], 2.0, { taper: 0.1, wob: 0.05 })
      pennant(P, 2, -47, 10, 3.2); pennant(P, 36, -13, 7, 2.2)
      if (P.detail) { rigging(P, [2, -33], [-28, -15]); rigging(P, [2, -33], [32, -13]) }
      waterline(P, { cx: 39 })
    },
    /* 3: caravel with lateen sails */
    (P) => {
      hull(P, [[-37, -7], [-29, 1], [-8, 6], [14, 6.5], [30, 2], [42, -4]], [[-35, 12], [-24, 19.5], [-4, 22.5], [16, 22.5], [32, 17], [42, 6]], { planks: 2 })
      const aft = [[-37, -7], [-36, -14], [-22, -14], [-21, 0]]
      P.fill(aft); P.stroke(aft, 1.0, { taper: 0.2, wob: 0.1 })
      const lateen = (mx, yBot, yTop, len) => {
        mast(P, mx, yBot, yTop + 1, 1.2)
        const A0 = [mx - len * 0.58, yBot - 3.5], B0 = [mx + len * 0.12, yTop]
        const lowTip = [mx + len * 0.55, yBot - 5]
        const e1 = bez(A0, [mx - len * 0.36, (A0[1] + yTop) / 2 + 1], [mx - len * 0.12, yTop + 5], B0, 8)
        const e2 = bez(B0, [mx + len * 0.34, yTop + 9], [mx + len * 0.55, (yTop + lowTip[1]) / 2 + 4], lowTip, 8)
        const e3 = bez(lowTip, [mx + len * 0.2, lowTip[1] - 2], [mx - len * 0.2, A0[1] + 1.5], A0, 8)
        const poly = e1.concat(e2.slice(1), e3.slice(1))
        P.fill(poly)
        if (P.detail >= 1) for (const t of [0.3, 0.6]) P.stroke([lerpP(B0, lowTip, t * 0.9), lerpP(A0, lowTip, t)], 0.4, { taper: 0.6, wob: 0.1 })
        if (P.detail >= 1) P.hatch([[mx + len * 0.05, yTop], [mx + len * 0.6, yTop], [mx + len * 0.6, yBot], [mx + len * 0.05, yBot]], { angle: 1.1, gap: 2.1, w: 0.45, and: poly })
        P.stroke(e1, 1.2, { taper: 0.3, wob: 0.1 }); P.stroke(e2, 0.9, { taper: 0.3, wob: 0.1 }); P.stroke(e3, 0.9, { taper: 0.3, wob: 0.1 })
      }
      lateen(-27, -13, -35, 22)
      lateen(-1, 7, -46, 34)
      mast(P, 24, 6, -33, 1.2); sailSq(P, 24, -30, 17, 16, { bulge: 1.8 })
      bowsprit(P, 40, -3, 49, -10)
      pennant(P, -1, -50, 9, 3); pennant(P, 24, -36, 7, 2.4)
      if (P.detail) { rigging(P, [-1, -44], [40, -3]); rigging(P, [24, -32], [40, -3]) }
      waterline(P, { cx: 43 })
    },
    /* 4: cutter with gaff mainsail and jib */
    (P) => {
      hull(P, [[-31, -3], [-20, 3], [0, 6], [24, 3.5], [41, -5]], [[-29, 11], [-18, 17.5], [0, 21], [20, 18], [38, 9], [41, -3]], { planks: 2 })
      mast(P, 2, 5, -46, 1.4)
      P.stroke([[1.5, -5], [-32, -2]], 1.3, { taper: 0.3, wob: 0.1 }) // boom
      const m1 = bez([1, -44], [-8, -39], [-16, -37], [-23, -33], 7), m2 = bez([-23, -33], [-26, -22], [-30, -12], [-32, -4], 7), m3 = bez([-32, -4], [-20, -6.5], [-8, -5], [1, -6], 7), m4 = [[1, -6], [1, -44]]
      const main = m1.concat(m2.slice(1), m3.slice(1))
      P.fill(main)
      if (P.detail >= 1) { for (const t of [0.3, 0.55, 0.78]) P.stroke([lerpP([1, -42], [-24, -32], t), lerpP([1, -6], [-31, -5], t)], 0.4, { taper: 0.6, wob: 0.1 }); P.hatch([[-34, -45], [-14, -45], [-14, -3], [-34, -3]], { angle: 1.2, gap: 2.2, w: 0.45, and: main }) }
      P.stroke(m1, 1.0, { taper: 0.3, wob: 0.1 }); P.stroke(m2, 0.9, { taper: 0.3, wob: 0.1 }); P.stroke(m3, 0.9, { taper: 0.3, wob: 0.1 })
      P.stroke(cr([[4, -43], [8, -36], [10, -34]], 4), 0.6)
      const j1 = bez([4, -42], [20, -28], [32, -14], [40, -6], 8), j2 = bez([40, -6], [28, -6], [14, -5], [4, -6], 7)
      const jib = j1.concat(j2.slice(1))
      P.fill(jib); P.stroke(j1, 0.8, { taper: 0.3, wob: 0.1 }); P.stroke(j2, 0.9, { taper: 0.3, wob: 0.1 })
      if (P.detail >= 1) P.hatch([[22, -40], [42, -40], [42, -4], [22, -4]], { angle: 1.0, gap: 2.2, w: 0.45, and: jib })
      P.stroke([[4, -44], [42, -4]], 0.8, { taper: 0.2, wob: 0.05 })
      pennant(P, 2, -50, 10, 3.2)
      waterline(P, { cx: 38 })
    },
    /* 5: galley with oars and a lateen sail */
    (P) => {
      const { s } = hull(P, [[-45, -6], [-38, 0], [-20, 2.5], [0, 3], [20, 2.5], [37, -1], [44, -7]], [[-43, 5], [-34, 11], [-16, 13.5], [0, 14], [16, 13.5], [32, 10], [44, 1]], { planks: 1 })
      // ram and stern awning
      P.solid([[43, 1.5], [52, 4.5], [43, 5]]); P.stroke([[44, -7], [48, -9.5]], 1.3, { taper: 0.4, wob: 0.05 })
      const aw = [[-47, -15], [-30, -15], [-30, -8], [-47, -8]]
      P.fill(aw); P.hatch(aw, { angle: Math.PI / 2, gap: 2.2, w: 0.5 }); P.stroke(aw.concat([aw[0]]), 0.9, { taper: 0.1, wob: 0.05 })
      P.stroke([[-45, -8], [-45, -2]], 0.8); P.stroke([[-31.5, -8], [-31.5, -1]], 0.8)
      // oars
      const no = P.detail >= 1 ? 9 : 6
      for (let i = 0; i < no; i++) { const x = -26 + i * 6.8, y0 = sheerY(s, x) + 4.5; P.stroke([[x, y0], [x - 8.5, 24.5]], 0.75, { taper: 0.25, wob: 0.05 }); P.solid(rotP([[x - 8.5, 24.5], [x - 10.8, 24.1], [x - 10.4, 25.8]], 0, 0, 0)) }
      if (P.detail) for (let i = 0; i < 9; i++) P.dot([-26 + i * 6.8, sheerY(s, -26 + i * 6.8) + 4.2], 0.7)
      mast(P, -4, 3, -45, 1.4)
      // big lateen sail
      const A0 = [-34, -6], B0 = [8, -45], C0 = [30, -6]
      const e1 = bez(A0, [-24, -20], [-8, -36], B0, 9), e2 = bez(B0, [18, -32], [28, -18], C0, 9), e3 = bez(C0, [14, -9], [-14, -10], A0, 9)
      const poly = e1.concat(e2.slice(1), e3.slice(1))
      P.fill(poly)
      if (P.detail >= 1) { for (const t of [0.25, 0.5, 0.75]) P.stroke([lerpP(B0, C0, t * 0.85 + 0.05), lerpP(A0, C0, t)], 0.4, { taper: 0.6, wob: 0.1 }); P.hatch([[6, -46], [32, -46], [32, -5], [6, -5]], { angle: 1.15, gap: 2.2, w: 0.45, and: poly }) }
      P.stroke(e1, 1.3, { taper: 0.3, wob: 0.1 }); P.stroke(e2, 0.9, { taper: 0.3, wob: 0.1 }); P.stroke(e3, 0.9, { taper: 0.3, wob: 0.1 })
      pennant(P, 8, -45, 10, 3)
      waterline(P, { cx: 46 })
    },
    /* 6: junk with battened sails */
    (P) => {
      hull(P, [[-41, -11], [-36, 0], [-18, 4.5], [10, 4.5], [32, 2.5], [43, -4]], [[-38, 11], [-30, 18.5], [-10, 22], [16, 22], [34, 17], [44, 8]], { planks: 2 })
      const aft = [[-41, -11], [-42, -17], [-26, -17], [-25, -2]]
      P.fill(aft); P.stroke(aft, 1.0, { taper: 0.2, wob: 0.1 })
      if (P.detail) P.stroke([[-41.5, -14], [-26, -14]], 0.4)
      const junk = (mx, top, w, h) => {
        mast(P, mx, 4, top - 3, 1.2)
        const poly = [[mx - w / 2, top + 3], [mx + w / 2, top], [mx + w / 2 - 1, top + h], [mx - w / 2 + 1, top + h - 1]]
        P.fill(poly)
        const nb = P.detail >= 1 ? 7 : 4
        for (let i = 1; i < nb; i++) { const t = i / nb; P.stroke([lerpP(poly[0], poly[3], t), lerpP(poly[1], poly[2], t)], 0.55, { taper: 0.2, wob: 0.08 }) }
        if (P.detail >= 1) P.hatch([[mx + w * 0.15, top - 2], [mx + w / 2 + 1, top - 2], [mx + w / 2 + 1, top + h], [mx + w * 0.15, top + h]], { angle: 1.2, gap: 2.4, w: 0.4, and: poly })
        P.stroke(poly.concat([poly[0]]), 0.95, { taper: 0.15, wob: 0.1 })
      }
      junk(-26, -34, 22, 32); junk(0, -40, 26, 38); junk(26, -30, 20, 28)
      pennant(P, 0, -44, 10, 3); pennant(P, -26, -38, 7, 2.4)
      waterline(P, { cx: 45 })
    },
    /* 7: swan-prowed elven ship with a crescent sail */
    (P) => {
      hull(P, [[-43, -9], [-33, 0], [-12, 5], [10, 5], [28, 0], [39, -11]], [[-41, 3], [-31, 11.5], [-10, 18], [10, 18], [28, 12.5], [40, -6]], { planks: 2, sw: 1.5 })
      // swan neck and head
      const neck = cr([[38, -9], [45, -19], [46, -30], [39, -34], [35, -30]], 5)
      const tb = tube(neck, (t) => 2.8 - 1.7 * t)
      P.fill(tb.poly); P.stroke(tb.L, 0.9, { taper: 0.1, wob: 0.05 }); P.stroke(tb.R, 0.9, { taper: 0.1, wob: 0.05 })
      const head = [[35.5, -32], [31.5, -31.5], [28.5, -28.5], [32.5, -29.6], [34.6, -28.2]]
      P.solid(head); P.dot([34.2, -31.6], 0.5, P.paper)
      if (P.detail >= 1) P.stroke(cr([[41, -12], [44, -16], [44, -22]], 4), 0.5, { taper: 0.5 })
      P.stroke(cr([[-43, -9], [-47, -15], [-44, -21], [-41, -19]], 5), 1.6, { taper: 0.4, wob: 0.05 })
      // lantern at the stern
      P.fill(disc3(-45.5, -22.5, 1.9)); P.ring([-45.5, -22.5], 1.9, 0.6)
      mast(P, 0, 6, -46, 1.3)
      const e1 = bez([1, -44], [30, -37], [32, -15], [1, -7], 10)
      const poly = e1.concat([[1, -7]])
      P.fill(poly)
      if (P.detail >= 1) { for (const t of [0.34, 0.66]) P.stroke(bez([1, -44 + 37 * 0.0 ], [1 + 29 * t, -37 + 6 * t], [1 + 31 * t, -15 - 2 * t], [1, -7], 9).map(([a, c]) => [a, c]), 0.4, { taper: 0.6, wob: 0.1 }); P.hatch([[16, -46], [34, -46], [34, -4], [16, -4]], { angle: 1.45, gap: 2.2, w: 0.45, and: poly }) }
      P.stroke(e1, 1.2, { taper: 0.3, wob: 0.1 })
      P.stroke([[1, -44], [-8, -32]], 0.5)
      pennant(P, 1, -48, 11, 3.2)
      waterline(P, { cx: 41 })
    },
  ]

  A.register('ship', {
    label: 'Ship', category: 'sea', kind: 'fixed', view: 'top',
    draw(ctx, x, y, s, r, st, variant = 0) {
      ctx.save()
      // the design box is 100 wide; ships sit a little high, so nudge down to centre them in the circle
      const P = makePen(ctx, x, y + s * 0.04, s * 0.98, r, st, r() < 0.5)
      SHIPS[((variant % 8) + 8) % 8](P)
      ctx.restore()
    },
  })

  /* =====================================================================
     SEA SERPENTS: humps rising out of the waves
     ===================================================================== */
  const SY = 10 // waterline in the serpent design box
  const archPts = (cx, w, h, y0 = SY, n = 16) => {
    const o = []
    for (let i = 0; i <= n; i++) { const t = i / n; o.push([cx - w / 2 + w * t, y0 - h * Math.pow(Math.sin(Math.PI * t), 0.6)]) }
    return o
  }
  /* a hump of the serpent's back: filled, shaded on the right, scaled and spined */
  function hump(P, cx, w, h, o = {}) {
    const arch = archPts(cx, w, h), poly = arch.slice()
    P.fill(poly); P.wash(poly, o.col || P.st.tint.water, 0.55)
    // spines along the back
    if (o.spines !== false) {
      const ns = Math.max(3, Math.round(w / 4.2)), sl = o.spine || 3.4
      for (let i = 1; i < ns; i++) {
        const t0 = i / ns - 0.3 / ns, t1 = i / ns + 0.3 / ns, a = arch[Math.round(t0 * 16)], b = arch[Math.round(t1 * 16)]
        const m = lerpP(a, b, 0.5), dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1
        const nx = dy / d, ny = -dx / d
        if (i % 1 === 0) P.solid([a, [m[0] + nx * sl + dx * 0.1, m[1] + ny * sl], b])
      }
    }
    if (P.detail >= 1) {
      // shading follows the curve of the back: arcs on the right-hand side, plus scale marks
      for (let j = 1; j <= (P.detail >= 2 ? 4 : 2); j++) {
        const sc = 1 - j * 0.2, q = []
        for (let i = 0; i <= 10; i++) { const t = 0.45 + i * 0.045; q.push([cx - w / 2 + w * t, SY - h * sc * Math.pow(Math.sin(Math.PI * t), 0.6) - (1 - sc) * 0]) }
        P.stroke(q, 0.5, { taper: 0.8, wob: 0.08 })
      }
    }
    if (P.detail >= 2) {
      const n = Math.round(w / 3)
      for (let i = 0; i < n; i++) {
        const t = R(P.r, 0.08, 0.92), top = SY - h * Math.pow(Math.sin(Math.PI * t), 0.6), x = cx - w / 2 + w * t, y = R(P.r, top + 2.5, SY - 1.5)
        if (y < SY - 1.5 && y > top + 2) P.stroke(arc(x, y, 1.15, 1.0, 0.15, Math.PI - 0.15, 4), 0.4, { taper: 0.6, wob: 0.02 })
      }
    }
    P.stroke(arch, 1.5, { taper: 0.45, wob: 0.2 })
  }
  /* tubular neck/tail: centreline pts, half-width fn */
  function limb(P, c, hw, o = {}) {
    const tb = tube(c, hw)
    P.fill(tb.poly); P.wash(tb.poly, o.col || P.st.tint.water, 0.55)
    if (P.detail >= 1 && o.belly !== false) {
      // belly plates along the underside (the right/outer side of the curve)
      const side = o.bellySide === 'L' ? tb.L : tb.R
      for (let i = 2; i < c.length - 1; i += 2) P.stroke([lerpP(c[i], side[i], 0.45), side[i]], 0.45, { taper: 0.3, wob: 0.03 })
    }
    P.stroke(tb.L, 1.2, { taper: 0.3, wob: 0.12 }); P.stroke(tb.R, 1.2, { taper: 0.3, wob: 0.12 })
    // spines along the outer edge
    if (o.spines && P.detail >= 1) {
      const e = o.spines === 'L' ? tb.L : tb.R
      for (let i = 1; i < e.length - 2; i += 2) {
        const a = e[i], b = e[i + 1], ox = e[i][0] - c[i][0], oy = e[i][1] - c[i][1], d = Math.hypot(ox, oy) || 1, m = lerpP(a, b, 0.5)
        P.solid([a, [m[0] + ox / d * 3.6 + (b[0] - a[0]) * 0.3, m[1] + oy / d * 3.6 + (b[1] - a[1]) * 0.3], b])
      }
    }
    return tb
  }
  /* dragon head facing +x at p, rotated by ang; sz scales it; open = jaw angle */
  function dragonHead(P, p, ang, sz, o = {}) {
    const c = Math.cos(ang), sn = Math.sin(ang)
    const ms = c < 0 ? -1 : 1 // mirror when facing left so the horns stay on top
    const T = (pts) => pts.map(([x, y0]) => { const y = y0 * ms; return [p[0] + (x * c - y * sn) * sz, p[1] + (x * sn + y * c) * sz] })
    const upper = cr([[-4, -3.4], [1, -5], [6.5, -4.6], [11.5, -2.8], [14.2, -1.2], [13.2, 0.3], [7.5, 0.7], [-4, 2.6]], 3, true)
    const hing = [0.5, 1.3], open = o.open === undefined ? 0.42 : o.open
    const jaw0 = [[0, 1], [11, 0.6], [12.6, 1.9], [7, 2.8], [0, 3.4]]
    const jaw = rotP(jaw0, open, hing[0], hing[1])
    // horns and frill first (behind)
    P.stroke(T(bez([-1, -4.2], [-5, -6], [-8, -8.5], [-11, -7.5], 6)), 1.5, { taper: 0.7, wob: 0.05 })
    P.stroke(T(bez([1, -4.6], [-1, -8.5], [-3, -11], [-6, -11.5], 6)), 1.2, { taper: 0.7, wob: 0.05 })
    if (o.beard) P.stroke(T(bez([6, 3], [4, 8], [-1, 11], [-5, 10], 8)), 1.0, { taper: 0.7, wob: 0.05 })
    P.fill(T(jaw)); P.stroke(T(jaw.concat([jaw[0]])), 0.9, { taper: 0.2, wob: 0.05 })
    P.fill(T(upper)); P.wash(T(upper).map(([a, b]) => [(a - p[0]) * 1 + p[0], b]), P.st.tint.water, 0.0)
    P.stroke(T(upper.concat([upper[0]])), 1.1, { taper: 0.2, wob: 0.05 })
    P.dot(T([[5, -2.4]])[0], 0.9 * sz); P.stroke(T([[3.4, -3.6], [7, -3.4]]), 0.6, { taper: 0.5, wob: 0.02 })
    P.dot(T([[11.6, -1.5]])[0], 0.5 * sz)
    if (P.detail >= 1) {
      for (let i = 0; i < 4; i++) { const tx = 6.5 + i * 1.9; P.solid(T([[tx, 0.5], [tx + 0.9, 0.5], [tx + 0.3, 2.3]])) }
      if (o.tongue) P.stroke(T(cr([[8, 2.2], [13, 4], [17, 3], [19.5, 5.5]], 4)), 0.7, { taper: 0.5, wob: 0.02 })
      P.hatch(T([[-4, -3], [1, -4.6], [3, -2], [-4, 2.4]]), { angle: ang + 1.2, gap: 1.2, w: 0.45 })
    }
  }
  const curlW = (x, y, sz, d = 1) => cr([[x, y], [x + d * sz * 0.5, y - sz * 0.15], [x + d * sz * 0.95, y - sz * 0.55], [x + d * sz * 0.7, y - sz * 1.0], [x + d * sz * 0.25, y - sz * 0.8], [x + d * sz * 0.38, y - sz * 0.5]], 5)
  /* foam and swell marks across the waterline, with curls at the bases of humps */
  function seaRow(P, x0, x1, bases = []) {
    if (P.colour) P.wash(arc((x0 + x1) / 2, SY + 3.5, (x1 - x0) / 2 + 3, 7, 0, TAU, 20), P.st.tint.water, 0.5)
    const row = (yy, amp, w, step, ph) => {
      for (let x = x0; x < x1; x += step) {
        const xa = x + R(P.r, -1.5, 1.5), l = step * R(P.r, 0.62, 0.92)
        P.stroke(sine(xa, yy + R(P.r, -0.5, 0.5), l, amp, 1.2, 9, ph + R(P.r, 0, 1.5)), w, { taper: 0.85, wob: 0.08 })
      }
    }
    row(SY + 1, 1.2, 0.95, 11, 0)
    if (P.detail >= 1) row(SY + 5.2, 1.1, 0.75, 9.5, 1)
    if (P.detail >= 2) row(SY + 9, 1, 0.6, 8, 2)
    for (const [bx, sz] of bases) { P.stroke(curlW(bx, SY + 0.4, sz, -1), 0.9, { taper: 0.8, wob: 0.03 }); P.stroke(curlW(bx + 0, SY + 0.4, sz * 0.8, 1), 0.9, { taper: 0.8, wob: 0.03 }) }
  }

  const SERPENTS = [
    /* 0: three humps, dragon head rearing on the left, finned tail on the right */
    (P) => {
      limb(P, cr([[-31, SY], [-34, -6], [-41, -20], [-37, -31]], 5), (t) => 4.8 - 2.1 * t, { spines: 'L' })
      dragonHead(P, [-37, -31], Math.PI * 0.93, 1.3, { tongue: true })
      hump(P, -11, 23, 21); hump(P, 14, 25, 26); hump(P, 37, 17, 14)
      limb(P, cr([[44, SY], [47, 3], [49, -6], [46, -14]], 5), (t) => 3 * (1 - t) + 0.4)
      P.solid([[46, -14], [50, -20], [48.4, -11.5]]); P.solid([[46.4, -13], [41, -19], [44, -10]])
      seaRow(P, -48, 48, [[-30, 4], [-0.5, 3.4], [26, 4]])
    },
    /* 1: rearing S-neck, open jaws, two humps; head on the right */
    (P) => {
      hump(P, -29, 25, 18); hump(P, -4, 23, 16)
      limb(P, cr([[5, SY], [14, 2], [15, -12], [23, -23], [33, -28], [37, -37]], 4), (t) => 5.2 - 2.6 * t, { spines: 'L', bellySide: 'R' })
      dragonHead(P, [37, -37], -0.55, 1.4, { tongue: true, open: 0.55, beard: true })
      seaRow(P, -48, 48, [[-42, 4], [-17, 3.4], [7, 4]])
    },
    /* 2: a train of four humps with an eel head and a flat tail fluke */
    (P) => {
      const xs = [-32, -11, 10, 30], hs = [11, 15, 14, 10]
      xs.forEach((x, i) => hump(P, x, 16 + (i === 1 ? 4 : 0), hs[i], { spine: 3 }))
      const hd = cr([[-48, 3], [-46, -4], [-40, -7], [-35, -3], [-36, SY]], 4, true)
      P.fill(hd); P.wash(hd, P.st.tint.water, 0.55); P.stroke(hd.concat([hd[0]]), 1.2, { taper: 0.2, wob: 0.08 })
      P.dot([-43.2, -3], 1.4); P.dot([-43.6, -3.5], 0.5, P.paper)
      P.stroke([[-48, 1], [-42, 0.8]], 0.7, { taper: 0.5, wob: 0.03 })
      P.solid([[-39, -6.8], [-37.5, -14], [-35, -5.6]]); P.solid([[-41.8, -6.2], [-42, -13], [-38.8, -6.8]])
      limb(P, cr([[37, SY], [42, 3], [46, -4], [48, -11]], 4), (t) => 2.8 * (1 - t) + 0.5)
      P.solid([[48, -11], [44, -17], [48.4, -14.8], [50, -18.5], [50, -11]])
      seaRow(P, -48, 48, [[-42, 3], [-22, 3.4], [0, 3.4], [20, 3.4], [41, 3]])
    },
    /* 3: one long swan neck, small head, a back hump and a tail flick */
    (P) => {
      hump(P, 11, 28, 15, { spine: 3 }); hump(P, 34, 15, 9, { spine: 2.6 })
      limb(P, cr([[-6, SY], [-14, 5], [-22, -6], [-24, -22], [-30, -34], [-40, -34], [-43, -27]], 4), (t) => 5 - 3.5 * t, { bellySide: 'L', spines: 'R' })
      dragonHead(P, [-42, -28], Math.PI * 0.62, 1.05, { open: 0.25 })
      limb(P, cr([[41, SY], [45, 4], [48, -2]], 3), (t) => 2 * (1 - t) + 0.3)
      seaRow(P, -48, 48, [[-9, 3.4], [-1, 3], [26, 3.4], [44, 3]])
    },
    /* 4: diving serpent: two humps, the tail rising on the right, ripples where the head went under */
    (P) => {
      if (P.colour) P.wash(arc(-38, SY + 3, 12, 4.6, 0, TAU, 14), P.st.tint.water, 0.5)
      for (let i = 0; i < 3; i++) P.stroke(arc(-39, SY + 3, 5 + i * 4.4, 1.7 + i * 1.3, Math.PI * 1.05, Math.PI * 2.1, 12), 0.7, { taper: 0.8, wob: 0.05 })
      for (let i = 0; i < 3; i++) P.stroke(arc(-39, SY + 3, 5 + i * 4.4, 1.7 + i * 1.3, 0.05, Math.PI * 0.95, 12), 0.5, { taper: 0.8, wob: 0.05 })
      hump(P, -14, 25, 22); hump(P, 14, 23, 17)
      limb(P, cr([[24, SY], [35, 3], [41, -10], [37, -25], [40, -37]], 4), (t) => 4.4 * (1 - t * 0.82) + 0.2, { spines: 'R', bellySide: 'L' })
      P.solid([[40, -37], [33, -41], [38.6, -33]]); P.solid([[40.2, -36], [47, -39], [41.6, -31]])
      seaRow(P, -48, 48, [[-27, 4], [0, 3.4], [24, 3.4]])
    },
    /* 5: bearded dragon-fish after the old sea charts, three humps with tall fins */
    (P) => {
      hump(P, -13, 24, 20, { spine: 5.6 }); hump(P, 12, 23, 24, { spine: 6.2 }); hump(P, 34, 15, 13, { spine: 4.4 })
      limb(P, cr([[-29, SY], [-38, 1], [-40, -13], [-34, -24]], 4), (t) => 4.8 - 1.8 * t, { spines: 'L' })
      dragonHead(P, [-34, -24], Math.PI * 0.8, 1.3, { beard: true, open: 0.3 })
      limb(P, cr([[41, SY], [47, 5]], 3), (t) => 2.2 * (1 - t) + 0.4)
      P.solid([[47, 4], [49.6, -2], [48.6, 6]]); P.solid([[46, 5], [43, -1], [48.4, 7]])
      seaRow(P, -48, 48, [[-25, 4], [-0.5, 3.4], [23, 4]])
    },
    /* 6: two-headed: a central hump with a neck rising to either side */
    (P) => {
      hump(P, 0, 30, 17, { spine: 4.4 })
      for (const sg of [-1, 1]) {
        limb(P, cr([[sg * 12, 1], [sg * 22, -7], [sg * 28, -18], [sg * 34, -28], [sg * 41, -26]], 4), (t) => 4.4 - 2 * t, { spines: sg < 0 ? 'L' : 'R', bellySide: sg < 0 ? 'R' : 'L' })
        dragonHead(P, [sg * 41, -26], sg < 0 ? Math.PI * 0.55 : Math.PI * 0.45, 1.1, { open: 0.3, tongue: sg < 0 })
      }
      seaRow(P, -48, 48, [[-15, 4], [15, 4]])
    },
    /* 7: a leviathan: one great hump with a dorsal fin ridge, a small hump and a whale-like tail */
    (P) => {
      hump(P, -6, 46, 28, { spines: false })
      const arch = archPts(-6, 46, 28), n = 12
      for (let i = 0; i < n; i++) {
        const t = 0.18 + i * 0.058, k0 = Math.round(t * 16), a = arch[k0], b = arch[Math.min(16, k0 + 1)]
        const m = lerpP(a, b, 0.5), dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, h = 3.4 + 5.4 * Math.sin(Math.PI * (i + 0.5) / n)
        P.solid([a, [m[0] + dy / d * h - dx * 0.2, m[1] - dx / d * h], b])
      }
      hump(P, 33, 15, 10, { spine: 2.6 })
      limb(P, cr([[38, SY], [44, 3], [47, -6], [45, -15]], 4), (t) => 2.8 * (1 - t) + 0.5)
      P.solid([[45, -15], [40, -21], [45.6, -18.4], [51, -22], [48, -14]])
      P.dot([-23, -3], 1.5); P.stroke([[-26.5, -7], [-20, -5.6]], 0.8, { taper: 0.5, wob: 0.02 })
      seaRow(P, -48, 48, [[-28, 4], [17, 3.4]])
    },
  ]

  A.register('sea-serpent', {
    label: 'Sea serpent', category: 'sea', kind: 'fixed', view: 'furniture',
    draw(ctx, x, y, s, r, st, variant = 0) {
      ctx.save()
      const P = makePen(ctx, x, y + s * 0.08, s, r, st)
      SERPENTS[((variant % 8) + 8) % 8](P)
      ctx.restore()
    },
  })

  /* =====================================================================
     CLOUDS: engraved cumulus with scalloped tops, flat bases and trailing streaks (Malazan)
     ===================================================================== */
  const CB = 8 // cloud base y
  function puff(P, cx, cy, rad, o = {}) {
    // scalloped (cauliflower) outline: |sin| gives rounded bumps with sharp little valleys
    const lob = Math.max(5, Math.round(rad * (P.detail ? 0.55 : 0.4))), ph = (cx * 1.7 + cy * 2.3 + rad) % TAU, n = lob * 12, pts = []
    for (let i = 0; i < n; i++) { const a = i / n * TAU, rr = rad * (0.935 + 0.07 * Math.abs(Math.sin(lob * a / 2 + ph))); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]) }
    P.fill(pts)
    if (P.colour) P.wash(pts, o.col || CLOUD, o.dark ? 0.5 : 0.28)
    if (P.detail >= 1) {
      // engraved shade: nearly horizontal hatching over the lower-right of the puff, the lit upper-left kept clear
      P.hatch(pts, { angle: o.dense ? 0.5 : 0.2, gap: o.dense ? 1.15 : 1.5, w: 0.5 })
      const lit = arc(cx - rad * 0.3, cy - rad * 0.34, rad * (o.dense ? 0.7 : 0.86), rad * (o.dense ? 0.7 : 0.86), 0, TAU, 14)
      P.fill(lit.map((q, i) => q), P.paper)
      if (P.colour) P.wash(lit, o.col || CLOUD, 0.12)
    } else P.stroke(arc(cx, cy, rad * 0.78, rad * 0.78, 0.1, Math.PI * 0.6, 6), 0.6, { taper: 0.85, wob: 0.06 })
    P.stroke(pts.concat([pts[0]]), 0.9, { taper: 0.2, wob: 0.2 })
    if (P.detail >= 1) P.stroke(arc(cx - rad * 0.3, cy - rad * 0.34, rad * 0.55, rad * 0.55, Math.PI * 0.95, Math.PI * 1.55, 6), 0.5, { taper: 0.9, wob: 0.05 })
  }
  function cloudBase(P, x0, x1, o = {}) {
    P.stroke([[x0, CB], [x1, CB]], 0.9, { taper: 0.5, wob: 0.15 })
    if (P.detail === 0) return
    const rows = o.rows || 3
    for (let i = 0; i < rows; i++) {
      const yy = CB + 2.2 + i * 2.3, a = x0 + (x1 - x0) * (0.08 + i * 0.06) + R(P.r, -2, 2), b = x1 - (x1 - x0) * (0.12 + i * 0.1) + R(P.r, -2, 2)
      P.stroke([[a, yy], [lerp(a, b, 0.55), yy + R(P.r, -0.25, 0.25)], [b, yy]], 0.55 - i * 0.05, { taper: 0.8, wob: 0.1 })
    }
  }
  function wisp(P, x0, x1, y, curlEnd = 0) {
    const pts = [[x0, y], [lerp(x0, x1, 0.4), y + 0.35], [x1, y - 0.2]]
    P.stroke(pts, 0.55, { taper: 0.9, wob: 0.1 })
    if (curlEnd) P.stroke(curlW(x1, y, 3, curlEnd), 0.5, { taper: 0.7, wob: 0.03 })
  }
  function cloudBody(P, puffs, o = {}) {
    const ctx = P.ctx
    ctx.save()
    const lim = o.base === undefined ? CB : o.base
    ctx.beginPath(); const q = P.pp([[-60, -60], [60, -60], [60, lim], [-60, lim]]); q.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.clip()
    for (const pf of puffs) puff(P, pf[0], pf[1], pf[2], { dense: o.dense, dark: o.dark })
    ctx.restore()
  }
  const CLOUDS = [
    /* 0: classic cumulus cluster with trailing streaks */
    (P) => {
      cloudBody(P, [[-33, 1, 7.5], [34, 2.5, 7], [-22, -5, 10.5], [24, -4, 10], [-5, -11, 14.5], [10, -6, 11], [-13, 0, 9]])
      cloudBase(P, -42, 42, { rows: 3 })
      wisp(P, -50, -30, CB + 1.6); wisp(P, 30, 50, CB + 3.3, 1)
    },
    /* 1: long flat bank */
    (P) => {
      const pf = []
      for (let i = 0; i < 7; i++) pf.push([-38 + i * 12.5 + R(P.r, -1.5, 1.5), 1 - Math.sin(i / 6 * Math.PI) * 4 + R(P.r, -1, 1), 7.5 + Math.sin(i / 6 * Math.PI) * 4 + R(P.r, -0.5, 0.5)])
      cloudBody(P, pf)
      cloudBase(P, -48, 48, { rows: 4 })
      wisp(P, -50, -34, CB + 7.2, -1)
    },
    /* 2: tall tower of cloud */
    (P) => {
      cloudBody(P, [[-16, 3, 8], [14, 3.5, 7.5], [0, 1, 11], [-6, -10, 12], [7, -13, 10], [-1, -22, 11], [-3, -30, 8]])
      cloudBase(P, -26, 26, { rows: 3 })
      wisp(P, -46, -22, CB + 3); wisp(P, 22, 46, CB + 1.7)
    },
    /* 3: small compact cloud */
    (P) => {
      cloudBody(P, [[-15, 2, 8], [14, 2.5, 7.5], [-4, -5, 12], [8, -3, 9]])
      cloudBase(P, -26, 26, { rows: 2 })
      wisp(P, 20, 44, CB + 3.6)
    },
    /* 4: high cirrus: long curling streaks */
    (P) => {
      const y = [-12, -5, 2, 9]
      y.forEach((yy, i) => {
        const x0 = -44 + i * 5 + R(P.r, -3, 3), x1 = 38 - i * 3 + R(P.r, -3, 3)
        const pts = [[x0, yy + 1.5], [lerp(x0, x1, 0.3), yy - 0.5], [lerp(x0, x1, 0.6), yy + 0.6], [x1, yy - 0.4]]
        P.stroke(cr(pts, 5), i % 2 ? 0.8 : 1.0, { taper: 0.9, wob: 0.15 })
        P.stroke(curlW(x1, yy - 0.4, 6 - i * 0.5, i % 2 ? -1 : 1), 0.8, { taper: 0.8, wob: 0.05 })
        if (P.detail) P.stroke([[x0 + 8, yy + 3], [x0 + 24, yy + 3.2]], 0.4, { taper: 0.9, wob: 0.05 })
      })
    },
    /* 5: storm cloud: dense hatching, rain streaks below */
    (P) => {
      cloudBody(P, [[-28, 1, 8], [28, 2, 8], [-16, -6, 12], [18, -5, 11.5], [0, -12, 15], [-1, -2, 12]], { dense: true, dark: true })
      cloudBase(P, -38, 38, { rows: 1 })
      for (let i = 0; i < (P.detail >= 1 ? 14 : 6); i++) { const x = -32 + i * 5 + R(P.r, -1, 1), l = R(P.r, 4, 8); P.stroke([[x, CB + 2.5 + R(P.r, 0, 3)], [x - l * 0.25, CB + 2.5 + l + 4]], 0.5, { taper: 0.6, wob: 0.03 }) }
    },
    /* 6: layered: a high cloud over a lower bank, ragged wisp */
    (P) => {
      cloudBody(P, [[-20, -9, 7], [-8, -15, 10], [6, -12, 8.5], [18, -9, 6.5]], { base: -4 })
      P.stroke([[-30, -4], [28, -4]], 0.9, { taper: 0.5, wob: 0.15 })
      P.ctx.save(); P.ctx.translate(0, 0)
      cloudBody(P, [[-36, 6, 6], [-18, 2, 8.5], [6, 4, 10], [26, 4, 8], [40, 6, 5.5]], { base: CB + 2 })
      P.stroke([[-44, CB + 2], [46, CB + 2]], 0.9, { taper: 0.5, wob: 0.15 })
      P.ctx.restore()
      wisp(P, -48, -26, CB + 5); wisp(P, 20, 44, CB + 7, 1)
    },
    /* 7: wind-blown: puffs trailing into a spiral curl */
    (P) => {
      cloudBody(P, [[-26, 2, 7], [-14, -4, 10.5], [2, -9, 13], [14, -3, 9.5], [24, 2, 6.5]])
      cloudBase(P, -36, 34, { rows: 2 })
      // swirl tail to the right
      P.stroke(cr([[30, -1], [40, -6], [47, -3], [45, 4], [39, 3], [39, -1], [42, -2]], 5), 1.0, { taper: 0.6, wob: 0.1 })
      P.stroke(cr([[28, 3], [38, 8], [48, 6]], 5), 0.6, { taper: 0.8, wob: 0.1 })
      wisp(P, -48, -30, CB + 3, 0)
    },
  ]
  A.register('cloud', {
    label: 'Cloud', category: 'sea', kind: 'fixed', view: 'furniture',
    draw(ctx, x, y, s, r, st, variant = 0) {
      ctx.save()
      const P = makePen(ctx, x, y - s * 0.03, s, r, st)
      CLOUDS[((variant % 8) + 8) % 8](P)
      ctx.restore()
    },
  })

  /* =====================================================================
     WAVES: little wave marks, 2-4 curls or "~~" strokes (recipe, top view)
     ===================================================================== */
  A.register('waves', {
    label: 'Waves', category: 'sea', kind: 'recipe', view: 'top',
    draw(ctx, x, y, s, r, st) {
      ctx.save()
      const P = makePen(ctx, x, y, s, r, st, r() < 0.5)
      const n = 2 + Math.floor(r() * 3), style = r()
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0.5 : i / (n - 1)
        const yy = (t - 0.5) * 46 * (n > 2 ? 1 : 0.8) + R(r, -3, 3) + (n === 2 ? (i ? 6 : -6) : 0)
        const stagger = (i % 2 ? 1 : -1) * R(r, 4, 14), len = R(r, 26, 44)
        const x0 = -len / 2 + stagger
        const kind = style < 0.45 ? 0 : style < 0.75 ? 1 : (i % 2)
        if (P.colour) P.wash(arc(x0 + len / 2, yy + 1.5, len / 2 + 2, 4.2, 0, TAU, 12), st.tint.water, 0.45)
        if (kind === 0) {
          // "~~": two joined swells, tapering off at each end
          const pts = sine(x0, yy, len, R(r, 2.4, 3.6), R(r, 1.5, 2.2), 16, R(r, 0, 1))
          P.stroke(pts, 1.1, { taper: 0.9, wob: 0.15 })
          if (P.detail >= 1 && r() < 0.6) P.stroke(sine(x0 + len * 0.25, yy + 6, len * 0.5, 1.8, 1.2, 10, 1), 0.7, { taper: 0.9, wob: 0.1 })
        } else {
          // a swell that tips over into a small curl
          const d = r() < 0.5 ? 1 : -1, a0 = d > 0 ? x0 : x0 + len
          const pts = cr([[a0, yy + 2], [a0 + d * len * 0.25, yy - 0.5], [a0 + d * len * 0.55, yy + 1.2], [a0 + d * len * 0.8, yy - 3.4], [a0 + d * len * 0.96, yy - 6.4], [a0 + d * len * 0.84, yy - 8.4], [a0 + d * len * 0.7, yy - 6.6], [a0 + d * len * 0.76, yy - 4.8]], 4)
          P.stroke(pts, 1.1, { taper: 0.8, wob: 0.1 })
          if (P.detail >= 1) P.stroke(sine(a0 + d * len * 0.1, yy + 5.6, len * 0.62 * d, 1.3, 1.1, 8, 0.5), 0.6, { taper: 0.9, wob: 0.05 })
        }
      }
      ctx.restore()
    },
  })

  /* =====================================================================
     WHIRLPOOL: a spiral of broken strokes with spray (recipe, top view)
     ===================================================================== */
  A.register('whirlpool', {
    label: 'Whirlpool', category: 'sea', kind: 'recipe', view: 'top',
    draw(ctx, x, y, s, r, st) {
      ctx.save()
      const P = makePen(ctx, x, y, s, r, st)
      const squash = R(r, 0.62, 0.8), tilt = R(r, -0.3, 0.3), dir = r() < 0.5 ? 1 : -1, turns = R(r, 1.7, 2.3), a0 = R(r, 0, TAU)
      const Rmax = 42
      const at = (t, off) => {
        const a = a0 + off + dir * turns * TAU * t, rad = Rmax * Math.pow(1 - t, 1.25) + 3
        const px = Math.cos(a) * rad, py = Math.sin(a) * rad * squash
        return [px * Math.cos(tilt) - py * Math.sin(tilt), px * Math.sin(tilt) + py * Math.cos(tilt)]
      }
      if (P.colour) { P.wash(arc(0, 0, Rmax * 1.02, Rmax * 1.02 * squash, 0, TAU, 24), st.tint.water, 0.5); P.wash(arc(0, 0, 13, 13 * squash, 0, TAU, 14), st.tint.water, 0.55) }
      // two heavy arms that swell toward the throat
      for (let ar = 0; ar < 2; ar++) {
        const off = ar * Math.PI
        const pieces = P.detail >= 1 ? [[0.02, 0.36, 1.0], [0.34, 0.66, 1.6], [0.64, 0.97, 2.4]] : [[0.02, 0.5, 1.2], [0.48, 0.97, 2.4]]
        for (const [t0, t1, w] of pieces) {
          const pts = []
          for (let i = 0; i <= 16; i++) pts.push(at(lerp(t0, t1, i / 16), off))
          P.stroke(pts, w, { taper: 0.8, wob: 0.1 })
        }
      }
      // dashes of moving water between the arms
      if (P.detail >= 1) for (let ar = 0; ar < 2; ar++) {
        const off = Math.PI / 2 + ar * Math.PI
        for (const [t0, t1] of [[0.14, 0.27], [0.42, 0.53], [0.7, 0.79]]) {
          const pts = []
          for (let i = 0; i <= 8; i++) pts.push(at(lerp(t0, t1, i / 8), off))
          P.stroke(pts, 0.65, { taper: 0.9, wob: 0.05 })
        }
      }
      // little breaking crests riding the outer arms, each hooking outward
      const nh = P.detail >= 1 ? 3 : 2
      for (let ar = 0; ar < 2; ar++) for (let h = 0; h < nh; h++) {
        const t = 0.07 + h * 0.15 + ar * 0.06 + R(r, -0.01, 0.01), p0 = at(t, ar * Math.PI), p1 = at(t + 0.03 * 1, ar * Math.PI)
        const tl = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1, T = [(p1[0] - p0[0]) / tl, (p1[1] - p0[1]) / tl]
        const cl = Math.hypot(p0[0], p0[1]) || 1, N = [p0[0] / cl, p0[1] / cl]
        const q2 = (u, v) => [p0[0] + T[0] * u + N[0] * v, p0[1] + T[1] * u + N[1] * v]
        P.stroke(cr([q2(0, 0), q2(3, 0.7), q2(5.6, 2.6), q2(4.8, 5), q2(2.8, 4.8), q2(3, 3)], 4), 0.85, { taper: 0.75, wob: 0.03 })
      }
      // the throat
      P.solid(arc(0, 0, 3.4, 3.4 * squash, 0, TAU, 10))
      // chop around the rim: little tapered wave strokes lying along the swirl
      const ns = P.detail >= 1 ? 4 : 3
      for (let i = 0; i < ns; i++) {
        const a = a0 + i * TAU / ns + R(r, -0.5, 0.5), rr = R(r, 44, 49), cx = Math.cos(a) * rr, cy = Math.sin(a) * rr * squash
        const tx = -Math.sin(a) * dir, ty = Math.cos(a) * squash * dir
        P.stroke(sine(cx - tx * 5 - 5, cy - ty * 5, 10, 1.5, 1.8, 10, R(r, 0, 2)), 0.8, { taper: 0.9, wob: 0.05 })
      }
      ctx.restore()
    },
  })
})(window.Atlas)
