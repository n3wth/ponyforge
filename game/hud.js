// HUD module for ponyforge.com
// Pure DOM rendering. No game state, no validation.
// Public API: window.PFG.hud
// Spec: docs/game/UI.md (canonical) + SPEC.md
;(function () {
  'use strict'

  const NS = 'http://www.w3.org/2000/svg'
  const HEARTS_MAX = 3
  const SCORE_ROLL_MS = 400
  const SHOE_DROP_MS = 360

  function prefersReducedMotion() {
    return (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
  }

  function el(tag, className, attrs) {
    const node = document.createElement(tag)
    if (className) node.className = className
    if (attrs) {
      for (const k in attrs) {
        if (k === 'text') node.textContent = attrs[k]
        else if (k === 'html') node.innerHTML = attrs[k]
        else node.setAttribute(k, attrs[k])
      }
    }
    return node
  }

  function svgEl(tag, attrs) {
    const node = document.createElementNS(NS, tag)
    if (attrs) for (const k in attrs) node.setAttribute(k, attrs[k])
    return node
  }

  function horseshoeSvg() {
    const svg = svgEl('svg', {
      class: 'shoe__svg',
      viewBox: '0 0 20 20',
      'aria-hidden': 'true'
    })
    const path = svgEl('path', {
      d: 'M5 3 C5 9 5 13 7 16 L13 16 C15 13 15 9 15 3 L13 3 L13 12 C13 13 12 14 11 14 L9 14 C8 14 7 13 7 12 L7 3 Z',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '1.4'
    })
    const c1 = svgEl('circle', { cx: '6.4', cy: '4.5', r: '0.7', fill: 'currentColor' })
    const c2 = svgEl('circle', { cx: '13.6', cy: '4.5', r: '0.7', fill: 'currentColor' })
    svg.appendChild(path)
    svg.appendChild(c1)
    svg.appendChild(c2)
    return svg
  }

  function formatScore(n) {
    n = Math.max(0, Math.floor(n || 0))
    const s = String(n)
    if (s.length <= 2) return s.padStart(2, '0')
    // group thousands with comma, pad with leading zero pair like 01,240
    const withCommas = n.toLocaleString('en-US')
    return withCommas.length < 6 ? '0' + withCommas : withCommas
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3)
  }

  // ----- HUD instance state -----
  const state = {
    root: null,
    parent: null,
    nodes: {},
    score: { current: 0, displayed: 0, raf: null, startTs: 0, startVal: 0, target: 0 },
    combo: 0,
    hearts: HEARTS_MAX,
    round: 1,
    best: 0,
    timerSec: 30,
    timerTotal: 30,
    mode: 'play',
    callbacks: { mode: [], again: [] },
    lastAnnounceMs: 0
  }

  function buildTree() {
    const root = el('div', 'hud-root')
    root.setAttribute('data-mode', 'play')

    // Timer bar
    const timer = el('div', 'hud-timer', {
      role: 'timer',
      'aria-label': 'round time remaining',
      'aria-valuenow': '30'
    })
    const timerFill = el('div', 'hud-timer__fill')
    timerFill.style.setProperty('--t', '1')
    timer.appendChild(timerFill)

    // Score island (top-left)
    const score = el('div', 'hud-score', { 'aria-live': 'polite' })
    const scoreNum = el('div', 'hud-score__num font-mono', { text: '00' })
    const scoreMeta = el('div', 'hud-score__meta font-mono')
    const roundEl = el('span', 'hud-score__round', { text: 'round 01' })
    const sep = el('span', 'hud-score__sep', { text: '·' })
    const bestEl = el('span', 'hud-score__best', { text: 'best 0' })
    scoreMeta.appendChild(roundEl)
    scoreMeta.appendChild(sep)
    scoreMeta.appendChild(bestEl)
    const combo = el('div', 'hud-combo font-mono', {
      'data-active': 'false',
      'aria-hidden': 'true',
      text: '×2'
    })
    score.appendChild(scoreNum)
    score.appendChild(scoreMeta)
    score.appendChild(combo)

    // Hearts (top-right)
    const hearts = el('ul', 'hud-hearts', { 'aria-label': 'lives remaining' })
    const shoeNodes = []
    for (let i = 0; i < HEARTS_MAX; i++) {
      const li = el('li', 'shoe is-on')
      li.setAttribute('aria-hidden', 'true')
      li.appendChild(horseshoeSvg())
      hearts.appendChild(li)
      shoeNodes.push(li)
    }

    // Round plate (compact, near score). UI.md folds round into score meta.
    // We expose a setter that updates round/best in the score meta.

    // Mode toggle (bottom-right)
    const mode = el('button', 'hud-mode', {
      type: 'button',
      'data-mode': 'play',
      'aria-pressed': 'true',
      'aria-label': 'toggle play mode'
    })
    const modeDot = el('span', 'hud-mode__dot', { 'aria-hidden': 'true' })
    const modeLabel = el('span', 'hud-mode__label', { text: 'play' })
    mode.appendChild(modeDot)
    mode.appendChild(modeLabel)
    mode.addEventListener('click', onModeClick)

    // ARIA live regions (off-screen)
    const livePolite = el('div', 'hud-sr-only', {
      'aria-live': 'polite',
      'aria-atomic': 'true'
    })
    const liveAssertive = el('div', 'hud-sr-only', {
      'aria-live': 'assertive',
      'aria-atomic': 'true'
    })
    // visually hide
    ;[livePolite, liveAssertive].forEach((n) => {
      n.style.position = 'absolute'
      n.style.width = '1px'
      n.style.height = '1px'
      n.style.overflow = 'hidden'
      n.style.clip = 'rect(0 0 0 0)'
      n.style.whiteSpace = 'nowrap'
    })

    root.appendChild(timer)
    root.appendChild(score)
    root.appendChild(hearts)
    root.appendChild(mode)
    root.appendChild(livePolite)
    root.appendChild(liveAssertive)

    state.nodes = {
      root,
      timer,
      timerFill,
      score,
      scoreNum,
      roundEl,
      bestEl,
      combo,
      hearts,
      shoes: shoeNodes,
      mode,
      modeLabel,
      livePolite,
      liveAssertive
    }
    return root
  }

  function onModeClick() {
    const next = state.mode === 'play' ? 'chill' : 'play'
    setMode(next)
    state.callbacks.mode.forEach(function (cb) {
      try {
        cb(next)
      } catch (_) {}
    })
  }

  // ----- Public methods -----

  function mount(parentEl) {
    if (state.root) unmount()
    if (!parentEl) parentEl = document.body
    state.parent = parentEl
    state.root = buildTree()
    parentEl.appendChild(state.root)
    return state.root
  }

  function unmount() {
    if (state.score.raf) {
      cancelAnimationFrame(state.score.raf)
      state.score.raf = null
    }
    if (state.root && state.root.parentNode) {
      state.root.parentNode.removeChild(state.root)
    }
    state.root = null
    state.nodes = {}
  }

  function setScore(n) {
    n = Math.max(0, Math.floor(n || 0))
    state.score.current = n
    if (!state.nodes.scoreNum) return

    if (prefersReducedMotion()) {
      state.score.displayed = n
      state.nodes.scoreNum.textContent = formatScore(n)
      return
    }

    // Retargetable rolling counter: keep current displayed, retarget end.
    state.score.startVal = state.score.displayed
    state.score.target = n
    state.score.startTs = performance.now()

    if (state.score.raf == null) {
      const tick = function (now) {
        const elapsed = now - state.score.startTs
        const t = Math.min(1, elapsed / SCORE_ROLL_MS)
        const eased = easeOutCubic(t)
        const v = Math.round(
          state.score.startVal + (state.score.target - state.score.startVal) * eased
        )
        state.score.displayed = v
        if (state.nodes.scoreNum) {
          state.nodes.scoreNum.textContent = formatScore(v)
        }
        if (t < 1) {
          state.score.raf = requestAnimationFrame(tick)
        } else {
          state.score.raf = null
          state.score.displayed = state.score.target
          if (state.nodes.scoreNum) {
            state.nodes.scoreNum.textContent = formatScore(state.score.target)
          }
        }
      }
      state.score.raf = requestAnimationFrame(tick)
    }

    // tick flourish
    if (state.nodes.scoreNum) {
      const node = state.nodes.scoreNum
      node.classList.remove('is-tick')
      // force reflow to restart animation
      void node.offsetWidth
      node.classList.add('is-tick')
      setTimeout(function () {
        if (node) node.classList.remove('is-tick')
      }, 200)
    }
  }

  function setCombo(n) {
    n = Math.max(0, Math.floor(n || 0))
    const prev = state.combo
    state.combo = n
    const combo = state.nodes.combo
    if (!combo) return
    if (n < 2) {
      combo.setAttribute('data-active', 'false')
      combo.setAttribute('aria-hidden', 'true')
      return
    }
    combo.textContent = '×' + n
    combo.setAttribute('data-active', 'true')
    combo.setAttribute('aria-hidden', 'true')
    // flash on tier-up
    if (n > prev) {
      combo.classList.remove('is-flash')
      void combo.offsetWidth
      combo.classList.add('is-flash')
      setTimeout(function () {
        if (combo) combo.classList.remove('is-flash')
      }, 320)
    }
  }

  function setHearts(n) {
    n = Math.max(0, Math.min(HEARTS_MAX, Math.floor(n)))
    const prev = state.hearts
    state.hearts = n
    const shoes = state.nodes.shoes || []
    for (let i = 0; i < shoes.length; i++) {
      const shoe = shoes[i]
      const shouldBeOn = i < n
      const wasOn = shoe.classList.contains('is-on')
      if (shouldBeOn) {
        shoe.classList.remove('is-off', 'is-losing')
        shoe.classList.add('is-on')
      } else {
        // newly lost?
        if (wasOn && i >= n && prev > n) {
          shoe.classList.remove('is-on')
          shoe.classList.add('is-losing')
          ;(function (s) {
            setTimeout(function () {
              if (!s) return
              s.classList.remove('is-losing')
              s.classList.add('is-off')
            }, SHOE_DROP_MS)
          })(shoe)
        } else {
          shoe.classList.remove('is-on', 'is-losing')
          shoe.classList.add('is-off')
        }
      }
    }
    if (prev > n) {
      const remaining = n
      announce(remaining + (remaining === 1 ? ' life remaining' : ' lives remaining'), true)
    }
  }

  function setRound(n, best) {
    n = Math.max(1, Math.floor(n || 1))
    state.round = n
    if (typeof best === 'number') state.best = Math.max(0, Math.floor(best))
    if (state.nodes.roundEl) {
      state.nodes.roundEl.textContent = 'round ' + String(n).padStart(2, '0')
    }
    if (state.nodes.bestEl) {
      state.nodes.bestEl.textContent = 'best ' + state.best
    }
  }

  function setTimer(secondsLeft, totalSeconds) {
    if (typeof totalSeconds === 'number' && totalSeconds > 0) {
      state.timerTotal = totalSeconds
    }
    secondsLeft = Math.max(0, Number(secondsLeft) || 0)
    state.timerSec = secondsLeft
    const timer = state.nodes.timer
    const fill = state.nodes.timerFill
    if (!timer || !fill) return
    const ratio = state.timerTotal > 0 ? secondsLeft / state.timerTotal : 0
    fill.style.setProperty('--t', String(Math.max(0, Math.min(1, ratio))))
    if (secondsLeft <= 5 && secondsLeft > 0) {
      timer.classList.add('is-critical')
    } else {
      timer.classList.remove('is-critical')
    }
    // Throttle aria updates to ~1Hz
    const now = performance.now()
    if (now - state.lastAnnounceMs > 1000) {
      state.lastAnnounceMs = now
      timer.setAttribute('aria-valuenow', String(Math.ceil(secondsLeft)))
    }
  }

  function setMode(mode) {
    if (mode !== 'play' && mode !== 'chill') return
    state.mode = mode
    const root = state.nodes.root
    const btn = state.nodes.mode
    const label = state.nodes.modeLabel
    if (root) root.setAttribute('data-mode', mode)
    if (btn) {
      btn.setAttribute('data-mode', mode)
      btn.setAttribute('aria-pressed', mode === 'play' ? 'true' : 'false')
    }
    if (label) label.textContent = mode
  }

  function onModeToggle(cb) {
    if (typeof cb === 'function') state.callbacks.mode.push(cb)
  }

  function onAgainClick(cb) {
    if (typeof cb === 'function') state.callbacks.again.push(cb)
    // wire to game-over button if it exists in DOM (rendered by overlay module)
    document.addEventListener('click', function (e) {
      const target = e.target
      if (target && target.closest && target.closest('[data-action="again"]')) {
        state.callbacks.again.forEach(function (fn) {
          try {
            fn()
          } catch (_) {}
        })
      }
    })
  }

  function announce(text, polite) {
    if (polite === undefined) polite = true
    const node = polite ? state.nodes.livePolite : state.nodes.liveAssertive
    if (!node) return
    // toggle to retrigger SR
    node.textContent = ''
    setTimeout(function () {
      if (node) node.textContent = String(text || '')
    }, 30)
  }

  // ----- Expose -----
  const api = {
    mount: mount,
    unmount: unmount,
    setScore: setScore,
    setCombo: setCombo,
    setHearts: setHearts,
    setRound: setRound,
    setTimer: setTimer,
    setMode: setMode,
    onModeToggle: onModeToggle,
    onAgainClick: onAgainClick,
    announce: announce
  }

  if (typeof window !== 'undefined') {
    window.PFG = window.PFG || {}
    window.PFG.hud = api
  }
})()
