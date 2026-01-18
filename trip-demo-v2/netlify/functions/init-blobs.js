const { getStore } = require("@netlify/blobs");

exports.handler = async () => {
  // Wichtig: sobald store.set einmal erfolgreich läuft,
  // ist Blobs für dieses Projekt provisioniert.
  const store = getStore("trip-demo-votes");

  await store.set("blobs-init", { ok: true, ts: Date.now() }, { type: "json" });

  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ok: true, message: "Blobs initialized" }),
  };
};
