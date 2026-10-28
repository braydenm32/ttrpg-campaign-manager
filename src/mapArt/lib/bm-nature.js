/* Top-down natural pieces for Warded Atlas battle maps: trees, plants, rocks, lily pads.
   Look: Dyson Logos / Mike Schley module maps seen from directly above. Light from the upper left. */
;(function (A) {
  const { R, pick } = A
  const TAU = Math.PI * 2, SH = Math.PI / 4 /* the direction shade falls: lower right */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
  const winter = (st) => !!(st.tint && st.tint.label === 'Winter')
  const desert = (st) => !!(st.tint && st.tint.label === 'Desert')
  /* Pen weight. A nib stays about the same width, but battle-map pieces are shown big, so it grows a little with size. */
  const nib = (st, s) => st.line * clamp(Math.pow(s / 60, 0.45), 0.65, 2)
  const SHADOW = 'rgba(40,30,15,.25)'
  const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
  const mix = (c1, c2, t) => { const a = hex(c1), b = hex(c2); return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('') }
  const dark = (c, k) => mix(c, '#2a2012', k)
  const light = (c, k) => mix(c, '#f7f2e4', k)
  const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d }
  /* how much a direction faces the shade: 1 lower right, -1 upper left */
  const facing = (a) => Math.cos(angDiff(a, SH))
  const bark = (st) => dark(mix(st.tint.roof, st.tint.rock, 0.55), 0.22)
  const wood = (st) => light(st.tint.sand, 0.15)

  /** Ribbon stroke whose width runs from w0 at the start to w1 at the end (blades, branches, pinnae). */
  function taperStroke(ctx, pts, r, w0, w1, color, wob = 0.5) {
    if (pts.length < 2) return
    const p = A.wobble(pts, r, wob)
    let total = 0; const acc = [0]
    for (let i = 1; i < p.length; i++) { total += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); acc.push(total) }
    const L = [], Rr = []
    for (let i = 0; i < p.length; i++) {
      const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)], d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
      const nx = -(b[1] - a[1]) / d, ny = (b[0] - a[0]) / d, t = total ? acc[i] / total : 0
      const hw = (w0 + (w1 - w0) * t) / 2
      L.push([p[i][0] + nx * hw, p[i][1] + ny * hw]); Rr.push([p[i][0] - nx * hw, p[i][1] - ny * hw])
    }
    ctx.beginPath(); L.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])))
    for (let i = Rr.length - 1; i >= 0; i--) ctx.lineTo(Rr[i][0], Rr[i][1])
    ctx.closePath(); ctx.fillStyle = color; ctx.fill()
  }
  const ink = (ctx, pts, r, w, st, taper = 0.55, wob = 0.4) => A.inkStroke(ctx, pts, r, { w, wob, taper, color: st.ink })

  /** Radius function of a lumpy ellipse: rx, ry plus low-frequency bulges so nothing comes out a circle. */
  function lumpy(r, rx, ry, amp) {
    const p1 = r() * TAU, p2 = r() * TAU, p3 = r() * TAU
    const a1 = amp * R(r, 0.6, 1), a2 = amp * R(r, 0.4, 0.8), a3 = amp * R(r, 0.2, 0.5)
    return (a) => {
      const c = Math.cos(a), s = Math.sin(a)
      return (rx * ry) / Math.sqrt(ry * ry * c * c + rx * rx * s * s) * (1 + a1 * Math.sin(2 * a + p1) + a2 * Math.sin(3 * a + p2) + a3 * Math.sin(5 * a + p3))
    }
  }
  const ring = (cx, cy, radial, m, scale = 1, rot = 0) => { const p = []; for (let i = 0; i < m; i++) { const a = rot + (i / m) * TAU; p.push([cx + Math.cos(a) * radial(a) * scale, cy + Math.sin(a) * radial(a) * scale]) } return p }
  const arcPts = (cx, cy, radial, a0, a1, m, scale = 1) => { const p = []; for (let i = 0; i <= m; i++) { const a = a0 + (a1 - a0) * (i / m); p.push([cx + Math.cos(a) * radial(a) * scale, cy + Math.sin(a) * radial(a) * scale]) } return p }

  /** Scalloped closed outline around (cx, cy). radial(angle) gives the base radius; n bumps of uneven width and depth. */
  function scallops(r, cx, cy, radial, n, { depth = [0.1, 0.2], ptsPer = 6, widthJit = 0.4, jit = 0 } = {}) {
    const ws = []; let tot = 0
    for (let i = 0; i < n; i++) { const w = 1 + R(r, -widthJit, widthJit); ws.push(w); tot += w }
    const segs = [], all = []
    let a0 = r() * TAU
    for (let i = 0; i < n; i++) {
      const span = (ws[i] / tot) * TAU, d = R(r, depth[0], depth[1]), seg = []
      const m = Math.max(3, Math.round(ptsPer * ws[i]))
      for (let k = 0; k <= m; k++) {
        const t = k / m, a = a0 + span * t
        const bump = Math.pow(Math.sin(Math.PI * t), 0.75)
        const rad = radial(a) * (1 - d + d * bump) + (k && k < m ? R(r, -jit, jit) : 0)
        seg.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad])
      }
      seg.mid = a0 + span / 2
      segs.push(seg); for (let k = 0; k < m; k++) all.push(seg[k])
      a0 += span
    }
    return { segs, all }
  }
  /** Outline a scalloped shape bump by bump, each bump its own tapered pen stroke overrunning the cusp; some pen lifts. */
  function inkScallops(ctx, sh, r, w, st, { wob = 0.45, lifts = 0, heavyShade = 0.25 } = {}) {
    const n = sh.segs.length
    sh.segs.forEach((seg, i) => {
      const pts = seg.concat([sh.segs[(i + 1) % n][1]]), ww = w * (1 + heavyShade * facing(seg.mid)) * R(r, 0.9, 1.1)
      if (lifts && r() < lifts && pts.length > 6) { const c = Math.floor(pts.length / 2); ink(ctx, pts.slice(0, c), r, ww, st, 0.5, wob); ink(ctx, pts.slice(c + 1), r, ww, st, 0.5, wob) }
      else ink(ctx, pts, r, ww, st, 0.5, wob)
    })
  }

  /** Opaque silhouette fill (occlusion): paper, then in colour mode a watercolour wash on top. */
  function base(ctx, st, r, path, tint, alpha = 0.55) {
    ctx.fillStyle = st.paper; path(); ctx.fill()
    if (st.mode === 'colour' && tint) A.wash(ctx, path, tint, r, alpha)
  }
  /** Inner shading wash without the pooled edge: two soft fills, slightly offset, so patches blend instead of outlining. */
  function soft(ctx, path, color, r, alpha) {
    ctx.save(); ctx.globalAlpha = alpha * 0.55; ctx.fillStyle = color
    path(); ctx.fill(); ctx.translate(A.R(r, -1.5, 1.5), A.R(r, -1.5, 1.5)); path(); ctx.fill()
    ctx.restore()
  }
  const bbox = (pts, pad = 2) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; pts.forEach((p) => { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1] }); return [x0 - pad, y0 - pad, x1 + pad, y1 + pad] }
  /** Cast shadow, drawn BEFORE the piece so the piece hides the overlap: hatching in ink, a dark wash in colour. */
  function castShadow(ctx, st, r, path, box, s, f, k = 0.08) {
    if (!st.shadows) return
    const d = Math.max(1.5, s * k)
    ctx.save(); ctx.translate(d * 0.85, d)
    if (st.mode === 'colour') { ctx.fillStyle = SHADOW; path(); ctx.fill() }
    else A.hatch(ctx, path, box, r, { angle: 0.85, gap: clamp(s * 0.04, 2.3, 5.5) * st.line, w: 0.65 * f, wob: 0.3, color: st.ink })
    ctx.restore()
  }
  /** Shade on a roundish top-down form: curved strokes hugging the lower-right edge in rings stepping inward, each ring
      spanning a narrower arc, so the hatch reads as a crescent that follows the form. Optional cross ticks at the rim. */
  function crescent(ctx, st, r, cx, cy, radial, f, { rings = 3, gap = 3, outer = 0.93, span = 1.3, w = 0.85, cross = false, centre = SH } = {}) {
    const Rm = radial(centre)
    for (let i = 0; i < rings; i++) {
      const rho = outer - (i * gap) / Rm + R(r, -0.012, 0.012)
      if (rho < 0.2) break
      const sp = span * Math.pow(1 - i / (rings + 0.5), 0.75) * R(r, 0.85, 1.1), c = centre + R(r, -0.12, 0.12)
      const m = Math.max(3, Math.round((sp * 2 * Rm * rho) / 5))
      const pts = arcPts(cx, cy, radial, c - sp, c + sp, m, rho)
      if (pts.length > 8 && r() < 0.5) { const k = Math.floor(pts.length * R(r, 0.35, 0.65)); ink(ctx, pts.slice(0, k), r, w, st, 0.6, 0.3); ink(ctx, pts.slice(k + 1), r, w, st, 0.6, 0.3) }
      else ink(ctx, pts, r, w, st, 0.6, 0.3)
    }
    if (cross) {
      /* a loose second layer of short diagonal ticks near the rim, not a picket fence */
      const n = Math.round((span * 1.2 * Rm) / (gap * 2.2))
      for (let i = 0; i < n; i++) {
        const a = centre + R(r, -span * 0.6, span * 0.6), rho = R(r, 0.8, 0.94), rad = radial(a)
        const px = cx + Math.cos(a) * rad * rho, py = cy + Math.sin(a) * rad * rho, l = gap * R(r, 1.1, 1.8), ta = a + R(r, 0.5, 0.9)
        ink(ctx, [[px - Math.cos(ta) * l * 0.5, py - Math.sin(ta) * l * 0.5], [px + Math.cos(ta) * l * 0.5, py + Math.sin(ta) * l * 0.5]], r, w * 0.75, st, 0.5, 0.2)
      }
    }
  }
  /** Small leaf-cluster marks: two or three little scallop bumps in a row, the "m" marks of a pen-drawn canopy. */
  function leafClusters(ctx, st, r, cx, cy, radial, f, n, size) {
    for (let i = 0; i < n; i++) {
      const a = r() * TAU, rho = R(r, 0.15, 0.85)
      if (r() > 0.45 + 0.45 * facing(a)) continue
      const rad = radial(a) * rho, px = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad
      const k = 2 + Math.floor(r() * 2), bw = size * R(r, 0.8, 1.2), dir = R(r, -0.6, 0.6), pts = []
      const ux = Math.cos(dir), uy = Math.sin(dir), nx = -uy, ny = ux
      for (let j = 0; j < k; j++) for (let q = 0; q <= 4; q++) { const t = q / 4, h = Math.sin(Math.PI * t) * bw * 0.45; pts.push([px + ux * (j + t) * bw + nx * h, py + uy * (j + t) * bw + ny * h]) }
      ink(ctx, pts, r, 0.8 * f, st, 0.6, 0.25)
    }
  }
  /** Tiny leaf marks: short curved ticks sprinkled inside a canopy, more on the shade side. */
  function leafTicks(ctx, st, r, cx, cy, radial, f, n) {
    for (let i = 0; i < n; i++) {
      const a = r() * TAU, rho = Math.sqrt(r()) * 0.9
      if (r() > 0.35 + 0.55 * facing(a)) continue
      const rad = radial(a) * rho, px = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad, l = R(r, 1.6, 3.2) * f, ta = r() * TAU
      ink(ctx, [[px, py], [px + Math.cos(ta) * l * 0.5, py + Math.sin(ta) * l * 0.5 + R(r, -0.6, 0.6) * f], [px + Math.cos(ta) * l, py + Math.sin(ta) * l]], r, 0.75 * f, st, 0.6, 0.2)
    }
  }
  /** Snow lying on the lit upper-left part of a top-down thing (colour mode, winter only). Call inside a clip. */
  function snowCap(ctx, st, r, cx, cy, Rm, alpha = 0.75) {
    if (st.mode !== 'colour' || !winter(st)) return
    const sn = lumpy(r, Rm * 0.82, Rm * 0.78, 0.16)
    A.wash(ctx, () => A.poly(ctx, ring(cx - Rm * 0.2, cy - Rm * 0.22, sn, 24)), st.tint.snow, r, alpha)
  }

  /* ---------------------------------------------------------------- broadleaf canopy: tree and bush share this */
  function canopy(ctx, st, r, x, y, s, o) {
    const f = nib(st, s), Rm = s / 2
    const rx = Rm * R(r, o.elong[0], o.elong[1]), ry = Rm * R(r, 0.9, 1)
    const radial = lumpy(r, rx, ry, o.lump)
    const n = clamp(Math.round(s / o.bumpPx), 6, 26)
    const sh = scallops(r, x, y, radial, n, { depth: o.depth, ptsPer: s < 40 ? 4 : 6, widthJit: 0.45, jit: 0.25 * f })
    const path = () => A.poly(ctx, sh.all)
    const box = [x - Rm * 1.3, y - Rm * 1.3, x + Rm * 1.3, y + Rm * 1.3]
    castShadow(ctx, st, r, path, box, s, f, o.shadowK)
    base(ctx, st, r, path, st.tint.forest, 0.5)
    ctx.save(); path(); ctx.clip()
    /* inner clumps: mounds of foliage, each outlined only on its shaded lower-right side and hatched there,
       drawn outer first so the central (highest) ones sit on top */
    const nc = o.clumps(s, r)
    if (nc) {
      /* lobes sit in a ring round the middle (plus one in the middle when there are many), big enough to tile the crown */
      const cs = [], a0 = r() * TAU, ringN = nc >= 5 ? nc - 1 : nc
      for (let i = 0; i < ringN; i++) { const a = a0 + (i / ringN) * TAU + R(r, -0.25, 0.25) * (TAU / ringN), d = Rm * R(r, 0.3, 0.5); cs.push([x + Math.cos(a) * d, y + Math.sin(a) * d]) }
      if (nc >= 5) cs.push([x + Rm * R(r, -0.1, 0.1), y + Rm * R(r, -0.1, 0.1)])
      cs.sort((p, q) => Math.hypot(q[0] - x, q[1] - y) - Math.hypot(p[0] - x, p[1] - y))
      const dkCol = st.tint.forestDark
      cs.forEach((p) => {
        const cr = Rm * R(r, o.clumpR[0], o.clumpR[1]) * (nc <= 2 ? 1.15 : 1)
        const cl = lumpy(r, cr * R(r, 0.9, 1.1), cr, 0.1)
        /* small bumps, so the mound reads as a mass of leaf clusters rather than a bubble */
        const csh = scallops(r, p[0], p[1], cl, clamp(Math.round((TAU * cr) / (s * 0.07)), 6, 18), { depth: [0.12, 0.24], ptsPer: 4, jit: 0.25 * f })
        const cpath = () => A.poly(ctx, csh.all)
        base(ctx, st, r, cpath, st.tint.forest, 0.5)
        if (st.mode === 'colour') { ctx.save(); cpath(); ctx.clip(); soft(ctx, () => A.poly(ctx, ring(p[0] + cr * 0.4, p[1] + cr * 0.4, cl, 14, 0.85)), dkCol, r, 0.3); ctx.restore() }
        const k = csh.segs.length
        csh.segs.forEach((seg, i) => {
          const d = Math.abs(angDiff(seg.mid, SH)), pts = seg.concat([csh.segs[(i + 1) % k][1]])
          if (d < 1.35) { if (r() < 1.15 - d * 0.3) ink(ctx, pts, r, 1.0 * f * R(r, 0.85, 1.15), st, 0.55, 0.4) }
          else if (r() < 0.3) ink(ctx, pts, r, 0.7 * f, st, 0.7, 0.4) /* the lit side: only a few faint bumps */
        })
        crescent(ctx, st, r, p[0], p[1], cl, f, { rings: 1, gap: 3, outer: 0.74, span: 0.7, w: 0.75 * f })
      })
    }
    if (st.mode === 'colour') {
      /* a soft darker pool on the shade side and a faint light on the lit side; a mottle or two so the wash is uneven */
      const dk = lumpy(r, rx * 0.9, ry * 0.9, 0.2)
      soft(ctx, () => A.poly(ctx, ring(x + rx * 0.32, y + ry * 0.32, dk, 22)), st.tint.forestDark, r, 0.4)
      soft(ctx, () => A.poly(ctx, ring(x + rx * 0.45, y + ry * 0.45, dk, 22, 0.6)), st.tint.forestDark, r, 0.25)
      soft(ctx, () => A.poly(ctx, ring(x - rx * 0.35, y - ry * 0.35, lumpy(r, rx * 0.5, ry * 0.5, 0.25), 16)), light(st.tint.forest, 0.7), r, 0.2)
      if (s >= 90) for (let i = 0; i < 1 + Math.floor(s / 150); i++) {
        const a = SH + R(r, -1.2, 1.2), d = R(r, 0.3, 0.7) * Rm, br = Rm * R(r, 0.15, 0.28)
        soft(ctx, () => A.poly(ctx, ring(x + Math.cos(a) * d, y + Math.sin(a) * d, lumpy(r, br, br * 0.8, 0.25), 12)), st.tint.forestDark, r, 0.2)
      }
      snowCap(ctx, st, r, x, y, Rm)
    }
    /* shade: a crescent of curved hatching on the lower right, with loose cross ticks at the rim when big */
    crescent(ctx, st, r, x, y, radial, f, { rings: s < 36 ? 2 : 3, gap: clamp(s * 0.042, 2.4, 7) * st.line, outer: 0.92, span: 1.2, w: 0.85 * f, cross: s >= 90 })
    if (s >= o.ticksFrom) { leafClusters(ctx, st, r, x, y, radial, f, Math.round(s * o.ticksPer), clamp(s * 0.035, 3, 9)); leafTicks(ctx, st, r, x, y, radial, f, Math.round(s * o.ticksPer * 0.6)) }
    ctx.restore()
    inkScallops(ctx, sh, r, 1.35 * f, st, { lifts: s > 80 ? 0.15 : 0 })
    /* a hint of the trunk's shadow: a small dark knot of cross-hatching through a gap in the middle */
    if (o.trunk && s >= 56) {
      const tx = x + Rm * R(r, 0, 0.08), ty = y + Rm * R(r, 0, 0.08), tr = Rm * R(r, 0.05, 0.07)
      for (let i = 0; i < 5; i++) { const a = R(r, 0.6, 1.2) + (i % 2 ? Math.PI / 2 : 0) + R(r, -0.2, 0.2), l = tr * R(r, 0.8, 1.3), ox = R(r, -0.4, 0.4) * tr, oy = R(r, -0.4, 0.4) * tr; ink(ctx, [[tx + ox - Math.cos(a) * l, ty + oy - Math.sin(a) * l], [tx + ox + Math.cos(a) * l, ty + oy + Math.sin(a) * l]], r, 0.8 * f, st, 0.5, 0.2) }
    }
  }

  A.register('bm-tree', {
    label: 'Tree', category: 'bm-trees', kind: 'recipe', view: 'top',
    draw(ctx, x, y, s, r, st) {
      ctx.save()
      canopy(ctx, st, r, x, y, s, {
        elong: [0.9, 1], lump: 0.09, bumpPx: 7.5, depth: [0.08, 0.2], shadowK: 0.08, trunk: true, ticksFrom: 100, ticksPer: 0.1, clumpR: [0.38, 0.52],
        clumps: (s, r) => (s < 36 ? 0 : s < 70 ? 2 + Math.floor(r() * 2) : s < 140 ? 3 + Math.floor(r() * 2) : 4 + Math.floor(r() * 3)),
      })
      ctx.restore()
    },
  })

  A.register('bm-bush', {
    label: 'Bush', category: 'bm-plants', kind: 'recipe', view: 'top',
    draw(ctx, x, y, s, r, st) {
      ctx.save()
      canopy(ctx, st, r, x, y, s, {
        elong: [0.72, 1], lump: 0.18, bumpPx: 6, depth: [0.12, 0.24], shadowK: 0.06, trunk: false, ticksFrom: 60, ticksPer: 0.12, clumpR: [0.42, 0.56],
        clumps: (s, r) => (s < 40 ? 0 : s < 90 ? 2 : 2 + Math.floor(r() * 2)),
      })
      ctx.restore()
    },
  })

  /* ---------------------------------------------------------------- fir / spruce from above: layered, drooping needle tiers */
  /** Jagged ring of needle tips round radial()*scale: nS teeth of uneven length and depth. */
  function jaggedRing(r, cx, cy, radial, scale, nS, depth, rot) {
    /* teeth come in clusters: a slow wave sets where the notches cut deep (branch tips) and where the edge runs shallow */
    const pts = [], ph = r() * TAU, waves = 3 + Math.floor(r() * 3)
    for (let i = 0; i < nS; i++) {
      const a = rot + (i / nS) * TAU + R(r, -0.25, 0.25) * (TAU / nS), a2 = a + (TAU / nS) * R(r, 0.3, 0.7)
      const w = 0.35 + 0.95 * Math.pow(0.5 + 0.5 * Math.sin((i / nS) * TAU * waves + ph), 1.5)
      const ro = radial(a) * scale * (1 + 0.06 * (w - 0.6)) * R(r, 0.94, 1.05), ri = radial(a2) * scale * (1 - depth * w * R(r, 0.5, 1.4))
      pts.push([cx + Math.cos(a) * ro, cy + Math.sin(a) * ro], [cx + Math.cos(a2) * ri, cy + Math.sin(a2) * ri])
    }
    return pts
  }
  /** A closed jagged ring as several pen strokes with small lifts (some left out when keep < 1), heavier on the shade side. */
  function inkRing(ctx, st, r, pts, cx, cy, w, pieces, lift = 1, keep = 1) {
    const n = pts.length, per = Math.ceil(n / pieces)
    for (let i = 0; i < pieces; i++) {
      if (r() > keep) continue
      const i0 = i * per, i1 = Math.min(n, i0 + per + 1 - lift), seg = []
      for (let k = i0; k < i1; k++) seg.push(pts[k % n])
      if (i === pieces - 1 && !lift) seg.push(pts[0])
      if (seg.length < 2) continue
      const m = seg[Math.floor(seg.length / 2)], fc = facing(Math.atan2(m[1] - cy, m[0] - cx))
      ink(ctx, seg, r, w * (1 + 0.35 * fc) * R(r, 0.9, 1.1), st, 0.35, 0.3)
    }
  }
  A.register('bm-pine', {
    label: 'Pine', category: 'bm-trees', kind: 'recipe', view: 'top',
    draw(ctx, x, y, s, r, st) {
      ctx.save()
      const f = nib(st, s), Rm = s / 2
      const radial = lumpy(r, Rm * R(r, 0.92, 1), Rm * R(r, 0.9, 1), 0.08)
      /* small pines need bolder teeth or they read as lumps; big ones get finer, more numerous tips */
      const nS = clamp(Math.round(s / 4.5), 10, 48)
      const outer = jaggedRing(r, x, y, radial, 1, nS, s < 80 ? 0.22 : 0.14, r() * TAU)
      const path = () => A.poly(ctx, outer), box = [x - Rm * 1.3, y - Rm * 1.3, x + Rm * 1.3, y + Rm * 1.3]
      castShadow(ctx, st, r, path, box, s, f, 0.07)
      base(ctx, st, r, path, st.tint.forestDark, 0.55)
      ctx.save(); path(); ctx.clip()
      if (st.mode === 'colour') {
        /* darker toward the rim (the low outer tiers), a lit apex in the middle, and the usual pool to the lower right */
        const hole = ring(x, y, radial, 20, 0.5).reverse()
        soft(ctx, () => { ctx.beginPath(); outer.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); hole.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath() }, dark(st.tint.forestDark, 0.4), r, 0.4)
        soft(ctx, () => A.poly(ctx, ring(x - Rm * 0.05, y - Rm * 0.05, lumpy(r, Rm * 0.32, Rm * 0.3, 0.2), 14)), light(st.tint.forestDark, 0.45), r, 0.35)
        soft(ctx, () => A.poly(ctx, ring(x + Rm * 0.35, y + Rm * 0.35, lumpy(r, Rm * 0.8, Rm * 0.8, 0.2), 18)), dark(st.tint.forestDark, 0.5), r, 0.35)
        snowCap(ctx, st, r, x, y, Rm, 0.6)
      }
      /* whorls: tiers of branch tips as broken jagged rings, each on its own slightly shifted lumpy circle,
         with spokes running out toward the ring outside it and needles drooping off its tips */
      const tiers = s < 40 ? 1 : s < 90 ? 2 : 3, rhos = [0.7, 0.46, 0.25]
      let prevR = 1
      for (let k = 0; k < tiers; k++) {
        const rho = rhos[k] * R(r, 0.92, 1.06), ox = x + Rm * R(r, -0.05, 0.05), oy = y + Rm * R(r, -0.05, 0.05)
        const tl = lumpy(r, Rm * rho * R(r, 0.95, 1), Rm * rho, 0.1), m = Math.max(6, Math.round(nS * rho * 1.1))
        const ring_ = jaggedRing(r, ox, oy, tl, 1, m, 0.09 / rho, r() * TAU)
        inkRing(ctx, st, r, ring_, ox, oy, 0.85 * f, 4 + Math.floor(rho * 4), 1, s < 90 ? 0.95 : 0.75)
        if (s >= 50) for (let j = 0, ns = 5 + Math.floor(r() * 4); j < ns; j++) {
          const a = r() * TAU, r0 = tl(a) * R(r, 0.95, 1.05), r1 = Math.min(radial(a) * prevR * 0.92, r0 + Rm * (prevR - rho) * R(r, 0.5, 0.9))
          if (r1 - r0 < 2) continue
          const bend = R(r, -0.08, 0.08) * (r1 - r0), ca = Math.cos(a), sa = Math.sin(a)
          taperStroke(ctx, [[ox + ca * r0, oy + sa * r0], [x + ca * (r0 + r1) / 2 - sa * bend, y + sa * (r0 + r1) / 2 + ca * bend], [x + ca * r1, y + sa * r1]], r, 1.0 * f, 0.3 * f, st.ink, 0.25)
        }
        if (s >= 56) for (let i = 0; i < ring_.length; i += 2) {
          const q = ring_[i], a = Math.atan2(q[1] - oy, q[0] - ox); if (r() > 0.3 + 0.35 * facing(a)) continue
          const l = Rm * R(r, 0.05, 0.1), ta = a + 0.25 + R(r, -0.3, 0.3)
          taperStroke(ctx, [q, [q[0] + Math.cos(ta) * l, q[1] + Math.sin(ta) * l]], r, 0.8 * f, 0.2 * f, st.ink, 0.15)
        }
        prevR = rho
      }
      /* a fringe of needle ticks round the rim, dense on the shade side and sparse on the lit side, so the edge darkens */
      const nn = Math.round(nS * (s < 40 ? 1 : 2.2))
      for (let i = 0; i < nn; i++) {
        const a = r() * TAU; if (r() > 0.4 + 0.5 * facing(a)) continue
        const rho = R(r, 0.74, 0.94), rad = radial(a) * rho, l = Rm * R(r, 0.05, 0.12), ta = a + 0.2 + R(r, -0.45, 0.45)
        const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad
        taperStroke(ctx, [[px, py], [px + Math.cos(ta) * l, py + Math.sin(ta) * l]], r, 0.75 * f, 0.2 * f, st.ink, 0.15)
      }
      crescent(ctx, st, r, x, y, radial, f, { rings: s < 36 ? 1 : s < 100 ? 2 : 3, gap: clamp(s * 0.045, 2.4, 6) * st.line, outer: 0.9, span: 1.1, w: 0.8 * f })
      /* the apex: a dot with a few short spokes */
      ctx.fillStyle = st.ink; ctx.beginPath(); ctx.arc(x, y, Math.max(0.8, Rm * 0.03), 0, TAU); ctx.fill()
      if (s >= 30) { const ns = s < 90 ? 7 : 5, far = s < 90 ? 0.3 : 0.16, a0 = r() * TAU; for (let i = 0; i < ns; i++) { const a = a0 + (i / ns) * TAU + R(r, -0.3, 0.3), l0 = Rm * 0.05, l1 = Rm * R(r, 0.12, far); taperStroke(ctx, [[x + Math.cos(a) * l0, y + Math.sin(a) * l0], [x + Math.cos(a) * l1, y + Math.sin(a) * l1]], r, 0.9 * f, 0.2 * f, st.ink, 0.15) } }
      ctx.restore()
      inkRing(ctx, st, r, outer, x, y, 1.15 * f, clamp(Math.round(nS / 4), 3, 12), 0)
      ctx.restore()
    },
  })

  /* ---------------------------------------------------------------- bare tree: forked branches radiating from the trunk */
  A.register('bm-dead-tree', {
    label: 'Bare tree', category: 'bm-trees', kind: 'recipe', view: 'top',
    draw(ctx, x, y, s, r, st) {
      ctx.save()
      const f = nib(st, s), Rm = s / 2, maxDepth = s < 40 ? 2 : s < 110 ? 3 : 4
      const tw = Math.max(1.6, s * 0.032) * st.line, trunkR = s * R(r, 0.04, 0.055)
      const segs = []
      const branch = (x0, y0, ang, len, w, depth) => {
        const pts = [[x0, y0]]; let px = x0, py = y0, a = ang
        const nsg = depth === maxDepth ? 3 : 2
        for (let i = 0; i < nsg; i++) { a += R(r, -0.35, 0.35); const l = len / nsg; px += Math.cos(a) * l; py += Math.sin(a) * l; pts.push([px, py]) }
        const wEnd = depth === 0 ? 0.25 * f : w * 0.55
        segs.push({ pts, w0: w, w1: wEnd, depth })
        if (depth === 0) return
        const nk = depth === maxDepth ? 2 + (r() < 0.5 ? 1 : 0) : 1 + (r() < 0.75 ? 1 : 0)
        for (let k = 0; k < nk; k++) {
          const side = k % 2 ? 1 : -1, na = a + side * R(r, 0.3, 0.8) + R(r, -0.15, 0.15)
          const t = k === 0 ? 1 : R(r, 0.45, 1), sp = pts[pts.length - 1], sq = pts[pts.length - 2]
          branch(sq[0] + (sp[0] - sq[0]) * t, sq[1] + (sp[1] - sq[1]) * t, na, len * R(r, 0.55, 0.7), w * 0.55, depth - 1)
        }
        if (depth >= 2 && r() < 0.5) { const sp = pts[1], sa = a + (r() < 0.5 ? 1 : -1) * R(r, 0.9, 1.5); segs.push({ pts: [sp, [sp[0] + Math.cos(sa) * len * 0.25, sp[1] + Math.sin(sa) * len * 0.25]], w0: w * 0.5, w1: 0.25 * f, depth: 0 }) }
      }
      const nMain = 4 + Math.floor(r() * 3), a0 = r() * TAU
      for (let i = 0; i < nMain; i++) { const a = a0 + (i / nMain) * TAU + R(r, -0.3, 0.3); branch(x + Math.cos(a) * trunkR * 0.7, y + Math.sin(a) * trunkR * 0.7, a, Rm * R(r, 0.4, 0.5), tw, maxDepth) }
      /* cast shadow: the skeleton again, offset; a wash in colour, short ticks along the main limbs in ink */
      if (st.shadows) {
        const d = Math.max(1.5, s * 0.06)
        ctx.save(); ctx.translate(d * 0.85, d)
        if (st.mode === 'colour') { segs.forEach((g) => taperStroke(ctx, g.pts, r, g.w0 * 1.2, g.w1 * 1.2, SHADOW, 0.2)); ctx.fillStyle = SHADOW; ctx.beginPath(); ctx.arc(x, y, trunkR, 0, TAU); ctx.fill() }
        else segs.forEach((g) => {
          /* a thin broken ghost of the main limbs */
          if (g.depth < maxDepth - 1) return
          const p = A.wobble(g.pts, r, 0.3, 4)
          for (let i = 1; i < p.length; i++) if (r() < 0.5) ink(ctx, [p[i - 1], p[i]], r, Math.max(0.45, g.w0 * 0.22), st, 0.3, 0.1)
        })
        ctx.restore()
      }
      segs.forEach((g) => taperStroke(ctx, g.pts, r, g.w0, g.w1, st.ink, 0.3))
      /* the trunk top: a broken ring with a dark heart */
      const tl = lumpy(r, trunkR, trunkR * 0.9, 0.12), tp = () => A.poly(ctx, ring(x, y, tl, 12))
      base(ctx, st, r, tp, bark(st), 0.5)
      ink(ctx, ring(x, y, tl, 14, 1, r() * TAU).concat([]), r, 1.2 * f, st, 0.3, 0.35)
      ctx.fillStyle = st.ink; ctx.beginPath(); ctx.arc(x + trunkR * 0.1, y + trunkR * 0.1, Math.max(0.8, trunkR * 0.3), 0, TAU); ctx.fill()
      if (s >= 60) { const a = r() * TAU; ink(ctx, [[x, y], [x + Math.cos(a) * trunkR * 0.95, y + Math.sin(a) * trunkR * 0.95]], r, 0.7 * f, st, 0.3, 0.3) }
      ctx.restore()
    },
  })

  /* ---------------------------------------------------------------- grass tuft */
  /* blades are pure linework, so in colour mode they are inked in a very dark green rather than black, as a painter would */
  const bladeInk = (st) => (st.mode === 'colour' ? mix(st.ink, st.tint.forestDark, 0.75) : st.ink)
  function blades(ctx, st, r, x, y, Rm, f, n, { lenR = [0.55, 1], w0 = 1.5, curl = 0.18, start = 0.08 } = {}) {
    const a0 = r() * TAU, col = bladeInk(st)
    if (st.mode === 'colour') { n = Math.max(3, Math.round(n * 0.75)); w0 *= 0.8 }
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * TAU + R(r, -0.4, 0.4) * (TAU / n), len = Rm * R(r, lenR[0], lenR[1]), ca = Math.cos(a), sa = Math.sin(a)
      const p0 = [x + ca * Rm * start, y + sa * Rm * start], p2 = [p0[0] + ca * len, p0[1] + sa * len], k = R(r, -curl, curl) * len
      const p1 = [(p0[0] + p2[0]) / 2 - sa * k, (p0[1] + p2[1]) / 2 + ca * k]
      taperStroke(ctx, [p0, p1, p2], r, w0 * f, 0.2 * f, col, 0.25)
    }
  }
  A.register('bm-grass', {
    label: 'Grass tuft', category: 'bm-plants', kind: 'recipe', view: 'top',
    draw(ctx, x, y, s, r, st) {
      ctx.save()
      const f = nib(st, s), Rm = s / 2, n = clamp(Math.round(s / 11), 4, 16) + Math.floor(r() * 3)
      if (st.mode === 'colour') A.wash(ctx, () => A.poly(ctx, ring(x, y, lumpy(r, Rm * 0.62, Rm * 0.55, 0.2), 14)), st.tint.forest, r, 0.45)
      blades(ctx, st, r, x, y, Rm, f, n, { w0: 1.7, curl: 0.24, start: 0.02 })
      blades(ctx, st, r, x, y, Rm, f, Math.max(2, Math.round(n * 0.4)), { lenR: [0.25, 0.5], w0: 1.3, curl: 0.3, start: 0 })
      if (s >= 40 && r() < 0.6) { ctx.fillStyle = st.ink; for (let i = 0; i < 2; i++) { const a = r() * TAU, d = Rm * R(r, 0.7, 1); ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 0.7 * f, 0, TAU); ctx.fill() } }
      ctx.restore()
    },
  })

  /* ---------------------------------------------------------------- wildflowers */
  A.register('bm-flowers', {
    label: 'Wildflowers', category: 'bm-plants', kind: 'recipe', view: 'top',
    draw(ctx, x, y, s, r, st) {
      ctx.save()
      const f = nib(st, s), Rm = s / 2
      const nb = s < 30 ? 2 + Math.floor(r() * 2) : 3 + Math.floor(r() * 5)
      const pal = winter(st) ? ['#e6dfd0', '#b9b4c8'] : desert(st) ? ['#d8b86a', '#c98a5e', '#e6d6b0'] : ['#c48a8a', '#cdb16a', '#9f98b8', '#e2d8bd', '#c9986e']
      const cols = [pick(r, pal), pick(r, pal)]
      const pts = A.scatter(r, nb, (rr) => { const a = rr() * TAU, d = Math.sqrt(rr()) * Rm * 0.7; return [x + Math.cos(a) * d, y + Math.sin(a) * d] }, Rm * 0.34)
      /* stems from a loose heart to each bloom, then leaves off the stems, low on the ground */
      const hx = x + Rm * R(r, -0.15, 0.15), hy = y + Rm * R(r, -0.15, 0.15), stems = []
      pts.forEach((p) => { const nx = -(p[1] - hy), ny = p[0] - hx, k = R(r, -0.2, 0.2); stems.push([[hx, hy], [(hx + p[0]) / 2 + nx * k, (hy + p[1]) / 2 + ny * k], p]) })
      if (s >= 36) stems.forEach((sp) => ink(ctx, sp, r, 0.7 * f, st, 0.3, 0.3))
      const nl = s < 30 ? 2 : 3 + Math.floor(r() * 4)
      for (let i = 0; i < nl; i++) {
        const sp = pick(r, stems), t = R(r, 0.3, 0.8), u = 1 - t
        const q0 = [u * u * sp[0][0] + 2 * u * t * sp[1][0] + t * t * sp[2][0], u * u * sp[0][1] + 2 * u * t * sp[1][1] + t * t * sp[2][1]]
        const a = r() * TAU, l = Rm * R(r, 0.22, 0.4), lw = l * R(r, 0.3, 0.42), ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca
        const at = (tt, w) => [q0[0] + ca * l * tt + nx * w, q0[1] + sa * l * tt + ny * w]
        const L = [q0, at(0.3, lw * 0.42), at(0.62, lw * 0.5), at(0.88, lw * 0.22), at(1, 0)], Rr = [q0, at(0.3, -lw * 0.42), at(0.62, -lw * 0.5), at(0.88, -lw * 0.22), at(1, 0)]
        if (s >= 36) {
          base(ctx, st, r, () => A.poly(ctx, L.concat(Rr.slice().reverse())), st.tint.forest, 0.5)
          ink(ctx, L, r, 0.85 * f, st, 0.5, 0.25); ink(ctx, Rr, r, 0.85 * f, st, 0.5, 0.25)
          if (l > 12) taperStroke(ctx, [q0, at(0.85, 0)], r, 0.6 * f, 0.15 * f, st.ink, 0.15)
        } else taperStroke(ctx, [q0, at(1, 0)], r, 1.1 * f, 0.2 * f, st.ink, 0.2)
      }
      pts.forEach((p, i) => {
        const br = Math.max(1.6, Rm * R(r, 0.1, 0.17)), col = cols[i % 2]
        if (br < 3.2 * st.line) {
          /* tiny bloom: a ring of dots round a centre */
          if (st.mode === 'colour') { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(p[0], p[1], br, 0, TAU); ctx.fill() }
          ctx.fillStyle = st.ink
          for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU + i; ctx.beginPath(); ctx.arc(p[0] + Math.cos(a) * br * 0.75, p[1] + Math.sin(a) * br * 0.75, 0.55 * f, 0, TAU); ctx.fill() }
          return
        }
        const np = 5 + Math.floor(r() * 2), sh = scallops(r, p[0], p[1], lumpy(r, br, br * 0.95, 0.05), np, { depth: [0.32, 0.45], ptsPer: 4, widthJit: 0.2 })
        base(ctx, st, r, () => A.poly(ctx, sh.all), col, 0.7)
        sh.segs.forEach((seg) => ink(ctx, seg, r, 0.8 * f, st, 0.6, 0.3))
        if (st.mode === 'colour') { ctx.fillStyle = '#b89446'; ctx.beginPath(); ctx.arc(p[0], p[1], br * 0.3, 0, TAU); ctx.fill() }
        ctx.fillStyle = st.ink; ctx.beginPath(); ctx.arc(p[0] + br * 0.1, p[1] + br * 0.1, br * 0.16 + 0.3 * f, 0, TAU); ctx.fill()
      })
      /* buds */
      ctx.fillStyle = st.ink
      for (let i = 0; i < 2 + Math.floor(r() * 3); i++) { const a = r() * TAU, d = Rm * R(r, 0.5, 0.95); ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, 0.7 * f, 0, TAU); ctx.fill() }
      ctx.restore()
    },
  })

  /* ---------------------------------------------------------------- reeds / cattails */
  A.register('bm-reeds', {
    label: 'Reeds', category: 'bm-plants', kind: 'recipe', view: 'top',
    draw(ctx, x, y, s, r, st) {
      ctx.save()
      const f = nib(st, s), Rm = s / 2
      if (st.mode === 'colour') A.wash(ctx, () => A.poly(ctx, ring(x, y, lumpy(r, Rm * 0.6, Rm * 0.5, 0.25), 14)), st.tint.forest, r, 0.45)
      blades(ctx, st, r, x, y, Rm, f, clamp(Math.round(s / 8), 6, 26) + Math.floor(r() * 3), { lenR: [0.5, 1], w0: 1.2, curl: 0.16, start: 0.04 })
      blades(ctx, st, r, x, y, Rm, f, clamp(Math.round(s / 18), 2, 8), { lenR: [0.25, 0.5], w0: 1.0, curl: 0.3, start: 0.03 })
      /* cattail heads on straight stalks */
      const nh = s < 36 ? 1 : 2 + Math.floor(r() * 3), a0 = r() * TAU
      for (let i = 0; i < nh; i++) {
        const a = a0 + (i / nh) * TAU + R(r, -0.5, 0.5), d = Rm * R(r, 0.5, 0.8), ca = Math.cos(a), sa = Math.sin(a)
        const hx = x + ca * d, hy = y + sa * d, hr = Math.max(1.1, Rm * 0.04), hl = Math.max(2.6, Rm * 0.12)
        taperStroke(ctx, [[x + ca * Rm * 0.05, y + sa * Rm * 0.05], [hx - ca * hl, hy - sa * hl]], r, 0.9 * f, 0.6 * f, st.ink, 0.15)
        const head = () => { ctx.beginPath(); ctx.ellipse(hx, hy, hl, hr, a, 0, TAU) }
        if (st.mode === 'colour') { ctx.fillStyle = '#5b3f25'; head(); ctx.fill(); ctx.strokeStyle = st.ink; ctx.lineWidth = 0.7 * f; head(); ctx.stroke() }
        else { ctx.fillStyle = st.ink; head(); ctx.fill() }
        taperStroke(ctx, [[hx + ca * hl, hy + sa * hl], [hx + ca * hl * 1.7, hy + sa * hl * 1.7]], r, 0.7 * f, 0.2 * f, st.ink, 0.1)
      }
      ctx.restore()
    },
  })

  /* ---------------------------------------------------------------- fern rosette */
  A.register('bm-fern', {
    label: 'Fern', category: 'bm-plants', kind: 'recipe', view: 'top',
    draw(ctx, x, y, s, r, st) {
      ctx.save()
      const f = nib(st, s), Rm = s / 2, nf = s < 36 ? 4 + Math.floor(r() * 2) : 5 + Math.floor(r() * 4), a0 = r() * TAU
      const fronds = []
      for (let i = 0; i < nf; i++) {
        const a = a0 + (i / nf) * TAU + R(r, -0.3, 0.3) * (TAU / nf), L = Rm * R(r, 0.7, 1), bend = R(r, -0.3, 0.3)
        const ca = Math.cos(a), sa = Math.sin(a), p0 = [x + ca * Rm * 0.04, y + sa * Rm * 0.04], p2 = [p0[0] + ca * L, p0[1] + sa * L]
        const p1 = [(p0[0] + p2[0]) / 2 - sa * bend * L, (p0[1] + p2[1]) / 2 + ca * bend * L]
        const at = (t) => { const u = 1 - t; return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]] }
        const hw = (t) => L * 0.24 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.75)), 0.9)
        const mid = [], left = [], right = [], m = 12
        for (let k = 0; k <= m; k++) {
          const t = k / m, p = at(t), q = at(Math.min(1, t + 0.01)), d = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1, nx = -(q[1] - p[1]) / d, ny = (q[0] - p[0]) / d, w = hw(t)
          mid.push(p); left.push([p[0] + nx * w, p[1] + ny * w]); right.push([p[0] - nx * w, p[1] - ny * w])
        }
        fronds.push({ a, L, at, hw, mid, env: left.concat(right.reverse()) })
      }
      /* shaded (lower-right) fronds drawn first, lit ones on top */
      fronds.sort((p, q) => facing(q.a) - facing(p.a))
      fronds.forEach((fr) => {
        const path = () => A.poly(ctx, fr.env)
        base(ctx, st, r, path, st.tint.forest, 0.45)
        if (st.mode === 'colour' && facing(fr.a) > 0.2) soft(ctx, path, st.tint.forestDark, r, 0.4 * facing(fr.a))
        taperStroke(ctx, fr.mid, r, 1.1 * f, 0.3 * f, st.ink, 0.25)
        if (s < 30) return
        const step = clamp(s * 0.021, 2.1, 4.5) * st.line
        for (let d = step * 1.5, side = 1; d < fr.L * 0.96; d += step * R(r, 0.85, 1.15), side = -side) {
          const t = d / fr.L, p = fr.at(t), q = fr.at(Math.min(1, t + 0.02)), dd = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1
          const ux = (q[0] - p[0]) / dd, uy = (q[1] - p[1]) / dd, nx = -uy * side, ny = ux * side
          const l = fr.hw(t) * R(r, 0.85, 1.05); if (l < 1.2) continue
          const dx = nx * 0.8 + ux * 0.5, dy = ny * 0.8 + uy * 0.5, dn = Math.hypot(dx, dy)
          const e = [p[0] + (dx / dn) * l, p[1] + (dy / dn) * l], c = [p[0] + (dx / dn) * l * 0.5 + ux * l * 0.14, p[1] + (dy / dn) * l * 0.5 + uy * l * 0.14]
          taperStroke(ctx, [p, c, e], r, 1.0 * f, 0.2 * f, st.ink, 0.12)
        }
      })
      ctx.fillStyle = st.ink; ctx.beginPath(); ctx.arc(x, y, Math.max(0.8, Rm * 0.035), 0, TAU); ctx.fill()
      ctx.restore()
    },
  })

  /* ---------------------------------------------------------------- mushrooms: a cluster or a fairy ring */
  A.register('bm-mushrooms', {
    label: 'Mushrooms', category: 'bm-plants', kind: 'recipe', view: 'top',
    draw(ctx, x, y, s, r, st) {
      ctx.save()
      const f = nib(st, s), Rm = s / 2, ringed = s >= 44 && r() < 0.4
      const caps = []
      if (ringed) { const n = 6 + Math.floor(r() * 5), a0 = r() * TAU; for (let i = 0; i < n; i++) { const a = a0 + (i / n) * TAU + R(r, -0.15, 0.15), d = Rm * R(r, 0.62, 0.8); caps.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, cr: Rm * R(r, 0.09, 0.16) }) } }
      else {
        const n = s < 36 ? 3 : 3 + Math.floor(r() * 5)
        const pts = A.scatter(r, n, (rr) => { const a = rr() * TAU, d = Math.sqrt(rr()) * Rm * 0.6; return [x + Math.cos(a) * d, y + Math.sin(a) * d] }, Rm * 0.3)
        pts.forEach((p, i) => caps.push({ x: p[0], y: p[1], cr: Rm * (i === 0 ? R(r, 0.26, 0.34) : R(r, 0.11, 0.24)) }))
      }
      const spotted = r() < 0.5, pale = r() < 0.4
      const capCol = pale ? dark(st.tint.sand, 0.25) : pick(r, [mix(st.tint.roof, st.tint.sand, 0.3), mix(st.tint.roof, '#6a4a2c', 0.5), light(st.tint.rock, 0.1)])
      A.drawSorted(caps.map((c) => ({ y: c.y, draw: () => {
        const rl = lumpy(r, c.cr, c.cr * R(r, 0.88, 1), 0.07), path = () => A.poly(ctx, ring(c.x, c.y, rl, 16))
        if (c.cr >= 2.5) castShadow(ctx, st, r, path, [c.x - c.cr * 1.5, c.y - c.cr * 1.5, c.x + c.cr * 1.5, c.y + c.cr * 1.5], c.cr * 2, f, 0.14)
        base(ctx, st, r, path, capCol, 0.6)
        if (c.cr < 2.2) { ctx.strokeStyle = st.ink; ctx.lineWidth = 0.8 * f; path(); ctx.stroke(); return }
        const seams = c.cr > 6 ? 3 : 2, a0 = r() * TAU
        for (let i = 0; i < seams; i++) ink(ctx, arcPts(c.x, c.y, rl, a0 + (i / seams) * TAU, a0 + ((i + 1) / seams) * TAU + 0.25, Math.max(4, Math.round(c.cr * 0.8)), 1), r, (1.1 + 0.3 * facing(a0 + ((i + 0.5) / seams) * TAU)) * f, st, 0.4, 0.3)
        ctx.save(); path(); ctx.clip()
        if (st.mode === 'colour') soft(ctx, () => A.poly(ctx, ring(c.x + c.cr * 0.3, c.y + c.cr * 0.3, rl, 12, 0.8)), dark(capCol, 0.4), r, 0.4)
        crescent(ctx, st, r, c.x, c.y, rl, f, { rings: c.cr > 9 ? 3 : 2, gap: clamp(c.cr * 0.2, 2, 5) * st.line, outer: 0.82, span: 1.1, w: 0.75 * f })
        if (spotted && c.cr >= 4) for (let k = 0; k < 2 + Math.floor(c.cr / 3); k++) {
          const a = r() * TAU, d = c.cr * Math.sqrt(r()) * 0.75, sr = c.cr * R(r, 0.09, 0.15), sx = c.x + Math.cos(a) * d, sy = c.y + Math.sin(a) * d
          if (st.mode === 'colour') { ctx.fillStyle = st.tint.snow; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, TAU); ctx.fill() }
          ctx.strokeStyle = st.ink; ctx.lineWidth = 0.6 * f; ctx.beginPath(); ctx.arc(sx, sy, sr, R(r, 0, 2), 5.6); ctx.stroke()
        } else if (!spotted && c.cr >= 5) {
          /* the umbo: a little raised boss in the middle, lit upper left */
          if (st.mode === 'colour') { ctx.fillStyle = light(capCol, 0.45); ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(c.x - c.cr * 0.15, c.y - c.cr * 0.15, c.cr * 0.3, 0, TAU); ctx.fill(); ctx.globalAlpha = 1 }
          ink(ctx, arcPts(c.x - c.cr * 0.1, c.y - c.cr * 0.1, () => c.cr * 0.3, SH - 1.1, SH + 1.1, 6), r, 0.7 * f, st, 0.6, 0.25)
        }
        ctx.restore()
      } })))
      ctx.restore()
    },
  })

  /* ---------------------------------------------------------------- tree stump */
  A.register('bm-stump', {
    label: 'Tree stump', category: 'bm-trees', kind: 'recipe', view: 'top',
    draw(ctx, x, y, s, r, st) {
      ctx.save()
      const f = nib(st, s), Rb = (s / 2) * R(r, 0.86, 0.96)
      const bl = lumpy(r, Rb * R(r, 0.92, 1), Rb, 0.07), ws = R(r, 0.76, 0.84), wx = x + Rb * R(r, -0.05, 0.05), wy = y + Rb * R(r, -0.05, 0.05)
      const bpath = () => A.poly(ctx, ring(x, y, bl, 28)), wpath = () => A.poly(ctx, ring(wx, wy, bl, 28, ws))
      const box = [x - Rb * 1.5, y - Rb * 1.5, x + Rb * 1.5, y + Rb * 1.5]
      /* roots first, so the stump sits on top of their inner ends */
      if (s >= 56) {
        const nr = 2 + Math.floor(r() * 3), a0 = r() * TAU
        for (let i = 0; i < nr; i++) {
          const a = a0 + (i / nr) * TAU + R(r, -0.4, 0.4), ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca
          const r0 = Rb * 0.75, r1 = Rb * R(r, 1.12, 1.32), w0 = Rb * R(r, 0.32, 0.44), bendk = R(r, -0.15, 0.15) * Rb
          const mid = [x + ca * (r0 + r1) / 2 + nx * bendk, y + sa * (r0 + r1) / 2 + ny * bendk], end = [x + ca * r1 + nx * bendk * 1.6, y + sa * r1 + ny * bendk * 1.6]
          const L = [[x + ca * r0 + nx * w0 / 2, y + sa * r0 + ny * w0 / 2], [mid[0] + nx * w0 * 0.3, mid[1] + ny * w0 * 0.3], [end[0] + nx * w0 * 0.12, end[1] + ny * w0 * 0.12]]
          const Rt = [[x + ca * r0 - nx * w0 / 2, y + sa * r0 - ny * w0 / 2], [mid[0] - nx * w0 * 0.3, mid[1] - ny * w0 * 0.3], [end[0] - nx * w0 * 0.12, end[1] - ny * w0 * 0.12]]
          const rpts = L.concat(Rt.slice().reverse()), rp = () => A.poly(ctx, rpts)
          castShadow(ctx, st, r, rp, bbox(rpts, Rb * 0.1), s, f, 0.04)
          base(ctx, st, r, rp, bark(st), 0.5)
          ink(ctx, L, r, 1.1 * f, st, 0.4, 0.4); ink(ctx, Rt, r, 1.1 * f, st, 0.4, 0.4); ink(ctx, [L[2], Rt[2]], r, 0.9 * f, st, 0.5, 0.4)
          ink(ctx, [[x + ca * r0 * 1.05, y + sa * r0 * 1.05], [mid[0] + nx * w0 * 0.05, mid[1] + ny * w0 * 0.05]], r, 0.6 * f, st, 0.5, 0.4)
        }
      }
      castShadow(ctx, st, r, bpath, box, s, f, 0.07)
      base(ctx, st, r, bpath, bark(st), 0.6)
      base(ctx, st, r, wpath, wood(st), 0.5)
      ctx.save(); wpath(); ctx.clip()
      /* growth rings: broken concentric strokes, closer together toward the edge */
      const nr = s < 40 ? 2 : clamp(3 + Math.floor(s / 45), 3, 9)
      for (let k = 0; k < nr; k++) {
        const sc = ws * (0.12 + 0.84 * Math.pow((k + 1) / (nr + 0.5), 0.8)) * R(r, 0.97, 1.03), pieces = 2 + Math.floor(r() * 2), a0 = r() * TAU
        for (let i = 0; i < pieces; i++) { const aa = a0 + (i / pieces) * TAU + R(r, 0, 0.3), ab = a0 + ((i + 1) / pieces) * TAU - R(r, 0.05, 0.3); ink(ctx, arcPts(wx, wy, bl, aa, ab, Math.max(4, Math.round(Rb * sc * 0.5)), sc), r, 0.7 * f, st, 0.6, 0.35) }
      }
      ctx.fillStyle = st.ink; ctx.beginPath(); ctx.arc(wx + Rb * 0.02, wy + Rb * 0.02, Math.max(0.8, Rb * 0.04), 0, TAU); ctx.fill()
      /* cracks */
      for (let i = 0; i < (s < 40 ? 1 : 1 + Math.floor(r() * 2)); i++) {
        const a = r() * TAU, pts = [[wx, wy]]; let d = 0, aa = a
        for (let k = 0; k < 4; k++) { d += Rb * ws * 0.26; aa += R(r, -0.25, 0.25); pts.push([wx + Math.cos(aa) * d, wy + Math.sin(aa) * d]) }
        taperStroke(ctx, pts, r, 1.3 * f, 0.2 * f, st.ink, 0.2)
      }
      if (st.mode === 'colour') { soft(ctx, () => A.poly(ctx, ring(wx + Rb * 0.25, wy + Rb * 0.25, bl, 14, ws * 0.7)), dark(wood(st), 0.3), r, 0.3); snowCap(ctx, st, r, wx, wy, Rb * ws, 0.8) }
      ctx.restore()
      /* wood edge, then the bark band: radial ticks, heavier and denser on the shade side */
      ink(ctx, ring(wx, wy, bl, 30, ws, r() * TAU).concat([]), r, 1.0 * f, st, 0.3, 0.35)
      const gap = clamp(s * 0.05, 3, 8) * st.line, nt = Math.round((TAU * Rb) / gap)
      for (let i = 0; i < nt; i++) {
        const a = (i / nt) * TAU + R(r, -0.4, 0.4) * (TAU / nt), fc = facing(a)
        if (r() > 0.45 + 0.5 * fc) continue
        const r0 = Rb * ws * R(r, 1.0, 1.08), r1 = Rb * R(r, 0.9, 1.02), ta = a + R(r, -0.2, 0.2)
        ink(ctx, [[wx + Math.cos(a) * r0, wy + Math.sin(a) * r0], [x + Math.cos(ta) * r1, y + Math.sin(ta) * r1]], r, (0.7 + 0.3 * fc) * f, st, 0.4, 0.25)
      }
      inkScallops(ctx, scallops(r, x, y, bl, clamp(Math.round(s / 6), 8, 26), { depth: [0.02, 0.07], ptsPer: 4, widthJit: 0.5, jit: 0.2 * f }), r, 1.4 * f, st, { lifts: 0.1 })
      ctx.restore()
    },
  })

  /* ---------------------------------------------------------------- fallen log (s is its length) */
  A.register('bm-log', {
    label: 'Fallen log', category: 'bm-trees', kind: 'recipe', view: 'top',
    draw(ctx, x, y, s, r, st) {
      ctx.save()
      const f = nib(st, s), L = s, th = r() * TAU, W = clamp(L * R(r, 0.15, 0.2), 5, 70), h = W / 2
      ctx.translate(x, y); ctx.rotate(th)
      const shadeSide = Math.sin(SH - th) >= 0 ? 1 : -1 /* which long edge (local +y or -y) faces the shade */
      /* body: two long edges that taper toward the broken end, a cut end (half ellipse) and a jagged broken end */
      const x0 = -L / 2 + h * 0.4, x1 = L / 2 - h * 0.3, tap = R(r, 0.8, 0.92)
      const edge = (sg) => { const p = []; for (let i = 0; i <= 8; i++) { const t = i / 8; p.push([x0 + (x1 - x0) * t, sg * h * (1 - (1 - tap) * t) + R(r, -0.06, 0.06) * h]) } return p }
      const top = edge(-1), bot = edge(1)
      const jag = []; { const n = 3 + Math.floor(h / 4); for (let i = 1; i < n; i++) { const t = i / n; jag.push([x1 + h * R(r, 0.05, 0.35) * (i % 2 ? 1 : 0.3), -h * tap + 2 * h * tap * t]) } }
      const cut = []; for (let i = 1; i < 8; i++) { const a = Math.PI / 2 + (i / 8) * Math.PI; cut.push([x0 + Math.cos(a) * h * 0.5, Math.sin(a) * h * 1.0]) }
      const body = top.concat(jag, bot.slice().reverse(), cut)
      const path = () => A.poly(ctx, body)
      const box = bbox(body, h)
      if (st.shadows) {
        const d = Math.max(1.5, s * 0.035), dx = d * 0.85, dy = d, lx = dx * Math.cos(th) + dy * Math.sin(th), ly = -dx * Math.sin(th) + dy * Math.cos(th)
        ctx.save(); ctx.translate(lx, ly)
        if (st.mode === 'colour') { ctx.fillStyle = SHADOW; path(); ctx.fill() }
        else A.hatch(ctx, path, box, r, { angle: 0.85 - th, gap: clamp(h * 0.18, 2.3, 5.5) * st.line, w: 0.65 * f, wob: 0.3, color: st.ink })
        ctx.restore()
      }
      base(ctx, st, r, path, bark(st), 0.55)
      ctx.save(); path(); ctx.clip()
      if (st.mode === 'colour') {
        soft(ctx, () => A.poly(ctx, [[x0, shadeSide * h * 0.25], [x1, shadeSide * h * 0.2], [x1 + h, shadeSide * h * 1.2], [x0 - h, shadeSide * h * 1.2]]), dark(bark(st), 0.4), r, 0.45)
        if (winter(st)) A.wash(ctx, () => A.poly(ctx, [[x0, -shadeSide * h * 0.2], [x1, -shadeSide * h * 0.1], [x1, -shadeSide * h * 1.2], [x0 - h, -shadeSide * h * 1.2]]), st.tint.snow, r, 0.8)
      }
      /* bark grain: long broken strokes along the log, crowding toward the shade edge */
      const nl = s < 60 ? 3 : 5 + Math.floor(s / 40)
      for (let i = 0; i < nl; i++) {
        const u = (i + 0.5) / nl, yy = shadeSide * h * (0.95 - 1.8 * Math.pow(u, 1.4)) * tap, heavy = yy * shadeSide > h * 0.3
        let xx = x0 + R(r, 0, h)
        while (xx < x1 - h * 0.2) { const len = h * R(r, 0.8, 2.6); ink(ctx, [[xx, yy + R(r, -0.08, 0.08) * h], [xx + len * 0.5, yy + R(r, -0.08, 0.08) * h], [Math.min(xx + len, x1 - h * 0.1), yy + R(r, -0.08, 0.08) * h]], r, (heavy ? 0.9 : 0.65) * f, st, 0.5, 0.45); xx += len + h * R(r, 0.2, 0.9) }
      }
      /* bark cracks across the grain, crowding to the shade side; a diagonal hatch band at the shade edge when big */
      if (s >= 70) for (let i = 0; i < Math.round(s / 16); i++) { const xx = R(r, x0 + h * 0.3, x1 - h * 0.3), yy = shadeSide * h * R(r, -0.3, 0.85); if (r() > 0.4 + yy * shadeSide / h) continue; ink(ctx, [[xx, yy], [xx + R(r, -1, 1) * f, yy + shadeSide * R(r, 1.5, 3.5) * f]], r, 0.6 * f, st, 0.4, 0.2) }
      if (s >= 90) for (let xx = x0 + h * 0.5; xx < x1 - h * 0.3; xx += clamp(h * 0.22, 2.5, 6) * st.line * R(r, 0.8, 1.2)) ink(ctx, [[xx, shadeSide * h * 0.98], [xx + h * 0.35, shadeSide * h * R(r, 0.5, 0.65)]], r, 0.6 * f, st, 0.5, 0.2)
      /* a knot */
      if (s >= 90 && r() < 0.7) {
        const kx = R(r, x0 + h, x1 - h), ky = R(r, -0.4, 0.4) * h, kr = h * R(r, 0.14, 0.2)
        ink(ctx, arcPts(kx, ky, (a) => kr * (1.5 - 0.5 * Math.abs(Math.sin(a))), 0.3, TAU + 0.6, 10), r, 0.75 * f, st, 0.4, 0.3)
        ink(ctx, arcPts(kx, ky, (a) => kr * 0.5 * (1.5 - 0.5 * Math.abs(Math.sin(a))), 1, TAU + 0.5, 7), r, 0.6 * f, st, 0.5, 0.2)
      }
      ctx.restore()
      /* edges: heavier on the shade side */
      ink(ctx, top, r, (1.3 + (shadeSide < 0 ? 0.4 : 0)) * f, st, 0.3, 0.5)
      ink(ctx, bot, r, (1.3 + (shadeSide > 0 ? 0.4 : 0)) * f, st, 0.3, 0.5)
      ink(ctx, [top[top.length - 1]].concat(jag, [bot[bot.length - 1]]), r, 1.1 * f, st, 0.3, 0.4)
      /* cut end: rings seen a little from the side */
      ink(ctx, [top[0]].concat(cut.slice().reverse(), [bot[0]]), r, 1.3 * f, st, 0.3, 0.4)
      for (let k = 1; k <= (s < 50 ? 1 : 2 + Math.floor(h / 6)); k++) {
        const sc = k / ((s < 50 ? 1 : 2 + Math.floor(h / 6)) + 1), pts = []
        for (let i = 0; i <= 6; i++) { const a = Math.PI / 2 + (i / 6) * Math.PI; pts.push([x0 + Math.cos(a) * h * 0.5 * sc, Math.sin(a) * h * sc]) }
        ink(ctx, pts, r, 0.7 * f, st, 0.5, 0.3)
      }
      ink(ctx, [[x0, -h * 0.98], [x0 + h * 0.08, 0], [x0, h * 0.98]], r, 1.0 * f, st, 0.2, 0.3)
      /* broken branch stubs growing out from under the edges */
      const ns = s < 50 ? 1 : 1 + Math.floor(r() * 3)
      for (let i = 0; i < ns; i++) {
        const sg = i === 0 ? -shadeSide : (r() < 0.5 ? 1 : -1), sx = R(r, x0 + h, x1 - h * 1.5), tilt = R(r, -0.6, 0.6), sl = W * R(r, 0.5, 1.1), sw = W * R(r, 0.22, 0.3)
        const ca = Math.cos(tilt), sa = Math.sin(tilt) * sg
        const b0 = [sx, sg * h * 0.5], e = [sx + sa * sl, sg * h * 0.5 + ca * sg * sl]
        const nx = ca, ny = -sa
        const Lp = [[b0[0] + nx * sw / 2, b0[1] + ny * sw / 2], [e[0] + nx * sw * 0.3, e[1] + ny * sw * 0.3]], Rp = [[b0[0] - nx * sw / 2, b0[1] - ny * sw / 2], [e[0] - nx * sw * 0.3, e[1] - ny * sw * 0.3]]
        const sp = () => A.poly(ctx, Lp.concat(Rp.slice().reverse()))
        base(ctx, st, r, sp, bark(st), 0.55)
        ink(ctx, [Lp[0], Lp[1]], r, 1.1 * f, st, 0.3, 0.4); ink(ctx, [Rp[0], Rp[1]], r, 1.1 * f, st, 0.3, 0.4)
        ink(ctx, [Lp[1], [e[0] + nx * sw * 0.05, e[1] + ny * sw * 0.05 + R(r, -1, 1)], Rp[1]], r, 1.0 * f, st, 0.4, 0.5)
        if (s >= 80) ink(ctx, [[b0[0] + nx * sw * 0.15, b0[1] + ny * sw * 0.15], [e[0] * 0.6 + b0[0] * 0.4 + nx * sw * 0.1, e[1] * 0.6 + b0[1] * 0.4 + ny * sw * 0.1]], r, 0.6 * f, st, 0.5, 0.3)
      }
      ctx.restore()
    },
  })

  /* ---------------------------------------------------------------- rocks */
  /** One stone: an angular, lumpy base outline with a smaller top face set toward the light and side faces between them.
      Side faces turned from the light are hatched in one direction along their edge; the top face stays light. */
  function stone(ctx, st, r, cx, cy, rad, f, detail) {
    const nV = detail < 1 ? 6 + Math.floor(r() * 2) : 7 + Math.floor(r() * 4)
    const rl = lumpy(r, rad * R(r, 0.85, 1), rad * R(r, 0.8, 1), 0.12), angs = [], a0 = r() * TAU
    for (let i = 0; i < nV; i++) angs.push(a0 + (i / nV) * TAU + R(r, -0.3, 0.3) * (TAU / nV))
    const pts = angs.map((a) => { const k = R(r, 0.86, 1.06); return [cx + Math.cos(a) * rl(a) * k, cy + Math.sin(a) * rl(a) * k] })
    const path = () => A.poly(ctx, pts), box = bbox(pts, rad * 0.5)
    castShadow(ctx, st, r, path, box, rad * 2, f, detail < 1 ? 0.1 : 0.07)
    base(ctx, st, r, path, st.tint.rock, 0.55)
    const topOn = rad >= 9
    const kx = cx - rad * R(r, 0.08, 0.22), ky = cy - rad * R(r, 0.08, 0.22), sc = topOn ? R(r, 0.5, 0.68) : 0.4
    const top = pts.map((p) => { const k = sc * R(r, 0.92, 1.08); return [kx + (p[0] - kx) * k, ky + (p[1] - ky) * k] })
    ctx.save(); path(); ctx.clip()
    const faces = []
    for (let i = 0; i < nV; i++) {
      const a = pts[i], b = pts[(i + 1) % nV], ex = b[0] - a[0], ey = b[1] - a[1], L = Math.hypot(ex, ey) || 1
      let nx = ey / L, ny = -ex / L
      if (((a[0] + b[0]) / 2 - cx) * nx + ((a[1] + b[1]) / 2 - cy) * ny < 0) { nx = -nx; ny = -ny }
      faces.push({ i, quad: [a, b, top[(i + 1) % nV], top[i]], fc: facing(Math.atan2(ny, nx)), ang: Math.atan2(ey, ex) })
    }
    faces.forEach(({ quad, fc }) => {
      const qp = () => A.poly(ctx, quad)
      if (st.mode === 'colour') { if (fc > 0) soft(ctx, qp, dark(st.tint.rock, 0.45), r, 0.55 * fc); else if (fc < -0.3) soft(ctx, qp, light(st.tint.rock, 0.5), r, 0.2) }
      if (fc > 0.1 && rad >= 4) {
        /* hand-laid lines along the face, dense at the base and thinning out toward the top face, ends left loose */
        const [a, b, tb, ta] = quad, h = Math.hypot((ta[0] + tb[0]) / 2 - (a[0] + b[0]) / 2, (ta[1] + tb[1]) / 2 - (a[1] + b[1]) / 2)
        const gap = clamp(rad * 0.09, 2.3, 6) * st.line * (1.5 - fc * 0.8)
        const at = (t, u) => [(1 - t) * (a[0] + (b[0] - a[0]) * u) + t * (ta[0] + (tb[0] - ta[0]) * u), (1 - t) * (a[1] + (b[1] - a[1]) * u) + t * (ta[1] + (tb[1] - ta[1]) * u)]
        for (let t = R(r, 0.04, 0.1); t < 0.96; t += (gap / Math.max(h, 1)) * (1 + 1.3 * t) * R(r, 0.85, 1.15)) {
          if (r() < t * (1.2 - fc)) continue
          const u0 = R(r, 0.02, 0.14), u1 = R(r, 0.86, 0.99), tt = t + R(r, -0.02, 0.02)
          ink(ctx, [at(tt, u0), at(tt + R(r, -0.02, 0.02), (u0 + u1) / 2), at(tt, u1)], r, 0.75 * f, st, 0.4, 0.3)
        }
      }
    })
    const tp = () => A.poly(ctx, top)
    if (st.mode === 'colour') { if (winter(st)) A.wash(ctx, tp, st.tint.snow, r, 0.8); else soft(ctx, tp, light(st.tint.rock, 0.6), r, 0.35) }
    if (topOn) {
      /* the top face edge, broken, and the corner edges down to the base where the faces turn */
      inkRing(ctx, st, r, top, kx, ky, 0.8 * f, 3, 1, 0.9)
      for (let i = 0; i < nV; i++) {
        const fa = faces[(i + nV - 1) % nV].fc, fb = faces[i].fc
        if ((fa > 0) !== (fb > 0) || r() < 0.5) ink(ctx, [top[i], [(top[i][0] + pts[i][0]) / 2 + R(r, -0.02, 0.02) * rad, (top[i][1] + pts[i][1]) / 2 + R(r, -0.02, 0.02) * rad], pts[i]], r, 0.85 * f, st, 0.4, 0.3)
      }
      /* a crack across the top face */
      if (rad >= 14) {
        const vi = Math.floor(r() * nV), v = top[vi], a = Math.atan2(ky - v[1], kx - v[0]) + R(r, -0.4, 0.4), cp = [v], l = rad * sc * R(r, 0.6, 1.1)
        let qx = v[0], qy = v[1], aa = a
        for (let k = 0; k < 3; k++) { aa += R(r, -0.5, 0.5); qx += Math.cos(aa) * l / 3; qy += Math.sin(aa) * l / 3; cp.push([qx, qy]) }
        taperStroke(ctx, cp, r, 0.9 * f, 0.2 * f, st.ink, 0.2)
      }
    }
    /* grit along the shaded base */
    if (rad >= 8) { ctx.fillStyle = st.ink; ctx.beginPath(); for (let i = 0; i < Math.round(rad * 0.35); i++) { const a = SH + R(r, -1.2, 1.2), rho = R(r, 0.75, 0.98), q = [cx + Math.cos(a) * rl(a) * rho, cy + Math.sin(a) * rl(a) * rho], d = R(r, 0.4, 0.8) * f; ctx.moveTo(q[0] + d, q[1]); ctx.arc(q[0], q[1], d, 0, TAU) } ctx.fill() }
    ctx.restore()
    /* outline edge by edge: straight, angular, heavier where it faces the shade, with little overruns at the corners */
    for (let i = 0; i < nV; i++) {
      const a = pts[i], b = pts[(i + 1) % nV], c = pts[(i + 2) % nV]
      const ov = [b[0] + (c[0] - b[0]) * 0.1, b[1] + (c[1] - b[1]) * 0.1]
      ink(ctx, [a, [(a[0] + b[0]) / 2 + R(r, -0.015, 0.015) * rad, (a[1] + b[1]) / 2 + R(r, -0.015, 0.015) * rad], b, ov], r, (1.1 + 0.5 * Math.max(0, faces[i].fc)) * f * R(r, 0.9, 1.1), st, 0.3, 0.3)
    }
  }
  A.register('bm-rock', {
    label: 'Boulder', category: 'bm-rocks', kind: 'recipe', view: 'top',
    draw(ctx, x, y, s, r, st) { ctx.save(); stone(ctx, st, r, x, y, (s / 2) * R(r, 0.9, 1), nib(st, s), s < 40 ? 0.5 : 1); ctx.restore() },
  })
  A.register('bm-rocks', {
    label: 'Rocks', category: 'bm-rocks', kind: 'recipe', view: 'top',
    draw(ctx, x, y, s, r, st) {
      ctx.save()
      const f = nib(st, s), Rm = s / 2, n = s < 40 ? 3 + Math.floor(r() * 3) : 4 + Math.floor(r() * 6)
      const stones = [{ x: x + Rm * R(r, -0.15, 0.15), y: y + Rm * R(r, -0.15, 0.15), rad: Rm * R(r, 0.28, 0.38) }]
      for (let k = 0; stones.length < n && k < 80; k++) {
        const a = r() * TAU, d = R(r, 0.3, 0.75) * Rm, rad = Rm * R(r, 0.1, 0.24), sx = x + Math.cos(a) * d, sy = y + Math.sin(a) * d
        if (stones.every((q) => Math.hypot(q.x - sx, q.y - sy) > (q.rad + rad) * 0.8)) stones.push({ x: sx, y: sy, rad })
      }
      A.drawSorted(stones.map((q) => ({ y: q.y, draw: () => stone(ctx, st, r, q.x, q.y, q.rad, f * 0.85, q.rad > Rm * 0.26 && s >= 60 ? 1 : 0.5) })))
      /* pebbles and grit */
      if (s >= 36) { ctx.fillStyle = st.ink; for (let i = 0; i < 3 + Math.floor(r() * 6); i++) { const a = r() * TAU, d = R(r, 0.4, 1) * Rm, pr = R(r, 0.6, 1.3) * f; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d, pr * 1.4, pr, r() * TAU, 0, TAU); ctx.fill() } }
      ctx.restore()
    },
  })

  /* ---------------------------------------------------------------- lily pads (on water) */
  A.register('bm-lilypads', {
    label: 'Lily pads', category: 'bm-water', kind: 'recipe', view: 'top',
    draw(ctx, x, y, s, r, st) {
      ctx.save()
      const f = nib(st, s), Rm = s / 2, n = s < 36 ? 2 : 2 + Math.floor(r() * 4)
      const pads = []
      for (let k = 0; pads.length < n && k < 60; k++) {
        const pr = Rm * (pads.length ? R(r, 0.18, 0.3) : R(r, 0.28, 0.36)), a = r() * TAU, d = Math.sqrt(r()) * (Rm - pr), px = x + Math.cos(a) * d, py = y + Math.sin(a) * d
        if (pads.every((q) => Math.hypot(q.x - px, q.y - py) > (q.pr + pr) * 0.8)) pads.push({ x: px, y: py, pr })
      }
      const flowerOn = s >= 40 && r() < 0.65 ? 0 : -1
      pads.forEach((p, idx) => {
        const rl = lumpy(r, p.pr, p.pr * R(r, 0.9, 1), 0.05), na = r() * TAU, nw = R(r, 0.45, 0.7)
        const apex = [p.x + Math.cos(na) * p.pr * 0.1, p.y + Math.sin(na) * p.pr * 0.1]
        const outline = arcPts(p.x, p.y, rl, na + nw / 2, na + TAU - nw / 2, 26, 1), pts = outline.concat([apex])
        const path = () => A.poly(ctx, pts)
        if (st.shadows) {
          if (st.mode === 'colour') { ctx.save(); ctx.translate(p.pr * 0.07, p.pr * 0.09); ctx.fillStyle = SHADOW; path(); ctx.fill(); ctx.restore() }
          else for (let i = 0; i < 3; i++) { const a = SH + R(r, -0.7, 0.7), rd = rl(a) * R(r, 1.08, 1.18), l = p.pr * R(r, 0.15, 0.3); ink(ctx, [[p.x + Math.cos(a) * rd - Math.sin(a) * l / 2, p.y + Math.sin(a) * rd + Math.cos(a) * l / 2], [p.x + Math.cos(a) * rd + Math.sin(a) * l / 2, p.y + Math.sin(a) * rd - Math.cos(a) * l / 2]], r, 0.7 * f, st, 0.6, 0.2) }
        }
        base(ctx, st, r, path, st.tint.forest, 0.55)
        ctx.save(); path(); ctx.clip()
        if (st.mode === 'colour') soft(ctx, () => A.poly(ctx, ring(p.x + p.pr * 0.3, p.y + p.pr * 0.3, rl, 14, 0.8)), st.tint.forestDark, r, 0.35)
        if (p.pr >= 7) {
          const nv = 5 + Math.floor(r() * 3)
          for (let i = 0; i < nv; i++) {
            const a = na + nw / 2 + 0.25 + ((i + 0.5) / nv) * (TAU - nw - 0.5), l = rl(a) * R(r, 0.7, 0.85), bend = R(r, -0.1, 0.1)
            taperStroke(ctx, [apex, [apex[0] + Math.cos(a + bend) * l * 0.5, apex[1] + Math.sin(a + bend) * l * 0.5], [apex[0] + Math.cos(a) * l, apex[1] + Math.sin(a) * l]], r, 0.8 * f, 0.2 * f, st.ink, 0.2)
          }
        }
        if (s >= 44) crescent(ctx, st, r, p.x, p.y, rl, f, { rings: 2, gap: clamp(p.pr * 0.15, 2.2, 5) * st.line, outer: 0.88, span: 0.9, w: 0.7 * f })
        ctx.restore()
        /* outline in two or three pen strokes, the notch edges a touch heavier */
        const cuts = p.pr > 10 ? 3 : 2
        for (let i = 0; i < cuts; i++) { const k0 = Math.floor((i / cuts) * outline.length), k1 = Math.min(outline.length, Math.floor(((i + 1) / cuts) * outline.length) + 2); ink(ctx, outline.slice(k0, k1), r, 1.2 * f, st, 0.4, 0.4) }
        ink(ctx, [outline[outline.length - 1], apex], r, 1.3 * f, st, 0.3, 0.3); ink(ctx, [apex, outline[0]], r, 1.3 * f, st, 0.3, 0.3)
        if (idx === flowerOn) {
          const fx = p.x + Math.cos(na + Math.PI) * p.pr * 0.2, fy = p.y + Math.sin(na + Math.PI) * p.pr * 0.2, fr = p.pr * R(r, 0.42, 0.55)
          const col = r() < 0.5 ? '#e8dccb' : '#d9aab0'
          for (let layer = 0; layer < 2; layer++) {
            const np = layer ? 5 + Math.floor(r() * 2) : 7 + Math.floor(r() * 3), rr = layer ? fr * 0.62 : fr, rot = r() * TAU, pp = []
            for (let i = 0; i < np; i++) { const a = rot + (i / np) * TAU, a2 = a + TAU / np / 2; pp.push([fx + Math.cos(a) * rr, fy + Math.sin(a) * rr]); pp.push([fx + Math.cos(a2) * rr * 0.66, fy + Math.sin(a2) * rr * 0.66]) }
            const fp = () => A.poly(ctx, pp)
            base(ctx, st, r, fp, col, 0.8)
            for (let i = 0; i < np; i++) ink(ctx, [pp[(2 * i + 2 * np - 1) % (2 * np)], pp[2 * i], pp[2 * i + 1]], r, 0.8 * f, st, 0.5, 0.25)
          }
          ctx.fillStyle = st.mode === 'colour' ? '#b89446' : st.ink; ctx.beginPath(); ctx.arc(fx, fy, fr * 0.14, 0, TAU); ctx.fill()
          ctx.fillStyle = st.ink; for (let i = 0; i < 4; i++) { const a = r() * TAU; ctx.beginPath(); ctx.arc(fx + Math.cos(a) * fr * 0.18, fy + Math.sin(a) * fr * 0.18, 0.5 * f, 0, TAU); ctx.fill() }
        }
      })
      ctx.restore()
    },
  })
})(window.Atlas)
