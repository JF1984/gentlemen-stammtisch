// netlify/functions/vote2.js
const { getStore } = require("@netlify/blobs");

const STORE_NAME = "trip-demo-votes";
const KEY = "state-v2"; // neuer Key -> frischer State

function emptyState() {
  return { counts: {}, userVotes: {} };
}

function normalizeState(raw) {
  let s = raw;
  if (!s || typeof s !== "object") s = {};
  if (!s.counts || typeof s.counts !== "object") s.counts = {};
  if (!s.userVotes || typeof s.userVotes !== "object") s.userVotes = {};
  return s;
}

function ensureCount(state, optionId) {
  if (!state.counts[optionId]) state.counts[optionId] = { up: 0, down: 0 };
  return state.counts[optionId];
}

function projectForClient(state, clientId) {
  const myAll = state.userVotes[clientId] || {};
  const myVotes = {};
  for (const [k, v] of Object.entries(myAll)) myVotes[k] = v;
  return { counts: state.counts, myVotes };
}

function getAuthedStore() {
  const siteID = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_ACCESS_TOKEN;

  if (!siteID || !token) {
    const err = new Error("Missing NETLIFY_SITE_ID or NETLIFY_ACCESS_TOKEN");
    err.statusCode = 500;
    throw err;
  }

  return getStore({
    name: STORE_NAME,
    siteID,
    token,
  });
}

exports.handler = async (event) => {
  try {
    const store = getAuthedStore();

    // State laden + normalisieren
    let raw = await store.get(KEY, { type: "json" });
    let state = normalizeState(raw);

    // ----------- GET: nur Daten lesen ----------
    if (event.httpMethod === "GET") {
      const clientId =
        (event.queryStringParameters && event.queryStringParameters.clientId) ||
        "";
      return {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(projectForClient(state, clientId)),
      };
    }

    // ----------- POST: Vote togglen ------------
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method not allowed" };
    }

    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return { statusCode: 400, body: "Bad JSON" };
    }

    const clientId = (body.clientId || "").trim();
    const optionId = (body.optionId || "").trim();
    const dir = body.dir; // "up" | "down"

    if (!clientId || !optionId || (dir !== "up" && dir !== "down")) {
      return { statusCode: 400, body: "Missing/invalid fields" };
    }

    if (!state.userVotes[clientId]) state.userVotes[clientId] = {};
    const current = state.userVotes[clientId][optionId] || null;
    const count = ensureCount(state, optionId);

    // Toggle / Switch Logik
    if (current === dir) {
      // Gleiches nochmal klicken -> Vote entfernen
      if (dir === "up" && count.up > 0) count.up -= 1;
      if (dir === "down" && count.down > 0) count.down -= 1;
      delete state.userVotes[clientId][optionId];
    } else {
      // Wechsel oder neuer Vote
      if (current === "up" && count.up > 0) count.up -= 1;
      if (current === "down" && count.down > 0) count.down -= 1;

      if (dir === "up") count.up += 1;
      if (dir === "down") count.down += 1;

      state.userVotes[clientId][optionId] = dir;
    }

    await store.set(KEY, state, { type: "json" });

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(projectForClient(state, clientId)),
    };
  } catch (e) {
    console.error("vote2 error:", e);
    return {
      statusCode: e.statusCode || 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        error: "vote2_failed",
        message: e.message || String(e),
      }),
    };
  }
};
