const { clearSessionCookie } = require("../_lib/auth.js");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method not allowed" });
  }
  try {
    clearSessionCookie(res);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("[/api/auth/logout]", e);
    return res.status(500).json({ error: "server_error" });
  }
};
