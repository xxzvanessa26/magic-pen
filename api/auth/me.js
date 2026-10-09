const { ObjectId } = require("mongodb");
const { getDb } = require("../_lib/db.js");
const { getSessionFromRequest, isAdminEmail } = require("../_lib/auth.js");

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method not allowed" });
  }

  try {
    const session = getSessionFromRequest(req);
    if (!session) return res.status(200).json({ user: null });

    const db = await getDb();
    let user = null;
    try {
      user = await db.collection("users").findOne({ _id: new ObjectId(session.uid) });
    } catch (e) {
      user = null;
    }
    if (!user) return res.status(200).json({ user: null });

    return res.status(200).json({
      user: { id: String(user._id), email: user.email, name: user.name || "", isAdmin: isAdminEmail(user.email) }
    });
  } catch (e) {
    return res.status(200).json({ user: null });
  }
};
