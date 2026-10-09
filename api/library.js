const { getDb } = require("./_lib/db.js");
const { getSessionFromRequest } = require("./_lib/auth.js");

// A logged-in user's library is always keyed by their own account id —
// never by anything the client sends — so one user can never read or
// overwrite another user's books. Signed-out visitors keep using the
// anonymous "Sync Code" id they supply themselves.
function resolveLibraryId(req) {
  const session = getSessionFromRequest(req);
  if (session && session.uid) return "user:" + session.uid;
  const raw = req.method === "GET" ? (req.query && req.query.id) : (req.body && req.body.id);
  return typeof raw === "string" && raw ? raw : null;
}

module.exports = async (req, res) => {
  try {
    const db = await getDb();
    const col = db.collection("libraries");
    const id = resolveLibraryId(req);

    if (req.method === "GET") {
      if (!id) return res.status(400).json({ error: "missing id" });
      const doc = await col.findOne({ _id: id });
      if (!doc) return res.status(404).json({ error: "not found" });
      return res.status(200).json({
        books: doc.books || [],
        customStickers: doc.customStickers || [],
        updatedAt: doc.updatedAt || null
      });
    }

    if (req.method === "POST") {
      if (!id) return res.status(400).json({ error: "missing id" });
      const body = req.body || {};
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
    console.error("[/api/library]", e);
    return res.status(500).json({ error: "server error" });
  }
};
