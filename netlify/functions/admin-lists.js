const { getStore } = require("@netlify/blobs");

function blobStore() {
  return getStore({
    name: "viewgrow-kontact",
    siteID: process.env.BLOBS_SITE_ID,
    token: process.env.BLOBS_TOKEN,
  });
}

function authed(event) {
  const secret = event.headers["x-admin-secret"] || event.headers["X-Admin-Secret"];
  return Boolean(secret) && secret === process.env.ADMIN_SECRET;
}

function resp(statusCode, obj) {
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) };
}

async function nextListId(store) {
  let counter = await store.get("lists/_counter", { type: "json" });
  if (typeof counter !== "number") counter = 0;
  counter += 1;
  await store.setJSON("lists/_counter", counter);
  return counter;
}

exports.handler = async (event) => {
  if (!authed(event)) return resp(401, { error: "unauthorized" });
  const store = blobStore();

  if (event.httpMethod === "GET") {
    const index = (await store.get("lists/_index", { type: "json" })) || [];
    const lists = [];
    for (const id of index) {
      const list = await store.get(`lists/${id}`, { type: "json" });
      if (list) lists.push(list);
    }
    return resp(200, lists);
  }

  if (event.httpMethod === "POST") {
    const body = JSON.parse(event.body || "{}");
    if (!body.name || !body.sheet_url) return resp(400, { error: "missing_fields", message: "name and sheet_url are required." });
    const id = await nextListId(store);
    const list = { id, name: body.name, sheet_url: body.sheet_url, is_public: body.is_public !== false, created_at: new Date().toISOString() };
    await store.setJSON(`lists/${id}`, list);
    const index = (await store.get("lists/_index", { type: "json" })) || [];
    index.push(id);
    await store.setJSON("lists/_index", index);
    return resp(201, list);
  }

  if (event.httpMethod === "PUT") {
    const body = JSON.parse(event.body || "{}");
    if (!body.id) return resp(400, { error: "missing_id" });
    const existing = await store.get(`lists/${body.id}`, { type: "json" });
    if (!existing) return resp(404, { error: "not_found" });
    const updated = { ...existing, name: body.name ?? existing.name, sheet_url: body.sheet_url ?? existing.sheet_url, is_public: body.is_public ?? existing.is_public };
    await store.setJSON(`lists/${body.id}`, updated);
    return resp(200, updated);
  }

  if (event.httpMethod === "DELETE") {
    const body = JSON.parse(event.body || "{}");
    if (!body.id) return resp(400, { error: "missing_id" });
    await store.delete(`lists/${body.id}`);
    const index = (await store.get("lists/_index", { type: "json" })) || [];
    await store.setJSON("lists/_index", index.filter((x) => x != body.id));
    const codeIds = (await store.get(`codes/_by_list/${body.id}`, { type: "json" })) || [];
    for (const code of codeIds) await store.delete(`codes/${code}`);
    await store.delete(`codes/_by_list/${body.id}`);
    return resp(200, { success: true });
  }

  return resp(405, { error: "method_not_allowed" });
};
