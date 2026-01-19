// netlify/functions/reset-votes.js
const { getStore } = require("@netlify/blobs");

const STORE_NAME = "trip-demo-votes";
const KEY = "state-v2";

function emptyState() {
  return { counts: {}, userVotes: {} };
}

function getAuthedStore() {
  const siteID = process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_ACCESS_TOKEN;

  return getStore({
    name: STORE_NAME,
    siteID,
    token,
  });
}

exports.handler = async () => {
  const store = getAuthedStore();
  await store.set(KEY, emptyState(), { type: "json" });

  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ok: true }),
  };
};
