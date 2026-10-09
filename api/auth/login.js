const { getDb } = require("../_lib/db.js");
const { isValidEmail, verifyPassword, signSession, setSessionCookie, isAdminEmail } = require("../_lib/auth.js");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method not allowed" });
  }

  try {
    const body = req.body || {};
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!isValidEmail(email) || !password) {
      return res.status(400).json({ error: "invalid_input", message: "Please enter your email and password." });
    }

    const db = await getDb();
    const users = db.collection("users");
    const user = await users.findOne({ email: email });

    // Same generic message whether the email or the password was wrong —
    // don't tell an attacker which part failed.
    const genericError = { error: "invalid_credentials", message: "That email and password don't match." };

    if (!user) return res.status(401).json(genericError);

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return res.status(401).json(genericError);

    const token = signSession(user);
    setSessionCookie(res, token);

    return res.status(200).json({
      user: { id: String(user._id), email: user.email, name: user.name || "", isAdmin: isAdminEmail(user.email) }
    });
  } catch (e) {
    console.error("[/api/auth/login]", e);
    return res.status(500).json({ error: "server_error", message: "Something went wrong — please try again." });
  }
};
