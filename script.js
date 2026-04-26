// Ponyforge — game-ux interaction layer.
// Model: page = paddock; ponies live in the world; hats summon as a
// radial palette around the tapped horse; pointer events power both
// mouse and touch with one drag path; rAF-driven so transforms never
// fight layout. Number-row keys assign hats; arrows nudge a focused
// pony; space/enter opens the ring; r recalls.

(() => {
  const paddock   = document.getElementById('paddock')
  const ring      = document.getElementById('ring')
  const ringTarget= document.getElementById('ringTarget')
  const recallBtn = document.getElementById('recall')
  const hint      = document.getElementById('hint')
  const ponies    = [...document.querySelectorAll('.pony')]
  const ringHats  = [...document.querySelectorAll('.ring__hat')]

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // ---------------------------------------------------------- STATE

  const home = new Map()      // pony -> [x, y] starting position
  let dragging = null
  let dragId = 0
  let dragOffX = 0, dragOffY = 0
  let dragStartX = 0, dragStartY = 0
  let dragX = 0, dragY = 0
  let didMove = false
  let rafQueued = false
  let lastFocusedPony = null
  let ringTargetPony = null
  let hintFaded = false

  // ---------------------------------------------------------- HELPERS

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

  function setXY(pony, x, y) {
    pony._x = x; pony._y = y
    pony.style.setProperty('--x', `${x}px`)
    pony.style.setProperty('--y', `${y}px`)
  }

  function sortDepth() {
    const r = paddock.getBoundingClientRect()
    const h = r.height || 1
    ponies.forEach(p => {
      const y = p._y || 0
      const depth = clamp(0.55 - (y / h) * 0.55, 0, 0.55)
      p.style.setProperty('--depth', depth.toFixed(3))
      p.style.setProperty('--z', String(Math.round(100 + y)))
    })
  }

  function fadeHint() {
    if (hintFaded || !hint) return
    hintFaded = true
    hint.classList.add('is-faded')
  }

  // ---------------------------------------------------------- LAYOUT

  function layoutHerd() {
    const r = paddock.getBoundingClientRect()
    const w = r.width, h = r.height
    const probe = ponies[0]
    const pw = probe.offsetWidth || 150
    const ph = probe.offsetHeight || 84

    const cols = 3, rows = 2
    const padX = 32
    const padTop = 96       // room for stamp + recall
    const padBot = 56       // room for fold/hint
    const cellW = (w - padX * 2) / cols
    const cellH = (h - padTop - padBot) / rows

    // perturbations are deterministic — balanced, never clustered
    const perturb = [
      [ 0.10, -0.18], [-0.14,  0.12], [ 0.18,  0.20],
      [-0.20, -0.12], [ 0.16,  0.18], [-0.08, -0.20],
    ]

    ponies.forEach((p, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const cx = padX + col * cellW + (cellW - pw) / 2
      const cy = padTop + row * cellH + (cellH - ph) / 2
      const [px, py] = perturb[i] || [0, 0]
      const x = clamp(cx + px * cellW * 0.4, 8, w - pw - 8)
      const y = clamp(cy + py * cellH * 0.4, padTop - 40, h - ph - padBot)
      setXY(p, x, y)
      home.set(p, [x, y])
    })
    sortDepth()
  }

  // ---------------------------------------------------------- HAT FITTING

  function fitHat(pony, glyph) {
    const slot = pony.querySelector('.hat-slot')
    if (!slot) return
    const prev = slot.textContent
    if (reduceMotion || prev === glyph) {
      slot.textContent = glyph
      pony.dataset.hat = glyph
      return
    }
    slot.classList.remove('is-landing')
    slot.classList.add('is-falling')
    slot.addEventListener('animationend', function onFall() {
      slot.removeEventListener('animationend', onFall)
      slot.classList.remove('is-falling')
      slot.textContent = glyph
      pony.dataset.hat = glyph
      void slot.offsetWidth
      slot.classList.add('is-landing')
      slot.addEventListener('animationend', () => slot.classList.remove('is-landing'), { once: true })
    }, { once: true })
  }

  // ---------------------------------------------------------- RING

  function placeRingHats() {
    const n = ringHats.length
    ringHats.forEach((h, i) => {
      const a = -90 + (360 / n) * i
      h.style.setProperty('--a', `${a}deg`)
    })
  }

  function isRingOpen() { return ring.classList.contains('is-open') }

  function openRingAt(x, y, pony) {
    ringTargetPony = pony || null
    ringTarget.textContent = pony ? pony.dataset.name : '—'
    const cur = pony ? pony.dataset.hat : null
    ringHats.forEach(h => h.classList.toggle('is-active', !!cur && h.dataset.hat === cur))
    // measure ring; fall back to a sane default the first time (display:none-equivalent)
    const rw = ring.offsetWidth || 540
    const half = rw / 2
    const margin = 12
    const cx = clamp(x, half - margin, window.innerWidth  - half + margin)
    const cy = clamp(y, half - margin, window.innerHeight - half + margin)
    ring.style.left = `${cx}px`
    ring.style.top  = `${cy}px`
    ring.classList.add('is-open')
    ring.setAttribute('aria-hidden', 'false')
    fadeHint()
  }

  function closeRing() {
    ring.classList.remove('is-open')
    ring.setAttribute('aria-hidden', 'true')
    ringTargetPony = null
  }

  ringHats.forEach(h => {
    h.addEventListener('click', (e) => {
      e.stopPropagation()
      const glyph = h.dataset.hat
      const pony = ringTargetPony || lastFocusedPony
      if (pony) fitHat(pony, glyph)
      closeRing()
      if (pony) pony.focus({ preventScroll: true })
    })
  })

  paddock.addEventListener('pointerdown', (e) => {
    if (!isRingOpen()) return
    if (e.target.closest('.ring')) return
    if (e.target.closest('.pony')) return  // let pony handler take over
    closeRing()
  }, true)

  // ---------------------------------------------------------- DRAG

  function onPonyPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const pony = e.currentTarget
    lastFocusedPony = pony
    dragging = pony
    dragId = e.pointerId
    didMove = false

    const rect = pony.getBoundingClientRect()
    dragOffX = e.clientX - rect.left
    dragOffY = e.clientY - rect.top
    dragStartX = e.clientX
    dragStartY = e.clientY
    dragX = pony._x
    dragY = pony._y

    try { pony.setPointerCapture(e.pointerId) } catch (_) {}
    e.preventDefault()
  }

  function onPonyPointerMove(e) {
    if (!dragging || e.pointerId !== dragId) return
    const dx = e.clientX - dragStartX
    const dy = e.clientY - dragStartY
    if (!didMove && Math.hypot(dx, dy) > 4) {
      didMove = true
      dragging.classList.add('is-lifted')
      dragging.style.setProperty('--lift', '1')
      paddock.classList.add('is-holding')
      fadeHint()
      if (isRingOpen()) closeRing()
    }
    if (didMove) {
      const r = paddock.getBoundingClientRect()
      const pw = dragging.offsetWidth, ph = dragging.offsetHeight
      const x = clamp(e.clientX - r.left - dragOffX, 4, r.width  - pw - 4)
      const y = clamp(e.clientY - r.top  - dragOffY, 4, r.height - ph - 4)
      dragX = x; dragY = y
      const tilt = clamp(dx * 0.02, -6, 6)
      dragging.style.setProperty('--r', `${tilt}deg`)
      if (!rafQueued) {
        rafQueued = true
        requestAnimationFrame(applyDrag)
      }
    }
  }

  function applyDrag() {
    rafQueued = false
    if (!dragging) return
    setXY(dragging, dragX, dragY)
  }

  function onPonyPointerUp(e) {
    if (!dragging || e.pointerId !== dragId) return
    const pony = dragging
    try { pony.releasePointerCapture(dragId) } catch (_) {}
    paddock.classList.remove('is-holding')

    if (didMove) {
      pony.classList.remove('is-lifted')
      pony.style.setProperty('--lift', '0')
      pony.style.setProperty('--r', '0deg')
      sortDepth()
      if (!reduceMotion) {
        pony.classList.remove('is-landing')
        void pony.offsetWidth
        pony.classList.add('is-landing')
        pony.addEventListener('animationend', () => pony.classList.remove('is-landing'), { once: true })
      }
    } else {
      pony.classList.remove('is-lifted')
      pony.style.setProperty('--lift', '0')
      const rect = pony.getBoundingClientRect()
      openRingAt(rect.left + rect.width / 2, rect.top + rect.height / 2, pony)
    }
    dragging = null
  }

  function onPonyPointerCancel() {
    if (!dragging) return
    dragging.classList.remove('is-lifted')
    dragging.style.setProperty('--lift', '0')
    dragging.style.setProperty('--r', '0deg')
    paddock.classList.remove('is-holding')
    dragging = null
  }

  ponies.forEach(p => {
    p.addEventListener('pointerdown',   onPonyPointerDown)
    p.addEventListener('pointermove',   onPonyPointerMove)
    p.addEventListener('pointerup',     onPonyPointerUp)
    p.addEventListener('pointercancel', onPonyPointerCancel)
    p.addEventListener('dragstart',   (e) => e.preventDefault())
    p.addEventListener('focus', () => { lastFocusedPony = p })
  })

  // ---------------------------------------------------------- KEYBOARD

  const KEY_TO_HAT = Object.fromEntries(ringHats.map(h => [h.dataset.key, h.dataset.hat]))

  document.addEventListener('keydown', (e) => {
    const focused = document.activeElement

    if (e.key === 'Escape' && isRingOpen()) {
      e.preventDefault()
      closeRing()
      if (lastFocusedPony) lastFocusedPony.focus({ preventScroll: true })
      return
    }

    // hat keys (1-9, 0, -, =)
    if (KEY_TO_HAT[e.key] !== undefined) {
      const target = ringTargetPony
        || (focused && focused.classList?.contains('pony') ? focused : lastFocusedPony)
      if (target) {
        e.preventDefault()
        fitHat(target, KEY_TO_HAT[e.key])
        if (isRingOpen()) {
          ringHats.forEach(h => h.classList.toggle('is-active', h.dataset.key === e.key))
        }
        fadeHint()
      }
      return
    }

    if (focused && focused.classList?.contains('pony')) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        const r = focused.getBoundingClientRect()
        openRingAt(r.left + r.width / 2, r.top + r.height / 2, focused)
        return
      }
      if (e.key.startsWith('Arrow')) {
        e.preventDefault()
        const step = e.shiftKey ? 32 : 8
        const r = paddock.getBoundingClientRect()
        const pw = focused.offsetWidth, ph = focused.offsetHeight
        let x = focused._x, y = focused._y
        if (e.key === 'ArrowLeft')  x -= step
        if (e.key === 'ArrowRight') x += step
        if (e.key === 'ArrowUp')    y -= step
        if (e.key === 'ArrowDown')  y += step
        x = clamp(x, 4, r.width - pw - 4)
        y = clamp(y, 4, r.height - ph - 4)
        setXY(focused, x, y)
        sortDepth()
        fadeHint()
        return
      }
    }

    if ((e.key === 'r' || e.key === 'R') && !isRingOpen()) {
      e.preventDefault()
      recall()
    }
  })

  // ---------------------------------------------------------- RECALL

  function recall() {
    closeRing()
    ponies.forEach(p => {
      const [hx, hy] = home.get(p) || [p._x, p._y]
      setXY(p, hx, hy)
      if (!reduceMotion) {
        p.classList.remove('is-landing')
        void p.offsetWidth
        p.classList.add('is-landing')
      }
    })
    sortDepth()
  }
  recallBtn.addEventListener('click', recall)

  // ---------------------------------------------------------- INIT

  placeRingHats()

  function init() {
    layoutHerd()
    sortDepth()
  }

  if (document.readyState === 'complete') {
    requestAnimationFrame(init)
  } else {
    window.addEventListener('load', () => requestAnimationFrame(init), { once: true })
  }

  // ---------------------------------------------------------- LIVING WORLD
  // The world responds to the user. Quiet generative layer:
  // - wandering inspector
  // - procedurally placed hay (seeded PRNG, crushed under horses)
  // - wind shifts (subtle SVG sway; not particles)
  // - gaze (heads turn toward cursor, max 4deg)
  // - breath cycle per horse
  // - field journal (localStorage)

  const hayfield  = document.getElementById('hayfield')
  const inspector = document.getElementById('inspector')
  const journal   = document.getElementById('journal')

  // seeded PRNG (mulberry32)
  function mulberry32(seed) {
    let t = seed >>> 0
    return function () {
      t = (t + 0x6D2B79F5) >>> 0
      let r = t
      r = Math.imul(r ^ (r >>> 15), r | 1)
      r ^= r + Math.imul(r ^ (r >>> 7), r | 61)
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296
    }
  }

  // ---- HAY -------------------------------------------------------
  // Each strand: { x, y, len, ang, baseAng, el, crushed }
  const hay = []

  function buildHay() {
    if (!hayfield) return
    const r = paddock.getBoundingClientRect()
    while (hayfield.firstChild) hayfield.removeChild(hayfield.firstChild)
    hay.length = 0
    const rng = mulberry32(0x70F0)
    const count = Math.round((r.width * r.height) / 18000) // density
    const ns = 'http://www.w3.org/2000/svg'
    for (let i = 0; i < count; i++) {
      const x = rng() * r.width
      const y = 90 + rng() * (r.height - 160)
      const len = 4 + rng() * 7
      const baseAng = -90 + (rng() - 0.5) * 60   // mostly upward
      const el = document.createElementNS(ns, 'line')
      el.setAttribute('class', 'hay')
      el.setAttribute('x1', x.toFixed(1))
      el.setAttribute('y1', y.toFixed(1))
      const rad = baseAng * Math.PI / 180
      el.setAttribute('x2', (x + Math.cos(rad) * len).toFixed(1))
      el.setAttribute('y2', (y + Math.sin(rad) * len).toFixed(1))
      hayfield.appendChild(el)
      hay.push({ x, y, len, ang: baseAng, baseAng, el, crushed: false, crushedAt: 0 })
    }
  }

  function updateHayCrush() {
    if (!hay.length) return
    const r = paddock.getBoundingClientRect()
    const now = performance.now()
    // build occupied rects from each pony
    const rects = ponies.map(p => {
      const pw = p.offsetWidth, ph = p.offsetHeight
      return {
        l: (p._x || 0) + pw * 0.08,
        t: (p._y || 0) + ph * 0.50,
        r: (p._x || 0) + pw * 0.92,
        b: (p._y || 0) + ph * 1.02,
      }
    })
    for (const s of hay) {
      let under = false
      for (const rc of rects) {
        if (s.x >= rc.l && s.x <= rc.r && s.y >= rc.t && s.y <= rc.b) { under = true; break }
      }
      if (under && !s.crushed) {
        s.crushed = true
        s.crushedAt = now
        s.el.classList.add('is-crushed')
      } else if (!under && s.crushed && (now - s.crushedAt) > 4000) {
        s.crushed = false
        s.el.classList.remove('is-crushed')
      }
    }
  }

  // ---- WIND ------------------------------------------------------
  // Wind has a direction (degrees, 0=N) and strength (0..1). Shifts every few minutes.
  const wind = { dir: 270, target: 270, strength: 0.4, t: performance.now(), nextShift: 0 }
  const COMPASS = ['N','NE','E','SE','S','SW','W','NW']
  function compass(deg) {
    const i = Math.round(((deg % 360 + 360) % 360) / 45) % 8
    return COMPASS[i]
  }
  function shiftWind() {
    wind.target = Math.floor(Math.random() * 360)
    wind.strength = 0.2 + Math.random() * 0.6
    wind.nextShift = performance.now() + (180000 + Math.random() * 240000) // 3-7 min
    queueJournal()
  }
  shiftWind()

  // simple value noise for hay sway
  function noise1(x) {
    const i = Math.floor(x), f = x - i
    const a = Math.sin(i * 12.9898) * 43758.5453
    const b = Math.sin((i + 1) * 12.9898) * 43758.5453
    const u = f * f * (3 - 2 * f)
    return ((a - Math.floor(a)) * (1 - u) + (b - Math.floor(b)) * u) * 2 - 1
  }

  function applyWind(now) {
    // ease wind direction toward target
    const d = ((wind.target - wind.dir + 540) % 360) - 180
    wind.dir += d * 0.0008
    if (now > wind.nextShift) shiftWind()
    if (reduceMotion) return
    // sway hay
    const t = now * 0.0006
    const windRad = wind.dir * Math.PI / 180
    for (let i = 0; i < hay.length; i++) {
      const s = hay[i]
      if (s.crushed) continue
      const sway = noise1(t + i * 0.13) * 18 * wind.strength
      const ang = s.baseAng + sway
      const rad = ang * Math.PI / 180
      // tiny lateral push from wind direction
      const push = Math.cos(windRad) * 0.6 * wind.strength
      s.el.setAttribute('x2', (s.x + Math.cos(rad) * s.len + push).toFixed(1))
      s.el.setAttribute('y2', (s.y + Math.sin(rad) * s.len).toFixed(1))
    }
  }

  // ---- GAZE + BREATH ---------------------------------------------
  let mouseX = -9999, mouseY = -9999
  window.addEventListener('pointermove', (e) => {
    mouseX = e.clientX; mouseY = e.clientY
  }, { passive: true })
  window.addEventListener('pointerleave', () => { mouseX = -9999; mouseY = -9999 })

  const breathPhase = ponies.map((_, i) => Math.random() * Math.PI * 2 + i * 0.7)

  function updatePoniesLive(now) {
    const t = now * 0.001
    for (let i = 0; i < ponies.length; i++) {
      const p = ponies[i]
      // breath
      let breath = 1
      if (!reduceMotion && p !== dragging) {
        breath = 1 + Math.sin(t * (Math.PI * 2 / 4) + breathPhase[i]) * 0.006
      }
      p.style.setProperty('--breath', breath.toFixed(4))
      // gaze
      let gaze = 0
      if (!reduceMotion && mouseX > -1000 && p !== dragging) {
        const r = p.getBoundingClientRect()
        const cx = r.left + r.width / 2
        const cy = r.top + r.height / 2
        const dx = mouseX - cx
        const dy = mouseY - cy
        const dist = Math.hypot(dx, dy)
        const near = Math.max(0, 1 - dist / 360)
        gaze = (dx / Math.max(dist, 1)) * 4 * near
        // dampen with previous
        const prev = p._gaze || 0
        gaze = prev + (gaze - prev) * 0.08
        p._gaze = gaze
      }
      p.style.setProperty('--gaze', gaze.toFixed(2) + 'deg')
    }
  }

  // ---- INSPECTOR -------------------------------------------------
  const insp = {
    active: false, x: 0, y: 0, vx: 0, dir: 1,
    nextRun: performance.now() + 15000 + Math.random() * 30000,
    stamped: new WeakSet(),
  }
  function startInspector() {
    if (insp.active || reduceMotion) return
    const r = paddock.getBoundingClientRect()
    insp.dir = Math.random() < 0.5 ? 1 : -1
    insp.y = 80 + Math.random() * (r.height - 160)
    insp.x = insp.dir > 0 ? -120 : r.width + 20
    insp.vx = insp.dir * (16 + Math.random() * 14)  // px/sec
    insp.active = true
    inspector.classList.add('is-walking')
  }
  function stopInspector() {
    insp.active = false
    inspector.classList.remove('is-walking')
    insp.nextRun = performance.now() + (90000 + Math.random() * 210000) // 90-300s
  }
  function updateInspector(now, dt) {
    if (!insp.active) {
      if (now >= insp.nextRun) startInspector()
      return
    }
    const r = paddock.getBoundingClientRect()
    insp.x += insp.vx * dt
    inspector.style.setProperty('--ix', insp.x.toFixed(1) + 'px')
    inspector.style.setProperty('--iy', insp.y.toFixed(1) + 'px')
    // stamp horses we pass
    for (const p of ponies) {
      if (insp.stamped.has(p)) continue
      const px = (p._x || 0), py = (p._y || 0)
      const pw = p.offsetWidth, ph = p.offsetHeight
      const ix = insp.x + 60   // mid of inspector text
      const iy = insp.y + 7
      if (ix >= px && ix <= px + pw && Math.abs(iy - (py + ph / 2)) < ph / 2) {
        insp.stamped.add(p)
        const stamp = p.querySelector('.pony__stamp')
        if (stamp) {
          stamp.classList.add('is-on')
          setTimeout(() => stamp.classList.remove('is-on'), 2000)
          setTimeout(() => insp.stamped.delete(p), 6000)
        }
      }
    }
    if ((insp.dir > 0 && insp.x > r.width + 80) ||
        (insp.dir < 0 && insp.x < -200)) {
      stopInspector()
    }
  }

  // ---- JOURNAL ---------------------------------------------------
  let journalDirty = true
  function queueJournal() { journalDirty = true }

  function fmtDate(d) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return months[d.getMonth()] + ' ' + d.getDate()
  }

  function updateJournal() {
    if (!journalDirty) return
    journalDirty = false
    const placed = ponies.length
    const line = `${fmtDate(new Date())} · ${placed} horses placed · wind from ${compass(wind.dir)}`
    journal.textContent = line
    journal.classList.add('is-on')
    journal.setAttribute('aria-hidden', 'false')
    try { localStorage.setItem('pf.journal', line) } catch (_) {}
  }

  // restore last journal line briefly so persistence is visible
  try {
    const prev = localStorage.getItem('pf.journal')
    if (prev) { journal.textContent = prev; journal.classList.add('is-on'); journal.setAttribute('aria-hidden', 'false') }
  } catch (_) {}

  // ---- TICKER ----------------------------------------------------
  let lastT = performance.now()
  function tick(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000)
    lastT = now
    applyWind(now)
    updatePoniesLive(now)
    updateHayCrush()
    updateInspector(now, dt)
    updateJournal()
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)

  // build hay after layout
  const buildHayDeferred = () => requestAnimationFrame(() => { buildHay(); queueJournal() })
  if (document.readyState === 'complete') buildHayDeferred()
  else window.addEventListener('load', buildHayDeferred, { once: true })

  // resize: keep relative positions but clamp inside new viewport
  let resizeQ = false
  window.addEventListener('resize', () => {
    if (resizeQ) return
    resizeQ = true
    requestAnimationFrame(() => {
      resizeQ = false
      const r = paddock.getBoundingClientRect()
      ponies.forEach(p => {
        const pw = p.offsetWidth, ph = p.offsetHeight
        const x = clamp(p._x || 0, 4, r.width  - pw - 4)
        const y = clamp(p._y || 0, 4, r.height - ph - 4)
        setXY(p, x, y)
      })
      sortDepth()
      buildHay()
    })
  })
})()
