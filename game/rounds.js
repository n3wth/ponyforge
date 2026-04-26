// PonyForge Rounds — target generator module
// Canonical spec: docs/game/SPEC.md (§7 difficulty escalation, §6 content)
// Pure module, no DOM. Exposes window.PFG.rounds.
;(function () {
  'use strict'

  var HORSES = ['iris', 'vesper', 'onyx', 'prism', 'sable', 'femme']
  // Canonical hat order from SPEC §6
  var HATS = ['🎩', '🌼', '🧢', '👑', '🕶️', '🪩', '🏳️‍🌈', '🏳️‍⚧️', '💋', '🦋', '✨', '🥀']

  // Mulberry32 seeded PRNG. Returns a function () => float in [0, 1).
  function makeRng(seed) {
    var s = (seed >>> 0) || 1
    return function () {
      s = (s + 0x6d2b79f5) >>> 0
      var t = s
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  // Hash a roundNumber+seed into a 32-bit int for deterministic per-round streams.
  function roundSeed(roundNumber, seed) {
    var s = (seed === undefined || seed === null) ? 0x9e3779b9 : (seed >>> 0)
    var r = (roundNumber | 0) + 1
    var x = (s ^ Math.imul(r, 0x85ebca6b)) >>> 0
    x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0
    return (x ^ (x >>> 16)) >>> 0
  }

  function pickN(rng, pool, n) {
    var copy = pool.slice()
    var out = []
    for (var i = 0; i < n && copy.length > 0; i++) {
      var idx = Math.floor(rng() * copy.length)
      out.push(copy.splice(idx, 1)[0])
    }
    return out
  }

  // Per-tier shape: { horses: int, hatsPerHorse: int | (rng) => int[] }
  function tierFor(roundNumber) {
    var r = roundNumber | 0
    if (r <= 5)  return { horses: 1, perHorse: function () { return [1] } }
    if (r <= 10) return { horses: 1, perHorse: function () { return [2] } }
    if (r <= 15) return { horses: 1, perHorse: function () { return [3] } }
    if (r <= 20) return { horses: 2, perHorse: function () { return [1, 1] } }
    if (r <= 25) return { horses: 2, perHorse: function () { return [2, 2] } }
    if (r <= 30) return {
      horses: 3,
      perHorse: function (rng) {
        return [1, 2].map(function () { return 0 }).concat([0]).map(function () {
          return 1 + Math.floor(rng() * 2) // 1 or 2
        })
      }
    }
    return {
      horses: 3,
      perHorse: function (rng) {
        return [0, 0, 0].map(function () {
          return 1 + Math.floor(rng() * 3) // 1, 2, or 3
        })
      }
    }
  }

  // Canonical-form key for "same target as previous" check.
  function targetKey(spec) {
    var arr = Array.isArray(spec) ? spec : [spec]
    return arr.slice()
      .map(function (s) {
        var hs = s.hats.slice().sort()
        return s.horseId + ':' + hs.join('|')
      })
      .sort()
      .join('//')
  }

  function buildRound(roundNumber, seed) {
    var rng = makeRng(roundSeed(roundNumber, seed))
    var tier = tierFor(roundNumber)
    var horseIds = pickN(rng, HORSES, tier.horses)
    var counts = tier.perHorse(rng)

    // Hats are unique across the whole target (SPEC §7: no hat appears twice).
    var hatPool = HATS.slice()
    var entries = horseIds.map(function (h, i) {
      var n = Math.min(counts[i] | 0, 3, hatPool.length)
      // Avoid degenerate: don't pick the same hat twice on one horse.
      // pickN draws without replacement so this is implicit.
      var hats = pickN(rng, hatPool, n)
      // Remove drawn hats from the pool so other horses don't reuse them.
      hats.forEach(function (h) {
        var idx = hatPool.indexOf(h)
        if (idx >= 0) hatPool.splice(idx, 1)
      })
      return { horseId: h, hats: hats, orderMatters: false }
    })

    return entries.length === 1 ? entries[0] : entries
  }

  // Cache the previous round target so we can reroll on exact repeats.
  var lastKey = null

  function generateRound(roundNumber, seed) {
    var n = roundNumber | 0
    if (n < 1) n = 1
    var attempt = 0
    var spec
    var key
    // Try a handful of reseeds with a perturbation; fall back to whatever we got.
    do {
      var perturb = (seed === undefined || seed === null)
        ? (Math.floor(Math.random() * 0xffffffff) ^ attempt)
        : ((seed >>> 0) ^ Math.imul(attempt + 1, 0x9e3779b1))
      spec = buildRound(n, perturb)
      key = targetKey(spec)
      attempt++
    } while (key === lastKey && attempt < 8)
    lastKey = key
    return spec
  }

  var api = {
    generateRound: generateRound,
    HORSES: HORSES.slice(),
    HATS: HATS.slice(),
    // Test hooks (still pure helpers).
    _makeRng: makeRng,
    _tierFor: tierFor,
    _resetMemory: function () { lastKey = null }
  }

  if (typeof window !== 'undefined') {
    window.PFG = window.PFG || {}
    window.PFG.rounds = api
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api
  }
})()
