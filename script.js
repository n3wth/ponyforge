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

    const friend = document.createElement('span')
    friend.className = 'pony__friend'
    el.appendChild(friend)

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
    // clear this clone's trail — clones don't keep deep memory
    if (typeof clearTrailFor === 'function') clearTrailFor(h)
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

  let actx = null, masterGain = null, audioReady = false, muted = true

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
      buildSoundscape()
    } catch (_) {}
    // iOS resume on first gesture
    if (actx && actx.state === 'suspended') {
      actx.resume().catch(() => {})
    }
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

  // ---------------------------------------------------------- SOUNDSCAPE
  // Continuous pad + per-horse voice + hat-land arpeggio + cluster swell.

  const HORSE_VOICE = {
    iris:   220,   // A3
    vesper: 175,   // F3
    onyx:   147,   // D3
    prism:  262,   // C4
    sable:  196,   // G3
    femme:  330,   // E4
  }

  // Pad recipes per weather state. Each recipe gives ratios applied to a base
  // root frequency (we use a low root ~ 110Hz). Intervals favor maj7/b9/tritone
  // for a slightly-off, paper-museum feel — not warm meditation fifths.
  // ratios: list of frequency ratios (relative to root)
  // detune: cents of slow wandering detune (0 = none)
  // cutoff: lowpass cutoff in Hz
  // q:      filter Q
  // lfoHz:  filter LFO rate
  // lfoAmt: filter cutoff modulation depth in Hz
  // gain:   pad master gain (≤ 0.05)
  // noise:  optional pink-noise layer gain (0 = off)
  const PAD_RECIPES = {
    clear:    { root: 110, ratios: [1, 1.5, 2.25],          detune: 0,  cutoff: 900,  q: 2,   lfoHz: 0.05, lfoAmt: 280, gain: 0.040, noise: 0 },
    breezy:   { root: 110, ratios: [1, 1.5, 2.25],          detune: 15, cutoff: 1100, q: 2,   lfoHz: 0.07, lfoAmt: 360, gain: 0.040, noise: 0 },
    overcast: { root: 110, ratios: [1, 1.1892, 1.5],        detune: 0,  cutoff: 520,  q: 3,   lfoHz: 0.04, lfoAmt: 160, gain: 0.038, noise: 0 },
    drizzle:  { root: 110, ratios: [1, 1.1892, 1.5],        detune: 6,  cutoff: 480,  q: 3,   lfoHz: 0.04, lfoAmt: 140, gain: 0.036, noise: 0.012 },
    fog:      { root: 110, ratios: [1, 1.8877],             detune: 0,  cutoff: 320,  q: 4,   lfoHz: 0.03, lfoAmt: 80,  gain: 0.030, noise: 0 },
    dusk:     { root: 98,  ratios: [1, 1.5, 2.25],          detune: 0,  cutoff: 760,  q: 2,   lfoHz: 0.05, lfoAmt: 240, gain: 0.040, noise: 0 },
    aurora:   { root: 110, ratios: [1, 1.5, 2.25, 1.4142],  detune: 8,  cutoff: 1400, q: 2.5, lfoHz: 0.06, lfoAmt: 500, gain: 0.046, noise: 0 },
  }

  // Pad chain (built once on first ensureAudio).
  // Up to 4 voices to cover aurora's tritone addition; fewer voices have gain 0.
  const PAD_VOICE_COUNT = 4
  const sound = {
    built: false,
    padOut: null,        // pad master gain
    padBase: 0,          // base gain for active recipe
    padBoost: 0,         // current cluster boost (added to base)
    voices: [],          // [{osc, oscDetune, gain, ratio, freq}]
    filter: null,
    lfo: null, lfoGain: null,
    noiseGain: null, noiseSrc: null,
    voicePool: [],       // pluck pool
    voicePoolIx: 0,
    detuneLfo: null, detuneLfoGain: null,
  }

  function makePinkNoiseBuffer(seconds) {
    const len = Math.floor(actx.sampleRate * seconds)
    const buf = actx.createBuffer(1, len, actx.sampleRate)
    const d = buf.getChannelData(0)
    let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      b0 = 0.99886*b0 + w*0.0555179
      b1 = 0.99332*b1 + w*0.0750759
      b2 = 0.96900*b2 + w*0.1538520
      b3 = 0.86650*b3 + w*0.3104856
      b4 = 0.55000*b4 + w*0.5329522
      b5 = -0.7616*b5 - w*0.0168980
      d[i] = (b0+b1+b2+b3+b4+b5+b6+w*0.5362) * 0.11
      b6 = w * 0.115926
    }
    return buf
  }

  function buildSoundscape() {
    if (sound.built || !audioReady) return
    sound.built = true
    const t = actx.currentTime

    // Pad master gain (sits under everything).
    sound.padOut = actx.createGain()
    sound.padOut.gain.value = 0
    sound.padOut.connect(masterGain)

    // Lowpass with LFO.
    sound.filter = actx.createBiquadFilter()
    sound.filter.type = 'lowpass'
    sound.filter.frequency.value = 800
    sound.filter.Q.value = 2
    sound.filter.connect(sound.padOut)

    sound.lfo = actx.createOscillator()
    sound.lfo.frequency.value = 0.05
    sound.lfoGain = actx.createGain()
    sound.lfoGain.gain.value = 240
    sound.lfo.connect(sound.lfoGain).connect(sound.filter.frequency)
    sound.lfo.start(t)

    // Slow detune wander LFO (for breezy etc).
    sound.detuneLfo = actx.createOscillator()
    sound.detuneLfo.frequency.value = 1 / 8 // 8s period
    sound.detuneLfoGain = actx.createGain()
    sound.detuneLfoGain.gain.value = 0
    sound.detuneLfo.connect(sound.detuneLfoGain)
    sound.detuneLfo.start(t)

    // Pad voices: alternate sine/triangle, slight inter-voice detune for color.
    for (let i = 0; i < PAD_VOICE_COUNT; i++) {
      const o = actx.createOscillator()
      o.type = (i % 2 === 0) ? 'sine' : 'triangle'
      o.frequency.value = 110
      o.detune.value = (i - 1.5) * 4 // -6, -2, +2, +6 cents
      // Wire wandering detune LFO into each oscillator's detune param.
      sound.detuneLfoGain.connect(o.detune)
      const g = actx.createGain()
      g.gain.value = 0
      o.connect(g).connect(sound.filter)
      o.start(t)
      sound.voices.push({ osc: o, gain: g, ratio: 0, freq: 110 })
    }

    // Pink noise layer (for drizzle).
    sound.noiseGain = actx.createGain()
    sound.noiseGain.gain.value = 0
    const nf = actx.createBiquadFilter()
    nf.type = 'bandpass'
    nf.frequency.value = 1200
    nf.Q.value = 0.8
    sound.noiseGain.connect(nf).connect(sound.padOut)
    const nbuf = makePinkNoiseBuffer(4)
    sound.noiseSrc = actx.createBufferSource()
    sound.noiseSrc.buffer = nbuf
    sound.noiseSrc.loop = true
    sound.noiseSrc.connect(sound.noiseGain)
    sound.noiseSrc.start(t)

    // Voice pool for plucks (3 reusable osc+gain pairs).
    for (let i = 0; i < 3; i++) {
      const o = actx.createOscillator()
      o.type = 'sine'
      o.frequency.value = 220
      const g = actx.createGain()
      g.gain.value = 0
      o.connect(g).connect(masterGain)
      o.start(t)
      sound.voicePool.push({ osc: o, gain: g })
    }

    // Apply current weather (if known) immediately.
    applyPadForWeather(currentPadKey(), 0.5)
  }

  function currentPadKey() {
    if (!weather) return 'clear'
    return weather.state in PAD_RECIPES ? weather.state : 'clear'
  }

  function applyPadForWeather(key, fadeSec) {
    if (!sound.built) return
    const recipe = PAD_RECIPES[key] || PAD_RECIPES.clear
    const t = actx.currentTime
    const fade = Math.max(0.05, fadeSec || 4)

    // Night fold-in: drop root an octave (composes with weather).
    const isNight = paddock.classList.contains('is-night')
    const root = recipe.root * (isNight ? 0.5 : 1)

    // Crossfade voices to new ratios.
    for (let i = 0; i < sound.voices.length; i++) {
      const v = sound.voices[i]
      const ratio = recipe.ratios[i] || 0
      v.ratio = ratio
      if (ratio > 0) {
        const f = root * ratio
        v.freq = f
        v.osc.frequency.cancelScheduledValues(t)
        v.osc.frequency.setTargetAtTime(f, t, fade * 0.5)
        // Per-voice gain — distribute so total <= recipe.gain.
        const target = (recipe.gain / Math.max(1, recipe.ratios.length)) * 1.0
        v.gain.gain.cancelScheduledValues(t)
        v.gain.gain.setTargetAtTime(target, t, fade * 0.5)
      } else {
        v.gain.gain.cancelScheduledValues(t)
        v.gain.gain.setTargetAtTime(0, t, fade * 0.5)
      }
    }

    // Filter / LFO.
    sound.filter.frequency.cancelScheduledValues(t)
    sound.filter.frequency.setTargetAtTime(recipe.cutoff, t, fade * 0.5)
    sound.filter.Q.setTargetAtTime(recipe.q, t, fade * 0.5)
    sound.lfo.frequency.setTargetAtTime(recipe.lfoHz, t, fade * 0.5)
    sound.lfoGain.gain.setTargetAtTime(recipe.lfoAmt, t, fade * 0.5)

    // Detune wander.
    sound.detuneLfoGain.gain.cancelScheduledValues(t)
    sound.detuneLfoGain.gain.setTargetAtTime(recipe.detune || 0, t, fade * 0.5)

    // Noise layer.
    sound.noiseGain.gain.cancelScheduledValues(t)
    sound.noiseGain.gain.setTargetAtTime(recipe.noise || 0, t, fade * 0.5)

    // Pad master.
    sound.padBase = recipe.gain
    const padTarget = muted ? 0 : (sound.padBase + sound.padBoost)
    sound.padOut.gain.cancelScheduledValues(t)
    // Aurora swells slowly over its 90s window.
    const padFade = (key === 'aurora') ? 18 : fade
    sound.padOut.gain.setTargetAtTime(padTarget, t, padFade * 0.5)
  }

  function setPadMute(isMuted) {
    if (!sound.built) return
    const t = actx.currentTime
    const target = isMuted ? 0 : (sound.padBase + sound.padBoost)
    sound.padOut.gain.cancelScheduledValues(t)
    sound.padOut.gain.setTargetAtTime(target, t, isMuted ? 0.15 : 0.6)
  }

  function playHorseVoice(h, octaveUp) {
    if (!audioReady || muted || !sound.built) return
    const base = HORSE_VOICE[h.kind] || 220
    const freq = octaveUp ? base * 2 : base
    const slot = sound.voicePool[sound.voicePoolIx]
    sound.voicePoolIx = (sound.voicePoolIx + 1) % sound.voicePool.length
    const t = actx.currentTime
    slot.osc.frequency.cancelScheduledValues(t)
    slot.osc.frequency.setValueAtTime(freq, t)
    slot.gain.gain.cancelScheduledValues(t)
    slot.gain.gain.setValueAtTime(0, t)
    slot.gain.gain.linearRampToValueAtTime(0.08, t + 0.008)
    slot.gain.gain.setValueAtTime(0.08, t + 0.068)
    slot.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.288)
  }

  function playHatArpeggio(h) {
    if (!audioReady || muted || !sound.built) return
    const base = HORSE_VOICE[h.kind] || 220
    // Root, maj3, 5th — same pluck envelope, 60ms apart, lower gain.
    const ratios = [1, 1.2599, 1.4983]
    const t0 = actx.currentTime
    for (let i = 0; i < ratios.length; i++) {
      const slot = sound.voicePool[sound.voicePoolIx]
      sound.voicePoolIx = (sound.voicePoolIx + 1) % sound.voicePool.length
      const t = t0 + i * 0.060
      const f = base * ratios[i]
      slot.osc.frequency.cancelScheduledValues(t)
      slot.osc.frequency.setValueAtTime(f, t)
      slot.gain.gain.cancelScheduledValues(t)
      slot.gain.gain.setValueAtTime(0, t)
      slot.gain.gain.linearRampToValueAtTime(0.05, t + 0.008)
      slot.gain.gain.setValueAtTime(0.05, t + 0.060)
      slot.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.260)
    }
  }

  // Cluster reactivity: when 2+ horses are within 100px, pad rises by ~0.01.
  let _clusterBoostTarget = 0
  let _clusterAccum = 0
  function updateClusterBoost(dt) {
    if (!sound.built) return
    // Sample at ~5Hz to keep it cheap; horses are few (<20).
    _clusterAccum += dt
    if (_clusterAccum < 0.2) return
    _clusterAccum = 0
    let clustered = false
    const n = horses.length
    outer: for (let i = 0; i < n; i++) {
      const a = horses[i]
      for (let j = i + 1; j < n; j++) {
        const b = horses[j]
        const dx = a._x - b._x, dy = a._y - b._y
        if (dx*dx + dy*dy < 100*100) { clustered = true; break outer }
      }
    }
    _clusterBoostTarget = clustered ? 0.01 : 0
    // Smooth toward target (~2s).
    const k = 0.1
    sound.padBoost += (_clusterBoostTarget - sound.padBoost) * k
    if (Math.abs(sound.padBoost) < 0.0005) sound.padBoost = _clusterBoostTarget
    if (!muted) {
      const t = actx.currentTime
      sound.padOut.gain.setTargetAtTime(sound.padBase + sound.padBoost, t, 0.6)
    }
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
    updateClusterBoost(dt)
    tickGroupDynamics(t, dt)

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
    noteHat(h, glyph)
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
    h.hats.push(glyph)
    if (h.hats.length > MAX_HATS) h.hats.shift()

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
        playHatArpeggio(h)
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
      noteClick(h)
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
      if (audioReady && sound.built) playHorseVoice(h, false)
      else sfx.pickup()

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
        if (audioReady && sound.built) playHorseVoice(h, true)
        else sfx.drop()
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

    // G → procession
    if ((e.key === 'g' || e.key === 'G') && !isRingOpen() && !showState.running && !e.metaKey && !e.ctrlKey && !e.altKey) {
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
    const h = horses[Math.floor(Math.random() * horses.length)]
    const img = h._el.querySelector('img')
    if (!img) return
    const cur = img.style.getPropertyValue('--face-x') || '1'
    img.style.setProperty('--face-x', cur.trim() === '-1' ? '1' : '-1')
  }
  function idleSwap() {
    if (showState.running || horses.length < 2) return
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

  let _wasNight = null
  function tickClock() {
    const h = new Date().getHours()
    const isNight = (h >= 23 || h < 5)
    paddock.classList.toggle('is-night', isNight)
    if (_wasNight !== null && _wasNight !== isNight && audioReady && sound.built) {
      applyPadForWeather(currentPadKey(), 6)
    }
    _wasNight = isNight
  }

  // ---------------------------------------------------------- WEATHER

  const WEATHER_KEY      = 'pf:weather'
  const WEATHER_SEEN_KEY = 'pf:weatherSeen'

  // States with display labels and short tilt range. dusk only valid 17-20h, midnight folds at 23+.
  const WEATHER_STATES = ['clear', 'breezy', 'overcast', 'drizzle', 'fog', 'dusk', 'aurora']

  // Transition table: from -> [{ to, p }]. Probabilities sum ≤ 1; remainder = stay.
  const TRANSITIONS = {
    clear:    [{ to: 'breezy', p: 0.40 }, { to: 'overcast', p: 0.20 }, { to: 'fog', p: 0.05 }],
    breezy:   [{ to: 'clear', p: 0.35 }, { to: 'overcast', p: 0.30 }, { to: 'drizzle', p: 0.10 }],
    overcast: [{ to: 'clear', p: 0.60 }, { to: 'drizzle', p: 0.20 }, { to: 'fog', p: 0.10 }],
    drizzle:  [{ to: 'overcast', p: 0.80 }, { to: 'clear', p: 0.05 }],
    fog:      [{ to: 'overcast', p: 0.50 }, { to: 'clear', p: 0.30 }],
    dusk:     [{ to: 'clear', p: 0.50 }, { to: 'overcast', p: 0.30 }],
    aurora:   [], // resolved by timer back to previous
  }

  // Wind direction per state — N/E/S/W; breezy and drizzle have stronger directional flavor.
  const WIND_DIRS = ['N', 'E', 'S', 'W']

  // Tilt magnitude per state in degrees (0-3).
  const TILT_FOR = { clear: 0, breezy: 2.4, overcast: 0.6, drizzle: 1.2, fog: 0.2, dusk: 0.4, aurora: 0.4 }

  const weatherChip = document.getElementById('weatherChip')
  const witnessAurora = document.getElementById('witnessAurora')

  /** @type {{state:string, dir:string, since:number, nextAt:number, prev?:string, auroraUntil?:number}} */
  let weather = null
  let weatherTimer = 0
  let auroraTimer = 0

  function loadWeather() {
    try {
      const raw = localStorage.getItem(WEATHER_KEY)
      if (!raw) return null
      const w = JSON.parse(raw)
      if (!w || !WEATHER_STATES.includes(w.state)) return null
      return w
    } catch (_) { return null }
  }

  function saveWeather() {
    try { localStorage.setItem(WEATHER_KEY, JSON.stringify(weather)) } catch (_) {}
  }

  function loadWeatherSeen() {
    try { return new Set(JSON.parse(localStorage.getItem(WEATHER_SEEN_KEY) || '[]')) }
    catch (_) { return new Set() }
  }
  function addWeatherSeen(stamp) {
    const s = loadWeatherSeen()
    s.add(stamp)
    try { localStorage.setItem(WEATHER_SEEN_KEY, JSON.stringify([...s])) } catch (_) {}
  }

  function chipText() {
    if (!weather) return ''
    const dir = weather.dir
    const s = weather.state
    if (s === 'aurora')   return `aurora ✦`
    if (s === 'drizzle')  return `drizzle ◌ ${dir}`
    if (s === 'fog')      return `fog`
    if (s === 'breezy')   return `breezy · ${dir}`
    if (s === 'dusk')     return `dusk`
    if (s === 'overcast') return `overcast`
    return `clear · ${dir}`
  }

  function applyWeather() {
    if (!weather) return
    // Strip all weather classes, then apply the active state.
    WEATHER_STATES.forEach(s => paddock.classList.remove('is-w-' + s))
    paddock.classList.add('is-w-' + weather.state)
    paddock.classList.toggle('is-w-aurora', weather.state === 'aurora')

    // Tilt direction: N=0, E=positive, S=0, W=negative. Magnitude per state.
    const mag = TILT_FOR[weather.state] || 0
    const sign = (weather.dir === 'E') ? 1 : (weather.dir === 'W') ? -1 : 0
    const tilt = mag * sign
    paddock.style.setProperty('--weather-tilt', `${tilt.toFixed(2)}deg`)

    // Compass tick: brighten the active wind direction.
    document.querySelectorAll('.compass').forEach(c => c.classList.remove('is-wind'))
    const compassEl = document.querySelector('.compass--' + weather.dir.toLowerCase())
    if (compassEl) compassEl.classList.add('is-wind')

    // Chip
    weatherChip.classList.toggle('is-aurora', weather.state === 'aurora')
    const txt = weatherChip.querySelector('.weather-chip__txt')
    if (txt) txt.textContent = chipText()

    // Audio leads the visual transition slightly (4s crossfade).
    if (audioReady && sound.built) applyPadForWeather(currentPadKey(), 4)
  }

  function pickTransition(from) {
    const opts = TRANSITIONS[from] || []
    const r = Math.random()
    let acc = 0
    for (const o of opts) {
      acc += o.p
      if (r < acc) return o.to
    }
    return from // stay
  }

  function pickWindDir(from) {
    // 70% keep direction; 30% rotate by ±90 (rarely 180).
    if (Math.random() < 0.7 && from) return from
    const idx = Math.max(0, WIND_DIRS.indexOf(from || 'N'))
    const turn = Math.random() < 0.85 ? (Math.random() < 0.5 ? 1 : -1) : 2
    return WIND_DIRS[(idx + turn + 4) % 4]
  }

  function scheduleNextTransition() {
    if (weatherTimer) clearTimeout(weatherTimer)
    const remaining = Math.max(1000, weather.nextAt - Date.now())
    weatherTimer = setTimeout(runTransition, remaining)
  }

  function runTransition() {
    if (!weather) return
    // If currently in aurora, the aurora timer handles its own resolution.
    if (weather.state === 'aurora') {
      // Safety: in case timer was lost across reload, end it now if past the window.
      if (Date.now() >= (weather.auroraUntil || 0)) endAurora()
      else { scheduleNextTransition(); return }
    }

    // 1% chance of aurora trigger from any non-aurora state.
    if (Math.random() < 0.01) {
      startAurora()
      return
    }

    // Time-of-day fold-in: 17-20 local hour can roll dusk; 23+ already handled by .is-night.
    const hr = new Date().getHours()
    let next = pickTransition(weather.state)
    if (hr >= 17 && hr < 21 && Math.random() < 0.25 && weather.state !== 'dusk') next = 'dusk'
    if (hr >= 21 && weather.state === 'dusk') next = 'overcast'

    weather.state = next
    weather.dir   = pickWindDir(weather.dir)
    weather.since = Date.now()
    weather.nextAt = Date.now() + (4 + Math.random() * 4) * 60_000

    applyWeather()
    saveWeather()
    scheduleNextTransition()
  }

  function startAurora() {
    weather.prev = (weather.state !== 'aurora') ? weather.state : (weather.prev || 'clear')
    weather.state = 'aurora'
    weather.since = Date.now()
    weather.auroraUntil = Date.now() + 90_000
    weather.nextAt = weather.auroraUntil + 1000
    addWeatherSeen('aurora')
    if (witnessAurora) witnessAurora.classList.add('is-stamped')
    applyWeather()
    saveWeather()

    if (auroraTimer) clearTimeout(auroraTimer)
    const ms = Math.max(0, weather.auroraUntil - Date.now())
    auroraTimer = setTimeout(endAurora, reduceMotion ? 1500 : ms)
    scheduleNextTransition()
  }

  function endAurora() {
    if (!weather || weather.state !== 'aurora') return
    weather.state = weather.prev || 'clear'
    weather.since = Date.now()
    weather.nextAt = Date.now() + (4 + Math.random() * 4) * 60_000
    delete weather.auroraUntil
    applyWeather()
    saveWeather()
    scheduleNextTransition()
  }

  function cycleWeatherManual() {
    if (!weather) return
    // Walk through visible states (skip aurora — that's earned).
    const visible = ['clear', 'breezy', 'overcast', 'drizzle', 'fog', 'dusk']
    const i = visible.indexOf(weather.state)
    weather.state = visible[(i + 1) % visible.length]
    weather.dir = pickWindDir(weather.dir)
    weather.since = Date.now()
    weather.nextAt = Date.now() + (4 + Math.random() * 4) * 60_000
    applyWeather()
    saveWeather()
    scheduleNextTransition()
  }

  function initWeather() {
    const stored = loadWeather()
    if (stored) {
      weather = stored
      // If we were mid-aurora and the window hasn't closed, keep going.
      if (weather.state === 'aurora' && weather.auroraUntil && Date.now() < weather.auroraUntil) {
        applyWeather()
        const ms = weather.auroraUntil - Date.now()
        auroraTimer = setTimeout(endAurora, reduceMotion ? 1500 : ms)
        if (loadWeatherSeen().has('aurora') && witnessAurora) witnessAurora.classList.add('is-stamped')
        scheduleNextTransition()
        return
      }
      // If aurora window expired during reload, resolve it.
      if (weather.state === 'aurora') {
        weather.state = weather.prev || 'clear'
        delete weather.auroraUntil
      }
      // If nextAt already passed, run a transition immediately.
      if (Date.now() >= (weather.nextAt || 0)) {
        applyWeather()
        runTransition()
      } else {
        applyWeather()
        scheduleNextTransition()
      }
    } else {
      weather = {
        state: 'clear',
        dir:   WIND_DIRS[Math.floor(Math.random() * 4)],
        since: Date.now(),
        nextAt: Date.now() + (4 + Math.random() * 4) * 60_000,
      }
      applyWeather()
      saveWeather()
      scheduleNextTransition()
    }
    if (loadWeatherSeen().has('aurora') && witnessAurora) witnessAurora.classList.add('is-stamped')
  }

  if (weatherChip) {
    weatherChip.addEventListener('click', (e) => {
      e.stopPropagation()
      cycleWeatherManual()
    })
  }

  // ---------------------------------------------------------- MUTE

  muteBtn.addEventListener('click', () => {
    muted = !muted
    muteBtn.setAttribute('aria-pressed', String(muted))
    if (!muted) {
      ensureAudio()
      // On unmute, retune pad to current weather with a quick fade-in.
      if (audioReady && sound.built) applyPadForWeather(currentPadKey(), 1.5)
    }
    if (masterGain) masterGain.gain.value = muted ? 0 : 0.15
    setPadMute(muted)
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

    // trail dots (worn first, then active) — drawn under horses but over paper.
    if (trailsOn) {
      // worn marks
      for (const m of wornMarks) {
        const px = m.fx * W, py = m.fy * H
        x.fillStyle = 'rgba(90,28,20,0.30)'
        x.beginPath()
        x.arc(px, py, 2.2, 0, Math.PI * 2)
        x.fill()
      }
      const tNow = Date.now()
      for (const key of Object.keys(trailsByTrack)) {
        const arr = trailsByTrack[key]
        for (const e of arr) {
          const age = tNow - e.t
          if (age >= FADE_MS || age < 0) continue
          const lifeRemaining = 1 - age / FADE_MS
          const op = 0.08 + lifeRemaining * 0.14
          const px = e.fx * W, py = e.fy * H
          x.fillStyle = `rgba(138,42,30,${op.toFixed(3)})`
          x.beginPath()
          x.arc(px, py, 1.9, 0, Math.PI * 2)
          x.fill()
        }
      }
    }

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

  // ---------------------------------------------------------- HISTORY / MEMORY (TRAILS)
  //
  // Each horse remembers its last 12 RESTING positions — positions held still
  // for >= 1.5 seconds. Trail dots fade linearly over 60 minutes of real-world
  // time. Surviving past 30 days promotes a dot to "worn marks" — persistent,
  // capped at 200 globally. Persisted with timestamps so the fade clock keeps
  // ticking across reloads. Originals' trails persist forever (keyed by kind);
  // clones' trails are keyed by runtime id and cleared on delete.

  const TRAILS_KEY      = 'pf:trails'
  const WORN_KEY        = 'pf:wornMarks'
  const TRAILS_VIS_KEY  = 'pf:trailsOn'
  const TRAIL_PER_HORSE = 12
  const REST_HOLD_MS    = 1500
  const FADE_MS         = 60 * 60 * 1000     // 60 minutes
  const WORN_AGE_MS     = 30 * 24 * 60 * 60 * 1000  // 30 days
  const WORN_CAP        = 200
  const SVG_NS          = 'http://www.w3.org/2000/svg'

  const trailsLayer = document.getElementById('trails')
  const trailsToggle = document.getElementById('trailsToggle')
  const marksStamp   = document.getElementById('marksStamp')

  /** @type {Object<string, Array<{fx:number, fy:number, t:number}>>} */
  let trailsByTrack = {}
  /** @type {Array<{fx:number, fy:number, t:number}>} */
  let wornMarks = []
  let trailsOn = true

  function trackKey(h) {
    return h._isOriginal ? `orig:${h.kind}` : `clone:${h.id}`
  }

  function loadTrails() {
    try {
      const raw = localStorage.getItem(TRAILS_KEY)
      if (raw) {
        const obj = JSON.parse(raw)
        if (obj && typeof obj === 'object') trailsByTrack = obj
      }
    } catch (_) {}
    try {
      const raw2 = localStorage.getItem(WORN_KEY)
      if (raw2) {
        const arr = JSON.parse(raw2)
        if (Array.isArray(arr)) wornMarks = arr
      }
    } catch (_) {}
    try {
      const v = localStorage.getItem(TRAILS_VIS_KEY)
      if (v === '0') trailsOn = false
    } catch (_) {}
  }

  function saveTrails() {
    try { localStorage.setItem(TRAILS_KEY, JSON.stringify(trailsByTrack)) } catch (_) {}
  }
  function saveWorn() {
    try { localStorage.setItem(WORN_KEY, JSON.stringify(wornMarks)) } catch (_) {}
  }

  // Convert paddock pixel coords to fractional [0,1] so trails survive resize.
  function pxToFrac(x, y) {
    const r = paddock.getBoundingClientRect()
    const w = Math.max(1, r.width), h = Math.max(1, r.height)
    return { fx: clamp(x / w, 0, 1), fy: clamp(y / h, 0, 1) }
  }
  function fracToPx(fx, fy) {
    const r = paddock.getBoundingClientRect()
    return { x: fx * r.width, y: fy * r.height }
  }

  // The "resting position" we track is the horse's body center (paddock coords).
  function horseCenter(h) {
    const pw = h._el.offsetWidth || 150, ph = h._el.offsetHeight || 84
    return { cx: h._x + pw / 2, cy: h._y + ph * 0.78 }
  }

  // Tick: detect resting horses, push to trail when held >= REST_HOLD_MS.
  function tickRestMemory() {
    const t = Date.now()
    let pushed = false
    for (const h of horses) {
      if (h === dragging) { h._restStart = 0; continue }
      const { cx, cy } = horseCenter(h)
      // Initialize tracking
      if (h._restStart == null) {
        h._restStart = 0
        h._restCX = cx; h._restCY = cy
        h._restRecorded = false
      }
      const moved = Math.hypot(cx - (h._restCX || cx), cy - (h._restCY || cy)) > 3
      if (moved) {
        h._restStart = t
        h._restCX = cx; h._restCY = cy
        h._restRecorded = false
        continue
      }
      if (!h._restStart) h._restStart = t
      if (!h._restRecorded && (t - h._restStart) >= REST_HOLD_MS) {
        recordRest(h, cx, cy, t)
        h._restRecorded = true
      }
    }
    if (pushed) saveTrails()
  }

  function recordRest(h, cx, cy, t) {
    const key = trackKey(h)
    const arr = trailsByTrack[key] || (trailsByTrack[key] = [])
    const { fx, fy } = pxToFrac(cx, cy)
    // Avoid duplicate of the most recent entry (within ~6px).
    const last = arr[arr.length - 1]
    if (last) {
      const px = fracToPx(last.fx, last.fy)
      if (Math.hypot(px.x - cx, px.y - cy) < 6) {
        last.t = t
        saveTrails()
        return
      }
    }
    arr.push({ fx, fy, t })
    while (arr.length > TRAIL_PER_HORSE) arr.shift()
    saveTrails()
  }

  function clearTrailFor(h) {
    const key = trackKey(h)
    if (trailsByTrack[key]) {
      delete trailsByTrack[key]
      saveTrails()
    }
  }

  // Promote any active dot older than WORN_AGE_MS to worn marks. Worn marks
  // are no longer subject to the 60-min fade. Cap at WORN_CAP, oldest evict.
  function promoteAndExpire() {
    const t = Date.now()
    let trailsDirty = false
    let wornDirty = false
    for (const key of Object.keys(trailsByTrack)) {
      const arr = trailsByTrack[key]
      const kept = []
      for (const e of arr) {
        const age = t - e.t
        if (age >= WORN_AGE_MS) {
          wornMarks.push({ fx: e.fx, fy: e.fy, t: e.t })
          wornDirty = true
          trailsDirty = true
        } else if (age >= FADE_MS) {
          // expired without surviving long enough
          trailsDirty = true
        } else {
          kept.push(e)
        }
      }
      if (kept.length !== arr.length) {
        if (kept.length === 0) delete trailsByTrack[key]
        else trailsByTrack[key] = kept
      }
    }
    // Cap worn marks
    if (wornMarks.length > WORN_CAP) {
      wornMarks.sort((a, b) => a.t - b.t)
      wornMarks = wornMarks.slice(wornMarks.length - WORN_CAP)
      wornDirty = true
    }
    if (trailsDirty) saveTrails()
    if (wornDirty) saveWorn()
  }

  // Render one SVG circle per dot. Skip dots that fall directly under a
  // horse's current position (no clutter under feet).
  function renderTrails() {
    if (!trailsLayer) return
    // Fast clear
    while (trailsLayer.firstChild) trailsLayer.removeChild(trailsLayer.firstChild)
    if (!trailsOn) return

    const r = paddock.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) return

    // Build a list of horse footprints to mask.
    const footprints = horses.map(h => {
      const { cx, cy } = horseCenter(h)
      return { cx, cy, rad: (h._el.offsetWidth || 150) * 0.36 }
    })

    function underHorse(x, y) {
      for (const f of footprints) {
        const dx = x - f.cx, dy = y - f.cy
        if (dx * dx + dy * dy < f.rad * f.rad) return true
      }
      return false
    }

    const t = Date.now()
    const frag = document.createDocumentFragment()

    // Worn marks first (deeper layer).
    for (const m of wornMarks) {
      const { x, y } = fracToPx(m.fx, m.fy)
      if (underHorse(x, y)) continue
      const c = document.createElementNS(SVG_NS, 'circle')
      c.setAttribute('cx', x.toFixed(1))
      c.setAttribute('cy', y.toFixed(1))
      c.setAttribute('r', '2.2')
      c.setAttribute('fill', '#5a1c14')
      c.setAttribute('fill-opacity', '0.30')
      frag.appendChild(c)
    }

    // Active trail dots.
    for (const key of Object.keys(trailsByTrack)) {
      const arr = trailsByTrack[key]
      for (const e of arr) {
        const age = t - e.t
        if (age >= FADE_MS || age < 0) continue
        const lifeRemaining = 1 - age / FADE_MS  // 1 → 0
        // Map to opacity 8% → 22% (fresh = 22%, oldest survivable = 8%).
        const op = 0.08 + lifeRemaining * 0.14
        const { x, y } = fracToPx(e.fx, e.fy)
        if (underHorse(x, y)) continue
        const c = document.createElementNS(SVG_NS, 'circle')
        c.setAttribute('cx', x.toFixed(1))
        c.setAttribute('cy', y.toFixed(1))
        c.setAttribute('r', '1.9')
        c.setAttribute('fill', '#8a2a1e')
        c.setAttribute('fill-opacity', op.toFixed(3))
        frag.appendChild(c)
      }
    }

    trailsLayer.appendChild(frag)
  }

  function setTrailsVisible(on) {
    trailsOn = !!on
    trailsLayer.classList.toggle('is-off', !trailsOn)
    if (trailsToggle) trailsToggle.setAttribute('aria-pressed', String(trailsOn))
    try { localStorage.setItem(TRAILS_VIS_KEY, trailsOn ? '1' : '0') } catch (_) {}
    renderTrails()
  }

  if (trailsToggle) {
    trailsToggle.addEventListener('click', (e) => {
      e.stopPropagation()
      setTrailsVisible(!trailsOn)
    })
  }

  // (N marks) stamp on reload, when worn marks >= 50.
  function maybeShowMarksStamp() {
    if (!marksStamp) return
    const n = wornMarks.length
    if (n < 50) return
    marksStamp.textContent = `(${n} marks)`
    marksStamp.classList.add('is-on')
    setTimeout(() => marksStamp.classList.remove('is-on'), 4000)
  }

  // Memory runs on cheap timers — independent of rAF, fine when tab is idle too.
  setInterval(() => tickRestMemory(), 250)
  setInterval(() => renderTrails(), 2000)
  setInterval(() => promoteAndExpire(), 60_000)

  // Re-render on resize so fractional coords update visually.
  window.addEventListener('resize', () => {
    requestAnimationFrame(renderTrails)
  }, { passive: true })

  // ---------------------------------------------------------- GROUP DYNAMICS (ITER 4)
  //
  // Per-pair affinity tracking. Each unordered pair of horses (id1|id2 with
  // id1 < id2) carries an affinity score that grows from co-clicks, co-located
  // rest, and erodes slowly over time. The graph drives idle drift and a
  // hover-revealed "closest to <name>" line.
  //
  // Track keys mirror the trail system: `orig:<kind>` for originals, and a
  // runtime `clone:<id>` for clones (so cloned identities persist within a
  // session but don't pollute long-term memory across reloads).

  const AFFINITY_KEY        = 'pf:affinity'
  const COCLICK_WINDOW_MS   = 5000
  const COLOCATE_DIST       = 120
  const COLOCATE_REST_VEL   = 0.3
  const COLOCATE_RATE       = 0.05    // per second per pair
  const COLOCATE_CAP        = 50      // max affinity per pair (prevent runaway)
  const DECAY_PER_MIN       = 0.01    // per pair per minute
  const IDLE_DRIFT_MS       = 60_000
  const REVEAL_AFTER_MS     = 30_000  // drift must run >= 30s before hover reveal
  const HOVER_REVEAL_MS     = 1000
  const FRIEND_THRESHOLD    = 1.0
  const LONELY_THRESHOLD    = 0.0
  const DRIFT_FORCE         = 0.002   // px / frame^2 (multiplied by 60 below for px/s^2)
  const DRIFT_VEL_CAP       = 0.1     // px / frame -> px/s = 6
  const AFFINITY_SAVE_MS    = 5000

  /** @type {Object<string, number>} */
  let affinity = {}
  let affinityDirty = false
  let lastAffinitySave = 0
  let lastDecayTickAt = 0

  /** @type {Object<string, number>} */
  const lastClickAt = {}   // horseId -> performance.now()

  // Idle / drift state.
  let lastInputAt = now()
  let driftStartedAt = 0      // 0 = not currently drifting
  let driftRunMs = 0          // total ms drift has accumulated this session

  // Hover reveal state.
  let hoverHorse = null
  let hoverStartAt = 0
  let revealedHorse = null

  function trackId(h) {
    return h._isOriginal ? `orig:${h.kind}` : `clone:${h.id}`
  }
  function pairKey(a, b) {
    const ka = trackId(a), kb = trackId(b)
    return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`
  }
  function getAffinity(a, b) {
    return affinity[pairKey(a, b)] || 0
  }
  function bumpAffinity(a, b, delta) {
    if (a === b) return
    const k = pairKey(a, b)
    const v = (affinity[k] || 0) + delta
    if (v <= 0) {
      if (affinity[k]) { delete affinity[k]; affinityDirty = true }
      return
    }
    affinity[k] = Math.min(COLOCATE_CAP, v)
    affinityDirty = true
  }

  function loadAffinity() {
    try {
      const raw = localStorage.getItem(AFFINITY_KEY)
      if (!raw) return
      const obj = JSON.parse(raw)
      if (obj && typeof obj === 'object') affinity = obj
    } catch (_) {}
  }
  function saveAffinityIfDirty() {
    if (!affinityDirty) return
    const t = now()
    if (t - lastAffinitySave < AFFINITY_SAVE_MS) return
    try { localStorage.setItem(AFFINITY_KEY, JSON.stringify(affinity)) } catch (_) {}
    affinityDirty = false
    lastAffinitySave = t
  }

  // Co-click hook: called each time a horse is clicked (tap or drag start).
  function noteClick(h) {
    const t = now()
    // Find any other horse clicked within window — bump pair.
    for (const other of horses) {
      if (other === h) continue
      const ot = lastClickAt[other.id]
      if (ot && (t - ot) <= COCLICK_WINDOW_MS) {
        bumpAffinity(h, other, 1)
      }
    }
    lastClickAt[h.id] = t
  }

  // Co-hat hook: called when a hat lands on a horse — if any other horse has
  // received the same hat in its top slot recently, treat as co-applied.
  const lastHatAt = {}  // `${horseId}|${glyph}` -> ts
  function noteHat(h, glyph) {
    const t = now()
    for (const other of horses) {
      if (other === h) continue
      const k = `${other.id}|${glyph}`
      const ot = lastHatAt[k]
      if (ot && (t - ot) <= COCLICK_WINDOW_MS) {
        bumpAffinity(h, other, 1)
      }
    }
    lastHatAt[`${h.id}|${glyph}`] = t
  }

  // Lonely score: -sum of affinities with everyone else.
  function lonelinessScore(h) {
    let sum = 0
    for (const other of horses) {
      if (other === h) continue
      sum += getAffinity(h, other)
    }
    return -sum
  }

  function topFriend(h) {
    let best = null, bestVal = 0
    for (const other of horses) {
      if (other === h) continue
      const v = getAffinity(h, other)
      if (v > bestVal) { bestVal = v; best = other }
    }
    return best ? { horse: best, affinity: bestVal } : null
  }

  // Per-frame: co-located resting accrual + decay + idle drift forces.
  let _coLocAccum = 0
  let _decayAccum = 0
  function tickGroupDynamics(t, dt) {
    // 1) Co-located rest accrual at ~5Hz.
    _coLocAccum += dt
    if (_coLocAccum >= 0.2) {
      const slice = _coLocAccum
      _coLocAccum = 0
      const n = horses.length
      for (let i = 0; i < n; i++) {
        const a = horses[i]
        if (a === dragging) continue
        if (Math.hypot(a._vx, a._vy) >= COLOCATE_REST_VEL * 60) continue
        for (let j = i + 1; j < n; j++) {
          const b = horses[j]
          if (b === dragging) continue
          if (Math.hypot(b._vx, b._vy) >= COLOCATE_REST_VEL * 60) continue
          const aw = a._el.offsetWidth, ah = a._el.offsetHeight
          const bw = b._el.offsetWidth, bh = b._el.offsetHeight
          const dx = (a._x + aw / 2) - (b._x + bw / 2)
          const dy = (a._y + ah / 2) - (b._y + bh / 2)
          if (dx * dx + dy * dy < COLOCATE_DIST * COLOCATE_DIST) {
            bumpAffinity(a, b, COLOCATE_RATE * slice)
          }
        }
      }
    }

    // 2) Slow decay across all pairs (-0.01/min).
    _decayAccum += dt
    if (_decayAccum >= 1) {
      const slice = _decayAccum
      _decayAccum = 0
      const decay = (DECAY_PER_MIN / 60) * slice
      for (const k of Object.keys(affinity)) {
        const v = affinity[k] - decay
        if (v <= 0) { delete affinity[k]; affinityDirty = true }
        else { affinity[k] = v; affinityDirty = true }
      }
    }

    // 3) Idle drift forces.
    const idleMs = (now() - lastInputAt)
    const idle = idleMs >= IDLE_DRIFT_MS
    if (idle && !showState.running && !dragging && !reduceMotion) {
      if (!driftStartedAt) {
        driftStartedAt = now()
        if (herdStampEl) {
          herdStampEl.classList.remove('is-off')
          herdStampEl.classList.add('is-on')
          herdStampEl.setAttribute('aria-hidden', 'false')
        }
      }
      driftRunMs += dt * 1000
      applyDriftForces(dt)
    } else if (driftStartedAt) {
      driftStartedAt = 0
      if (herdStampEl) {
        herdStampEl.classList.remove('is-on')
        herdStampEl.classList.add('is-off')
        herdStampEl.setAttribute('aria-hidden', 'true')
      }
    }

    // 4) Friendship reveal on hover (only after drift has run >=30s once).
    updateFriendReveal()

    // 5) Debounced save.
    saveAffinityIfDirty()
  }

  function applyDriftForces(dt) {
    const { w, h: H } = bounds()
    const accel = DRIFT_FORCE * 60 * 60   // convert per-frame^2 (60fps) to px/s^2
    const cap = DRIFT_VEL_CAP * 60        // px/s
    const corners = [[0, 0], [w, 0], [0, H], [w, H]]
    for (const p of horses) {
      if (p === dragging) continue
      const friend = topFriend(p)
      let tx = 0, ty = 0, has = false
      if (friend && friend.affinity > 0.5) {
        const f = friend.horse
        tx = (f._x + f._el.offsetWidth / 2) - (p._x + p._el.offsetWidth / 2)
        ty = (f._y + f._el.offsetHeight / 2) - (p._y + p._el.offsetHeight / 2)
        has = true
      } else {
        // Nearest paddock corner.
        const cx = p._x + p._el.offsetWidth / 2
        const cy = p._y + p._el.offsetHeight / 2
        let best = null, bestD = Infinity
        for (const c of corners) {
          const dx = c[0] - cx, dy = c[1] - cy
          const d = dx * dx + dy * dy
          if (d < bestD) { bestD = d; best = c }
        }
        if (best) {
          tx = best[0] - cx
          ty = best[1] - cy
          has = true
        }
      }
      if (!has) continue
      const m = Math.hypot(tx, ty) || 1
      p._vx += (tx / m) * accel * dt
      p._vy += (ty / m) * accel * dt
      // Cap drift velocity contribution.
      const sp = Math.hypot(p._vx, p._vy)
      if (sp > cap) {
        p._vx = (p._vx / sp) * cap
        p._vy = (p._vy / sp) * cap
      }
    }
  }

  function updateFriendReveal() {
    // Reveal becomes available after drift has run >=30s, or — for reduced
    // motion where drift never starts — after an equivalent idle window.
    const idleMs = now() - lastInputAt
    const driftedEnough = driftRunMs >= REVEAL_AFTER_MS
    const reducedQualifies = reduceMotion && idleMs >= (IDLE_DRIFT_MS + REVEAL_AFTER_MS)
    if ((!driftedEnough && !reducedQualifies) || !hoverHorse) {
      if (revealedHorse) {
        revealedHorse._el.classList.remove('is-friend-revealed')
        const f = revealedHorse._el.querySelector('.pony__friend')
        if (f) f.textContent = ''
        revealedHorse = null
      }
      return
    }
    if ((now() - hoverStartAt) < HOVER_REVEAL_MS) return
    if (revealedHorse === hoverHorse) return
    // Reveal closest friend if affinity > threshold.
    const tf = topFriend(hoverHorse)
    if (!tf || tf.affinity <= FRIEND_THRESHOLD) return
    if (revealedHorse && revealedHorse !== hoverHorse) {
      revealedHorse._el.classList.remove('is-friend-revealed')
    }
    const otherName = tf.horse.name || KIND_BY_ID[tf.horse.kind].name
    const fEl = hoverHorse._el.querySelector('.pony__friend')
    if (fEl) fEl.textContent = `closest to ${otherName.toLowerCase()}`
    hoverHorse._el.classList.add('is-friend-revealed')
    revealedHorse = hoverHorse
  }

  // Pointer hover bookkeeping (uses the existing window pointermove signal).
  function refreshHover(e) {
    const target = e.target && e.target.closest ? e.target.closest('.pony') : null
    if (!target) {
      if (hoverHorse) { hoverHorse = null; hoverStartAt = 0 }
      return
    }
    const h = horses.find(x => x._el === target)
    if (!h) return
    if (h !== hoverHorse) {
      hoverHorse = h
      hoverStartAt = now()
    }
  }
  window.addEventListener('pointermove', refreshHover, { passive: true })
  window.addEventListener('pointerover', refreshHover, { passive: true })

  // Idle bookkeeping. Reset on any pointer or key activity.
  ;['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'].forEach(ev => {
    window.addEventListener(ev, () => { lastInputAt = now() }, { passive: true })
  })

  const herdStampEl = document.getElementById('herdStamp')

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
    initWeather()
    scheduleIdle()

    // Group dynamics: load persisted affinity graph.
    loadAffinity()

    // History / memory: load, settle, render, show stamp if deep memory exists.
    loadTrails()
    promoteAndExpire()
    setTrailsVisible(trailsOn)
    maybeShowMarksStamp()

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

  // Force-save affinity on hide/unload (debounce window may be open).
  window.addEventListener('pagehide', () => {
    if (affinityDirty) {
      try { localStorage.setItem(AFFINITY_KEY, JSON.stringify(affinity)) } catch (_) {}
      affinityDirty = false
    }
  })

  // hash change
  window.addEventListener('hashchange', () => {
    if (location.hash.startsWith('#s=')) {
      const data = decodeHash(location.hash.slice(3))
      if (data && restoreFrom(data)) showToast('scene loaded')
    }
  })
})()
