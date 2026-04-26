/**
 * PonyForge combo state machine.
 *
 * Pure state functions plus localStorage helpers for the longest-combo
 * record. Exposed as `window.PFG.combo`. No DOM access, no events.
 *
 * Multiplier tiers follow SPEC.md §8 (the canonical source):
 *   combo 1   -> 1.0x
 *   combo 2   -> 1.25x
 *   combo 3   -> 1.5x
 *   combo 4   -> 1.75x
 *   combo 5+  -> 2.0x (cap)
 *
 * Reset rules:
 *   onMiss -> count = 0 (SPEC.md §8: "Combo resets to 0 on any miss")
 *   onSkip -> count = 1 (SCORING.md skip section, used as fallback when
 *             a skip-equivalent action exists in-game)
 */
;(function (global) {
  'use strict'

  var LS_KEY = 'pf:game.longestCombo'
  var MAX_MULT = 2.0

  function safeStorage() {
    try {
      var s = global.localStorage
      // probe -- some browsers throw on access in private mode
      var k = '__pf_probe__'
      s.setItem(k, '1')
      s.removeItem(k)
      return s
    } catch (_) {
      return null
    }
  }

  function getMultiplier(state) {
    var n = state && state.count ? state.count : 0
    if (n >= 5) return 2.0
    if (n === 4) return 1.75
    if (n === 3) return 1.5
    if (n === 2) return 1.25
    if (n === 1) return 1.0
    return 1.0
  }

  function create() {
    return {
      count: 0,
      multiplier: 1.0,
      longest: getLongest(),
    }
  }

  function onHit(state) {
    if (!state) return state
    state.count = (state.count | 0) + 1
    state.multiplier = getMultiplier(state)
    if (state.count > (state.longest | 0)) {
      state.longest = state.count
      setLongest(state.longest)
    }
    return state
  }

  function onMiss(state) {
    if (!state) return state
    state.count = 0
    state.multiplier = getMultiplier(state)
    return state
  }

  function onSkip(state) {
    if (!state) return state
    state.count = 1
    state.multiplier = getMultiplier(state)
    if (state.count > (state.longest | 0)) {
      state.longest = state.count
      setLongest(state.longest)
    }
    return state
  }

  function getLongest() {
    var s = safeStorage()
    if (!s) return 0
    try {
      var raw = s.getItem(LS_KEY)
      var n = raw == null ? 0 : parseInt(raw, 10)
      return isFinite(n) && n > 0 ? n : 0
    } catch (_) {
      return 0
    }
  }

  function setLongest(n) {
    var v = n | 0
    if (v <= 0) return false
    var prev = getLongest()
    if (v <= prev) return false
    var s = safeStorage()
    if (!s) return false
    try {
      s.setItem(LS_KEY, String(v))
      return true
    } catch (_) {
      return false
    }
  }

  var api = {
    create: create,
    onHit: onHit,
    onMiss: onMiss,
    onSkip: onSkip,
    getMultiplier: getMultiplier,
    getLongest: getLongest,
    setLongest: setLongest,
    MAX_MULT: MAX_MULT,
  }

  var PFG = global.PFG || (global.PFG = {})
  PFG.combo = api

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api
  }
})(typeof window !== 'undefined' ? window : globalThis)
