const { getStore } = require("@netlify/blobs");

function blobStore() {
  return getStore({
    name: "viewgrow-kontact",
    siteID: process.env.BLOBS_SITE_ID,
    token: process.env.BLOBS_TOKEN,
  });
}

exports.handler = async () => {
  const store = blobStore();
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
