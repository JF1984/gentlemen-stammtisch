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

// -------------------- Client-ID (pro Gerät/Browser) --------------------
function getClientId(){
  const key = "tripdemo_client_id";
  let id = localStorage.getItem(key);
  if(!id){
    id = (crypto.randomUUID ? crypto.randomUUID() : `id_${Math.random().toString(16).slice(2)}_${Date.now()}`);
    localStorage.setItem(key, id);
  }
  return id;
}
const clientId = getClientId();

// -------------------- Server API --------------------
const API_BASE = "/.netlify/functions/vote2";

async function apiGetAll(){
  const res = await fetch(`${API_BASE}?clientId=${encodeURIComponent(clientId)}`);
  if(!res.ok) throw new Error(`GET failed: ${res.status}`);
  return res.json(); // { counts: {id:{up,down}}, myVotes: {id:"up"|"down"} }
}

async function apiToggleVote(optionId, dir){
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify({ clientId, optionId, dir }) // dir = "up"|"down"
  });
  if(!res.ok) throw new Error(`POST failed: ${res.status}`);
  return res.json(); // same shape
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
      const optionId = btn.getAttribute("data-id");
      const dir = btn.getAttribute("data-vote"); // "up"|"down"
      try{
        statusChip.textContent = "🟡 Speichere…";
        const newState = await apiToggleVote(optionId, dir);
        serverState = newState;
        statusChip.textContent = "🟢 Verbunden";
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

// init
populateFilters();
(async function init(){
  try{
    statusChip.textContent = "🟡 Lade Votes…";
    serverState = await apiGetAll();
    statusChip.textContent = "🟢 Verbunden";
  } catch (e){
    console.error(e);
    statusChip.textContent = "🔴 Offline";
    // fallback: render mit 0/0
  }
  render();
})();

// filters re-render
[search, typeFilter, dayFilter].forEach(el => el.addEventListener("input", render));
typeFilter.addEventListener("change", render);
dayFilter.addEventListener("change", render);
