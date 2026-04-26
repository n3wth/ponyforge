// VISUAL CHAOS — fullscreen background canvas
// Particles, bursts, shockwaves, parade confetti. Vanilla, no deps.
(function () {
  const canvas = document.getElementById('chaos-bg')
  if (!canvas) return

  const ctx = canvas.getContext('2d', { alpha: true })
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  let W = 0, H = 0, dpr = 1
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    W = window.innerWidth
    H = window.innerHeight
    canvas.width = Math.floor(W * dpr)
    canvas.height = Math.floor(H * dpr)
    canvas.style.width = W + 'px'
    canvas.style.height = H + 'px'
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  resize()
  window.addEventListener('resize', resize)

  // Reduced motion: paint a static gradient and bail
  if (reduced) {
    const g = ctx.createLinearGradient(0, 0, W, H)
    g.addColorStop(0, '#ff1493')
    g.addColorStop(0.33, '#b026ff')
    g.addColorStop(0.66, '#00ffd5')
    g.addColorStop(1, '#ffea00')
    ctx.fillStyle = g
    ctx.globalAlpha = 0.18
    ctx.fillRect(0, 0, W, H)
    window.addEventListener('resize', () => {
      const gg = ctx.createLinearGradient(0, 0, W, H)
      gg.addColorStop(0, '#ff1493'); gg.addColorStop(0.33, '#b026ff')
      gg.addColorStop(0.66, '#00ffd5'); gg.addColorStop(1, '#ffea00')
      ctx.fillStyle = gg; ctx.globalAlpha = 0.18; ctx.fillRect(0, 0, W, H)
    })
    return
  }

  const MAX = 200
  const particles = []
  const shockwaves = []

  const PRIDE = ['#e40303', '#ff8c00', '#ffed00', '#008026', '#004dff', '#750787']
  const PALETTE = ['#ff1493', '#b026ff', '#00ffd5', '#ffea00', '#ff6ec7', '#7afcff']
  const KINDS = ['sparkle', 'heart', 'rainbow']

  let parade = false
  document.addEventListener('parade-toggle', (e) => {
    parade = !!e.detail
  })

  function add(p) {
    if (particles.length >= MAX) particles.shift()
    particles.push(p)
  }

  function spawnAmbient() {
    if (particles.length >= MAX * 0.6) return
    if (parade) {
      add(makeConfetti(-20, Math.random() * H))
    } else {
      const kind = KINDS[(Math.random() * KINDS.length) | 0]
      add(makeFloater(Math.random() * W, H + 10, kind))
    }
  }

  function makeFloater(x, y, kind) {
    return {
      kind,
      x, y,
      vx: (Math.random() - 0.5) * 0.4,
      vy: -0.4 - Math.random() * 0.9,
      life: 0,
      maxLife: 320 + Math.random() * 280,
      size: 6 + Math.random() * 10,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.05,
      color: PALETTE[(Math.random() * PALETTE.length) | 0],
      hue: Math.random() * 360,
    }
  }

  function makeBurstPart(x, y) {
    const a = Math.random() * Math.PI * 2
    const s = 2 + Math.random() * 6
    return {
      kind: Math.random() < 0.5 ? 'sparkle' : 'heart',
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0,
      maxLife: 60 + Math.random() * 40,
      size: 5 + Math.random() * 9,
      rot: a,
      vr: (Math.random() - 0.5) * 0.2,
      color: PALETTE[(Math.random() * PALETTE.length) | 0],
      hue: Math.random() * 360,
      gravity: 0.08,
    }
  }

  function makeConfetti(x, y) {
    return {
      kind: 'confetti',
      x, y,
      vx: 4 + Math.random() * 5,
      vy: (Math.random() - 0.5) * 1.6,
      life: 0,
      maxLife: 280 + Math.random() * 160,
      size: 5 + Math.random() * 7,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.3,
      color: PRIDE[(Math.random() * PRIDE.length) | 0],
    }
  }

  function burst(x, y, n = 40) {
    for (let i = 0; i < n; i++) add(makeBurstPart(x, y))
  }

  function shockwave(x, y) {
    shockwaves.push({ x, y, r: 0, life: 0, maxLife: 60 })
  }

  // Wire interactions
  document.addEventListener('click', (e) => {
    const tool = e.target.closest && e.target.closest('.tool')
    const pony = e.target.closest && e.target.closest('.pony')
    if (tool) burst(e.clientX, e.clientY, 40)
    if (pony) {
      const r = pony.getBoundingClientRect()
      shockwave(r.left + r.width / 2, r.top + r.height / 2)
    }
  }, true)

  // Drawing helpers
  function drawSparkle(p, alpha) {
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rot)
    ctx.globalAlpha = alpha
    ctx.fillStyle = p.color
    const s = p.size
    ctx.beginPath()
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2
      ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s)
      const a2 = a + Math.PI / 4
      ctx.lineTo(Math.cos(a2) * s * 0.35, Math.sin(a2) * s * 0.35)
    }
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  function drawHeart(p, alpha) {
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rot)
    ctx.scale(p.size / 10, p.size / 10)
    ctx.globalAlpha = alpha
    ctx.fillStyle = p.color
    ctx.beginPath()
    ctx.moveTo(0, 3)
    ctx.bezierCurveTo(0, -2, -8, -2, -8, 3)
    ctx.bezierCurveTo(-8, 8, 0, 12, 0, 14)
    ctx.bezierCurveTo(0, 12, 8, 8, 8, 3)
    ctx.bezierCurveTo(8, -2, 0, -2, 0, 3)
    ctx.fill()
    ctx.restore()
  }

  function drawRainbow(p, alpha) {
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.globalAlpha = alpha * 0.8
    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = PRIDE[i]
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(0, 0, p.size + i * 2, Math.PI, Math.PI * 2)
      ctx.stroke()
    }
    ctx.restore()
  }

  function drawConfetti(p, alpha) {
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rot)
    ctx.globalAlpha = alpha
    ctx.fillStyle = p.color
    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
    ctx.restore()
  }

  let last = performance.now()
  let spawnAcc = 0

  function frame(now) {
    const dt = Math.min(48, now - last)
    last = now

    // Trail clear (slight fade for rainbow trails)
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fillStyle = 'rgba(0,0,0,0.18)'
    ctx.fillRect(0, 0, W, H)
    ctx.globalCompositeOperation = 'source-over'

    // Spawn ambient
    spawnAcc += dt
    const spawnEvery = parade ? 30 : 90
    while (spawnAcc > spawnEvery) {
      spawnAmbient()
      spawnAcc -= spawnEvery
    }

    // Update + draw particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      p.life += dt / 16
      if (p.gravity) p.vy += p.gravity
      p.x += p.vx
      p.y += p.vy
      if (p.vr) p.rot += p.vr
      // friction for bursts
      if (p.gravity) { p.vx *= 0.985; p.vy *= 0.99 }

      const t = p.life / p.maxLife
      if (t >= 1 || p.x < -50 || p.x > W + 50 || p.y < -50 || p.y > H + 50) {
        particles.splice(i, 1)
        continue
      }
      const alpha = 1 - t
      ctx.globalCompositeOperation = 'lighter'
      switch (p.kind) {
        case 'sparkle': drawSparkle(p, alpha); break
        case 'heart': drawHeart(p, alpha); break
        case 'rainbow': drawRainbow(p, alpha); break
        case 'confetti':
          ctx.globalCompositeOperation = 'source-over'
          drawConfetti(p, alpha); break
      }
    }

    // Shockwaves
    ctx.globalCompositeOperation = 'lighter'
    for (let i = shockwaves.length - 1; i >= 0; i--) {
      const s = shockwaves[i]
      s.life += dt / 16
      s.r += 6
      const t = s.life / s.maxLife
      if (t >= 1) { shockwaves.splice(i, 1); continue }
      const alpha = 1 - t
      ctx.save()
      ctx.translate(s.x, s.y)
      for (let k = 0; k < 3; k++) {
        ctx.strokeStyle = PALETTE[k * 2 % PALETTE.length]
        ctx.globalAlpha = alpha * (1 - k * 0.25)
        ctx.lineWidth = 4 - k
        ctx.beginPath()
        ctx.arc(0, 0, s.r + k * 8, 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.restore()
    }

    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
})()
