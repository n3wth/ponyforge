// juice.js — game-mode camera + physics polish for the Dress-to-Match game.
// Pure DOM. Exposed as window.PFG.juice. Caller is responsible for game-mode guards.
// Spec: zoomTo, shakeOnHit, shakeOnLoss, flashPaper, bumpHorse.

(function () {
  'use strict'

  const ZOOM_EASE = 'cubic-bezier(.22,.61,.36,1)'
  const ZOOM_MS = 400
  const FLASH_MS = 120
  const BUMP_MS = 280
  const HIT_AMP = 5      // px (4-6)
  const HIT_MS = 200
  const LOSS_AMP = 10    // px (8-12)
  const LOSS_MS = 320

  const reduce = () =>
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches

  function paddock() { return document.querySelector('.paddock') }

  // Compose zoom + shake into the paddock transform via inline style.
  function applyTransform(el) {
    const sx = el.style.getPropertyValue('--juice-zoom-sx') || '1'
    const tx = el.style.getPropertyValue('--juice-zoom-tx') || '0px'
    const ty = el.style.getPropertyValue('--juice-zoom-ty') || '0px'
    el.style.transform =
      `translate3d(var(--shake-x,0px), var(--shake-y,0px), 0) ` +
      `translate(${tx}, ${ty}) scale(${sx})`
  }

  // ---- zoomTo -------------------------------------------------------------
  function zoomTo(horseEl) {
    const pad = paddock()
    if (!pad) return function () {}
    if (reduce() || !horseEl) return function () {}

    const padRect = pad.getBoundingClientRect()
    const hRect = horseEl.getBoundingClientRect()
    const cxPad = padRect.left + padRect.width / 2
    const cyPad = padRect.top + padRect.height / 2
    const cxH = hRect.left + hRect.width / 2
    const cyH = hRect.top + hRect.height / 2
    // Translate the paddock so the horse moves toward center; clamp gently.
    const dx = Math.max(-40, Math.min(40, (cxPad - cxH) * 0.5))
    const dy = Math.max(-32, Math.min(32, (cyPad - cyH) * 0.5))

    pad.style.transition = `transform ${ZOOM_MS}ms ${ZOOM_EASE}`
    pad.style.setProperty('--juice-zoom-sx', '1.04')
    pad.style.setProperty('--juice-zoom-tx', dx.toFixed(2) + 'px')
    pad.style.setProperty('--juice-zoom-ty', dy.toFixed(2) + 'px')
    applyTransform(pad)

    let restored = false
    return function restore() {
      if (restored) return
      restored = true
      pad.style.transition = `transform ${ZOOM_MS}ms ${ZOOM_EASE}`
      pad.style.setProperty('--juice-zoom-sx', '1')
      pad.style.setProperty('--juice-zoom-tx', '0px')
      pad.style.setProperty('--juice-zoom-ty', '0px')
      applyTransform(pad)
      setTimeout(function () {
        if (pad.style.transition.indexOf('transform') !== -1) pad.style.transition = ''
      }, ZOOM_MS + 30)
    }
  }

  // ---- shake --------------------------------------------------------------
  let shakeUntil = 0
  let shakeAmp = 0
  let shakeDur = HIT_MS
  let shakeRaf = 0

  function runShake(amp, ms) {
    const pad = paddock()
    if (!pad || reduce()) return
    shakeAmp = Math.max(shakeAmp, amp)
    shakeDur = ms
    shakeUntil = performance.now() + ms
    if (shakeRaf) return
    const tick = function () {
      const t = performance.now()
      if (t >= shakeUntil || shakeAmp <= 0.05) {
        pad.style.setProperty('--shake-x', '0px')
        pad.style.setProperty('--shake-y', '0px')
        shakeAmp = 0
        shakeRaf = 0
        return
      }
      const remaining = (shakeUntil - t) / shakeDur
      const a = shakeAmp * remaining
      pad.style.setProperty('--shake-x', ((Math.random() * 2 - 1) * a).toFixed(2) + 'px')
      pad.style.setProperty('--shake-y', ((Math.random() * 2 - 1) * a).toFixed(2) + 'px')
      shakeRaf = requestAnimationFrame(tick)
    }
    shakeRaf = requestAnimationFrame(tick)
  }

  function shakeOnHit() { runShake(HIT_AMP, HIT_MS) }
  function shakeOnLoss() { runShake(LOSS_AMP, LOSS_MS) }

  // ---- flashPaper ---------------------------------------------------------
  // Info-bearing — runs even with reduced-motion.
  function flashPaper() {
    const pad = paddock()
    if (!pad) return
    const cs = getComputedStyle(document.documentElement)
    const paper = (cs.getPropertyValue('--paper') || '#f3efe6').trim()
    const overlay = document.createElement('div')
    overlay.setAttribute('aria-hidden', 'true')
    overlay.style.cssText =
      'position:absolute;inset:0;pointer-events:none;background:' + paper +
      ';opacity:0.55;transition:opacity ' + FLASH_MS + 'ms linear;z-index:9999;'
    const pos = getComputedStyle(pad).position
    if (pos === 'static') pad.style.position = 'relative'
    pad.appendChild(overlay)
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { overlay.style.opacity = '0' })
    })
    setTimeout(function () {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay)
    }, FLASH_MS + 40)
  }

  // ---- bumpHorse ----------------------------------------------------------
  function bumpHorse(horseEl) {
    if (!horseEl || reduce()) return
    const prev = horseEl.style.transition
    const prevTransform = horseEl.style.transform
    horseEl.style.transition = `transform ${BUMP_MS / 2}ms cubic-bezier(.34,1.56,.64,1)`
    horseEl.style.transform = (prevTransform || '') + ' scale(1.06)'
    setTimeout(function () {
      horseEl.style.transition = `transform ${BUMP_MS / 2}ms ${ZOOM_EASE}`
      horseEl.style.transform = prevTransform
    }, BUMP_MS / 2)
    setTimeout(function () {
      horseEl.style.transition = prev
    }, BUMP_MS + 30)
  }

  const PFG = (window.PFG = window.PFG || {})
  PFG.juice = {
    zoomTo: zoomTo,
    shakeOnHit: shakeOnHit,
    shakeOnLoss: shakeOnLoss,
    flashPaper: flashPaper,
    bumpHorse: bumpHorse
  }
})()
