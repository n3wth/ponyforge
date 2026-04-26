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
    })
  })
})()
