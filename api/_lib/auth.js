const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookie = require("cookie");

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

function setSessionCookie(res, token) {
  const serialized = cookie.stringifySetCookie({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: !isLocalDev(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS
  });
  res.setHeader("Set-Cookie", serialized);
}

function clearSessionCookie(res) {
  const serialized = cookie.stringifySetCookie({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: !isLocalDev(),
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
  res.setHeader("Set-Cookie", serialized);
}

function getSessionFromRequest(req) {
  const header = req.headers && req.headers.cookie;
  if (!header) return null;
  const parsed = cookie.parseCookie(header);
  const token = parsed[SESSION_COOKIE];
  if (!token) return null;
  return verifySessionToken(token);
}

module.exports = {
  isValidEmail,
  hashPassword,
  verifyPassword,
  signSession,
  setSessionCookie,
  clearSessionCookie,
  getSessionFromRequest
};
