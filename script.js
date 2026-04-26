const hats = document.querySelectorAll(".hat");
const pasture = document.getElementById("pasture");
let currentHat = "🎩";
let dragged = null;
let dragOffset = [0, 0];

hats.forEach(h => {
  h.addEventListener("click", () => {
    hats.forEach(x => x.setAttribute("aria-checked", "false"));
    h.setAttribute("aria-checked", "true");
    currentHat = h.dataset.hat;
  });
});

document.querySelectorAll(".pony").forEach(p => {
  p.addEventListener("click", e => {
    if (p._wasDragged) { p._wasDragged = false; return; }
    p.querySelector(".hat-slot").textContent = currentHat;
  });
  p.addEventListener("dragstart", e => {
    dragged = p;
    const r = p.getBoundingClientRect();
    dragOffset = [e.clientX - r.left, e.clientY - r.top];
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", "pony");
  });
  p.addEventListener("dragend", () => {
    if (dragged === p) p._wasDragged = true;
    dragged = null;
  });
});

pasture.addEventListener("dragover", e => {
  e.preventDefault();
  pasture.classList.add("over");
});
pasture.addEventListener("dragleave", () => pasture.classList.remove("over"));
pasture.addEventListener("drop", e => {
  e.preventDefault();
  pasture.classList.remove("over");
  if (!dragged) return;
  const r = pasture.getBoundingClientRect();
  if (dragged.parentElement !== pasture) pasture.appendChild(dragged);
  const x = e.clientX - r.left - dragOffset[0];
  const y = e.clientY - r.top - dragOffset[1];
  dragged.style.left = `${Math.max(0, Math.min(r.width - dragged.offsetWidth, x))}px`;
  dragged.style.top = `${Math.max(0, Math.min(r.height - dragged.offsetHeight, y))}px`;
});
