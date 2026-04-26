// Ponyforge — sandbox interaction layer.
//
// Model:
//  - Herd is data-driven: each horse is { id, kind, x, y, name, hats[<=3],
//    glasses, accessory, tail }. Cloning duplicates by kind (same portrait,
//    new id, own state). Up to 12 horses.
//  - The radial ring is mode-aware. Tab cycles slot: hat → glasses →
//    accessory → tail. Number keys assign within the active mode.
//  - Drawing layer: shift+drag in empty paddock space draws an oxblood
//    polyline on a canvas. Shift+right-click erases nearby strokes.
//  - State persists to localStorage. Cmd/Ctrl+S exports a PNG (Canvas2D
//    composite of paper ground + horses + slots + names + ink). Cmd/Ctrl+
//    Shift+S writes a base64 hash and copies a share URL. Loading a hash
//    restores everything.
//  - Reduced-motion respected. Mobile: long-press to clone; tap-to-edit
//    name (double-tap acts as double-click).

(() => {
  'use strict'

  const paddock    = document.getElementById('paddock')
  const herdEl     = document.getElementById('herd')
  const ring       = document.getElementById('ring')
  const ringTarget = document.getElementById('ringTarget')
  const ringCaption= document.getElementById('ringCaption')
  const recallBtn  = document.getElementById('recall')
  const tidyBtn    = document.getElementById('tidyBtn')
  const tidyLabel  = document.getElementById('tidyLabel')
  const modeBtn    = document.getElementById('modeSwitch')
  const modeLabel  = document.getElementById('modeLabel')
  const saveBtn    = document.getElementById('saveBtn')
  const shareBtn   = document.getElementById('shareBtn')
  const hint       = document.getElementById('hint')
  const toast      = document.getElementById('toast')
  const canvas     = document.getElementById('ink')
  const ctx        = canvas.getContext('2d')

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // ---------------------------------------------------------- KINDS

  const KINDS = [
    { id: 'iris',   plate: 'PF·001', name: 'Iris',   img: './assets/pony-iris.png',   alt: 'Iris, a dark bay mare with braided forelock' },
    { id: 'vesper', plate: 'PF·002', name: 'Vesper', img: './assets/pony-vesper.png', alt: 'Vesper, a roan mare at dusk' },
    { id: 'onyx',   plate: 'PF·003', name: 'Onyx',   img: './assets/pony-onyx.png',   alt: 'Onyx, a black gelding in the woods' },
    { id: 'prism',  plate: 'PF·004', name: 'Prism',  img: './assets/pony-prism.png',  alt: 'Prism, a chestnut at golden hour' },
    { id: 'sable',  plate: 'PF·005', name: 'Sable',  img: './assets/pony-sable.png',  alt: 'Sable, a dappled grey in show ribbons' },
    { id: 'femme',  plate: 'PF·006', name: 'Femme',  img: './assets/pony-femme.png',  alt: 'Femme, a roan in red velvet light' },
  ]
  const KIND_BY_ID = Object.fromEntries(KINDS.map(k => [k.id, k]))

  // ---------------------------------------------------------- EQUIPMENT TABLES

  // Each slot has a glyph palette keyed 1..9,0,-,= (matches number row).
  const PALETTES = {
    hat: [
      ['🎩','1'],['🌼','2'],['🧢','3'],['👑','4'],['🕶️','5'],['🪩','6'],
      ['🏳️‍🌈','7'],['🏳️‍⚧️','8'],['💋','9'],['🦋','0'],['✨','-'],['🥀','='],
    ],
    glasses: [
      ['🕶️','1'],['👓','2'],['🥽','3'],['🧐','4'],['😎','5'],['👀','6'],
      ['🌟','7'],['💫','8'],['❤️','9'],['💚','0'],['💙','-'],['💜','='],
    ],
    accessory: [
      ['📿','1'],['🎀','2'],['💎','3'],['🔔','4'],['🌹','5'],['🍀','6'],
      ['⭐','7'],['🥇','8'],['🎗️','9'],['🪬','0'],['🧿','-'],['🌻','='],
    ],
    tail: [
      ['🎀','1'],['🌸','2'],['🌟','3'],['🍒','4'],['🦋','5'],['🌼','6'],
      ['💐','7'],['🍓','8'],['🌺','9'],['🌷','0'],['✨','-'],['🌈','='],
    ],
  }
  const SLOTS = ['hat','glasses','accessory','tail']
  const SLOT_LABEL = { hat: 'millinery', glasses: 'optics', accessory: 'tackle', tail: 'tail bow' }

  // ---------------------------------------------------------- STATE

  const STORAGE_KEY = 'ponyforge.sandbox.v1'
  const MAX_HORSES = 12
  const MAX_HATS = 3

  let mode = 'hat'           // current slot mode
  let horses = []            // [{id, kind, x, y, name, hats, glasses, accessory, tail, _el, _x, _y}]
  let strokes = []           // [{pts: [[x,y],...]}]
  let nextId = 1

  // drag/draw transient
  let dragging = null
  let dragId = 0
  let dragOffX = 0, dragOffY = 0
  let dragStartX = 0, dragStartY = 0
  let dragX = 0, dragY = 0
  let didMove = false
  let rafQueued = false
  let altClonePending = false
  let longPressTimer = 0

  let drawing = null         // current stroke being drawn
  let drawingPointerId = -1
  let erasing = false

  let lastFocusedHorse = null
  let ringTargetHorse = null
  let hintFaded = false
  let tidyArmed = false
  let tidyTimer = 0

  const ringHats = []        // ring buttons (rebuilt per mode)

  // ---------------------------------------------------------- HELPERS

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
  const uid = () => 'h' + (nextId++).toString(36) + Math.random().toString(36).slice(2,5)

  function fadeHint() {
    if (hintFaded || !hint) return
    hintFaded = true
    hint.classList.add('is-faded')
  }

  let toastTimer = 0
  function showToast(msg) {
    toast.textContent = msg
    toast.classList.add('is-on')
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => toast.classList.remove('is-on'), 1400)
  }

  // ---------------------------------------------------------- HERD MODEL → DOM

  function makeHorseEl(h) {
    const kind = KIND_BY_ID[h.kind]
    const el = document.createElement('button')
    el.className = 'pony'
    el.type = 'button'
    el.dataset.id = h.id
    el.dataset.kind = h.kind
    el.setAttribute('aria-label', `${kind.name} — drag to move, tap to equip, double-click to name, alt-drag to clone`)

    const plate = document.createElement('span')
    plate.className = 'pony__plate'
    plate.textContent = kind.plate
    el.appendChild(plate)

    const img = document.createElement('img')
    img.src = kind.img
    img.alt = kind.alt
    img.draggable = false
    el.appendChild(img)

    // slot containers
    const sHats = document.createElement('span')
    sHats.className = 'slot slot--hats'
    sHats.dataset.slot = 'hat'
    el.appendChild(sHats)

    for (const slot of ['glasses','accessory','tail']) {
      const s = document.createElement('span')
      s.className = `slot slot--${slot}`
      s.dataset.slot = slot
      el.appendChild(s)
    }

    const name = document.createElement('span')
    name.className = 'pony__name'
    name.contentEditable = 'true'
    name.spellcheck = false
    name.setAttribute('role','textbox')
    name.setAttribute('aria-label', 'Horse name')
    name.textContent = h.name || ''
    el.appendChild(name)

    bindHorseEvents(el, name)
    return el
  }

  function renderSlots(h) {
    const el = h._el
    // hats
    const hatsEl = el.querySelector('.slot--hats')
    hatsEl.innerHTML = ''
    h.hats.slice(0, MAX_HATS).forEach(g => {
      const sp = document.createElement('span')
      sp.className = 'glyph'
      sp.textContent = g
      hatsEl.appendChild(sp)
    })
    // singles
    for (const slot of ['glasses','accessory','tail']) {
      const s = el.querySelector(`.slot--${slot}`)
      s.innerHTML = ''
      if (h[slot]) {
        const sp = document.createElement('span')
        sp.className = 'glyph'
        sp.textContent = h[slot]
        s.appendChild(sp)
      }
    }
  }

  function setXY(h, x, y) {
    h._x = x; h._y = y
    h._el.style.setProperty('--x', `${x}px`)
    h._el.style.setProperty('--y', `${y}px`)
  }

  function sortDepth() {
    const r = paddock.getBoundingClientRect()
    const hgt = r.height || 1
    horses.forEach(h => {
      const y = h._y || 0
      const depth = clamp(0.55 - (y / hgt) * 0.55, 0, 0.55)
      h._el.style.setProperty('--depth', depth.toFixed(3))
      h._el.style.setProperty('--z', String(Math.round(100 + y)))
    })
  }

  function addHorse(data, opts = {}) {
    if (horses.length >= MAX_HORSES) {
      showToast('paddock full')
      return null
    }
    const kind = KIND_BY_ID[data.kind]
    if (!kind) return null
    const h = {
      id: data.id || uid(),
      kind: data.kind,
      x: data.x ?? 100,
      y: data.y ?? 100,
      name: data.name || '',
      hats: Array.isArray(data.hats) ? data.hats.slice(0, MAX_HATS) : [],
      glasses: data.glasses || '',
      accessory: data.accessory || '',
      tail: data.tail || '',
    }
    h._el = makeHorseEl(h)
    herdEl.appendChild(h._el)
    horses.push(h)
    setXY(h, h.x, h.y)
    renderSlots(h)
    if (opts.land && !reduceMotion) {
      h._el.classList.add('is-landing')
      h._el.addEventListener('animationend', () => h._el.classList.remove('is-landing'), { once: true })
    }
    return h
  }

  function removeHorse(h) {
    horses = horses.filter(x => x !== h)
    h._el.remove()
  }

  // ---------------------------------------------------------- DEFAULT LAYOUT

  function defaultLayout() {
    const r = paddock.getBoundingClientRect()
    const w = r.width, h = r.height
    const pw = 150, ph = 84  // approx, real value once rendered
    const cols = 3, rows = 2
    const padX = 32, padTop = 96, padBot = 80
    const cellW = (w - padX * 2) / cols
    const cellH = (h - padTop - padBot) / rows
    const perturb = [
      [ 0.10, -0.18], [-0.14,  0.12], [ 0.18,  0.20],
      [-0.20, -0.12], [ 0.16,  0.18], [-0.08, -0.20],
    ]
    return KINDS.map((k, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const cx = padX + col * cellW + (cellW - pw) / 2
      const cy = padTop + row * cellH + (cellH - ph) / 2
      const [px, py] = perturb[i] || [0, 0]
      const x = clamp(cx + px * cellW * 0.4, 8, w - pw - 8)
      const y = clamp(cy + py * cellH * 0.4, padTop - 40, h - ph - padBot)
      return { kind: k.id, x, y, name: '' }
    })
  }

  // ---------------------------------------------------------- EQUIP

  function equip(h, slot, glyph) {
    if (!h) return
    if (slot === 'hat') {
      if (!glyph) {
        h.hats = []
      } else {
        // toggle: if top hat already equals glyph, pop; else push (cap at 3)
        if (h.hats[h.hats.length - 1] === glyph) {
          h.hats.pop()
        } else {
          h.hats.push(glyph)
          if (h.hats.length > MAX_HATS) h.hats.shift()
        }
      }
    } else {
      // singles toggle
      h[slot] = (h[slot] === glyph || !glyph) ? '' : glyph
    }
    renderSlots(h)
    persist()
    if (slot === 'hat' && !reduceMotion) {
      const el = h._el.querySelector('.slot--hats')
      el.classList.remove('is-landing')
      void el.offsetWidth
      el.classList.add('is-landing')
      el.addEventListener('animationend', () => el.classList.remove('is-landing'), { once: true })
    }
  }

  // ---------------------------------------------------------- RING

  function placeRingHats() {
    const n = ringHats.length
    ringHats.forEach((h, i) => {
      const a = -90 + (360 / n) * i
      h.style.setProperty('--a', `${a}deg`)
    })
  }

  function buildRingForMode() {
    // remove existing
    ringHats.length = 0
    ;[...ring.querySelectorAll('.ring__hat')].forEach(n => n.remove())

    const palette = PALETTES[mode]
    palette.forEach(([glyph, key]) => {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'ring__hat'
      b.dataset.glyph = glyph
      b.dataset.key = key
      b.setAttribute('aria-label', `${glyph} (${key})`)
      const g = document.createElement('span'); g.className = 'g'; g.textContent = glyph
      const k = document.createElement('span'); k.className = 'k'; k.textContent = key
      b.append(g, k)
      b.addEventListener('click', (e) => {
        e.stopPropagation()
        const target = ringTargetHorse || lastFocusedHorse
        if (target) equip(target, mode, glyph)
        // for hat-stack, keep ring open so users can stack quickly
        if (mode !== 'hat') closeRing()
        else updateRingActive()
        if (target) target._el.focus({ preventScroll: true })
      })
      ring.appendChild(b)
      ringHats.push(b)
    })

    // clear button
    const clear = document.createElement('button')
    clear.type = 'button'
    clear.className = 'ring__hat is-clear'
    clear.dataset.key = 'clear'
    clear.setAttribute('aria-label', 'Clear slot')
    const ck = document.createElement('span'); ck.className = 'k'; ck.textContent = '⌫'
    const cg = document.createElement('span'); cg.className = 'g'
    cg.style.fontSize = '10px'
    cg.style.letterSpacing = '0.16em'
    cg.style.textTransform = 'uppercase'
    cg.textContent = 'clear'
    clear.append(cg, ck)
    clear.addEventListener('click', (e) => {
      e.stopPropagation()
      const target = ringTargetHorse || lastFocusedHorse
      if (target) equip(target, mode, '')
      closeRing()
      if (target) target._el.focus({ preventScroll: true })
    })
    ring.appendChild(clear)
    ringHats.push(clear)

    placeRingHats()
    ringCaption.textContent = SLOT_LABEL[mode]
  }

  function updateRingActive() {
    const h = ringTargetHorse
    ringHats.forEach(b => {
      if (b.dataset.key === 'clear') return
      let active = false
      if (h) {
        if (mode === 'hat') active = h.hats.includes(b.dataset.glyph)
        else active = h[mode] === b.dataset.glyph
      }
      b.classList.toggle('is-active', active)
    })
  }

  function isRingOpen() { return ring.classList.contains('is-open') }

  function openRingAt(x, y, h) {
    ringTargetHorse = h || null
    ringTarget.textContent = h ? (h.name || KIND_BY_ID[h.kind].name) : '—'
    updateRingActive()
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
    ringTargetHorse = null
  }

  // ---------------------------------------------------------- HORSE EVENTS

  function bindHorseEvents(el, nameEl) {
    let lastTap = 0

    el.addEventListener('pointerdown', (e) => {
      // ignore the name caption (let contenteditable take over)
      if (e.target === nameEl) return
      if (e.pointerType === 'mouse' && e.button !== 0) return

      const h = horses.find(x => x._el === el)
      if (!h) return
      lastFocusedHorse = h

      // alt-drag clone or long-press clone
      altClonePending = e.altKey

      dragging = h
      dragId = e.pointerId
      didMove = false
      const rect = el.getBoundingClientRect()
      dragOffX = e.clientX - rect.left
      dragOffY = e.clientY - rect.top
      dragStartX = e.clientX
      dragStartY = e.clientY
      dragX = h._x; dragY = h._y

      try { el.setPointerCapture(e.pointerId) } catch (_) {}

      // long-press to clone on touch
      if (e.pointerType === 'touch') {
        clearTimeout(longPressTimer)
        longPressTimer = setTimeout(() => {
          if (dragging === h && !didMove) {
            altClonePending = true
            el.classList.add('is-cloning')
            if (navigator.vibrate) try { navigator.vibrate(15) } catch (_) {}
          }
        }, 480)
      }

      // double tap → focus name editor
      const now = Date.now()
      if (now - lastTap < 300 && !didMove) {
        focusName(nameEl)
      }
      lastTap = now

      e.preventDefault()
    })

    el.addEventListener('pointermove', (e) => {
      if (!dragging || dragging._el !== el || e.pointerId !== dragId) return
      const dx = e.clientX - dragStartX
      const dy = e.clientY - dragStartY
      if (!didMove && Math.hypot(dx, dy) > 4) {
        didMove = true
        clearTimeout(longPressTimer)
        // resolve clone now if armed
        if (altClonePending) {
          // create clone at current home; original starts dragging
          const clone = addHorse({
            kind: dragging.kind,
            x: dragging._x + 18,
            y: dragging._y + 18,
            name: '',
            hats: dragging.hats.slice(),
            glasses: dragging.glasses,
            accessory: dragging.accessory,
            tail: dragging.tail,
          }, { land: true })
          el.classList.remove('is-cloning')
          altClonePending = false
          persist()
          if (clone) showToast('cloned')
        }
        dragging._el.classList.add('is-lifted')
        dragging._el.style.setProperty('--lift', '1')
        paddock.classList.add('is-holding')
        fadeHint()
        if (isRingOpen()) closeRing()
      }
      if (didMove) {
        const r = paddock.getBoundingClientRect()
        const pw = el.offsetWidth, ph = el.offsetHeight
        const x = clamp(e.clientX - r.left - dragOffX, 4, r.width  - pw - 4)
        const y = clamp(e.clientY - r.top  - dragOffY, 4, r.height - ph - 4 - 28) // leave room for name
        dragX = x; dragY = y
        const tilt = clamp(dx * 0.02, -6, 6)
        el.style.setProperty('--r', `${tilt}deg`)
        if (!rafQueued) {
          rafQueued = true
          requestAnimationFrame(() => {
            rafQueued = false
            if (dragging) setXY(dragging, dragX, dragY)
          })
        }
      }
    })

    el.addEventListener('pointerup', (e) => {
      if (!dragging || dragging._el !== el || e.pointerId !== dragId) return
      clearTimeout(longPressTimer)
      const h = dragging
      try { el.releasePointerCapture(dragId) } catch (_) {}
      paddock.classList.remove('is-holding')
      el.classList.remove('is-cloning')

      if (didMove) {
        el.classList.remove('is-lifted')
        el.style.setProperty('--lift', '0')
        el.style.setProperty('--r', '0deg')
        h.x = h._x; h.y = h._y
        sortDepth()
        persist()
        if (!reduceMotion) {
          el.classList.remove('is-landing')
          void el.offsetWidth
          el.classList.add('is-landing')
          el.addEventListener('animationend', () => el.classList.remove('is-landing'), { once: true })
        }
      } else {
        el.classList.remove('is-lifted')
        el.style.setProperty('--lift', '0')
        const rect = el.getBoundingClientRect()
        openRingAt(rect.left + rect.width / 2, rect.top + rect.height / 2, h)
      }
      dragging = null
      altClonePending = false
    })

    el.addEventListener('pointercancel', () => {
      clearTimeout(longPressTimer)
      if (!dragging) return
      const el2 = dragging._el
      el2.classList.remove('is-lifted','is-cloning')
      el2.style.setProperty('--lift', '0')
      el2.style.setProperty('--r', '0deg')
      paddock.classList.remove('is-holding')
      dragging = null
      altClonePending = false
    })

    el.addEventListener('dragstart', (e) => e.preventDefault())
    el.addEventListener('focus', () => {
      const h = horses.find(x => x._el === el)
      if (h) lastFocusedHorse = h
    })

    // double-click → name edit
    el.addEventListener('dblclick', (e) => {
      if (e.target === nameEl) return
      e.preventDefault()
      focusName(nameEl)
    })

    // delete with backspace when focused (not typing in name)
    el.addEventListener('keydown', (e) => {
      if (document.activeElement === nameEl) return
      const h = horses.find(x => x._el === el)
      if (!h) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && horses.length > 1) {
        e.preventDefault()
        removeHorse(h)
        persist()
      }
    })

    // name editing handlers
    nameEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault()
        nameEl.blur()
      }
      e.stopPropagation()
    })
    nameEl.addEventListener('input', () => {
      const h = horses.find(x => x._el === el)
      if (!h) return
      const t = nameEl.textContent.replace(/\s+/g, ' ').slice(0, 20)
      if (t !== nameEl.textContent) nameEl.textContent = t
      h.name = t
    })
    nameEl.addEventListener('blur', () => persist())
    nameEl.addEventListener('pointerdown', (e) => e.stopPropagation())
  }

  function focusName(nameEl) {
    nameEl.focus()
    const range = document.createRange()
    range.selectNodeContents(nameEl)
    range.collapse(false)
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(range)
  }

  // ---------------------------------------------------------- INK CANVAS

  function resizeCanvas() {
    const r = paddock.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width  = Math.round(r.width * dpr)
    canvas.height = Math.round(r.height * dpr)
    canvas.style.width = r.width + 'px'
    canvas.style.height = r.height + 'px'
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    redrawInk()
  }

  function redrawInk() {
    const r = paddock.getBoundingClientRect()
    ctx.clearRect(0, 0, r.width, r.height)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#8a2a1e'
    ctx.lineWidth = 1.6
    strokes.forEach(s => {
      if (!s.pts || s.pts.length < 2) return
      ctx.beginPath()
      ctx.moveTo(s.pts[0][0], s.pts[0][1])
      for (let i = 1; i < s.pts.length; i++) ctx.lineTo(s.pts[i][0], s.pts[i][1])
      ctx.stroke()
    })
  }

  function paddockLocal(e) {
    const r = paddock.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top]
  }

  function eraseAt(x, y) {
    const r2 = 22 * 22
    let removed = 0
    strokes = strokes.filter(s => {
      const hit = s.pts.some(([px, py]) => {
        const dx = px - x, dy = py - y
        return dx * dx + dy * dy < r2
      })
      if (hit) removed++
      return !hit
    })
    if (removed > 0) {
      redrawInk()
      persist()
    }
  }

  paddock.addEventListener('pointerdown', (e) => {
    // ignore if clicking horse, ring, name, or controls
    if (e.target.closest('.pony') || e.target.closest('.ring') ||
        e.target.closest('.tag') || e.target.closest('.tags')) return

    // close ring if open
    if (isRingOpen()) {
      closeRing()
      return
    }

    // shift+right-click → erase
    if (e.shiftKey && e.button === 2) {
      const [x, y] = paddockLocal(e)
      eraseAt(x, y)
      e.preventDefault()
      return
    }

    // shift+drag → draw
    if (e.shiftKey && (e.button === 0 || e.pointerType === 'touch' || e.pointerType === 'pen')) {
      drawing = { pts: [paddockLocal(e)] }
      drawingPointerId = e.pointerId
      strokes.push(drawing)
      paddock.classList.add('is-drawing')
      try { paddock.setPointerCapture(e.pointerId) } catch (_) {}
      e.preventDefault()
    }
  })

  paddock.addEventListener('pointermove', (e) => {
    if (!drawing || e.pointerId !== drawingPointerId) return
    const pt = paddockLocal(e)
    const last = drawing.pts[drawing.pts.length - 1]
    if (Math.hypot(pt[0]-last[0], pt[1]-last[1]) < 1.5) return
    drawing.pts.push(pt)
    // incremental draw
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#8a2a1e'
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.moveTo(last[0], last[1])
    ctx.lineTo(pt[0], pt[1])
    ctx.stroke()
  })

  function endDraw(e) {
    if (!drawing || e.pointerId !== drawingPointerId) return
    paddock.classList.remove('is-drawing')
    if (drawing.pts.length < 2) strokes.pop()
    drawing = null
    drawingPointerId = -1
    persist()
  }
  paddock.addEventListener('pointerup', endDraw)
  paddock.addEventListener('pointercancel', endDraw)

  paddock.addEventListener('contextmenu', (e) => {
    if (e.shiftKey) e.preventDefault()
  })

  // ---------------------------------------------------------- KEYBOARD

  function cycleMode(dir = 1) {
    const i = SLOTS.indexOf(mode)
    mode = SLOTS[(i + dir + SLOTS.length) % SLOTS.length]
    modeLabel.textContent = mode === 'accessory' ? 'tackle' : mode
    buildRingForMode()
    if (isRingOpen()) updateRingActive()
    showToast(`slot · ${SLOT_LABEL[mode]}`)
  }

  document.addEventListener('keydown', (e) => {
    const focused = document.activeElement
    const inEditable = focused && (focused.classList?.contains('pony__name'))
    if (inEditable) return  // let the name editor own keys

    // save/share — Cmd/Ctrl+S, Cmd/Ctrl+Shift+S
    if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) {
      e.preventDefault()
      if (e.shiftKey) shareLink()
      else exportPNG()
      return
    }

    if (e.key === 'Tab' && !isRingOpen()) {
      e.preventDefault()
      cycleMode(e.shiftKey ? -1 : 1)
      return
    }

    if (e.key === 'Escape') {
      if (isRingOpen()) {
        e.preventDefault()
        closeRing()
        if (lastFocusedHorse) lastFocusedHorse._el.focus({ preventScroll: true })
        return
      }
      if (tidyArmed) { disarmTidy(); return }
    }

    // hat keys (1-9, 0, -, =)
    const palette = PALETTES[mode]
    const found = palette.find(([, k]) => k === e.key)
    if (found) {
      const target = ringTargetHorse
        || (focused && focused.classList?.contains('pony') ? horses.find(h => h._el === focused) : lastFocusedHorse)
      if (target) {
        e.preventDefault()
        equip(target, mode, found[0])
        if (isRingOpen()) updateRingActive()
        fadeHint()
      }
      return
    }

    if (focused && focused.classList?.contains('pony')) {
      const h = horses.find(x => x._el === focused)
      if (!h) return
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        const r = focused.getBoundingClientRect()
        openRingAt(r.left + r.width / 2, r.top + r.height / 2, h)
        return
      }
      if (e.key.startsWith('Arrow')) {
        e.preventDefault()
        const step = e.shiftKey ? 32 : 8
        const r = paddock.getBoundingClientRect()
        const pw = focused.offsetWidth, ph = focused.offsetHeight
        let x = h._x, y = h._y
        if (e.key === 'ArrowLeft')  x -= step
        if (e.key === 'ArrowRight') x += step
        if (e.key === 'ArrowUp')    y -= step
        if (e.key === 'ArrowDown')  y += step
        x = clamp(x, 4, r.width - pw - 4)
        y = clamp(y, 4, r.height - ph - 4 - 28)
        setXY(h, x, y); h.x = x; h.y = y
        sortDepth(); persist()
        fadeHint()
        return
      }
    }

    if ((e.key === 'r' || e.key === 'R') && !isRingOpen()) {
      e.preventDefault()
      recall()
    }
  })

  // ---------------------------------------------------------- RECALL / TIDY

  let homePositions = new Map() // kind index → [x,y]

  function snapshotHome() {
    homePositions.clear()
    const layout = defaultLayout()
    layout.forEach((p, i) => homePositions.set(i, [p.x, p.y]))
  }

  function recall() {
    closeRing()
    // recall first instance of each kind to its home; clones snap into a tight cluster
    const seen = new Set()
    const layout = defaultLayout()
    const layoutByKind = {}
    layout.forEach(l => { layoutByKind[l.kind] = [l.x, l.y] })

    horses.forEach(h => {
      if (!seen.has(h.kind) && layoutByKind[h.kind]) {
        const [hx, hy] = layoutByKind[h.kind]
        setXY(h, hx, hy); h.x = hx; h.y = hy
        seen.add(h.kind)
      } else {
        // tuck clones nearby with small offset
        const [hx, hy] = layoutByKind[h.kind] || [120, 120]
        const i = horses.indexOf(h)
        const off = (i % 4) * 14
        setXY(h, hx + 24 + off, hy + 24 + off)
        h.x = h._x; h.y = h._y
      }
      if (!reduceMotion) {
        h._el.classList.remove('is-landing')
        void h._el.offsetWidth
        h._el.classList.add('is-landing')
      }
    })
    sortDepth()
    persist()
  }
  recallBtn.addEventListener('click', recall)

  function disarmTidy() {
    tidyArmed = false
    tidyBtn.classList.remove('is-armed')
    tidyLabel.textContent = 'tidy up'
    clearTimeout(tidyTimer)
  }
  function armTidy() {
    tidyArmed = true
    tidyBtn.classList.add('is-armed')
    tidyLabel.textContent = 'sure?'
    clearTimeout(tidyTimer)
    tidyTimer = setTimeout(disarmTidy, 2400)
  }
  tidyBtn.addEventListener('click', () => {
    if (!tidyArmed) { armTidy(); return }
    disarmTidy()
    // wipe everything: remove clones, clear equipment, clear names, clear strokes, recall
    horses.slice().forEach(h => h._el.remove())
    horses = []
    strokes = []
    redrawInk()
    seedDefault()
    persist()
    showToast('paddock tidied')
  })

  // ---------------------------------------------------------- MODE SWITCH BUTTON

  modeBtn.addEventListener('click', () => cycleMode(1))

  // ---------------------------------------------------------- PERSIST

  function snapshot() {
    return {
      v: 1,
      mode,
      horses: horses.map(h => ({
        id: h.id, kind: h.kind, x: Math.round(h._x), y: Math.round(h._y),
        name: h.name || '',
        hats: h.hats.slice(),
        glasses: h.glasses, accessory: h.accessory, tail: h.tail,
      })),
      strokes: strokes.map(s => ({ pts: s.pts.map(([x,y]) => [Math.round(x), Math.round(y)]) })),
      // store paddock dims so loaders on different screens can scale
      w: Math.round(paddock.getBoundingClientRect().width),
      h: Math.round(paddock.getBoundingClientRect().height),
    }
  }

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot())) } catch (_) {}
  }

  function restoreFrom(data) {
    if (!data || !Array.isArray(data.horses)) return false
    // clear existing
    horses.slice().forEach(h => h._el.remove())
    horses = []
    strokes = []

    // rescale if the paddock dimensions differ
    const r = paddock.getBoundingClientRect()
    const sx = data.w ? r.width / data.w : 1
    const sy = data.h ? r.height / data.h : 1
    const s = Math.min(sx, sy) || 1

    data.horses.slice(0, MAX_HORSES).forEach(d => {
      addHorse({
        id: d.id,
        kind: d.kind,
        x: clamp((d.x || 0) * s, 4, r.width - 160),
        y: clamp((d.y || 0) * s, 4, r.height - 110),
        name: d.name || '',
        hats: Array.isArray(d.hats) ? d.hats : [],
        glasses: d.glasses || '',
        accessory: d.accessory || '',
        tail: d.tail || '',
      })
    })
    if (Array.isArray(data.strokes)) {
      strokes = data.strokes.map(st => ({
        pts: (st.pts || []).map(([x,y]) => [x * s, y * s]),
      }))
    }
    if (data.mode && SLOTS.includes(data.mode)) {
      mode = data.mode
      modeLabel.textContent = mode === 'accessory' ? 'tackle' : mode
      buildRingForMode()
    }
    redrawInk()
    sortDepth()
    return true
  }

  function loadStored() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return false
      const data = JSON.parse(raw)
      return restoreFrom(data)
    } catch (_) { return false }
  }

  // ---------------------------------------------------------- HASH SHARE

  function encodeHash(data) {
    const json = JSON.stringify(data)
    // url-safe base64
    const b64 = btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
    return b64
  }
  function decodeHash(s) {
    try {
      const b64 = s.replace(/-/g,'+').replace(/_/g,'/')
      const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
      const json = decodeURIComponent(escape(atob(b64 + pad)))
      return JSON.parse(json)
    } catch (_) { return null }
  }

  function shareLink() {
    const data = snapshot()
    const hash = encodeHash(data)
    const url = `${location.origin}${location.pathname}#s=${hash}`
    history.replaceState(null, '', `#s=${hash}`)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(
        () => showToast('link copied'),
        () => showToast('link in url')
      )
    } else {
      showToast('link in url')
    }
  }
  shareBtn.addEventListener('click', shareLink)

  // ---------------------------------------------------------- PNG EXPORT

  function exportPNG() {
    const r = paddock.getBoundingClientRect()
    const W = Math.round(r.width)
    const H = Math.round(r.height)
    const scale = 2

    const c = document.createElement('canvas')
    c.width = W * scale
    c.height = H * scale
    const x = c.getContext('2d')
    x.scale(scale, scale)

    // paper background
    x.fillStyle = '#f3efe6'
    x.fillRect(0, 0, W, H)
    // grid
    x.fillStyle = 'rgba(20,19,15,0.025)'
    for (let y = 31; y < H; y += 32) x.fillRect(0, y, W, 1)
    x.fillStyle = 'rgba(20,19,15,0.045)'
    for (let xx = 0; xx < W; xx += 64) x.fillRect(xx, 0, 1, H)
    for (let yy = 0; yy < H; yy += 64) x.fillRect(0, yy, W, 1)
    // border
    x.strokeStyle = '#14130f'
    x.lineWidth = 1
    x.strokeRect(0.5, 0.5, W - 1, H - 1)

    // ink strokes
    x.strokeStyle = '#8a2a1e'
    x.lineWidth = 1.6
    x.lineCap = 'round'
    x.lineJoin = 'round'
    strokes.forEach(s => {
      if (!s.pts || s.pts.length < 2) return
      x.beginPath()
      x.moveTo(s.pts[0][0], s.pts[0][1])
      for (let i = 1; i < s.pts.length; i++) x.lineTo(s.pts[i][0], s.pts[i][1])
      x.stroke()
    })

    // stamp (top-left)
    x.fillStyle = '#14130f'
    x.font = '500 32px Fraunces, Georgia, serif'
    x.textBaseline = 'top'
    x.fillText('Ponyforge', 22, 22)
    x.fillStyle = '#7c7768'
    x.font = '500 10px JetBrains Mono, monospace'
    x.fillText('STUDBOOK & MILLINERY · MMXXVI', 22, 60)

    // sort horses back-to-front by y
    const sorted = horses.slice().sort((a, b) => a._y - b._y)

    const drawHorses = sorted.map(h => () => {
      const hx = h._x, hy = h._y
      const el = h._el
      const pw = el.offsetWidth, ph = el.offsetHeight
      const depth = clamp(0.55 - (hy / H) * 0.55, 0, 0.55)
      const baseScale = 1 - depth * 0.20
      const dw = pw * baseScale
      const dh = ph * baseScale

      // shadow
      const shadowGrad = x.createRadialGradient(
        hx + dw / 2, hy + dh + 4, 1,
        hx + dw / 2, hy + dh + 4, dw * 0.5
      )
      shadowGrad.addColorStop(0, 'rgba(20,19,15,0.32)')
      shadowGrad.addColorStop(1, 'rgba(20,19,15,0)')
      x.fillStyle = shadowGrad
      x.beginPath()
      x.ellipse(hx + dw / 2, hy + dh + 4, dw * 0.46, 6, 0, 0, Math.PI * 2)
      x.fill()

      // body
      const img = el.querySelector('img')
      if (img && img.complete && img.naturalWidth) {
        x.save()
        x.filter = `saturate(${1 - depth * 0.15}) brightness(${1 - depth * 0.04})`
        x.drawImage(img, hx, hy, dw, dh)
        x.restore()
      } else {
        x.fillStyle = '#14130f'
        x.fillRect(hx, hy, dw, dh)
      }

      // plate
      x.fillStyle = 'rgba(20,19,15,0.55)'
      x.fillRect(hx + 6, hy + 6, 50, 14)
      x.fillStyle = '#f3efe6'
      x.font = '500 9px JetBrains Mono, monospace'
      x.textBaseline = 'top'
      x.fillText(KIND_BY_ID[h.kind].plate, hx + 9, hy + 8)

      // slot glyphs - we paint emoji as text
      const cx = hx + dw / 2

      // glasses: 32% height
      if (h.glasses) {
        x.font = `${Math.round(dh * 0.30)}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`
        x.textAlign = 'center'
        x.textBaseline = 'middle'
        x.fillText(h.glasses, cx, hy + dh * 0.32)
      }
      // accessory: 62%
      if (h.accessory) {
        x.font = `${Math.round(dh * 0.30)}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`
        x.textAlign = 'center'
        x.textBaseline = 'middle'
        x.fillText(h.accessory, cx, hy + dh * 0.62)
      }
      // tail: right edge
      if (h.tail) {
        x.save()
        x.translate(hx + dw - 4, hy + dh * 0.68)
        x.rotate(-12 * Math.PI / 180)
        x.font = `${Math.round(dh * 0.26)}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`
        x.textAlign = 'center'
        x.textBaseline = 'middle'
        x.fillText(h.tail, 0, 0)
        x.restore()
      }
      // hats stacked above head
      if (h.hats.length) {
        const size = Math.round(dh * 0.42)
        x.font = `${size}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`
        x.textAlign = 'center'
        x.textBaseline = 'bottom'
        let y = hy - 2
        h.hats.forEach((g) => {
          x.fillText(g, cx, y)
          y -= size * 0.7
        })
      }

      // name caption
      if (h.name) {
        x.font = '500 10px JetBrains Mono, monospace'
        x.textAlign = 'center'
        x.textBaseline = 'top'
        const text = h.name.toUpperCase()
        const tw = x.measureText(text).width
        const px = cx - tw / 2 - 6
        const py = hy + dh + 4
        x.fillStyle = '#f3efe6'
        x.fillRect(px, py, tw + 12, 16)
        x.strokeStyle = '#14130f'
        x.lineWidth = 1
        x.beginPath()
        x.moveTo(px, py + 16.5)
        x.lineTo(px + tw + 12, py + 16.5)
        x.stroke()
        x.fillStyle = '#14130f'
        x.fillText(text, cx, py + 3)
      }
    })
    drawHorses.forEach(fn => fn())

    c.toBlob((blob) => {
      if (!blob) { showToast('export failed'); return }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ponyforge-${Date.now()}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      showToast('saved')
    }, 'image/png')
  }
  saveBtn.addEventListener('click', exportPNG)

  // ---------------------------------------------------------- INIT

  function seedDefault() {
    defaultLayout().forEach(p => addHorse(p))
  }

  function init() {
    resizeCanvas()
    buildRingForMode()

    // try hash first, then localStorage, then defaults
    let restored = false
    if (location.hash.startsWith('#s=')) {
      const data = decodeHash(location.hash.slice(3))
      if (data) restored = restoreFrom(data)
    }
    if (!restored) restored = loadStored()
    if (!restored) seedDefault()

    sortDepth()
    snapshotHome()
  }

  if (document.readyState === 'complete') {
    requestAnimationFrame(init)
  } else {
    window.addEventListener('load', () => requestAnimationFrame(init), { once: true })
  }

  // resize: clamp positions, rescale canvas + ink
  let resizeQ = false
  window.addEventListener('resize', () => {
    if (resizeQ) return
    resizeQ = true
    requestAnimationFrame(() => {
      resizeQ = false
      const r = paddock.getBoundingClientRect()
      horses.forEach(h => {
        const pw = h._el.offsetWidth, ph = h._el.offsetHeight
        const x = clamp(h._x || 0, 4, r.width  - pw - 4)
        const y = clamp(h._y || 0, 4, r.height - ph - 4 - 28)
        setXY(h, x, y); h.x = x; h.y = y
      })
      sortDepth()
      resizeCanvas()
    })
  })

  // hash change → reload
  window.addEventListener('hashchange', () => {
    if (location.hash.startsWith('#s=')) {
      const data = decodeHash(location.hash.slice(3))
      if (data && restoreFrom(data)) showToast('scene loaded')
    }
  })
})()
