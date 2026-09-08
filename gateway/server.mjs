import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { mkdirSync, realpathSync } from "node:fs";
import { createServer } from "node:http";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { JSONFilePreset } from "lowdb/node";

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 8787);
const TOKEN_TTL_SECONDS = Number(process.env.TOKEN_TTL_SECONDS || 300);
const COOKIE_SECURE = process.env.COOKIE_SECURE !== "false";
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || "";
const GUESTBOOK_DB_PATH = process.env.GUESTBOOK_DB_PATH || "./data/guestbook.json";
const GUESTBOOK_NAME_MAX_LENGTH = 40;
const GUESTBOOK_MESSAGE_MAX_LENGTH = 280;
const GUESTBOOK_MAX_ENTRIES = 500;

const {
  TOKEN_SIGNING_KEY,
  PASSPHRASE_HASH,
  PASSPHRASE_WORDLIST,
  PROTECTED_ORIGIN,
  STRAPI_VERIFY_URL,
  STRAPI_VERIFY_TOKEN
} = process.env;

const originBase = PROTECTED_ORIGIN ? new URL(PROTECTED_ORIGIN) : null;

const guestbookDbReady = initGuestbookDb();

async function initGuestbookDb() {
  mkdirSync(dirname(GUESTBOOK_DB_PATH), { recursive: true });
  return JSONFilePreset(GUESTBOOK_DB_PATH, {
    entries: [
      { name: "lerz", message: "musut ens vuonna 10v", date: "2026-09-08" },
    ]
  });
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (url.pathname === "/api/unlock" && req.method === "POST") {
      return await handleUnlock(req, res);
    }

    if (url.pathname === "/api/guestbook" && req.method === "GET") {
      return await handleGuestbookList(req, res);
    }

    if (url.pathname === "/api/guestbook" && req.method === "POST") {
      return await handleGuestbookCreate(req, res);
    }

    if (url.pathname.startsWith("/protected/")) {
      return await handleProtected(req, res, url);
    }

    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not Found");
  } catch (error) {
    console.error("Request handling failed:", error);
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Internal error" }));
  }
});

const isDirectRun = (() => {
  if (!process.argv[1]) {
    return false;
  }

  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
})();

if (isDirectRun) {
  if (!TOKEN_SIGNING_KEY) {
    throw new Error("Missing TOKEN_SIGNING_KEY");
  }

  if (!PROTECTED_ORIGIN) {
    throw new Error("Missing PROTECTED_ORIGIN");
  }

  server.listen(PORT, HOST, () => {
    process.stdout.write(`Gateway listening on ${HOST}:${PORT}\n`);
  });
}

async function handleUnlock(req, res) {
  const bodyText = await readBody(req);
  const payload = JSON.parse(bodyText || "{}");
  const passphrase = String(payload.passphrase || "");

  const valid = await verifyPassphrase(passphrase);
  if (!valid) {
    res.writeHead(401, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false }));
    return;
  }

  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const tokenPayload = `exp=${expiresAt}`;
  const signature = sign(tokenPayload);
  const token = `${tokenPayload}.${signature}`;

  res.writeHead(200, {
    "content-type": "application/json",
    "set-cookie": buildCookie(token)
  });
  res.end(JSON.stringify({ ok: true, expiresAt }));
}

async function handleProtected(req, res, url) {
  const token = readCookie(req.headers.cookie, "access_token");
  if (!token || !verifyToken(token)) {
    res.writeHead(302, { location: "/" });
    res.end();
    return;
  }

  const upstream = new URL(url.pathname + url.search, originBase);
  let upstreamRes;
  try {
    upstreamRes = await fetch(upstream, {
      method: req.method,
      headers: filterHeaders(req.headers)
    });
  } catch (error) {
    console.error("Protected upstream request failed:", upstream.href, error);
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Protected upstream unavailable" }));
    return;
  }

  const bodyBuffer = Buffer.from(await upstreamRes.arrayBuffer());
  res.writeHead(upstreamRes.status, copySafeHeaders(upstreamRes.headers));
  res.end(bodyBuffer);
}

function hasValidSession(req) {
  const token = readCookie(req.headers.cookie, "access_token");
  return Boolean(token && verifyToken(token));
}

export function sanitizeGuestbookEntry(payload) {
  const name = String(payload?.name ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim();
  const message = String(payload?.message ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim();

  if (!name || !message) {
    return null;
  }

  if (name.length > GUESTBOOK_NAME_MAX_LENGTH || message.length > GUESTBOOK_MESSAGE_MAX_LENGTH) {
    return null;
  }

  return { name, message };
}

async function handleGuestbookList(req, res) {
  if (!hasValidSession(req)) {
    res.writeHead(401, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }

  const db = await guestbookDbReady;
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ entries: db.data.entries }));
}

async function handleGuestbookCreate(req, res) {
  if (!hasValidSession(req)) {
    res.writeHead(401, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }

  let payload;
  try {
    payload = JSON.parse((await readBody(req)) || "{}");
  } catch {
    res.writeHead(400, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid JSON" }));
    return;
  }

  const sanitized = sanitizeGuestbookEntry(payload);
  if (!sanitized) {
    res.writeHead(400, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid entry" }));
    return;
  }

  const entry = { ...sanitized, date: new Date().toISOString().slice(0, 10) };

  const db = await guestbookDbReady;
  db.data.entries.push(entry);
  if (db.data.entries.length > GUESTBOOK_MAX_ENTRIES) {
    db.data.entries = db.data.entries.slice(-GUESTBOOK_MAX_ENTRIES);
  }
  await db.write();

  res.writeHead(201, { "content-type": "application/json" });
  res.end(JSON.stringify({ entry }));
}

export function parsePassphraseWordList(wordListValue) {
  if (!wordListValue) {
    return [];
  }

  return Array.from(new Set(
    String(wordListValue)
      .split(/[\n,]+/)
      .map((word) => word.trim().toLowerCase())
      .filter(Boolean)
  ));
}

export async function verifyPassphrase(passphrase, env = process.env) {
  const normalizedPassphrase = String(passphrase || "").trim();
  const {
    STRAPI_VERIFY_URL: strapiVerifyUrl,
    STRAPI_VERIFY_TOKEN: strapiVerifyToken,
    PASSPHRASE_HASH: passphraseHash,
    PASSPHRASE_WORDLIST: passphraseWordList
  } = env;

  if (strapiVerifyUrl) {
    const headers = { "content-type": "application/json" };
    if (strapiVerifyToken) {
      headers.authorization = `Bearer ${strapiVerifyToken}`;
    }

    const response = await fetch(strapiVerifyUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ passphrase: normalizedPassphrase })
    });

    return response.ok;
  }

  const allowedWords = parsePassphraseWordList(passphraseWordList);
  if (allowedWords.length > 0) {
    return allowedWords.includes(normalizedPassphrase.toLowerCase());
  }

  if (!passphraseHash) {
    return false;
  }

  const hash = sha256Base64Url(normalizedPassphrase);
  return safeEqual(hash, passphraseHash);
}

function verifyToken(token) {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return false;
  }

  const expected = sign(payload);
  if (!safeEqual(signature, expected)) {
    return false;
  }

  const expStr = payload.split("=")[1];
  const exp = Number(expStr);
  return Number.isFinite(exp) && Math.floor(Date.now() / 1000) < exp;
}

function sign(value) {
  return createHmac("sha256", TOKEN_SIGNING_KEY)
    .update(value)
    .digest("base64url");
}

function sha256Base64Url(value) {
  return createHash("sha256").update(value).digest("base64url");
}

function safeEqual(a, b) {
  const aBuf = Buffer.from(a || "");
  const bBuf = Buffer.from(b || "");

  if (aBuf.length !== bBuf.length) {
    return false;
  }

  return timingSafeEqual(aBuf, bBuf);
}

function buildCookie(token) {
  const maxAge = TOKEN_TTL_SECONDS;
  const secureFlag = COOKIE_SECURE ? "; Secure" : "";
  const domainFlag = COOKIE_DOMAIN ? `; Domain=${COOKIE_DOMAIN}` : "";
  return `access_token=${token}; Path=/${domainFlag}; HttpOnly${secureFlag}; SameSite=Lax; Max-Age=${maxAge}`;
}

function readCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const prefix = `${name}=`;
  const pairs = cookieHeader.split(";").map((entry) => entry.trim());
  const match = pairs.find((entry) => entry.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

function filterHeaders(incomingHeaders) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(incomingHeaders)) {
    if (!value) continue;
    const lowered = key.toLowerCase();
    if (lowered === "host" || lowered === "cookie" || lowered === "content-length") {
      continue;
    }
    headers.set(key, Array.isArray(value) ? value.join(",") : value);
  }
  return headers;
}

function copySafeHeaders(upstreamHeaders) {
  const out = {};
  for (const [key, value] of upstreamHeaders.entries()) {
    const lowered = key.toLowerCase();
    if (lowered === "set-cookie" || lowered === "transfer-encoding" || lowered === "connection") {
      continue;
    }
    out[key] = value;
  }
  return out;
}

async function readBody(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
  }
  return body;
}

process.on("unhandledRejection", (error) => {
  console.error("Unhandled rejection:", error);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
});
