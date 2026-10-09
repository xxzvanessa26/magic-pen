const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const SESSION_COOKIE = "mp_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return secret;
}

function isLocalDev() {
  // `vercel dev` sets VERCEL_ENV to "development"; deployed envs are
  // "production" or "preview". Treat anything else as local too, so
  // cookies still work if this is ever run outside Vercel.
  return process.env.VERCEL_ENV !== "production" && process.env.VERCEL_ENV !== "preview";
}

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isAdminEmail(email) {
  const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  if (!adminEmail || !email) return false;
  return String(email).trim().toLowerCase() === adminEmail;
}

function isAdminSession(session) {
  return !!session && isAdminEmail(session.email);
}

async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

function signSession(user) {
  return jwt.sign({ uid: String(user._id), email: user.email }, getSecret(), {
    expiresIn: SESSION_MAX_AGE_SECONDS
  });
}

function verifySessionToken(token) {
  try {
    return jwt.verify(token, getSecret());
  } catch (e) {
    return null;
  }
}

function buildSetCookie(value, maxAgeSeconds) {
  const parts = [
    SESSION_COOKIE + "=" + encodeURIComponent(value),
    "Path=/",
    "Max-Age=" + maxAgeSeconds,
    "HttpOnly",
    "SameSite=Lax"
  ];
  if (!isLocalDev()) parts.push("Secure");
  return parts.join("; ");
}

function setSessionCookie(res, token) {
  res.setHeader("Set-Cookie", buildSetCookie(token, SESSION_MAX_AGE_SECONDS));
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", buildSetCookie("", 0));
}

function getSessionFromRequest(req) {
  const header = req.headers && req.headers.cookie;
  if (!header) return null;
  const pairs = header.split(";");
  for (let i = 0; i < pairs.length; i++) {
    const idx = pairs[i].indexOf("=");
    if (idx === -1) continue;
    const name = pairs[i].slice(0, idx).trim();
    if (name !== SESSION_COOKIE) continue;
    const token = decodeURIComponent(pairs[i].slice(idx + 1).trim());
    if (!token) return null;
    return verifySessionToken(token);
  }
  return null;
}

module.exports = {
  isValidEmail,
  isAdminEmail,
  isAdminSession,
  hashPassword,
  verifyPassword,
  signSession,
  setSessionCookie,
  clearSessionCookie,
  getSessionFromRequest
};
