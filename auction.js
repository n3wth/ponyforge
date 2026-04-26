// Pony Auction — five buyers, dress, price, judged.
// Reads existing PFG.sandbox bridge (getBoard/getHorseEl/clearAllHats/audio).

;(function () {
  'use strict'

  // ---------- TAGS ----------
  // Each hat carries an aesthetic. Each pony has innate qualities.
  // Buyer prompts request a small set of tags. Match = good outfit.
  const HAT_TAGS = {
    '🎩': ['formal', 'elegant', 'old'],
    '🌼': ['playful', 'soft', 'domestic'],
    '🧢': ['casual', 'plain', 'modern'],
    '👑': ['formal', 'loud', 'old'],
    '🕶️': ['cool', 'modern', 'quiet'],
    '🪩': ['loud', 'wild', 'modern'],
    '🏳️‍🌈': ['queer', 'loud', 'modern'],
    '🏳️‍⚧️': ['queer', 'soft', 'modern'],
    '💋': ['loud', 'femme', 'modern'],
    '🦋': ['soft', 'wild', 'old'],
    '✨': ['playful', 'soft', 'modern'],
    '🥀': ['quiet', 'old', 'femme'],
  }

  const PONY_TAGS = {
    iris:   ['queer', 'soft', 'modern'],
    vesper: ['femme', 'old', 'quiet'],
    onyx:   ['cool', 'wild', 'modern'],
    prism:  ['playful', 'loud', 'modern'],
    sable:  ['soft', 'queer', 'old'],
    femme:  ['femme', 'loud', 'old'],
  }

  // ---------- BUYERS ----------
  // wanted: 2-3 tags. avoid: 0-2 tags (penalty if present). budget: max coins.
  const BUYERS = [
    { line: 'a quiet one, going to sea',                  wanted: ['quiet', 'soft', 'old'],     avoid: ['loud'],           budget: 200, name: 'lighthouse keeper' },
    { line: 'for a wedding, but make it strange',         wanted: ['formal', 'queer', 'femme'], avoid: ['plain'],          budget: 400, name: 'left-handed bride' },
    { line: 'sunday brunch, hates being looked at',       wanted: ['quiet', 'soft', 'modern'],  avoid: ['loud', 'formal'], budget: 150, name: 'aunt who left' },
    { line: 'a stage horse — the loudest you have',       wanted: ['loud', 'wild', 'playful'],  avoid: ['quiet', 'plain'], budget: 300, name: 'cabaret booker' },
    { line: 'gentle countryside girl',                    wanted: ['soft', 'domestic', 'old'],  avoid: ['cool', 'modern'], budget: 220, name: 'bed-and-breakfast' },
    { line: 'birthday gift for a teenager who hates me',  wanted: ['cool', 'modern', 'queer'],  avoid: ['old', 'formal'],  budget: 180, name: 'tired father' },
    { line: 'old money, country house, never speaks',     wanted: ['formal', 'old', 'elegant'], avoid: ['playful'],        budget: 500, name: 'estate solicitor' },
    { line: 'a femme so devastating it ruins my life',    wanted: ['femme', 'loud', 'wild'],    avoid: ['plain'],          budget: 350, name: 'someone\'s ex' },
    { line: 'a horse for a small queer wedding upstate',  wanted: ['queer', 'soft', 'formal'],  avoid: ['loud'],           budget: 280, name: 'the officiant' },
    { line: 'i want to look at something playful',        wanted: ['playful', 'soft'],          avoid: ['formal'],         budget: 130, name: 'a child' },
  ]

  // ---------- STATE ----------
  let active = false
  let buyerIdx = 0
  let order = []
  let total = 0
  let timerHandle = 0
  let timerStart = 0
  const ROUND_SECONDS = 30
  const HIGH_KEY = 'pf:auction.best'

  // ---------- DOM ----------
  let root, prompt, timerBar, priceSlider, priceLabel, submitBtn, resultEl, scoreEl, picker
  let activeHorseId = null

  function getBest() { try { return Number(localStorage.getItem(HIGH_KEY) || 0) || 0 } catch (_) { return 0 } }
  function saveBest(n) { try { localStorage.setItem(HIGH_KEY, String(n | 0)) } catch (_) {} }

  function audio() { return (window.PFG && window.PFG.sandbox && window.PFG.sandbox.audio) || {} }
  function sandbox() { return (window.PFG && window.PFG.sandbox) || {} }

  function buildUI() {
    root = document.createElement('div')
    root.className = 'auc'
    root.setAttribute('aria-hidden', 'true')
    root.innerHTML = `
      <button class="auc-start" id="aucStart" type="button">play · pony auction</button>

      <div class="auc-stage" id="aucStage" aria-hidden="true">
        <div class="auc-top">
          <div class="auc-meta">
            <span class="auc-buyer" id="aucBuyer">— · —</span>
            <span class="auc-count" id="aucCount">buyer 1 / 5</span>
          </div>
          <div class="auc-prompt" id="aucPrompt">—</div>
          <div class="auc-timer"><div class="auc-timer__fill" id="aucTimerFill"></div></div>
        </div>

        <div class="auc-bottom">
          <div class="auc-pick" id="aucPick">
            <span class="auc-pick__label">pick a pony</span>
            <span class="auc-pick__active" id="aucPickActive">—</span>
            <span class="auc-pick__hint">click a horse, then dress with the ring</span>
          </div>
          <div class="auc-price">
            <label for="aucPrice" class="auc-price__label">price <span id="aucPriceVal">200</span></label>
            <input type="range" min="50" max="500" step="10" value="200" id="aucPrice" />
          </div>
          <button class="auc-submit" id="aucSubmit" type="button" disabled>sell</button>
        </div>

        <div class="auc-score" id="aucScore">total · 0</div>

        <div class="auc-result" id="aucResult" aria-hidden="true">
          <div class="auc-result__line" id="aucResultLine"></div>
          <div class="auc-result__cash" id="aucResultCash"></div>
        </div>
      </div>

      <div class="auc-final" id="aucFinal" aria-hidden="true">
        <div class="auc-final__title">end of day</div>
        <div class="auc-final__total" id="aucFinalTotal">0</div>
        <div class="auc-final__best" id="aucFinalBest">best · 0</div>
        <div class="auc-final__btns">
          <button class="auc-btn auc-btn--primary" id="aucAgain">another day</button>
          <button class="auc-btn" id="aucExit">back to chill</button>
        </div>
      </div>
    `
    document.body.appendChild(root)

    prompt    = root.querySelector('#aucPrompt')
    picker    = root.querySelector('#aucPickActive')
    timerBar  = root.querySelector('#aucTimerFill')
    priceSlider = root.querySelector('#aucPrice')
    priceLabel  = root.querySelector('#aucPriceVal')
    submitBtn = root.querySelector('#aucSubmit')
    resultEl  = root.querySelector('#aucResult')
    scoreEl   = root.querySelector('#aucScore')

    root.querySelector('#aucStart').addEventListener('click', start)
    submitBtn.addEventListener('click', onSubmit)
    priceSlider.addEventListener('input', () => { priceLabel.textContent = priceSlider.value })
    root.querySelector('#aucAgain').addEventListener('click', start)
    root.querySelector('#aucExit').addEventListener('click', exitToChill)

    // Listen for clicks on horse elements; the existing sandbox dispatches no
    // event for "horse selected", so we attach to the herd directly.
    const herd = document.getElementById('herd')
    if (herd) herd.addEventListener('click', onHerdClick, true)

    // Hat changes mean a horse is being dressed — surface that nicely.
    document.addEventListener('pf:hat:add', onDress)
    document.addEventListener('pf:hat:remove', onDress)
  }

  function onHerdClick(e) {
    if (!active) return
    const ponyEl = e.target.closest('[data-kind]')
    if (!ponyEl) return
    activeHorseId = ponyEl.dataset.kind
    picker.textContent = activeHorseId
    refreshSubmit()
  }

  function onDress() {
    if (!active) return
    refreshSubmit()
  }

  function refreshSubmit() {
    if (!activeHorseId) { submitBtn.disabled = true; return }
    const board = sandbox().getBoard ? sandbox().getBoard() : {}
    const stack = board[activeHorseId] || []
    submitBtn.disabled = stack.length === 0
  }

  function start() {
    active = true
    buyerIdx = 0
    total = 0
    order = shuffle(BUYERS.slice()).slice(0, 5)
    activeHorseId = null
    if (sandbox().clearAllHats) sandbox().clearAllHats()

    root.classList.add('is-running')
    root.querySelector('#aucStage').setAttribute('aria-hidden', 'false')
    root.querySelector('#aucFinal').setAttribute('aria-hidden', 'true')
    root.querySelector('#aucStart').style.display = 'none'
    document.body.classList.add('is-auction')
    updateScore()
    nextBuyer()
  }

  function nextBuyer() {
    if (buyerIdx >= order.length) return endDay()
    activeHorseId = null
    picker.textContent = '—'
    if (sandbox().clearAllHats) sandbox().clearAllHats()
    const buyer = order[buyerIdx]
    root.querySelector('#aucBuyer').textContent = buyer.name + ' · up to ' + buyer.budget
    root.querySelector('#aucCount').textContent = 'buyer ' + (buyerIdx + 1) + ' / ' + order.length
    prompt.textContent = '"' + buyer.line + '"'
    priceSlider.value = Math.min(200, buyer.budget)
    priceLabel.textContent = priceSlider.value
    priceSlider.max = 500
    submitBtn.disabled = true
    resultEl.setAttribute('aria-hidden', 'true')
    resultEl.classList.remove('is-good', 'is-bad', 'is-ok')
    timerStart = performance.now()
    if (audio().playRoundStart) audio().playRoundStart()
    runTimer()
  }

  function runTimer() {
    if (timerHandle) cancelAnimationFrame(timerHandle)
    function tick() {
      if (!active) return
      const elapsed = (performance.now() - timerStart) / 1000
      const remaining = Math.max(0, ROUND_SECONDS - elapsed)
      const pct = (remaining / ROUND_SECONDS) * 100
      timerBar.style.width = pct + '%'
      timerBar.classList.toggle('is-critical', remaining <= 5)
      if (remaining <= 0) { timeUp(); return }
      timerHandle = requestAnimationFrame(tick)
    }
    tick()
  }

  function timeUp() {
    // Auto-pass: no sale.
    flashResult({ verdict: 'walked off', sublabel: 'no sale', cash: 0, tone: 'bad' })
    setTimeout(advance, 1400)
  }

  function judge() {
    const buyer = order[buyerIdx]
    const board = sandbox().getBoard ? sandbox().getBoard() : {}
    const stack = (board[activeHorseId] || [])
    const price = parseInt(priceSlider.value, 10) || 0

    // Collect tags from pony + each hat in the stack.
    const tags = new Set()
    ;(PONY_TAGS[activeHorseId] || []).forEach(t => tags.add(t))
    stack.forEach(h => (HAT_TAGS[h] || []).forEach(t => tags.add(t)))

    const wantedHits = buyer.wanted.filter(t => tags.has(t)).length
    const wantTotal = buyer.wanted.length
    const avoidHits = (buyer.avoid || []).filter(t => tags.has(t)).length
    const matchPct = wantTotal ? wantedHits / wantTotal : 0

    // Price feedback — over budget = refused. Way under = pony's worth more.
    const overBudget = price > buyer.budget
    const tooCheap = price < buyer.budget * 0.4

    let cash = 0
    let verdict = ''
    let tone = 'ok'

    if (overBudget) {
      verdict = 'too steep — walked'
      tone = 'bad'
      cash = 0
    } else if (matchPct < 0.34) {
      verdict = 'not quite right'
      tone = 'bad'
      cash = 0
    } else if (matchPct < 0.67) {
      verdict = avoidHits ? 'they hesitated' : 'they\'ll take it'
      tone = 'ok'
      cash = Math.round(price * (avoidHits ? 0.6 : 0.85))
    } else {
      verdict = avoidHits ? 'almost perfect' : 'they\'re thrilled'
      tone = 'good'
      const tipBoost = tooCheap ? 1.25 : 1.10  // overpay if you priced low
      cash = Math.round(price * tipBoost)
    }

    return { verdict, cash, tone, matchPct, avoidHits, tooCheap }
  }

  function onSubmit() {
    if (!active || !activeHorseId) return
    if (timerHandle) cancelAnimationFrame(timerHandle)
    const r = judge()
    total += r.cash
    updateScore()
    let sub = ''
    if (r.cash > 0) {
      const buyer = order[buyerIdx]
      sub = '+' + r.cash + (r.tooCheap ? ' (tipped — undersold)' : '') + ' · ' + buyer.name
      if (audio().playMatchCorrect) audio().playMatchCorrect()
    } else {
      sub = 'no sale'
      if (audio().playMatchWrong) audio().playMatchWrong()
    }
    flashResult({ verdict: r.verdict, sublabel: sub, cash: r.cash, tone: r.tone })
    setTimeout(advance, 1700)
  }

  function flashResult({ verdict, sublabel, cash, tone }) {
    const lineEl = root.querySelector('#aucResultLine')
    const cashEl = root.querySelector('#aucResultCash')
    lineEl.textContent = verdict
    cashEl.textContent = cash > 0 ? '+' + cash : sublabel
    resultEl.classList.remove('is-good', 'is-bad', 'is-ok')
    resultEl.classList.add('is-' + tone)
    resultEl.setAttribute('aria-hidden', 'false')
  }

  function advance() {
    buyerIdx++
    nextBuyer()
  }

  function updateScore() {
    scoreEl.textContent = 'total · ' + total
  }

  function endDay() {
    active = false
    if (timerHandle) cancelAnimationFrame(timerHandle)
    root.querySelector('#aucStage').setAttribute('aria-hidden', 'true')
    const final = root.querySelector('#aucFinal')
    final.setAttribute('aria-hidden', 'false')
    root.querySelector('#aucFinalTotal').textContent = total
    const best = getBest()
    if (total > best) { saveBest(total); root.querySelector('#aucFinalBest').textContent = 'best · ' + total + ' (new)' }
    else { root.querySelector('#aucFinalBest').textContent = 'best · ' + best }
    if (audio().playGameOver) audio().playGameOver()
  }

  function exitToChill() {
    active = false
    if (timerHandle) cancelAnimationFrame(timerHandle)
    root.querySelector('#aucFinal').setAttribute('aria-hidden', 'true')
    root.querySelector('#aucStage').setAttribute('aria-hidden', 'true')
    root.querySelector('#aucStart').style.display = ''
    root.classList.remove('is-running')
    document.body.classList.remove('is-auction')
    if (sandbox().clearAllHats) sandbox().clearAllHats()
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => requestAnimationFrame(buildUI))
  } else {
    requestAnimationFrame(buildUI)
  }
})()
