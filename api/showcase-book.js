const { getDb } = require("./_lib/db.js");
const { getSessionFromRequest, isAdminSession } = require("./_lib/auth.js");

const DOC_ID = "showcaseBook";
const MAX_PAGES = 20;

module.exports = async (req, res) => {
  try {
    const db = await getDb();
    const settings = db.collection("settings");

    if (req.method === "GET") {
      const doc = await settings.findOne({ _id: DOC_ID });
      return res.status(200).json({ book: (doc && doc.book) || null, updatedAt: (doc && doc.updatedAt) || null });
    }

    const session = getSessionFromRequest(req);
    if (!isAdminSession(session)) {
      return res.status(403).json({ error: "forbidden", message: "Only the site owner can change the showcase story." });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const book = body.book;
      if (!book || typeof book !== "object" || !Array.isArray(book.pages) || book.pages.length === 0) {
        return res.status(400).json({ error: "invalid_book", message: "That doesn't look like a valid book." });
      }
      if (book.pages.length > MAX_PAGES) {
        return res.status(400).json({ error: "too_many_pages", message: "That book has too many pages to feature." });
      }
      const cleanBook = {
        title: typeof book.title === "string" ? book.title.slice(0, 70) : "Untitled Book",
        author: typeof book.author === "string" ? book.author.slice(0, 40) : "",
        pages: book.pages.slice(0, MAX_PAGES)
      };
      await settings.updateOne(
        { _id: DOC_ID },
        { $set: { book: cleanBook, updatedAt: new Date() } },
        { upsert: true }
      );
      return res.status(200).json({ ok: true, book: cleanBook });
    }

    if (req.method === "DELETE") {
      await settings.deleteOne({ _id: DOC_ID });
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    console.error("[/api/showcase-book]", e);
    return res.status(500).json({ error: "server_error", message: "Something went wrong — please try again." });
  }
};
