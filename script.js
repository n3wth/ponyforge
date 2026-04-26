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

  // ---------------------------------------------------------- EMERGENT (hidden)

  // Mood: which hats stick, which get rejected. Quiet, discoverable.
  // null = accepts everything. Otherwise, list of glyphs that get shaken off.
  const REJECT = {
    Vesper: ['🧢'],            // accepts the lipstick (default), rejects cap
    Onyx:   ['🎩'],            // rejects the topper
    Prism:  ['🥀'],            // not in a wilted mood
    Sable:  ['🧢'],
    Femme:  ['🕶️'],
    Iris:   [],
  }

  // Combos: certain hat-on-pony pairings trigger a tiny event.
  function maybeCombo(pony, glyph) {
    const name = pony.dataset.name
    if (glyph === '👑' && name === 'Sable') dropRibbon(pony)
    else if (glyph === '🪩') spinAllHats()
    else if (glyph === '🥀' && name === 'Femme') driftPetal(pony)
    else if (glyph === '💋' && name === 'Vesper') {
      // accepted with a barely-perceptible head dip
      pony.classList.add('is-bowing')
      setTimeout(() => pony.classList.remove('is-bowing'), 1100)
    }
  }

  function dropRibbon(pony) {
    if (reduceMotion) return
    const r = pony.getBoundingClientRect()
    const el = document.createElement('div')
    el.className = 'ribbon'
    el.style.left = `${r.left + r.width / 2 - 2}px`
    el.style.top  = `${r.top + r.height + 6}px`
    document.body.appendChild(el)
    void el.offsetWidth
    el.classList.add('is-falling')
    setTimeout(() => el.remove(), 2400)
  }

  function spinAllHats() {
    if (reduceMotion) return
    paddock.classList.remove('is-spinning')
    void paddock.offsetWidth
    paddock.classList.add('is-spinning')
    setTimeout(() => paddock.classList.remove('is-spinning'), 6200)
  }

  function driftPetal(pony) {
    if (reduceMotion) return
    const r = pony.getBoundingClientRect()
    const el = document.createElement('div')
    el.className = 'petal'
    el.textContent = '🌸'
    el.style.left = `${r.left + r.width / 2}px`
    el.style.top  = `${r.top + r.height * 0.3}px`
    const dx = (Math.random() < 0.5 ? -1 : 1) * (200 + Math.random() * 220)
    const dy = 60 + Math.random() * 80
    el.style.setProperty('--dx', `${dx}px`)
    el.style.setProperty('--dy', `${dy}px`)
    document.body.appendChild(el)
    void el.offsetWidth
    el.classList.add('is-drifting')
    setTimeout(() => el.remove(), 7400)
  }

  // Wrap fitHat to inject mood + combo behavior.
  const baseFitHat = fitHat
  fitHat = function(pony, glyph) {
    const rejects = REJECT[pony.dataset.name] || []
    if (rejects.includes(glyph)) {
      // accept briefly, then shake off back to previous
      const prev = pony.dataset.hat
      baseFitHat(pony, glyph)
      setTimeout(() => {
        const slot = pony.querySelector('.hat-slot')
        if (!slot) return
        slot.classList.add('is-shaking')
        setTimeout(() => {
          slot.classList.remove('is-shaking')
          baseFitHat(pony, prev)
        }, 520)
      }, 1400)
      return
    }
    baseFitHat(pony, glyph)
    maybeCombo(pony, glyph)
  }

  // Click counter on a single horse (per pony, persisted).
  function loadTaps() {
    try { return JSON.parse(localStorage.getItem('pf.taps') || '{}') }
    catch (_) { return {} }
  }
  function saveTaps(t) {
    try { localStorage.setItem('pf.taps', JSON.stringify(t)) } catch (_) {}
  }
  const NAMES_HUSHED = ['Mira','Juno','Echo','Wren','Lark','Sol']
  const taps = loadTaps()

  function tapNote(pony) {
    const name = pony.dataset.name
    taps[name] = (taps[name] || 0) + 1
    saveTaps(taps)
    renderNote(pony)
  }
  function renderNote(pony) {
    const name = pony.dataset.name
    const n = taps[name] || 0
    let note = pony.querySelector('.pony__note')
    if (n < 25) {
      if (note) note.remove()
      pony.classList.remove('is-seen')
      return
    }
    if (!note) {
      note = document.createElement('span')
      note.className = 'pony__note'
      pony.appendChild(note)
    }
    if (n >= 100) {
      // a private name, indexed by pony order so it's stable
      const idx = ponies.indexOf(pony)
      const hush = NAMES_HUSHED[idx % NAMES_HUSHED.length]
      note.innerHTML = `<span class="nt">·</span> ${hush.toLowerCase()} <span class="nt">·</span>`
    } else if (n >= 50) {
      note.textContent = `(seen ${n})`
    } else {
      note.textContent = '(seen)'
    }
    requestAnimationFrame(() => pony.classList.add('is-seen'))
  }
  ponies.forEach(p => {
    renderNote(p)
    p.addEventListener('pointerup', (e) => {
      // only count clicks (not drags)
      if (didMove) return
      tapNote(p)
    })
  })

  // Recall pill voice change.
  function loadRecallCount() {
    return parseInt(localStorage.getItem('pf.recalls') || '0', 10) || 0
  }
  function setRecallCount(n) {
    try { localStorage.setItem('pf.recalls', String(n)) } catch (_) {}
  }
  function renderRecall() {
    const n = loadRecallCount()
    if (n === 0) recallBtn.textContent = 'recall'
    else if (n < 10) recallBtn.textContent = `recalled · ${n}`
    else if (n < 25) recallBtn.textContent = `come back · ${n}`
    else recallBtn.textContent = `again · ${n}`
  }
  renderRecall()
  const wrappedRecall = () => {
    setRecallCount(loadRecallCount() + 1)
    renderRecall()
    recall()
  }
  // override the button: remove the old click and use our wrapper
  recallBtn.removeEventListener('click', recall)
  recallBtn.addEventListener('click', wrappedRecall)
  // intercept 'r' before the base handler so we count and recall once
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'r' || e.key === 'R') && !isRingOpen()) {
      const focused = document.activeElement
      if (focused && (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA')) return
      e.stopImmediatePropagation()
      e.preventDefault()
      wrappedRecall()
    }
  }, true)

  // Idle behavior: 30s → one horse turns to face another. 90s → swap.
  let idleTimer1 = null, idleTimer2 = null
  function clearIdle() {
    if (idleTimer1) clearTimeout(idleTimer1)
    if (idleTimer2) clearTimeout(idleTimer2)
  }
  function scheduleIdle() {
    clearIdle()
    idleTimer1 = setTimeout(idleTurn, 30_000)
    idleTimer2 = setTimeout(idleSwap, 90_000)
  }
  function idleTurn() {
    // pick a random pony, flip its image to face a neighbor
    const p = ponies[Math.floor(Math.random() * ponies.length)]
    const img = p.querySelector('img')
    if (!img) return
    const facing = img.style.transform.includes('-1') ? 1 : -1
    img.style.transform = `scaleX(${facing})`
    p.style.setProperty('--face-x', String(facing))
  }
  function idleSwap() {
    if (ponies.length < 2) return
    const a = ponies[Math.floor(Math.random() * ponies.length)]
    let b = ponies[Math.floor(Math.random() * ponies.length)]
    let guard = 0
    while (b === a && guard++ < 8) b = ponies[Math.floor(Math.random() * ponies.length)]
    if (a === b) return
    const ax = a._x, ay = a._y
    const bx = b._x, by = b._y
    // animate slowly via temporary transition
    const oldA = a.style.transition, oldB = b.style.transition
    a.style.transition = 'transform 2400ms cubic-bezier(.22,.61,.36,1)'
    b.style.transition = 'transform 2400ms cubic-bezier(.22,.61,.36,1)'
    setXY(a, bx, by)
    setXY(b, ax, ay)
    sortDepth()
    setTimeout(() => {
      a.style.transition = oldA
      b.style.transition = oldB
    }, 2500)
  }
  ;['pointerdown','keydown','pointermove','wheel'].forEach(ev =>
    window.addEventListener(ev, scheduleIdle, { passive: true })
  )
  scheduleIdle()

  // Letter-spelling secrets: P-O-N-Y → all dip; R-I-D-E → saddle cursor.
  let typed = ''
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const k = (e.key || '').toLowerCase()
    if (k.length !== 1) { typed = ''; return }
    typed = (typed + k).slice(-6)
    if (typed.endsWith('pony')) {
      ponies.forEach(p => {
        p.classList.remove('is-bowing')
        void p.offsetWidth
        p.classList.add('is-bowing')
        setTimeout(() => p.classList.remove('is-bowing'), 1100)
      })
      typed = ''
    } else if (typed.endsWith('ride')) {
      paddock.classList.add('is-saddled')
      setTimeout(() => paddock.classList.remove('is-saddled'), 4000)
      typed = ''
    }
  })

  // Time of day: midnight moon. 3:33 AM ghost horse.
  function tickClock() {
    const now = new Date()
    const h = now.getHours()
    const m = now.getMinutes()
    // moon between 23:00 and 04:59
    const isNight = (h >= 23 || h < 5)
    let moon = paddock.querySelector('.moon')
    if (isNight && !moon) {
      moon = document.createElement('div')
      moon.className = 'moon'
      moon.textContent = '🌙'
      moon.setAttribute('aria-hidden', 'true')
      paddock.appendChild(moon)
    } else if (!isNight && moon) {
      moon.remove()
    }
    // 3:33 ghost
    const ghostKey = 'pf.ghost'
    if (h === 3 && m === 33) {
      if (!paddock.querySelector('.ghost')) {
        const g = document.createElement('div')
        g.className = 'ghost'
        g.textContent = '—'
        g.setAttribute('aria-hidden', 'true')
        paddock.appendChild(g)
        try {
          const seen = JSON.parse(localStorage.getItem(ghostKey) || '[]')
          seen.push(Date.now())
          localStorage.setItem(ghostKey, JSON.stringify(seen.slice(-10)))
        } catch (_) {}
        setTimeout(() => g.remove(), 55_000)
      }
    }
  }
  tickClock()
  setInterval(tickClock, 30_000)

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
