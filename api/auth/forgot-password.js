const crypto = require("crypto");
const { getDb } = require("../_lib/db.js");
const { isValidEmail } = require("../_lib/auth.js");

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_PER_HOUR = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const GENERIC_MESSAGE = "If an account exists for that email, a reset link has been created.";

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function allowedByRateLimit(db, email) {
  const limits = db.collection("passwordResetLimits");
  const now = Date.now();
  const rec = await limits.findOne({ _id: email });
  if (rec && now - rec.windowStart < RATE_WINDOW_MS) {
    if (rec.count >= RATE_LIMIT_PER_HOUR) return false;
    await limits.updateOne({ _id: email }, { $inc: { count: 1 } });
    return true;
  }
  await limits.updateOne({ _id: email }, { $set: { windowStart: now, count: 1 } }, { upsert: true });
  return true;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method not allowed" });
  }

  try {
    const body = req.body || {};
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "invalid_email", message: "Please enter a valid email address." });
    }

    const db = await getDb();

    const allowed = await allowedByRateLimit(db, email);
    if (!allowed) {
      // Same generic response even when rate-limited — never reveal account
      // existence or rate-limit state to the caller.
      return res.status(200).json({ ok: true, message: GENERIC_MESSAGE });
    }

    const user = await db.collection("users").findOne({ email: email });

    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      await db.collection("passwordResets").insertOne({
        tokenHash: hashToken(token),
        userId: user._id,
        email: user.email,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
        used: false
      });

      const host = (req.headers && req.headers.host) || "magic-pen-one.vercel.app";
      const resetUrl = "https://" + host + "/?reset=" + token;

      // No outbound email service is configured yet — the site owner
      // retrieves this link from the server logs (`vercel logs`) and shares
      // it with whoever requested the reset. See the forgot-password UI
      // copy, which tells visitors to contact the site owner for now.
      console.log("[password reset] " + email + " -> " + resetUrl);
    }

    return res.status(200).json({ ok: true, message: GENERIC_MESSAGE });
  } catch (e) {
    console.error("[/api/auth/forgot-password]", e);
    return res.status(500).json({ error: "server_error", message: "Something went wrong — please try again." });
  }
};
