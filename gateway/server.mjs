import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 8787);
const TOKEN_TTL_SECONDS = Number(process.env.TOKEN_TTL_SECONDS || 300);
const COOKIE_SECURE = process.env.COOKIE_SECURE !== "false";

const {
  TOKEN_SIGNING_KEY,
  PASSPHRASE_HASH,
  PROTECTED_ORIGIN,
  STRAPI_VERIFY_URL,
  STRAPI_VERIFY_TOKEN
} = process.env;

if (!TOKEN_SIGNING_KEY) {
  throw new Error("Missing TOKEN_SIGNING_KEY");
}

if (!PROTECTED_ORIGIN) {
  throw new Error("Missing PROTECTED_ORIGIN");
}

const originBase = new URL(PROTECTED_ORIGIN);

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (url.pathname === "/api/unlock" && req.method === "POST") {
      return await handleUnlock(req, res);
    }

    if (url.pathname.startsWith("/protected/")) {
      return await handleProtected(req, res, url);
    }

    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not Found");
  } catch (error) {
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Internal error" }));
  }
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`Gateway listening on ${HOST}:${PORT}\n`);
});

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
    res.writeHead(401, { "content-type": "text/plain" });
    res.end("Unauthorized");
    return;
  }

  const upstream = new URL(url.pathname + url.search, originBase);
  const upstreamRes = await fetch(upstream, {
    method: req.method,
    headers: filterHeaders(req.headers)
  });

  const bodyBuffer = Buffer.from(await upstreamRes.arrayBuffer());
  res.writeHead(upstreamRes.status, copySafeHeaders(upstreamRes.headers));
  res.end(bodyBuffer);
}

async function verifyPassphrase(passphrase) {
  if (STRAPI_VERIFY_URL) {
    const headers = { "content-type": "application/json" };
    if (STRAPI_VERIFY_TOKEN) {
      headers.authorization = `Bearer ${STRAPI_VERIFY_TOKEN}`;
    }

    const response = await fetch(STRAPI_VERIFY_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ passphrase })
    });

    return response.ok;
  }

  if (!PASSPHRASE_HASH) {
    return false;
  }

  const hash = sha256Base64Url(passphrase);
  return safeEqual(hash, PASSPHRASE_HASH);
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
  return `access_token=${token}; Path=/; HttpOnly${secureFlag}; SameSite=Lax; Max-Age=${maxAge}`;
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
