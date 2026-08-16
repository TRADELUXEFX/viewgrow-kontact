// GET  /api/admin/codes?list_id=<id>          -> list codes for a list
// POST /api/admin/codes  { list_id, count }    -> generate new codes
// Requires header:  x-admin-secret: <ADMIN_SECRET env var>
const { getStore } = require("@netlify/blobs");
const { randomBytes } = require("crypto");

function authed(event) {
  const secret = event.headers["x-admin-secret"] || event.headers["X-Admin-Secret"];
  return Boolean(secret) && secret === process.env.ADMIN_SECRET;
}

function resp(statusCode, obj) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  };
}

function generateCode() {
  const hex = randomBytes(5).toString("hex").toUpperCase().slice(0, 8);
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

exports.handler = async (event) => {
  if (!authed(event)) return resp(401, { error: "unauthorized" });

  const store = getStore("viewgrow-kontact");

  if (event.httpMethod === "GET") {
    const listId = event.queryStringParameters && event.queryStringParameters.list_id;
    if (!listId) return resp(400, { error: "missing_list_id" });

    const codeIds = (await store.get(`codes/_by_list/${listId}`, { type: "json" })) || [];
    const codes = [];
    for (const code of codeIds) {
      const c = await store.get(`codes/${code}`, { type: "json" });
      if (c) codes.push(c);
    }
    codes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return resp(200, codes);
  }

  if (event.httpMethod === "POST") {
    const body = JSON.parse(event.body || "{}");
    const listId = body.list_id;
    const count = Math.min(parseInt(body.count, 10) || 1, 500);
    if (!listId) return resp(400, { error: "missing_list_id" });

    const list = await store.get(`lists/${listId}`, { type: "json" });
    if (!list) return resp(404, { error: "list_not_found" });

    const codeIds = (await store.get(`codes/_by_list/${listId}`, { type: "json" })) || [];
    const created = [];
    let attempts = 0;

    while (created.length < count && attempts < count * 5) {
      const code = generateCode();
      const exists = await store.get(`codes/${code}`, { type: "json" });
      if (!exists) {
        const record = {
          code,
          list_id: listId,
          is_used: false,
          used_at: null,
          created_at: new Date().toISOString(),
        };
        await store.setJSON(`codes/${code}`, record);
        created.push(code);
        codeIds.push(code);
      }
      attempts++;
    }

    await store.setJSON(`codes/_by_list/${listId}`, codeIds);
    return resp(200, { created });
  }

  return resp(405, { error: "method_not_allowed" });
};
