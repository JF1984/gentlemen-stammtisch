exports.handler = async () => {
  const siteId = process.env.NETLIFY_SITE_ID || "";
  const token = process.env.NETLIFY_ACCESS_TOKEN || "";

  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      hasSiteId: !!siteId,
      siteIdPrefix: siteId ? siteId.slice(0, 8) + "…" : null,
      hasToken: !!token,
      tokenPrefix: token ? token.slice(0, 6) + "…" : null
    })
  };
};