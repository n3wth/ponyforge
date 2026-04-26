// Ponyforge — integrated build.
//
// Foundation: JUICE physics (rAF integrator, fling, walls, pair collisions,
// camera shake, Web Audio). On top: SANDBOX (data-driven herd, stacked hats
// up to 3, alt-drag clone up to 12, editable name, Backspace delete,
// Cmd+S PNG, Cmd+Shift+S share hash). Sprinkled in: EMERGENT (hat combos,
// horse moods that reject wrong hats, click counters with private names,
// PONY/RIDE letter codes, idle turn/swap, night paper after 23:00). Once:
// SHOW (G triggers a 14-second procession; ESC aborts; witness stamp
// persists). Tiny life signs from LIVING: gaze tracking + breath cycle.

(() => {
  'use strict'

  const paddock    = document.getElementById('paddock')
  const herdEl     = document.getElementById('herd')
  const ring       = document.getElementById('ring')
  const ringTarget = document.getElementById('ringTarget')
  const recallBtn  = document.getElementById('recall')
  const muteBtn    = document.getElementById('mute')
  const hint       = document.getElementById('hint')
  const toast      = document.getElementById('toast')
  const procEl     = document.getElementById('procession')
  const procName   = procEl.querySelector('.procession__name')
  const procBio    = procEl.querySelector('.procession__bio')
  const procCount  = document.getElementById('processionCounter')
  const witnessEl  = document.getElementById('witness')
  const ringHats   = [...document.querySelectorAll('.ring__hat')]

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // ---------------------------------------------------------- KINDS

  const KINDS = [
    { id: 'iris',   plate: 'PF·001', name: 'Iris',   defaultHat: '🏳️‍🌈', img: './assets/pony-iris.png',   alt: 'Iris, a dark bay mare with braided forelock' },
    { id: 'vesper', plate: 'PF·002', name: 'Vesper', defaultHat: '💋',     img: './assets/pony-vesper.png', alt: 'Vesper, a roan mare at dusk' },
    { id: 'onyx',   plate: 'PF·003', name: 'Onyx',   defaultHat: '🦋',     img: './assets/pony-onyx.png',   alt: 'Onyx, a black gelding in the woods' },
    { id: 'prism',  plate: 'PF·004', name: 'Prism',  defaultHat: '✨',     img: './assets/pony-prism.png',  alt: 'Prism, a chestnut at golden hour' },
    { id: 'sable',  plate: 'PF·005', name: 'Sable',  defaultHat: '🏳️‍⚧️', img: './assets/pony-sable.png',  alt: 'Sable, a dappled grey in show ribbons' },
    { id: 'femme',  plate: 'PF·006', name: 'Femme',  defaultHat: '🥀',     img: './assets/pony-femme.png',  alt: 'Femme, a roan in red velvet light' },
  ]
  const KIND_BY_ID = Object.fromEntries(KINDS.map(k => [k.id, k]))

  // Bios for the procession.
  const BIOS = {
    Iris:   'foaled in fog · prefers the long way home',
    Vesper: 'shows up at dusk · answers to a whistle',
    Onyx:   'walks the woods at the back of the herd',
    Prism:  'faster on the turn than on the straight',
    Sable:  'three blue ribbons · one stolen apple',
    Femme:  'velvet light · a rose in her teeth',
  }

  // Mood: which hats get shaken off after ~1.4s.
  const REJECT = {
    Vesper: ['🧢'],
    Onyx:   ['🎩'],
    Prism:  ['🥀'],
    Sable:  ['🧢'],
    Femme:  ['🕶️'],
    Iris:   [],
  }

  // Private "seen" names, indexed by kind order.
  const HUSHED = ['mira', 'juno', 'echo', 'wren', 'lark', 'sol']

  // ---------------------------------------------------------- STATE

  const STORAGE_KEY = 'ponyforge.v1'
  const TAPS_KEY    = 'pf.taps'
  const WITNESS_KEY = 'pf.witnessed'
  const MAX_HORSES  = 12
  const MAX_HATS    = 3

  /** @type {Array<HorseRecord>} */
  let horses = []
  let nextId = 1
  const home = new Map()    // horse._key → [x, y]

  // drag transient
  let dragging = null
  let dragId = 0
  let dragOffX = 0, dragOffY = 0
  let dragStartX = 0, dragStartY = 0
  let didMove = false
  let altClonePending = false
  let velSamples = []

  // ring state
  let ringTargetHorse = null
  let lastFocusedHorse = null
  let hintFaded = false

  // camera shake
  let shakeAmp = 0
  let shakeUntil = 0

  // gaze
  let cursorX = -1, cursorY = -1

  // taps
  let taps = (() => { try { return JSON.parse(localStorage.getItem(TAPS_KEY) || '{}') } catch (_) { return {} } })()

  // ---------------------------------------------------------- HELPERS

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
  const now   = () => performance.now()
  const uid   = () => 'h' + (nextId++).toString(36)

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

  function setXY(h, x, y) {
    h._x = x; h._y = y
    h._el.style.setProperty('--x', `${x}px`)
    h._el.style.setProperty('--y', `${y}px`)
  }
  function setScale(h, sx, sy) {
    h._sx = sx; h._sy = sy
    h._el.style.setProperty('--sx', sx.toFixed(3))
    h._el.style.setProperty('--sy', sy.toFixed(3))
  }
  function setRot(h, r) {
    h._r = r
    h._el.style.setProperty('--r', `${r.toFixed(2)}deg`)
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

  // ---------------------------------------------------------- HORSE DOM

  function makeHorseEl(h) {
    const kind = KIND_BY_ID[h.kind]
    const el = document.createElement('button')
    el.className = 'pony'
    el.type = 'button'
    el.dataset.id = h.id
    el.dataset.kind = h.kind
    el.dataset.name = h.name || kind.name
    el.setAttribute('aria-label',
      `${h.name || kind.name} — drag to move, tap for hats, double-click to rename, alt-drag to clone`)

    const plate = document.createElement('span')
    plate.className = 'pony__plate'
    plate.textContent = kind.plate
    el.appendChild(plate)

    const img = document.createElement('img')
    img.src = kind.img
    img.alt = kind.alt
    img.draggable = false
    el.appendChild(img)

    const stack = document.createElement('span')
    stack.className = 'hat-stack'
    el.appendChild(stack)

    const name = document.createElement('span')
    name.className = 'pony__name'
    name.contentEditable = 'true'
    name.spellcheck = false
    name.setAttribute('role', 'textbox')
    name.setAttribute('aria-label', 'Horse name')
    name.textContent = h.name || ''
    el.appendChild(name)

    const note = document.createElement('span')
    note.className = 'pony__note'
    el.appendChild(note)

    bindHorseEvents(el, name, h)
    return el
  }

  function renderHats(h) {
    const stack = h._el.querySelector('.hat-stack')
    stack.innerHTML = ''
    h.hats.slice(0, MAX_HATS).forEach(g => {
      const sp = document.createElement('span')
      sp.className = 'hat'
      sp.textContent = g
      stack.appendChild(sp)
    })
    // top hat sets data-hat for ring active state
    h._el.dataset.hat = h.hats[h.hats.length - 1] || ''
  }

  function renderNote(h) {
    const note = h._el.querySelector('.pony__note')
    const n = taps[h.kind] || 0
    if (n < 25) {
      note.textContent = ''
      h._el.classList.remove('is-seen')
      return
    }
    if (n >= 100) {
      const idx = KINDS.findIndex(k => k.id === h.kind)
      const hush = HUSHED[idx % HUSHED.length]
      note.innerHTML = `<span class="nt">·</span> ${hush} <span class="nt">·</span>`
    } else if (n >= 50) {
      note.textContent = `(seen ${n})`
    } else {
      note.textContent = '(seen)'
    }
    requestAnimationFrame(() => h._el.classList.add('is-seen'))
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
      _key: data.id || uid(),
      name: data.name || '',
      hats: Array.isArray(data.hats) ? data.hats.slice(0, MAX_HATS) : [kind.defaultHat],
      _isOriginal: !!opts.original,
      _x: data.x || 0, _y: data.y || 0,
      _vx: 0, _vy: 0,
      _sx: 1, _sy: 1, _r: 0,
      _mass: 0.9 + Math.random() * 0.4,
      _radius: 60,
      _el: null,
    }
    h._el = makeHorseEl(h)
    herdEl.appendChild(h._el)
    horses.push(h)
    renderHats(h)
    renderNote(h)
    setXY(h, h._x, h._y)
    setScale(h, 1, 1)
    setRot(h, 0)
    h._radius = (h._el.offsetWidth || 150) * 0.42
    return h
  }

  function removeHorse(h) {
    if (h._isOriginal) return false
    const i = horses.indexOf(h)
    if (i === -1) return false
    horses.splice(i, 1)
    h._el.remove()
    return true
  }

  // ---------------------------------------------------------- DEFAULT LAYOUT

  function defaultLayout() {
    const r = paddock.getBoundingClientRect()
    const w = r.width, h = r.height
    const probeW = 150, probeH = 84
    const cols = 3, rows = 2
    const padX = 32, padTop = 96, padBot = 56
    const cellW = (w - padX * 2) / cols
    const cellH = (h - padTop - padBot) / rows
    const perturb = [
      [ 0.10, -0.18], [-0.14,  0.12], [ 0.18,  0.20],
      [-0.20, -0.12], [ 0.16,  0.18], [-0.08, -0.20],
    ]
    return KINDS.map((k, i) => {
      const col = i % cols, row = Math.floor(i / cols)
      const cx = padX + col * cellW + (cellW - probeW) / 2
      const cy = padTop + row * cellH + (cellH - probeH) / 2
      const [px, py] = perturb[i]
      const x = clamp(cx + px * cellW * 0.4, 8, w - probeW - 8)
      const y = clamp(cy + py * cellH * 0.4, padTop - 40, h - probeH - padBot)
      return { kind: k.id, x, y }
    })
  }

  function snapshotHome() {
    home.clear()
    const layout = defaultLayout()
    layout.forEach(p => home.set(p.kind, [p.x, p.y]))
  }

  // ---------------------------------------------------------- AUDIO

  let actx = null, masterGain = null, audioReady = false, muted = false

  function ensureAudio() {
    if (audioReady || muted || reduceMotion) return
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (!Ctx) return
      actx = new Ctx()
      masterGain = actx.createGain()
      masterGain.gain.value = 0.15
      masterGain.connect(actx.destination)
      audioReady = true
    } catch (_) {}
  }

  function blip({ freq = 440, type = 'sine', dur = 0.08, gain = 1, attack = 0.005, release = 0.06, slide = 0 }) {
    if (!audioReady || muted) return
    const t = actx.currentTime
    const o = actx.createOscillator()
    const g = actx.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur)
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(gain, t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + release)
    o.connect(g).connect(masterGain)
    o.start(t)
    o.stop(t + dur + release + 0.02)
  }

  function noiseBurst({ dur = 0.08, gain = 0.6, lpf = 1200 }) {
    if (!audioReady || muted) return
    const t = actx.currentTime
    const len = Math.max(1, Math.floor(actx.sampleRate * dur))
    const buf = actx.createBuffer(1, len, actx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
    const src = actx.createBufferSource()
    src.buffer = buf
    const f = actx.createBiquadFilter()
    f.type = 'lowpass'; f.frequency.value = lpf
    const g = actx.createGain()
    g.gain.value = gain
    src.connect(f).connect(g).connect(masterGain)
    src.start(t)
  }

  const sfx = {
    pickup () { blip({ freq: 880, type: 'triangle', dur: 0.04, gain: 0.5, release: 0.04 }) },
    drop   () { blip({ freq: 110, type: 'sine',     dur: 0.10, gain: 0.7, slide: -40, release: 0.08 }) },
    wall   () { blip({ freq: 220, type: 'square',   dur: 0.05, gain: 0.35, slide: -60, release: 0.05 }) },
    collide(pitch) {
      blip({ freq: pitch, type: 'triangle', dur: 0.12, gain: 0.5, release: 0.12 })
      blip({ freq: pitch * 2.01, type: 'sine', dur: 0.06, gain: 0.2, release: 0.08 })
    },
    hatLand() { noiseBurst({ dur: 0.12, gain: 0.45, lpf: 2400 }) },
  }

  // ---------------------------------------------------------- PHYSICS

  const FRICTION       = 3.2
  const WALL_REST      = 0.55
  const PAIR_REST      = 0.35
  const MIN_BOUNCE     = 70
  const SQUASH_K       = 0.0009
  const SQUASH_RECOVER = 8.0
  const TILT_RECOVER   = 7.0

  function bounds() {
    const r = paddock.getBoundingClientRect()
    return { w: r.width, h: r.height }
  }

  let lastT = 0
  function tick(t) {
    if (!lastT) lastT = t
    const dt = Math.min(0.040, (t - lastT) / 1000)
    lastT = t

    if (!reduceMotion && !showState.running) integrate(dt)
    updateShake(t)
    updateBreath(t)
    updateGaze()

    requestAnimationFrame(tick)
  }

  function integrate(dt) {
    const { w, h } = bounds()

    for (const p of horses) {
      if (p === dragging) continue
      if (Math.abs(p._vx) < 0.5 && Math.abs(p._vy) < 0.5) {
        p._vx = 0; p._vy = 0
      } else {
        const k = Math.exp(-FRICTION * dt)
        p._vx *= k; p._vy *= k

        let nx = p._x + p._vx * dt
        let ny = p._y + p._vy * dt
        const pw = p._el.offsetWidth, ph = p._el.offsetHeight
        const minX = 4, minY = 4
        const maxX = w - pw - 4, maxY = h - ph - 4 - 28

        let bounced = false, bounceSpeed = 0
        if (nx < minX) { nx = minX; bounceSpeed = Math.max(bounceSpeed, Math.abs(p._vx)); p._vx = -p._vx * WALL_REST; bounced = true }
        else if (nx > maxX) { nx = maxX; bounceSpeed = Math.max(bounceSpeed, Math.abs(p._vx)); p._vx = -p._vx * WALL_REST; bounced = true }
        if (ny < minY) { ny = minY; bounceSpeed = Math.max(bounceSpeed, Math.abs(p._vy)); p._vy = -p._vy * WALL_REST; bounced = true }
        else if (ny > maxY) { ny = maxY; bounceSpeed = Math.max(bounceSpeed, Math.abs(p._vy)); p._vy = -p._vy * WALL_REST; bounced = true }

        if (bounced && bounceSpeed > MIN_BOUNCE) {
          sfx.wall()
          if (bounceSpeed > 600) shake(Math.min(5, bounceSpeed * 0.005))
          const amt = Math.min(0.22, bounceSpeed * SQUASH_K * 1.2)
          if (Math.abs(p._vx) > Math.abs(p._vy)) { p._sx = 1 - amt; p._sy = 1 + amt * 0.6 }
          else { p._sy = 1 - amt; p._sx = 1 + amt * 0.6 }
        }
        p._x = nx; p._y = ny
      }
    }

    // pair collisions
    for (let i = 0; i < horses.length; i++) {
      for (let j = i + 1; j < horses.length; j++) {
        resolvePair(horses[i], horses[j])
      }
    }

    // squash recovery + write transforms
    for (const p of horses) {
      if (p === dragging) continue
      const k = 1 - Math.exp(-SQUASH_RECOVER * dt)
      p._sx += (1 - p._sx) * k
      p._sy += (1 - p._sy) * k
      const tk = 1 - Math.exp(-TILT_RECOVER * dt)
      p._r += (0 - p._r) * tk
      setScale(p, p._sx, p._sy)
      setRot(p, p._r)
      p._el.style.setProperty('--x', `${p._x}px`)
      p._el.style.setProperty('--y', `${p._y}px`)
    }

    sortDepth()
  }

  function resolvePair(a, b) {
    const aw = a._el.offsetWidth, ah = a._el.offsetHeight
    const bw = b._el.offsetWidth, bh = b._el.offsetHeight
    const acx = a._x + aw / 2, acy = a._y + ah / 2
    const bcx = b._x + bw / 2, bcy = b._y + bh / 2
    const dx = bcx - acx, dy = bcy - acy
    const dist = Math.hypot(dx, dy) || 0.0001
    const minDist = a._radius + b._radius
    if (dist >= minDist) return
    const overlap = minDist - dist
    const nx = dx / dist, ny = dy / dist
    const totalM = a._mass + b._mass
    const aShare = b._mass / totalM
    const bShare = a._mass / totalM

    if (a !== dragging) { a._x -= nx * overlap * aShare; a._y -= ny * overlap * aShare }
    else { b._x += nx * overlap; b._y += ny * overlap }
    if (b !== dragging) { b._x += nx * overlap * bShare; b._y += ny * overlap * bShare }
    else { a._x -= nx * overlap; a._y -= ny * overlap }

    const va = a._vx * nx + a._vy * ny
    const vb = b._vx * nx + b._vy * ny
    if (va - vb < 0) return
    const impulse = (1 + PAIR_REST) * (va - vb) / totalM
    if (a !== dragging) { a._vx -= impulse * b._mass * nx; a._vy -= impulse * b._mass * ny }
    if (b !== dragging) { b._vx += impulse * a._mass * nx; b._vy += impulse * a._mass * ny }

    const relSpeed = Math.abs(va - vb)
    if (relSpeed > MIN_BOUNCE) {
      const pitch = clamp(900 / Math.sqrt(a._mass + b._mass), 280, 1300)
      sfx.collide(pitch + (Math.random() - 0.5) * 80)
      if (relSpeed > 700) shake(Math.min(4, relSpeed * 0.004))
      const amt = Math.min(0.18, relSpeed * SQUASH_K)
      a._sx = 1 - amt; a._sy = 1 + amt * 0.6
      b._sx = 1 - amt; b._sy = 1 + amt * 0.6
    }
  }

  function shake(amp) {
    if (reduceMotion) return
    shakeAmp = Math.max(shakeAmp, Math.min(6, amp))
    shakeUntil = now() + 200
  }
  function updateShake(t) {
    if (t > shakeUntil || shakeAmp <= 0.05) {
      paddock.style.setProperty('--shake-x', '0px')
      paddock.style.setProperty('--shake-y', '0px')
      shakeAmp = 0
      return
    }
    const remaining = (shakeUntil - t) / 200
    const a = shakeAmp * remaining
    paddock.style.setProperty('--shake-x', `${((Math.random() * 2 - 1) * a).toFixed(2)}px`)
    paddock.style.setProperty('--shake-y', `${((Math.random() * 2 - 1) * a).toFixed(2)}px`)
  }

  // ---------------------------------------------------------- BREATH + GAZE (LIVING)

  function updateBreath(t) {
    if (reduceMotion) return
    // Slow sinusoidal scale, ~5s per breath, +/-0.6%.
    for (const p of horses) {
      if (p === dragging) continue
      const phase = (t / 1000 + (p._mass * 1.7)) / 5
      const breath = 1 + Math.sin(phase * Math.PI * 2) * 0.006
      p._el.style.setProperty('--breath', breath.toFixed(4))
    }
  }

  function updateGaze() {
    if (reduceMotion || cursorX < 0) return
    for (const p of horses) {
      if (p === dragging) continue
      const cx = p._x + p._el.offsetWidth / 2
      const cy = p._y + p._el.offsetHeight / 2
      const dx = cursorX - cx
      // Tiny head turn — capped at 4deg.
      const angle = clamp(dx * 0.012, -4, 4)
      void cy
      p._el.style.setProperty('--gaze-x', `${angle.toFixed(2)}deg`)
    }
  }

  window.addEventListener('pointermove', (e) => {
    cursorX = e.clientX; cursorY = e.clientY
  }, { passive: true })

  // ---------------------------------------------------------- HAT FITTING

  function fitHat(h, glyph, fromX, fromY) {
    if (!h) return
    const stack = h._el.querySelector('.hat-stack')

    // Mood rejection: accept briefly, then shake off — don't pop the stack.
    const rejects = REJECT[KIND_BY_ID[h.kind].name] || []
    if (rejects.includes(glyph)) {
      pushHat(h, glyph, fromX, fromY)
      setTimeout(() => {
        if (!h._el.isConnected) return
        stack.classList.add('is-shaking')
        setTimeout(() => {
          stack.classList.remove('is-shaking')
          // pop the rejected hat (the top one)
          const idx = h.hats.lastIndexOf(glyph)
          if (idx !== -1) {
            h.hats.splice(idx, 1)
            renderHats(h)
            persist()
            try { document.dispatchEvent(new CustomEvent('pf:hat:remove', { detail: { horseId: h.kind, hatId: glyph } })) } catch (_) {}
          }
        }, 520)
      }, 1400)
      return
    }
    pushHat(h, glyph, fromX, fromY)
    maybeCombo(h, glyph)
  }

  function pushHat(h, glyph, fromX, fromY) {
    // Push onto stack (max 3 — oldest falls off).
    let bumped = null
    h.hats.push(glyph)
    if (h.hats.length > MAX_HATS) bumped = h.hats.shift()
    try {
      if (bumped) document.dispatchEvent(new CustomEvent('pf:hat:remove', { detail: { horseId: h.kind, hatId: bumped } }))
      document.dispatchEvent(new CustomEvent('pf:hat:add', { detail: { horseId: h.kind, hatId: glyph } }))
    } catch (_) {}

    if (reduceMotion || fromX == null) {
      renderHats(h)
      persist()
      return
    }
    flyHatTo(h, glyph, fromX, fromY)
  }

  function flyHatTo(h, glyph, fromX, fromY) {
    const stack = h._el.querySelector('.hat-stack')
    const r = stack.getBoundingClientRect()
    const tx = r.left + r.width / 2
    const ty = r.top + 4

    const projectile = document.createElement('div')
    projectile.className = 'hat-fly'
    projectile.textContent = glyph
    document.body.appendChild(projectile)

    const start = now()
    const dur = 420
    const dx = tx - fromX, dy = ty - fromY
    const arc = Math.min(120, Math.hypot(dx, dy) * 0.35) + 40
    const startRot = (Math.random() - 0.5) * 60
    const endRot   = (Math.random() - 0.5) * 20

    function frame(t) {
      const k = Math.min(1, (t - start) / dur)
      const ek = 1 - Math.pow(1 - k, 2)
      const cx = fromX + dx * ek
      const cy = fromY + dy * ek - arc * 4 * k * (1 - k)
      const rot = startRot + (endRot - startRot) * ek
      projectile.style.transform = `translate3d(${cx - 14}px, ${cy - 14}px, 0) rotate(${rot}deg)`
      if (k < 1) {
        requestAnimationFrame(frame)
      } else {
        projectile.remove()
        renderHats(h)
        stack.classList.remove('is-landing')
        void stack.offsetWidth
        stack.classList.add('is-landing')
        sfx.hatLand()
        h._sy = 0.94; h._sx = 1.05
        persist()
      }
    }
    requestAnimationFrame(frame)
  }

  // ---------------------------------------------------------- COMBOS

  function maybeCombo(h, glyph) {
    const name = KIND_BY_ID[h.kind].name
    if (glyph === '👑' && name === 'Sable') dropRibbon(h)
    else if (glyph === '🪩') spinAllHats()
    else if (glyph === '🥀' && name === 'Femme') driftPetal(h)
    else if (glyph === '💋' && name === 'Vesper') {
      h._el.classList.add('is-bowing')
      setTimeout(() => h._el.classList.remove('is-bowing'), 1100)
    }
  }

  function dropRibbon(h) {
    if (reduceMotion) return
    const r = h._el.getBoundingClientRect()
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

  function driftPetal(h) {
    if (reduceMotion) return
    const r = h._el.getBoundingClientRect()
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

  // ---------------------------------------------------------- RING

  function placeRingHats() {
    const n = ringHats.length
    ringHats.forEach((h, i) => {
      const a = -90 + (360 / n) * i
      h.style.setProperty('--a', `${a}deg`)
    })
  }

  const isRingOpen = () => ring.classList.contains('is-open')

  function openRingAt(x, y, h) {
    ringTargetHorse = h || null
    ringTarget.textContent = h ? (h.name || KIND_BY_ID[h.kind].name) : '—'
    const top = h && h.hats.length ? h.hats[h.hats.length - 1] : null
    ringHats.forEach(b => b.classList.toggle('is-active', !!top && b.dataset.hat === top))
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

  ringHats.forEach(b => {
    b.addEventListener('click', (e) => {
      e.stopPropagation()
      ensureAudio()
      const glyph = b.dataset.hat
      const h = ringTargetHorse || lastFocusedHorse
      if (h) {
        const r = b.getBoundingClientRect()
        fitHat(h, glyph, r.left + r.width / 2, r.top + r.height / 2)
      }
      closeRing()
      if (h) h._el.focus({ preventScroll: true })
    })
  })

  paddock.addEventListener('pointerdown', (e) => {
    if (!isRingOpen()) return
    if (e.target.closest('.ring')) return
    if (e.target.closest('.pony')) return
    closeRing()
  }, true)

  // ---------------------------------------------------------- DRAG

  function pushVelSample(x, y) {
    const t = now()
    velSamples.push({ t, x, y })
    while (velSamples.length > 1 && t - velSamples[0].t > 100) velSamples.shift()
  }

  function computeFlingVelocity() {
    if (velSamples.length < 2) return { vx: 0, vy: 0 }
    const a = velSamples[0]
    const b = velSamples[velSamples.length - 1]
    const dt = (b.t - a.t) / 1000
    if (dt <= 0) return { vx: 0, vy: 0 }
    return { vx: (b.x - a.x) / dt, vy: (b.y - a.y) / dt }
  }

  function bindHorseEvents(el, nameEl, h) {
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      if (e.target === nameEl) return  // let name editor own it
      if (showState.running) return
      ensureAudio()
      lastFocusedHorse = h
      dragging = h
      dragId = e.pointerId
      didMove = false
      altClonePending = e.altKey

      const rect = el.getBoundingClientRect()
      dragOffX = e.clientX - rect.left
      dragOffY = e.clientY - rect.top
      dragStartX = e.clientX
      dragStartY = e.clientY
      h._vx = 0; h._vy = 0

      velSamples = []
      pushVelSample(e.clientX, e.clientY)
      sfx.pickup()

      try { el.setPointerCapture(e.pointerId) } catch (_) {}
      e.preventDefault()
    })

    el.addEventListener('pointermove', (e) => {
      if (dragging !== h || e.pointerId !== dragId) return
      const dx = e.clientX - dragStartX
      const dy = e.clientY - dragStartY
      if (!didMove && Math.hypot(dx, dy) > 4) {
        didMove = true
        // resolve clone on first real movement
        if (altClonePending && horses.length < MAX_HORSES) {
          const clone = addHorse({
            kind: h.kind,
            x: h._x + 12, y: h._y + 12,
            hats: h.hats.slice(),
          })
          if (clone) {
            sortDepth()
            showToast('cloned')
          }
        }
        altClonePending = false
        el.classList.add('is-lifted')
        el.style.setProperty('--lift', '1')
        paddock.classList.add('is-holding')
        fadeHint()
        if (isRingOpen()) closeRing()
      }
      if (didMove) {
        const r = paddock.getBoundingClientRect()
        const pw = el.offsetWidth, ph = el.offsetHeight
        const x = clamp(e.clientX - r.left - dragOffX, 4, r.width  - pw - 4)
        const y = clamp(e.clientY - r.top  - dragOffY, 4, r.height - ph - 4 - 28)
        pushVelSample(e.clientX, e.clientY)

        if (!reduceMotion && velSamples.length >= 2) {
          const a = velSamples[velSamples.length - 2]
          const b = velSamples[velSamples.length - 1]
          const ddt = Math.max(0.001, (b.t - a.t) / 1000)
          const ivx = (b.x - a.x) / ddt
          const ivy = (b.y - a.y) / ddt
          const speed = Math.hypot(ivx, ivy)
          if (speed > 100) {
            const ang = Math.atan2(ivy, ivx)
            const stretch = Math.min(0.18, speed * 0.00018)
            const ax = Math.abs(Math.cos(ang))
            h._sx = 1 + stretch * ax
            h._sy = 1 - stretch * ax * 0.55
          } else {
            h._sx += (1 - h._sx) * 0.2
            h._sy += (1 - h._sy) * 0.2
          }
          setScale(h, h._sx, h._sy)
          const tilt = clamp(ivx * 0.0004, -8, 8)
          setRot(h, tilt)
        } else {
          setRot(h, clamp(dx * 0.02, -6, 6))
        }
        setXY(h, x, y)
      }
    })

    el.addEventListener('pointerup', (e) => {
      if (dragging !== h || e.pointerId !== dragId) return
      try { el.releasePointerCapture(dragId) } catch (_) {}
      paddock.classList.remove('is-holding')

      if (didMove) {
        el.classList.remove('is-lifted')
        el.style.setProperty('--lift', '0')
        pushVelSample(e.clientX, e.clientY)
        const { vx, vy } = computeFlingVelocity()
        h._vx = vx; h._vy = vy
        const speed = Math.hypot(vx, vy)
        if (!reduceMotion) {
          const amt = Math.min(0.18, 0.06 + speed * 0.00012)
          h._sx = 1 + amt; h._sy = 1 - amt * 0.6
        }
        sfx.drop()
        sortDepth()
        persist()
        dragging = null
      } else {
        // tap counts toward "seen"
        tapNote(h)
        el.classList.remove('is-lifted')
        el.style.setProperty('--lift', '0')
        const rect = el.getBoundingClientRect()
        openRingAt(rect.left + rect.width / 2, rect.top + rect.height / 2, h)
        dragging = null
      }
      altClonePending = false
    })

    el.addEventListener('pointercancel', () => {
      if (dragging !== h) return
      el.classList.remove('is-lifted')
      el.style.setProperty('--lift', '0')
      setRot(h, 0)
      paddock.classList.remove('is-holding')
      dragging = null
      altClonePending = false
    })

    el.addEventListener('dragstart', e => e.preventDefault())
    el.addEventListener('focus', () => { lastFocusedHorse = h })

    // double-click to edit name
    el.addEventListener('dblclick', (e) => {
      if (e.target === nameEl) return
      e.preventDefault()
      focusName(nameEl)
    })

    // name editing
    nameEl.addEventListener('pointerdown', (e) => e.stopPropagation())
    nameEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault()
        nameEl.blur()
      }
    })
    nameEl.addEventListener('input', () => {
      const t = nameEl.textContent.replace(/\s+/g, ' ').slice(0, 20)
      if (t !== nameEl.textContent) nameEl.textContent = t
      h.name = t
      el.dataset.name = t || KIND_BY_ID[h.kind].name
    })
    nameEl.addEventListener('blur', () => persist())
  }

  function focusName(nameEl) {
    nameEl.focus()
    const range = document.createRange()
    range.selectNodeContents(nameEl)
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(range)
  }

  // tap counter — only counts taps that opened the ring (not drags).
  function tapNote(h) {
    // SPEC §3: click counters frozen in PLAY mode.
    if (window.PFG && window.PFG.mode && window.PFG.mode.current() === 'play') return
    taps[h.kind] = (taps[h.kind] || 0) + 1
    try { localStorage.setItem(TAPS_KEY, JSON.stringify(taps)) } catch (_) {}
    // refresh notes on all clones of this kind
    horses.filter(x => x.kind === h.kind).forEach(renderNote)
  }

  // ---------------------------------------------------------- KEYBOARD

  const KEY_TO_HAT = Object.fromEntries(ringHats.map(b => [b.dataset.key, b.dataset.hat]))

  document.addEventListener('keydown', (e) => {
    const focused = document.activeElement
    const inEditable = focused && focused.classList?.contains('pony__name')
    if (inEditable) return

    // Cmd/Ctrl+S → PNG, +Shift → share link
    if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) {
      e.preventDefault()
      if (e.shiftKey) shareLink()
      else exportPNG()
      return
    }

    // G → procession (chill mode only — frozen during PLAY per SPEC §3)
    if ((e.key === 'g' || e.key === 'G') && !isRingOpen() && !showState.running && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (window.PFG && window.PFG.mode && window.PFG.mode.current() === 'play') return
      e.preventDefault()
      startProcession()
      return
    }

    if (e.key === 'Escape') {
      if (showState.running) { e.preventDefault(); abortProcession(); return }
      if (isRingOpen()) {
        e.preventDefault()
        closeRing()
        if (lastFocusedHorse) lastFocusedHorse._el.focus({ preventScroll: true })
        return
      }
    }

    // Backspace → delete focused horse (not original 6)
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const h = focused && focused.classList?.contains('pony')
        ? horses.find(x => x._el === focused)
        : null
      if (h && !h._isOriginal) {
        e.preventDefault()
        removeHorse(h)
        persist()
        showToast('removed')
        return
      }
    }

    // hat number keys
    if (KEY_TO_HAT[e.key] !== undefined && !showState.running) {
      ensureAudio()
      const target = ringTargetHorse
        || (focused && focused.classList?.contains('pony') ? horses.find(x => x._el === focused) : lastFocusedHorse)
      if (target) {
        e.preventDefault()
        const ringBtn = ringHats.find(b => b.dataset.key === e.key)
        if (isRingOpen() && ringBtn) {
          const r = ringBtn.getBoundingClientRect()
          fitHat(target, KEY_TO_HAT[e.key], r.left + r.width / 2, r.top + r.height / 2)
        } else {
          // throw from off-screen above
          const r = target._el.getBoundingClientRect()
          fitHat(target, KEY_TO_HAT[e.key], r.left + r.width / 2, r.top - 80)
        }
        if (isRingOpen()) {
          ringHats.forEach(b => b.classList.toggle('is-active', b.dataset.key === e.key))
        }
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
        h._vx = 0; h._vy = 0
        setXY(h, x, y)
        sortDepth()
        fadeHint()
        return
      }
    }

    if ((e.key === 'r' || e.key === 'R') && !isRingOpen() && !showState.running) {
      e.preventDefault()
      recall()
    }
  })

  // PONY → all dip; RIDE → saddle cursor briefly.
  let typed = ''
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const focused = document.activeElement
    if (focused && focused.classList?.contains('pony__name')) return
    const k = (e.key || '').toLowerCase()
    if (k.length !== 1) { typed = ''; return }
    typed = (typed + k).slice(-6)
    if (typed.endsWith('pony')) {
      horses.forEach(h => {
        h._el.classList.remove('is-bowing')
        void h._el.offsetWidth
        h._el.classList.add('is-bowing')
        setTimeout(() => h._el.classList.remove('is-bowing'), 1100)
      })
      typed = ''
    } else if (typed.endsWith('ride')) {
      paddock.classList.add('is-saddled')
      setTimeout(() => paddock.classList.remove('is-saddled'), 4000)
      typed = ''
    }
  })

  // ---------------------------------------------------------- RECALL

  function recall() {
    closeRing()
    const seen = new Set()
    horses.forEach(h => {
      const layout = home.get(h.kind) || [h._x, h._y]
      let [hx, hy] = layout
      if (seen.has(h.kind)) {
        const off = (horses.indexOf(h) % 4) * 14
        hx += 24 + off; hy += 24 + off
      } else {
        seen.add(h.kind)
      }
      h._vx = 0; h._vy = 0
      setXY(h, hx, hy)
      setScale(h, 1, 1)
      setRot(h, 0)
      if (!reduceMotion) {
        h._el.classList.remove('is-landing')
        void h._el.offsetWidth
        h._el.classList.add('is-landing')
      }
    })
    sortDepth()
    sfx.drop()
    persist()
  }
  recallBtn.addEventListener('click', () => { ensureAudio(); recall() })

  // ---------------------------------------------------------- IDLE

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
    if (showState.running || !horses.length) return
    if (window.PFG && window.PFG.mode && window.PFG.mode.current() === 'play') return
    const h = horses[Math.floor(Math.random() * horses.length)]
    const img = h._el.querySelector('img')
    if (!img) return
    const cur = img.style.getPropertyValue('--face-x') || '1'
    img.style.setProperty('--face-x', cur.trim() === '-1' ? '1' : '-1')
  }
  function idleSwap() {
    if (showState.running || horses.length < 2) return
    if (window.PFG && window.PFG.mode && window.PFG.mode.current() === 'play') return
    const a = horses[Math.floor(Math.random() * horses.length)]
    let b = horses[Math.floor(Math.random() * horses.length)]
    let guard = 0
    while (b === a && guard++ < 8) b = horses[Math.floor(Math.random() * horses.length)]
    if (a === b) return
    const ax = a._x, ay = a._y
    const oldA = a._el.style.transition, oldB = b._el.style.transition
    a._el.style.transition = 'transform 2400ms cubic-bezier(.22,.61,.36,1)'
    b._el.style.transition = 'transform 2400ms cubic-bezier(.22,.61,.36,1)'
    a._vx = a._vy = b._vx = b._vy = 0
    setXY(a, b._x, b._y)
    setXY(b, ax, ay)
    sortDepth()
    setTimeout(() => {
      a._el.style.transition = oldA
      b._el.style.transition = oldB
    }, 2500)
  }
  ;['pointerdown', 'keydown', 'pointermove', 'wheel'].forEach(ev =>
    window.addEventListener(ev, scheduleIdle, { passive: true })
  )

  // ---------------------------------------------------------- TIME OF DAY

  function tickClock() {
    // SPEC §3: time-of-day visual cycling frozen during PLAY.
    if (window.PFG && window.PFG.mode && window.PFG.mode.current() === 'play') return
    const h = new Date().getHours()
    const isNight = (h >= 23 || h < 5)
    paddock.classList.toggle('is-night', isNight)
  }

  // ---------------------------------------------------------- MUTE

  muteBtn.addEventListener('click', () => {
    muted = !muted
    muteBtn.setAttribute('aria-pressed', String(muted))
    if (!muted) ensureAudio()
    if (masterGain) masterGain.gain.value = muted ? 0 : 0.15
  })

  // ---------------------------------------------------------- SHOW (G)

  const PROC_TIMING = {
    fadeUI: 600, walkIn: 1700, pause: 1500, walkOut: 1700, overlap: 500, settle: 900,
  }

  const showState = {
    running: false,
    aborted: false,
    timers: [],
    saved: new Map(),
  }

  // hydrate witness stamp
  try {
    if (localStorage.getItem(WITNESS_KEY) === '1') {
      witnessEl.classList.add('is-stamped')
      witnessEl.setAttribute('aria-hidden', 'false')
    }
  } catch (_) {}

  function schedule(fn, ms) {
    const id = setTimeout(() => {
      showState.timers = showState.timers.filter(t => t !== id)
      if (!showState.aborted) fn()
    }, ms)
    showState.timers.push(id)
    return id
  }

  function clearShowTimers() {
    showState.timers.forEach(id => clearTimeout(id))
    showState.timers = []
  }

  function showCaption(name, bio, idx, total) {
    procName.textContent = name
    procBio.textContent  = bio
    procCount.textContent = `${String(idx).padStart(2, '0')} / ${String(total).padStart(2, '0')}`
    procEl.classList.add('is-visible')
    procEl.setAttribute('aria-hidden', 'false')
  }
  function hideCaption() {
    procEl.classList.remove('is-visible')
    procEl.setAttribute('aria-hidden', 'true')
  }

  function stampWitness(animate) {
    witnessEl.classList.add('is-stamped')
    witnessEl.setAttribute('aria-hidden', 'false')
    if (animate) {
      witnessEl.classList.remove('is-just-stamped')
      void witnessEl.offsetWidth
      witnessEl.classList.add('is-just-stamped')
    }
    try { localStorage.setItem(WITNESS_KEY, '1') } catch (_) {}
  }

  function reducedMotionShow() {
    showState.running = true
    const order = KINDS.filter(k => horses.find(h => h.kind === k.id))
    const lines = [
      ['the procession', 'six horses, in studbook order'],
      ...order.map(k => [k.name, BIOS[k.name] || '']),
      ['—', 'the paddock returns to itself'],
    ]
    let i = 0
    paddock.classList.add('is-show')
    const tick = () => {
      if (showState.aborted || i >= lines.length) {
        hideCaption()
        stampWitness(true)
        paddock.classList.remove('is-show')
        showState.running = false
        showState.aborted = false
        return
      }
      const [name, bio] = lines[i]
      showCaption(name, bio, i, lines.length - 1)
      i++
      schedule(tick, 1400)
    }
    schedule(tick, 200)
  }

  function startProcession() {
    if (showState.running) return
    showState.running = true
    showState.aborted = false

    if (reduceMotion) {
      reducedMotionShow()
      return
    }

    closeRing()
    if (dragging) {
      dragging._el.classList.remove('is-lifted')
      dragging._el.style.setProperty('--lift', '0')
      dragging = null
    }
    fadeHint()

    // Original studbook order; ignore clones for procession.
    const order = KINDS
      .map(k => horses.find(x => x.kind === k.id && x._isOriginal))
      .filter(Boolean)

    showState.saved.clear()
    horses.forEach(h => showState.saved.set(h, [h._x, h._y]))

    paddock.classList.add('is-show')

    const r = paddock.getBoundingClientRect()
    const probe = order[0] || horses[0]
    const pw = probe._el.offsetWidth || 150
    const ph = probe._el.offsetHeight || 84
    const centerX = (r.width  - pw) / 2
    const centerY = (r.height - ph) / 2
    const offLeftX  = -pw - 80
    const offRightX = r.width + 80

    // Park everyone offstage-left, no transitions.
    horses.forEach(h => {
      h._vx = 0; h._vy = 0
      h._el.classList.add('is-offstage')
      h._el.style.setProperty('--depth', '0')
      h._el.style.setProperty('--z', '500')
      const prev = h._el.style.transition
      h._el.style.transition = 'none'
      setXY(h, offLeftX, centerY)
      void h._el.offsetWidth
      h._el.style.transition = prev
    })

    schedule(() => runWalkSequence(order, centerX, centerY, offRightX), PROC_TIMING.fadeUI)
  }

  function runWalkSequence(order, centerX, centerY, offRightX) {
    if (showState.aborted) return
    const total = order.length
    const per = PROC_TIMING.walkIn + PROC_TIMING.pause + PROC_TIMING.walkOut
    const stride = per - PROC_TIMING.overlap

    order.forEach((h, i) => {
      const t0 = i * stride
      schedule(() => {
        h._el.classList.remove('is-offstage')
        h._el.classList.add('is-onstage')
        setXY(h, centerX, centerY)
      }, t0)
      schedule(() => {
        const name = h.name || KIND_BY_ID[h.kind].name
        showCaption(name, BIOS[KIND_BY_ID[h.kind].name] || '', i + 1, total)
      }, t0 + PROC_TIMING.walkIn)
      schedule(() => {
        if (i < total - 1) hideCaption()
        h._el.classList.remove('is-onstage')
        h._el.classList.add('is-dim')
        setXY(h, offRightX, centerY)
      }, t0 + PROC_TIMING.walkIn + PROC_TIMING.pause)
    })

    const showEnd = (total - 1) * stride + per
    schedule(() => { hideCaption(); stampWitness(true) }, showEnd + 200)
    schedule(finishProcession, showEnd + PROC_TIMING.settle + 200)
  }

  function finishProcession() {
    paddock.classList.remove('is-show')
    horses.forEach(h => {
      h._el.classList.remove('is-offstage', 'is-onstage', 'is-dim')
      const [hx, hy] = showState.saved.get(h) || [h._x, h._y]
      const prev = h._el.style.transition
      h._el.style.transition = 'none'
      setXY(h, hx, hy)
      void h._el.offsetWidth
      h._el.style.transition = prev
    })
    sortDepth()
    showState.running = false
    showState.aborted = false
    showState.saved.clear()
  }

  function abortProcession() {
    if (!showState.running) return
    showState.aborted = true
    clearShowTimers()
    hideCaption()
    paddock.classList.remove('is-show')
    horses.forEach(h => {
      h._el.classList.remove('is-offstage', 'is-onstage', 'is-dim')
      const saved = showState.saved.get(h)
      const prev = h._el.style.transition
      h._el.style.transition = 'none'
      if (saved) setXY(h, saved[0], saved[1])
      void h._el.offsetWidth
      h._el.style.transition = prev
    })
    sortDepth()
    showState.running = false
    showState.saved.clear()
  }

  // ---------------------------------------------------------- PERSIST

  function snapshot() {
    return {
      v: 1,
      horses: horses.map(h => ({
        id: h.id, kind: h.kind,
        x: Math.round(h._x), y: Math.round(h._y),
        name: h.name || '',
        hats: h.hats.slice(),
        original: !!h._isOriginal,
      })),
      w: Math.round(paddock.getBoundingClientRect().width),
      h: Math.round(paddock.getBoundingClientRect().height),
    }
  }

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot())) } catch (_) {}
  }

  function restoreFrom(data) {
    if (!data || !Array.isArray(data.horses)) return false
    horses.slice().forEach(h => h._el.remove())
    horses = []

    const r = paddock.getBoundingClientRect()
    const sx = data.w ? r.width  / data.w : 1
    const sy = data.h ? r.height / data.h : 1
    const s = Math.min(sx, sy) || 1

    // Track which kinds we've seen — first instance per kind = original.
    const seen = new Set()
    data.horses.slice(0, MAX_HORSES).forEach(d => {
      const isOrig = d.original ?? !seen.has(d.kind)
      seen.add(d.kind)
      addHorse({
        id: d.id, kind: d.kind,
        x: clamp((d.x || 0) * s, 4, r.width  - 160),
        y: clamp((d.y || 0) * s, 4, r.height - 110),
        name: d.name || '',
        hats: Array.isArray(d.hats) ? d.hats : [],
      }, { original: isOrig })
    })
    // Make sure each KIND has an original — if not, add it.
    KINDS.forEach(k => {
      if (!horses.some(h => h.kind === k.id && h._isOriginal)) {
        const lay = home.get(k.id) || [120, 120]
        addHorse({ kind: k.id, x: lay[0], y: lay[1], hats: [k.defaultHat] }, { original: true })
      }
    })
    sortDepth()
    return true
  }

  function loadStored() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return false
      return restoreFrom(JSON.parse(raw))
    } catch (_) { return false }
  }

  // ---------------------------------------------------------- SHARE HASH

  function encodeHash(data) {
    const json = JSON.stringify(data)
    return btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }
  function decodeHash(s) {
    try {
      const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
      const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
      const json = decodeURIComponent(escape(atob(b64 + pad)))
      return JSON.parse(json)
    } catch (_) { return null }
  }

  function shareLink() {
    const hash = encodeHash(snapshot())
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

  // ---------------------------------------------------------- PNG EXPORT

  function exportPNG() {
    const r = paddock.getBoundingClientRect()
    const W = Math.round(r.width)
    const H = Math.round(r.height)
    const scale = 2

    const c = document.createElement('canvas')
    c.width = W * scale; c.height = H * scale
    const x = c.getContext('2d')
    x.scale(scale, scale)

    // paper + grid
    x.fillStyle = paddock.classList.contains('is-night') ? '#e8e3d6' : '#f3efe6'
    x.fillRect(0, 0, W, H)
    x.fillStyle = 'rgba(20,19,15,0.025)'
    for (let y = 31; y < H; y += 32) x.fillRect(0, y, W, 1)
    x.fillStyle = 'rgba(20,19,15,0.045)'
    for (let xx = 0; xx < W; xx += 64) x.fillRect(xx, 0, 1, H)
    for (let yy = 0; yy < H; yy += 64) x.fillRect(0, yy, W, 1)
    x.strokeStyle = '#14130f'
    x.lineWidth = 1
    x.strokeRect(0.5, 0.5, W - 1, H - 1)

    // stamp
    x.fillStyle = '#14130f'
    x.font = '500 32px Fraunces, Georgia, serif'
    x.textBaseline = 'top'
    x.fillText('Ponyforge', 22, 22)
    x.fillStyle = '#7c7768'
    x.font = '500 10px JetBrains Mono, monospace'
    x.fillText('STUDBOOK & MILLINERY · MMXXVI', 22, 60)

    // horses back-to-front
    const sorted = horses.slice().sort((a, b) => a._y - b._y)
    sorted.forEach(h => {
      const hx = h._x, hy = h._y
      const el = h._el
      const pw = el.offsetWidth, ph = el.offsetHeight
      const depth = clamp(0.55 - (hy / H) * 0.55, 0, 0.55)
      const baseScale = 1 - depth * 0.20
      const dw = pw * baseScale
      const dh = ph * baseScale

      // shadow
      x.fillStyle = 'rgba(20,19,15,0.32)'
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

      // hats stacked
      if (h.hats.length) {
        const size = Math.round(dh * 0.42)
        x.font = `${size}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`
        x.textAlign = 'center'
        x.textBaseline = 'bottom'
        let y = hy - 2
        h.hats.forEach(g => { x.fillText(g, hx + dw / 2, y); y -= size * 0.7 })
      }

      // name caption (only if explicitly set)
      if (h.name) {
        x.font = '500 10px JetBrains Mono, monospace'
        x.textAlign = 'center'
        x.textBaseline = 'top'
        const text = h.name.toUpperCase()
        const tw = x.measureText(text).width
        const px = hx + dw / 2 - tw / 2 - 6
        const py = hy + dh + 4
        x.fillStyle = '#f3efe6'
        x.fillRect(px, py, tw + 12, 16)
        x.strokeStyle = '#14130f'
        x.lineWidth = 1
        x.beginPath()
        x.moveTo(px, py + 16.5); x.lineTo(px + tw + 12, py + 16.5)
        x.stroke()
        x.fillStyle = '#14130f'
        x.fillText(text, hx + dw / 2, py + 3)
      }
    })

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

  // ---------------------------------------------------------- INIT

  placeRingHats()

  function seedDefault() {
    defaultLayout().forEach(p => {
      const k = KIND_BY_ID[p.kind]
      addHorse({ kind: p.kind, x: p.x, y: p.y, hats: [k.defaultHat] }, { original: true })
    })
  }

  function init() {
    snapshotHome()

    let restored = false
    if (location.hash.startsWith('#s=')) {
      const data = decodeHash(location.hash.slice(3))
      if (data) restored = restoreFrom(data)
    }
    if (!restored) restored = loadStored()
    if (!restored) seedDefault()

    sortDepth()
    tickClock()
    setInterval(tickClock, 60_000)
    scheduleIdle()
    requestAnimationFrame(tick)
  }

  if (document.readyState === 'complete') {
    requestAnimationFrame(init)
  } else {
    window.addEventListener('load', () => requestAnimationFrame(init), { once: true })
  }

  // resize
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
        setXY(h, x, y)
      })
      snapshotHome()
      sortDepth()
    })
  })

  // hash change
  window.addEventListener('hashchange', () => {
    if (location.hash.startsWith('#s=')) {
      const data = decodeHash(location.hash.slice(3))
      if (data && restoreFrom(data)) showToast('scene loaded')
    }
  })

  // ============================================================ GAME AUDIO CUES
  // Per docs/game/AUDIO.md. Reuses actx, masterGain, muted, ensureAudio. Adds a
  // shared compressor on the master bus and per-cue throttles.

  let gameAudioWired = false
  let compressor = null
  let suppressUntil = 0
  const lastFiredAt = Object.create(null)
  function gameAudioReady() {
    ensureAudio()
    if (!audioReady || muted) return false
    if (!gameAudioWired) {
      try {
        compressor = actx.createDynamicsCompressor()
        compressor.threshold.value = -12
        compressor.knee.value = 6
        compressor.ratio.value = 4
        compressor.attack.value = 0.003
        compressor.release.value = 0.15
        masterGain.disconnect()
        masterGain.connect(compressor)
        compressor.connect(actx.destination)
      } catch (_) {}
      gameAudioWired = true
    }
    if (actx.state === 'suspended') { try { actx.resume() } catch (_) {} }
    if (actx.currentTime < suppressUntil) return false
    return true
  }
  function throttle(name, ms) {
    const t = (actx && actx.currentTime) || 0
    const prev = lastFiredAt[name] || 0
    if ((t - prev) * 1000 < ms) return false
    lastFiredAt[name] = t
    return true
  }
  function envOsc(t0, freq, peak, type, dur, attack) {
    const o = actx.createOscillator()
    const g = actx.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t0)
    g.gain.setValueAtTime(0, t0)
    g.gain.linearRampToValueAtTime(peak, t0 + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    o.connect(g).connect(masterGain)
    o.start(t0)
    o.stop(t0 + dur + 0.02)
    o.onended = () => { try { o.disconnect(); g.disconnect() } catch (_) {} }
  }

  const gameAudio = {
    playRoundStart() {
      if (!gameAudioReady() || !throttle('roundStart', 30)) return
      const t = actx.currentTime
      const notes = [523.25, 783.99, 1046.50]
      notes.forEach((f, i) => envOsc(t + i * 0.066, f, 0.08, 'triangle', 0.120, 0.008))
    },
    playTick5s(isFinal) {
      if (!gameAudioReady() || !throttle('tick', 200)) return
      const t = actx.currentTime
      const o = actx.createOscillator()
      const f = actx.createBiquadFilter()
      const g = actx.createGain()
      o.type = 'square'
      o.frequency.setValueAtTime(isFinal ? 1600 : 1200, t)
      f.type = 'lowpass'; f.frequency.value = 2000; f.Q.value = 0.7
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.03, t + 0.002)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.030)
      o.connect(f).connect(g).connect(masterGain)
      o.start(t); o.stop(t + 0.05)
      o.onended = () => { try { o.disconnect(); f.disconnect(); g.disconnect() } catch (_) {} }
    },
    playMatchCorrect(combo) {
      if (!gameAudioReady() || !throttle('match', 30)) return
      const t = actx.currentTime
      envOsc(t, 523.25, 0.04, 'sine', 0.250, 0.004)
      envOsc(t, 659.25, 0.035, 'sine', 0.250, 0.004)
      envOsc(t, 783.99, 0.035, 'sine', 0.250, 0.004)
      if ((combo | 0) >= 2) envOsc(t, 2093, 0.015, 'sine', 0.120, 0.004)
    },
    playMatchWrong() {
      if (!gameAudioReady() || !throttle('wrong', 80)) return
      const t = actx.currentTime
      function note(start, freq) {
        const dur = 0.090
        ;[0, -18].forEach(cents => {
          const o = actx.createOscillator()
          const f = actx.createBiquadFilter()
          const g = actx.createGain()
          o.type = 'sawtooth'
          o.frequency.setValueAtTime(freq, start)
          o.detune.setValueAtTime(cents, start)
          f.type = 'lowpass'; f.frequency.value = 1400; f.Q.value = 0.5
          g.gain.setValueAtTime(0, start)
          g.gain.linearRampToValueAtTime(0.03, start + 0.004)
          g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
          o.connect(f).connect(g).connect(masterGain)
          o.start(start); o.stop(start + dur + 0.02)
          o.onended = () => { try { o.disconnect(); f.disconnect(); g.disconnect() } catch (_) {} }
        })
      }
      note(t, 320); note(t + 0.090, 240)
    },
    playHeartLost() {
      if (!gameAudioReady() || !throttle('heart', 150)) return
      const t = actx.currentTime
      const dur = 0.300
      const len = Math.max(1, Math.floor(actx.sampleRate * dur))
      const buf = actx.createBuffer(1, len, actx.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
      const src = actx.createBufferSource()
      src.buffer = buf
      const filter = actx.createBiquadFilter()
      filter.type = 'lowpass'; filter.Q.value = 1.0
      filter.frequency.setValueAtTime(600, t)
      filter.frequency.exponentialRampToValueAtTime(180, t + dur)
      const g = actx.createGain()
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.05, t + 0.012)
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      src.connect(filter).connect(g).connect(masterGain)
      src.start(t); src.stop(t + dur + 0.02)
      src.onended = () => { try { src.disconnect(); filter.disconnect(); g.disconnect() } catch (_) {} }
    },
    playComboPing(tier) {
      if (!gameAudioReady() || !throttle('combo', 60)) return
      const t = actx.currentTime
      const n = Math.max(1, tier | 0)
      const freq = Math.min(4186, 880 * Math.pow(1.5, n - 1))
      envOsc(t, freq, 0.04, 'sine', 0.140, 0.003)
      envOsc(t, freq, 0.01, 'triangle', 0.140, 0.003)
    },
    playGameOver() {
      if (!gameAudioReady()) return
      const t = actx.currentTime
      const notes = [
        { f: 440, on: 0,    dur: 0.360 },
        { f: 349.23, on: 0.280, dur: 0.360 },
        { f: 293.66, on: 0.560, dur: 0.360 },
        { f: 220, on: 0.840, dur: 0.480 },
      ]
      notes.forEach(n => {
        ;[+4, -4].forEach(cents => {
          const o = actx.createOscillator()
          const g = actx.createGain()
          o.type = 'triangle'
          o.frequency.setValueAtTime(n.f, t + n.on)
          o.detune.setValueAtTime(cents, t + n.on)
          g.gain.setValueAtTime(0, t + n.on)
          g.gain.linearRampToValueAtTime(0.035, t + n.on + 0.012)
          g.gain.exponentialRampToValueAtTime(0.0001, t + n.on + n.dur)
          o.connect(g).connect(masterGain)
          o.start(t + n.on); o.stop(t + n.on + n.dur + 0.02)
          o.onended = () => { try { o.disconnect(); g.disconnect() } catch (_) {} }
        })
      })
      suppressUntil = t + 1.200
    },
    playRoundSkip() {
      if (!gameAudioReady() || !throttle('skip', 30)) return
      // Reuse drop thud, pitched down 3 semitones, 85% gain.
      const t = actx.currentTime
      const o = actx.createOscillator()
      const g = actx.createGain()
      const baseFreq = 110 * Math.pow(2, -3 / 12)
      o.type = 'sine'
      o.frequency.setValueAtTime(baseFreq, t)
      o.frequency.exponentialRampToValueAtTime(Math.max(20, baseFreq - 40), t + 0.10)
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.7 * 0.85, t + 0.005)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
      o.connect(g).connect(masterGain)
      o.start(t); o.stop(t + 0.20)
      o.onended = () => { try { o.disconnect(); g.disconnect() } catch (_) {} }
    },
  }

  // ============================================================ SANDBOX BRIDGE
  // Exposes hat-stack reads/clears + horse-element lookup for the game engine.
  window.PFG = window.PFG || {}
  window.PFG.sandbox = {
    audio: gameAudio,
    getBoard() {
      const out = {}
      KINDS.forEach(k => { out[k.id] = [] })
      // Use only original horses for the target match; clones are extra paddock filler.
      horses.forEach(h => {
        if (!h._isOriginal) return
        out[h.kind] = h.hats.slice()
      })
      return out
    },
    getHorseEl(horseId) {
      const h = horses.find(x => x.kind === horseId && x._isOriginal)
      return h ? h._el : null
    },
    clearAllHats() {
      horses.forEach(h => {
        if (h.hats.length) {
          h.hats.length = 0
          renderHats(h)
        }
      })
      persist()
    },
  }
})()

