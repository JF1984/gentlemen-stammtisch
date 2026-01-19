// -------------------- FIXED USERS (HIER ANPASSEN) --------------------
const USERS = [
  { id: "julian", name: "Julian" },
  { id: "max", name: "Max" },
  { id: "tom", name: "Tom" },
  { id: "phil", name: "Phil" }
];

// -------------------- Dummy-Daten --------------------
const data = {
  trip: {
    days: [
      {
        day: "Freitag",
        date: "2026-02-06",
        slots: [
          {
            time: "10:00–12:00",
            label: "Frühstück / Brunch",
            options: [
              {
                id: "bakers",
                name: "Bakers & Roasters (Dummy)",
                type: "Breakfast",
                area: "De Pijp",
                notes: "Brunch-Vibe, kann voll sein.",
                website: "https://example.com",
                maps: "https://maps.google.com/?q=Bakers+%26+Roasters+Amsterdam"
              },
              {
                id: "coffee",
                name: "Coffee Spot X (Dummy)",
                type: "Breakfast",
                area: "Centrum",
                notes: "Schnell & easy.",
                website: "https://example.com",
                maps: "https://maps.google.com/?q=Coffee+Amsterdam"
              }
            ]
          },
          {
            time: "14:00–17:00",
            label: "Aktivität",
            options: [
              {
                id: "canal",
                name: "Canal Cruise (Dummy)",
                type: "Activity",
                area: "Centrum",
                notes: "Low effort, high reward.",
                website: "https://example.com",
                maps: "https://maps.google.com/?q=Canal+Cruise+Amsterdam"
              }
            ]
          }
        ]
      }
    ]
  }
};

// -------------------- User Selection (pro Browser gespeichert) --------------------
const USER_KEY = "tripdemo_user_id";

function getSelectedUserId() {
  return localStorage.getItem(USER_KEY) || "";
}
function setSelectedUserId(id) {
  localStorage.setItem(USER_KEY, id);
}
function getUserNameById(id) {
  const u = USERS.find(x => x.id === id);
  return u ? u.name : "Unknown";
}

let userId = getSelectedUserId(); // global current userId

function ensureUserSelected() {
  if (userId && USERS.some(u => u.id === userId)) return true;
  userId = "";
  localStorage.removeItem(USER_KEY);
  return false;
}

// Gate UI: blockiert Seite bis User gewählt
function showUserGate() {
  // wenn schon da -> nix
  if (document.getElementById("userGateOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "userGateOverlay";
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.zIndex = "9999";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.background = "rgba(0,0,0,0.7)";
  overlay.style.backdropFilter = "blur(10px)";

  overlay.innerHTML = `
    <div style="
      width: min(460px, 92vw);
      border-radius: 18px;
      padding: 18px;
      background: rgba(20,24,34,0.95);
      border: 1px solid rgba(255,255,255,0.10);
      box-shadow: 0 20px 60px rgba(0,0,0,0.55);
      color: white;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    ">
      <div style="font-size: 22px; font-weight: 800; margin-bottom: 6px;">Wer bist du?</div>
      <div style="opacity: .85; margin-bottom: 12px;">Bitte auswählen, dann kannst du voten.</div>

      <select id="userGateSelect" style="
        width: 100%;
        padding: 12px 12px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.15);
        background: rgba(10,12,18,0.65);
        color: white;
        margin-bottom: 12px;
        font-size: 16px;
      ">
        <option value="">-- auswählen --</option>
        ${USERS.map(u => `<option value="${u.id}">${u.name}</option>`).join("")}
      </select>

      <button id="userGateBtn" disabled style="
        width: 100%;
        padding: 12px 12px;
        border-radius: 12px;
        border: 0;
        font-weight: 800;
        cursor: pointer;
        font-size: 16px;
      ">Weiter</button>
    </div>
  `;

  document.body.appendChild(overlay);

  const sel = document.getElementById("userGateSelect");
  const btn = document.getElementById("userGateBtn");

  sel.addEventListener("change", () => {
    btn.disabled = !sel.value;
    btn.style.opacity = sel.value ? "1" : "0.45";
  });

  btn.addEventListener("click", async () => {
    userId = sel.value;
    setSelectedUserId(userId);

    overlay.remove();

    // refresh votes for selected user
    await initVotesAndRender();
  });
}

// Adds a User Switcher in your existing top bar if an anchor exists
function injectUserSwitcher() {
  // Du hast kein direktes Header-Element im Code, also hängen wir uns an statusChip parent.
  // statusChip existiert (id="statusChip") -> wir nutzen dessen parent als anchor.
  const anchor = statusChip ? statusChip.parentElement : null;
  if (!anchor) return;

  // Wenn schon injected, skip
  if (document.getElementById("userSwitcher")) return;

  const wrap = document.createElement("div");
  wrap.id = "userSwitcher";
  wrap.style.display = "inline-flex";
  wrap.style.alignItems = "center";
  wrap.style.gap = "8px";
  wrap.style.marginLeft = "10px";

  const label = document.createElement("span");
  label.textContent = "User:";
  label.style.opacity = "0.85";

  const select = document.createElement("select");
  select.style.padding = "6px 10px";
  select.style.borderRadius = "10px";
  select.style.border = "1px solid rgba(255,255,255,0.15)";
  select.style.background = "rgba(10,12,18,0.6)";
  select.style.color = "white";

  USERS.forEach(u => {
    const opt = document.createElement("option");
    opt.value = u.id;
    opt.textContent = u.name;
    if (u.id === userId) opt.selected = true;
    select.appendChild(opt);
  });

  select.addEventListener("change", async () => {
    userId = select.value;
    setSelectedUserId(userId);
    statusChip.textContent = `🟡 Lade Votes (${getUserNameById(userId)})…`;
    await initVotesAndRender();
  });

  wrap.appendChild(label);
  wrap.appendChild(select);

  anchor.appendChild(wrap);
}

// ----------------- Server API -------------------
const API_BASE = "/.netlify/functions/vote2";

// NOTE: vote2 muss userId akzeptieren (GET ?userId=..., POST {userId, optionId, dir})
async function apiGetAll() {
  const res = await fetch(`${API_BASE}?userId=${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error(`GET failed: ${res.status}`);
  return res.json(); // { counts, myVotes }
}

async function apiToggleVote(optionId, dir) {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, optionId, dir }),
  });
  if (!res.ok) throw new Error(`POST failed: ${res.status}`);
  return res.json();
}

// -------------------- UI --------------------
const board = document.getElementById("board");
const search = document.getElementById("search");
const typeFilter = document.getElementById("typeFilter");
const dayFilter = document.getElementById("dayFilter");
const statusChip = document.getElementById("statusChip");
const copyLinkBtn = document.getElementById("copyLink");

let serverState = { counts: {}, myVotes: {} };

function allTypes(){
  const set = new Set();
  data.trip.days.forEach(d => d.slots.forEach(s => s.options.forEach(o => set.add(o.type))));
  return Array.from(set).sort();
}
function allDays(){
  return data.trip.days.map(d => d.day);
}
function populateFilters(){
  allTypes().forEach(t=>{
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    typeFilter.appendChild(opt);
  });
  allDays().forEach(d=>{
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = d;
    dayFilter.appendChild(opt);
  });
}

function getCount(id){
  return serverState.counts[id] || { up: 0, down: 0 };
}
function getMyVote(id){
  return serverState.myVotes[id] || null; // "up"|"down"|null
}

function render(){
  // block wenn kein user
  if (!ensureUserSelected()) {
    board.innerHTML = "";
    statusChip.textContent = "🟠 Bitte User wählen";
    showUserGate();
    return;
  }

  const q = (search.value || "").trim().toLowerCase();
  const tf = typeFilter.value;
  const df = dayFilter.value;

  board.innerHTML = "";

  data.trip.days
    .filter(d => !df || d.day === df)
    .forEach(day => {
      const dayEl = document.createElement("div");
      dayEl.className = "day";

      const head = document.createElement("div");
      head.className = "dayHead";
      head.innerHTML = `
        <div class="dayTitle">${day.day}</div>
        <div class="dayMeta">${day.date}</div>
      `;
      dayEl.appendChild(head);

      const slots = document.createElement("div");
      slots.className = "slots";

      day.slots.forEach(slot => {
        const opts = slot.options.filter(o => {
          if(tf && o.type !== tf) return false;
          if(q){
            const blob = `${o.name} ${o.type} ${o.area} ${o.notes}`.toLowerCase();
            return blob.includes(q);
          }
          return true;
        });
        if((q || tf) && opts.length === 0) return;

        const slotEl = document.createElement("div");
        slotEl.className = "slot";
        slotEl.innerHTML = `
          <div class="slotTop">
            <div>
              <div class="slotLabel">${slot.label}</div>
              <div class="slotTime">${slot.time}</div>
            </div>
          </div>
          <div class="cards"></div>
        `;

        const cards = slotEl.querySelector(".cards");

        opts.forEach(o => {
          const v = getCount(o.id);
          const my = getMyVote(o.id);

          const card = document.createElement("div");
          card.className = "card";
          card.innerHTML = `
            <div class="cardTop">
              <div>
                <div class="name">${o.name}</div>
                <div class="meta">${o.type} · ${o.area}</div>
              </div>
            </div>
            <div class="notes">${o.notes}</div>

            <div class="actions">
              <a class="pill" href="${o.website}" target="_blank" rel="noopener">🌐 Website</a>
              <a class="pill" href="${o.maps}" target="_blank" rel="noopener">📍 Google Maps</a>

              <div class="vote">
                <button class="${my === "up" ? "active-up" : ""}" aria-label="Upvote"
                  data-vote="up" data-id="${o.id}">👍</button>
                <button class="${my === "down" ? "active-down" : ""}" aria-label="Downvote"
                  data-vote="down" data-id="${o.id}">👎</button>
                <div class="count">${v.up} / ${v.down}</div>
              </div>
            </div>
          `;
          cards.appendChild(card);
        });

        slots.appendChild(slotEl);
      });

      dayEl.appendChild(slots);
      board.appendChild(dayEl);
    });

  // vote handlers
  board.querySelectorAll("button[data-vote]").forEach(btn=>{
    btn.addEventListener("click", async () => {
      if (!ensureUserSelected()) {
        showUserGate();
        return;
      }

      const optionId = btn.getAttribute("data-id");
      const dir = btn.getAttribute("data-vote"); // "up"|"down"
      try{
        statusChip.textContent = `🟡 Speichere… (${getUserNameById(userId)})`;
        const newState = await apiToggleVote(optionId, dir);
        serverState = newState;
        statusChip.textContent = `🟢 Verbunden (${getUserNameById(userId)})`;
        render();
      } catch (e){
        console.error(e);
        statusChip.textContent = "🔴 Fehler";
        alert("Vote konnte nicht gespeichert werden. Schau in die Browser-Konsole/Netlify Function Logs.");
      }
    });
  });
}

// share button
copyLinkBtn.addEventListener("click", async () => {
  try{
    await navigator.clipboard.writeText(window.location.href);
    copyLinkBtn.textContent = "Copied ✓";
    setTimeout(()=> copyLinkBtn.textContent = "Share", 1200);
  } catch {
    alert("Konnte Link nicht kopieren – kopier ihn manuell aus der Adresszeile 🙂");
  }
});

// filters re-render
[search, typeFilter, dayFilter].forEach(el => el.addEventListener("input", render));
typeFilter.addEventListener("change", render);
dayFilter.addEventListener("change", render);

// init
populateFilters();

async function initVotesAndRender() {
  injectUserSwitcher();

  if (!ensureUserSelected()) {
    serverState = { counts: {}, myVotes: {} };
    render();
    return;
  }

  try{
    statusChip.textContent = `🟡 Lade Votes… (${getUserNameById(userId)})`;
    serverState = await apiGetAll();
    statusChip.textContent = `🟢 Verbunden (${getUserNameById(userId)})`;
  } catch (e){
    console.error(e);
    statusChip.textContent = "🔴 Offline";
    // fallback: render mit 0/0, myVotes leer
    serverState = { counts: {}, myVotes: {} };
  }

  render();
}

(async function init(){
  if (!ensureUserSelected()) {
    // show gate and render minimal
    statusChip.textContent = "🟠 Bitte User wählen";
    injectUserSwitcher();
    showUserGate();
    render();
    return;
  }
  await initVotesAndRender();
})();
