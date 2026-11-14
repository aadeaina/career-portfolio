// Single Vercel function (keeps the Hobby plan's function count at 1).
// All /api/* requests are rewritten here by vercel.json with ?__route=<path>.
import { Redis } from "@upstash/redis";
import crypto from "node:crypto";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});
const SESSION_SECRET = process.env.SESSION_SECRET;
const CONTENT_KEY = process.env.CONTENT_KEY ? Buffer.from(process.env.CONTENT_KEY, "base64") : null;
const COOKIE = "pf_s";
const OWNER_HOURS = 12;
const MAX_LOG = 5000;

/* ---------- helpers ---------- */
const send = (res, status, body) => { res.status(status).setHeader("Cache-Control", "no-store"); return body === undefined ? res.end() : res.json(body); };
const b64u = (buf) => Buffer.from(buf).toString("base64url");

function sign(payload) {
  const body = b64u(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}
function verify(token) {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const want = crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  if (sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  const p = JSON.parse(Buffer.from(body, "base64url").toString());
  return p.exp > Date.now() ? p : null;
}
function setSession(res, payload) {
  const maxAge = Math.max(1, Math.floor((payload.exp - Date.now()) / 1000));
  res.setHeader("Set-Cookie", `${COOKIE}=${sign(payload)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`);
}
const clearSession = (res) => res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
function readCookie(req) {
  const m = (req.headers.cookie || "").match(new RegExp(`(?:^|; )${COOKIE}=([^;]+)`));
  return m ? m[1] : null;
}

// AES-256-GCM at rest for content and resume stored in Redis.
function seal(obj) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", CONTENT_KEY, iv);
  const ct = Buffer.concat([c.update(JSON.stringify(obj)), c.final()]);
  return `${iv.toString("base64")}.${ct.toString("base64")}.${c.getAuthTag().toString("base64")}`;
}
function open(sealed) {
  if (!sealed) return null;
  const [iv, ct, tag] = sealed.split(".").map((s) => Buffer.from(s, "base64"));
  const d = crypto.createDecipheriv("aes-256-gcm", CONTENT_KEY, iv);
  d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(ct), d.final()]).toString());
}

function checkPassword(pw) {
  const [alg, salt, hash] = (process.env.OWNER_PASSWORD_HASH || "").split("$");
  if (alg !== "scrypt" || !salt || !hash || typeof pw !== "string") return false;
  const got = crypto.scryptSync(pw, Buffer.from(salt, "base64"), 64);
  const want = Buffer.from(hash, "base64");
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

function parseUA(ua = "") {
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) && !/Chromium/.test(ua) ? "Chrome"
    : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : /bot|crawl|spider|preview|slack|whatsapp|facebookexternalhit/i.test(ua) ? "Bot / link preview" : "Other";
  const os = /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "Other";
  const device = /iPad|Tablet/.test(ua) ? "Tablet" : /Mobi|iPhone|Android/.test(ua) ? "Mobile" : "Desktop";
  return { browser, os, device };
}

async function log(req, ev, extra = {}) {
  const h = req.headers;
  const dec = (v) => { try { return v ? decodeURIComponent(v) : null; } catch { return v; } };
  const entry = {
    t: Date.now(), ev,
    ip: (h["x-forwarded-for"] || "").split(",")[0].trim() || h["x-real-ip"] || null,
    country: h["x-vercel-ip-country"] || null,
    region: h["x-vercel-ip-country-region"] || null,
    city: dec(h["x-vercel-ip-city"]),
    lat: h["x-vercel-ip-latitude"] || null, lon: h["x-vercel-ip-longitude"] || null,
    tz: h["x-vercel-ip-timezone"] || null,
    ua: h["user-agent"] || null, ...parseUA(h["user-agent"]),
    lang: (h["accept-language"] || "").split(",")[0] || null,
    ...extra,
  };
  await redis.lpush("visits", JSON.stringify(entry));
  await redis.ltrim("visits", 0, MAX_LOG - 1);
}

async function getSettings() {
  return { resumeDownload: true, ...((await redis.get("settings")) || {}) };
}

// Returns the session if valid; viewer sessions die when their invite is revoked.
async function session(req) {
  const s = verify(readCookie(req));
  if (!s) return null;
  if (s.r === "viewer") {
    const inv = await redis.get(`inv:${s.inv}`);
    if (!inv || inv.status === "revoked") return null;
    s.label = inv.label;
  }
  return s;
}

async function rateLimit(req, key, max, windowSec) {
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  const k = `rl:${key}:${ip}`;
  const n = await redis.incr(k);
  if (n === 1) await redis.expire(k, windowSec);
  return n <= max;
}

/* ---------- routes ---------- */
async function route(req, res, path) {
  const m = req.method;
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};

  if (path === "redeem" && m === "POST") {
    if (!(await rateLimit(req, "redeem", 20, 900))) return send(res, 429, { error: "Too many attempts" });
    const code = String(body.code || "");
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(code)) return send(res, 400, { error: "Invalid link" });
    const inv = await redis.get(`inv:${code}`);
    if (!inv) { await log(req, "invalid-invite", { inv: code.slice(0, 6) }); return send(res, 404, { error: "This link is not valid." }); }
    if (inv.status === "revoked") { await log(req, "revoked-invite", { inv: code, label: inv.label }); return send(res, 410, { error: "This link has been revoked." }); }
    // Atomic burn: only the first redeemer wins.
    const first = await redis.set(`inv:${code}:burned`, Date.now(), { nx: true });
    if (!first) { await log(req, "reused-invite", { inv: code, label: inv.label }); return send(res, 410, { error: "This one-time link has already been used." }); }
    const exp = Date.now() + inv.ttlHours * 3600_000;
    const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim();
    await redis.set(`inv:${code}`, { ...inv, status: "used", usedAt: Date.now(), usedIp: ip, expiresAt: exp, ...parseUA(req.headers["user-agent"]) });
    setSession(res, { r: "viewer", inv: code, exp });
    await log(req, "redeem", { inv: code, label: inv.label });
    return send(res, 200, { ok: true });
  }

  if (path === "me" && m === "GET") {
    const s = await session(req);
    if (!s) return send(res, 401, { error: "Not signed in" });
    return send(res, 200, { role: s.r, label: s.label || null, exp: s.exp, settings: await getSettings() });
  }

  if (path === "content" && m === "GET") {
    const s = await session(req);
    if (!s) return send(res, 401, { error: "Not signed in" });
    const content = open(await redis.get("content"));
    if (!content) return send(res, 503, { error: "Content not seeded yet" });
    if (s.r === "viewer") await log(req, "open", { inv: s.inv, label: s.label });
    return send(res, 200, { content, settings: await getSettings(), role: s.r });
  }

  if (path === "track" && m === "POST") {
    const s = await session(req);
    if (s?.r === "viewer") await log(req, "page", { inv: s.inv, label: s.label, page: String(body.page || "").slice(0, 60) });
    return send(res, 204);
  }

  if (path === "resume" && m === "GET") {
    const s = await session(req);
    if (!s) return send(res, 401, { error: "Not signed in" });
    const settings = await getSettings();
    if (s.r !== "owner" && !settings.resumeDownload) return send(res, 403, { error: "Resume download is turned off" });
    const r = open(await redis.get("resume"));
    if (!r) return send(res, 404, { error: "No resume uploaded" });
    if (s.r === "viewer") await log(req, "download", { inv: s.inv, label: s.label });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${(r.name || "resume.pdf").replace(/[^\w.\- ]/g, "")}"`);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(Buffer.from(r.data, "base64"));
  }

  if (path === "logout" && m === "POST") { clearSession(res); return send(res, 204); }

  /* ----- owner ----- */
  if (path === "admin/login" && m === "POST") {
    if (!(await rateLimit(req, "login", 8, 900))) { await log(req, "owner-login-blocked"); return send(res, 429, { error: "Too many attempts. Try again in 15 minutes." }); }
    if (!checkPassword(body.password)) { await log(req, "owner-login-failed"); return send(res, 401, { error: "Wrong password" }); }
    setSession(res, { r: "owner", exp: Date.now() + OWNER_HOURS * 3600_000 });
    await log(req, "owner-login");
    return send(res, 200, { ok: true });
  }

  if (path.startsWith("admin/")) {
    const s = await session(req);
    if (s?.r !== "owner") return send(res, 401, { error: "Owner sign-in required" });

    if (path === "admin/invites" && m === "GET") {
      const codes = await redis.zrange("invites", 0, -1, { rev: true });
      const list = codes.length ? await redis.mget(...codes.map((c) => `inv:${c}`)) : [];
      return send(res, 200, list.map((x, i) => x && { code: codes[i], ...x, expired: x.status === "used" && x.expiresAt < Date.now() }).filter(Boolean));
    }
    if (path === "admin/invites" && m === "POST") {
      const ttlHours = Math.min(24 * 90, Math.max(1, Number(body.ttlHours) || 24));
      const label = String(body.label || "Untitled").slice(0, 80);
      const code = b64u(crypto.randomBytes(18));
      await redis.set(`inv:${code}`, { label, ttlHours, created: Date.now(), status: "new" });
      await redis.zadd("invites", { score: Date.now(), member: code });
      return send(res, 201, { code, label, ttlHours });
    }
    if (path === "admin/invites/revoke" && m === "POST") {
      const inv = await redis.get(`inv:${body.code}`);
      if (!inv) return send(res, 404, { error: "Not found" });
      await redis.set(`inv:${body.code}`, { ...inv, status: "revoked", revokedAt: Date.now() });
      await redis.set(`inv:${body.code}:burned`, Date.now());
      return send(res, 200, { ok: true });
    }
    if (path === "admin/invites/delete" && m === "POST") {
      await redis.del(`inv:${body.code}`, `inv:${body.code}:burned`);
      await redis.zrem("invites", body.code);
      return send(res, 200, { ok: true });
    }
    if (path === "admin/visits" && m === "GET") {
      const rows = await redis.lrange("visits", 0, MAX_LOG - 1);
      return send(res, 200, rows.map((r) => (typeof r === "string" ? JSON.parse(r) : r)));
    }
    if (path === "admin/visits/clear" && m === "POST") { await redis.del("visits"); return send(res, 200, { ok: true }); }
    if (path === "admin/settings" && m === "GET") {
      const r = open(await redis.get("resume"));
      return send(res, 200, { settings: await getSettings(), resume: r ? { name: r.name, size: Math.round((r.data.length * 3) / 4), updated: r.updated } : null });
    }
    if (path === "admin/settings" && m === "PUT") {
      const next = { ...(await getSettings()), resumeDownload: !!body.resumeDownload };
      await redis.set("settings", next);
      return send(res, 200, { settings: next });
    }
    if (path === "admin/resume" && m === "PUT") {
      const data = String(body.data || "");
      const bytes = Buffer.from(data, "base64");
      if (bytes.length < 100 || bytes.subarray(0, 5).toString() !== "%PDF-") return send(res, 400, { error: "Please upload a PDF file" });
      if (bytes.length > 600_000) return send(res, 413, { error: "PDF must be under 600 KB" });
      await redis.set("resume", seal({ name: String(body.name || "resume.pdf").slice(0, 100), data, updated: Date.now() }));
      return send(res, 200, { ok: true, size: bytes.length });
    }
  }
  return send(res, 404, { error: "Not found" });
}

export default async function handler(req, res) {
  if (!SESSION_SECRET || !CONTENT_KEY) return send(res, 500, { error: "Server not configured" });
  const path = String(req.query.__route || "").replace(/^\/+|\/+$/g, "");
  try {
    return await route(req, res, path);
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: "Server error" });
  }
}
