// Netlify Function: /.netlify/functions/vote
// Speicherung in Netlify Blobs: globaler Counter + per clientId "my vote"

const { getStore } = require("@netlify/blobs");

const STORE_NAME = "trip-demo-votes";
const KEY = "state-v1";

function emptyState(){
  return { counts: {}, userVotes: {} };
}

function ensureCount(state, optionId){
  if(!state.counts[optionId]) state.counts[optionId] = { up: 0, down: 0 };
  return state.counts[optionId];
}

function projectForClient(state, clientId){
  const my = state.userVotes[clientId] || {};
  // myVotes: { optionId: "up"|"down" }
  const myVotes = {};
  for(const [k,v] of Object.entries(my)) myVotes[k] = v;
  const counts = state.counts;
  return { counts, myVotes };
}

exports.handler = async (event) => {
  const store = getStore(STORE_NAME);

  // Load current state
  let state = await store.get(KEY, { type: "json" });
  if(!state) state = emptyState();

  // GET: return counts + user's own votes
  if(event.httpMethod === "GET"){
    const clientId = (event.queryStringParameters && event.queryStringParameters.clientId) || "";
    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(projectForClient(state, clientId))
    };
  }

  if(event.httpMethod !== "POST"){
    return { statusCode: 405, body: "Method not allowed" };
  }

  let body;
  try{ body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, body: "Bad JSON" }; }

  const clientId = (body.clientId || "").trim();
  const optionId = (body.optionId || "").trim();
  const dir = body.dir; // "up"|"down"

  if(!clientId || !optionId || (dir !== "up" && dir !== "down")){
    return { statusCode: 400, body: "Missing/invalid fields" };
  }

  // Current vote for this client & option
  if(!state.userVotes[clientId]) state.userVotes[clientId] = {};
  const current = state.userVotes[clientId][optionId] || null; // "up"|"down"|null

  const count = ensureCount(state, optionId);

  // Toggle logic:
  // - If clicking same dir again -> remove vote
  // - If switching dir -> decrement old, increment new
  if(current === dir){
    // remove vote
    if(dir === "up" && count.up > 0) count.up -= 1;
    if(dir === "down" && count.down > 0) count.down -= 1;
    delete state.userVotes[clientId][optionId];
  } else {
    // switch or new
    if(current === "up" && count.up > 0) count.up -= 1;
    if(current === "down" && count.down > 0) count.down -= 1;

    if(dir === "up") count.up += 1;
    if(dir === "down") count.down += 1;

    state.userVotes[clientId][optionId] = dir;
  }

  // persist
  await store.set(KEY, state, { type: "json" });

  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(projectForClient(state, clientId))
  };
};
