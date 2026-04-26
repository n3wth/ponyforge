// hearts.js — lives state machine for ponyforge.com PLAY mode.
// Pure functions over a small state object plus one HUD hook helper.
// Exposed as window.PFG.hearts. See docs/game/SPEC.md §9 and A11Y.md §2.
;(function () {
  'use strict'

  var MAX_HEARTS = 3

  // create(initial=3) -> { count }
  // Caller owns the returned object. State is a plain bag so other modules
  // (UI, audio) can subscribe without coupling to a class.
  function create(initial) {
    var n = (typeof initial === 'number') ? initial : MAX_HEARTS
    if (n < 0) n = 0
    if (n > MAX_HEARTS) n = MAX_HEARTS
    return { count: n | 0 }
  }

  // lose(state) -> { wasLast: bool }
  // Decrements the heart count by 1, clamped at 0. `wasLast` is true exactly
  // when this call drove the count from 1 to 0 (the 3rd lost heart on a
  // fresh run — the game-over trigger per SPEC §9).
  function lose(state) {
    if (!state || typeof state.count !== 'number') {
      return { wasLast: false }
    }
    if (state.count <= 0) {
      // Already dead. Idempotent — no underflow, never re-fire wasLast.
      state.count = 0
      return { wasLast: false }
    }
    state.count -= 1
    return { wasLast: state.count === 0 }
  }

  // reset(state) -> state
  // Restore to MAX_HEARTS for a new run.
  function reset(state) {
    if (!state) return create(MAX_HEARTS)
    state.count = MAX_HEARTS
    return state
  }

  // onLoss(state, hudInstance) — HUD hook helper.
  // Pushes the new count into the HUD and fires the assertive announcement
  // required by A11Y.md §2 ("Heart lost" -> alerts region, assertive).
  // Safe to call with a partially-wired hudInstance; missing methods are
  // skipped silently so this never breaks the game loop.
  function onLoss(state, hudInstance) {
    if (!state) return
    if (hudInstance && typeof hudInstance.setHearts === 'function') {
      hudInstance.setHearts(state.count)
    }
    // Prefer the HUD's announce if present, otherwise look for a global one.
    // Per A11Y.md the second arg `false` requests assertive politeness.
    var announce = null
    if (hudInstance && typeof hudInstance.announce === 'function') {
      announce = hudInstance.announce.bind(hudInstance)
    } else if (typeof window !== 'undefined' &&
               window.PFG && typeof window.PFG.announce === 'function') {
      announce = window.PFG.announce
    }
    if (announce) {
      try { announce('heart lost', false) } catch (_e) { /* noop */ }
    }
  }

  var api = {
    MAX: MAX_HEARTS,
    create: create,
    lose: lose,
    reset: reset,
    onLoss: onLoss
  }

  if (typeof window !== 'undefined') {
    window.PFG = window.PFG || {}
    window.PFG.hearts = api
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api
  }
})()
