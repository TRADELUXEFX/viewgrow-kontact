// POST /api/verify   body: { "code": "XXXX-XXXX" }
// Public endpoint the app calls to redeem a one-time access code.
const { getStore } = require("@netlify/blobs");

function resp(statusCode, obj) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return resp(405, { error: "method_not_allowed" });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return resp(400, { error: "invalid_body" });
  }

  const code = (body.code || "").toString().trim().toUpperCase();
  if (!code) {
    return resp(400, { error: "missing_code", message: "Access code is required." });
  }

  const store = getStore("viewgrow-kontact");
  const record = await store.get(`codes/${code}`, { type: "json" });

  if (!record) {
    return resp(404, { error: "invalid_code", message: "Invalid access code." });
  }
  if (record.is_used) {
    return resp(403, { error: "code_used", message: "This access code has already been used." });
  }

  const list = await store.get(`lists/${record.list_id}`, { type: "json" });
  if (!list || !list.is_public) {
    return resp(403, { error: "list_inactive", message: "This contact list is not active." });
  }

  record.is_used = true;
  record.used_at = new Date().toISOString();
  await store.setJSON(`codes/${code}`, record);

  return resp(200, {
    success: true,
    list_id: list.id,
    list_name: list.name,
    sheet_url: list.sheet_url,
  });
};
