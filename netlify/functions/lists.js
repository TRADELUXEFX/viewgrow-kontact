// GET /api/lists
// Public endpoint the app calls to show available contact lists.
const { getStore } = require("@netlify/blobs");

exports.handler = async () => {
  const store = getStore("viewgrow-kontact");
  const index = (await store.get("lists/_index", { type: "json" })) || [];

  const lists = [];
  for (const id of index) {
    const list = await store.get(`lists/${id}`, { type: "json" });
    if (list && list.is_public) {
      lists.push({ id: list.id, name: list.name });
    }
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lists),
  };
};
