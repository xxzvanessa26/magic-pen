const crypto = require("crypto");
const { getDb } = require("../_lib/db.js");
const { hashPassword, signSession, setSessionCookie, isAdminEmail } = require("../_lib/auth.js");

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method not allowed" });
  }

  try {
    const body = req.body || {};
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!token) {
      return res.status(400).json({ error: "invalid_token", message: "This reset link is invalid." });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "weak_password", message: "Password must be at least 8 characters." });
    }

    const db = await getDb();
    const resets = db.collection("passwordResets");
    const record = await resets.findOne({ tokenHash: hashToken(token) });

    if (!record || record.used || new Date(record.expiresAt) < new Date()) {
      return res.status(400).json({
        error: "expired_token",
        message: "This reset link has expired or was already used. Please request a new one."
      });
    }

    const passwordHash = await hashPassword(password);
    await db.collection("users").updateOne({ _id: record.userId }, { $set: { passwordHash: passwordHash } });
    await resets.updateOne({ _id: record._id }, { $set: { used: true } });

    const user = await db.collection("users").findOne({ _id: record.userId });
    const sessionToken = signSession(user);
    setSessionCookie(res, sessionToken);

    return res.status(200).json({
      user: { id: String(user._id), email: user.email, name: user.name || "", isAdmin: isAdminEmail(user.email) }
    });
  } catch (e) {
    console.error("[/api/auth/reset-password]", e);
    return res.status(500).json({ error: "server_error", message: "Something went wrong — please try again." });
  }
};
