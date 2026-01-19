const { getStore } = require("@netlify/blobs");

const STORE_NAME = "trip-demo-votes";
const KEY = "state-v4-users"; // neuer Key

function emptyState() {
  return { counts: {}, userVotes: {} }; // userVotes: { [userId]: { [optionId]: "up"|"down" } }
}

function normalizeState(s) {
  if (!s || typeof s !== "object") return emptyState();
  if (!s.counts || typeof s.counts !== "object") s.counts = {};
  if (!s.userVotes || typeof s.userVotes !== "object") s.userVotes = {};
  return s;
}

function ensureCount(state, optionId) {
  if (!state.counts[optionId]) state.counts[optionId] = { up: 0, down: 0 };
  return state.counts[optionId];
}

function projectForUser(state, userId) {
  const myAll = state.userVotes[userId] || {};
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
  return getStore({ name: STORE_NAME, siteID, token });
}

async function loadState(store) {
  const raw = await store.get(KEY, { type: "text" });
  if (!raw) return emptyState();
  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    return emptyState();
  }
}

async function saveState(store, state) {
  await store.set(KEY, JSON.stringify(state), { type: "text" });
}

exports.handler = async (event) => {
  try {
    const store = getAuthedStore();
    const state = await loadState(store);

    if (event.httpMethod === "GET") {
      const userId =
        (event.queryStringParameters && event.queryStringParameters.userId) || "";
      return {
        statusCode: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(projectForUser(state, userId)),
      };
    }

    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Method not allowed" };
    }

    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return { statusCode: 400, body: "Bad JSON" };
    }

    const userId = (body.userId || "").trim();
    const optionId = (body.optionId || "").trim();
    const dir = body.dir;

    if (!userId || !optionId || (dir !== "up" && dir !== "down")) {
      return { statusCode: 400, body: "Missing/invalid fields" };
    }

    if (!state.userVotes[userId]) state.userVotes[userId] = {};
    const current = state.userVotes[userId][optionId] || null;
    const count = ensureCount(state, optionId);

    if (current === dir) {
      if (dir === "up" && count.up > 0) count.up -= 1;
      if (dir === "down" && count.down > 0) count.down -= 1;
      delete state.userVotes[userId][optionId];
    } else {
      if (current === "up" && count.up > 0) count.up -= 1;
      if (current === "down" && count.down > 0) count.down -= 1;

      if (dir === "up") count.up += 1;
      if (dir === "down") count.down += 1;

      state.userVotes[userId][optionId] = dir;
    }

    await saveState(store, state);

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(projectForUser(state, userId)),
    };
  } catch (e) {
    console.error("vote2 error:", e);
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        error: "vote2_failed",
        message: e.message || String(e),
      }),
    };
  }
};
