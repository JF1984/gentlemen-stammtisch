// ----------------- "Server" API (nur localStorage) -------------------

// Wir speichern Votes pro Client in localStorage.
// Struktur: { [optionId]: "up" | "down" }
const LS_VOTES_KEY = "tripdemo_votes";

function loadLocalVotes() {
  try {
    const raw = localStorage.getItem(LS_VOTES_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return {};
    return obj;
  } catch {
    return {};
  }
}

function saveLocalVotes(votes) {
  try {
    localStorage.setItem(LS_VOTES_KEY, JSON.stringify(votes));
  } catch {
    // ignorieren, wenn z.B. Storage voll
  }
}

// Diese Funktion simuliert den alten GET vom Server,
// liefert counts + eigene Votes zurück.
async function apiGetAll() {
  const myVotes = loadLocalVotes();
  const counts = {};

  for (const [optionId, dir] of Object.entries(myVotes)) {
    if (!counts[optionId]) counts[optionId] = { up: 0, down: 0 };
    if (dir === "up") counts[optionId].up += 1;
    if (dir === "down") counts[optionId].down += 1;
  }

  return { counts, myVotes };
}

// Diese Funktion simuliert den alten POST /toggle
async function apiToggleVote(optionId, dir) {
  const myVotes = loadLocalVotes();
  const current = myVotes[optionId] || null;

  if (current === dir) {
    // gleiches nochmal -> Vote entfernen
    delete myVotes[optionId];
  } else {
    // neuer Vote oder Wechsel
    myVotes[optionId] = dir;
  }

  saveLocalVotes(myVotes);

  // counts nur aus unseren eigenen Votes berechnen
  const counts = {};
  for (const [id, d] of Object.entries(myVotes)) {
    if (!counts[id]) counts[id] = { up: 0, down: 0 };
    if (d === "up") counts[id].up += 1;
    if (d === "down") counts[id].down += 1;
  }

  return { counts, myVotes };
}
