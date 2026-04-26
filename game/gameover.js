// gameover.js — end-of-run modal for ponyforge.com.
// Builds and mounts the .game-over dialog. Pure DOM, no game state.
// Public API: window.PFG.gameOver = { show, hide }
// Spec: docs/game/UI.md §7 (extended with longestCombo + isHighScore tag).
;(function () {
  'use strict'

  var FOCUSABLE = [
    'button:not([disabled])',
    '[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',')

  var state = {
    root: null,
    parent: null,
    titleEl: null,
    againBtn: null,
    chillBtn: null,
    onAgain: null,
    onChill: null,
    prevFocus: null,
    keyHandler: null
  }

  function prefersReducedMotion() {
    return (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
  }

  function el(tag, className, attrs) {
    var node = document.createElement(tag)
    if (className) node.className = className
    if (attrs) {
      for (var k in attrs) {
        if (k === 'text') node.textContent = attrs[k]
        else node.setAttribute(k, attrs[k])
      }
    }
    return node
  }

  function formatScore(n) {
    n = Math.max(0, Math.floor(Number(n) || 0))
    var s = String(n)
    if (s.length <= 2) return s.padStart(2, '0')
    var withCommas = n.toLocaleString('en-US')
    return withCommas.length < 6 ? '0' + withCommas : withCommas
  }

  function pickStage() {
    if (typeof document === 'undefined') return null
    return (
      document.querySelector('.game-stage') ||
      document.querySelector('.paddock') ||
      document.body
    )
  }

  function buildTree(opts) {
    var round = Math.max(1, Math.floor(Number(opts.round) || 1))
    var longest = Math.max(0, Math.floor(Number(opts.longestCombo) || 0))
    var score = Math.max(0, Math.floor(Number(opts.score) || 0))
    var titleId = 'pfg-go-title-' + Date.now().toString(36)

    var root = el('div', 'game-over', {
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': titleId
    })

    var panel = el('div', 'game-over__panel')

    var plate = el('p', 'game-over__plate font-mono', {
      text:
        'round ' +
        String(round).padStart(2, '0') +
        ' · longest combo ' +
        String(longest)
    })

    var title = el('h1', 'game-over__title', {
      id: titleId,
      text: 'thanks for playing'
    })

    var scoreLine = el('p', 'game-over__score font-mono')
    scoreLine.appendChild(
      document.createTextNode('final score ' + formatScore(score))
    )
    if (opts.isHighScore) {
      scoreLine.appendChild(document.createTextNode(' '))
      var tag = el('span', 'game-over__best-tag font-mono', {
        text: 'best so far'
      })
      scoreLine.appendChild(tag)
    }

    var actions = el('div', 'game-over__actions')
    var again = el('button', 'btn btn--primary', {
      type: 'button',
      'data-action': 'again',
      text: 'again'
    })
    var chill = el('button', 'btn btn--ghost', {
      type: 'button',
      'data-action': 'chill',
      text: 'back to chill'
    })
    actions.appendChild(again)
    actions.appendChild(chill)

    panel.appendChild(plate)
    panel.appendChild(title)
    panel.appendChild(scoreLine)
    panel.appendChild(actions)
    root.appendChild(panel)

    state.titleEl = title
    state.againBtn = again
    state.chillBtn = chill

    again.addEventListener('click', function () {
      var cb = state.onAgain
      hide()
      if (typeof cb === 'function') {
        try { cb() } catch (_e) {}
      }
    })
    chill.addEventListener('click', function () {
      closeViaChill()
    })

    return root
  }

  function closeViaChill() {
    var cb = state.onChill
    hide()
    if (typeof cb === 'function') {
      try { cb() } catch (_e) {}
    }
  }

  function focusables() {
    if (!state.root) return []
    var list = state.root.querySelectorAll(FOCUSABLE)
    return Array.prototype.slice.call(list)
  }

  function trapTab(e) {
    var nodes = focusables()
    if (nodes.length === 0) {
      e.preventDefault()
      return
    }
    var first = nodes[0]
    var last = nodes[nodes.length - 1]
    var active = document.activeElement
    if (e.shiftKey) {
      if (active === first || !state.root.contains(active)) {
        e.preventDefault()
        last.focus()
      }
    } else {
      if (active === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  function onKey(e) {
    if (!state.root) return
    if (e.key === 'Escape' || e.key === 'Esc') {
      e.preventDefault()
      closeViaChill()
      return
    }
    if (e.key === 'Tab') {
      trapTab(e)
    }
  }

  function show(opts) {
    opts = opts || {}
    if (state.root) hide()

    state.onAgain = typeof opts.onAgain === 'function' ? opts.onAgain : null
    state.onChill = typeof opts.onChill === 'function' ? opts.onChill : null
    state.prevFocus =
      document && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null

    var parent = pickStage()
    state.parent = parent
    state.root = buildTree(opts)
    parent.appendChild(state.root)

    state.keyHandler = onKey
    document.addEventListener('keydown', state.keyHandler, true)

    var reduced = prefersReducedMotion()
    if (reduced) {
      state.root.setAttribute('data-open', 'true')
    } else {
      // next frame, flip data-open to trigger CSS opacity transition
      requestAnimationFrame(function () {
        if (state.root) state.root.setAttribute('data-open', 'true')
      })
    }

    // Move focus to primary action.
    var focusTarget = state.againBtn
    if (focusTarget) {
      // Defer one frame so screen readers pick up the dialog first.
      if (reduced) {
        focusTarget.focus()
      } else {
        requestAnimationFrame(function () {
          if (focusTarget && document.body.contains(focusTarget)) {
            focusTarget.focus()
          }
        })
      }
    }

    return state.root
  }

  function hide() {
    if (state.keyHandler) {
      document.removeEventListener('keydown', state.keyHandler, true)
      state.keyHandler = null
    }
    if (state.root && state.root.parentNode) {
      state.root.parentNode.removeChild(state.root)
    }
    var prev = state.prevFocus
    state.root = null
    state.parent = null
    state.titleEl = null
    state.againBtn = null
    state.chillBtn = null
    state.onAgain = null
    state.onChill = null
    state.prevFocus = null
    if (prev && typeof prev.focus === 'function' && document.body.contains(prev)) {
      try { prev.focus() } catch (_e) {}
    }
  }

  var api = { show: show, hide: hide }

  if (typeof window !== 'undefined') {
    window.PFG = window.PFG || {}
    window.PFG.gameOver = api
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api
  }
})()
