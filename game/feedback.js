/**
 * PonyForge feedback animations.
 *
 * Pure DOM rendering for hit/miss visual feedback. No game logic, no state.
 * Exposed as `window.PFG.feedback`. Honors prefers-reduced-motion.
 *
 * API:
 *   scoreFloat(amount, fromEl)        +SCORE bursts up from a horse element
 *   comboFlash(tier)                  mid-screen tier-up flash overlay
 *   correctMatchCelebration(horseEl)  small SVG sparkle on the horse
 *   wrongShake(horseEl)               220ms horizontal shake
 *   roundClearFlash()                 quick paper-flash overlay on paddock
 */
;(function (global) {
  'use strict'

  var doc = global.document
  var SVG_NS = 'http://www.w3.org/2000/svg'

  function reduced() {
    try {
      return global.matchMedia &&
        global.matchMedia('(prefers-reduced-motion: reduce)').matches
    } catch (_) {
      return false
    }
  }

  function rectCenter(el) {
    if (!el || !el.getBoundingClientRect) return { x: 0, y: 0 }
    var r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }

  function paddock() {
    return doc.querySelector('.paddock') || doc.querySelector('.game-stage') || doc.body
  }

  // --- scoreFloat ----------------------------------------------------------
  function scoreFloat(amount, fromEl) {
    if (!doc || amount == null) return function () {}
    var big = Math.abs(amount) >= 500
    var el = doc.createElement('div')
    el.className = 'pf-score-float font-mono' + (big ? ' is-big' : '')
    el.setAttribute('aria-hidden', 'true')
    el.textContent = (amount >= 0 ? '+' : '') + amount
    var c = rectCenter(fromEl)
    el.style.position = 'fixed'
    el.style.left = c.x + 'px'
    el.style.top = c.y + 'px'
    el.style.transform = 'translate(-50%, -50%)'
    el.style.color = 'var(--oxblood)'
    el.style.fontFamily = "var(--font-mono), 'JetBrains Mono', ui-monospace, monospace"
    el.style.fontWeight = big ? '700' : '600'
    el.style.fontSize = big ? '28px' : '20px'
    el.style.letterSpacing = '0.04em'
    el.style.pointerEvents = 'none'
    el.style.zIndex = '40'
    el.style.willChange = 'transform, opacity'
    doc.body.appendChild(el)

    var dur = big ? 1000 : 700
    var dist = big ? 84 : 60

    if (reduced()) {
      el.style.opacity = '1'
      var t = setTimeout(function () { remove() }, 600)
      function remove() { clearTimeout(t); if (el.parentNode) el.parentNode.removeChild(el) }
      return remove
    }

    if (typeof el.animate === 'function') {
      var anim = el.animate(
        [
          { transform: 'translate(-50%, -50%) translateY(0)', opacity: 1 },
          { transform: 'translate(-50%, -50%) translateY(-' + dist + 'px)', opacity: 0 }
        ],
        { duration: dur, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' }
      )
      anim.onfinish = function () { if (el.parentNode) el.parentNode.removeChild(el) }
      return function () { try { anim.cancel() } catch (_) {} if (el.parentNode) el.parentNode.removeChild(el) }
    }

    // fallback: transition
    el.style.transition = 'transform ' + dur + 'ms cubic-bezier(0.22,1,0.36,1), opacity ' + dur + 'ms ease-out'
    requestAnimationFrame(function () {
      el.style.transform = 'translate(-50%, -50%) translateY(-' + dist + 'px)'
      el.style.opacity = '0'
    })
    var to = setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el) }, dur + 40)
    return function () { clearTimeout(to); if (el.parentNode) el.parentNode.removeChild(el) }
  }

  // --- comboFlash ----------------------------------------------------------
  function comboFlash(tier) {
    if (!doc) return function () {}
    var label = typeof tier === 'string' ? tier : ('×' + (tier | 0))
    var el = doc.createElement('div')
    el.className = 'pf-combo-flash font-mono'
    el.setAttribute('aria-hidden', 'true')
    el.textContent = label
    el.style.position = 'fixed'
    el.style.left = '50%'
    el.style.top = '38%'
    el.style.transform = 'translate(-50%, -50%) scale(0.6)'
    el.style.padding = '14px 24px'
    el.style.background = 'var(--oxblood)'
    el.style.color = 'var(--paper)'
    el.style.borderRadius = '999px'
    el.style.fontFamily = "var(--font-mono), 'JetBrains Mono', ui-monospace, monospace"
    el.style.fontWeight = '700'
    el.style.fontSize = '44px'
    el.style.letterSpacing = '0.04em'
    el.style.pointerEvents = 'none'
    el.style.zIndex = '50'
    el.style.opacity = '0'
    el.style.willChange = 'transform, opacity'
    doc.body.appendChild(el)

    function cleanup() { if (el.parentNode) el.parentNode.removeChild(el) }

    if (reduced()) {
      el.style.opacity = '1'
      el.style.transform = 'translate(-50%, -50%) scale(1)'
      var t = setTimeout(cleanup, 500)
      return function () { clearTimeout(t); cleanup() }
    }

    if (typeof el.animate === 'function') {
      var anim = el.animate(
        [
          { transform: 'translate(-50%, -50%) scale(0.6)', opacity: 0, offset: 0 },
          { transform: 'translate(-50%, -50%) scale(1.05)', opacity: 1, offset: 0.31 },
          { transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: 0.5 },
          { transform: 'translate(-50%, -50%) scale(1)', opacity: 0, offset: 1 }
        ],
        { duration: 580, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' }
      )
      anim.onfinish = cleanup
      return function () { try { anim.cancel() } catch (_) {} cleanup() }
    }

    el.style.transition = 'transform 180ms cubic-bezier(0.22,1,0.36,1), opacity 180ms ease-out'
    requestAnimationFrame(function () {
      el.style.opacity = '1'
      el.style.transform = 'translate(-50%, -50%) scale(1)'
    })
    var fadeT = setTimeout(function () {
      el.style.transition = 'opacity 400ms ease-out'
      el.style.opacity = '0'
    }, 180)
    var endT = setTimeout(cleanup, 600)
    return function () { clearTimeout(fadeT); clearTimeout(endT); cleanup() }
  }

  // --- correctMatchCelebration --------------------------------------------
  function correctMatchCelebration(horseEl) {
    if (!doc || !horseEl) return function () {}
    var c = rectCenter(horseEl)
    var svg = doc.createElementNS(SVG_NS, 'svg')
    svg.setAttribute('class', 'pf-sparkle')
    svg.setAttribute('aria-hidden', 'true')
    svg.setAttribute('viewBox', '-30 -30 60 60')
    svg.setAttribute('width', '80')
    svg.setAttribute('height', '80')
    svg.style.position = 'fixed'
    svg.style.left = c.x + 'px'
    svg.style.top = c.y + 'px'
    svg.style.transform = 'translate(-50%, -50%)'
    svg.style.pointerEvents = 'none'
    svg.style.zIndex = '35'
    svg.style.overflow = 'visible'

    var strokes = []
    var n = 5
    for (var i = 0; i < n; i++) {
      var line = doc.createElementNS(SVG_NS, 'line')
      var ang = (i / n) * Math.PI * 2 - Math.PI / 2
      var x1 = Math.cos(ang) * 8
      var y1 = Math.sin(ang) * 8
      var x2 = Math.cos(ang) * 22
      var y2 = Math.sin(ang) * 22
      line.setAttribute('x1', x1.toFixed(2))
      line.setAttribute('y1', y1.toFixed(2))
      line.setAttribute('x2', x2.toFixed(2))
      line.setAttribute('y2', y2.toFixed(2))
      line.setAttribute('stroke', 'var(--oxblood)')
      line.setAttribute('stroke-width', '1.6')
      line.setAttribute('stroke-linecap', 'round')
      svg.appendChild(line)
      strokes.push({ el: line, x1: x1, y1: y1, x2: x2, y2: y2 })
    }
    doc.body.appendChild(svg)

    function cleanup() { if (svg.parentNode) svg.parentNode.removeChild(svg) }

    if (reduced()) {
      var t = setTimeout(cleanup, 400)
      return function () { clearTimeout(t); cleanup() }
    }

    if (typeof svg.animate === 'function') {
      strokes.forEach(function (s) {
        s.el.animate(
          [
            { transform: 'scale(0.2)', opacity: 0, offset: 0 },
            { transform: 'scale(1)', opacity: 1, offset: 0.4 },
            { transform: 'scale(1.1)', opacity: 0, offset: 1 }
          ],
          { duration: 600, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' }
        )
      })
      var done = setTimeout(cleanup, 640)
      return function () { clearTimeout(done); cleanup() }
    }

    var endT = setTimeout(cleanup, 640)
    return function () { clearTimeout(endT); cleanup() }
  }

  // --- wrongShake ----------------------------------------------------------
  function wrongShake(horseEl) {
    if (!doc || !horseEl) return function () {}
    if (reduced()) return function () {}

    if (typeof horseEl.animate === 'function') {
      var anim = horseEl.animate(
        [
          { transform: 'translateX(0)' },
          { transform: 'translateX(-6px)' },
          { transform: 'translateX(5px)' },
          { transform: 'translateX(-4px)' },
          { transform: 'translateX(3px)' },
          { transform: 'translateX(-2px)' },
          { transform: 'translateX(0)' }
        ],
        { duration: 220, easing: 'linear' }
      )
      return function () { try { anim.cancel() } catch (_) {} }
    }

    // CSS class fallback — caller's stylesheet should define .pf-shake keyframes.
    horseEl.classList.add('pf-shake')
    var t = setTimeout(function () { horseEl.classList.remove('pf-shake') }, 240)
    return function () { clearTimeout(t); horseEl.classList.remove('pf-shake') }
  }

  // --- roundClearFlash -----------------------------------------------------
  function roundClearFlash() {
    if (!doc) return function () {}
    var host = paddock()
    var el = doc.createElement('div')
    el.className = 'pf-round-flash'
    el.setAttribute('aria-hidden', 'true')
    el.style.position = 'absolute'
    el.style.inset = '0'
    el.style.background = 'var(--paper)'
    el.style.opacity = '0'
    el.style.pointerEvents = 'none'
    el.style.zIndex = '15'
    // ensure host is a containing block
    var prevPos = host.style.position
    if (!prevPos && getComputedStyle(host).position === 'static') {
      host.style.position = 'relative'
    }
    host.appendChild(el)

    function cleanup() {
      if (el.parentNode) el.parentNode.removeChild(el)
    }

    if (reduced()) {
      el.style.opacity = '0.5'
      var t = setTimeout(cleanup, 200)
      return function () { clearTimeout(t); cleanup() }
    }

    if (typeof el.animate === 'function') {
      var anim = el.animate(
        [
          { opacity: 0 },
          { opacity: 0.7, offset: 0.3 },
          { opacity: 0 }
        ],
        { duration: 240, easing: 'ease-out', fill: 'forwards' }
      )
      anim.onfinish = cleanup
      return function () { try { anim.cancel() } catch (_) {} cleanup() }
    }

    el.style.transition = 'opacity 120ms ease-out'
    requestAnimationFrame(function () { el.style.opacity = '0.7' })
    var fadeT = setTimeout(function () { el.style.opacity = '0' }, 120)
    var endT = setTimeout(cleanup, 260)
    return function () { clearTimeout(fadeT); clearTimeout(endT); cleanup() }
  }

  var api = {
    scoreFloat: scoreFloat,
    comboFlash: comboFlash,
    correctMatchCelebration: correctMatchCelebration,
    wrongShake: wrongShake,
    roundClearFlash: roundClearFlash,
  }

  var PFG = global.PFG || (global.PFG = {})
  PFG.feedback = api

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api
  }
})(typeof window !== 'undefined' ? window : globalThis)
