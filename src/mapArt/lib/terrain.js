/* Map-level drawing: parchment, coastlines with ripples and stipple, rivers, roads, borders, labels, frame. */
;(function (A) {
  const { R } = A
  A.terrain = {}
  const T = A.terrain

  /** Midpoint-displace a closed (or open) polyline into a ragged coast. */
  T.fractal = (pts, r, depth = 5, rough = 0.32, closed = true) => {
    let p = pts.slice()
    for (let d = 0; d < depth; d++) {
      const out = [], n = closed ? p.length : p.length - 1
      for (let i = 0; i < n; i++) {
        const a = p[i], b = p[(i + 1) % p.length], len = Math.hypot(b[0] - a[0], b[1] - a[1])
        const nx = -(b[1] - a[1]) / (len || 1), ny = (b[0] - a[0]) / (len || 1), off = R(r, -1, 1) * rough * len * 0.5
        out.push(a, [(a[0] + b[0]) / 2 + nx * off, (a[1] + b[1]) / 2 + ny * off])
      }
      if (!closed) out.push(p[p.length - 1])
      p = out
    }
    return p
  }
  T.blob = (cx, cy, rx, ry, r, n = 9) => { const pts = []; for (let i = 0; i < n; i++) { const a = i / n * 6.283 + R(r, -.2, .2), k = R(r, .75, 1.15); pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]) } return pts }
  T.path2d = (polys) => { const p = new Path2D(); polys.forEach((poly) => { poly.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); p.closePath() }); return p }
  T.inside = (poly, x, y) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c } return c }
  T.along = (line, t) => { // point + tangent at fraction t of a polyline; extrapolates past the ends
    let total = 0; const seg = []; for (let i = 1; i < line.length; i++) { const d = Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]); seg.push(d); total += d }
    let want = t * total
    if (want < 0) { const a = line[0], b = line[1], d = seg[0] || 1; return { x: a[0] + (b[0] - a[0]) * want / d, y: a[1] + (b[1] - a[1]) * want / d, ang: Math.atan2(b[1] - a[1], b[0] - a[0]), total } }
    for (let i = 0; i < seg.length; i++) { if (want <= seg[i] || i === seg.length - 1) { const k = seg[i] ? want / seg[i] : 0, a = line[i], b = line[i + 1]; return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, ang: Math.atan2(b[1] - a[1], b[0] - a[0]), total } } want -= seg[i] }
  }
  /** Aged paper: base tone, soft stains, faint fibres, darker edges. */
  T.paper = (ctx, w, h, r, st, look) => {
    const clean = look === 'white'
    ctx.fillStyle = st.paper; ctx.fillRect(0, 0, w, h)
    const stain = clean ? 'rgba(150,130,90,' : 'rgba(140,100,50,'
    for (let i = 0; i < (clean ? 14 : 60); i++) {
      const x = R(r, 0, w), y = R(r, 0, h), rad = R(r, 30, 200), g = ctx.createRadialGradient(x, y, 0, x, y, rad), a = R(r, .02, clean ? .03 : .08)
      g.addColorStop(0, stain + a + ')'); g.addColorStop(.7, stain + a * .5 + ')'); g.addColorStop(1, stain + '0)'); ctx.fillStyle = g; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2)
    }
    ctx.strokeStyle = clean ? 'rgba(120,110,90,.05)' : 'rgba(110,80,40,.07)'; ctx.lineWidth = .6
    for (let i = 0; i < 500; i++) { const x = R(r, 0, w), y = R(r, 0, h), a = R(r, 0, 6.28), l = R(r, 3, 14); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke() }
    if (!clean) {
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .35, w / 2, h / 2, Math.max(w, h) * .72)
      g.addColorStop(0, 'rgba(90,55,20,0)'); g.addColorStop(1, 'rgba(90,55,20,.32)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h)
    }
  }

  /** Concentric ripple lines following a shape's outline, kept outside (sea side) or inside (lakes). */
  T.ripples = (ctx, path, w, h, st, { rings = [5, 10, 16], keep = 'outside', alpha = .55, lw = .9 } = {}) => {
    const m = ctx.getTransform(), off = document.createElement('canvas'); off.width = ctx.canvas.width; off.height = ctx.canvas.height
    const o = off.getContext('2d'); o.setTransform(m); o.lineJoin = 'round'
    rings.slice().reverse().forEach((k) => {
      o.globalCompositeOperation = 'source-over'; o.strokeStyle = st.ink; o.globalAlpha = 1; o.lineWidth = 2 * k + lw; o.stroke(path)
      o.globalCompositeOperation = 'destination-out'; o.lineWidth = 2 * k - lw; o.stroke(path)
    })
    o.globalCompositeOperation = keep === 'outside' ? 'destination-out' : 'destination-in'; o.fill(path)
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalAlpha = alpha; ctx.drawImage(off, 0, 0); ctx.restore()
  }
  /** Stipple dots scattered along a coastline on the sea side, thinning out with distance. */
  T.coastStipple = (ctx, polys, isLand, r, st, { n = 2400, spread = 16, size = .7 } = {}) => {
    ctx.save(); ctx.fillStyle = st.ink; ctx.globalAlpha = .75
    const all = polys.flatMap((poly) => poly.map((q, k) => [q, poly[(k + 1) % poly.length]]))
    for (let i = 0; i < n; i++) {
      const [a, b] = A.pick(r, all), t = r()
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len
      const d = -Math.log(1 - r() * .98) * spread / 3, sx = a[0] + (b[0] - a[0]) * t, sy = a[1] + (b[1] - a[1]) * t
      for (const sgn of [1, -1]) { const x = sx + nx * d * sgn, y = sy + ny * d * sgn; if (!isLand(x, y)) { ctx.beginPath(); ctx.arc(x, y, size * R(r, .6, 1.3), 0, 6.283); ctx.fill(); break } }
    }
    ctx.restore()
  }
  /** A river: ragged line that widens towards its mouth. */
  T.river = (ctx, line, r, st, { w0 = .5, w1 = 2.6 } = {}) => {
    const p = A.wobble(line, r, .5, 4), L = [], Rr = []
    for (let i = 0; i < p.length; i++) {
      const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)], d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
      const nx = -(b[1] - a[1]) / d, ny = (b[0] - a[0]) / d, hw = (w0 + (w1 - w0) * (i / (p.length - 1))) / 2 * st.line
      L.push([p[i][0] + nx * hw, p[i][1] + ny * hw]); Rr.push([p[i][0] - nx * hw, p[i][1] - ny * hw])
    }
    if (st.mode === 'colour') { ctx.save(); ctx.strokeStyle = st.tint.water; ctx.globalAlpha = .6; ctx.lineWidth = w1 * 2.2; ctx.lineCap = 'round'; ctx.beginPath(); p.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.stroke(); ctx.restore() }
    ctx.beginPath(); L.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); for (let i = Rr.length - 1; i >= 0; i--) ctx.lineTo(Rr[i][0], Rr[i][1]); ctx.closePath(); ctx.fillStyle = st.ink; ctx.fill()
  }
  /** Dotted road like the Wheel of Time map. */
  T.road = (ctx, line, r, st, { gap = 5.5, size = 1.05 } = {}) => {
    const p = A.wobble(line, r, .6, 8); let carry = 0
    ctx.save(); ctx.fillStyle = st.ink
    for (let i = 1; i < p.length; i++) {
      const [x0, y0] = p[i - 1], [x1, y1] = p[i], d = Math.hypot(x1 - x0, y1 - y0)
      for (let t = carry; t < d; t += gap) { ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * t / d, y0 + (y1 - y0) * t / d, size * st.line, 0, 6.283); ctx.fill() }
      carry = (carry - d) % gap; if (carry < 0) carry += gap
    }
    ctx.restore()
  }
  /** Dash-dot border line. */
  T.border = (ctx, line, r, st) => {
    const p = A.wobble(line, r, .8, 10)
    ctx.save(); ctx.strokeStyle = st.mode === 'colour' ? '#8b2f2a' : st.ink; ctx.globalAlpha = .8; ctx.lineWidth = 1.2 * st.line; ctx.setLineDash([10, 4, 2, 4].map((n) => n * st.line))
    ctx.beginPath(); p.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.stroke(); ctx.restore()
  }
  /** Text set along a curve, letter by letter. spacing = extra px between letters. */
  T.curvedText = (ctx, text, line, { font, spacing = 0, color, halo, haloWidth = 5 } = {}) => {
    ctx.save(); ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    const widths = [...text].map((ch) => ctx.measureText(ch).width + spacing), tw = widths.reduce((a, b) => a + b, 0) - spacing
    const total = T.along(line, 1).total, start = (total - tw) / 2
    let acc = start
    ;[...text].forEach((ch, i) => {
      const mid = acc + (widths[i] - spacing) / 2, pt = T.along(line, mid / total)
      ctx.save(); ctx.translate(pt.x, pt.y); ctx.rotate(pt.ang)
      if (halo) { ctx.strokeStyle = halo; ctx.lineWidth = haloWidth; ctx.globalAlpha = .85; ctx.strokeText(ch, 0, 0); ctx.globalAlpha = 1 }
      ctx.fillStyle = color; ctx.fillText(ch, 0, 0); ctx.restore()
      acc += widths[i]
    })
    ctx.restore()
  }
  T.text = (ctx, text, x, y, { font, color, halo, haloWidth = 4.5, align = 'center' } = {}) => {
    ctx.save(); ctx.font = font; ctx.textAlign = align; ctx.textBaseline = 'middle'
    if (halo) { ctx.strokeStyle = halo; ctx.lineWidth = haloWidth; ctx.globalAlpha = .85; ctx.strokeText(text, x, y); ctx.globalAlpha = 1 }
    ctx.fillStyle = color; ctx.fillText(text, x, y); ctx.restore()
  }
  /** Double ruled frame, with a chequered band in colour mode. */
  T.frame = (ctx, w, h, r, st) => {
    ctx.save(); ctx.strokeStyle = st.ink
    ctx.lineWidth = 2.6; ctx.strokeRect(14, 14, w - 28, h - 28)
    ctx.lineWidth = .9; ctx.strokeRect(21, 21, w - 42, h - 42)
    const step = 18
    for (let x = 21; x < w - 21 - step / 2; x += step * 2) { ctx.fillStyle = st.ink; ctx.globalAlpha = .8; ctx.fillRect(x, 14, step, 7); ctx.fillRect(x, h - 21, step, 7) }
    for (let y = 21; y < h - 21 - step / 2; y += step * 2) { ctx.fillRect(14, y, 7, step); ctx.fillRect(w - 21, y, 7, step) }
    ctx.restore()
  }
})(window.Atlas)
