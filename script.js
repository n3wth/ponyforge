const stableRow = document.getElementById("pony-row");
const pasturesEl = [...document.querySelectorAll("[data-pasture]")];
const hatsEl = [...document.querySelectorAll(".hat")];
const whisperEl = document.getElementById("whisper");
const toolbar = document.querySelector(".toolbar");

const HATS = [
  "🎩", "🌼", "🧢", "👑", "🕶️", "🪩",
  "🏳️‍🌈", "🏳️‍⚧️", "💋", "🦋", "✨", "🥀",
];

const PORTRAITS = [
  "./assets/pony-iris.png",
  "./assets/pony-vesper.png",
  "./assets/pony-onyx.png",
  "./assets/pony-prism.png",
  "./assets/pony-sable.png",
  "./assets/pony-femme.png",
];

const NAME_POOL = [
  "Hex", "Velvet", "Mothra", "Glimmer", "Static", "Halcyon",
  "Tinsel", "Dread", "Saffron", "Whisper", "Cinder", "Lacquer",
  "Sable", "Pyre", "Plush", "Marrow", "Tinsel", "Oracle",
];

const PRONOUN_POOL = [
  "they/them", "she/her", "he/him", "he/they", "she/they",
  "xe/xem", "ze/hir", "it/its", "any/all",
];

const WHISPERS = [
  "you look incredible tonight",
  "the field hums under your feet",
  "we have always been this way",
  "every pony here was once a star",
  "your name sounds correct",
  "we kept watching after the show ended",
  "the moonlight is on our side",
  "you are very welcome here",
  "stay a little longer",
  "we braided the ribbons ourselves",
  "wear what feels true",
  "the meadow remembers",
  "you make the herd feel held",
  "queer joy is a load-bearing wall",
];

let draggedPonyId = null;
let selectedHat = "🎩";
let parade = false;
let whisperOn = false;
let spawnIndex = 0;

initHats();
initPonies(document.querySelectorAll(".pony"));
initPastures();
initToolbar();
initWhisper();
initStableDrop();
schedulePastureWander();

function initHats() {
  hatsEl[0].classList.add("selected");
  for (const hatButton of hatsEl) {
    hatButton.addEventListener("click", () => {
      selectedHat = hatButton.dataset.hat || "🎩";
      hatsEl.forEach((btn) => {
        btn.classList.remove("selected");
        btn.setAttribute("aria-checked", "false");
      });
      hatButton.classList.add("selected");
      hatButton.setAttribute("aria-checked", "true");
      if (window.PonyAudio) window.PonyAudio.hat();
    });
  }
}

function initPonies(ponyList) {
  for (const pony of ponyList) {
    pony.addEventListener("dragstart", () => {
      draggedPonyId = pony.id;
      if (window.PonyAudio) window.PonyAudio.drag();
    });

    pony.addEventListener("click", (event) => {
      if (event.target.matches("[data-editable]")) return;
      dressPony(pony, selectedHat);
      shudder(pony);
      playBizarreNoise();
    });

    const nameEl = pony.querySelector(".pony-name[data-editable]");
    if (nameEl) {
      nameEl.addEventListener("click", (event) => event.stopPropagation());
      nameEl.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          nameEl.blur();
        }
      });
      nameEl.addEventListener("blur", () => {
        const trimmed = nameEl.textContent.trim();
        if (!trimmed) nameEl.textContent = pony.dataset.name || "Pony";
      });
    }
  }
}

function initPastures() {
  for (const pasture of pasturesEl) {
    pasture.addEventListener("dragover", (event) => {
      event.preventDefault();
      pasture.classList.add("drag-over");
    });

    pasture.addEventListener("dragleave", () => {
      pasture.classList.remove("drag-over");
    });

    pasture.addEventListener("drop", (event) => {
      event.preventDefault();
      pasture.classList.remove("drag-over");
      movePonyToPasture(pasture);
      if (window.PonyAudio) window.PonyAudio.drop();
    });
  }
}

function initStableDrop() {
  stableRow.addEventListener("dragover", (event) => event.preventDefault());
  stableRow.addEventListener("drop", (event) => {
    event.preventDefault();
    if (!draggedPonyId) return;
    const pony = document.getElementById(draggedPonyId);
    if (!pony) return;
    stableRow.appendChild(pony);
    pony.classList.remove("trawling");
    pony.style.removeProperty("left");
    pony.style.removeProperty("top");
    draggedPonyId = null;
    if (window.PonyAudio) window.PonyAudio.drop();
  });
}

function initToolbar() {
  toolbar.addEventListener("click", (event) => {
    const button = event.target.closest(".tool");
    if (!button) return;
    const action = button.dataset.action;
    switch (action) {
      case "parade":
        toggleParade(button);
        break;
      case "scream-sync":
        screamSync();
        break;
      case "randomize":
        randomizeOutfits();
        break;
      case "spawn":
        spawnPony();
        break;
      case "whisper":
        toggleWhisper(button);
        break;
    }
  });
}

function toggleParade(button) {
  parade = !parade;
  button.setAttribute("aria-pressed", String(parade));
  for (const pony of document.querySelectorAll(".pony")) {
    pony.classList.toggle("parade", parade);
  }
  document.dispatchEvent(new CustomEvent("parade-toggle", { detail: parade }));
  if (parade) playPrideFanfare();
}

function screamSync() {
  const screamers = [...document.querySelectorAll(".pasture-floor .pony")];
  if (screamers.length === 0) {
    flashToolbar("drag a pony into a pasture first");
    return;
  }
  screamers.forEach((pony, index) => {
    setTimeout(() => {
      shudder(pony);
      if (window.PonyAudio) window.PonyAudio.scream(0.8 + index * 0.1);
    }, index * 90);
  });
}

function randomizeOutfits() {
  for (const pony of document.querySelectorAll(".pony")) {
    const random = HATS[Math.floor(Math.random() * HATS.length)];
    dressPony(pony, random);
  }
  playBizarreNoise(1.2);
}

function spawnPony() {
  spawnIndex += 1;
  const id = `pony-spawn-${Date.now()}-${spawnIndex}`;
  const portrait = PORTRAITS[Math.floor(Math.random() * PORTRAITS.length)];
  const name = NAME_POOL[Math.floor(Math.random() * NAME_POOL.length)];
  const pronouns = PRONOUN_POOL[Math.floor(Math.random() * PRONOUN_POOL.length)];
  const hat = HATS[Math.floor(Math.random() * HATS.length)];

  const pony = document.createElement("button");
  pony.className = "pony spawned";
  pony.id = id;
  pony.draggable = true;
  pony.dataset.portrait = portrait;
  pony.dataset.name = name;
  pony.dataset.pronouns = pronouns;
  pony.innerHTML = `
    <span class="hat-slot" aria-hidden="true">${hat}</span>
    <img class="portrait" src="${portrait}" alt="Hyperreal queer pony portrait" />
    <span class="pony-name" data-editable contenteditable="true" spellcheck="false">${name}</span>
    <span class="pony-pronouns">${pronouns}</span>
  `;
  stableRow.appendChild(pony);
  initPonies([pony]);
  if (parade) pony.classList.add("parade");
  playBizarreNoise(1.4);
  setTimeout(() => pony.classList.remove("spawned"), 600);
}

function toggleWhisper(button) {
  whisperOn = !whisperOn;
  button.setAttribute("aria-pressed", String(whisperOn));
  if (!whisperOn) {
    whisperEl.classList.remove("visible");
  }
  if (whisperOn && window.PonyAudio) window.PonyAudio.whisper();
}

function initWhisper() {
  let lastUpdate = 0;
  document.addEventListener("mousemove", (event) => {
    if (!whisperOn) return;
    whisperEl.style.left = `${event.clientX}px`;
    whisperEl.style.top = `${event.clientY}px`;
    const now = performance.now();
    if (now - lastUpdate > 1500) {
      whisperEl.textContent =
        WHISPERS[Math.floor(Math.random() * WHISPERS.length)];
      lastUpdate = now;
    }
    whisperEl.classList.add("visible");
  });
  document.addEventListener("mouseleave", () =>
    whisperEl.classList.remove("visible"),
  );
}

function dressPony(pony, hat) {
  const slot = pony.querySelector(".hat-slot");
  if (slot) slot.textContent = hat;
}

function shudder(pony) {
  pony.classList.remove("screaming");
  void pony.offsetWidth;
  pony.classList.add("screaming");
}

function movePonyToPasture(pasture) {
  if (!draggedPonyId) return;
  const pony = document.getElementById(draggedPonyId);
  const floor = pasture.querySelector(".pasture-floor");
  if (!pony || !floor) return;

  floor.appendChild(pony);
  pony.classList.add("trawling");
  randomizePonyPosition(pony, floor);
  draggedPonyId = null;
}

function randomizePonyPosition(pony, floor) {
  const maxX = Math.max(4, floor.clientWidth - pony.clientWidth - 6);
  const maxY = Math.max(8, floor.clientHeight - pony.clientHeight - 6);
  pony.style.left = `${Math.floor(Math.random() * maxX)}px`;
  pony.style.top = `${Math.floor(Math.random() * maxY)}px`;
}

function schedulePastureWander() {
  setInterval(() => {
    for (const pony of document.querySelectorAll(".pasture-floor .pony")) {
      randomizePonyPosition(pony, pony.parentElement);
    }
  }, 2400);
}

function flashToolbar(message) {
  const ghost = document.createElement("div");
  ghost.className = "whisper visible";
  ghost.textContent = message;
  ghost.style.position = "fixed";
  ghost.style.left = "50%";
  ghost.style.top = "12%";
  ghost.style.transform = "translate(-50%, -50%)";
  document.body.appendChild(ghost);
  setTimeout(() => ghost.remove(), 1600);
}

// Audio is implemented in audio.js as window.PonyAudio. These shims keep the
// existing call sites working and route bizarre-noise calls based on intensity.
function playBizarreNoise(intensity = 1) {
  if (!window.PonyAudio) return;
  if (intensity >= 1.3) window.PonyAudio.spawn();
  else if (intensity >= 1.1) window.PonyAudio.randomize();
  else window.PonyAudio.ponyClick();
}

function playPrideFanfare() {
  if (window.PonyAudio) window.PonyAudio.parade();
}
