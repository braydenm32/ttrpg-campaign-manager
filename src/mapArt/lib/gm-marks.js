/* The GM's own marks, in red ink like the notes in a published adventure: secret doors, traps, hidden
   treasure and danger. They are only on the GM's picture (players get a picture without them, unless the
   GM shows one), and they go on last, over everything else. Letters and little pictures always stand
   upright, however the mark is turned; a secret door's extent and a trap's square turn with it.
   100-unit design space (100 units = s). A paper halo under every stroke keeps them readable on any ground. */
;(function (A) {
  'use strict'
  const PI = Math.PI, TAU = PI * 2, sin = Math.sin, cos = Math.cos, min = Math.min, max = Math.max
  const RED = '#b0242a'
  const FONT = '"IM Fell English", Georgia, serif'
  let ctx, r, k, lw, HALO
  const j = (a) => (r() - 0.5) * 2 * a

  function begin(c, x, y, s, rg, style) {
    ctx = c; r = rg; k = s / 100
    lw = (style.line || 1) * max(0.8, min(2.4, 0.7 + s / 120))
    HALO = style.mode === 'colour' ? 'rgba(250,244,228,.85)' : style.paper
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.lineJoin = 'round'; ctx.lineCap = 'round'
  }
  const end = () => ctx.restore()
  /** A pen width in design units. */
  const px = (b) => (b * lw) / k

  /** Stroke the current path in red over a paper halo. */
  function ink(w, o) {
    o = o || {}
    ctx.setLineDash([])
    ctx.strokeStyle = HALO; ctx.lineWidth = px(w) + px(2.6); ctx.stroke()
    if (o.dash) ctx.setLineDash(o.dash.map(px))
    ctx.strokeStyle = RED; ctx.lineWidth = px(w); ctx.stroke()
    ctx.setLineDash([])
  }
  function fill(o) {
    o = o || {}
    ctx.strokeStyle = HALO; ctx.lineWidth = px(2.6); ctx.stroke()
    ctx.fillStyle = o.paper ? HALO : RED; ctx.fill()
    if (o.paper) { ctx.strokeStyle = RED; ctx.lineWidth = px(o.w || 1.4); ctx.stroke() }
  }
  const path = (pts, close) => { ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); if (close) ctx.closePath() }
  const line = (pts, w, o) => { path(pts, o && o.close); ink(w, o) }
  const circle = (x, y, rad) => { ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU) }
  /** A hand-lettered capital, upright. */
  function letter(t, x, y, size, o) {
    o = o || {}
    ctx.font = `${o.italic === false ? '' : 'italic '}${size}px ${FONT}`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'; ctx.strokeStyle = HALO; ctx.lineWidth = px(3.2)
    ctx.strokeText(t, x, y + size * 0.04)
    ctx.fillStyle = RED; ctx.fillText(t, x, y + size * 0.04)
    // a second pass a hair to the right makes the thin serif letters as bold as the pen marks
    ctx.fillText(t, x + size * 0.03, y + size * 0.04)
  }
  /** Draw with the turn (and mirroring) taken off, so letters and pictures read the right way up. */
  function upright(fn) {
    ctx.save()
    let m = ctx.getTransform()
    if (m.a * m.d - m.b * m.c < 0) { ctx.scale(-1, 1); m = ctx.getTransform() }
    ctx.rotate(-Math.atan2(m.b, m.a))
    fn()
    ctx.restore()
  }
  /** An arrow from a to b. */
  function arrow(a, b, w, head) {
    line([a, b], w)
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), h = head || 9
    line([[b[0] - cos(ang - 0.5) * h, b[1] - sin(ang - 0.5) * h], b, [b[0] - cos(ang + 0.5) * h, b[1] - sin(ang + 0.5) * h]], w)
  }

  /* =====================================================================================================
     Secret door (one square wide, on a wall that runs along x): the wall stays drawn, with the old "S" on it.
     ===================================================================================================== */
  /** The stretch of wall the door takes up: a dashed line along it and a tick across each end. */
  function extent(o) {
    o = o || {}
    line([[-38, 0], [38, 0]], 1.3, { dash: o.dots ? [0.5, 4] : [5, 4] })
    if (o.ticks !== false) for (const x of [-38, 38]) line([[x, -9], [x, 9]], 1.6)
  }
  const S = (x, y, size) => upright(() => letter('S', x || 0, y || 0, size || 46))
  const secret = [
    // 0: the plain "S"
    () => { extent(); S() },
    // 1: concealed: the "S" in a box
    () => { extent({ ticks: false }); upright(() => { path([[-17, -19], [17, -19], [17, 19], [-17, 19]], true); fill({ paper: true, w: 1.5 }); letter('S', 0, 0, 38) }) },
    // 2: one way: an arrow through the wall shows which side it opens from
    () => { extent(); arrow([24, -22], [24, 22], 1.6, 8); S(-6) },
    // 3: a pivoting wall section: the pivot in the middle and the way it swings
    () => {
      extent()
      ctx.beginPath(); ctx.arc(0, 0, 30, PI * 0.15, PI * 0.85); ink(1.2, { dash: [3, 3] })
      ctx.beginPath(); ctx.arc(0, 0, 30, PI * 1.15, PI * 1.85); ink(1.2, { dash: [3, 3] })
      circle(0, 0, 4); fill()
      S(0, -24, 34)
    },
    // 4: a sliding panel: a double arrow along the wall
    () => { extent(); arrow([-10, 16], [-34, 16], 1.4, 7); arrow([10, 16], [34, 16], 1.4, 7); S(0, -10, 40) },
    // 5: an illusory wall, you can walk through it
    () => { extent({ dots: true }); upright(() => letter('I', 0, 0, 44)) },
    // 6: locked, with a hidden keyhole
    () => {
      extent(); S(-12, 0, 42)
      upright(() => { circle(20, -4, 5); fill(); path([[17, -2], [23, -2], [25, 10], [15, 10]], true); fill() })
    },
    // 7: opened by a hidden lever or catch nearby
    () => {
      extent(); S(-10, 0, 42)
      upright(() => { line([[18, 12], [28, -12]], 2); circle(28, -12, 4); fill() })
    },
  ]

  /* =====================================================================================================
     Trap (one square): a dashed square where it is, with "T" for most kinds.
     ===================================================================================================== */
  const square = (o) => line([[-40, -40], [40, -40], [40, 40], [-40, 40]], 1.4, { close: true, dash: (o && o.dash) || [6, 4] })
  const T = (x, y, size) => upright(() => letter('T', x || 0, y || 0, size || 44, { italic: false }))
  const traps = [
    // 0: pit trap: the old square with a cross
    () => { square({ dash: [1, 0] }); line([[-40, -40], [40, 40]], 1.5); line([[40, -40], [-40, 40]], 1.5) },
    // 1: pressure plate
    () => { square(); T() },
    // 2: darts from the wall
    () => { square(); T(8, 0, 40); upright(() => { for (const y of [-16, 0, 16]) arrow([-36, y], [-18, y], 1.2, 5) }) },
    // 3: falling block or ceiling
    () => { square(); line([[-28, -28], [28, -28], [28, 28], [-28, 28]], 1, { close: true, dash: [2, 3] }); T(0, 0, 40) },
    // 4: swinging blade
    () => { square(); ctx.beginPath(); ctx.arc(0, -70, 82, PI * 0.36, PI * 0.64); ink(1.6); T(0, -2, 38) },
    // 5: poison gas
    () => {
      square()
      upright(() => { for (const [x, y] of [[-20, 22], [6, 26], [22, 16]]) { ctx.beginPath(); ctx.arc(x, y, 7, PI, TAU); ctx.arc(x + 9, y, 5, PI, TAU); ink(1.1) } })
      T(0, -8, 38)
    },
    // 6: magic glyph
    () => {
      square(); circle(0, 0, 30); ink(1.2)
      const tri = [0, 1, 2].map((i) => [cos(-PI / 2 + (i * TAU) / 3) * 30, sin(-PI / 2 + (i * TAU) / 3) * 30]); line(tri, 1, { close: true })
      T(0, 2, 30)
    },
    // 7: net or snare
    () => { square(); for (let i = -30; i <= 30; i += 15) { line([[i - 10, -34], [i + 10, 34]], 0.8); line([[i + 10, -34], [i - 10, 34]], 0.8) } T(0, 0, 36) },
  ]

  /* =====================================================================================================
     Hidden treasure and other things to find (half a square): small pictures, upright.
     ===================================================================================================== */
  const treasure = [
    // 0: X marks the spot
    () => upright(() => { line([[-26, -26], [26, 26]], 3.2); line([[26, -26], [-26, 26]], 3.2) }),
    // 1: a chest
    () => upright(() => {
      path([[-30, -6], [30, -6], [30, 24], [-30, 24]], true); fill({ paper: true, w: 1.8 })
      ctx.beginPath(); ctx.moveTo(-30, -6); ctx.bezierCurveTo(-30, -30, 30, -30, 30, -6); ctx.closePath(); fill({ paper: true, w: 1.8 })
      path([[-6, -4], [6, -4], [6, 8], [-6, 8]], true); fill()
    }),
    // 2: a pile of coins
    () => upright(() => {
      for (const [x, y] of [[-16, 14], [14, 14], [0, 0], [-2, 22], [18, -4], [-18, -2]]) { ctx.beginPath(); ctx.ellipse(x, y, 12, 6, 0, 0, TAU); fill({ paper: true, w: 1.5 }) }
      upright(() => letter('$', 0, -22, 26, { italic: false }))
    }),
    // 3: a gem
    () => upright(() => {
      const g = [[-26, -8], [-14, -22], [14, -22], [26, -8], [0, 26]]
      path(g, true); fill({ paper: true, w: 1.8 })
      line([[-26, -8], [26, -8]], 1); line([[-14, -22], [-8, -8], [0, 26]], 1); line([[14, -22], [8, -8], [0, 26]], 1)
    }),
    // 4: a crown
    () => upright(() => {
      path([[-28, 18], [-30, -16], [-14, 2], [0, -24], [14, 2], [30, -16], [28, 18]], true); fill({ paper: true, w: 1.8 })
      line([[-28, 10], [28, 10]], 1)
    }),
    // 5: a key
    () => upright(() => { circle(-18, 0, 12); ink(2.4); line([[-6, 0], [30, 0]], 2.6); line([[22, 0], [22, 12]], 2.4); line([[30, 0], [30, 10]], 2.4) }),
    // 6: a potion
    () => upright(() => {
      ctx.beginPath(); ctx.moveTo(-6, -26); ctx.lineTo(-6, -10); ctx.bezierCurveTo(-30, -2, -26, 28, 0, 28); ctx.bezierCurveTo(26, 28, 30, -2, 6, -10); ctx.lineTo(6, -26); ctx.closePath()
      fill({ paper: true, w: 1.8 }); line([[-20, 8], [20, 8]], 1); line([[-9, -26], [9, -26]], 2.4)
    }),
    // 7: a scroll or map
    () => upright(() => {
      path([[-22, -18], [22, -18], [22, 18], [-22, 18]], true); fill({ paper: true, w: 1.6 })
      for (const x of [-22, 22]) { ctx.beginPath(); ctx.ellipse(x, 0, 5, 22, 0, 0, TAU); fill({ paper: true, w: 1.6 }) }
      for (const y of [-8, 0, 8]) line([[-14, y + j(0.5)], [14, y + j(0.5)]], 0.8)
    }),
  ]

  /* =====================================================================================================
     Danger (half a square): ambushes, watchers, monsters.
     ===================================================================================================== */
  const danger = [
    // 0: a skull
    () => upright(() => {
      ctx.beginPath(); ctx.moveTo(-14, 20); ctx.lineTo(-14, 12); ctx.bezierCurveTo(-30, 4, -30, -28, 0, -28); ctx.bezierCurveTo(30, -28, 30, 4, 14, 12); ctx.lineTo(14, 20); ctx.closePath()
      fill({ paper: true, w: 1.8 })
      for (const x of [-10, 10]) { circle(x, -6, 6); fill() }
      path([[0, 2], [-4, 10], [4, 10]], true); fill()
      for (const x of [-7, 0, 7]) line([[x, 14], [x, 20]], 1)
    }),
    // 1: crossed swords: an ambush
    () => upright(() => {
      for (const s of [-1, 1]) {
        line([[-26 * s, -26], [22 * s, 22]], 2.6)
        line([[14 * s, 8], [6 * s, 18]].map(([x, y]) => [x + 2 * s, y + 2]), 2.4)
        line([[24 * s, 24], [30 * s, 30]], 3)
      }
    }),
    // 2: an eye: someone watching
    () => upright(() => {
      ctx.beginPath(); ctx.moveTo(-30, 0); ctx.quadraticCurveTo(0, -26, 30, 0); ctx.quadraticCurveTo(0, 26, -30, 0); ctx.closePath(); fill({ paper: true, w: 1.8 })
      circle(0, 0, 9); fill()
    }),
    // 3: footprints: a patrol comes this way
    () => upright(() => {
      for (const [x, y, s] of [[-12, 18, 1], [10, 2, -1], [-12, -14, 1], [10, -28, -1]]) {
        ctx.beginPath(); ctx.ellipse(x, y, 5, 8, 0.1 * s, 0, TAU); fill()
        for (let i = 0; i < 3; i++) { circle(x - 4 + i * 4, y - 11, 1.8); fill() }
      }
    }),
    // 4: danger
    () => upright(() => { path([[0, -30], [30, 24], [-30, 24]], true); fill({ paper: true, w: 2 }); letter('!', 0, 6, 34, { italic: false }) }),
    // 5: an alarm bell
    () => upright(() => {
      ctx.beginPath(); ctx.moveTo(-24, 18); ctx.bezierCurveTo(-18, 12, -20, -24, 0, -24); ctx.bezierCurveTo(20, -24, 18, 12, 24, 18); ctx.closePath(); fill({ paper: true, w: 1.8 })
      circle(0, 24, 5); fill(); line([[0, -24], [0, -30]], 2)
    }),
    // 6: asleep (for now)
    () => upright(() => { letter('z', -14, 14, 26); letter('z', 2, -2, 32); letter('z', 18, -20, 38) }),
    // 7: a monster
    () => upright(() => { circle(0, 0, 28); fill({ paper: true, w: 2 }); letter('M', 0, 1, 34, { italic: false }) }),
  ]

  function reg(name, label, fns) {
    A.register(name, {
      label, category: 'gm-marks', kind: 'fixed', view: 'top', variants: 8,
      draw(c, x, y, s, rg, style, v) {
        begin(c, x, y, s, rg, style)
        try { fns[(((v | 0) % fns.length) + fns.length) % fns.length]() } finally { end() }
      },
    })
  }
  reg('gm-secret-door', 'Secret door', secret)
  reg('gm-trap', 'Trap', traps)
  reg('gm-treasure', 'Hidden treasure', treasure)
  reg('gm-danger', 'Danger', danger)
})(window.Atlas)
