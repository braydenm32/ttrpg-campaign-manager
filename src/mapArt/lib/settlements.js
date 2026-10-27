/* Settlements: city, town, village, castle, tower, ruins, temple, standing-stones, port, plus the top-view city-dot symbol.
   Side-view pieces are hand-designed vignettes (8 variants each, picked by `variant`), drawn in a 60-unit design space
   (origin = middle of the base, y negative = up) that is scaled by s/60. Light comes from the upper left, so shade
   (hatching and heavier line) sits on the right-hand faces. */
;(function (A) {
  'use strict'
  const PI = Math.PI, sin = Math.sin, cos = Math.cos
  let ctx, r, st, k, det, INK, PAPER, COL, T, wl
  const rr = (a, b) => a + r() * (b - a)
  const j = (a) => (r() - 0.5) * 2 * a
  const W = (b) => b * wl // pen width in design units (kept near-constant in pixels across sizes)
  const SG = []
  let MIR = 0

  function open(c, x, y, s, rg, style, sc, dy) {
    ctx = c; r = rg; st = style; k = (s / 60) * (sc || 1); s *= sc || 1
    det = s >= 44 ? 2 : s >= 28 ? 1 : 0
    INK = st.ink; PAPER = st.paper; COL = st.mode === 'colour'; T = st.tint
    wl = st.line * Math.min(1.5, Math.max(0.72, 0.5 + 0.5 * k)) / k
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.translate(0, dy || 0); ctx.lineJoin = 'round'; ctx.lineCap = 'round'
  }
  const close = () => ctx.restore()

  /* ---------- drawing basics ---------- */
  function path(pts) { ctx.beginPath(); for (let i = 0; i < pts.length; i++) i ? ctx.lineTo(pts[i][0], pts[i][1]) : ctx.moveTo(pts[i][0], pts[i][1]); ctx.closePath() }
  function fill(pts, col) { path(pts); ctx.fillStyle = col || PAPER; ctx.fill() }
  function wash(pts, col, a) { A.wash(ctx, () => path(pts), col, r, a == null ? 0.5 : a) }
  /** Heavier-on-the-right pen outline: starts top-left, runs clockwise, so the swell lands on the shadow side. */
  function pen(pts, w, o) {
    o = o || {}
    const q = pts.map((a) => [a[0] + j(0.2), a[1] + j(0.2)])
    A.inkStroke(ctx, o.open ? q : q.concat([q[0]]), r, { w: W((w || 1.15) * 0.8), wob: o.wob == null ? 0.28 : o.wob, taper: o.taper == null ? 0.5 : o.taper, color: INK })
  }
  /** Queue a thin line; flush() strokes all queued lines as one path. */
  function sg(x0, y0, x1, y1) { SG.push(x0, y0, x1 + j(0.1), y1 + j(0.1)) }
  function flush(w, col) {
    if (!SG.length) return
    ctx.beginPath(); for (let i = 0; i < SG.length; i += 4) { ctx.moveTo(SG[i], SG[i + 1]); ctx.lineTo(SG[i + 2], SG[i + 3]) }
    ctx.lineWidth = W(w || 0.6); ctx.strokeStyle = col || INK; ctx.stroke(); SG.length = 0
  }
  /** Hatching in a convex polygon. Lines run at `ang`, start at the min-normal side and walk across (grow>1 opens the gap
   *  as it goes, so shade fades). Each line is trimmed a little at both ends by hand. */
  function hatch(pts, ang, gap, w, o) {
    o = o || {}
    const n = pts.length, dx = cos(ang), dy = sin(ang), nx = -dy, ny = dx
    let mn = 1e9, mx = -1e9
    for (let i = 0; i < n; i++) { const t = pts[i][0] * nx + pts[i][1] * ny; if (t < mn) mn = t; if (t > mx) mx = t }
    let g = Math.max(gap, 1.3 / k)
    const inset = o.inset == null ? 0.4 : o.inset, grow = o.grow || 1, maxg = g * 3.2
    let t = mn + g * 0.4, guard = 0
    ctx.beginPath()
    while (t < mx && guard++ < 90) {
      let lo = 1e9, hi = -1e9
      for (let i = 0; i < n; i++) {
        const a = pts[i], b = pts[(i + 1) % n], ta = a[0] * nx + a[1] * ny - t, tb = b[0] * nx + b[1] * ny - t
        if ((ta <= 0) !== (tb <= 0)) { const u = ta / (ta - tb), d = (a[0] + (b[0] - a[0]) * u) * dx + (a[1] + (b[1] - a[1]) * u) * dy; if (d < lo) lo = d; if (d > hi) hi = d }
      }
      if (hi - lo > 0.9) {
        let a0 = lo + inset * rr(0.2, 1.5), a1 = hi - inset * rr(0.2, 1.5)
        if (o.fade) a0 = Math.max(a0, a1 - (a1 - lo) * rr(o.fade, 1))
        if (a1 > a0 + 0.5) { const e = j(0.14); ctx.moveTo(t * nx + a0 * dx, t * ny + a0 * dy); ctx.lineTo((t + e) * nx + a1 * dx, (t + e) * ny + a1 * dy) }
      }
      t += g * (1 + j(0.22)); g = Math.min(maxg, g * grow)
    }
    ctx.lineWidth = W(w || 0.5); ctx.strokeStyle = o.color || INK; ctx.stroke()
  }
  /** Lines fanning out from an apex to points along p0..p1 (cone and spire shading). */
  function rays(ax, ay, p0, p1, n, w) {
    ctx.beginPath()
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1), px = p0[0] + (p1[0] - p0[0]) * t, py = p0[1] + (p1[1] - p0[1]) * t, f0 = rr(0.08, 0.32), f1 = rr(0.8, 0.98)
      ctx.moveTo(ax + (px - ax) * f0, ay + (py - ay) * f0); ctx.lineTo(ax + (px - ax) * f1, ay + (py - ay) * f1)
    }
    ctx.lineWidth = W(w || 0.5); ctx.strokeStyle = INK; ctx.stroke()
  }
  /** Polyline from a to b with n merlons (a merlon at each end). */
  function cren(a, b, n, mh) {
    const out = [], m = 2 * n - 1
    for (let i = 0; i < m; i += 2) {
      const t0 = i / m, t1 = (i + 1) / m, x0 = a[0] + (b[0] - a[0]) * t0, y0 = a[1] + (b[1] - a[1]) * t0, x1 = a[0] + (b[0] - a[0]) * t1, y1 = a[1] + (b[1] - a[1]) * t1
      out.push([x0, y0], [x0, y0 - mh], [x1, y1 - mh], [x1, y1])
    }
    return out
  }
  const mwid = () => Math.max(1.8, 2.3 / k)
  const nmer = (len) => Math.max(1, Math.round(len / (2 * mwid())))
  function arch(x, y, w, h, col) { ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x - w / 2, y - h + w / 2); ctx.arc(x, y - h + w / 2, w / 2, PI, 0); ctx.lineTo(x + w / 2, y); ctx.closePath(); ctx.fillStyle = col || INK; ctx.fill() }
  function blk(x, y, w, h) { ctx.fillStyle = INK; ctx.fillRect(x - w / 2, y - h, w, h) }
  function disc(x, y, rad, col) { ctx.beginPath(); ctx.arc(x, y, rad, 0, 6.2832); ctx.fillStyle = col || INK; ctx.fill() }
  function dots(n, x0, y0, x1, y1, size) { ctx.fillStyle = INK; for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.arc(rr(x0, x1), rr(y0, y1), size * rr(0.6, 1.2), 0, 6.2832); ctx.fill() } }
  /** Staggered masonry ticks. */
  function courses(x0, x1, y0, y1, stepY, stepX) {
    stepY = stepY || 3; stepX = stepX || 4.2
    for (let y = y0 + stepY; y < y1 - 0.5; y += stepY) {
      for (let x = x0 + rr(0.5, 2.5); x < x1 - 1.5; x += stepX * rr(0.8, 1.5)) if (r() < 0.6) { const l = rr(1.6, 3.2); sg(x, y, Math.min(x + l, x1 - 0.6), y) }
    }
  }
  const tuft = (x, y) => { sg(x - 0.7, y, x - 1.5, y - 2.1); sg(x, y, x + 0.1, y - 2.7); sg(x + 0.7, y, x + 1.6, y - 2) }
  /** Ground line, hatch shadow to the lower right (ticks, stipple or strokes, varied by position), grass tufts. */
  function ground(x0, x1, by, o) {
    o = o || {}
    A.inkStroke(ctx, [[x0 - 2.5, by + 0.3], [(x0 + x1) / 2, by + 0.6], [x1 + 3, by + 0.3]], r, { w: W(0.85), wob: 0.3, taper: 0.95, color: INK })
    if (st.shadows && det >= 1 && !o.noShade) {
      const kind = Math.abs(Math.round(x0 * 3 + x1 * 7 + by * 5)) % 4, rows = det >= 2 ? 2 : 1
      if (kind === 3) dots(Math.round((x1 - x0) * 0.7), x0 + 2, by + 0.8, x1 + 2, by + 3.2, 0.42)
      else for (let i = 0; i < rows; i++) {
        const y = by + 0.9 + i * 1.7
        if (kind === 2) { for (let x = x0 + 3 + i * 3; x < x1 + 2; x += rr(4, 8)) { const l = rr(2.5, 6); sg(x, y + 0.2, Math.min(x + l, x1 + 3), y + 0.2) } }
        else for (let x = x0 + 3 + i * 2.5; x < x1 + 3 - i * 2; x += rr(1.3, 2.3)) if (r() < 0.85 - i * 0.2) sg(x, y, x + 1.3, y - 1.6)
      }
      flush(0.42)
    }
    if (det >= 1 && !o.noTufts) { tuft(x0 - rr(1, 3), by + 0.2); tuft(x1 + rr(1, 3), by + 0.2); if ((x1 - x0) > 30 && r() < 0.6) tuft(x0 + (x1 - x0) * rr(0.3, 0.7), by + 2.4); flush(0.55) }
  }
  /** A low rounded mound (hill) the piece can stand on. */
  function mound(cx, by, w, h, o) {
    o = o || {}
    const pts = [], n = 12, top = []
    for (let i = 0; i <= n; i++) { const t = i / n, y = by - h * Math.pow(sin(PI * t), o.pw || 0.75), p = [cx - w / 2 + w * t + (i && i < n ? j(0.5) : 0), y]; pts.push(p); top.push(p) }
    fill(pts)
    if (COL) wash(pts, o.col || T.grass, 0.5)
    const right = [[cx + w * 0.05, by - h * Math.pow(sin(PI * 0.55), o.pw || 0.75)], ...pts.slice(Math.round(n * 0.55)), [cx + w * 0.05, by]]
    hatch(right, 1.95, 2.1, 0.5, { grow: 1.0 })
    pen(top, 1.1, { open: true, taper: 0.6 })
    if (det >= 1) dots(Math.round(w / 3), cx - w * 0.38, by - h * 0.5, cx + w * 0.02, by - 1, 0.55)
    flush(0.5)
  }
  const flag = (x, y, len, fh, fw) => { // pole and swallow-tailed pennant flying right
    fh = fh || 3; fw = fw || 5.5
    sg(x, y, x, y - len); flush(0.7)
    const t = y - len
    fill([[x, t], [x + fw, t + fh * 0.1 + j(0.3)], [x + fw * 0.72, t + fh * 0.5], [x + fw, t + fh * 0.92], [x, t + fh]], INK)
  }
  const cross = (x, y, h) => { sg(x, y, x, y - h); sg(x - h * 0.32, y - h * 0.68, x + h * 0.32, y - h * 0.68); flush(0.65) }
  const smoke = (x, y, h) => { A.inkStroke(ctx, [[x, y], [x + 1.2, y - h * 0.3], [x - 0.9, y - h * 0.58], [x + 0.9, y - h * 0.82], [x - 0.2, y - h]], r, { w: W(0.75), wob: 0.2, taper: 0.9, color: INK }) }

  /* ---------- buildings ---------- */
  /** Gable-front house seen from the front-right: lit front, shaded right wall, hatched roof. */
  function gable(cx, by, w, h, rh, d, o) {
    o = o || {}
    if (d < 0) { // seen from the front-left: mirrored, the visible side wall is lit so shade is sparse
      ctx.save(); ctx.translate(cx * 2, 0); ctx.scale(-1, 1); MIR = 1
      gable(cx, by, w, h, rh, -d, o)
      MIR = 0; ctx.restore(); return
    }
    w *= 1 + j(0.05); h *= 1 + j(0.04)
    const hw = w / 2, ox = d, oy = -d * 0.42
    const EL = [cx - hw, by - h], P = [cx, by - h - rh], ER = [cx + hw, by - h], BR = [cx + hw, by], BL = [cx - hw, by]
    const Pb = [P[0] + ox, P[1] + oy], ERb = [ER[0] + ox, ER[1] + oy], BRb = [BR[0] + ox, BR[1] + oy]
    const sil = [EL, P, Pb, ERb, BRb, BR, BL], roof = [ER, P, Pb, ERb], wall = [BR, BRb, ERb, ER]
    fill(sil)
    if (COL) { wash(roof, o.rc || T.roof, 0.5); if (o.stone) wash([BL, BR, ER, EL], T.rock, 0.3) }
    hatch(roof, Math.atan2(oy, ox), (o.rg || 1.05) * (MIR ? 1.5 : 1), o.rw || 0.62, { inset: 0.3 })
    hatch(wall, 1.5, MIR ? 3.2 : 1.4, MIR ? 0.45 : 0.55, { grow: 1.1, inset: 0.3, fade: MIR ? 0.4 : 0 })
    if (o.chim != null && det >= 1) {
      const u = o.chim, px = ER[0] + ox * u + (P[0] - ER[0]) * 0.45, py = ER[1] + oy * u + (P[1] - ER[1]) * 0.45
      fill([[px - 1, py + 1.4], [px - 1, py - 3.2], [px + 1, py - 3.2], [px + 1, py + 1.4]])
      sg(px - 1, py + 1.4, px - 1, py - 3.2); sg(px - 1, py - 3.2, px + 1, py - 3.2); sg(px + 1, py - 3.2, px + 1, py + 1.4); sg(px - 1.5, py - 3.2, px + 1.5, py - 3.2); flush(0.6)
      if (o.smoke) smoke(px, py - 3.5, 7)
    }
    pen(sil, 1.15)
    sg(ER[0], ER[1], BR[0], BR[1]); sg(ER[0], ER[1], P[0], P[1]); sg(ER[0], ER[1], ERb[0], ERb[1]); flush(0.65)
    if (det >= 1 && !o.nodoor) arch(cx + (o.dx == null ? -hw * 0.18 : o.dx), by, Math.max(1.9, w * 0.2), Math.min(h * 0.66, 4.4))
    if (det >= 2 && w > 7) { blk(cx + hw * 0.5, by - h * 0.42, 1.3, 1.7); if (w > 10) blk(cx - hw * 0.62, by - h * 0.42, 1.3, 1.7); if (rh > 4.5) blk(cx, by - h - rh * 0.42, 1.1, 1.6) }
  }
  /** Long house, ridge across the view: roof band over a lit wall; a shaded gable end on the right. */
  function longH(cx, by, w, h, rh, o) {
    o = o || {}
    w *= 1 + j(0.05); h *= 1 + j(0.04)
    const hw = w / 2, ov = o.ov == null ? 1.1 : o.ov, ri = o.ri == null ? rh * 0.8 : o.ri
    const E0 = [cx - hw - ov, by - h], R0 = [cx - hw + ri, by - h - rh], R1 = [cx + hw - ri, by - h - rh], E1 = [cx + hw + ov, by - h]
    const sil = [E0, R0, R1, E1, [cx + hw, by - h], [cx + hw, by], [cx - hw, by], [cx - hw, by - h]], roof = [E0, R0, R1, E1], endw = [[cx + hw - w * 0.22, by - h], [cx + hw, by - h], [cx + hw, by], [cx + hw - w * 0.22, by]]
    fill(sil)
    if (COL) { wash(roof, o.rc || T.roof, 0.5); if (o.stone) wash([[cx - hw, by - h], [cx + hw, by - h], [cx + hw, by], [cx - hw, by]], T.rock, 0.3) }
    hatch(roof, j(0.02), o.rg || 1.05, o.rw || 0.62, { inset: 0.4 })
    hatch(endw, 1.5, 1.4, 0.55, { grow: 1.12, inset: 0.3 })
    pen(sil, 1.15)
    sg(cx - hw, by - h, cx + hw, by - h); flush(0.6)
    if (det >= 1) {
      const n = Math.max(1, Math.round(w / 9)), step = (w * 0.78) / n
      for (let i = 0; i < n; i++) {
        const x = cx - hw + w * 0.11 + step * (i + 0.5)
        if (i === (o.door == null ? 0 : o.door) % n) arch(x, by, Math.max(1.9, w * 0.14), Math.min(h * 0.68, 4.4)); else if (det >= 2) blk(x, by - h * 0.32, 1.3, 1.8)
      }
    }
  }
  /** Square tower / keep / steeple with a shaded right face. cap: 'cren' | 'spire' | 'hip' | 'flat'. */
  function box(cx, by, w, h, d, cap, o) {
    o = o || {}
    w *= 1 + j(0.04); h *= 1 + j(0.03)
    const hw = w / 2, ox = d, oy = -d * 0.42, mh = o.mh == null ? 2.2 : o.mh
    const BL = [cx - hw, by], BR = [cx + hw, by], TL = [cx - hw, by - h], TR = [cx + hw, by - h]
    const BRb = [BR[0] + ox, BR[1] + oy], TRb = [TR[0] + ox, TR[1] + oy], TLb = [TL[0] + ox, TL[1] + oy]
    const frontF = [BL, TL, TR, BR], sideF = [BR, BRb, TRb, TR]
    let sil, apex = null
    if (cap === 'cren') sil = [BL, TL, ...cren(TL, TR, nmer(w), mh), ...(d > 1 ? cren(TR, TRb, nmer(d), mh) : [TRb]), BRb, BR]
    else if (cap === 'flat') sil = [BL, TL, TLb, TRb, BRb, BR]
    else { const sh = o.sh == null ? (cap === 'hip' ? w * 0.55 : w * 2.2) : o.sh; apex = [cx + ox / 2 + (o.lean || 0), by - h + oy / 2 - sh]; sil = [BL, TL, apex, TRb, BRb, BR] }
    fill(sil)
    if (COL) {
      wash(frontF, o.sc || T.rock, 0.3); wash(sideF, o.sc || T.rock, 0.3)
      if (apex) wash([TL, TR, apex, TRb], o.rc || T.roof, 0.5)
    }
    hatch(sideF, 1.5, 1.35, 0.55, { grow: 1.08, inset: 0.3 })
    if (apex) {
      if (det >= 1) { rays(apex[0], apex[1], TR, TRb, Math.max(3, Math.round(d * 0.55)), 0.5); rays(apex[0], apex[1], TL, TR, Math.max(2, Math.round(w * 0.22)), 0.45) }
      else rays(apex[0], apex[1], TR, TRb, 3, 0.5)
    }
    pen(sil, 1.2)
    sg(TR[0], TR[1], BR[0], BR[1])
    if (apex) { sg(TL[0], TL[1], TR[0], TR[1]); sg(TR[0], TR[1], apex[0], apex[1]) } else if (cap === 'flat') sg(TL[0], TL[1], TR[0], TR[1]); else { sg(TL[0], TL[1], TR[0], TR[1]); sg(TL[0], TL[1] + 1.8, TR[0], TR[1] + 1.8) }
    flush(0.65)
    if (det >= 2 && !apex) courses(cx - hw, cx + hw, by - h + 1, by - 1, 3.2)
    flush(0.4)
    if (o.gate) { arch(cx, by, Math.min(w * 0.4, 6), Math.min(h * 0.55, 8)) } else if (o.door && det >= 1) arch(cx, by, Math.max(2, w * 0.2), Math.min(h * 0.4, 4.4))
    if (o.belfry) arch(cx, by - h * 0.62, Math.max(2.2, w * 0.4), Math.max(3, h * 0.26))
    if (det >= 1 && o.slits) for (let i = 0; i < o.slits; i++) blk(cx - hw + w * (i + 0.5) / o.slits, by - h * 0.46, 1, 2.8)
    if (apex && o.cross) cross(apex[0], apex[1], 4.2)
    if (apex && o.flag) flag(apex[0], apex[1], 5, 2.8, 5)
    if (cap === 'cren' && o.flag) flag(cx + ox * 0.5, by - h + oy * 0.5 - mh, 7, 3, 5.5)
  }
  /** Round tower. cap: 'cone' | 'cren' | 'dome' | 'flat' | 'spire'. */
  function rtower(cx, by, w, h, cap, o) {
    o = o || {}
    w *= 1 + j(0.04); h *= 1 + j(0.03)
    const hw = w / 2, tp = o.tp == null ? 0.88 : o.tp, th = hw * tp, pw = th + 1, top = by - h, bl = Math.min(2.2, w * 0.14)
    const arc = [[cx + hw * 0.7, by + bl * 0.72], [cx, by + bl], [cx - hw * 0.7, by + bl * 0.72]]
    let body, sil, apex = null
    if (cap === 'cren' || cap === 'flat') {
      const bh = 2.4, mh = cap === 'cren' ? 2.2 : 0
      body = [[cx - th, top + bh], [cx + th, top + bh], [cx + hw, by], ...arc, [cx - hw, by]]
      sil = [[cx - pw, top + bh], ...(cap === 'cren' ? cren([cx - pw, top], [cx + pw, top], Math.max(2, Math.round(2 * pw / (2 * mwid()))), mh) : [[cx - pw, top], [cx + pw, top]]), [cx + pw, top + bh], [cx + th, top + bh], [cx + hw, by], ...arc, [cx - hw, by], [cx - th, top + bh]]
    } else {
      body = [[cx - th, top], [cx + th, top], [cx + hw, by], ...arc, [cx - hw, by]]
      sil = null
    }
    fill(body)
    if (COL) wash(body, o.sc || T.rock, 0.3)
    // shade: right-hand strip, denser at the edge
    hatch([[cx + th * 0.05, top], [cx + th, top], [cx + hw, by + 0.3], [cx + hw * 0.05, by + 0.3]], 1.5, 1.55, 0.5, { grow: 1.16, inset: 0.4, fade: 0.55 })
    if (sil) { fill(sil); if (COL) wash(sil, o.sc || T.rock, 0.3); hatch([[cx + th * 0.05, top + 2.4], [cx + th, top + 2.4], [cx + hw, by + 0.3], [cx + hw * 0.05, by + 0.3]], 1.5, 1.55, 0.5, { grow: 1.16, inset: 0.4, fade: 0.55 }) }
    if (sil) { pen(sil, 1.2, { taper: 0.5 }); sg(cx - pw, top + 2.4, cx + pw, top + 2.4); flush(0.55) }
    else pen([[cx + th, top], [cx + hw, by], ...arc, [cx - hw, by], [cx - th, top]], 1.2, { open: true, taper: 0.5 })
    if (det >= 2) { courses(cx - hw * 0.8, cx + hw * 0.3, top + 3, by - 1, 3.4, 4); flush(0.4) }
    if (cap === 'cone' || cap === 'spire') {
      const ew = th * (o.ewm || (cap === 'cone' ? 1.28 : 1.12)), ch = o.ch == null ? (cap === 'cone' ? w * 1.15 : w * 2.4) : o.ch, ey = top + 0.4, ec = ew * 0.2
      apex = [cx + (o.lean || 0), top - ch]
      const cone = [[cx - ew, ey], apex, [cx + ew, ey], [cx + ew * 0.55, ey + ec * 0.85], [cx, ey + ec], [cx - ew * 0.55, ey + ec * 0.85]]
      fill(cone)
      if (COL) wash(cone, o.rc || T.roof, 0.5)
      rays(apex[0], apex[1], [cx + ew * 0.12, ey + ec * 0.4], [cx + ew, ey], det >= 1 ? Math.max(3, Math.round(ew * 0.9)) : 3, 0.5)
      if (det >= 1) rays(apex[0], apex[1], [cx - ew, ey], [cx - ew * 0.1, ey + ec * 0.5], Math.max(1, Math.round(ew * 0.3)), 0.4)
      pen(cone, 1.15)
      if (o.flag) flag(apex[0], apex[1], 5, 2.8, 5)
    } else if (cap === 'dome') {
      const dh = o.dh == null ? w * 0.55 : o.dh, pts = []
      for (let i = 0; i <= 10; i++) { const a = PI * (1 - i / 10); pts.push([cx + cos(a) * th * 1.1, top - sin(a) * dh]) }
      fill(pts); if (COL) wash(pts, o.rc || T.roof, 0.5)
      hatch(pts.filter((p) => p[0] > cx - th * 0.1).concat([[cx - th * 0.1, top]]), 1.9, 1.5, 0.5, { grow: 1.1 })
      pen(pts, 1.1, { open: true, taper: 0.6 }); sg(cx - th * 1.1, top, cx + th * 1.1, top); flush(0.6)
      if (o.flag) flag(cx, top - dh, 4, 2.4, 4)
    } else if (o.flag) flag(cx, top - 2.2, 6, 3, 5)
    if (det >= 1 && o.door) arch(cx - hw * 0.1, by, Math.max(2, w * 0.24), Math.min(h * 0.28, 4.6))
    if (det >= 1 && o.slit !== 0) blk(cx - hw * 0.28, by - h * 0.55, 0.95, 2.6)
    if (det >= 2 && h > 22) blk(cx - hw * 0.28, by - h * 0.28, 0.95, 2.4)
  }
  /** Curtain wall facing us with merlons, a parapet band and masonry. */
  function wall(x0, x1, by, h, o) {
    o = o || {}
    const TL = [x0, by - h], TR = [x1, by - h], mh = o.mh == null ? 2.2 : o.mh
    const sil = [[x0, by], TL, ...cren(TL, TR, Math.max(2, nmer(x1 - x0) | 0), mh), [x1, by]], body = [[x0, by], TL, TR, [x1, by]]
    fill(sil)
    if (COL) wash(body, o.sc || T.rock, 0.32)
    hatch([[x1 - (x1 - x0) * 0.1, by - h], TR, [x1, by], [x1 - (x1 - x0) * 0.1, by]], 1.5, 1.8, 0.45, { grow: 1.2, inset: 0.3 })
    pen(sil, 1.15)
    sg(x0, by - h, x1, by - h); if (det >= 1) sg(x0, by - h + 2.3, x1, by - h + 2.3); flush(0.6)
    if (det >= 2) { courses(x0, x1, by - h + 2.3, by - 0.5, 3, 4.4); flush(0.4) }
    if (o.gate != null && det >= 1) arch(o.gate, by, 4.6, Math.min(h * 0.75, 7))
  }
  /** Dome on a drum/body. */
  function dome(cx, by, w, h, dh, o) {
    o = o || {}
    w *= 1 + j(0.04); h *= 1 + j(0.03)
    const hw = w / 2, top = by - h, dw = hw * (o.dw || 0.95), pts = []
    for (let i = 0; i <= 12; i++) { const a = PI * (1 - i / 12), e = o.onion ? 1 + 0.18 * sin(PI * Math.min(1, i / 12 * 1.35)) * (1 - i / 12) * 2 : 1; pts.push([cx + cos(a) * dw * (o.onion ? (1 + 0.28 * sin(PI * i / 12)) : 1), top - Math.pow(sin(a), o.onion ? 0.85 : 1) * dh]) }
    const bodyP = [[cx - hw, by], [cx - hw, top], [cx + hw, top], [cx + hw, by]]
    fill(bodyP)
    if (COL && !o.noBody) wash(bodyP, o.sc || T.rock, 0.28)
    hatch([[cx + hw * 0.58, top], [cx + hw, top], [cx + hw, by], [cx + hw * 0.58, by]], 1.5, 1.8, 0.5, { grow: 1.16, inset: 0.3 })
    pen([[cx - hw, top], [cx - hw, by], [cx + hw, by], [cx + hw, top]], 1.15, { open: true, taper: 0.4 })
    fill(pts)
    if (COL) wash(pts, o.rc || T.rock, o.rc ? 0.5 : 0.28)
    const rside = pts.filter((p) => p[0] > cx + dw * 0.05); rside.unshift([cx + dw * 0.05, top - dh]); rside.push([cx + dw * 0.05, top])
    hatch(rside, 1.8, 1.5, 0.5, { grow: 1.1 })
    if (det >= 1) { for (const f of [-0.5, 0.05]) { ctx.beginPath(); ctx.ellipse(cx + f * dw, top, Math.abs(f) * dw * 0.9 + dw * 0.1, dh * 0.97, 0, PI, 0); ctx.lineWidth = W(0.4); ctx.strokeStyle = INK; ctx.save(); path(pts); ctx.clip(); ctx.beginPath(); ctx.ellipse(cx + f * dw, top, Math.abs(f) * dw * 0.9 + dw * 0.1, dh * 0.97, 0, PI, 0); ctx.stroke(); ctx.restore() } }
    pen(pts, 1.15, { open: true, taper: 0.55 })
    sg(cx - dw * (o.onion ? 1.0 : 1), top, cx + dw * (o.onion ? 1.0 : 1), top); flush(0.6)
    const fy = top - dh
    sg(cx, fy, cx, fy - (o.fin == null ? 3.5 : o.fin)); flush(0.7); disc(cx, fy - 1.2, 0.8)
    if (det >= 1 && o.door !== 0) arch(cx, by, Math.max(2.2, w * 0.24), Math.min(h * 0.6, 6))
  }
  /** Row of columns (front elevation). Dark between them, steps and entablature optional. */
  function columns(x0, x1, by, h, n, o) {
    o = o || {}
    const cw = o.cw || 1.9, span = x1 - x0
    // shadowed interior
    ctx.beginPath(); ctx.rect(x0, by - h, span, h); ctx.fillStyle = PAPER; ctx.fill()
    hatch([[x0, by - h], [x1, by - h], [x1, by], [x0, by]], 1.52, 1.5, 0.55, { inset: 0.1, jit: 0.1 })
    for (let i = 0; i < n; i++) {
      const x = x0 + cw / 2 + (span - cw) * (n === 1 ? 0.5 : i / (n - 1))
      fill([[x - cw * 0.5, by - h], [x + cw * 0.5, by - h], [x + cw * 0.5, by], [x - cw * 0.5, by]])
      sg(x - cw * 0.5, by - h, x - cw * 0.5, by); sg(x + cw * 0.5, by - h, x + cw * 0.5, by)
      if (det >= 1) { sg(x + cw * 0.18, by - h + 1, x + cw * 0.18, by - 1); sg(x - cw * 0.9, by - h, x + cw * 0.9, by - h); sg(x - cw * 0.8, by - 0.6, x + cw * 0.8, by - 0.6) }
    }
    flush(0.6)
  }
  /** Standing stone (menhir): rough, tapering, one of four tops chosen from its position. */
  function menhir(cx, by, w, h, o) {
    o = o || {}
    w *= 1 + j(0.08); h *= 1 + j(0.06)
    const hw = w / 2, lean = (o.lean || 0) + j(0.4), shape = o.flat ? 3 : (Math.abs(Math.round(cx * 3 + h)) % 3)
    let tops
    if (shape === 0) tops = [[-0.78, -0.9], [-0.35, -1.0], [0.1, -1.04], [0.55, -0.97], [0.82, -0.8]] // rounded
    else if (shape === 1) tops = [[-0.8, -0.78], [-0.45, -0.92], [-0.05, -1.05], [0.5, -0.88], [0.75, -0.7]] // peaked
    else if (shape === 2) tops = [[-0.7, -1.0], [-0.2, -0.94], [0.15, -1.03], [0.45, -0.9], [0.86, -0.82]] // notched
    else tops = [[-0.9, -0.9], [-0.45, -0.96], [0.1, -1.0], [0.8, -0.93]] // flat-topped
    const sil = [[cx - hw * 1.08, by], [cx - hw * 0.92 + lean * 0.25, by - h * 0.34], [cx - hw * 0.84 + lean * 0.55, by - h * 0.7]]
    for (const t of tops) sil.push([cx + hw * 0.92 * t[0] + lean, by + h * t[1]])
    sil.push([cx + hw * 0.8 + lean * 0.5, by - h * 0.52], [cx + hw * 1.0 + lean * 0.2, by - h * 0.22], [cx + hw * 1.1, by])
    fill(sil)
    if (COL) wash(sil, T.rock, 0.38)
    const rp = [[cx + hw * 0.05 + lean * 0.8, by - h * 1.02], [cx + hw * 0.9 + lean, by - h * 0.85], [cx + hw * 1.1, by], [cx + hw * 0.05, by]]
    hatch(rp, 1.5, 1.05, 0.55, { grow: 1.1, inset: 0.4, fade: 0.55 })
    pen(sil, 1.1, { taper: 0.5 })
    A.inkStroke(ctx, [[cx + hw * 0.84 + lean * 0.7, by - h * 0.9], [cx + hw * 0.95 + lean * 0.4, by - h * 0.5], [cx + hw * 1.08, by - 0.4]], r, { w: W(1.5), wob: 0.1, taper: 0.8, color: INK })
    if (det >= 1) { for (const f of [0.28, 0.62]) { const y = by - h * f + j(h * 0.05); sg(cx - hw * 0.6 + lean * f, y, cx + hw * 0.1 + lean * f, y + rr(-0.5, 0.9)) } flush(0.35); dots(3, cx - hw, by - 2.2, cx + hw, by - 0.4, 0.4) }
  }

  /* ---------- registration helper ---------- */
  /** opt.sc: size multiplier (number, or one per variant); opt.dy: shift in design units (negative = up). */
  function reg(name, label, category, fns, opt) {
    opt = opt || {}
    A.register(name, { label, category, kind: 'fixed', view: 'side', variants: 8,
      draw(c, x, y, s, rg, style, v) { v = (v | 0) & 7; open(c, x, y, s, rg, style, Array.isArray(opt.sc) ? opt.sc[v] : opt.sc, opt.dy); fns[v](); close() } })
  }

  /* ================= CITY: wall line, towers, a crowd of roofs and spires behind ================= */
  const hillY = (x, cx, w, h, by) => { const t = Math.max(0, Math.min(1, (x - (cx - w / 2)) / w)); return by - h * Math.pow(sin(PI * t), 0.75) }
  reg('city', 'City', 'settlements', [
    // 0: market city: church and keep behind a gated wall, cone-capped corner towers
    () => {
      gable(-33, -13, 9, 6, 5, -5); gable(35, -13, 9, 7, 5, 5, { chim: 0.5 })
      longH(-14, -12, 17, 7, 5); box(-20.5, -11, 6, 20, 4, 'spire', { sh: 14, belfry: 1, cross: 1 })
      box(16, -12, 11, 22, 6, 'cren', { slits: 2, flag: 1 })
      gable(-27, -6.5, 8, 6, 4.5, -4, { chim: 0.4 }); longH(-6, -6, 11, 6, 4); gable(6, -6.5, 8, 7, 5, 4); longH(29, -6, 11, 6, 4.5)
      wall(-39, 39, 0, 11, { gate: 0 })
      box(0, 1, 14, 17, 4, 'cren', { gate: 1, slits: 2 })
      rtower(-40, 1, 10, 26, 'cone', { ch: 13, door: 1 }); rtower(40, 1, 10, 26, 'cone', { ch: 13 })
      rtower(-20, 0.5, 6, 19, 'cren'); rtower(20, 0.5, 6, 19, 'cren')
      ground(-45, 45, 1)
    },
    // 1: hill city: roofs tumbling down a mound to a low gated wall, cathedral on top
    () => {
      mound(0, -2, 84, 26)
      const hy = (x) => hillY(x, 0, 84, 26, -2) + 2
      longH(-3, hy(-3), 20, 8, 6); box(-10, hy(-3) + 1, 7, 21, 4, 'spire', { sh: 15, belfry: 1, cross: 1 }); box(8, hy(-3) + 1, 7, 17, 4, 'spire', { sh: 11, belfry: 1 })
      for (const [x, w, h, rh, d] of [[-24, 9, 6, 5, 4], [22, 9, 7, 5, 4], [-14, 8, 6, 4.5, 4], [14, 8, 6, 5, 4]]) gable(x, hy(x) + 6, w, h, rh, d, { chim: 0.5 })
      for (const [x, w, h, rh, d] of [[-33, 8, 6, 4.5, 4], [-5, 9, 6, 5, 4], [6, 8, 6, 4.5, 4], [32, 8, 6, 5, 4]]) gable(x, hy(x) + 12, w, h, rh, d, { chim: 0.3 })
      wall(-36, 36, 3, 9, { gate: 0 })
      rtower(-37, 4, 8, 20, 'cone', { ch: 10, door: 1 }); rtower(37, 4, 8, 20, 'cone', { ch: 10, flag: 1 }); box(-17, 3.5, 5, 14, 3, 'cren'); box(17, 3.5, 5, 14, 3, 'cren')
      ground(-44, 44, 4)
    },
    // 2: spired city: many slim spires, low wall with square towers
    () => {
      box(-30, -9, 5, 16, 3, 'spire', { sh: 14, cross: 1 }); box(-6, -11, 6, 22, 4, 'spire', { sh: 19, belfry: 1, cross: 1, flag: 0 }); box(24, -10, 5.5, 17, 3, 'spire', { sh: 14 })
      longH(-19, -9, 15, 7, 5, { ri: 2 }); longH(8, -9, 18, 8, 6, { ri: 2 }); gable(34, -9, 8, 6, 5, 4)
      gable(-38, -5, 7, 5, 4, -4); gable(-12, -5, 8, 6, 4, -4, { chim: 0.5 }); gable(18, -5.5, 8, 6, 4.5, 4); gable(-28, -4, 7, 5, 4, -3)
      wall(-42, 42, 0, 9, { gate: -2 })
      for (const x of [-42, -22, 18, 42]) box(x, 0.8, 6, 16, 3, 'hip', { sh: 6, slits: 1 })
      box(-2, 0.8, 11, 16, 3, 'cren', { gate: 1 })
      ground(-46, 46, 1)
    },
    // 3: southern city: domes, minarets and flat-roofed blocks
    () => {
      dome(-6, -9, 15, 12, 10, { door: 0, fin: 4 }); rtower(-22, -8, 4.4, 24, 'spire', { ch: 9, slit: 0 }); rtower(11, -8, 4.4, 28, 'spire', { ch: 9, slit: 0 })
      box(-34, -8, 9, 14, 4, 'flat', { slits: 2 }); box(28, -8, 9, 13, 4, 'flat', { slits: 2 }); dome(21, -8, 8, 9, 6, { door: 0, fin: 2.5, onion: 1 })
      box(-14, -4, 8, 11, 4, 'flat'); box(3, -4, 9, 9, 4, 'flat', { slits: 2 }); box(38, -4, 7, 10, 3, 'flat')
      wall(-42, 42, 0, 10, { gate: 0, mh: 1.8 })
      for (const x of [-42, -14, 14, 42]) box(x, 0.8, 7, 15, 3, 'cren')
      ground(-47, 47, 1)
    },
    // 4: citadel city: a huge keep over the roofs, double towers at the gate
    () => {
      box(0, -10, 18, 36, 7, 'cren', { mh: 2.6, slits: 3, flag: 1 }); rtower(-13, -9, 8, 30, 'cone', { ch: 12, flag: 1 }); rtower(15, -9, 8, 26, 'cone', { ch: 11 })
      gable(-32, -9, 9, 6, 5, -5); gable(35, -9, 9, 6, 5, 5, { chim: 0.5 }); longH(-22, -9, 11, 6, 4.5, { ri: 2 }); gable(28, -8, 8, 6, 4.5, 4)
      gable(-28, -4, 8, 6, 4.5, -4, { chim: 0.4 }); gable(-12, -4, 8, 6, 4.5, -4); gable(10, -4, 9, 6, 5, 4); gable(33, -4, 8, 5, 4, 4)
      wall(-40, 40, 0, 10, { gate: 0 })
      rtower(-9, 1, 8, 20, 'cone', { ch: 9, door: 1 }); rtower(9, 1, 8, 20, 'cone', { ch: 9 })
      rtower(-40, 1, 9, 22, 'cren'); rtower(40, 1, 9, 22, 'cren'); box(-24, 0.5, 5, 15, 3, 'cren'); box(24, 0.5, 5, 15, 3, 'cren')
      ground(-45, 45, 1)
    },
    // 5: corner view: front wall turning back on the right, cathedral inside
    () => {
      gable(-30, -12, 9, 6, 5, -5, { chim: 0.5 }); longH(-12, -12, 18, 8, 6); box(-19, -11, 6, 21, 4, 'spire', { sh: 15, belfry: 1, cross: 1 }); box(8, -12, 7, 18, 4, 'spire', { sh: 12, belfry: 1 })
      gable(-24, -6.5, 8, 6, 4.5, -4); gable(-8, -6, 9, 7, 5, 4, { chim: 0.4 }); longH(8, -6, 12, 6, 4.5); gable(20, -6.5, 8, 6, 4.5, 4)
      // receding right wall (drawn as an oblique face)
      const x0 = 28, dx = 15, dy = -dx * 0.42, h = 11
      const face = [[x0, 0], [x0 + dx, dy], [x0 + dx, dy - h], [x0, -h]]
      fill([[x0, 0], ...cren([x0, -h], [x0 + dx, dy - h], nmer(dx), 2.2), [x0 + dx, dy]])
      if (COL) wash(face, T.rock, 0.3)
      hatch(face, 1.5, 1.7, 0.5, { grow: 1.1 })
      pen([[x0, -h], ...cren([x0, -h], [x0 + dx, dy - h], nmer(dx), 2.2), [x0 + dx, dy], [x0, 0]], 1.2, { open: true })
      sg(x0, -h, x0 + dx, dy - h); sg(x0, -h + 2.3, x0 + dx, dy - h + 2.3); flush(0.55)
      box(x0 + dx, dy + 0.5, 7, 17, 3, 'cren')
      wall(-38, 28, 0, 11, { gate: -4 })
      rtower(-38, 1, 10, 25, 'cone', { ch: 12, door: 1 }); box(-4, 1, 13, 17, 4, 'cren', { gate: 1, slits: 2 }); rtower(28, 1, 9, 22, 'cren')
      ground(-44, 31, 1)
    },
    // 6: barbican city: gate flanked by drum towers, dense tiny roofs between
    () => {
      for (const [x, w, h, rh] of [[-34, 8, 6, 4.5], [-26, 8, 7, 5], [-12, 9, 6, 5], [-3, 8, 7, 5], [8, 8, 6, 4.5], [18, 9, 7, 5], [30, 8, 6, 5], [38, 8, 6, 4]]) gable(x, -11 - ((x * 7) & 3), w, h, rh, 4, { chim: x % 3 === 0 ? 0.5 : null })
      box(-18, -11, 6, 22, 4, 'spire', { sh: 14, cross: 1, belfry: 1 }); box(24, -11, 5.5, 18, 3, 'spire', { sh: 11 })
      for (const [x, w, h, rh] of [[-38, 7, 5, 4], [-18, 8, 6, 4.5], [-6, 8, 6, 5], [12, 8, 6, 4.5], [34, 8, 6, 4.5]]) gable(x, -5.5, w, h, rh, 4, { chim: 0.4 })
      wall(-40, 40, 0, 10)
      rtower(-9, 1, 9, 23, 'cone', { ch: 10, door: 1 }); rtower(9, 1, 9, 23, 'cone', { ch: 10, flag: 1 })
      box(0, 1, 9, 17, 3, 'cren', { gate: 1 })
      rtower(-40, 1, 8, 18, 'cren'); rtower(40, 1, 8, 18, 'cren'); rtower(-24, 0.5, 5.5, 15, 'cren'); rtower(24, 0.5, 5.5, 15, 'cren')
      ground(-45, 45, 1)
    },
    // 7: symmetrical cathedral city, a low wall with five square towers
    () => {
      box(-6.5, -10, 6, 20, 3, 'spire', { sh: 17, belfry: 1, cross: 1 }); box(5.5, -10, 6, 20, 3, 'spire', { sh: 17, belfry: 1 })
      longH(-0.5, -9, 22, 9, 6, { ri: 3 })
      for (const [x, w, h, rh] of [[-34, 9, 6, 5], [-24, 8, 7, 4.5], [24, 8, 7, 4.5], [34, 9, 6, 5]]) gable(x, -9.5, w, h, rh, 5, { chim: 0.5 })
      for (const [x, w, h, rh] of [[-38, 8, 6, 4.5], [-16, 9, 6, 5], [16, 9, 6, 5], [38, 8, 6, 4.5]]) gable(x, -4.5, w, h, rh, 4)
      wall(-42, 42, 0, 10, { gate: 0 })
      for (const x of [-42, -21, 21, 42]) box(x, 0.8, 7, 17, 3, 'cren', { slits: 1 })
      box(0, 0.8, 10, 17, 3, 'cren', { gate: 1 })
      ground(-46, 46, 1)
    },
  ], { sc: [1, 0.9, 1, 1.05, 1, 1, 1, 1] })

  /* ================= small extras shared by town, village and port ================= */
  function windmill(cx, by, h, o) {
    o = o || {}
    const bw = o.bw || 9, tw = bw * 0.58, top = by - h, hub = [cx + 0.8, top + 2.4]
    const body = [[cx - tw / 2, top], [cx + tw / 2, top], [cx + bw / 2, by], [cx - bw / 2, by]]
    const capP = [[cx - tw / 2 - 0.9, top], [cx, top - 4.6], [cx + tw / 2 + 0.9, top]]
    fill(body); if (COL) wash(body, T.land, 0.35)
    hatch([[cx + tw * 0.1, top], [cx + tw / 2, top], [cx + bw / 2, by], [cx + bw * 0.1, by]], 1.52, 1.35, 0.55, { grow: 1.1, fade: 0.5 })
    pen([[cx - tw / 2, top], [cx - bw / 2, by], [cx + bw / 2, by], [cx + tw / 2, top]], 1.15, { open: true })
    fill(capP); if (COL) wash(capP, T.roof, 0.5)
    hatch(capP, 1.1, 1.1, 0.55); pen(capP, 1.1)
    if (det >= 1) arch(cx - bw * 0.12, by, 2.2, 3.6)
    if (det >= 2) { blk(cx + 0.4, by - h * 0.5, 1.1, 1.5); sg(cx - bw / 2 + 1, by - 5.5, cx + bw / 2 - 1, by - 5.5); flush(0.4) }
    const L = h * 0.62, a0 = (o.rot == null ? 0.5 : o.rot)
    ctx.save(); ctx.translate(hub[0], hub[1])
    for (let i = 0; i < 4; i++) {
      const a = a0 + i * PI / 2, ux = cos(a), uy = sin(a), nx = -uy, ny = ux, l0 = L * 0.16, sw = 2.5
      const quad = [[ux * l0, uy * l0], [ux * L, uy * L], [ux * L + nx * sw, uy * L + ny * sw], [ux * l0 + nx * sw, uy * l0 + ny * sw]]
      fill(quad); pen(quad.concat([]), 0.8, { taper: 0.3 })
      if (det >= 1) for (let t = l0 + 1.5; t < L - 0.8; t += 1.7) sg(ux * t, uy * t, ux * t + nx * sw, uy * t + ny * sw)
      sg(0, 0, ux * L, uy * L); flush(0.5)
    }
    disc(0, 0, 0.9); ctx.restore()
  }
  function rick(cx, by, w, h) {
    const hw = w / 2, pts = [[cx - hw, by]]
    for (let i = 1; i < 8; i++) { const a = PI * (1 - i / 8); pts.push([cx + cos(a) * hw * (0.92 + 0.08 * sin(a)), by - sin(a) * h * (0.78 + 0.1 * cos(a * 2))]) }
    pts.push([cx + hw, by]); pts[4][1] -= 0.2
    fill(pts); if (COL) wash(pts, T.sand, 0.55)
    const rp = pts.filter((p) => p[0] > cx - hw * 0.1); rp.unshift([cx - hw * 0.1, by - h * 0.82]); rp.push([cx - hw * 0.1, by])
    hatch(rp, 1.35, 1.2, 0.5, { grow: 1.08, fade: 0.4 })
    pen(pts, 1, { taper: 0.6 }); sg(cx, by - h * 0.78, cx + 0.4, by - h - 2); flush(0.55)
  }
  function fence(x0, x1, by, h) {
    if (det < 1) return
    for (let x = x0; x <= x1 + 0.1; x += 3) sg(x, by, x + j(0.2), by - h)
    sg(x0, by - h * 0.35, x1, by - h * 0.4); sg(x0, by - h * 0.78, x1, by - h * 0.8)
    flush(0.6)
  }
  function well(cx, by) {
    const b = [[cx - 2.4, by - 2.6], [cx + 2.4, by - 2.6], [cx + 2.4, by], [cx - 2.4, by]]
    fill(b); hatch([[cx + 0.4, by - 2.6], [cx + 2.4, by - 2.6], [cx + 2.4, by], [cx + 0.4, by]], 1.5, 1, 0.5)
    pen(b, 0.9); sg(cx - 2, by - 2.6, cx - 2, by - 6); sg(cx + 2, by - 2.6, cx + 2, by - 6); flush(0.6)
    const rf = [[cx - 3.2, by - 6], [cx, by - 8.6], [cx + 3.2, by - 6]]; fill(rf); hatch(rf, 0.5, 1, 0.55); pen(rf, 0.9)
  }
  function tree(cx, by, h, o) { // a small hand-inked round tree
    o = o || {}
    const rw = h * 0.3, pts = []
    for (let i = 0; i < 9; i++) { const a = i / 9 * 2 * PI; pts.push([cx + cos(a) * rw * rr(0.85, 1.1), by - h * 0.62 + sin(a) * h * 0.34 * rr(0.85, 1.1)]) }
    sg(cx, by, cx, by - h * 0.35); flush(0.8)
    fill(pts); if (COL) wash(pts, T.forest, 0.6)
    hatch(pts.filter((p) => p[0] > cx - rw * 0.2).concat([[cx - rw * 0.2, by - h * 0.95]]), 1.9, 1.2, 0.5, { grow: 1.1 })
    pen(pts, 0.9, { taper: 0.4 })
  }

  /* ================= TOWN: 4-7 houses and a steeple ================= */
  reg('town', 'Town', 'settlements', [
    // 0: church with a spire behind a street of gabled houses
    () => {
      longH(11, -10, 19, 8, 6, { rg: 1 }); box(-0.5, -9, 7, 18, 4, 'spire', { sh: 15, belfry: 1, cross: 1 })
      gable(-25, -10, 10, 7, 5.5, -5, { chim: 0.5 }); gable(31, -10, 10, 7, 5.5, 5)
      gable(-17, -1, 11, 7, 6, -6, { chim: 0.4, smoke: 1 }); longH(3, 0, 14, 7, 5); gable(18, 0, 11, 7, 6, 6, { chim: 0.5 }); gable(-33, 1, 9, 6, 5, -4); gable(33, 1, 9, 6, 5, 4)
      ground(-39, 39, 1.5)
    },
    // 1: windmill and a bell-cote church
    () => {
      windmill(-26, -4, 30, { rot: 0.45 })
      gable(-6, -8, 10, 7, 5.5, 5, { chim: 0.5 }); longH(14, -9, 15, 7, 5.5); box(5, -8, 6, 15, 3, 'spire', { sh: 13, belfry: 1, cross: 1 })
      gable(-12, 0, 11, 7, 6, -6, { chim: 0.4, smoke: 1 }); gable(7, 1, 10, 6, 5.5, 5); longH(26, 1, 13, 7, 5, { door: 1 }); gable(36, -4, 8, 6, 4.5, 4)
      ground(-35, 40, 1.5)
    },
    // 2: market square: tall narrow houses round a cross
    () => {
      gable(-27, -9, 8, 11, 6, -5, { chim: 0.5 }); box(-12, -9, 6, 16, 3, 'spire', { sh: 14, belfry: 1, cross: 1 }); longH(2, -10, 12, 8, 5.5); gable(18, -9, 8, 11, 6, 5, { chim: 0.4 }); gable(32, -8, 8, 9, 5, 4)
      gable(-33, 0, 8, 8, 5, -4); gable(-19, 1, 9, 9, 5.5, -5, { chim: 0.4 }); gable(15, 1, 9, 9, 5.5, 5); longH(30, 1, 11, 7, 4.5)
      sg(0, 1, 0, -8); sg(-2, -5.5, 2, -5.5); flush(0.8); well(-1, 2.5)
      ground(-38, 38, 3, { noTufts: 1 })
    },
    // 3: hillside town, steeple at the top, roofs stepping down the slope
    () => {
      mound(0, 1, 78, 22)
      const hy = (x) => hillY(x, 0, 78, 22, 1)
      box(0, hy(0) + 2, 7, 15, 3, 'spire', { sh: 14, belfry: 1, cross: 1 }); longH(-11, hy(-11) + 3, 14, 7, 5)
      for (const [x, d] of [[-27, 5], [14, 6], [26, 5]]) gable(x, hy(x) + 7, 10, 7, 5.5, d, { chim: 0.5 })
      for (const [x, d] of [[-18, 5], [4, 6], [34, 4]]) gable(x, hy(x) + 12, 10, 7, 5.5, d, { chim: 0.3 })
      for (const x of [-32, -10, 18]) gable(x, hy(x) + 15.5, 9, 6, 5, 4)
      ground(-39, 39, 2)
    },
    // 4: timber town: long thatched houses, two small spires
    () => {
      longH(-24, -9, 17, 7, 5.5, { rg: 0.9, ov: 1.8, ri: 2 }); box(-10, -8, 5, 14, 3, 'spire', { sh: 11, belfry: 1, cross: 1 }); longH(10, -9, 15, 7, 5.5, { rg: 0.9, ov: 1.8, ri: 2 }); box(24, -9, 5, 13, 3, 'spire', { sh: 10 })
      longH(-31, 1, 13, 7, 5, { rg: 0.9, ov: 1.8, ri: 2 }); gable(-14, 0, 10, 7, 6, -5, { chim: 0.5, smoke: 1 }); longH(3, 1, 15, 7, 5, { rg: 0.9, ov: 1.8, ri: 2 }); gable(20, 0, 10, 7, 6, 5, { chim: 0.4 }); longH(35, 1, 9, 6, 4.5, { rg: 0.9, ov: 1.8, ri: 2 })
      ground(-39, 40, 1.5)
    },
    // 5: town hall with a clock tower, houses along the front
    () => {
      box(-2, -9, 10, 20, 4, 'spire', { sh: 11, cross: 1 }); ctx.save(); ctx.beginPath(); ctx.arc(-2, -22, 2.6, 0, 6.2832); ctx.fillStyle = PAPER; ctx.fill(); ctx.lineWidth = W(0.7); ctx.strokeStyle = INK; ctx.stroke(); sg(-2, -22, -2, -23.8); sg(-2, -22, -0.9, -21.6); flush(0.5); ctx.restore()
      longH(-20, -9, 17, 8, 5.5); longH(18, -9, 17, 8, 5.5); gable(-34, -7, 8, 6, 4.5, -4); gable(34, -6, 8, 6, 4.5, 4)
      gable(-24, 1, 10, 7, 6, -5, { chim: 0.5 }); gable(-8, 1, 10, 7, 6, 5, { smoke: 1, chim: 0.4 }); gable(9, 1, 10, 7, 6, 5); gable(26, 1, 10, 7, 6, 5, { chim: 0.5 })
      ground(-38, 38, 1.5)
    },
    // 6: round-towered church, houses tumbling away on the right
    () => {
      longH(-3, -9, 16, 8, 5.5); rtower(-14, -8, 8, 24, 'cone', { ch: 13, door: 0, slit: 1, flag: 0 }); cross(-14, -8 - 24 - 13, 4)
      gable(18, -9, 10, 7, 5.5, 5, { chim: 0.5 }); gable(32, -8, 9, 6, 5, 4); gable(-30, -7, 9, 6, 5, -4)
      gable(-24, 1, 11, 7, 6, -6, { chim: 0.4, smoke: 1 }); longH(-6, 1, 14, 7, 5); gable(10, 1, 10, 7, 6, 5, { chim: 0.5 }); gable(26, 1, 10, 7, 6, 5)
      ground(-37, 38, 1.5)
    },
    // 7: dense: seven roofs, a steeple and a fenced yard
    () => {
      box(-12, -11, 7, 20, 4, 'spire', { sh: 16, belfry: 1, cross: 1 }); longH(2, -11, 18, 8, 6)
      gable(-29, -10, 9, 7, 5, -5, { chim: 0.5 }); gable(20, -10, 9, 7, 5.5, 5, { chim: 0.4 }); gable(32, -9, 8, 7, 5, 4)
      gable(-24, -3, 10, 7, 5.5, -5, { chim: 0.4 }); gable(-9, -2, 9, 7, 5.5, 5); gable(7, -2, 10, 7, 6, 5, { smoke: 1, chim: 0.5 }); gable(25, -3, 10, 7, 5.5, 5)
      fence(-36, -20, 2, 3); gable(-9, 4, 8, 5, 4, 4, { nodoor: 1 }); fence(10, 38, 4.5, 3)
      ground(-39, 39, 5)
    },
  ], { sc: 1 })

  /* ================= VILLAGE: two or three cottages ================= */
  reg('village', 'Village', 'settlements', [
    // 0: two cottages with smoke and a haystack
    () => {
      gable(-12, -10, 16, 9, 8, -8, { chim: 0.6, smoke: 1, rg: 0.95 }); gable(14, -3, 15, 8, 7.5, 7, { chim: 0.5, rg: 0.95 }); rick(-27, -2, 9, 8); fence(26, 38, 0, 4)
      ground(-33, 38, 0.5)
    },
    // 1: three cottages stepping down
    () => {
      longH(-14, -12, 18, 8, 6.5, { ov: 1.6, ri: 1.5, rg: 0.95 }); gable(16, -9, 14, 8, 7, 6, { chim: 0.5, smoke: 1 }); gable(-4, 0, 15, 8, 7.5, 7, { chim: 0.4 })
      fence(-34, -22, 2, 4)
      ground(-30, 28, 1.5)
    },
    // 2: long cottage, barn and a fence
    () => {
      longH(-12, -3, 24, 9, 7, { ov: 1.8, ri: 2, rg: 0.95, door: 1 }); longH(21, 0, 15, 10, 7, { ov: 1.4, ri: 3, rg: 0.95, door: 0 })
      fence(-30, -22, 2, 4.5); rick(33, 3, 7, 6)
      ground(-26, 36, 3)
    },
    // 3: cottages round a well
    () => {
      gable(-20, -9, 14, 8, 7, -6, { chim: 0.5, smoke: 1 }); gable(18, -8, 14, 8, 7, 6, { chim: 0.4 }); gable(-4, 2, 13, 7, 6.5, 5); well(15, 3)
      ground(-28, 26, 2.5)
    },
    // 4: two cottages and a tiny chapel with a bell-cote
    () => {
      gable(-20, -7, 14, 8, 7, -6, { chim: 0.5, smoke: 1 }); longH(2, 0, 13, 7, 6, { ov: 1.4, ri: 1.2 })
      box(22, -3, 6, 12, 3, 'spire', { sh: 11, belfry: 1, cross: 1 }); longH(14, -2, 9, 6, 5)
      ground(-28, 28, 1)
    },
    // 5: longhouse, small cottage and a windmill on the rise
    () => {
      windmill(-20, -8, 28, { rot: 0.7 }); longH(8, -4, 20, 9, 7, { ov: 1.8, ri: 2, rg: 0.95 }); gable(28, 3, 12, 7, 6.5, 5, { chim: 0.5, smoke: 1 })
      ground(-26, 34, 3.5)
    },
    // 6: three cottages in a loose cluster
    () => {
      gable(-4, -10, 14, 8, 7, 6, { chim: 0.5 }); gable(-22, -3, 13, 7, 6.5, -6, { chim: 0.4, smoke: 1 }); gable(16, 0, 15, 8, 7.5, 7, { chim: 0.5 })
      fence(-8, 8, 6, 3.5)
      ground(-29, 28, 6.5)
    },
    // 7: a big cottage, a barn and a haystack, tree beside
    () => {
      tree(-27, -3, 22); gable(-8, -1, 16, 9, 8, 8, { chim: 0.6, smoke: 1, rg: 0.95 }); longH(20, 1, 15, 8, 6, { ov: 1.4, ri: 2.5 }); rick(34, 3, 7, 7)
      ground(-30, 38, 3)
    },
  ], { sc: [1.1, 1.15, 1.25, 1.2, 1.2, 0.9, 1.15, 1.15] })

  /* ================= helpers for castles, towers and ruins ================= */
  /** Crag: steep craggy sides, optional flat top (o.flat) to build on; cliff facets shaded with short vertical strokes. Returns the top y. */
  function rock(cx, by, w, h, o) {
    o = o || {}
    const n = o.n || 10, pts = [[cx - w / 2, by]], top = []
    for (let i = 0; i <= n; i++) {
      const t = i / n, prof = Math.min(1, 1.35 * Math.pow(sin(PI * (0.04 + t * 0.92)), 0.62)), edge = i === 0 || i === n
      const plateau = prof >= 1 && o.flat
      const y = by - h * (plateau ? 1 : Math.max(0.04, prof * (edge ? 0.5 : rr(0.84, 1.02))))
      const p = [cx - w / 2 + w * (0.015 + t * 0.97) + (edge || plateau ? 0 : j(w * 0.02)), y]
      top.push(p); pts.push(p)
    }
    pts.push([cx + w / 2, by])
    fill(pts)
    if (COL) wash(pts, T.rock, 0.5)
    // cliff facets: slanting dividers, with vertical strokes down the shaded side of each
    const gap = Math.max(1.5, 1.6 / k * 0.9)
    ctx.beginPath()
    for (let i = 1; i < n; i++) {
      const p = top[i], base = by - 1, x = p[0], y0 = p[1] + 0.8, len = (base - y0) * rr(0.5, 0.95)
      const x1 = x + rr(-1.5, 1.5)
      ctx.moveTo(x, y0); ctx.lineTo(x + (x1 - x) * 0.5 + j(0.5), y0 + len * 0.5); ctx.lineTo(x1, y0 + len)
      const nx = top[i + 1][0] - x, wd = Math.min(nx * 0.7, 4.5)
      for (let s_ = 1.1; s_ < wd; s_ += gap) { const ll = len * rr(0.3, 0.8) * (1 - s_ / (wd + 2)); ctx.moveTo(x + s_, y0 + 0.8 + s_ * 0.2); ctx.lineTo(x + s_ + j(0.2), y0 + 0.8 + ll) }
    }
    ctx.lineWidth = W(0.55); ctx.strokeStyle = INK; ctx.stroke()
    pen(top, 1.15, { open: true, taper: 0.55 })
    pen([top[0], pts[0]], 1, { open: true, taper: 0.3 })
    // right-hand slope: sparse diagonal shading
    const rp = pts.filter((q) => q[0] > cx + w * 0.3); rp.unshift([cx + w * 0.3, by - h * 0.5]); rp.push([cx + w * 0.3, by])
    hatch(rp, 2.1, 1.7, 0.45, { grow: 1.0, fade: 0.35, inset: 0.8 })
    sg(cx - w / 2 - 2, by + 0.3, cx + w / 2 + 3, by + 0.3); flush(0.7)
    return by - h
  }
  /** A row of pointed palisade stakes along y(x). */
  function stakes(x0, x1, yf, h) {
    for (let x = x0; x <= x1; x += 2.4) { const y = yf(x); sg(x, y, x, y - h); sg(x - 0.9, y - h + 1.3, x, y - h - 0.8); sg(x + 0.9, y - h + 1.3, x, y - h - 0.8) }
    flush(0.8)
  }
  function balcony(cx, y, w) { // railed ring around a tower
    fill([[cx - w / 2, y], [cx + w / 2, y], [cx + w / 2 - 1, y + 1.6], [cx - w / 2 + 1, y + 1.6]])
    pen([[cx - w / 2, y], [cx + w / 2, y], [cx + w / 2 - 1, y + 1.6], [cx - w / 2 + 1, y + 1.6]], 0.9)
    if (det >= 1) { for (let x = cx - w / 2 + 0.8; x <= cx + w / 2; x += 2) sg(x, y, x, y - 1.9); sg(cx - w / 2, y - 1.9, cx + w / 2, y - 1.9); flush(0.55) }
  }
  /** A beacon fire: a few inked tongues of flame and a wisp of smoke. */
  function fire(cx, y, h) {
    for (const [dx, sc] of [[-1.6, 0.7], [1.6, 0.75], [0, 1]]) {
      const x = cx + dx, hh = h * sc, f = [[x - 1.5 * sc, y], [x - 1.8 * sc, y - hh * 0.45], [x - 0.3 * sc, y - hh * 0.62], [x + 0.2 * sc, y - hh], [x + 1.1 * sc, y - hh * 0.55], [x + 1.9 * sc, y - hh * 0.4], [x + 1.5 * sc, y]]
      fill(f); pen(f, 0.8, { taper: 0.3 }); if (det >= 1) sg(x - 0.1, y - 0.5, x + 0.1, y - hh * 0.4)
    }
    flush(0.45)
    smoke(cx + 1, y - h - 0.5, 9)
  }

  /* ================= CASTLE: keep, towers, crenellations and a flag ================= */
  reg('castle', 'Castle', 'settlements', [
    // 0: classic: tall keep behind a gatehouse, drum towers at the corners
    () => {
      rtower(-15, -6, 9, 29, 'cone', { ch: 12, flag: 1 }); rtower(17, -6, 9, 25, 'cone', { ch: 11 })
      box(0, -8, 15, 30, 7, 'cren', { mh: 2.4, slits: 3, flag: 1 })
      wall(-34, 34, 0, 12)
      box(0, 1, 13, 20, 4, 'cren', { gate: 1, slits: 2 })
      rtower(-34, 1, 10, 23, 'cren'); rtower(34, 1, 10, 23, 'cren')
      ground(-41, 41, 1)
    },
    // 1: motte and bailey: timber keep on a mound behind a stake fence
    () => {
      mound(0, 0, 66, 17)
      const my = (x) => hillY(x, 0, 66, 17, 0)
      box(-3, -15, 15, 22, 5, 'cren', { mh: 2.8, slits: 2, flag: 1 }); rtower(21, my(21) + 1, 8, 19, 'cone', { ch: 9, door: 0 })
      stakes(-27, 14, (x) => my(x) + 3, 5); rtower(-27, my(-27) + 3, 7, 14, 'cren')
      ground(-36, 36, 1)
    },
    // 2: quadrangle castle: great square block with four drum towers
    () => {
      rtower(-8, -6, 8, 30, 'cone', { ch: 12 }); rtower(28, -6, 8, 30, 'cone', { ch: 12, flag: 1 })
      box(-4, 0, 34, 24, 10, 'cren', { mh: 2.6, slits: 4, gate: 0 })
      arch(-4, 0, 6, 8)
      rtower(-21, 1, 11, 33, 'cone', { ch: 13, door: 0, flag: 1 }); rtower(13, 1, 11, 33, 'cone', { ch: 13 })
      ground(-31, 36, 1.5)
    },
    // 3: crag castle: a donjon on a rock, curtain wall stepping down
    () => {
      rock(0, 0, 76, 24, { flat: 1, n: 12 })
      box(26, -23, 11, 18, 5, 'cren', { slits: 2 }); wall(-32, 2, -23, 9, { mh: 2 })
      rtower(-32, -22, 8, 16, 'cone', { ch: 9 }); rtower(6, -23, 14, 24, 'cone', { ch: 12, flag: 1, door: 0 })
      ground(-35, 35, 1, { noTufts: 1 })
    },
    // 4: concentric: low outer wall with a gatehouse, taller inner ward, keep on top
    () => {
      box(0, -14, 17, 28, 7, 'cren', { mh: 2.4, slits: 3, flag: 1 })
      rtower(-24, -10, 9, 25, 'cone', { ch: 11 }); rtower(24, -10, 9, 25, 'cone', { ch: 11, flag: 1 }); wall(-24, 24, -8, 13, { mh: 2 })
      wall(-37, 37, 0, 9, { mh: 2, gate: 0 })
      box(0, 1, 12, 17, 4, 'cren', { gate: 1 }); rtower(-37, 1, 9, 19, 'cren'); rtower(37, 1, 9, 19, 'cren'); rtower(-18, 0.5, 6, 14, 'cren'); rtower(18, 0.5, 6, 14, 'cren')
      ground(-43, 43, 1)
    },
    // 5: tall-towered hall: a pointed roof and slender cone-capped towers
    () => {
      rtower(-5, -7, 7, 38, 'cone', { ch: 15, flag: 1 }); rtower(14, -6, 7, 32, 'cone', { ch: 14 })
      longH(2, -1, 30, 14, 10, { ri: 4, ov: 1.5, rg: 1.1, door: 1 })
      rtower(-26, 1, 9, 30, 'cone', { ch: 14, door: 0, flag: 1 }); rtower(30, 1, 9, 26, 'cone', { ch: 12 }); box(-12, 1, 6, 22, 3, 'cren', { slits: 2 })
      ground(-35, 38, 1)
    },
    // 6: tower keep with a pyramid roof, turrets at its corners, low bailey
    () => {
      wall(-34, 34, 0, 9, { mh: 2 })
      rtower(-6, -4, 6, 26, 'cone', { ch: 10 }); rtower(26, -4, 6, 26, 'cone', { ch: 10 })
      box(0, -2, 24, 26, 9, 'hip', { sh: 14, flag: 1, slits: 3, door: 1 })
      rtower(-12, 1, 7, 33, 'cone', { ch: 10 }); rtower(12, 1, 7, 33, 'cone', { ch: 10 })
      rtower(-34, 1, 8, 17, 'cren'); rtower(34, 1, 8, 17, 'cren')
      ground(-40, 40, 1)
    },
    // 7: long fortress: three drum towers and a banner on the middle one
    () => {
      wall(-41, 41, 0, 13, { mh: 2.4 })
      box(-22, -1, 11, 21, 4, 'cren', { slits: 2 }); box(22, -1, 11, 21, 4, 'cren', { slits: 2 })
      rtower(0, 1, 15, 38, 'cone', { ch: 16, flag: 1, door: 1 })
      rtower(-41, 1, 10, 24, 'cone', { ch: 10 }); rtower(41, 1, 10, 24, 'cone', { ch: 10 })
      arch(-11, 0, 5, 7)
      ground(-47, 47, 1)
    },
  ], { sc: [1, 1.05, 1, 0.9, 1, 0.9, 1.05, 1] })

  /* ================= TOWER: a lone wizard's or watch tower ================= */
  reg('tower', 'Tower', 'settlements', [
    // 0: wizard's tower: tall, tapering, a broad leaning hat, a balcony
    () => {
      rock(0, 1, 30, 6, { n: 7 })
      rtower(0, -1, 14, 38, 'cone', { tp: 0.72, ch: 20, lean: 3, ewm: 1.55, slit: 0 })
      balcony(0, -22, 15); arch(-1, -3, 3, 5); blk(-2.4, -30, 1.4, 2.4); blk(2.5, -12, 1.2, 2.2)
      ground(-18, 18, 1)
    },
    // 1: watch tower: square, crenellated, on a mound, with a ladder
    () => {
      mound(0, 0, 44, 8)
      box(0, -4, 14, 38, 6, 'cren', { mh: 2.8, slits: 2, flag: 1, door: 1 })
      sg(-10, -2, -10, -22); sg(-8, -2, -8, -22); for (let y = -4; y > -22; y -= 2.6) sg(-10, y, -8, y); flush(0.6)
      ground(-24, 24, 1, { noTufts: 1 })
    },
    // 2: beacon tower: round with a brazier fire on top
    () => {
      rtower(0, 0, 15, 40, 'cren', { tp: 0.86, door: 1 })
      fire(0.5, -42, 9)
      ground(-14, 14, 1)
    },
    // 3: stacked tower: three drums, each narrower, a pointed cap with a crescent
    () => {
      rtower(0, 0, 18, 18, 'flat', { door: 1, tp: 0.95 }); rtower(0, -18, 13, 16, 'flat', { tp: 0.92 }); rtower(0, -34, 8.4, 12, 'cone', { ch: 16, tp: 0.9, ewm: 1.5 })
      ground(-17, 17, 1)
    },
    // 4: crag tower: a cone-capped tower on a rocky outcrop
    () => {
      rock(0, 1, 42, 24, { flat: 1, n: 11 })
      rtower(1, -22, 12, 24, 'cone', { ch: 12, door: 0, flag: 1 })
      ground(-22, 22, 1, { noTufts: 1 })
    },
    // 5: hermit's tower: a tall thin round tower with a lean-to hall
    () => {
      gable(-14, 0, 14, 8, 5.5, -5, { chim: 0.5, smoke: 1 })
      rtower(6, 0, 10, 46, 'cone', { ch: 14, tp: 0.84, door: 1, flag: 1 })
      blk(8.6, -30, 1.1, 2.4); blk(4, -38, 1.1, 2.4)
      ground(-22, 14, 1)
    },
    // 6: stair tower: a crenellated drum with a spiral stair climbing round it
    () => {
      rtower(0, 0, 16, 46, 'cren', { tp: 0.9, door: 1 })
      for (let i = 0; i < 5; i++) { const y = -6 - i * 8; sg(-6.5, y, 6.5, y - 4.4); sg(-6.5, y - 1, 6.5, y - 5.4) }
      flush(0.55)
      ground(-14, 14, 1)
    },
    // 7: observatory: a domed drum with a slit and a long glass
    () => {
      rtower(0, 0, 16, 28, 'dome', { dh: 10, tp: 0.92, door: 1, slit: 0 })
      sg(2, -39, 14, -49); sg(2.6, -37.8, 14.6, -47.8); flush(0.8); ctx.beginPath(); ctx.moveTo(1.6, -31.6); ctx.lineTo(1.6, -38.2); ctx.lineWidth = W(1.5); ctx.strokeStyle = INK; ctx.stroke()
      blk(-3, -14, 1.2, 2.6); blk(3, -20, 1.2, 2.6)
      ground(-14, 14, 1)
    },
  ], { sc: [0.95, 1.05, 0.95, 0.92, 0.92, 0.9, 1.1, 1.05] })

  /* ================= RUINS: broken walls and columns with rubble ================= */
  /** Wall fragment with a jagged broken top and a thin shaded end. win = x positions of arched windows. */
  function ruinWall(x0, x1, by, hL, hR, o) {
    o = o || {}
    const n = Math.max(2, Math.round((x1 - x0) / (o.step || 3.4))), top = []
    for (let i = 0; i <= n; i++) {
      const t = i / n, hh = (hL + (hR - hL) * t) * (i === 0 || i === n ? rr(0.9, 1.0) : (r() < 0.3 ? rr(0.42, 0.62) : rr(0.8, 1.04)))
      top.push([x0 + (x1 - x0) * t, by - hh])
    }
    const d = o.d == null ? 3 : o.d, ox = d, oy = -d * 0.42, TR = top[n], TRb = [TR[0] + ox, TR[1] + oy], BRb = [x1 + ox, by + oy]
    const sil = [[x0, by], ...top, TRb, BRb, [x1, by]], front = [[x0, by], ...top, [x1, by]], sideF = [[x1, by], BRb, TRb, TR]
    fill(sil)
    if (COL) { wash(front, T.rock, 0.3); wash(sideF, T.rock, 0.3) }
    hatch(sideF, 1.5, 1.3, 0.55, { grow: 1.08, inset: 0.3 })
    hatch([[x1 - (x1 - x0) * 0.16, by - 4], [x1, by - hR * 0.9], [x1, by], [x1 - (x1 - x0) * 0.16, by]], 1.5, 1.6, 0.45, { grow: 1.2, fade: 0.4 })
    pen(sil, 1.15)
    sg(x1, by, TR[0], TR[1]); flush(0.6)
    if (det >= 2) { courses(x0 + 0.5, x1 - 0.5, by - Math.max(hL, hR) * 0.95, by - 0.5, 3.1, 4.2); flush(0.4) }
    if (det >= 1 && x1 - x0 > 8) { // a crack running down from the break
      const t = top[1 + Math.floor(r() * (n - 1))], len = Math.min(hL, hR) * rr(0.4, 0.7)
      sg(t[0], t[1] + 1, t[0] + 1, t[1] + len * 0.35); sg(t[0] + 1, t[1] + len * 0.35, t[0] - 0.6, t[1] + len * 0.7); sg(t[0] - 0.6, t[1] + len * 0.7, t[0] + 0.5, t[1] + len); flush(0.5)
    }
    if (o.win) for (const wx of o.win) {
      const wb = by - (o.wy == null ? Math.min(hL, hR) * 0.28 : o.wy), ww = o.ww || 3.4, wh = o.wh || 10
      if (det >= 1) {
        ctx.beginPath(); ctx.moveTo(wx - ww / 2, wb); ctx.lineTo(wx - ww / 2, wb - wh * 0.62); ctx.quadraticCurveTo(wx - ww * 0.4, wb - wh * 0.88, wx, wb - wh); ctx.quadraticCurveTo(wx + ww * 0.4, wb - wh * 0.88, wx + ww / 2, wb - wh * 0.62); ctx.lineTo(wx + ww / 2, wb); ctx.closePath()
        ctx.fillStyle = INK; ctx.fill()
        if (det >= 2) { ctx.fillStyle = PAPER; ctx.fillRect(wx - 0.22, wb - wh * 0.72, 0.44, wh * 0.72) }
      }
    }
    if (o.door && det >= 1) arch(o.door, by, 3.2, 5.4)
  }
  function rubble(x0, x1, by, n, sz) {
    sz = sz || 1
    const items = []
    for (let i = 0; i < n; i++) items.push([rr(x0, x1), by + rr(-0.4, 2.2), rr(1.1, 2.6) * sz])
    items.sort((a, b) => a[1] - b[1])
    for (const [x, y, w] of items) {
      const p = [[x - w, y], [x - w * 0.8, y - w * 0.7], [x - w * 0.1, y - w * rr(0.9, 1.2)], [x + w * 0.7, y - w * 0.6], [x + w, y]]
      fill(p); pen(p, 0.8, { taper: 0.3, wob: 0.1 })
      if (det >= 1 && w > 1.7) sg(x + w * 0.2, y - w * 0.3, x + w * 0.85, y - 0.1)
    }
    flush(0.4)
    if (det >= 1) dots(Math.round((x1 - x0) / 5), x0, by + 0.5, x1, by + 2.8, 0.42)
  }
  /** Column: broken (jagged top, no capital) or whole. */
  function ruinCol(cx, by, w, h, brk) {
    const hw = w / 2, top = by - h
    fill([[cx - hw * 1.45, by], [cx - hw * 1.45, by - 1.6], [cx + hw * 1.45, by - 1.6], [cx + hw * 1.45, by]])
    const shaft = brk ? [[cx - hw, by - 1.6], [cx - hw, top + rr(0, 2)], [cx - hw * 0.2, top - rr(0, 1.8)], [cx + hw * 0.5, top + rr(0.5, 2.6)], [cx + hw, top + rr(0, 1.4)], [cx + hw, by - 1.6]] : [[cx - hw, by - 1.6], [cx - hw, top + 1.8], [cx + hw, top + 1.8], [cx + hw, by - 1.6]]
    fill(shaft); if (COL) wash(shaft, T.rock, 0.3)
    hatch([[cx + hw * 0.15, top - 2], [cx + hw, top - 2], [cx + hw, by - 1.6], [cx + hw * 0.15, by - 1.6]], 1.52, 1.25, 0.5, { grow: 1.1, fade: 0.5 })
    pen(shaft, 1.05, { taper: 0.4 })
    sg(cx - hw * 1.45, by - 1.6, cx + hw * 1.45, by - 1.6); sg(cx - hw * 1.45, by, cx + hw * 1.45, by); sg(cx - hw * 1.45, by - 1.6, cx - hw * 1.45, by); sg(cx + hw * 1.45, by - 1.6, cx + hw * 1.45, by)
    if (!brk) { fill([[cx - hw * 1.5, top + 1.8], [cx + hw * 1.5, top + 1.8], [cx + hw * 1.5, top], [cx - hw * 1.5, top]]); sg(cx - hw * 1.5, top, cx + hw * 1.5, top); sg(cx - hw * 1.5, top + 1.8, cx + hw * 1.5, top + 1.8); sg(cx - hw * 1.5, top, cx - hw * 1.5, top + 1.8); sg(cx + hw * 1.5, top, cx + hw * 1.5, top + 1.8) }
    if (det >= 1) sg(cx - hw * 0.35, by - 3, cx - hw * 0.35, top + (brk ? 3 : 4))
    flush(0.55)
  }
  function fallen(cx, by, len, w) { // column lying on its side, drum joints broken
    const hw = w / 2, x0 = cx - len / 2, x1 = cx + len / 2
    const b = [[x0, by - w], [x1, by - w * 0.95], [x1 + 0.4, by], [x0, by]]
    fill(b); if (COL) wash(b, T.rock, 0.3)
    hatch([[x0, by - w * 0.4], [x1, by - w * 0.4], [x1, by], [x0, by]], 0.02, 1.15, 0.5, { grow: 1.05 })
    pen(b, 1, { taper: 0.4 })
    ctx.beginPath(); ctx.ellipse(x0, by - hw, hw * 0.45, hw, 0, 0, 6.2832); ctx.fillStyle = PAPER; ctx.fill(); ctx.lineWidth = W(0.7); ctx.strokeStyle = INK; ctx.stroke()
    for (const f of [0.35, 0.72]) { const x = x0 + len * f; sg(x, by - w, x + 0.4, by) }
    flush(0.55)
  }
  /** Round tower stump with a broken top. */
  function stump(cx, by, w, h) {
    const hw = w / 2, th = hw * 0.92, top = by - h, bl = Math.min(2.2, w * 0.14), tp = []
    for (let i = 0; i <= 5; i++) tp.push([cx - th + 2 * th * i / 5, top + (i % 2 ? rr(0.2, 2.6) : rr(-2.8, -0.2)) + (i - 2.5) * 0.9])
    const arc = [[cx + hw * 0.7, by + bl * 0.72], [cx, by + bl], [cx - hw * 0.7, by + bl * 0.72]]
    const body = [...tp, [cx + hw, by], ...arc, [cx - hw, by]]
    fill(body); if (COL) wash(body, T.rock, 0.3)
    hatch([[cx + th * 0.05, top - 3], [cx + th, top - 3], [cx + hw, by + 0.3], [cx + hw * 0.05, by + 0.3]], 1.5, 1.45, 0.5, { grow: 1.16, inset: 0.4, fade: 0.55 })
    pen(body, 1.15)
    if (det >= 2) { courses(cx - hw * 0.8, cx + hw * 0.3, top + 2, by - 1, 3.2, 4); flush(0.4) }
    if (det >= 1) { arch(cx - hw * 0.1, by, 3, 5); sg(cx + hw * 0.3, top + 3, cx + hw * 0.1, top + 9); sg(cx + hw * 0.1, top + 9, cx + hw * 0.36, top + 14); flush(0.45) }
  }
  function lintel(x0, x1, y, h) { // a stone block lying across/at a height
    const b = [[x0, y - h], [x1, y - h * 0.9], [x1, y], [x0, y]]
    fill(b); hatch([[x0, y - h * 0.4], [x1, y - h * 0.4], [x1, y], [x0, y]], 0.02, 1.2, 0.5); pen(b, 1)
  }

  /** A broken stone arch: a ring segment with voussoir joints. */
  function archBand(cx, cy, ro, ri, a0, a1) {
    const out = [], inn = [], n = 9
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; out.push([cx + cos(a) * ro, cy + sin(a) * ro * 0.9]); inn.push([cx + cos(a) * ri, cy + sin(a) * ri * 0.9]) }
    const poly = out.concat(inn.reverse()); fill(poly)
    hatch(poly, 0.9, 1.6, 0.45, { inset: 0.2 })
    pen(poly, 1.1, { taper: 0.4 })
    for (let i = 1; i < n; i++) { const a = a0 + (a1 - a0) * i / n; sg(cx + cos(a) * ri, cy + sin(a) * ri * 0.9, cx + cos(a) * ro, cy + sin(a) * ro * 0.9) }
    flush(0.5)
  }

  reg('ruins', 'Ruins', 'landmarks', [
    // 0: gothic gable wall with its window, a low wall and two broken columns
    () => {
      ruinWall(-34, -16, 0, 11, 8, { d: 3 })
      ruinWall(-12, 10, 0, 36, 27, { d: 4, win: [-1], wy: 7, wh: 14, ww: 5, step: 4.2 })
      ruinCol(20, 0, 4.4, 24, 1); ruinCol(29, 0, 4.4, 12, 1)
      rubble(-36, 36, 1, 11)
      ground(-39, 36, 1.5)
    },
    // 1: round tower stump, a wall running off with an arch, rubble
    () => {
      ruinWall(-36, -14, 0, 9, 14, { d: 3, door: -25 })
      stump(0, 0, 17, 32)
      ruinWall(11, 28, 0, 14, 6, { d: 3 }); rubble(-14, 34, 1, 13)
      ground(-39, 36, 1.5)
    },
    // 2: colonnade: four columns, one fallen, a snapped beam
    () => {
      lintel(-33, -9, -24, 3.2)
      ruinCol(-30, 0, 4.2, 24); ruinCol(-12, 0, 4.2, 24); ruinCol(5, -1, 4.2, 14, 1); ruinCol(22, 1, 4.2, 8, 1)
      fallen(14, 5, 22, 4.4); rubble(-36, 34, 3, 9)
      ground(-39, 36, 4.5)
    },
    // 3: broken gate: two jagged piers and half an arch
    () => {
      ruinWall(-31, -17, 0, 27, 26, { d: 4, step: 4.5 }); ruinWall(17, 31, 0, 28, 13, { d: 4, step: 4.5 })
      archBand(0, -26, 17, 12, PI, 1.62 * PI)
      rubble(-34, 34, 1, 12); ground(-38, 36, 1.5)
    },
    // 4: foundations: knee-high walls, a lone column and tumbled stones
    () => {
      ruinWall(-34, -4, 0, 7, 9, { d: 3, step: 3.8 }); ruinWall(8, 30, -6, 8, 6, { d: 3 })
      ruinCol(-18, -9, 4.4, 26); ruinCol(30, 1, 4.4, 10, 1)
      rubble(-36, 34, 3, 12); lintel(2, 10, 3, 3)
      ground(-39, 36, 4.5)
    },
    // 5: chapel ruin: a nave wall with three tall windows, a gable end, buttresses
    () => {
      ruinWall(-36, 14, -3, 20, 18, { d: 3, win: [-26, -12, 2], wh: 12, wy: 6, ww: 3.6, step: 4.5 })
      ruinWall(14, 28, 3, 36, 30, { d: 4, win: [21], wy: 12, wh: 13, ww: 4.4, step: 4.6 })
      rubble(-36, 30, 3, 12)
      ground(-39, 34, 5)
    },
    // 6: tumbled keep: a square block with a collapsed corner and a fallen turret
    () => {
      ruinWall(-26, 6, 0, 22, 34, { d: 8, step: 4.6, door: -10 })
      stump(20, 3, 12, 18); fallen(-16, 6, 15, 5); rubble(-34, 30, 3, 14)
      ground(-37, 28, 5)
    },
    // 7: broken circle of pillars with a toppled lintel
    () => {
      ruinCol(-26, -5, 4.2, 21); ruinCol(-9, -8, 4.2, 15, 1); ruinCol(10, -8, 4.2, 25); ruinCol(26, -5, 4.2, 12, 1)
      lintel(8, 28, -26, 3)
      ruinCol(-17, 2, 4.4, 26); ruinCol(15, 3, 4.4, 9, 1); fallen(0, 6, 17, 4.6)
      rubble(-33, 33, 3, 9)
      ground(-36, 36, 6.5)
    },
  ], { sc: [1.1, 1.1, 1.15, 1.05, 1.1, 1.15, 1.1, 1.1] })

  /* ================= TEMPLE: domed or columned shrines ================= */
  function steps(cx, by, w, n, sh) { // stacked slabs, each narrower
    for (let i = 0; i < n; i++) {
      const ww = w - i * 4.2, y = by - i * sh, b = [[cx - ww / 2, y], [cx - ww / 2, y - sh], [cx + ww / 2, y - sh], [cx + ww / 2, y]]
      fill(b); if (COL) wash(b, T.rock, 0.28)
      hatch([[cx + ww * 0.36, y - sh], [cx + ww / 2, y - sh], [cx + ww / 2, y], [cx + ww * 0.36, y]], 1.5, 1.3, 0.45)
      pen(b, 1)
    }
  }
  /** Pagoda tier: a small lit body under a broad roof with upturned corners. */
  function tier(cx, by, bw, bh, rw, rh, o) {
    o = o || {}
    const top = by - bh, body = [[cx - bw / 2, by], [cx - bw / 2, top], [cx + bw / 2, top], [cx + bw / 2, by]]
    fill(body); hatch([[cx + bw * 0.28, top], [cx + bw / 2, top], [cx + bw / 2, by], [cx + bw * 0.28, by]], 1.5, 1.2, 0.5, { grow: 1.1 })
    pen(body, 1.05, { taper: 0.4 })
    if (det >= 1) { sg(cx - bw / 2, top + 1.4, cx - bw / 2, by); sg(cx + bw / 2 - 1.2, top + 1, cx + bw / 2 - 1.2, by); flush(0.5); if (bh > 5) arch(cx - bw * 0.04, by, Math.max(2, bw * 0.2), Math.min(bh * 0.7, 5)) }
    const roof = [[cx - rw, top - 1.6], [cx - rw * 0.3, top - rh], [cx + rw * 0.3, top - rh], [cx + rw, top - 1.6], [cx + rw * 0.86, top + 0.4], [cx + rw * 0.5, top + 0.9], [cx - rw * 0.5, top + 0.9], [cx - rw * 0.86, top + 0.4]]
    fill(roof); if (COL) wash(roof, T.roof, 0.5)
    hatch(roof, j(0.03), 0.95, 0.6, { inset: 0.5 })
    pen(roof, 1.1)
  }
  function spireFinial(cx, y, h) {
    sg(cx, y, cx, y - h); flush(0.8)
    for (let i = 1; i <= 4; i++) { const yy = y - h * (0.18 + i * 0.16), w = 2.2 - i * 0.4; sg(cx - w, yy, cx + w, yy) }
    flush(0.7); disc(cx, y - h - 0.8, 0.9)
  }

  reg('temple', 'Temple', 'landmarks', [
    // 0: tholos: a round colonnade under a ribbed dome
    () => {
      steps(0, 0, 48, 3, 1.6)
      columns(-19, 19, -4.8, 17, 6, { cw: 2.9 })
      dome(0, -21.8, 40, 3.6, 17, { noBody: 1, door: 0, fin: 4 })
      ground(-28, 28, 1)
    },
    // 1: pagoda: three tiers of upswept roofs on a stepped base
    () => {
      steps(0, 0, 30, 2, 1.6)
      tier(0, -3.2, 14, 9, 17, 6.5); tier(0, -18.5, 11, 7.5, 14, 5.5); tier(0, -31, 8, 6, 11, 5)
      spireFinial(0, -43.5, 11)
      ground(-23, 23, 1)
    },
    // 2: Greek temple: six columns, a pediment, steps, a long side roof
    () => {
      const sideF = [[19, -4.8], [34, -10], [34, -27], [19, -22]]
      fill(sideF); hatch(sideF, 1.5, 1.3, 0.55, { grow: 1.05 }); pen(sideF, 1)
      steps(-3, 0, 52, 3, 1.6)
      columns(-24, 18, -4.8, 17, 6, { cw: 3 })
      const arch_ = [[-26, -21.8], [20, -21.8], [20, -25.4], [-26, -25.4]]
      fill(arch_); hatch(arch_, 0.02, 1.3, 0.5); pen(arch_, 1.05)
      const ped = [[-27, -25.4], [-3, -36], [21, -25.4]]
      fill(ped); if (COL) wash(ped, T.rock, 0.28)
      hatch([[-3, -31], [21, -26.5], [21, -25.4], [-3, -25.4]], 0.02, 1.2, 0.5, { fade: 0.4 })
      pen(ped, 1.1)
      const rs = [[21, -25.4], [-3, -36], [8, -38.4], [34, -27]]
      fill(rs); if (COL) wash(rs, T.roof, 0.5)
      hatch(rs, Math.atan2(-2.4, 11), 1.1, 0.6, { inset: 0.3 }); pen(rs, 1)
      ground(-30, 36, 1)
    },
    // 3: domed shrine with a hall, small domes and a minaret
    () => {
      dome(-3, 0, 24, 14, 13, { door: 1, fin: 4 })
      dome(-22, 0, 10, 9, 6, { door: 0, fin: 2.5, onion: 1 }); dome(16, 0, 10, 9, 6, { door: 0, fin: 2.5, onion: 1 })
      rtower(26, 1, 5.4, 40, 'spire', { ch: 12, slit: 0 }); balcony(26, -29, 8)
      ground(-30, 31, 1)
    },
    // 4: stepped temple mount: stairs up to a shrine on the summit
    () => {
      box(0, 0, 50, 9, 9, 'flat', { sc: T.rock }); box(0, -9, 38, 9, 7, 'flat'); box(0, -18, 26, 9, 5, 'flat')
      ctx.save(); const st_ = [[-4.6, 0], [4.6, 0], [3.2, -27], [-3.2, -27]]
      fill(st_); pen(st_, 0.9); for (let y = -1.5; y > -27; y -= 1.7) sg(-4.6 + (-y) * 0.052, y, 4.6 - (-y) * 0.052, y); flush(0.5); ctx.restore()
      gable(0, -27, 12, 7, 5.5, 4, { door: 0, stone: 1 })
      ground(-30, 30, 1)
    },
    // 5: stupa: a terraced base, a white dome, a stacked spire
    () => {
      steps(0, 0, 40, 2, 2.2)
      const pts = []; for (let i = 0; i <= 14; i++) { const a = PI * (1 - i / 14); pts.push([cos(a) * 15, -4.4 - sin(a) * 15]) }
      fill(pts); if (COL) wash(pts, T.rock, 0.25)
      hatch(pts.filter((p) => p[0] > -1).concat([[-1, -4.4]]), 1.85, 1.3, 0.5, { grow: 1.06 })
      pen(pts, 1.15, { open: true, taper: 0.55 }); arch(0, -4.4, 4, 6.5)
      box(0, -19.4, 9, 5, 3, 'flat'); sg(0, -24.4, 0, -33); flush(0.9)
      for (let i = 0; i < 6; i++) { const y = -26 - i * 2.6, w = 5.4 - i * 0.7; const d = [[-w, y], [w, y], [w * 0.8, y - 1.3], [-w * 0.8, y - 1.3]]; fill(d); pen(d, 0.7, { taper: 0.2 }) }
      disc(0, -42, 1)
      ground(-26, 26, 1)
    },
    // 6: shrine pavilion with a gate: a sweeping roof, a torii in front
    () => {
      steps(8, 0, 36, 2, 1.5)
      const b = [[-5, -3], [21, -3], [21, -13], [-5, -13]]
      fill(b); hatch([[15, -13], [21, -13], [21, -3], [15, -3]], 1.5, 1.2, 0.55, { grow: 1.1 })
      pen(b, 1.1); for (const x of [-3, 4, 11, 18]) sg(x, -13, x, -3); flush(0.6); arch(8, -3, 5, 8)
      const roof = [[-12, -12], [-3, -21], [19, -21], [28, -12], [25, -10], [20, -12.6], [-2, -12.6], [-9, -10]]
      fill(roof); if (COL) wash(roof, T.roof, 0.5); hatch(roof, j(0.02), 0.95, 0.6, { inset: 0.4 }); pen(roof, 1.2)
      // torii gate
      const px = [-26, -14]
      for (const x of px) { const p = [[x - 1.3, 0], [x - 1.3, -27], [x + 1.3, -27], [x + 1.3, 0]]; fill(p); hatch(p, 1.5, 0.85, 0.7, { inset: 0.1 }); pen(p, 0.9) }
      const kasa = [[-30, -27], [-10, -27], [-8, -29.4], [-32, -29.4]]; fill(kasa); hatch(kasa, 0.02, 0.8, 0.7, { inset: 0.1 }); pen(kasa, 1)
      const nuki = [[-27.5, -20], [-12.5, -20], [-12.5, -22.2], [-27.5, -22.2]]; fill(nuki); hatch(nuki, 0.02, 0.8, 0.7, { inset: 0.1 }); pen(nuki, 0.9)
      ground(-31, 31, 1)
    },
    // 7: pylon temple: two sloping gateway towers, a doorway and two obelisks
    () => {
      for (const [x0, x1] of [[-27, -6], [6, 27]]) {
        const py = [[x0, 0], [x0 + 2, -34], [x1 - 2, -34], [x1, 0]]
        fill(py); if (COL) wash(py, T.sand, 0.5)
        hatch([[(x0 + x1) / 2 + 2, -34], [x1 - 2, -34], [x1, 0], [(x0 + x1) / 2 + 2, 0]], 1.5, 1.3, 0.55, { grow: 1.08, fade: 0.4 })
        pen(py, 1.2)
        const cor = [[x0 + 0.5, -34], [x1 - 0.5, -34], [x1 - 0.5, -37], [x0 + 0.5, -37]]; fill(cor); hatch(cor, 0.02, 1.2, 0.5); pen(cor, 1)
        sg(x0 + 5, -33, x0 + 5, -7); sg(x1 - 5, -33, x1 - 5, -7); flush(0.5)
        if (det >= 1) { sg(x0 + 5, -30, x0 + 5, -27); blk((x0 + x1) / 2, -14, 2, 5) }
      }
      sg(-6, -24, 6, -24); flush(0.5); fill([[-6, 0], [-6, -20], [6, -20], [6, 0]]); arch(0, 0, 8, 14); sg(-6, -20, 6, -20); sg(-6, -22.5, 6, -22.5); flush(0.7)
      for (const x of [-33, 33]) { const ob = [[x - 2.2, 0], [x - 1.2, -42], [x, -46], [x + 1.2, -42], [x + 2.2, 0]]; fill(ob); hatch([[x + 0.3, -46], [x + 1.2, -42], [x + 2.2, 0], [x + 0.3, 0]], 1.52, 1.1, 0.5, { fade: 0.5 }); pen(ob, 1) }
      ground(-37, 37, 1)
    },
  ], { sc: [1.1, 0.9, 1.2, 1.05, 1.1, 1.1, 1.35, 1.0] })

  /* ================= STANDING STONES: rings, rows, trilithons ================= */
  function slab(cx, by, w, h) { // a fallen or flat stone lying on the ground
    const p = [[cx - w / 2, by], [cx - w * 0.46, by - h * 0.8], [cx - w * 0.1, by - h], [cx + w * 0.35, by - h * 0.9], [cx + w / 2, by - h * 0.3], [cx + w * 0.5, by]]
    fill(p); if (COL) wash(p, T.rock, 0.38)
    hatch([[cx, by - h], [cx + w * 0.5, by - h * 0.3], [cx + w * 0.5, by], [cx, by]], 1.9, 1.2, 0.5, { fade: 0.4 })
    pen(p, 1.1, { taper: 0.5 })
    if (det >= 1) { tuft(cx + w * 0.55, by + 0.2); flush(0.5) }
  }
  /** Stones round an ellipse, back ones smaller and higher, drawn back to front. */
  function ring(cx, cy, rx, ry, n, w, h, a0, o) {
    o = o || {}
    const st_ = []
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * 2 * PI, sy = sin(a), depth = (sy + 1) / 2, sc = 0.72 + 0.34 * depth
      if (o.gap != null && Math.abs(((a % (2 * PI)) + 2 * PI) % (2 * PI) - o.gap) < 0.35) continue
      st_.push({ x: cx + cos(a) * rx, y: cy + sy * ry, sc, i })
    }
    st_.sort((a, b) => a.y - b.y)
    for (const s_ of st_) {
      const hh = h * s_.sc * rr(0.82, 1.12) * (o.var ? (s_.i % 3 === 0 ? 1.25 : s_.i % 3 === 1 ? 0.85 : 1) : 1)
      menhir(s_.x, s_.y, w * s_.sc * rr(0.9, 1.1), hh, { lean: rr(-0.8, 0.8), flat: s_.i % 4 === 1 })
    }
    return st_
  }

  reg('standing-stones', 'Standing stones', 'landmarks', [
    // 0: a ring of nine
    () => {
      ring(0, -8, 24, 6, 9, 7.5, 19, 0.4)
      ground(-31, 31, 0, { noTufts: 1 })
    },
    // 1: Stonehenge: an outer ring with capstones and a trilithon
    () => {
      menhir(-20, -6, 6.5, 19); menhir(-9, -11, 6, 19); lintel(-23, -6, -24.4, 3)
      menhir(4, -12, 6, 18); menhir(16, -7, 6.5, 19); lintel(1, 19, -25.8, 3)
      menhir(-14, 0, 7.5, 22, { flat: 1 }); menhir(-3, 2, 7.5, 23, { flat: 1 }); lintel(-18, 0, -22.5, 3.4)
      menhir(9, 2, 7.5, 21); menhir(20, 0, 6.5, 17)
      ground(-29, 28, 2, { noTufts: 1 })
    },
    // 2: an avenue of stones marching back to a tall one
    () => {
      menhir(21, -14, 4, 13); menhir(15, -10, 4.4, 14); menhir(8, -6, 5, 15.5); menhir(0, -2, 5.8, 17.5); menhir(-9, 3, 6.8, 20.5); menhir(-21, 8, 8, 24)
      slab(28, -13, 8, 3.4); slab(4, 8, 8, 3.6)
      ground(-30, 31, 8, { noTufts: 1 })
    },
    // 3: three great stones leaning together, small ones fallen
    () => {
      menhir(-12, -3, 8.5, 32, { lean: 1.6 }); menhir(2, -1, 9.5, 38, { lean: -0.5 }); menhir(15, -2, 7.5, 28, { lean: -1.5 })
      slab(-24, 3, 11, 4.6); slab(25, 4, 9, 4); menhir(-4, 5, 5.6, 11)
      ground(-30, 30, 5, { noTufts: 1 })
    },
    // 4: a ring round an altar stone
    () => {
      ring(0, -8, 22, 6, 8, 6.5, 17, 0.2)
      menhir(-4, -4, 5.6, 12); menhir(4, -4, 5.6, 12); lintel(-7.5, 7.5, -15.4, 3)
      slab(0, 4, 13, 4.6)
      ground(-29, 29, 4, { noTufts: 1 })
    },
    // 5: a long alignment of seven stones, tall in the middle
    () => {
      const hs = [12, 17, 23, 31, 23, 18, 13]
      for (let i = 0; i < 7; i++) menhir(-28 + i * 9.3, -1 + (i % 2) * 2.4, 5.2 + hs[i] * 0.08, hs[i])
      ground(-33, 33, 2, { noTufts: 1 })
    },
    // 6: a lone trilithon among small stones
    () => {
      menhir(-27, 3, 5, 10); menhir(-21, 0, 5, 8); menhir(26, 2, 5.4, 11); menhir(20, -2, 5, 8)
      menhir(-9, -2, 7.5, 34, { flat: 1 }); menhir(9, -2, 7.5, 34, { flat: 1 }); lintel(-13, 13, -36, 4.2)
      slab(0, 5, 10, 3.8)
      ground(-32, 32, 3.5, { noTufts: 1 })
    },
    // 7: a ring of small stones round a tall central menhir
    () => {
      ring(0, -8, 24, 6, 11, 5, 12, 0.1)
      menhir(0, -1, 8, 40, { lean: 0.8 })
      ground(-30, 30, 0, { noTufts: 1 })
    },
  ], { sc: [1.4, 1.4, 1.35, 1.2, 1.4, 1.3, 1.2, 1.2] })

  /* ================= PORT: houses, a jetty and a boat ================= */
  function ripples(x0, x1, y, n, len) { // short wavy sea marks, one batched path
    len = len || 6
    ctx.beginPath()
    for (let i = 0; i < n; i++) {
      const x = rr(x0, x1 - len), yy = y + rr(-1, 1) + (i % 2) * 2.4, q = len / 4
      ctx.moveTo(x, yy); ctx.quadraticCurveTo(x + q * 0.5, yy - 1.5, x + q, yy); ctx.quadraticCurveTo(x + q * 1.5, yy + 1.4, x + q * 2, yy); ctx.quadraticCurveTo(x + q * 2.5, yy - 1.5, x + q * 3, yy); ctx.quadraticCurveTo(x + q * 3.5, yy + 1.4, x + len, yy)
    }
    ctx.lineWidth = W(0.55); ctx.strokeStyle = INK; ctx.stroke()
  }
  function jetty(x0, x1, y) {
    const deck = [[x0, y - 1.2], [x1, y + 0.4], [x1, y + 2.6], [x0, y + 1]]
    for (let x = x0 + 3; x < x1; x += 5.5) { const yy = y + 1 + (x - x0) / (x1 - x0) * 1.6; sg(x, yy + 1.4, x + j(0.2), yy + 6.2); sg(x + 1.3, yy + 1.4, x + 1.3, yy + 5.6) }
    flush(0.9)
    fill(deck); pen(deck, 0.95, { taper: 0.3 })
    for (let x = x0 + 2; x < x1 - 1; x += 2.1) { const t = (x - x0) / (x1 - x0), yt = y - 1.2 + t * 1.6; sg(x, yt, x + 0.2, yt + 2.2) }
    flush(0.45)
    for (let x = x0 + 3; x < x1; x += 5.5) { const yy = y + 1 + (x - x0) / (x1 - x0) * 1.6; sg(x - 1.4, yy + 5.9, x + 2.8, yy + 5.9) }
    flush(0.45)
  }
  /** Boat at the waterline wy. kind: row | sail | cog | long | dhow | fish */
  function boat(cx, wy, len, kind) {
    const hl = len / 2
    let hull
    if (kind === 'long') hull = [[cx - hl, wy - 4.2], [cx - hl * 0.6, wy - 0.6], [cx + hl * 0.6, wy - 0.6], [cx + hl, wy - 4.6], [cx + hl * 0.55, wy - 2.2], [cx - hl * 0.55, wy - 2.2]]
    else if (kind === 'cog') hull = [[cx - hl, wy - 5], [cx - hl * 0.85, wy - 0.6], [cx + hl * 0.85, wy - 0.6], [cx + hl, wy - 4.6], [cx + hl * 0.5, wy - 3.6], [cx - hl * 0.5, wy - 3.6]]
    else hull = [[cx - hl, wy - 3.6], [cx - hl * 0.7, wy - 0.5], [cx + hl * 0.7, wy - 0.5], [cx + hl, wy - 3.2], [cx + hl * 0.5, wy - 2.6], [cx - hl * 0.5, wy - 2.8]]
    // masts and sails behind the hull
    if (kind === 'sail' || kind === 'fish') {
      const mh = len * 0.95
      sg(cx + 0.2, wy - 2, cx + 0.2, wy - mh); flush(0.8)
      const sl = [[cx + 0.7, wy - mh + 0.8], [cx + 0.7, wy - 3.2], [cx + hl * 0.8, wy - 3.4]]
      fill(sl); if (COL) wash(sl, T.snow, 0.5)
      hatch(sl, 1.5, 1.7, 0.4, { grow: 1.1, fade: 0.5 }); pen(sl, 0.8, { taper: 0.3 })
      const jb = [[cx - 0.3, wy - mh * 0.78], [cx - 0.3, wy - 3.2], [cx - hl * 0.72, wy - 3.2]]
      fill(jb); pen(jb, 0.7, { taper: 0.3 })
    } else if (kind === 'cog') {
      const mh = len * 0.9, yard = [[cx - hl * 0.55, wy - mh * 0.9], [cx + hl * 0.55, wy - mh * 0.9], [cx + hl * 0.5, wy - mh * 0.42], [cx - hl * 0.5, wy - mh * 0.42]]
      sg(cx, wy - 3, cx, wy - mh - 1); flush(0.9)
      fill(yard); if (COL) wash(yard, T.snow, 0.5); hatch(yard, 1.5, 1.7, 0.4, { grow: 1.1 }); pen(yard, 0.9, { taper: 0.3 })
      sg(cx - hl * 0.62, wy - mh * 0.9, cx + hl * 0.62, wy - mh * 0.9); flush(0.7)
      const fc = [[cx + hl * 0.5, wy - 4.2], [cx + hl * 0.5, wy - 7.6], [cx + hl * 0.98, wy - 7.6], [cx + hl, wy - 4.4]]; fill(fc); pen(fc, 0.7)
    } else if (kind === 'long') {
      const mh = len * 0.72, yard = [[cx - hl * 0.5, wy - mh], [cx + hl * 0.5, wy - mh], [cx + hl * 0.46, wy - mh * 0.34], [cx - hl * 0.46, wy - mh * 0.34]]
      sg(cx, wy - 2.2, cx, wy - mh - 1); flush(0.9)
      fill(yard); hatch(yard, 1.5, 1.9, 0.5, { inset: 0.1 }); pen(yard, 0.9, { taper: 0.3 })
    } else if (kind === 'dhow') {
      const mh = len * 1.05, sl = [[cx - hl * 0.8, wy - 3.4], [cx + hl * 0.55, wy - mh], [cx + hl * 0.1, wy - 3.2]]
      fill(sl); if (COL) wash(sl, T.snow, 0.5); hatch(sl, 1.4, 1.6, 0.4, { grow: 1.1 }); pen(sl, 0.8, { taper: 0.3 })
    }
    fill(hull); if (COL) wash(hull, T.land, 0.35)
    hatch(hull.slice(1, 4), 0.1, 1.2, 0.5, { grow: 1.0 })
    pen(hull, 0.95, { taper: 0.4 })
    if (kind === 'row' || kind === 'fish') { sg(cx - hl * 0.2, wy - 3, cx - hl * 0.9, wy + 1.5); sg(cx + hl * 0.2, wy - 3, cx + hl * 0.9, wy + 1.6); flush(0.5) }
    if (kind === 'long') { sg(cx - hl, wy - 4.2, cx - hl - 1.6, wy - 7); sg(cx - hl - 1.6, wy - 7, cx - hl - 0.4, wy - 8); flush(0.8); for (let i = 0; i < 5; i++) disc(cx - hl * 0.5 + i * hl * 0.25, wy - 1.7, 0.6) }
    ripples(cx - hl - 3, cx + hl + 4, wy + 1.8, 2, Math.max(4, len * 0.35))
  }
  function lighthouse(cx, by, h) {
    const bw = 10, tw = 6, top = by - h
    const body = [[cx - tw / 2, top], [cx + tw / 2, top], [cx + bw / 2, by], [cx - bw / 2, by]]
    fill(body); if (COL) wash(body, T.snow, 0.5)
    hatch([[cx + tw * 0.1, top], [cx + tw / 2, top], [cx + bw / 2, by], [cx + bw * 0.1, by]], 1.52, 1.3, 0.55, { grow: 1.1, fade: 0.5 })
    for (const f of [0.25, 0.55]) { const y = by - h * f, t = f, w = bw - (bw - tw) * t; if (det >= 1) { sg(cx - w / 2 + 0.3, y, cx + w / 2 - 0.3, y) } }
    flush(0.45)
    pen([[cx - tw / 2, top], [cx - bw / 2, by], [cx + bw / 2, by], [cx + tw / 2, top]], 1.15, { open: true })
    const lamp = [[cx - 3.2, top], [cx - 3.2, top - 4.6], [cx + 3.2, top - 4.6], [cx + 3.2, top]]
    fill(lamp); hatch([[cx, top - 4.6], [cx + 3.2, top - 4.6], [cx + 3.2, top], [cx, top]], 1.5, 1.1, 0.5); pen(lamp, 0.95)
    for (const x of [-1.6, 0, 1.6]) sg(cx + x, top - 0.6, cx + x, top - 4.2); flush(0.4)
    const cap = [[cx - 4, top - 4.6], [cx, top - 9], [cx + 4, top - 4.6]]; fill(cap); hatch(cap, 1.1, 1.0, 0.55); pen(cap, 1)
    if (det >= 1) { sg(cx, top - 9, cx, top - 11.5); flush(0.8); sg(cx - 5.5, top - 2.3, cx - 9, top - 3.4); sg(cx - 5.5, top - 3.6, cx - 9.4, top - 5.2); sg(cx - 5.5, top - 1, cx - 8.6, top - 1.6); flush(0.4) }
    arch(cx, by, 2.4, 4.2)
  }
  function crane(cx, by, h) { // wooden harbour crane
    const bx = [[cx - 2, by], [cx - 2, by - h], [cx + 2, by - h], [cx + 2, by]]
    fill(bx); pen(bx, 0.9); sg(cx - 2, by, cx + 2, by - h); sg(cx + 2, by, cx - 2, by - h); flush(0.5)
    sg(cx, by - h, cx + 15, by - h + 5); sg(cx + 15, by - h + 5, cx + 15, by - h + 12); sg(cx - 6, by - h - 1.4, cx + 7, by - h + 2.2); sg(cx, by - h, cx + 8, by - h + 2.6); flush(0.8)
    rbox(cx + 15, by - h + 15, 2.4, 3)
  }
  function rbox(cx, by, w, h) { const b = [[cx - w, by], [cx - w, by - h], [cx + w, by - h], [cx + w, by]]; fill(b); sg(cx - w, by - h * 0.5, cx + w, by - h * 0.5); sg(cx, by - h, cx, by); pen(b, 0.7); flush(0.4) }
  function sea(x0, x1, y0, rows, n) { for (let i = 0; i < rows; i++) ripples(x0 + (i % 2) * 4, x1, y0 + i * 3.6, n, rr(4.5, 8)) }

  reg('port', 'Port', 'settlements', [
    // 0: houses on the quay, a jetty running out and a rowing boat
    () => {
      gable(-27, -8, 10, 7, 5.5, -5, { chim: 0.5 }); longH(-8, -7, 15, 7, 5); gable(-31, 1, 9, 6, 5, -4, { chim: 0.4 }); gable(-16, 2, 10, 7, 5.5, -5); gable(2, 1, 9, 6, 5, 4)
      ground(-36, 8, 3, { noTufts: 0 })
      sea(8, 40, 4, 3, 2)
      jetty(5, 33, 0); boat(29, 7.5, 12, 'row')
    },
    // 1: warehouse, crane and a one-sail boat tied up
    () => {
      longH(-18, -8, 22, 9, 6, { ri: 3, door: 1 }); gable(-34, 1, 9, 6, 5, -4); gable(-5, 1, 10, 7, 5.5, 5, { chim: 0.4 })
      crane(7, 3, 20)
      ground(-39, 12, 4)
      sea(10, 42, 6, 3, 2)
      jetty(6, 30, 2); boat(26, 8, 22, 'sail')
    },
    // 2: longship at the jetty and thatched houses
    () => {
      longH(-26, -8, 15, 7, 5.5, { rg: 0.9, ov: 1.8, ri: 2 }); gable(-8, -7, 10, 7, 6, 5, { smoke: 1, chim: 0.5 }); longH(-30, 2, 12, 6, 4.5, { rg: 0.9, ov: 1.8, ri: 2 }); gable(-14, 3, 10, 7, 5.5, -5)
      ground(-37, 4, 4)
      sea(5, 42, 7, 3, 2)
      jetty(1, 18, 2); boat(26, 11, 30, 'long')
    },
    // 3: lighthouse on a rock, a few houses and a fishing boat
    () => {
      rock(-27, 2, 18, 8); lighthouse(-27, -4, 30)
      gable(-8, -6, 10, 7, 5.5, 5, { chim: 0.5, smoke: 1 }); longH(10, -5, 13, 6, 5); gable(-1, 3, 9, 6, 5, 4)
      ground(-36, 18, 4, { noTufts: 1 })
      sea(20, 42, 7, 3, 2)
      jetty(16, 31, 3); boat(34, 11, 14, 'fish')
    },
    // 4: harbour with two jetties and three boats
    () => {
      gable(-26, -7, 10, 7, 5.5, -5, { chim: 0.5 }); gable(-10, -7, 10, 7, 5.5, 5); gable(-30, 2, 9, 6, 5, -4); longH(-15, 2, 13, 6, 5)
      ground(-36, 0, 3)
      sea(4, 42, 3, 4, 2)
      jetty(0, 22, 0); boat(32, 5, 11, 'row'); boat(15, 13, 13, 'fish')
    },
    // 5: a cog at anchor off the quay, customs house with a tower
    () => {
      box(-25, -6, 8, 22, 4, 'hip', { sh: 8, flag: 1, belfry: 1 }); longH(-8, -6, 15, 8, 5.5); gable(-33, 2, 9, 6, 5, -4); gable(-14, 3, 10, 7, 5.5, -5, { chim: 0.5 })
      ground(-38, 0, 4)
      sea(3, 42, 5, 3, 2)
      jetty(0, 15, 2); boat(26, 9, 26, 'cog')
    },
    // 6: southern quay: flat roofs and a dhow with a slanting sail
    () => {
      box(-30, -5, 9, 12, 4, 'flat', { slits: 2 }); dome(-14, -5, 11, 9, 7, { door: 0, fin: 2.5, onion: 1 }); box(0, -5, 8, 11, 3, 'flat')
      box(-23, 3, 9, 9, 4, 'flat', { door: 1 }); box(-8, 3, 9, 10, 4, 'flat', { slits: 2 })
      ground(-36, 6, 4)
      sea(8, 42, 4, 3, 2)
      jetty(5, 22, 2); boat(30, 11, 24, 'dhow')
    },
    // 7: harbour wall: a round tower at the mouth, boats inside
    () => {
      gable(-30, -8, 10, 7, 5.5, -5, { chim: 0.5 }); longH(-12, -7, 15, 7, 5); gable(-22, 2, 10, 7, 5.5, -5, { chim: 0.4 })
      wall(-6, 16, 3, 7, { mh: 1.8 }); rtower(18, 4, 9, 22, 'cone', { ch: 9, door: 1, flag: 1 })
      ground(-36, 22, 4.5)
      sea(24, 42, 9, 3, 2)
      jetty(23, 40, 6); boat(34, 14, 14, 'sail')
    },
  ], { sc: 1.05, dy: -8 })

  /* ================= CITY-DOT: top-view map symbols (Wheel of Time rings, Malazan diamonds) ================= */
  function dotInit(c, x, y, s, rg, style) {
    ctx = c; r = rg; st = style; k = 1; det = s >= 14 ? 2 : s >= 9 ? 1 : 0
    INK = st.ink; PAPER = st.paper; COL = st.mode === 'colour'; T = st.tint
    wl = st.line * Math.min(1.35, Math.max(0.8, s / 14)) // pen width follows the symbol size
    ctx.save(); ctx.translate(x, y); ctx.lineJoin = 'round'; ctx.lineCap = 'round'
  }
  /** A hand-drawn ring: the pen overshoots and the ends overlap slightly, so it never looks like a perfect arc. */
  function penRing(rad, w, a0) {
    const pts = [], n = Math.max(10, Math.round(rad * 3.2)), over = 0.32
    for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * (2 * PI + over), q = rad * (1 + j(0.025) + (i / n) * 0.035); pts.push([cos(a) * q, sin(a) * q]) }
    A.inkStroke(ctx, pts, r, { w: w, wob: 0.0, taper: 0.55, color: INK })
  }
  function discPath(rad) { ctx.beginPath(); ctx.arc(0, 0, rad, 0, 6.2832) }
  function penPoly(pts, w, fillInk) {
    const q = pts.map((p) => [p[0] + j(0.14), p[1] + j(0.14)])
    if (fillInk) { path(q); ctx.fillStyle = INK; ctx.fill() } else { path(q); ctx.fillStyle = PAPER; ctx.fill() }
    A.inkStroke(ctx, q.concat([q[0], q[1]]), r, { w: w, wob: 0.05, taper: 0.4, color: INK })
  }
  function tintDisc(rad, col, a) { if (COL) { ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = col; discPath(rad); ctx.fill(); ctx.restore() } }
  const dotFns = [
    // 0: ring with a centre dot (town)
    (R_, w) => { discPath(R_ * 0.78); ctx.fillStyle = PAPER; ctx.fill(); tintDisc(R_ * 0.78, T.roof, 0.28); penRing(R_ * 0.78, w, rr(0, 6)); disc(0, 0, Math.max(0.9, R_ * 0.26)) },
    // 1: double ring with a centre dot (capital)
    (R_, w) => { discPath(R_ * 0.96); ctx.fillStyle = PAPER; ctx.fill(); tintDisc(R_ * 0.62, T.roof, 0.3); penRing(R_ * 0.96, w, rr(0, 6)); penRing(R_ * 0.62, w, rr(0, 6)); disc(0, 0, Math.max(0.9, R_ * 0.2)) },
    // 2: dark city block (as on the Genabackis map): an irregular black mass cut by two pale streets
    (R_, w) => {
      const q = R_ * 0.74
      penPoly([[-q, -q * 0.82], [-q * 0.15, -q], [q * 0.9, -q * 0.9], [q, q * 0.1], [q * 0.7, q], [-q * 0.45, q * 0.95], [-q, q * 0.3]], w, true)
      if (det >= 1) { ctx.strokeStyle = PAPER; ctx.lineWidth = Math.max(0.5, w * 0.5); ctx.beginPath(); ctx.moveTo(-q * 0.2, -q * 0.85); ctx.lineTo(q * 0.15, q * 0.8); ctx.moveTo(-q * 0.8, q * 0.05); ctx.lineTo(q * 0.8, -q * 0.2); ctx.stroke() }
    },
    // 3: solid dot with a ring round it (large settlement)
    (R_, w) => { discPath(R_ * 0.92); ctx.fillStyle = PAPER; ctx.fill(); tintDisc(R_ * 0.92, T.roof, 0.28); penRing(R_ * 0.92, w, rr(0, 6)); disc(0, 0, R_ * 0.5) },
    // 4: plain solid dot (village)
    (R_, w) => { disc(0, 0, Math.max(1.5, R_ * 0.5)); if (R_ > 6) penRing(Math.max(1.5, R_ * 0.5), w * 0.6, rr(0, 6)) },
    // 5: black diamond (Malazan style)
    (R_, w) => { const q = R_ * 0.8; penPoly([[0, -q * 1.08], [q * 0.82, 0], [0, q * 1.08], [-q * 0.82, 0]], w, true) },
    // 6: ring with four spokes (walled city)
    (R_, w) => {
      discPath(R_ * 0.6); ctx.fillStyle = PAPER; ctx.fill(); tintDisc(R_ * 0.6, T.roof, 0.3); penRing(R_ * 0.6, w, rr(0, 6))
      for (let i = 0; i < 4; i++) { const a = i * PI / 2 + PI / 4; sg(cos(a) * R_ * 0.64, sin(a) * R_ * 0.64, cos(a) * R_ * 0.98, sin(a) * R_ * 0.98) }
      flush(w / wl * 0.95); disc(0, 0, Math.max(0.9, R_ * 0.18))
    },
    // 7: square outline with a centre dot (castle)
    (R_, w) => { const q = R_ * 0.72; penPoly([[-q, -q], [q, -q * 0.98], [q * 1.02, q], [-q, q * 1.02]], w, false); disc(0, 0, Math.max(0.9, R_ * 0.2)); if (det >= 1) { sg(-q, -q, -q, -q - R_ * 0.18); sg(q, -q, q, -q - R_ * 0.18); flush(w / wl * 0.9) } },
  ]
  A.register('city-dot', {
    label: 'City dot', category: 'symbols', kind: 'fixed', view: 'top', variants: 8,
    draw(c, x, y, s, rg, style, v) {
      dotInit(c, x, y, s, rg, style)
      dotFns[(v | 0) & 7](s / 2, Math.max(0.75, Math.min(2.2, s * 0.062)) * st.line)
      ctx.restore()
    },
  })
})(window.Atlas)
