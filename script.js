// Ponyforge — JUICE pass.
// Layered on top of the catalogue rev: a tiny rAF physics loop drives
// every pony so drag-release flings, walls bounce, horses jostle each
// other, and landings squash. Adds Web Audio tactile cues, a hat that
// arcs to its target, and a small camera shake on hard impacts.
// No libraries, no build. Pure vanilla.

(() => {
  const paddock   = document.getElementById('paddock')
  const ring      = document.getElementById('ring')
  const ringTarget= document.getElementById('ringTarget')
  const recallBtn = document.getElementById('recall')
  const muteBtn   = document.getElementById('mute')
  const hint      = document.getElementById('hint')
  const ponies    = [...document.querySelectorAll('.pony')]
  const ringHats  = [...document.querySelectorAll('.ring__hat')]

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // ---------------------------------------------------------- STATE

  const home = new Map()
  let dragging = null
  let dragId = 0
  let dragOffX = 0, dragOffY = 0
  let dragStartX = 0, dragStartY = 0
  let didMove = false
  let lastFocusedPony = null
  let ringTargetPony = null
  let hintFaded = false

  // pointer velocity sampling
  let velSamples = []  // { t, x, y }

  // camera shake
  let shakeAmp = 0
  let shakeUntil = 0

  // ---------------------------------------------------------- HELPERS

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
  const now = () => performance.now()

  function setXY(pony, x, y) {
    pony._x = x; pony._y = y
    pony.style.setProperty('--x', `${x}px`)
    pony.style.setProperty('--y', `${y}px`)
  }
  function setScale(pony, sx, sy) {
    pony._sx = sx; pony._sy = sy
    pony.style.setProperty('--sx', sx.toFixed(3))
    pony.style.setProperty('--sy', sy.toFixed(3))
  }
  function setRot(pony, r) {
    pony._r = r
    pony.style.setProperty('--r', `${r.toFixed(2)}deg`)
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

  // ---------------------------------------------------------- AUDIO

  // Lazy WebAudio. Created on first user gesture so we never autoplay.
  let actx = null
  let masterGain = null
  let muted = false
  let audioReady = false

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
    } catch (_) { /* ignore */ }
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
      // xylophone-ish: triangle + small noise tap
      blip({ freq: pitch, type: 'triangle', dur: 0.12, gain: 0.5, release: 0.12 })
      blip({ freq: pitch * 2.01, type: 'sine', dur: 0.06, gain: 0.2, release: 0.08 })
    },
    hatLand() { noiseBurst({ dur: 0.12, gain: 0.45, lpf: 2400 }) },
  }

  // ---------------------------------------------------------- PHYSICS

  // Each pony gets vx, vy in px/s; mass; squash sx/sy; angle r.
  // Loop integrates with friction; walls bounce; pair-collisions via
  // soft spring along centre-to-centre axis.

  const FRICTION   = 3.2     // higher = stops sooner
  const WALL_REST  = 0.55    // 0..1 energy retained on wall hit
  const PAIR_REST  = 0.35
  const MIN_BOUNCE = 70      // px/s threshold for sound/shake
  const SQUASH_K   = 0.0009  // velocity -> squash amount
  const SQUASH_RECOVER = 8.0 // higher = snaps back faster
  const TILT_K     = 0.04
  const TILT_RECOVER = 7.0

  function masses() {
    // give each horse a slightly different mass for personality
    ponies.forEach((p, i) => {
      p._mass   = 0.9 + (i % 3) * 0.12 + (i * 0.037)
      p._radius = (p.offsetWidth || 150) * 0.42  // ~ collision radius
      p._vx = 0; p._vy = 0
      p._sx = 1; p._sy = 1
      p._r = 0
    })
  }

  function bounds() {
    const r = paddock.getBoundingClientRect()
    return { w: r.width, h: r.height }
  }

  let lastT = 0
  function tick(t) {
    if (!lastT) lastT = t
    const dt = Math.min(0.040, (t - lastT) / 1000)
    lastT = t

    if (!reduceMotion) integrate(dt, t)
    updateShake(t)

    requestAnimationFrame(tick)
  }

  function integrate(dt, t) {
    const { w, h } = bounds()

    // 1. Apply velocities to non-dragging ponies
    for (const p of ponies) {
      if (p === dragging) continue
      if (Math.abs(p._vx) < 0.5 && Math.abs(p._vy) < 0.5) {
        p._vx = 0; p._vy = 0
      } else {
        // friction (exponential decay)
        const k = Math.exp(-FRICTION * dt)
        p._vx *= k
        p._vy *= k

        let nx = p._x + p._vx * dt
        let ny = p._y + p._vy * dt

        const pw = p.offsetWidth, ph = p.offsetHeight
        const minX = 4, minY = 4
        const maxX = w - pw - 4, maxY = h - ph - 4

        let bounced = false
        let bounceSpeed = 0
        if (nx < minX) { nx = minX; bounceSpeed = Math.max(bounceSpeed, Math.abs(p._vx)); p._vx = -p._vx * WALL_REST; bounced = true }
        else if (nx > maxX) { nx = maxX; bounceSpeed = Math.max(bounceSpeed, Math.abs(p._vx)); p._vx = -p._vx * WALL_REST; bounced = true }
        if (ny < minY) { ny = minY; bounceSpeed = Math.max(bounceSpeed, Math.abs(p._vy)); p._vy = -p._vy * WALL_REST; bounced = true }
        else if (ny > maxY) { ny = maxY; bounceSpeed = Math.max(bounceSpeed, Math.abs(p._vy)); p._vy = -p._vy * WALL_REST; bounced = true }

        if (bounced && bounceSpeed > MIN_BOUNCE) {
          sfx.wall()
          if (bounceSpeed > 600) shake(Math.min(5, bounceSpeed * 0.005))
          // squash on impact
          const amt = Math.min(0.22, bounceSpeed * SQUASH_K * 1.2)
          // squash perpendicular to wall — keep simple: axis-aligned squash
          if (Math.abs(p._vx) > Math.abs(p._vy)) { p._sx = 1 - amt; p._sy = 1 + amt * 0.6 }
          else { p._sy = 1 - amt; p._sx = 1 + amt * 0.6 }
        }
        p._x = nx; p._y = ny
      }
    }

    // 2. Pair collisions (n^2 over 6 — fine)
    for (let i = 0; i < ponies.length; i++) {
      for (let j = i + 1; j < ponies.length; j++) {
        resolvePair(ponies[i], ponies[j])
      }
    }

    // 3. Speed-driven squash/stretch + tilt recovery
    for (const p of ponies) {
      if (p === dragging) continue
      const speed = Math.hypot(p._vx, p._vy)
      // restore towards (1,1)
      const k = 1 - Math.exp(-SQUASH_RECOVER * dt)
      p._sx += (1 - p._sx) * k
      p._sy += (1 - p._sy) * k
      // mild stretch in motion direction (subtle)
      if (speed > 60) {
        const stretch = Math.min(0.10, speed * 0.00012)
        // bias along x-axis since horses are landscape — looks right
        const angle = Math.atan2(p._vy, p._vx)
        const ax = Math.abs(Math.cos(angle))
        p._sx += stretch * ax * dt * 6
        p._sy -= stretch * ax * dt * 6 * 0.5
      }
      // tilt recovers
      const tk = 1 - Math.exp(-TILT_RECOVER * dt)
      p._r += (0 - p._r) * tk

      setScale(p, p._sx, p._sy)
      setRot(p, p._r)
      p.style.setProperty('--x', `${p._x}px`)
      p.style.setProperty('--y', `${p._y}px`)
    }

    // 4. Update depth ordering as horses move
    sortDepth()
  }

  function resolvePair(a, b) {
    if (a === dragging && b === dragging) return
    const aw = a.offsetWidth, ah = a.offsetHeight
    const bw = b.offsetWidth, bh = b.offsetHeight
    const acx = a._x + aw / 2, acy = a._y + ah / 2
    const bcx = b._x + bw / 2, bcy = b._y + bh / 2
    const dx = bcx - acx, dy = bcy - acy
    const dist = Math.hypot(dx, dy) || 0.0001
    const minDist = a._radius + b._radius
    if (dist >= minDist) return

    const overlap = minDist - dist
    const nx = dx / dist, ny = dy / dist

    // mass-weighted positional resolution
    const totalM = a._mass + b._mass
    const aShare = b._mass / totalM
    const bShare = a._mass / totalM

    if (a !== dragging) {
      a._x -= nx * overlap * aShare
      a._y -= ny * overlap * aShare
    } else {
      // dragged horse pushes the other twice as hard
      b._x += nx * overlap
      b._y += ny * overlap
    }
    if (b !== dragging) {
      b._x += nx * overlap * bShare
      b._y += ny * overlap * bShare
    } else {
      a._x -= nx * overlap
      a._y -= ny * overlap
    }

    // velocity exchange along normal
    const avx = a._vx, avy = a._vy
    const bvx = b._vx, bvy = b._vy
    const va = avx * nx + avy * ny
    const vb = bvx * nx + bvy * ny
    if (va - vb < 0) return  // already separating

    const impulse = (1 + PAIR_REST) * (va - vb) / totalM
    if (a !== dragging) {
      a._vx -= impulse * b._mass * nx
      a._vy -= impulse * b._mass * ny
    }
    if (b !== dragging) {
      b._vx += impulse * a._mass * nx
      b._vy += impulse * a._mass * ny
    }

    // collision feedback
    const relSpeed = Math.abs(va - vb)
    if (relSpeed > MIN_BOUNCE) {
      // pitch by combined mass — heavier = lower
      const pitch = clamp(900 / Math.sqrt(a._mass + b._mass), 280, 1300)
      sfx.collide(pitch + (Math.random() - 0.5) * 80)
      if (relSpeed > 700) shake(Math.min(4, relSpeed * 0.004))
      // squash both
      const amt = Math.min(0.18, relSpeed * SQUASH_K)
      a._sx = 1 - amt; a._sy = 1 + amt * 0.6
      b._sx = 1 - amt; b._sy = 1 + amt * 0.6
    }
  }

  // ---------------------------------------------------------- CAMERA SHAKE

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
    const sx = (Math.random() * 2 - 1) * a
    const sy = (Math.random() * 2 - 1) * a
    paddock.style.setProperty('--shake-x', `${sx.toFixed(2)}px`)
    paddock.style.setProperty('--shake-y', `${sy.toFixed(2)}px`)
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
    const padTop = 96
    const padBot = 56
    const cellW = (w - padX * 2) / cols
    const cellH = (h - padTop - padBot) / rows

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
      setScale(p, 1, 1)
      setRot(p, 0)
      p._vx = 0; p._vy = 0
      home.set(p, [x, y])
    })
    sortDepth()
  }

  // ---------------------------------------------------------- HAT FITTING

  function fitHat(pony, glyph, fromX, fromY) {
    const slot = pony.querySelector('.hat-slot')
    if (!slot) return
    if (reduceMotion) {
      slot.textContent = glyph
      pony.dataset.hat = glyph
      return
    }
    if (fromX != null && fromY != null) {
      flyHatTo(pony, glyph, fromX, fromY)
    } else {
      // fallback: drop from above
      const r = pony.getBoundingClientRect()
      flyHatTo(pony, glyph, r.left + r.width / 2, r.top - 80)
    }
  }

  function flyHatTo(pony, glyph, fromX, fromY) {
    const slot = pony.querySelector('.hat-slot')
    const slotRect = slot.getBoundingClientRect()
    const tx = slotRect.left + slotRect.width / 2
    const ty = slotRect.top + slotRect.height / 2

    const projectile = document.createElement('div')
    projectile.className = 'hat-fly'
    projectile.textContent = glyph
    document.body.appendChild(projectile)

    // hide existing slot during flight
    const prevHat = slot.textContent
    slot.classList.remove('is-landing')
    slot.classList.add('is-falling')

    const start = now()
    const dur = 420
    const dx = tx - fromX, dy = ty - fromY
    // arc height: more for longer throws, capped
    const arc = Math.min(120, Math.hypot(dx, dy) * 0.35) + 40
    const startRot = (Math.random() - 0.5) * 60
    const endRot = (Math.random() - 0.5) * 20

    function frame(t) {
      const k = Math.min(1, (t - start) / dur)
      // ease-out for x, parabola for y
      const ek = 1 - Math.pow(1 - k, 2)
      const cx = fromX + dx * ek
      // parabolic offset peaking at k=0.5
      const arcOff = -arc * 4 * k * (1 - k)
      const cy = fromY + dy * ek + arcOff
      const rot = startRot + (endRot - startRot) * ek
      projectile.style.transform = `translate3d(${cx - 14}px, ${cy - 14}px, 0) rotate(${rot}deg)`
      if (k < 1) {
        requestAnimationFrame(frame)
      } else {
        projectile.remove()
        slot.classList.remove('is-falling')
        slot.textContent = glyph
        pony.dataset.hat = glyph
        void slot.offsetWidth
        slot.classList.add('is-landing')
        slot.addEventListener('animationend', () => slot.classList.remove('is-landing'), { once: true })
        sfx.hatLand()
        // tiny squish on the pony to acknowledge landing
        pony._sy = 0.94; pony._sx = 1.05
      }
    }
    requestAnimationFrame(frame)
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
      if (pony) {
        const hr = h.getBoundingClientRect()
        fitHat(pony, glyph, hr.left + hr.width / 2, hr.top + hr.height / 2)
      }
      closeRing()
      if (pony) pony.focus({ preventScroll: true })
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
    // keep only last 100ms
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

  function onPonyPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    ensureAudio()
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
    pony._vx = 0; pony._vy = 0

    velSamples = []
    pushVelSample(e.clientX, e.clientY)

    sfx.pickup()

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

      pushVelSample(e.clientX, e.clientY)

      // live squash/stretch from instantaneous pointer velocity
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
          // align stretch with horizontal axis (horse silhouette)
          const ax = Math.abs(Math.cos(ang))
          dragging._sx = 1 + stretch * ax
          dragging._sy = 1 - stretch * ax * 0.55
        } else {
          dragging._sx += (1 - dragging._sx) * 0.2
          dragging._sy += (1 - dragging._sy) * 0.2
        }
        setScale(dragging, dragging._sx, dragging._sy)
        const tilt = clamp(ivx * TILT_K * 0.01, -8, 8)
        setRot(dragging, tilt)
      } else {
        const tilt = clamp(dx * 0.02, -6, 6)
        setRot(dragging, tilt)
      }

      setXY(dragging, x, y)
    }
  }

  function onPonyPointerUp(e) {
    if (!dragging || e.pointerId !== dragId) return
    const pony = dragging
    try { pony.releasePointerCapture(dragId) } catch (_) {}
    paddock.classList.remove('is-holding')

    if (didMove) {
      pony.classList.remove('is-lifted')
      pony.style.setProperty('--lift', '0')
      // hand off to physics with fling velocity
      pushVelSample(e.clientX, e.clientY)
      const { vx, vy } = computeFlingVelocity()
      pony._vx = vx
      pony._vy = vy
      // landing squash scaled by impact intensity (use vertical speed)
      const speed = Math.hypot(vx, vy)
      if (!reduceMotion) {
        const amt = Math.min(0.18, 0.06 + speed * 0.00012)
        pony._sx = 1 + amt
        pony._sy = 1 - amt * 0.6
      }
      sfx.drop()
      sortDepth()
      dragging = null
    } else {
      pony.classList.remove('is-lifted')
      pony.style.setProperty('--lift', '0')
      const rect = pony.getBoundingClientRect()
      openRingAt(rect.left + rect.width / 2, rect.top + rect.height / 2, pony)
      dragging = null
    }
  }

  function onPonyPointerCancel() {
    if (!dragging) return
    dragging.classList.remove('is-lifted')
    dragging.style.setProperty('--lift', '0')
    setRot(dragging, 0)
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

    if (KEY_TO_HAT[e.key] !== undefined) {
      ensureAudio()
      const target = ringTargetPony
        || (focused && focused.classList?.contains('pony') ? focused : lastFocusedPony)
      if (target) {
        e.preventDefault()
        // launch from the matching ring button position if the ring is open
        const ringBtn = ringHats.find(h => h.dataset.key === e.key)
        if (isRingOpen() && ringBtn) {
          const hr = ringBtn.getBoundingClientRect()
          fitHat(target, KEY_TO_HAT[e.key], hr.left + hr.width / 2, hr.top + hr.height / 2)
        } else {
          fitHat(target, KEY_TO_HAT[e.key])
        }
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
        focused._vx = 0; focused._vy = 0
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
      p._vx = 0; p._vy = 0
      setXY(p, hx, hy)
      setScale(p, 1, 1)
      setRot(p, 0)
      if (!reduceMotion) {
        p.classList.remove('is-landing')
        void p.offsetWidth
        p.classList.add('is-landing')
      }
    })
    sortDepth()
    sfx.drop()
  }
  recallBtn.addEventListener('click', () => { ensureAudio(); recall() })

  // ---------------------------------------------------------- MUTE

  muteBtn.addEventListener('click', () => {
    muted = !muted
    muteBtn.setAttribute('aria-pressed', String(muted))
    if (!muted) ensureAudio()
    if (masterGain) masterGain.gain.value = muted ? 0 : 0.15
  })

  // ---------------------------------------------------------- INIT

  placeRingHats()

  function init() {
    masses()
    layoutHerd()
    sortDepth()
    requestAnimationFrame(tick)
  }

  if (document.readyState === 'complete') {
    requestAnimationFrame(init)
  } else {
    window.addEventListener('load', () => requestAnimationFrame(init), { once: true })
  }

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
