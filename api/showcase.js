const { getDb } = require("./_lib/db.js");
const { getSessionFromRequest, isAdminSession } = require("./_lib/auth.js");

const DOC_ID = "showcaseVideo";

module.exports = async (req, res) => {
  try {
    const db = await getDb();
    const settings = db.collection("settings");

    if (req.method === "GET") {
      const doc = await settings.findOne({ _id: DOC_ID });
      return res.status(200).json({ url: (doc && doc.url) || null, updatedAt: (doc && doc.updatedAt) || null });
    }

    const session = getSessionFromRequest(req);
    if (!isAdminSession(session)) {
      return res.status(403).json({ error: "forbidden", message: "Only the site owner can change the showcase video." });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const url = typeof body.url === "string" ? body.url.trim() : "";
      if (!/^https:\/\//.test(url)) {
        return res.status(400).json({ error: "invalid_url", message: "That doesn't look like a valid video link." });
      }
      await settings.updateOne(
        { _id: DOC_ID },
        { $set: { url: url, updatedAt: new Date() } },
        { upsert: true }
      );
      return res.status(200).json({ ok: true, url: url });
    }

    if (req.method === "DELETE") {
      await settings.deleteOne({ _id: DOC_ID });
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    console.error("[/api/showcase]", e);
    return res.status(500).json({ error: "server_error", message: "Something went wrong — please try again." });
  }
};
