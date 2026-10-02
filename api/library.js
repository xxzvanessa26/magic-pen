const { MongoClient } = require("mongodb");

let clientPromise = null;

function getClient() {
  if (!clientPromise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI is not configured");
    const client = new MongoClient(uri, { maxPoolSize: 5 });
    clientPromise = client.connect();
  }
  return clientPromise;
}

module.exports = async (req, res) => {
  try {
    const client = await getClient();
    const col = client.db().collection("libraries");

    if (req.method === "GET") {
      const id = (req.query && req.query.id) || "";
      if (!id || typeof id !== "string") {
        return res.status(400).json({ error: "missing id" });
      }
      const doc = await col.findOne({ _id: id });
      if (!doc) return res.status(404).json({ error: "not found" });
      return res.status(200).json({
        books: doc.books || [],
        customStickers: doc.customStickers || [],
        updatedAt: doc.updatedAt || null
      });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const id = body.id;
      if (!id || typeof id !== "string") {
        return res.status(400).json({ error: "missing id" });
      }
      const books = Array.isArray(body.books) ? body.books : [];
      const customStickers = Array.isArray(body.customStickers) ? body.customStickers : [];
      await col.updateOne(
        { _id: id },
        { $set: { books: books, customStickers: customStickers, updatedAt: new Date() } },
        { upsert: true }
      );
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: "server error" });
  }
};
