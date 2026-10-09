const { getDb } = require("../_lib/db.js");
const { isValidEmail, hashPassword, signSession, setSessionCookie } = require("../_lib/auth.js");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method not allowed" });
  }

  try {
    const body = req.body || {};
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "invalid_email", message: "Please enter a valid email address." });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "weak_password", message: "Password must be at least 8 characters." });
    }

    const db = await getDb();
    const users = db.collection("users");

    const existing = await users.findOne({ email: email });
    if (existing) {
      return res.status(409).json({ error: "email_taken", message: "An account with that email already exists." });
    }

    const passwordHash = await hashPassword(password);
    const doc = { email: email, passwordHash: passwordHash, name: name, createdAt: new Date() };
    const result = await users.insertOne(doc);
    const user = { _id: result.insertedId, email: email };

    const token = signSession(user);
    setSessionCookie(res, token);

    return res.status(201).json({ user: { id: String(result.insertedId), email: email, name: name } });
  } catch (e) {
    if (e && e.code === 11000) {
      return res.status(409).json({ error: "email_taken", message: "An account with that email already exists." });
    }
    console.error("[/api/auth/signup]", e);
    return res.status(500).json({ error: "server_error", message: "Something went wrong — please try again." });
  }
};
