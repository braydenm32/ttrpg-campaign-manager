/* Mountains, hills and volcanoes for the Warded Atlas asset library (side view, world maps).
   Assets: mountain (Tolkien), mountain-soft (Midkemia), mountain-small (Genabackis), hill, downs, volcano (fixed). */
;(function () {
  const A = window.Atlas, R = A.R, PI = Math.PI

  /* Line weight follows st.line and grows gently with size, so s=16 is not drowned and s=90 is not spidery. */
  const lwFor = (s, st) => st.line * (0.7 + 0.3 * Math.min(s, 96) / 60)
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
  const biome = (st) => (st.tint && st.tint.label) || 'Temperate'
  /* How far down from the apex the snow reaches, as a fraction of height (colour mode only). */
  const snowFrac = (st) => { const b = biome(st); return b === 'Winter' ? 0.5 : b === 'Desert' ? 0.08 : b === 'Tropical' ? 0.14 : 0.26 }

  /* Brush stroke: a filled ribbon. Width profile runs from `start`×w, up to w at `peakAt` (if > 0), down to `end`×w.
     Default is a heavy start and a pointed end, like a loaded nib leaving the ridge. */
  function brush(ctx, pts, r, { w = 1.4, wob = 0.5, start = 1, end = 0.12, peakAt = 0, color } = {}) {
    if (pts.length < 2) return
    const p = A.wobble(pts, r, wob, 5)
    let total = 0; const acc = [0]
    for (let i = 1; i < p.length; i++) { total += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); acc.push(total) }
    const prof = (t) => peakAt > 0
      ? (t < peakAt ? start + (1 - start) * (t / peakAt) : 1 + (end - 1) * Math.pow((t - peakAt) / (1 - peakAt), 0.9))
      : start + (end - start) * Math.pow(t, 0.9)
    const L = [], Rt = []
    for (let i = 0; i < p.length; i++) {
      const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)], d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
      const nx = -(b[1] - a[1]) / d, ny = (b[0] - a[0]) / d, t = total ? acc[i] / total : 0
      const hw = (w / 2) * prof(t)
      L.push([p[i][0] + nx * hw, p[i][1] + ny * hw]); Rt.push([p[i][0] - nx * hw, p[i][1] - ny * hw])
    }
    ctx.beginPath(); L.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); for (let i = Rt.length - 1; i >= 0; i--) ctx.lineTo(Rt[i][0], Rt[i][1]); ctx.closePath()
    ctx.fillStyle = color || ctx.strokeStyle; ctx.fill()
  }

  /* Point at parameter t on a bowed line a→b. Positive bow pushes toward the normal (-dy, dx). */
  function bowPt(a, b, bow, t) {
    const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, k = Math.sin(PI * t) * bow
    return [a[0] + dx * t - dy / d * k, a[1] + dy * t + dx / d * k]
  }
  /* Polyline along a bowed line, with jitter on the interior points. */
  function bowLine(a, b, bow, r, jit, n) {
    const out = []
    for (let i = 0; i <= n; i++) {
      const p = bowPt(a, b, bow, i / n)
      if (i && i < n && jit) { p[0] += R(r, -jit, jit); p[1] += R(r, -jit, jit) }
      out.push(p)
    }
    return out
  }
  function fillPoly(ctx, pts, color, alpha = 1) { ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color; A.poly(ctx, pts); ctx.fill(); ctx.restore() }
  /* Soft grey ink fill: two translucent layers, slightly offset, so the edge reads as a brush wash rather than a flat fill. */
  function softFill(ctx, pts, color, alpha, r) {
    ctx.save(); ctx.globalAlpha = alpha * 0.55; ctx.fillStyle = color
    A.poly(ctx, pts); ctx.fill()
    ctx.translate(R(r, -0.7, 0.7), R(r, -0.5, 0.5)); A.poly(ctx, pts); ctx.fill()
    ctx.restore()
  }
  /* Distance along ray p+d·t to segment a–b, or null. */
  function raySeg(p, d, a, b) {
    const ex = b[0] - a[0], ey = b[1] - a[1], den = d[0] * ey - d[1] * ex
    if (Math.abs(den) < 1e-6) return null
    const fx = a[0] - p[0], fy = a[1] - p[1], t = (fx * ey - fy * ex) / den, u = (fx * d[1] - fy * d[0]) / den
    return t > 0 && u >= 0 && u <= 1 ? t : null
  }

  /* Snow cap wash: `top` runs along the silhouette from the lit-side foot of the cap over the crest to the shade-side foot;
     the bottom edge comes back as a jagged line that drips into the gullies. */
  function snowCap(ctx, r, st, top, h) {
    const left = top[0], right = top[top.length - 1], teeth = 3 + Math.floor(r() * 3), cap = top.slice()
    for (let i = 1; i < teeth; i++) { const q = lerp(right, left, i / teeth); q[1] += h * R(r, 0.03, 0.12) * (i % 2 ? 1 : 0.35); cap.push(q) }
    A.wash(ctx, () => A.poly(ctx, cap), st.tint.snow, r, 0.95)
  }

  /* Shade-face hatching: strokes leave the ridge (A→S) and sweep down to the right, roughly parallel to the right slope,
     heavy where they start and pointed where they end. Lower strokes run a little flatter and trail out past the foot. */
  function shadeHatch(ctx, r, st, { A_, S, BR, by, lw, sbow, n, weight = 1 }) {
    const spine = (t) => bowPt(A_, S, sbow, t), h = by - A_[1]
    const ang = Math.atan2(BR[1] - A_[1], BR[0] - A_[0])
    for (let i = 0; i < n; i++) {
      const t = (i + R(r, 0.15, 0.85)) / n, p0 = spine(t)
      p0[0] -= R(r, 0, lw * 0.6)
      const th = ang * R(r, 0.92, 1.1) * (1 - 0.12 * t), dx = Math.cos(th), dy = Math.sin(th)
      let L = (by + h * 0.04 - p0[1]) / Math.max(dy, 0.2)
      const hit = raySeg(p0, [dx, dy], A_, BR)
      if (hit !== null) L = Math.min(L, hit * R(r, 1.0, 1.35))
      L *= R(r, 0.7, 1)
      if (L < lw * 2) continue
      // weight grows with the peak's height (a big peak gets a fuller nib), never below a readable minimum
      const w = Math.max(0.85 * st.line, lw * R(r, 1.3, 2.0) * Math.pow(h / 60, 0.35) * (1 - 0.25 * t) * weight)
      // each stroke falls steeply off the ridge, then flattens as it runs out: a gentle concave curve
      const t0 = th + 0.15, t1 = th - 0.08, p1 = [p0[0] + Math.cos(t0) * L * 0.35, p0[1] + Math.sin(t0) * L * 0.35]
      const p2 = [p1[0] + dx * L * 0.35, p1[1] + dy * L * 0.35], p3 = [p2[0] + Math.cos(t1) * L * 0.3, p2[1] + Math.sin(t1) * L * 0.3]
      brush(ctx, [p0, p1, p2, p3], r, { w, wob: 0.4, start: 1, end: 0.08, color: st.ink })
    }
  }

  /* Ground shading under the shade-side foot: a few short, light strokes hugging the base (only when st.shadows). */
  function groundShade(ctx, r, st, ax, brx, by, lw, m) {
    for (let i = 0; i < m; i++) {
      const p0 = [brx - R(r, 0.05, 0.3) * (brx - ax) + i * lw * 2, by + lw * (0.6 + i * 1.8)], L = (brx - ax) * R(r, 0.2, 0.45) * (1 - i * 0.25)
      brush(ctx, [p0, [p0[0] + L, p0[1] + L * 0.1]], r, { w: lw * 0.7, wob: 0.3, start: 0.7, end: 0.1, color: st.ink })
    }
  }

  /* ---------- Tolkien peak ---------- */
  /* P = { ax, ay (apex), blx, brx (feet), by (ground), lw, snow (fraction of height, 0 = none) } */
  function tolkienPeak(ctx, r, st, P) {
    const { ax, ay, blx, brx, by, lw } = P, h = by - ay, A_ = [ax, ay], BL = [blx, by], BR = [brx, by]
    const bow = h * R(r, 0.03, 0.08)                                  // concave slopes: steep at the top, flaring at the foot
    const left = bowLine(A_, BL, -bow, r, h * 0.015, 6), right = bowLine(A_, BR, bow * R(r, 0.6, 1), r, h * 0.015, 6)
    const sil = [...left.slice().reverse(), ...right.slice(1)]       // BL … A … BR
    const S = [ax + (brx - ax) * R(r, 0.12, 0.3), by], sbow = h * R(r, 0.01, 0.06)
    const spine = (t) => bowPt(A_, S, sbow, t), rslope = (t) => bowPt(A_, BR, bow, t), lslope = (t) => bowPt(A_, BL, -bow, t)

    fillPoly(ctx, sil, st.paper)                                      // occlude whatever is behind
    if (st.mode === 'colour') {
      A.wash(ctx, () => A.poly(ctx, sil), st.tint.rock, r, 0.5)
      A.wash(ctx, () => A.poly(ctx, [S, A_, ...right.slice(1)]), st.tint.rock, r, 0.35)
      if (P.snow > 0 && h > 14) snowCap(ctx, r, st, [lslope(P.snow), A_, rslope(P.snow)], h)
    }
    // solid dark wedge just under the apex on the shade side
    if (h > 10) { const wt = R(r, 0.18, 0.32); fillPoly(ctx, A.wobble([A_, rslope(wt), spine(Math.min(1, wt * 1.15))], r, 0.5, 4), st.ink) }
    shadeHatch(ctx, r, st, { A_, S, BR, by, lw, sbow, n: Math.max(3, Math.min(34, Math.round(h / 2.7))) })
    // a few ridge strokes on the lit face, parallel to the left slope
    const k = h > 16 ? 1 + Math.floor(r() * 3) + (h > 70 ? 1 : 0) : (r() < 0.5 ? 1 : 0), langle = Math.atan2(by - ay, blx - ax)
    for (let i = 0; i < k; i++) {
      const t0 = R(r, 0.05, 0.4), p0 = lerp(spine(t0), lslope(t0), R(r, 0.2, 0.7))
      const th = langle + R(r, -0.12, 0.12), L = h * R(r, 0.2, 0.5) * (1 - t0)
      brush(ctx, [p0, [p0[0] + Math.cos(th) * L, p0[1] + Math.sin(th) * L]], r, { w: lw * R(r, 0.9, 1.3), wob: 0.4, start: 0.85, end: 0.1, color: st.ink })
    }
    // outlines: bold lit slope thinning to the foot; the shade slope only part way down (the hatching carries the rest)
    const ow = Math.pow(h / 60, 0.3)
    brush(ctx, left, r, { w: lw * 2.6 * ow, wob: 0.3, start: 0.35, peakAt: 0.22, end: 0.3, color: st.ink })
    brush(ctx, right.slice(0, 2 + Math.floor(R(r, 1, 4))), r, { w: lw * 1.8 * ow, wob: 0.3, start: 0.9, end: 0.1, color: st.ink })
    if (st.shadows && h > 14) groundShade(ctx, r, st, ax, brx, by, lw, 1 + Math.floor(r() * 2))
  }

  A.register('mountain', {
    label: 'Mountain', category: 'mountains', kind: 'recipe', view: 'side',
    draw(ctx, x, y, s, r, st) {
      ctx.save()
      const lw = lwFor(s, st), h = s * R(r, 0.92, 1.05), w = h * R(r, 0.95, 1.3)
      const ax = x + h * R(r, -0.14, 0.08), blx = x - w / 2, brx = x + w / 2
      const snow = st.mode === 'colour' ? snowFrac(st) * R(r, 0.8, 1.2) : 0
      if (r() < 0.55) {                                               // a lower shoulder peak tucked behind on one side
        const side = r() < 0.6 ? -1 : 1, h2 = h * R(r, 0.45, 0.72), w2 = h2 * R(r, 0.95, 1.3)
        const ax2 = ax + side * w * R(r, 0.3, 0.46), by2 = y - h * R(r, 0.02, 0.07)
        tolkienPeak(ctx, r, st, { ax: ax2, ay: by2 - h2, blx: ax2 - w2 * R(r, 0.45, 0.55), brx: ax2 + w2 * R(r, 0.45, 0.55), by: by2, lw: lw * 0.9, snow: snow * 0.8 })
      }
      tolkienPeak(ctx, r, st, { ax, ay: y - h, blx, brx, by: y, lw, snow })
      ctx.restore()
    },
  })

  /* ---------- Midkemia soft peak ---------- */
  function softPeak(ctx, r, st, P) {
    const { ax, ay, blx, brx, by, lw } = P, h = by - ay, A_ = [ax, ay], BL = [blx, by], BR = [brx, by]
    const bow = h * R(r, 0, 0.05)
    const left = bowLine(A_, BL, -bow, r, h * 0.012, 5), right = bowLine(A_, BR, bow, r, h * 0.012, 5)
    if (r() < 0.45) { const i = 2 + Math.floor(r() * 2), d = h * R(r, 0.04, 0.09); left[i][0] -= d * 0.6; left[i][1] -= d }   // a step on the lit slope
    if (r() < 0.35) { const i = 2 + Math.floor(r() * 2), d = h * R(r, 0.03, 0.07); right[i][0] += d * 0.6; right[i][1] -= d }  // a knuckle on the shade slope
    const sil = [...left.slice().reverse(), ...right.slice(1)]
    fillPoly(ctx, sil, st.paper)
    if (st.mode === 'colour') A.wash(ctx, () => A.poly(ctx, sil), st.tint.rock, r, 0.38)
    const S = [ax + (brx - ax) * R(r, 0.06, 0.22), by]
    softFill(ctx, A.wobble([S, A_, ...right.slice(1)], r, 0.7, 5), st.ink, st.mode === 'colour' ? 0.3 : 0.32, r)
    // a second, darker tone high on the shade face so the grey reads as a brush wash, not a flat fill
    if (h > 12) {
      const t1 = R(r, 0.45, 0.7), inner = [A_, bowPt(A_, BR, bow, t1), lerp(bowPt(A_, BR, bow, t1), lerp(A_, S, t1), R(r, 0.5, 0.8)), lerp(A_, S, t1 * 0.5)]
      softFill(ctx, A.wobble(inner, r, 0.9, 4), st.ink, 0.2, r)
    }
    if (st.mode === 'colour' && P.snow > 0 && h > 16) snowCap(ctx, r, st, [bowPt(A_, BL, -bow, P.snow), A_, bowPt(A_, BR, bow, P.snow)], h)
    brush(ctx, left, r, { w: lw * 1.3, wob: 0.3, start: 0.6, peakAt: 0.3, end: 0.2, color: st.ink })
    brush(ctx, right.slice(0, 2 + Math.floor(r() * 2)), r, { w: lw * 0.9, wob: 0.3, start: 0.9, end: 0.1, color: st.ink })
    if (st.shadows && h > 16) groundShade(ctx, r, st, ax, brx, by, lw * 0.8, 1)
  }

  A.register('mountain-soft', {
    label: 'Mountain (soft)', category: 'mountains', kind: 'recipe', view: 'side',
    draw(ctx, x, y, s, r, st) {
      ctx.save()
      const lw = lwFor(s, st), h = s * R(r, 0.9, 1.02), w = h * R(r, 1.4, 1.9), ax = x + h * R(r, -0.12, 0.1)
      const snow = st.mode === 'colour' && biome(st) === 'Winter' ? 0.4 : 0
      const extra = r() < 0.6 ? 1 + Math.floor(r() * 2) : 0, items = [{ y, draw: () => softPeak(ctx, r, st, { ax, ay: y - h, blx: x - w / 2, brx: x + w / 2, by: y, lw, snow }) }]
      for (let i = 0; i < extra; i++) {                               // lower peaks along the same ridge, behind or in front
        const side = i === 0 ? (r() < 0.5 ? -1 : 1) : (items[1].side * -1), h2 = h * R(r, 0.45, 0.72), w2 = h2 * R(r, 1.4, 1.8)
        const ax2 = ax + side * w * R(r, 0.3, 0.42), by2 = y + h * R(r, -0.05, 0.08)
        items.push({ y: by2, side, draw: () => softPeak(ctx, r, st, { ax: ax2, ay: by2 - h2, blx: ax2 - w2 * R(r, 0.45, 0.55), brx: ax2 + w2 * R(r, 0.45, 0.55), by: by2, lw: lw * 0.9, snow }) })
      }
      A.drawSorted(items)
      ctx.restore()
    },
  })

  /* ---------- Genabackis small peak cluster ---------- */
  function smallPeak(ctx, r, st, P) {
    const { ax, ay, blx, brx, by, lw } = P, h = by - ay, A_ = [ax, ay], BL = [blx, by], BR = [brx, by]
    const left = bowLine(A_, BL, -h * 0.04, r, h * 0.02, 3), right = bowLine(A_, BR, h * 0.04, r, h * 0.02, 3)
    const sil = [...left.slice().reverse(), ...right.slice(1)]
    fillPoly(ctx, sil, st.paper)
    if (st.mode === 'colour') A.wash(ctx, () => A.poly(ctx, sil), st.tint.rock, r, 0.45)
    const S = [ax + (brx - ax) * R(r, 0.1, 0.3), by], rs = (t) => bowPt(A_, BR, h * 0.04, t), sp = (t) => lerp(A_, S, t)
    // a black wedge filling most of the shade face, with a ragged inner edge: one heavy nib stroke
    const t1 = R(r, 0.65, 0.95), t3 = t1 * R(r, 0.3, 0.5)
    fillPoly(ctx, A.wobble([A_, rs(t1), lerp(rs(t1), sp(t1), R(r, 0.45, 0.7)), lerp(rs(t3), sp(t3), R(r, 0.6, 0.9))], r, 0.3, 3), st.ink)
    const m = h > 14 ? 1 + Math.floor(r() * 2) : 0
    for (let i = 0; i < m; i++) {
      const t = R(r, 0.45, 0.9), p0 = lerp(sp(t), rs(t), R(r, 0, 0.3)), L = h * R(r, 0.25, 0.5), th = Math.atan2(by - ay, brx - ax) * R(r, 0.85, 1.05)
      brush(ctx, [p0, [p0[0] + Math.cos(th) * L, p0[1] + Math.sin(th) * L]], r, { w: lw * 1.0, wob: 0.3, start: 1, end: 0.1, color: st.ink })
    }
    brush(ctx, left, r, { w: lw * 1.2, wob: 0.25, start: 0.9, end: 0.3, color: st.ink })
  }

  A.register('mountain-small', {
    label: 'Mountain (small)', category: 'mountains', kind: 'recipe', view: 'side',
    draw(ctx, x, y, s, r, st) {
      ctx.save()
      const lw = lwFor(Math.max(s, 22), st), k = 3 + Math.floor(r() * 3), span = s * R(r, 1.4, 2.2), items = []
      for (let i = 0; i < k; i++) {
        const px = x - span / 2 + span * (i + R(r, 0.2, 0.8)) / k, ph = s * R(r, 0.5, 1.0), pw = ph * R(r, 0.9, 1.3), pby = y + s * R(r, -0.05, 0.05)
        items.push({ y: pby, draw: () => smallPeak(ctx, r, st, { ax: px + ph * R(r, -0.1, 0.08), ay: pby - ph, blx: px - pw / 2, brx: px + pw / 2, by: pby, lw }) })
      }
      A.drawSorted(items)
      ctx.restore()
    },
  })

  /* ---------- Hills ---------- */
  /* A rounded hump: outline runs from the left foot over the crown and stops part way down the right side;
     short ticks on the right face carry the slope to the ground. H = { x, by, h, w, lw, ticks } */
  function hump(ctx, r, st, H) {
    const { by, h, w, lw } = H, bl = H.x - w / 2, q = R(r, 0.72, 0.95), N = 16, top = []
    for (let i = 0; i <= N; i++) { const u = i / N; top.push([bl + w * u, by - h * Math.pow(Math.sin(PI * Math.pow(u, q)), 1.25)]) }
    fillPoly(ctx, top, st.paper)
    if (st.mode === 'colour') A.wash(ctx, () => A.poly(ctx, top), st.tint.grass, r, 0.45)
    const i1 = Math.round(N * R(r, 0.8, 0.92))
    A.inkStroke(ctx, top.slice(1, i1 + 1), r, { w: lw * 2.0, wob: 0.35, taper: 0.7, color: st.ink })
    for (let i = 0; i < H.ticks; i++) {
      const u = R(r, 0.56, 0.94), j = Math.min(N - 1, Math.floor(u * N)), a = top[j], b = top[j + 1]
      const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, tx = (b[0] - a[0]) / d, ty = (b[1] - a[1]) / d
      const inset = lw * R(r, 1.2, 3.2), p0 = [a[0] - ty * inset, a[1] + tx * inset], L = w * R(r, 0.13, 0.26)
      brush(ctx, [p0, [p0[0] + tx * L, p0[1] + ty * L]], r, { w: lw * 1.3, wob: 0.3, start: 1, end: 0.15, color: st.ink })
    }
    if (st.shadows && h > 10) groundShade(ctx, r, st, H.x, H.x + w / 2, by, lw * 0.8, 1)
  }

  A.register('hill', {
    label: 'Hill', category: 'hills', kind: 'recipe', view: 'side',
    draw(ctx, x, y, s, r, st) {
      ctx.save()
      const lw = lwFor(s, st), h = s * R(r, 0.65, 0.8), w = h * R(r, 2.4, 3.0), hx = x + h * R(r, -0.1, 0.1)
      if (r() < 0.35) {                                               // a second crest behind, making the "m" shape
        const h2 = h * R(r, 0.6, 0.85), w2 = w * R(r, 0.6, 0.8), side = r() < 0.5 ? -1 : 1
        hump(ctx, r, st, { x: hx + side * w * R(r, 0.3, 0.42), by: y - h * R(r, 0.03, 0.1), h: h2, w: w2, lw: lw * 0.9, ticks: 1 + Math.floor(r() * 2) })
      }
      hump(ctx, r, st, { x: hx, by: y, h, w, lw, ticks: 3 + Math.floor(r() * 3) })
      ctx.restore()
    },
  })

  A.register('downs', {
    label: 'Downs', category: 'hills', kind: 'recipe', view: 'side',
    draw(ctx, x, y, s, r, st) {
      ctx.save()
      const lw = lwFor(s, st), k = 2 + Math.floor(r() * 3), span = s * R(r, 1.3, 2.0), items = []
      for (let i = 0; i < k; i++) {
        const h = s * R(r, 0.3, 0.55), w = h * R(r, 2.3, 3.2), cx = x - span / 2 + span * (i + R(r, 0.25, 0.75)) / k, by = y + s * R(r, -0.1, 0.1)
        items.push({ y: by, draw: () => hump(ctx, r, st, { x: cx, by, h, w, lw: lw * 0.85, ticks: 1 + Math.floor(r() * 2) }) })
      }
      A.drawSorted(items)
      ctx.restore()
    },
  })

  /* ---------- Volcano (fixed, 8 variants) ---------- */
  const VOLC = [
    { w: 1.3, lean: -0.04, crater: 0.2, smoke: { dir: 1, len: 0.6, puffs: 2 }, lava: 1 },          // classic cone, drifting plume
    { w: 1.0, lean: 0.03, crater: 0.14, smoke: { dir: 1, len: 0.9, puffs: 1 }, lava: 0 },          // tall narrow cone, tall column
    { w: 1.7, lean: 0, crater: 0.3, smoke: { dir: 1, len: 0.5, puffs: 3 }, lava: 1 },              // broad shield, wide crater, billowing
    { w: 1.35, lean: -0.06, crater: 0.18, side: -1, smoke: { dir: 1, len: 0.65, puffs: 2 }, lava: 0 }, // parasitic cone on the left
    { w: 1.25, lean: 0.05, crater: 0.22, notch: true, smoke: { dir: 1, len: 0.55, puffs: 2 }, lava: 1 }, // blown-out right rim
    { w: 1.1, lean: 0, crater: 0.17, smoke: { dir: 0, len: 0.75, puffs: 3 }, lava: 0 },            // still air: smoke straight up
    { w: 1.4, lean: -0.03, crater: 0.2, side: 1, smoke: { dir: -1, len: 0.7, puffs: 2 }, lava: 0 },   // ridge on the right, wind reversed
    { w: 1.3, lean: 0.02, crater: 0.19, smoke: { dir: 1, len: 0.4, puffs: 1 }, lava: 2 },          // active: lava both sides, thin wisp
  ]

  A.register('volcano', {
    label: 'Volcano', category: 'mountains', kind: 'fixed', view: 'side',
    draw(ctx, x, y, s, r, st, variant) {
      const V = VOLC[((variant | 0) % 8 + 8) % 8]
      ctx.save()
      const lw = lwFor(s, st), h = s * 0.78, w = h * V.w, ax = x + h * V.lean, by = y
      const cw = w * V.crater, RL = [ax - cw / 2, by - h], RR = [ax + cw / 2, by - h * (V.notch ? 0.93 : 1)]
      const BL = [x - w / 2, by], BR = [x + w / 2, by], bow = h * 0.07
      const left = bowLine(RL, BL, -bow, r, h * 0.012, 6), right = bowLine(RR, BR, bow * 0.8, r, h * 0.012, 6)
      // smaller cone or ridge alongside, drawn first so the main cone sits in front
      if (V.side) {
        const h2 = h * 0.6, ax2 = ax + V.side * w * 0.4, by2 = by - h * 0.03
        tolkienPeak(ctx, r, st, { ax: ax2, ay: by2 - h2, blx: ax2 - h2 * 0.7, brx: ax2 + h2 * 0.65, by: by2, lw: lw * 0.9, snow: 0 })
      }
      // body
      const sil = [...left.slice().reverse(), ...right.slice(1)]
      fillPoly(ctx, sil, st.paper)
      const S = [ax + (BR[0] - ax) * 0.2, by], sbow = h * 0.03
      if (st.mode === 'colour') {
        A.wash(ctx, () => A.poly(ctx, sil), st.tint.rock, r, 0.5)
        A.wash(ctx, () => A.poly(ctx, [S, RR, ...right.slice(1)]), st.tint.rock, r, 0.35)
        if (biome(st) === 'Winter') snowCap(ctx, r, st, [bowPt(RL, BL, -bow, 0.3), RL, RR, bowPt(RR, BR, bow * 0.8, 0.3)], h)
      }
      // crater: an ellipse seen a little from above; the far wall is dark, the near lip is drawn
      const cx = (RL[0] + RR[0]) / 2, cy = (RL[1] + RR[1]) / 2, rx = cw / 2, ry = Math.max(1.2, rx * 0.34)
      ctx.save()
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * PI); ctx.clip()
      ctx.fillStyle = st.ink; ctx.fillRect(cx - rx, cy - ry, 2 * rx, 2 * ry)
      ctx.fillStyle = st.mode === 'colour' ? st.tint.roof : st.paper; ctx.globalAlpha = st.mode === 'colour' ? 0.9 : 1
      ctx.beginPath(); ctx.ellipse(cx - rx * 0.18, cy + ry * 0.55, rx * 0.85, ry * 0.8, 0, 0, 2 * PI); ctx.fill()
      ctx.restore()
      // shade face hatching, ridge strokes, outlines
      shadeHatch(ctx, r, st, { A_: RR, S, BR, by, lw, sbow, n: Math.max(3, Math.min(26, Math.round(h / 2.9))) })
      const langle = Math.atan2(by - RL[1], BL[0] - RL[0])
      for (let i = 0; i < 2; i++) {
        const t0 = R(r, 0.1, 0.4), p0 = lerp(lerp(RL, S, t0), bowPt(RL, BL, -bow, t0), R(r, 0.3, 0.7)), L = h * R(r, 0.2, 0.4)
        brush(ctx, [p0, [p0[0] + Math.cos(langle) * L, p0[1] + Math.sin(langle) * L]], r, { w: lw * 1.0, wob: 0.4, start: 0.8, end: 0.1, color: st.ink })
      }
      // lava: thin wavy streams from the rim down the lit face (and the shade face for variant 7)
      for (let i = 0; i < V.lava; i++) {
        const sideL = i === 0 ? -1 : 1, from = sideL < 0 ? RL : RR, to = sideL < 0 ? BL : BR
        const pts = []; for (let k = 0; k <= 6; k++) { const t = k / 6 * R(r, 0.55, 0.75); const p = bowPt(from, to, sideL < 0 ? -bow : bow * 0.8, t); p[0] += sideL * -1 * h * 0.04 * t + Math.sin(k * 2.1) * h * 0.02; pts.push(p) }
        if (st.mode === 'colour') { ctx.save(); ctx.globalAlpha = 0.55; ctx.strokeStyle = st.tint.roof; ctx.lineWidth = lw * 3; ctx.lineCap = 'round'; ctx.beginPath(); pts.forEach((p, k) => k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); ctx.restore() }
        brush(ctx, pts, r, { w: lw * 0.9, wob: 0.8, start: 0.9, end: 0.1, color: st.ink })
      }
      brush(ctx, left, r, { w: lw * 2.4, wob: 0.3, start: 0.6, peakAt: 0.2, end: 0.3, color: st.ink })
      brush(ctx, right.slice(0, 4), r, { w: lw * 1.7, wob: 0.3, start: 0.9, end: 0.1, color: st.ink })
      const lip = []; for (let k = 0; k <= 8; k++) { const a = PI * (0.08 + 0.84 * k / 8); lip.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry * 1.1]) }
      A.inkStroke(ctx, lip.reverse(), r, { w: lw * 1.5, wob: 0.3, taper: 0.4, color: st.ink })
      // smoke: a bold curl rising from the crater, drifting with the wind, breaking into puffs and ash
      const { dir, len } = V.smoke, puffs = h < 22 ? 1 : V.smoke.puffs, sm = [], K = 12, Ls = h * len
      for (let k = 0; k <= K; k++) {
        const t = k / K
        sm.push([cx + dir * Ls * 0.6 * Math.pow(t, 1.6) + Math.sin(t * 5.5) * h * 0.05 * (1 - 0.4 * t), cy - ry - Ls * t])
      }
      const cut = Math.round(K * 0.5)
      brush(ctx, sm.slice(0, cut + 1), r, { w: lw * 2.4, wob: 0.8, start: 1, end: 0.4, color: st.ink })
      brush(ctx, sm.slice(cut + 1, cut + 3), r, { w: lw * 1.3, wob: 0.6, start: 0.8, end: 0.3, color: st.ink })
      for (let i = 0; i < puffs; i++) {
        // a cumulus puff: a bumpy outline, drawn open at the bottom where it joins the column
        const c = sm[Math.min(K, cut + 2 + Math.round((i + 0.5) * (K - cut - 2) / puffs))], pr = h * (0.07 + 0.035 * i), ph = R(r, 0, 6.28)
        c[0] += dir * pr * 0.4
        const rad = (a) => pr * (1 + 0.2 * Math.sin(3 * a + ph) + 0.1 * Math.sin(5 * a - ph))
        const full = []; for (let k = 0; k <= 20; k++) { const a = k / 20 * 2 * PI; full.push([c[0] + Math.cos(a) * rad(a), c[1] + Math.sin(a) * rad(a) * 0.72]) }
        if (st.mode === 'colour') softFill(ctx, full, st.ink, 0.13, r)
        const arc = []; for (let k = 0; k <= 16; k++) { const a = PI * 0.95 + k / 16 * PI * 1.35; arc.push([c[0] + Math.cos(a) * rad(a), c[1] + Math.sin(a) * rad(a) * 0.72]) }
        A.inkStroke(ctx, arc, r, { w: lw * 1.4, wob: 0.5, taper: 0.6, color: st.ink })
        if (i === puffs - 1 && h >= 22) for (let k = 0; k < 6; k++) { ctx.fillStyle = st.ink; ctx.beginPath(); ctx.arc(c[0] + dir * pr * R(r, 0.8, 2.2) + R(r, -pr, pr) * 0.6, c[1] - pr * R(r, -0.4, 1.0), lw * R(r, 0.5, 1.0), 0, 2 * PI); ctx.fill() }
      }
      if (st.shadows) groundShade(ctx, r, st, ax, BR[0], by, lw, 2)
      ctx.restore()
    },
  })
})()
