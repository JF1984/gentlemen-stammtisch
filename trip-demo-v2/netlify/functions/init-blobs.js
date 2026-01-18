const { getStore } = require("@netlify/blobs");

exports.handler = async () => {
  try {
    const siteID = process.env.NETLIFY_SITE_ID;
    const token = process.env.NETLIFY_ACCESS_TOKEN;

    if (!siteID || !token) {
      return {
        statusCode: 500,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ok: false, message: "Missing env vars" })
      };
    }

    const store = getStore({
      name: "trip-demo-votes",
      siteID,
      token
    });

    await store.set("blobs-init", { ok: true, ts: Date.now() }, { type: "json" });

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: true, message: "Blobs initialized" })
    };
  } catch (e) {
    console.error("init-blobs error:", e);
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: false, message: e.message || String(e) })
    };
  }
};
