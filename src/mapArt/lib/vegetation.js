/* Vegetation assets for the Warded Atlas map builder: trees, woods, grass, marsh, palm, scrub, dead tree.
   Look: hand-inked pen work after Tolkien, Ellisa Mitchell (Wheel of Time), the Malazan maps and Midkemia. */
;(function (A) {
  const { R, pick } = A
  const TAU = Math.PI * 2
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
  const winter = (st) => !!(st.tint && st.tint.label === 'Winter')
  /* Pen weight. A real nib stays about the same width, so the weight only drifts a little with size. */
  const nib = (st, s) => st.line * clamp(Math.pow(s / 60, 0.4), 0.6, 1.2)
  const ellipse = (ctx, cx, cy, rx, ry) => { ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU) }

  /** Ribbon stroke whose width runs from w0 at the start to w1 at the end (trunks, blades, branches). */
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

  /** Radius function of a lumpy ellipse: rx, ry plus low-frequency bulges so nothing comes out a circle. */
  function lumpy(r, rx, ry, amp) {
    const p1 = r() * TAU, p2 = r() * TAU, p3 = r() * TAU
    const a1 = amp * R(r, 0.6, 1), a2 = amp * R(r, 0.4, 0.8), a3 = amp * R(r, 0.2, 0.5)
    return (a) => {
      const c = Math.cos(a), s = Math.sin(a)
      return (rx * ry) / Math.sqrt(ry * ry * c * c + rx * rx * s * s) * (1 + a1 * Math.sin(2 * a + p1) + a2 * Math.sin(3 * a + p2) + a3 * Math.sin(5 * a + p3))
    }
  }

  /** Scalloped closed outline around (cx, cy). radial(angle) gives the base radius; n bumps of uneven width and depth.
      Returns { segs: one point list per bump (cusp to cusp, with .mid angle), all: the whole closed polygon }. */
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

  /** Paper fill (occlusion), then in colour mode a forest wash with a darker pool lower-right, and snow on top in winter. */
  function paintCrown(ctx, st, r, all, cx, cy, rx, ry) {
    const path = () => A.poly(ctx, all)
    ctx.fillStyle = st.paper; path(); ctx.fill()
    if (st.mode !== 'colour') return
    A.wash(ctx, path, st.tint.forest, r, 0.5)
    ctx.save(); path(); ctx.clip()
    /* darker pool on the shade side, as a lumpy blob rather than a clean ellipse */
    const dk = lumpy(r, rx * 0.78, ry * 0.8, 0.22), dx = cx + rx * 0.3, dy = cy + ry * 0.28, dp = []
    for (let i = 0; i < 20; i++) { const a = (i / 20) * TAU, rd = dk(a); dp.push([dx + Math.cos(a) * rd, dy + Math.sin(a) * rd]) }
    A.wash(ctx, () => A.poly(ctx, dp), st.tint.forestDark, r, 0.4)
    if (winter(st)) A.wash(ctx, () => ellipse(ctx, cx - rx * 0.12, cy - ry * 0.62, rx * 0.8, ry * 0.48), st.tint.snow, r, 1.1)
    ctx.restore()
  }

  /** Ground shading under a side-view thing: two or three short hatch ticks to the lower right. */
  function groundShade(ctx, st, r, x, y, s) {
    if (!st.shadows || s < 14) return
    const f = nib(st, s), n = s < 30 ? 2 : 3
    for (let i = 0; i < n; i++) {
      const x0 = x + s * R(r, 0.04, 0.3), y0 = y + R(r, 0.5, 2.5) * (s / 40), len = s * R(r, 0.07, 0.16)
      A.inkStroke(ctx, [[x0, y0], [x0 + len, y0 + R(r, -0.5, 0.5)]], r, { w: 0.8 * f, wob: 0.2, taper: 0.6, color: st.ink })
    }
  }

  /** Outline a scalloped crown bump by bump, each bump its own tapered pen stroke that overruns the cusp a little. */
  function inkScallops(ctx, sh, r, w, wob = 0.45) {
    const n = sh.segs.length
    sh.segs.forEach((seg, i) => A.inkStroke(ctx, seg.concat([sh.segs[(i + 1) % n][1]]), r, { w, wob, taper: 0.5 }))
  }

  /* ---------------------------------------------------------------- deciduous tree (Tolkien) */
  A.register('tree', {
    label: 'Tree', category: 'vegetation', kind: 'recipe', view: 'side',
    draw(ctx, x, y, s, r, st) {
      ctx.save(); ctx.strokeStyle = ctx.fillStyle = st.ink
      const f = nib(st, s), small = s < 24
      const rx = s * R(r, 0.33, 0.42), ry = s * R(r, 0.3, 0.37)
      const cx = x + s * R(r, -0.03, 0.03), cy = y - s * 0.17 - ry * 0.95
      const top = cy + ry * 0.6
      groundShade(ctx, st, r, x, y, s)
      /* trunk, drawn first so the crown sits on it: two edges converging upward, a root tick either side */
      if (small) taperStroke(ctx, [[x, y], [cx, top]], r, 1.7 * f, 1.1 * f, st.ink, 0.3)
      else {
        const wb = s * 0.036, wt = s * 0.024, k = R(r, -0.06, 0.06) * s
        const lx = [[x - wb, y + 0.5], [cx - wt + k, top]], rp = [[x + wb, y + 0.5], [cx + wt + k, top]]
        ctx.fillStyle = st.paper; A.poly(ctx, lx.concat(rp.slice().reverse())); ctx.fill()
        A.inkStroke(ctx, lx, r, { w: 1.3 * f, wob: 0.4, taper: 0.25, color: st.ink })
        A.inkStroke(ctx, rp, r, { w: 1.3 * f, wob: 0.4, taper: 0.25, color: st.ink })
        taperStroke(ctx, [[x - wb, y - s * 0.02], [x - wb * 2.2, y + 0.5]], r, 1.1 * f, 0.3 * f, st.ink, 0.2)
        taperStroke(ctx, [[x + wb, y - s * 0.02], [x + wb * 2.1, y + 0.5]], r, 1.1 * f, 0.3 * f, st.ink, 0.2)
      }
      /* crown */
      const n = small ? 5 + Math.floor(r() * 2) : 6 + Math.floor(r() * 4)
      const sh = scallops(r, cx, cy, lumpy(r, rx, ry, 0.06), n, { depth: [0.1, 0.22], ptsPer: small ? 4 : 6, jit: 0.25 * f })
      paintCrown(ctx, st, r, sh.all, cx, cy, rx, ry)
      ctx.fillStyle = st.ink
      inkScallops(ctx, sh, r, 1.35 * f)
      ctx.save(); A.poly(ctx, sh.all); ctx.clip()
      const style = small ? 0 : r()
      if (style < 0.45) {
        /* one inner foliage lobe on the lit side: the upper arc of a smaller scalloped mass */
        const icx = cx + rx * R(r, -0.45, -0.1), icy = cy + ry * R(r, 0, 0.35), ir = Math.min(rx, ry) * R(r, 0.42, 0.55)
        const ish = scallops(r, icx, icy, lumpy(r, ir, ir * 0.9, 0.08), 5, { depth: [0.12, 0.22], ptsPer: 5 })
        ish.segs.forEach((seg) => { if (Math.sin(seg.mid) < -0.2) A.inkStroke(ctx, seg, r, { w: 0.9 * f, wob: 0.4, taper: 0.6, color: st.ink }) })
      }
      /* shade side: a few parallel near-vertical strokes staggered across the right half, shorter toward the edge */
      const gap = clamp(s * 0.095, 2.6, 7), k = small ? 2 : clamp(Math.round((rx * 0.75) / gap), 3, 5)
      const th = 1.32 + R(r, -0.1, 0.1), ux = Math.cos(th), uy = Math.sin(th)
      for (let i = 0; i < k; i++) {
        const u = k === 1 ? 0.5 : i / (k - 1), mx = cx + rx * (0.18 + 0.66 * u) + R(r, -0.5, 0.5) * f
        const hl = ry * (0.6 - 0.28 * u) * R(r, 0.8, 1.05), my = cy + ry * (0.08 + 0.12 * u) + R(r, -0.15, 0.15) * ry
        A.inkStroke(ctx, [[mx - ux * hl, my - uy * hl], [mx + ux * hl, my + uy * hl]], r, { w: 0.8 * f, wob: 0.3, taper: 0.6, color: st.ink })
      }
      /* sometimes a little curl tucked low on the shade side instead of the lobe */
      if (style > 0.7) {
        const ccx = cx + rx * R(r, 0.1, 0.4), ccy = cy + ry * R(r, 0.3, 0.55), cr = s * R(r, 0.04, 0.06), a0 = R(r, 2.5, 4), pts = []
        for (let j = 0; j <= 6; j++) { const a = a0 + (j / 6) * 3.6; pts.push([ccx + Math.cos(a) * cr * (1 - j * 0.07), ccy + Math.sin(a) * cr * (1 - j * 0.07)]) }
        A.inkStroke(ctx, pts, r, { w: 0.85 * f, wob: 0.2, taper: 0.6, color: st.ink })
      }
      ctx.restore()
      ctx.restore()
    },
  })

  /* ---------------------------------------------------------------- conifer (Midkemia) */
  function pineShape(r, x, y, h, halfW, lean, nJ) {
    const top = y - h, ty = y - h * R(r, 0.1, 0.16), cxAt = (yy) => x + lean * (y - yy)
    const L = [[cxAt(top), top]], Rt = [[cxAt(top), top]], step = (ty - top) / nJ, phR = r() < 0.5 ? 0 : 1
    for (let i = 1; i <= nJ; i++) {
      const t = i / nJ, yy = top + (ty - top) * t, env = halfW * Math.pow(t, 0.7)
      const outL = i % 2 ? 1 : R(r, 0.66, 0.86), outR = (i + phR) % 2 ? 1 : R(r, 0.66, 0.86)
      L.push([cxAt(yy) - env * (outL + R(r, -0.12, 0.12)), yy + R(r, -0.3, 0.3) * step])
      Rt.push([cxAt(yy) + env * (outR + R(r, -0.12, 0.12)), yy + R(r, -0.3, 0.3) * step])
    }
    const bx = cxAt(ty)
    const body = L.concat([[bx - halfW * 0.4, ty + h * 0.02], [bx, ty + h * 0.04], [bx + halfW * 0.4, ty + h * 0.02]], Rt.reverse())
    return { body, ty, L, step }
  }
  A.register('pine', {
    label: 'Pine', category: 'vegetation', kind: 'recipe', view: 'side',
    draw(ctx, x, y, s, r, st) {
      ctx.save()
      const f = nib(st, s), h = s * R(r, 0.8, 1.1), lean = R(r, -0.1, 0.1), halfW = h * R(r, 0.17, 0.25)
      const nJ = clamp(Math.round(h / 3.8), 8, 26)
      const { body, ty, L, step } = pineShape(r, x, y, h, halfW, lean, nJ)
      groundShade(ctx, st, r, x, y, s)
      const tw = Math.max(0.8, h * 0.035) * st.line
      taperStroke(ctx, [[x + lean * (y - ty), ty], [x, y]], r, tw * 0.8, tw, st.ink, 0.2)
      A.poly(ctx, body); ctx.fillStyle = st.paper; ctx.fill(); ctx.fillStyle = st.ink; ctx.fill()
      if (st.mode === 'colour') {
        ctx.save(); ctx.globalAlpha = 0.45; ctx.fillStyle = st.tint.forestDark; A.poly(ctx, body); ctx.fill(); ctx.restore()
        if (winter(st)) {
          /* snow lying on the upper side of the branch tips: small white wedges, mostly on the lit left side */
          ctx.fillStyle = st.tint.snow
          for (let i = 3; i < L.length; i += 2) {
            if (r() < 0.35) continue
            const p = L[i], len = Math.max(2, Math.hypot(L[i][0] - L[i - 1][0], step) * 0.9), th = clamp(step * 0.55, 1.2, 3.2)
            ctx.beginPath(); ctx.moveTo(p[0] - 0.4, p[1] + 0.3); ctx.lineTo(p[0] + len, p[1] - step * 0.55); ctx.lineTo(p[0] + len * 0.75, p[1] - step * 0.55 + th); ctx.closePath(); ctx.fill()
          }
          const ap = body[0]
          ctx.beginPath(); ctx.moveTo(ap[0], ap[1] + 0.5); ctx.lineTo(ap[0] - step * 0.4, ap[1] + step * 1.3); ctx.lineTo(ap[0] + step * 0.45, ap[1] + step * 1.3); ctx.closePath(); ctx.fill()
        }
      }
      ctx.restore()
    },
  })

  /* ---------------------------------------------------------------- tiny tree for massing (Mirkwood, Fangorn) */
  A.register('tree-tiny', {
    label: 'Tree (tiny)', category: 'vegetation', kind: 'recipe', view: 'side',
    draw(ctx, x, y, s, r, st) {
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      const f = nib(st, s), lw = clamp(s * 0.065, 0.9, 1.5) * st.line
      const rad = s * R(r, 0.3, 0.37), cy = y - s * 0.6, cx = x + s * R(r, -0.04, 0.04)
      const n = s < 14 ? 4 : s < 30 ? 5 : 6
      const sh = scallops(r, cx, cy, lumpy(r, rad * R(r, 0.88, 1.02), rad * R(r, 1, 1.12), 0.05), n, { depth: [0.12, 0.24], ptsPer: s < 20 ? 3 : 5 })
      ctx.strokeStyle = st.ink; ctx.lineWidth = lw * 1.15
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(cx + R(r, -1, 1) * s * 0.02, cy + rad * 0.7); ctx.stroke()
      paintCrown(ctx, st, r, sh.all, cx, cy, rad, rad)
      ctx.fillStyle = st.ink
      if (s >= 20) inkScallops(ctx, sh, r, 1.3 * f, 0.35)
      else { ctx.lineWidth = lw; A.poly(ctx, sh.all); ctx.stroke() }
      /* one or two marks on the shade side */
      const k = s < 12 ? 1 : 2
      ctx.lineWidth = lw * 0.8
      for (let i = 0; i < k; i++) {
        const ax = cx + rad * R(r, 0.05, 0.4), ay = cy + rad * R(r, -0.15, 0.15), len = rad * R(r, 0.4, 0.65), ang = R(r, 1.0, 1.45)
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + Math.cos(ang) * len, ay + Math.sin(ang) * len); ctx.stroke()
      }
      if (s >= 24) groundShade(ctx, st, r, x, y, s)
      ctx.restore()
    },
  })

  /* ---------------------------------------------------------------- cloud-like wood (Wheel of Time) */
  A.register('forest-clump', {
    label: 'Forest clump', category: 'vegetation', kind: 'recipe', view: 'top',
    draw(ctx, x, y, s, r, st) {
      ctx.save()
      const f = nib(st, s)
      const rx = s * 0.5 * R(r, 0.9, 1), ry = s * R(r, 0.27, 0.4)
      const radial = lumpy(r, rx, ry, 0.16)
      const n = clamp(Math.round(s / 5.5), 7, 20)
      const sh = scallops(r, x, y, radial, n, { depth: [0.06, 0.2], ptsPer: 7, widthJit: 0.65, jit: 0.2 * f })
      paintCrown(ctx, st, r, sh.all, x, y, rx, ry)
      ctx.fillStyle = st.ink
      sh.segs.forEach((seg, i) => {
        const nxt = sh.segs[(i + 1) % n], pts = seg.concat([nxt[1]])
        if (r() < 0.15 && pts.length > 6) {
          /* pen lift: the bump drawn as two strokes with a hair of a gap */
          const c = Math.floor(pts.length / 2)
          A.inkStroke(ctx, pts.slice(0, c), r, { w: 1.2 * f, wob: 0.45, taper: 0.5, color: st.ink })
          A.inkStroke(ctx, pts.slice(c + 1), r, { w: 1.2 * f, wob: 0.45, taper: 0.5, color: st.ink })
        } else A.inkStroke(ctx, pts, r, { w: R(r, 1.1, 1.45) * f, wob: 0.45, taper: 0.5, color: st.ink })
      })
      ctx.save(); A.poly(ctx, sh.all); ctx.clip()
      /* inner bumps: upper arcs of smaller lobes, as if the canopy overlapped */
      const ni = s < 24 ? 1 : 1 + Math.floor(r() * 3), x0 = R(r, -0.6, -0.3)
      for (let i = 0; i < ni; i++) {
        /* spread the lobes left to right so they do not pile up into a scribble */
        const icx = x + rx * (x0 + (i + 0.5) * (0.9 / ni) + R(r, -0.08, 0.08)), icy = y + ry * R(r, -0.3, 0.45), ir = Math.min(rx, ry) * R(r, 0.3, 0.55)
        const ish = scallops(r, icx, icy, lumpy(r, ir * R(r, 0.9, 1.3), ir, 0.08), 6, { depth: [0.1, 0.2], ptsPer: 5 })
        ish.segs.forEach((seg) => { if (Math.sin(seg.mid) < -0.15) A.inkStroke(ctx, seg, r, { w: 0.9 * f, wob: 0.4, taper: 0.6, color: st.ink }) })
      }
      /* shade: stipple and short ticks along the lower and right edges */
      const ns = clamp(Math.round(s * 1.1), 14, 80)
      ctx.beginPath()
      const ticks = []
      for (let i = 0; i < ns; i++) {
        const a = R(r, -0.7, 2.3), rho = 1 - 0.3 * Math.pow(r(), 1.6), rad = radial(a) * 0.88 * rho
        const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad
        if (r() < 0.75) { const d = R(r, 0.5, 1.0) * f; ctx.moveTo(px + d, py); ctx.arc(px, py, d, 0, TAU) }
        else ticks.push([px, py])
      }
      ctx.fill()
      ticks.forEach(([px, py]) => { const l = R(r, 1.2, 2.6) * f, an = R(r, 0.9, 1.6); A.inkStroke(ctx, [[px, py], [px + Math.cos(an) * l, py + Math.sin(an) * l]], r, { w: 0.8 * f, wob: 0.2, taper: 0.5, color: st.ink }) })
      ctx.restore()
      /* a few dots spilling just outside the lower edge */
      ctx.beginPath()
      const no = s < 24 ? 2 : 5
      for (let i = 0; i < no; i++) { const a = R(r, 0.4, 1.9), rad = radial(a) * R(r, 1.04, 1.14), px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad, d = R(r, 0.4, 0.8) * f; ctx.moveTo(px + d, py); ctx.arc(px, py, d, 0, TAU) }
      ctx.fill()
      ctx.restore()
    },
  })

  /* ---------------------------------------------------------------- stippled woodland (Genabackis) */
  A.register('wood-stipple', {
    label: 'Woodland (stipple)', category: 'vegetation', kind: 'recipe', view: 'top',
    draw(ctx, x, y, s, r, st) {
      ctx.save()
      const f = nib(st, s)
      const rx = s * 0.5 * R(r, 0.85, 1), ry = s * R(r, 0.3, 0.46)
      const radial = lumpy(r, rx, ry, 0.26)
      const m = 36, pts = []
      for (let i = 0; i < m; i++) { const a = (i / m) * TAU, rd = radial(a); pts.push([x + Math.cos(a) * rd, y + Math.sin(a) * rd]) }
      const path = () => A.poly(ctx, pts)
      ctx.fillStyle = st.paper; path(); ctx.fill()
      if (st.mode === 'colour') A.wash(ctx, path, st.tint.forestDark, r, 0.6)
      /* dots: dense inside, thinning at the edge, a sparse fringe just outside */
      const area = Math.PI * rx * ry, n = clamp(Math.round(area * 0.26), 60, 900)
      const bx = rx * 1.3, by = ry * 1.3
      ctx.fillStyle = st.ink; ctx.beginPath()
      for (let i = 0, got = 0; got < n && i < n * 4; i++) {
        const px = R(r, -bx, bx), py = R(r, -by, by), a = Math.atan2(py, px), rho = Math.hypot(px, py) / radial(a)
        if (rho > 1.14) continue
        const p = rho < 0.8 ? 1 : rho <= 1 ? 1 - (rho - 0.8) * 3.2 : 0.12
        if (r() > p) continue
        got++
        const d = R(r, 0.45, 1.15) * f * (rho > 1 ? 0.7 : 1)
        ctx.moveTo(x + px + d, y + py); ctx.arc(x + px, y + py, d, 0, TAU)
      }
      ctx.fill()
      /* tiny marks and a few heavier blotches so the tone is uneven */
      const nm = Math.round(n / 10)
      ctx.strokeStyle = st.ink; ctx.lineWidth = 0.8 * f; ctx.lineCap = 'round'
      ctx.beginPath()
      const blots = []
      for (let i = 0; i < nm; i++) {
        const a = r() * TAU, rho = Math.sqrt(r()) * 0.9, rd = radial(a) * rho, px = x + Math.cos(a) * rd, py = y + Math.sin(a) * rd
        if (r() < 0.6) { const l = R(r, 1.5, 3) * f, an = r() * TAU; ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(an) * l, py + Math.sin(an) * l) }
        else blots.push([px, py])
      }
      ctx.stroke()
      ctx.beginPath()
      blots.forEach(([px, py]) => { const d = R(r, 1.1, 1.9) * f; ctx.moveTo(px + d, py); ctx.arc(px, py, d, 0, TAU) })
      ctx.fill()
      ctx.restore()
    },
  })

  /* ---------------------------------------------------------------- plains grass (Wheel of Time) */
  A.register('grass', {
    label: 'Grass', category: 'vegetation', kind: 'recipe', view: 'side',
    draw(ctx, x, y, s, r, st) {
      ctx.save()
      const f = nib(st, s), nc = s < 24 ? 1 : 1 + Math.floor(r() * 3)
      for (let c = 0; c < nc; c++) {
        const bx = nc === 1 ? x : x + s * R(r, -0.45, 0.45), by = nc === 1 ? y : y + s * R(r, -0.12, 0.05)
        const k = 3 + Math.floor(r() * 3), hgt = s * R(r, 0.16, 0.26)
        if (st.mode === 'colour') A.wash(ctx, () => ellipse(ctx, bx, by - hgt * 0.3, hgt * 0.9, hgt * 0.45), st.tint.grass, r, 0.35)
        for (let j = 0; j < k; j++) {
          const t = j / (k - 1) - 0.5, ang = t * 1.3 + R(r, -0.15, 0.15)
          const len = hgt * (1 - 0.5 * Math.abs(t)) * R(r, 0.8, 1.1), sx = bx + t * hgt * 0.5 + R(r, -0.5, 0.5), sy = by + R(r, -0.5, 0.5)
          const ex = sx + Math.sin(ang) * len, ey = sy - Math.cos(ang) * len, sg = t < 0 ? -1 : 1
          const mx = (sx + ex) / 2 + Math.cos(ang) * len * 0.12 * sg, my = (sy + ey) / 2 + Math.sin(ang) * len * 0.12 * sg
          taperStroke(ctx, [[sx, sy], [mx, my], [ex, ey]], r, 1.4 * f, 0.3 * f, st.ink, 0.15)
        }
        if (r() < 0.5) { ctx.fillStyle = st.ink; ctx.beginPath(); ctx.arc(bx + hgt * R(r, -1.2, 1.2), by + R(r, -1, 1), 0.6 * f, 0, TAU); ctx.fill() }
      }
      ctx.restore()
    },
  })

  /* ---------------------------------------------------------------- marsh (Genabackis, Wheel of Time) */
  A.register('marsh', {
    label: 'Marsh', category: 'vegetation', kind: 'recipe', view: 'side',
    draw(ctx, x, y, s, r, st) {
      ctx.save()
      const f = nib(st, s), W = s * R(r, 0.9, 1.2), rows = s < 20 ? 2 : 2 + Math.floor(r() * 2), rowGap = s * 0.12
      const dashes = []
      for (let i = 0; i < rows; i++) {
        const dy = y - i * rowGap - R(r, 0, 2), nd = 2 + Math.floor(r() * 2)
        let px = x - W / 2 + R(r, 0, W * 0.25)
        for (let j = 0; j < nd && px < x + W / 2; j++) { const len = s * R(r, 0.12, 0.3); dashes.push([px, dy, len]); px += len + s * R(r, 0.08, 0.2) }
      }
      if (st.mode === 'colour') dashes.forEach(([dx, dy, len]) => A.wash(ctx, () => ellipse(ctx, dx + len / 2, dy, len * 0.75, Math.max(1.5, s * 0.04)), st.tint.water, r, 0.35))
      dashes.forEach(([dx, dy, len]) => A.inkStroke(ctx, [[dx, dy], [dx + len, dy + R(r, -0.4, 0.4)]], r, { w: 1.3 * f, wob: 0.25, taper: 0.5, color: st.ink }))
      /* reed tufts standing on some of the dashes */
      const nt = s < 20 ? 1 : 2 + (r() < 0.4 ? 1 : 0)
      for (let i = 0; i < nt; i++) {
        const d = pick(r, dashes), bx = d[0] + d[2] * R(r, 0.2, 0.8), by = d[1], k = 2 + Math.floor(r() * 3), hgt = s * R(r, 0.16, 0.3)
        for (let j = 0; j < k; j++) {
          const t = k === 1 ? 0 : j / (k - 1) - 0.5, ang = t * 0.7 + R(r, -0.1, 0.1), len = hgt * R(r, 0.7, 1.05)
          const sx = bx + t * s * 0.05, ex = sx + Math.sin(ang) * len, ey = by - Math.cos(ang) * len
          taperStroke(ctx, [[sx, by], [ex, ey]], r, 1.2 * f, 0.35 * f, st.ink, 0.3)
          if (s >= 20 && j === Math.floor(k / 2) && r() < 0.5) {
            ctx.fillStyle = st.ink; ctx.beginPath(); ctx.ellipse(ex + Math.sin(ang) * len * 0.08, ey - Math.cos(ang) * len * 0.08, 0.8 * f, 2 * f * (s / 60 + 0.4), ang, 0, TAU); ctx.fill()
          }
        }
      }
      ctx.restore()
    },
  })

  /* ---------------------------------------------------------------- palm */
  A.register('palm', {
    label: 'Palm', category: 'vegetation', kind: 'recipe', view: 'side',
    draw(ctx, x, y, s, r, st) {
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      const f = nib(st, s), h = s * R(r, 0.7, 0.86), lean = s * R(r, -0.22, 0.22)
      const tx = x + lean, ty = y - h, qx = x + lean * 0.2, qy = y - h * 0.55
      const trunk = []
      for (let i = 0; i <= 6; i++) { const t = i / 6, u = 1 - t; trunk.push([u * u * x + 2 * u * t * qx + t * t * tx, u * u * y + 2 * u * t * qy + t * t * ty]) }
      groundShade(ctx, st, r, x, y, s)
      const wb = Math.max(1.2, s * 0.035), wt = Math.max(0.9, s * 0.022), L = [], Rr = []
      for (let i = 0; i <= 6; i++) {
        const a = trunk[Math.max(0, i - 1)], b = trunk[Math.min(6, i + 1)], d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
        const nx = -(b[1] - a[1]) / d, ny = (b[0] - a[0]) / d, hw = wb + (wt - wb) * (i / 6)
        L.push([trunk[i][0] + nx * hw, trunk[i][1] + ny * hw]); Rr.push([trunk[i][0] - nx * hw, trunk[i][1] - ny * hw])
      }
      ctx.fillStyle = st.paper; A.poly(ctx, L.concat(Rr.slice().reverse())); ctx.fill()
      A.inkStroke(ctx, L, r, { w: 1.2 * f, wob: 0.3, taper: 0.2, color: st.ink })
      A.inkStroke(ctx, Rr, r, { w: 1.2 * f, wob: 0.3, taper: 0.2, color: st.ink })
      if (s >= 24) for (let i = 1; i < 6; i++) if (r() < 0.6) {
        const p = trunk[i], q = Rr[i]
        A.inkStroke(ctx, [[(p[0] + L[i][0]) / 2, (p[1] + L[i][1]) / 2], [q[0], q[1]]], r, { w: 0.8 * f, wob: 0.2, taper: 0.4, color: st.ink })
      }
      /* fronds: spines from the top that rise a little, arch out and droop; one or two dead ones hang down */
      const nf = s < 24 ? 5 : 5 + Math.floor(r() * 3), fl = s * R(r, 0.36, 0.5), fronds = []
      const addFrond = (a, len, droop) => {
        const dx = Math.cos(a), dy = Math.sin(a)
        const c = [tx + dx * len * 0.55, ty + dy * len * 0.55 - len * 0.18], e = [tx + dx * len * 0.9, ty + dy * len * 0.35 + droop]
        const pts = []
        for (let k = 0; k <= 5; k++) { const t = k / 5, u = 1 - t; pts.push([u * u * tx + 2 * u * t * c[0] + t * t * e[0], u * u * ty + 2 * u * t * c[1] + t * t * e[1]]) }
        fronds.push({ pts, a, len, right: dx > 0 })
      }
      for (let i = 0; i < nf; i++) {
        const a = -Math.PI + 0.1 + ((i + 0.5) / nf) * (Math.PI - 0.2) + R(r, -0.1, 0.1), len = fl * R(r, 0.8, 1.1)
        addFrond(a, len, len * (0.3 + 0.45 * Math.abs(Math.cos(a))))
      }
      if (s >= 24 && r() < 0.6) addFrond(r() < 0.5 ? -0.2 : -Math.PI + 0.2, fl * 0.7, fl * 0.75)
      /* occlusion and wash: a thick paper (then tint) ribbon under each frond */
      const leaf = s >= 26
      const ribbon = (color, alpha, w) => { ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = w; fronds.forEach((fr) => { ctx.beginPath(); fr.pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.stroke() }); ctx.restore() }
      ribbon(st.paper, 1, leaf ? s * 0.12 : s * 0.07)
      if (st.mode === 'colour') {
        ribbon(st.tint.forest, 0.35, leaf ? s * 0.1 : s * 0.07)
        ctx.save(); ctx.globalAlpha = 0.25; ctx.strokeStyle = st.tint.forestDark; ctx.lineWidth = s * 0.07
        fronds.forEach((fr) => { if (fr.right) { ctx.beginPath(); fr.pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.stroke() } }); ctx.restore()
      }
      fronds.forEach((fr) => {
        if (!leaf) { taperStroke(ctx, fr.pts, r, 2.4 * f, 0.5 * f, st.ink, 0.3); return }
        A.inkStroke(ctx, fr.pts, r, { w: 1.4 * f, wob: 0.3, taper: 0.45, color: st.ink })
        /* leaflets hang below the spine, angled back toward the trunk, longest mid-frond; a few short ones stand above */
        const step = clamp(s * 0.04, 2, 3.6), ll = s * R(r, 0.08, 0.11)
        for (let d = fr.len * 0.22; d < fr.len * 1.05; d += step * R(r, 0.8, 1.2)) {
          const t = clamp(d / (fr.len * 1.05), 0, 1), i = Math.min(4, Math.floor(t * 5)), u = t * 5 - i
          const p = fr.pts[i], q = fr.pts[i + 1], px = p[0] + (q[0] - p[0]) * u, py = p[1] + (q[1] - p[1]) * u
          const dd = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1, ux = (q[0] - p[0]) / dd, uy = (q[1] - p[1]) / dd
          const lx = -ux * 0.5, ly = -uy * 0.5 + 0.9, nl = Math.hypot(lx, ly)
          const l = ll * (0.5 + 0.5 * Math.sin(Math.PI * Math.min(1, t * 1.15)))
          taperStroke(ctx, [[px, py], [px + (lx / nl) * l, py + (ly / nl) * l]], r, 1.0 * f, 0.25 * f, st.ink, 0.1)
          if (r() < 0.3) { const hx = -ux * 0.4, hy = -uy * 0.4 - 0.9, hn = Math.hypot(hx, hy), l2 = l * 0.4; taperStroke(ctx, [[px, py], [px + (hx / hn) * l2, py + (hy / hn) * l2]], r, 0.8 * f, 0.25 * f, st.ink, 0.1) }
        }
      })
      /* coconuts */
      if (s >= 20) { ctx.fillStyle = st.ink; const nn = 2 + Math.floor(r() * 2); for (let i = 0; i < nn; i++) { ctx.beginPath(); ctx.arc(tx + R(r, -1, 1) * s * 0.04, ty + s * R(r, 0.02, 0.06), s * 0.022, 0, TAU); ctx.fill() } }
      ctx.restore()
    },
  })

  /* ---------------------------------------------------------------- desert scrub: saguaro, yucca or a dry bush */
  A.register('scrub', {
    label: 'Scrub', category: 'vegetation', kind: 'recipe', view: 'side',
    draw(ctx, x, y, s, r, st) {
      ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      const f = nib(st, s), kind = r()
      groundShade(ctx, st, r, x, y, s)
      if (kind < 0.36) {
        /* saguaro: outlined union of a trunk and one or two arms, drawn as thick ink strokes with paper laid back inside */
        const h = s * R(r, 0.8, 1), w = Math.max(3, s * 0.15), lean = s * R(r, -0.06, 0.06)
        const arms = []
        const na = s < 18 ? 1 : 1 + (r() < 0.6 ? 1 : 0)
        for (let i = 0; i < na; i++) {
          const side = i === 0 ? (r() < 0.5 ? -1 : 1) : (arms[0].side * -1), ya = y - h * R(r, 0.35, 0.6), out = w / 2 + s * R(r, 0.08, 0.14), up = s * R(r, 0.18, 0.34)
          const ax = x + lean * ((y - ya) / h)
          arms.push({ side, pts: A.wobble([[ax, ya], [ax + side * out, ya + s * 0.02], [ax + side * out, ya - up]], r, 0.4, 5) })
        }
        const body = A.wobble([[x, y + 1], [x + lean, y - h + w / 2]], r, 0.5, 5)
        const strokeAll = (color, width) => {
          ctx.strokeStyle = color; ctx.lineWidth = width
          ctx.beginPath(); body.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.stroke()
          arms.forEach((ar) => { ctx.beginPath(); ar.pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.lineWidth = width * 0.72; ctx.stroke() })
        }
        strokeAll(st.ink, w + 1.7 * f)
        strokeAll(st.paper, w)
        if (st.mode === 'colour') { ctx.save(); ctx.globalAlpha = 0.3; strokeAll(st.tint.forest, w); ctx.restore() }
        /* ribs, spaced across the body and crowding toward the shade side, one on each arm, spines on the right edge */
        ctx.strokeStyle = st.ink
        const ribs = s < 20 ? 1 : 3
        for (let i = 0; i < ribs; i++) {
          const off = ribs === 1 ? w * 0.15 : -w * 0.24 + i * w * 0.26
          A.inkStroke(ctx, [[x + off, y - 1], [x + lean + off, y - h + w * 0.5]], r, { w: 0.65 * f, wob: 0.3, taper: 0.3, color: st.ink })
        }
        if (s >= 28) arms.forEach((ar) => { const p = ar.pts[ar.pts.length - 1], q = ar.pts[Math.max(0, ar.pts.length - 3)]; A.inkStroke(ctx, [[q[0] + ar.side * w * 0.05, q[1]], [p[0] + ar.side * w * 0.05, p[1] + w * 0.3]], r, { w: 0.6 * f, wob: 0.3, taper: 0.3, color: st.ink }) })
        if (s >= 28) for (let yy = y - w; yy > y - h + w; yy -= s * 0.09) {
          const ex = x + lean * ((y - yy) / h) + w / 2
          A.inkStroke(ctx, [[ex - 0.5, yy], [ex + 1.6 * f, yy - 1.2 * f]], r, { w: 0.7 * f, wob: 0.1, taper: 0.5, color: st.ink })
        }
      } else if (kind < 0.68) {
        /* yucca: stiff blades radiating from the ground, sometimes with a flower stalk */
        const nb = s < 20 ? 6 : 8 + Math.floor(r() * 4), hgt = s * R(r, 0.35, 0.5)
        if (st.mode === 'colour') A.wash(ctx, () => ellipse(ctx, x, y - hgt * 0.3, hgt * 0.8, hgt * 0.45), st.tint.forest, r, 0.3)
        for (let i = 0; i < nb; i++) {
          const t = i / (nb - 1) - 0.5, ang = t * 2.4 + R(r, -0.12, 0.12), len = hgt * (1 - 0.45 * Math.abs(t) * 2) * R(r, 0.8, 1.15)
          const sx = x + t * s * 0.06, ex = sx + Math.sin(ang) * len, ey = y - Math.cos(ang) * len, sg = t < 0 ? -1 : 1
          const mx = (sx + ex) / 2 + Math.cos(ang) * len * 0.08 * sg, my = (y + ey) / 2 + Math.sin(ang) * len * 0.08 * sg
          taperStroke(ctx, [[sx, y], [mx, my], [ex, ey]], r, 1.6 * f, 0.3 * f, st.ink, 0.15)
        }
        if (s >= 24 && r() < 0.5) {
          const top = y - hgt * R(r, 1.5, 1.9), sx = x + R(r, -1, 1)
          taperStroke(ctx, [[sx, y - hgt * 0.5], [sx + R(r, -2, 2), top]], r, 1.1 * f, 0.6 * f, st.ink, 0.3)
          ctx.fillStyle = st.ink
          for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(sx + R(r, -1.5, 1.5) * f, top + k * 1.8 * f, 0.7 * f, 0, TAU); ctx.fill() }
        }
      } else {
        /* dry bush: a low scalloped mound with scribble inside and a few twigs poking out */
        const rx = s * R(r, 0.3, 0.42), ry = s * R(r, 0.2, 0.28), cy = y - ry * 0.75
        const sh = scallops(r, x, cy, lumpy(r, rx, ry, 0.1), 6 + Math.floor(r() * 3), { depth: [0.12, 0.26], ptsPer: 5, jit: 0.3 * f })
        ctx.save(); ctx.beginPath(); ctx.rect(x - rx * 1.6, y - s, rx * 3.2, s + 0.5); ctx.clip()
        if (s >= 22) for (let i = 0; i < 3; i++) {
          const a = R(r, -2.6, -0.5), l = s * R(r, 0.08, 0.16), px = x + Math.cos(a) * rx * 0.6, py = cy + Math.sin(a) * ry * 0.6
          A.inkStroke(ctx, [[px, py], [px + Math.cos(a) * l * 2, py + Math.sin(a) * l * 2]], r, { w: 0.9 * f, wob: 0.3, taper: 0.4, color: st.ink })
        }
        paintCrown(ctx, st, r, sh.all, x, cy, rx, ry)
        ctx.fillStyle = st.ink
        inkScallops(ctx, sh, r, 1.2 * f)
        ctx.save(); A.poly(ctx, sh.all); ctx.clip()
        const nsq = s < 22 ? 2 : 5
        for (let i = 0; i < nsq; i++) {
          const px = x + rx * R(r, -0.3, 0.6), py = cy + ry * R(r, -0.4, 0.5), l = s * R(r, 0.08, 0.16), a = R(r, 0.7, 1.6)
          A.inkStroke(ctx, [[px, py], [px + Math.cos(a) * l * 0.5, py + Math.sin(a) * l * 0.5 + R(r, -1, 1)], [px + Math.cos(a) * l, py + Math.sin(a) * l]], r, { w: 0.8 * f, wob: 0.5, taper: 0.5, color: st.ink })
        }
        ctx.restore(); ctx.restore()
      }
      ctx.restore()
    },
  })

  /* ---------------------------------------------------------------- dead tree for blighted land */
  A.register('dead-tree', {
    label: 'Dead tree', category: 'vegetation', kind: 'recipe', view: 'side',
    draw(ctx, x, y, s, r, st) {
      ctx.save()
      const f = nib(st, s), h = s * R(r, 0.85, 1.05), maxDepth = s < 24 ? 2 : s < 45 ? 3 : 4
      groundShade(ctx, st, r, x, y, s)
      const branch = (x0, y0, ang, len, w, depth) => {
        const pts = [[x0, y0]]; let px = x0, py = y0, a = ang
        const nsg = depth === maxDepth ? 3 : 2
        for (let i = 0; i < nsg; i++) { a += R(r, -0.45, 0.45) * (i ? 1 : 0.5); const l = len / nsg; px += Math.cos(a) * l; py += Math.sin(a) * l; pts.push([px, py]) }
        const wEnd = depth === 0 ? 0.25 * f : w * 0.55
        taperStroke(ctx, pts, r, w, wEnd, st.ink, 0.3)
        if (depth === 0) return
        const nk = depth === maxDepth ? 2 + (r() < 0.6 ? 1 : 0) : 1 + (r() < 0.7 ? 1 : 0)
        for (let k = 0; k < nk; k++) {
          const side = k % 2 ? 1 : -1, na = a + side * R(r, 0.35, 0.95) + R(r, -0.2, 0.2)
          const t = k === 0 ? 1 : R(r, 0.45, 1), sp = pts[pts.length - 1], sq = pts[pts.length - 2]
          branch(sq[0] + (sp[0] - sq[0]) * t, sq[1] + (sp[1] - sq[1]) * t, na, len * R(r, 0.55, 0.75), w * 0.55, depth - 1)
        }
        if (depth >= 2 && r() < 0.45) {
          const sp = pts[1], sa = a + (r() < 0.5 ? 1 : -1) * R(r, 1, 1.6)
          taperStroke(ctx, [sp, [sp[0] + Math.cos(sa) * len * 0.22, sp[1] + Math.sin(sa) * len * 0.22]], r, w * 0.5, 0.3 * f, st.ink, 0.2)
        }
      }
      const tw = Math.max(1.5, s * 0.075) * st.line
      branch(x, y, -Math.PI / 2 + R(r, -0.25, 0.25), h * 0.45, tw, maxDepth)
      /* root flares */
      taperStroke(ctx, [[x - tw * 0.3, y - s * 0.05], [x - s * 0.1, y + 0.5]], r, tw * 0.6, 0.3 * f, st.ink, 0.2)
      taperStroke(ctx, [[x + tw * 0.3, y - s * 0.05], [x + s * 0.09, y + 0.5]], r, tw * 0.6, 0.3 * f, st.ink, 0.2)
      ctx.restore()
    },
  })
})(window.Atlas)
