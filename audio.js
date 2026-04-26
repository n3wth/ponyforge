// Pony Pasture Parade — pure-vanilla Web Audio synth module.
// Exposes window.PonyAudio with per-action sound triggers, a persistent mute
// toggle, and lazy AudioContext init (created on first user gesture).
(function () {
  const STORAGE_KEY = "ponyforge:audio-muted";
  const MAX_GAIN = 0.3;

  let ctx = null;
  let masterGain = null;
  // Default to muted — user must opt in.
  let muted = localStorage.getItem(STORAGE_KEY) !== "false";
  const reducedMotion =
    typeof matchMedia === "function"
      ? matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;
  const volumeScale = reducedMotion ? 0.5 : 1;

  function ensureContext() {
    if (!ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
      masterGain = ctx.createGain();
      masterGain.gain.value = muted ? 0 : MAX_GAIN * volumeScale;
      masterGain.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function setMuted(next) {
    muted = !!next;
    localStorage.setItem(STORAGE_KEY, muted ? "true" : "false");
    if (masterGain) {
      const target = muted ? 0 : MAX_GAIN * volumeScale;
      masterGain.gain.cancelScheduledValues(ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(target, ctx.currentTime + 0.05);
    }
  }

  function isMuted() {
    return muted;
  }

  // Shared noise buffer for percussive bursts.
  let noiseBuffer = null;
  function getNoiseBuffer() {
    if (!ctx) return null;
    if (noiseBuffer) return noiseBuffer;
    const len = ctx.sampleRate * 1.2;
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return noiseBuffer;
  }

  function envGain(start, peak, attack, release) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, start + attack + release);
    return g;
  }

  // SCREAM — detuned saws + noise blast.
  function scream(intensity = 1) {
    if (!ensureContext() || muted) return;
    const now = ctx.currentTime;
    const dur = 0.55 * intensity;
    const out = ctx.createGain();
    out.gain.value = 0.55;
    out.connect(masterGain);

    [0, 7, -5].forEach((detuneCents, i) => {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(180 + i * 11, now);
      o.frequency.exponentialRampToValueAtTime(80, now + dur);
      o.detune.value = detuneCents * 12;
      const g = envGain(now, 0.3, 0.02, dur);
      o.connect(g);
      g.connect(out);
      o.start(now);
      o.stop(now + dur + 0.05);
    });

    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = 900;
    filt.Q.value = 4;
    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer();
    const ng = envGain(now, 0.35, 0.01, dur * 0.7);
    noise.connect(filt);
    filt.connect(ng);
    ng.connect(out);
    noise.start(now);
    noise.stop(now + dur);
  }

  // PARADE — ascending arpeggiated triangle chord.
  function parade() {
    if (!ensureContext() || muted) return;
    const now = ctx.currentTime;
    const notes = [261.63, 329.63, 392, 523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      const start = now + i * 0.07;
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = f;
      const g = envGain(start, 0.25, 0.015, 0.35);
      o.connect(g);
      g.connect(masterGain);
      o.start(start);
      o.stop(start + 0.4);
    });
  }

  // SPAWN — shimmer chime: stacked sine harmonics with FM sparkle.
  function spawn() {
    if (!ensureContext() || muted) return;
    const now = ctx.currentTime;
    const root = 660 + Math.random() * 220;
    [1, 2, 3, 4.01, 5.97].forEach((mult, i) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = root * mult;
      const g = envGain(now + i * 0.012, 0.18 / (i + 1), 0.005, 0.7);
      o.connect(g);
      g.connect(masterGain);
      o.start(now);
      o.stop(now + 0.85);
    });
  }

  // RANDOMIZE — slot-machine clatter: rapid pitched clicks.
  function randomize() {
    if (!ensureContext() || muted) return;
    const now = ctx.currentTime;
    const count = 14;
    for (let i = 0; i < count; i++) {
      const t = now + i * 0.045;
      const o = ctx.createOscillator();
      o.type = "square";
      o.frequency.setValueAtTime(220 + Math.random() * 600, t);
      o.frequency.exponentialRampToValueAtTime(80, t + 0.04);
      const g = envGain(t, 0.22, 0.002, 0.05);
      o.connect(g);
      g.connect(masterGain);
      o.start(t);
      o.stop(t + 0.07);
    }
    // Final cha-ching.
    const ding = ctx.createOscillator();
    ding.type = "triangle";
    ding.frequency.value = 1320;
    const dg = envGain(now + count * 0.045, 0.3, 0.005, 0.4);
    ding.connect(dg);
    dg.connect(masterGain);
    ding.start(now + count * 0.045);
    ding.stop(now + count * 0.045 + 0.45);
  }

  // HAT — popcorn pop.
  function hat() {
    if (!ensureContext() || muted) return;
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(900 + Math.random() * 400, now);
    o.frequency.exponentialRampToValueAtTime(180, now + 0.08);
    const g = envGain(now, 0.4, 0.003, 0.09);
    o.connect(g);
    g.connect(masterGain);
    o.start(now);
    o.stop(now + 0.12);

    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer();
    const filt = ctx.createBiquadFilter();
    filt.type = "highpass";
    filt.frequency.value = 2000;
    const ng = envGain(now, 0.18, 0.001, 0.04);
    noise.connect(filt);
    filt.connect(ng);
    ng.connect(masterGain);
    noise.start(now);
    noise.stop(now + 0.06);
  }

  // PONY CLICK — short bizarre vocal-ish blip.
  function ponyClick() {
    if (!ensureContext() || muted) return;
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = ["sawtooth", "square", "triangle"][Math.floor(Math.random() * 3)];
    o.frequency.setValueAtTime(180 + Math.random() * 220, now);
    o.frequency.exponentialRampToValueAtTime(70 + Math.random() * 60, now + 0.25);
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = 700 + Math.random() * 1100;
    filt.Q.value = 5;
    const g = envGain(now, 0.32, 0.01, 0.28);
    o.connect(filt);
    filt.connect(g);
    g.connect(masterGain);
    o.start(now);
    o.stop(now + 0.32);
  }

  // DRAG — soft ascending whoosh (filtered noise sweep).
  function drag() {
    if (!ensureContext() || muted) return;
    const now = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer();
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.Q.value = 1.2;
    filt.frequency.setValueAtTime(300, now);
    filt.frequency.exponentialRampToValueAtTime(2400, now + 0.35);
    const g = envGain(now, 0.22, 0.05, 0.25);
    noise.connect(filt);
    filt.connect(g);
    g.connect(masterGain);
    noise.start(now);
    noise.stop(now + 0.4);
  }

  // DROP — THUD: low sine drop + noise body.
  function drop() {
    if (!ensureContext() || muted) return;
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(180, now);
    o.frequency.exponentialRampToValueAtTime(40, now + 0.18);
    const g = envGain(now, 0.55, 0.005, 0.22);
    o.connect(g);
    g.connect(masterGain);
    o.start(now);
    o.stop(now + 0.3);

    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer();
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 400;
    const ng = envGain(now, 0.3, 0.002, 0.12);
    noise.connect(filt);
    filt.connect(ng);
    ng.connect(masterGain);
    noise.start(now);
    noise.stop(now + 0.15);
  }

  // WHISPER — airy filtered noise puff.
  function whisper() {
    if (!ensureContext() || muted) return;
    const now = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = getNoiseBuffer();
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = 3200;
    filt.Q.value = 6;
    const g = envGain(now, 0.18, 0.08, 0.45);
    noise.connect(filt);
    filt.connect(g);
    g.connect(masterGain);
    noise.start(now);
    noise.stop(now + 0.55);
  }

  window.PonyAudio = {
    scream,
    parade,
    spawn,
    randomize,
    hat,
    ponyClick,
    drag,
    drop,
    whisper,
    setMuted,
    isMuted,
    ensureContext,
  };
})();

// Toolbar mute button — injected into the existing .toolbar.
(function injectMuteToggle() {
  function init() {
    const toolbar = document.querySelector(".toolbar");
    if (!toolbar) return;
    const btn = document.createElement("button");
    btn.className = "tool";
    btn.dataset.action = "audio-toggle";
    btn.type = "button";
    btn.setAttribute("aria-pressed", String(!window.PonyAudio.isMuted()));
    const update = () => {
      const on = !window.PonyAudio.isMuted();
      btn.innerHTML = `<span class="tool-emoji" aria-hidden="true">${on ? "🔊" : "🔇"}</span> ${on ? "Sound On" : "Sound Off"}`;
      btn.setAttribute("aria-pressed", String(on));
      btn.setAttribute("aria-label", on ? "Mute sound" : "Unmute sound");
    };
    update();
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      window.PonyAudio.ensureContext();
      window.PonyAudio.setMuted(!window.PonyAudio.isMuted());
      update();
      if (!window.PonyAudio.isMuted()) window.PonyAudio.spawn();
    });
    toolbar.appendChild(btn);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
