// target-card.js — corner target outfit display for the Dress-to-Match game.
// Pure DOM. No game state. Exposes window.PFG.targetCard.
// Spec: docs/game/UI.md §2 (target card), docs/game/SPEC.md §6 (content).

(function () {
  'use strict'

  const HORSE_NAMES = {
    iris: 'Iris',
    vesper: 'Vesper',
    onyx: 'Onyx',
    prism: 'Prism',
    sable: 'Sable',
    femme: 'Femme'
  }

  // Emoji hat id → short lowercase label (UI.md chip example: "topper", "daisy")
  const HAT_LABELS = {
    '🎩': 'topper',
    '🌼': 'daisy',
    '🧢': 'cap',
    '👑': 'crown',
    '🕶️': 'shades',
    '🪩': 'disco',
    '🏳️‍🌈': 'pride',
    '🏳️‍⚧️': 'trans',
    '💋': 'kiss',
    '🦋': 'fly',
    '✨': 'sparkle',
    '🥀': 'rose'
  }

  let rootEl = null
  // Map<hatGlyph, HTMLElement[]> — chips currently in DOM, for met-toggling
  let chipIndex = new Map()
  let flashTimer = 0

  function el(tag, cls, text) {
    const n = document.createElement(tag)
    if (cls) n.className = cls
    if (text != null) n.textContent = text
    return n
  }

  function formatRound(n) {
    const num = Number.isFinite(n) ? n : 0
    return 'round ' + String(num).padStart(2, '0')
  }

  function horseName(id) {
    return HORSE_NAMES[id] || (id ? String(id) : '')
  }

  function hatLabel(glyph) {
    return HAT_LABELS[glyph] || ''
  }

  function buildChip(hatGlyph) {
    const li = el('li', 'chip')
    li.dataset.hat = hatGlyph
    const emoji = el('span', 'chip__emoji', hatGlyph)
    emoji.setAttribute('aria-hidden', 'true')
    const label = el('span', 'chip__label', hatLabel(hatGlyph))
    li.appendChild(emoji)
    li.appendChild(label)
    return li
  }

  function buildSubCard(entry, roundLabel, includePlate) {
    const section = el('section', 'hud-target')
    section.setAttribute('aria-label', 'target outfit')
    if (includePlate && roundLabel) {
      const plate = el('span', 'hud-target__plate font-mono', roundLabel)
      section.appendChild(plate)
    }
    section.appendChild(el('h2', 'hud-target__name', horseName(entry.horseId)))
    const chips = el('ul', 'hud-target__chips')
    const hats = Array.isArray(entry.hats) ? entry.hats : []
    for (const hat of hats) {
      const chip = buildChip(hat)
      chips.appendChild(chip)
      if (!chipIndex.has(hat)) chipIndex.set(hat, [])
      chipIndex.get(hat).push(chip)
    }
    section.appendChild(chips)
    return section
  }

  function normalizeEntries(payload) {
    if (!payload) return []
    if (Array.isArray(payload.horses)) return payload.horses
    if (Array.isArray(payload)) return payload
    if (payload.horseId) return [{ horseId: payload.horseId, hats: payload.hats }]
    return []
  }

  function api_mount(parentEl) {
    if (!parentEl) return null
    if (rootEl && rootEl.parentNode) rootEl.parentNode.removeChild(rootEl)
    rootEl = el('div', 'hud-target-wrap')
    rootEl.setAttribute('role', 'group')
    rootEl.setAttribute('aria-label', 'target outfits')
    parentEl.appendChild(rootEl)
    return rootEl
  }

  function api_render(payload) {
    if (!rootEl) return
    chipIndex = new Map()
    while (rootEl.firstChild) rootEl.removeChild(rootEl.firstChild)
    const entries = normalizeEntries(payload)
    const roundLabel = formatRound(payload && payload.roundNumber)
    if (entries.length === 0) {
      const empty = el('section', 'hud-target')
      empty.setAttribute('aria-label', 'target outfit')
      empty.appendChild(el('span', 'hud-target__plate font-mono', roundLabel))
      empty.appendChild(el('h2', 'hud-target__name', '—'))
      rootEl.appendChild(empty)
      return
    }
    if (entries.length === 1) {
      rootEl.appendChild(buildSubCard(entries[0], roundLabel, true))
      return
    }
    // Multi-horse: shared plate above stacked sub-cards
    const plate = el('span', 'hud-target__plate hud-target__plate--shared font-mono', roundLabel)
    rootEl.appendChild(plate)
    for (const entry of entries) {
      rootEl.appendChild(buildSubCard(entry, roundLabel, false))
    }
  }

  function setMet(hatGlyph, met) {
    const chips = chipIndex.get(hatGlyph)
    if (!chips) return
    for (const chip of chips) chip.classList.toggle('is-met', !!met)
  }

  function api_markHatMet(hatGlyph) {
    setMet(hatGlyph, true)
  }

  function api_markHatUnmet(hatGlyph) {
    setMet(hatGlyph, false)
  }

  function api_flash() {
    if (!rootEl) return
    rootEl.classList.remove('is-flash')
    // force reflow so the class re-add restarts any CSS animation
    void rootEl.offsetWidth
    rootEl.classList.add('is-flash')
    if (flashTimer) clearTimeout(flashTimer)
    flashTimer = setTimeout(function () {
      if (rootEl) rootEl.classList.remove('is-flash')
      flashTimer = 0
    }, 800)
  }

  function api_unmount() {
    if (flashTimer) {
      clearTimeout(flashTimer)
      flashTimer = 0
    }
    chipIndex = new Map()
    if (rootEl && rootEl.parentNode) rootEl.parentNode.removeChild(rootEl)
    rootEl = null
  }

  const PFG = (window.PFG = window.PFG || {})
  PFG.targetCard = {
    mount: api_mount,
    render: api_render,
    markHatMet: api_markHatMet,
    markHatUnmet: api_markHatUnmet,
    flash: api_flash,
    unmount: api_unmount
  }
})()
