import express from "express";
import compression from "compression";
import cors from "cors";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { promises as fsp } from "node:fs";
import { createServer, request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { join, dirname, resolve as pathResolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import axios from "axios";

console.log("Initializing application...");
console.log("Node version:", process.version);
console.log("Platform:", process.platform);

// Load .env manual jika ada (pengganti dotenv)
try {
  const envPath = join(dirname(fileURLToPath(import.meta.url)), ".env");
  if (existsSync(envPath)) {
    console.log("Loading .env file from:", envPath);
    const envConfig = readFileSync(envPath, "utf8");
    envConfig.split(/\r?\n/).forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match && !line.trim().startsWith("#")) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["'](.*)["']$/, "$1");
        if (!process.env[key]) process.env[key] = value;
      }
    });
    console.log("Environment variables loaded.");
  } else {
    console.log("No .env file found at:", envPath);
  }
} catch (e) {
  console.error("Error loading .env:", e);
}

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import { nanoid } from "nanoid";
import { Server as SocketIOServer } from "socket.io";
import {
  upsertGoogleUser,
  recordConversionForUser,
  listUserHistory,
  getHistoryEntry,
  updateHistoryEntry,
  buildUserSummaryById,
  ensureReferralForUser,
  getUserById,
  revokeUserSession,
  claimCheatForUser,
  recordXpEventForUser,
} from "./user_store.js";
import {
  recordSaweriaSupportEvent,
  listSupportLeaderboard,
  listRecentSupports,
} from "./support_store.js";
import { CacheStore } from "./lib/cache_store.js";
// Tambahan untuk ffmpeg portable (opsional)
let ffmpegPath = null;
try {
  ffmpegPath = (await import("ffmpeg-static")).default;
} catch {
  ffmpegPath = null;
}

let ffprobePath = null;
try {
  ffprobePath = (await import("ffprobe-static")).path;
} catch {
  ffprobePath = null;
}

let nodemailer = null;
try {
  const nodemailerMod = await import("nodemailer");
  nodemailer = nodemailerMod?.default || nodemailerMod;
} catch {
  nodemailer = null;
}

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const isGoogleLoginConfigured = Boolean(GOOGLE_CLIENT_ID);
const USER_SESSION_SECRET = process.env.USER_SESSION_SECRET || "dev-user-session-secret";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const CHEATS_ENABLED = /^(1|true|yes|on)$/i.test(String(process.env.ENABLE_CHEATS || ""));
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || "";
const TURNSTILE_SITE_KEY = process.env.TURNSTILE_SITE_KEY || "";
const TURNSTILE_STRICT = /^(1|true|yes|on)$/i.test(String(process.env.TURNSTILE_STRICT || ""));
const isTurnstileConfigured = Boolean(TURNSTILE_SECRET_KEY && TURNSTILE_SITE_KEY);
const YOUTUBE_API_KEY = (process.env.YOUTUBE_API_KEY || "").trim();
const isYoutubeApiConfigured = Boolean(YOUTUBE_API_KEY);
const GROQ_API_KEY = [
  process.env.GROQ_API_KEY,
  process.env.GROQ_APIKEY,
  process.env.GROQ_KEY,
  process.env.GROK_API_KEY,
  process.env.AI_GROQ_API_KEY,
].map((value) => String(value || "").trim()).find(Boolean) || "";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const isGroqConfigured = Boolean(GROQ_API_KEY);
const COOKIES_PATH = join(process.cwd(), "cookies.txt");
const SAWERIA_STREAM_KEY = (process.env.SAWERIA_STREAM_KEY || "").trim();

const SPOTIFY_CLIENT_ID = (process.env.SPOTIFY_CLIENT_ID || "").trim();
const SPOTIFY_CLIENT_SECRET = (process.env.SPOTIFY_CLIENT_SECRET || "").trim();
const isSpotifyConfigured = Boolean(SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET);
let spotifyTokenCache = { token: "", expiresAt: 0 };

const base64Url = (value) => Buffer.from(value).toString("base64url");
const parseBase64Json = (value) => {
  try {
    const json = Buffer.from(value, "base64url").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
};

const createSessionToken = (userId) => {
  const payload = {
    userId,
    iat: Date.now(),
    exp: Date.now() + SESSION_TTL_MS,
  };
  const payloadEncoded = base64Url(JSON.stringify(payload));
  const signature = createHmac("sha256", USER_SESSION_SECRET)
    .update(payloadEncoded)
    .digest("base64url");
  return `${payloadEncoded}.${signature}`;
};

const verifySessionToken = (token) => {
  if (!token || typeof token !== "string") return null;
  const [payloadEncoded, signature] = token.split(".");
  if (!payloadEncoded || !signature) return null;
  const expected = createHmac("sha256", USER_SESSION_SECRET)
    .update(payloadEncoded)
    .digest("base64url");
  const sigBuf = Buffer.from(signature, "base64url");
  const expectedBuf = Buffer.from(expected, "base64url");
  if (sigBuf.length !== expectedBuf.length) return null;
  try {
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null;
  } catch {
    return null;
  }
  const payload = parseBase64Json(payloadEncoded);
  if (!payload || !payload.userId) return null;
  if (payload.exp && payload.exp < Date.now()) return null;
  return payload;
};

const QR_LOGIN_TTL_MS = Number(process.env.QR_LOGIN_TTL_MS || 1000 * 60 * 5);
const qrLoginTokens = new Map();

const issueQrLoginToken = (userId) => {
  const token = nanoid(32);
  const now = Date.now();
  const entry = {
    token,
    userId,
    createdAt: now,
    expiresAt: now + QR_LOGIN_TTL_MS,
    usedAt: null,
  };
  qrLoginTokens.set(token, entry);
  return entry;
};

const consumeQrLoginToken = (token) => {
  if (!token) return { error: "Token kosong", status: 400 };
  const entry = qrLoginTokens.get(token);
  if (!entry) return { error: "QR tidak valid atau sudah kedaluwarsa", status: 404 };
  if (entry.usedAt) return { error: "QR sudah dipakai", status: 409 };
  if (entry.expiresAt < Date.now()) {
    qrLoginTokens.delete(token);
    return { error: "QR sudah kedaluwarsa", status: 410 };
  }
  entry.usedAt = Date.now();
  qrLoginTokens.delete(token);
  return { entry };
};

setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of qrLoginTokens.entries()) {
    if (!entry || entry.expiresAt < now || entry.usedAt) {
      qrLoginTokens.delete(token);
    }
  }
}, 1000 * 60).unref?.();

const getBearerTokenFromRequest = (req) => {
  const header = req.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
};

const resolveRequestUser = async (req) => {
  if (typeof req._resolvedUser !== "undefined") return req._resolvedUser;
  const token = getBearerTokenFromRequest(req);
  if (!token) {
    req._resolvedUser = null;
    return null;
  }
  const payload = verifySessionToken(token);
  if (!payload?.userId) {
    req._resolvedUser = null;
    return null;
  }
  const user = await getUserById(payload.userId);
  if (!user) {
    req._resolvedUser = null;
    return null;
  }
  req._resolvedUser = user;
  req._resolvedSession = { token, payload };
  return user;
};

const requireUserSession = async (req, res) => {
  const user = await resolveRequestUser(req);
  if (!user) {
    res.status(401).json({ error: "Butuh login" });
    return null;
  }
  return user;
};

const normalizeHeaderInit = (input) => {
  if (!input) return {};
  if (Array.isArray(input)) {
    return input.reduce((acc, [key, value]) => {
      if (key) acc[String(key).toLowerCase()] = String(value);
      return acc;
    }, {});
  }
  if (typeof input?.forEach === "function" && typeof input?.entries === "function") {
    const acc = {};
    input.forEach((value, key) => {
      if (key != null && value != null) acc[String(key).toLowerCase()] = String(value);
    });
    return acc;
  }
  if (typeof input === "object") {
    return Object.entries(input).reduce((acc, [key, value]) => {
      if (key != null && value != null) acc[String(key).toLowerCase()] = String(value);
      return acc;
    }, {});
  }
  return {};
};

const createResponseObject = (urlStr, statusCode, statusMessage, headersObj, bodyBuffer) => {
  const headerMap = new Map();
  for (const [key, value] of Object.entries(headersObj || {})) {
    if (Array.isArray(value)) {
      headerMap.set(String(key).toLowerCase(), value.join(", "));
    } else if (value != null) {
      headerMap.set(String(key).toLowerCase(), String(value));
    }
  }
  const baseBuffer = Buffer.from(bodyBuffer || Buffer.alloc(0));
  const arrayBuf = baseBuffer.buffer.slice(
    baseBuffer.byteOffset,
    baseBuffer.byteOffset + baseBuffer.byteLength,
  );
  const textCache = baseBuffer.toString("utf8");

  return {
    ok: statusCode >= 200 && statusCode < 300,
    status: statusCode || 0,
    statusText: statusMessage || "",
    url: urlStr,
    headers: {
      get: (name) => headerMap.get(String(name).toLowerCase()) ?? null,
      has: (name) => headerMap.has(String(name).toLowerCase()),
      entries: () => headerMap.entries(),
    },
    text: async () => textCache,
    json: async () => {
      if (!textCache) return null;
      try {
        return JSON.parse(textCache);
      } catch (err) {
        const parseErr = new Error("Response JSON tidak valid");
        parseErr.cause = err;
        throw parseErr;
      }
    },
    arrayBuffer: async () => arrayBuf,
    clone: () => createResponseObject(urlStr, statusCode, statusMessage, headersObj, Buffer.from(baseBuffer)),
  };
};

const getSpotifyAccessToken = async () => {
  if (spotifyTokenCache.token && Date.now() < spotifyTokenCache.expiresAt) {
    return spotifyTokenCache.token;
  }
  if (!isSpotifyConfigured) {
    throw new Error("Spotify credentials belum dikonfigurasi");
  }
  const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64");
  const response = await safeFetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0",
    },
    body: "grant_type=client_credentials",
  });
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("Retry-After") || 5);
    await new Promise((r) => setTimeout(r, (retryAfter + 1) * 1000));
    return getSpotifyAccessToken();
  }
  if (!response.ok) {
    throw new Error(`Spotify auth gagal (status ${response.status})`);
  }
  const payload = await response.json().catch(() => null);
  if (!payload?.access_token || !payload?.expires_in) {
    throw new Error("Spotify auth response tidak valid");
  }
  spotifyTokenCache = {
    token: payload.access_token,
    expiresAt: Date.now() + (Number(payload.expires_in) - 60) * 1000,
  };
  return spotifyTokenCache.token;
};

const spotifyApiGet = async (url) => {
  const token = await getSpotifyAccessToken();
  const response = await safeFetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0",
      Referer: "https://open.spotify.com/",
      Origin: "https://open.spotify.com",
    },
  });
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("Retry-After") || 5);
    await new Promise((r) => setTimeout(r, (retryAfter + 1) * 1000));
    return spotifyApiGet(url);
  }
  if (!response.ok) {
    throw new Error(`Spotify API gagal (status ${response.status})`);
  }
  return response.json().catch(() => null);
};

const parseSpotifyPlaylistId = (input) => {
  const raw = String(input || "").trim();
  if (!raw) return "";
  const direct = /spotify:playlist:([0-9A-Za-z]{22})/i.exec(raw);
  if (direct) return direct[1];
  try {
    const u = new URL(raw);
    if (u.host === "open.spotify.com" || u.host === "play.spotify.com") {
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0]?.startsWith("intl-")) parts.shift();
      if (parts[0] === "embed") parts.shift();
      const idx = parts.findIndex((p) => p.toLowerCase() === "playlist");
      const candidate = idx >= 0 ? parts[idx + 1] : "";
      if (candidate && /^[0-9A-Za-z]{22}$/.test(candidate)) return candidate;
    }
  } catch { }
  if (/^[0-9A-Za-z]{22}$/.test(raw)) return raw;
  return "";
};

const fetchSpotifyTrendingTracks = async ({ limit = 6, playlistId } = {}) => {
  const fallbackPlaylistId = "37i9dQZF1DX2L0iB23Enbq";
  const envPlaylist = parseSpotifyPlaylistId(process.env.TRENDING_SPOTIFY_PLAYLIST_URL) ||
    parseSpotifyPlaylistId(process.env.TRENDING_SPOTIFY_PLAYLIST_ID);
  const resolvedPlaylistId = parseSpotifyPlaylistId(playlistId) || envPlaylist || fallbackPlaylistId;
  const safeLimit = Math.max(1, Math.min(12, Number(limit) || 6));

  // Use the exact format requested by the user, stripping out any potentially failing query params like market
  const url = `https://api.spotify.com/v1/playlists/${resolvedPlaylistId}/tracks?limit=${safeLimit}`;
  const payload = await spotifyApiGet(url);
  const rows = Array.isArray(payload?.items) ? payload.items : [];
  const items = [];
  for (const row of rows) {
    const track = row?.track;
    if (!track?.name) continue;
    const artists = Array.isArray(track.artists) ? track.artists.map((a) => a?.name).filter(Boolean) : [];
    const artist = artists.join(", ");
    const images = Array.isArray(track.album?.images) ? track.album.images : [];
    const cover = images[0]?.url || "";
    const spotifyUrl = track.external_urls?.spotify || (track.id ? `https://open.spotify.com/track/${track.id}` : "");
    items.push({
      title: String(track.name),
      artist: String(artist || ""),
      spotifyUrl,
      spotifyCover: cover,
    });
    if (items.length >= safeLimit) break;
  }
  return items;
};

const verifyGoogleIdToken = async (credential) => {
  if (!isGoogleLoginConfigured) {
    throw new Error("Login Google belum dikonfigurasi");
  }
  const token = typeof credential === "string" ? credential.trim() : "";
  if (!token) {
    throw new Error("Token Google tidak valid");
  }

  const url = new URL("https://oauth2.googleapis.com/tokeninfo");
  url.searchParams.set("id_token", token);

  try {
    const response = await safeFetch(url.toString(), {
      headers: { "User-Agent": "youtubemp3/1.0" },
    });
    if (!response.ok) {
      const details = await response.text().catch(() => "");
      const err = new Error("Token Google tidak valid");
      err.details = details;
      throw err;
    }
    const payload = await response.json().catch(() => null);
    if (!payload?.sub || payload.aud !== GOOGLE_CLIENT_ID) {
      throw new Error("Token Google tidak valid");
    }
    return payload;
  } catch (err) {
    if (err?.message === "Token Google tidak valid") throw err;
    const wrapped = new Error("Validasi token Google gagal");
    wrapped.cause = err;
    throw wrapped;
  }
};

const createFetchFallback = () => {
  const fetchFallback = (input, init = {}, redirectCount = 0) => new Promise((resolve, reject) => {
    try {
      const target = input instanceof URL ? input : new URL(String(input));
      const method = (init.method || "GET").toUpperCase();
      const headers = normalizeHeaderInit(init.headers);
      if (!headers["accept-encoding"]) headers["accept-encoding"] = "identity";

      const requestFn = target.protocol === "http:" ? httpRequest
        : target.protocol === "https:" ? httpsRequest
          : null;
      if (!requestFn) {
        reject(new Error(`Protocol tidak didukung: ${target.protocol}`));
        return;
      }

      let settled = false;
      const settle = (handler) => {
        if (settled) return;
        settled = true;
        if (abortHandler && init.signal) {
          init.signal.removeEventListener("abort", abortHandler);
        }
        handler();
      };

      let abortHandler;
      const req = requestFn({
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || (target.protocol === "http:" ? 80 : 443),
        path: `${target.pathname}${target.search}` || "/",
        method,
        headers,
      }, (res) => {
        const statusCode = res.statusCode || 0;
        const statusMessage = res.statusMessage || "";
        const location = res.headers?.location;
        if (location && [301, 302, 303, 307, 308].includes(statusCode) && init.redirect !== "manual" && redirectCount < 5) {
          const nextUrl = new URL(location, target);
          res.resume();
          settle(() => resolve(fetchFallback(nextUrl, init, redirectCount + 1)));
          return;
        }

        const chunks = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => {
          const body = Buffer.concat(chunks);
          settle(() => resolve(createResponseObject(target.toString(), statusCode, statusMessage, res.headers, body)));
        });
        res.on("error", (err) => settle(() => reject(err)));
      });

      req.on("error", (err) => settle(() => reject(err)));

      if (init.signal) {
        abortHandler = () => {
          req.destroy(new Error("aborted"));
          const abortErr = new Error("The operation was aborted");
          abortErr.name = "AbortError";
          settle(() => reject(abortErr));
        };
        if (init.signal.aborted) {
          abortHandler();
          return;
        }
        init.signal.addEventListener("abort", abortHandler, { once: true });
      }

      if (init.body) {
        if (Buffer.isBuffer(init.body)) {
          req.write(init.body);
        } else if (init.body instanceof ArrayBuffer) {
          req.write(Buffer.from(init.body));
        } else if (typeof init.body === "string") {
          req.write(init.body);
        } else {
          req.write(JSON.stringify(init.body));
        }
      }

      req.end();
    } catch (err) {
      reject(err);
    }
  });

  return fetchFallback;
};

let fetchImpl = globalThis.fetch;
if (!fetchImpl) {
  try {
    fetchImpl = (await import("node-fetch")).default;
  } catch {
    fetchImpl = createFetchFallback();
  }
}

const normalizeBaseUrl = (input) => {
  if (!input) return null;
  const trimmed = String(input).trim();
  if (!trimmed) return null;
  try {
    const candidate = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
    const url = new URL(candidate);
    if (!/^https?:$/i.test(url.protocol)) return null;
    if (!url.pathname) url.pathname = "/";
    return url.toString();
  } catch {
    return null;
  }
};

const inferKoyebBaseUrl = () => {
  const directCandidates = [
    process.env.KOYEB_URL,
    process.env.KOYEB_APP_URL,
    process.env.KOYEB_SERVICE_URL,
  ];
  for (const candidate of directCandidates) {
    const normalized = normalizeBaseUrl(candidate);
    if (normalized) return normalized;
  }

  const hostCandidates = [
    process.env.KOYEB_APP_HOSTNAME,
    process.env.KOYEB_SERVICE_HOSTNAME,
  ];
  for (const host of hostCandidates) {
    const normalized = normalizeBaseUrl(host);
    if (normalized) return normalized;
  }

  const fallbackName = process.env.KOYEB_APP_NAME || process.env.KOYEB_SERVICE_NAME;
  if (fallbackName) {
    const normalized = normalizeBaseUrl(`${fallbackName}.koyeb.app`);
    if (normalized) return normalized;
  }

  return null;
};

const inferRailwayBaseUrl = () => {
  const directCandidates = [
    process.env.RAILWAY_STATIC_URL,
    process.env.RAILWAY_PUBLIC_DOMAIN,
    process.env.RAILWAY_URL,
  ];
  for (const candidate of directCandidates) {
    const normalized = normalizeBaseUrl(candidate);
    if (normalized) return normalized;
  }

  const hostCandidates = [
    process.env.RAILWAY_PRIVATE_DOMAIN,
    process.env.RAILWAY_PROJECT_DOMAIN,
  ];
  for (const host of hostCandidates) {
    const normalized = normalizeBaseUrl(host);
    if (normalized) return normalized;
  }

  const fallbackName =
    process.env.RAILWAY_SERVICE_NAME ||
    process.env.RAILWAY_PROJECT_NAME ||
    process.env.RAILWAY_APP_NAME;
  if (fallbackName) {
    const normalized = normalizeBaseUrl(`${fallbackName}.up.railway.app`);
    if (normalized) return normalized;
  }

  return null;
};

const DEFAULT_PUBLIC_BASE_URL =
  inferKoyebBaseUrl() || inferRailwayBaseUrl();

const safeFetch = async (...args) => {
  if (!fetchImpl) {
    throw new Error("fetch API tidak tersedia di lingkungan ini");
  }
  return fetchImpl(...args);
};

const callGroqAPI = async (prompt, context = {}) => {
  if (!isGroqConfigured) {
    throw new Error("Groq API tidak dikonfigurasi");
  }

  const history = Array.isArray(context.history) ? context.history : [];

  const systemPrompt = `Anda adalah **AI Audio Mentor & Coach + Customer Service Navigator** profesional di platform **YTConv** (YouTube to MP3).
Tugas Anda adalah membimbing user, mendiagnosa masalah, dan menjelaskan konsep audio dengan adaptif.

**1. Level Penjelasan (Adaptive Communication):**
Deteksi tingkat pemahaman user dan sesuaikan bahasa:
- **Awam**: Gunakan analogi sehari-hari. Contoh: "Bitrate 320kbps itu ibarat video 4K, jernih banget."
- **Semi-Teknis**: Fokus pada fungsi dan efisiensi. Contoh: "FLAC lossless bagus untuk arsip, tapi MP3 320kbps lebih hemat size dengan kualitas mirip."
- **Profesional**: Gunakan istilah teknis (frequency response, dynamic range, LUFS, spectrum). Contoh: "Normalisasi ke -14 LUFS standar streaming untuk headroom yang aman."

**2. Diagnosa Error Multi-Layer:**
Analisis keluhan user berdasarkan:
- **Logs/Error Msg**: Jika user paste error, bedah penyebabnya (Network? Cookie? Parsing?).
- **Metadata**: Cek jika ID3 tags menyebabkan korup.
- **Settings**: Apakah user memaksa 320kbps di sumber low-quality? (Upscaling artifact).
- *Kesimpulan*: Berikan solusi paling logis, bukan tebakan acak.

**3. Fitur Sistem (Context Awareness):**
Pahami fitur aktif saat ini:
- **Core**: Convert (MP3/M4A/FLAC), Trim, Metadata Editor.
- **Advanced**: Audio Insight (Waveform/LUFS/Peak), Duplicate Detector (Cache System), Volume Boost.
- **System**: Cloudflare Turnstile (Security), Mobile Responsive UI.

**4. Gaya Bicara (Conversational UI):**
- **Nyambung**: Ingat konteks chat sebelumnya. Jangan lupa apa yang baru dibahas.
- **Konsisten**: Jangan berubah pendapat dalam satu sesi kecuali ada data baru.
- **Humanis**: Sapa user, gunakan emoji yang relevan, jangan kaku.

- Gunakan bahasa yang sama dengan user. Jika user memakai bahasa campuran/daerah, tetap tanggapi dengan sopan dan mudah dipahami.
- Pahami pertanyaan dalam berbagai bahasa (Indonesia, Inggris, Melayu, Jawa informal, dll) lalu jawab dalam bahasa user.
- Jika user terlihat bingung, tampilkan alur jelas dalam format langkah 1-2-3.

**Format Output (JSON Only jika Action diperlukan):**
Jika user ingin melakukan aksi (convert, setting), kembalikan JSON:
{ "reply": "Siap, saya atur bitrate ke 320kbps...", "action": "convert", "params": { "quality": "320kbps" } }

Jika percakapan biasa/edukasi/diagnosa:
{ "reply": "**Jawaban Anda disini...** gunakan Markdown untuk formatting." }

**Rules Tambahan:**
- Jika ditanya "Apa yang baru?", jelaskan fitur **Duplicate Detector**, **Audio Insight**, dan **Mobile UI** terbaru.
- Jika ada error 403/429, sarankan update Cookies atau tunggu sebentar.
`;

  // Build messages array
  const clientStateMsg = context.clientState
    ? { role: "system", content: `**Current User State (Context):**\n${JSON.stringify(context.clientState, null, 2)}` }
    : null;

  const messages = [
    { role: "system", content: systemPrompt },
    ...(clientStateMsg ? [clientStateMsg] : []),
    ...history.map(msg => ({
      role: msg.role === 'bot' ? 'assistant' : 'user',
      content: msg.text || ""
    })),
    { role: "user", content: prompt }
  ];

  try {
    const response = await safeFetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + GROQ_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: messages,
        temperature: 0.7,
        max_tokens: 500
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Groq API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "{}";

    try {
      return JSON.parse(content);
    } catch (e) {
      return { reply: content };
    }
  } catch (error) {
    console.error("[Groq API] Error:", error);
    throw error;
  }
};

let turnstileWarningLogged = false;
const turnstileBypassReasons = new Set();

const logTurnstileBypass = (message) => {
  if (!message) return;
  if (turnstileBypassReasons.has(message)) return;
  turnstileBypassReasons.add(message);
  console.warn(`[captcha] ${message}`);
};

const verifyTurnstileToken = async (token, remoteIp) => {
  if (!isTurnstileConfigured) {
    if (!turnstileWarningLogged) {
      turnstileWarningLogged = true;
      if (!TURNSTILE_SECRET_KEY) {
        console.warn("[captcha] TURNSTILE_SECRET_KEY tidak ditemukan, melewati verifikasi token");
      } else {
        console.warn("[captcha] TURNSTILE_SITE_KEY tidak ditemukan, melewati verifikasi token");
      }
    }
    return null;
  }
  const trimmed = typeof token === "string" ? token.trim() : "";
  if (!trimmed) {
    if (TURNSTILE_STRICT) {
      const err = new Error("Token captcha wajib diisi");
      err.statusCode = 400;
      throw err;
    }
    logTurnstileBypass("Token captcha kosong, melewati verifikasi (mode non-strict)");
    return null;
  }
  const params = new URLSearchParams({ secret: TURNSTILE_SECRET_KEY, response: trimmed });
  if (remoteIp) params.set("remoteip", remoteIp);
  let response;
  try {
    response = await safeFetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
  } catch (err) {
    if (TURNSTILE_STRICT) {
      const error = new Error("Gagal menghubungi layanan captcha");
      error.cause = err;
      throw error;
    }
    logTurnstileBypass("Gagal menghubungi layanan captcha, melewati verifikasi (mode non-strict)");
    return null;
  }
  let data;
  try {
    data = await response.json();
  } catch (err) {
    if (TURNSTILE_STRICT) {
      const error = new Error("Respon captcha tidak valid");
      error.cause = err;
      throw error;
    }
    logTurnstileBypass("Respon captcha tidak valid, melewati verifikasi (mode non-strict)");
    return null;
  }
  if (!data?.success) {
    if (TURNSTILE_STRICT) {
      const codes = Array.isArray(data?.["error-codes"]) ? data["error-codes"].join(",") : "";
      const error = new Error(codes ? `Verifikasi captcha gagal (${codes})` : "Verifikasi captcha gagal");
      error.statusCode = 400;
      throw error;
    }
    const codes = Array.isArray(data?.["error-codes"]) ? data["error-codes"].join(",") : "";
    logTurnstileBypass(
      codes
        ? `Verifikasi captcha gagal (${codes}), melewati verifikasi (mode non-strict)`
        : "Verifikasi captcha gagal, melewati verifikasi (mode non-strict)",
    );
    return null;
  }
  return data;
};

const createTimeoutController = (ms = 15000) => {
  if (typeof AbortController === "undefined") return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, ms));
  if (typeof timer?.unref === "function") timer.unref();
  return { controller, timer };
};

const parseIso8601DurationSeconds = (value = "") => {
  if (!value || typeof value !== "string") return null;
  const match = value
    .toUpperCase()
    .match(/^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)(?:\.(\d+))?S)?)?$/);
  if (!match) return null;
  const [, weeks, days, hours, minutes, seconds, fraction] = match;
  const total =
    (Number(weeks) || 0) * 604800 +
    (Number(days) || 0) * 86400 +
    (Number(hours) || 0) * 3600 +
    (Number(minutes) || 0) * 60 +
    (Number(seconds) || 0) +
    (fraction ? Number(`0.${fraction}`) : 0);
  return Number.isFinite(total) && total > 0 ? total : null;
};

const youtubeApiFetch = async (endpoint, params = {}, { timeout = 12000 } = {}) => {
  if (!isYoutubeApiConfigured) return null;
  const searchParams = new URLSearchParams({ key: YOUTUBE_API_KEY });
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value == null) return;
    searchParams.set(key, String(value));
  });
  const url = `https://www.googleapis.com/youtube/v3/${endpoint}?${searchParams.toString()}`;
  const timeoutCtrl = createTimeoutController(timeout);
  try {
    const response = await safeFetch(url, {
      signal: timeoutCtrl?.controller?.signal,
      headers: { Accept: "application/json" },
    });
    if (!response?.ok) {
      const message = await response.text().catch(() => "");
      console.warn(
        `[youtube-api] ${endpoint} gagal (${response?.status || ""})`,
        message ? message.slice(0, 200) : "",
      );
      return null;
    }
    return await response.json();
  } catch (err) {
    console.warn(`[youtube-api] ${endpoint} error:`, err?.message || err);
    return null;
  } finally {
    if (timeoutCtrl?.timer) clearTimeout(timeoutCtrl.timer);
  }
};

const buildYoutubeEntryFromApiItem = (item) => {
  if (!item) return null;
  const snippet = item.snippet || {};
  const details = item.contentDetails || {};
  const id = typeof item.id === "string" ? item.id : item.id?.videoId || null;
  if (!id) return null;
  const thumbnails = snippet.thumbnails
    ? Object.values(snippet.thumbnails)
      .map((thumb) =>
        thumb && thumb.url
          ? {
            url: String(thumb.url),
            width: Number.isFinite(thumb.width) ? Number(thumb.width) : undefined,
            height: Number.isFinite(thumb.height) ? Number(thumb.height) : undefined,
          }
          : null,
      )
      .filter(Boolean)
    : [];
  const duration = parseIso8601DurationSeconds(details.duration);
  const entry = {
    id,
    title: snippet.title || "",
    fulltitle: snippet.title || "",
    channel: snippet.channelTitle || "",
    uploader: snippet.channelTitle || "",
    channel_id: snippet.channelId || "",
    duration,
    thumbnails,
    tags: Array.isArray(snippet.tags) ? snippet.tags : undefined,
    description: snippet.description || "",
    extractor_key: "YouTube",
    original_url: `https://www.youtube.com/watch?v=${id}`,
    webpage_url: `https://www.youtube.com/watch?v=${id}`,
  };
  return entry;
};

const YOUTUBE_THUMBNAIL_PRESETS = [
  { suffix: "maxresdefault", width: 1280, height: 720 },
  { suffix: "sddefault", width: 640, height: 480 },
  { suffix: "hqdefault", width: 480, height: 360 },
  { suffix: "mqdefault", width: 320, height: 180 },
  { suffix: "default", width: 120, height: 90 },
];

const createYoutubeThumbnailCandidates = (videoId) => {
  if (!videoId) return [];
  return YOUTUBE_THUMBNAIL_PRESETS.map(({ suffix, width, height }) => ({
    url: `https://i.ytimg.com/vi/${videoId}/${suffix}.jpg`,
    width,
    height,
  }));
};

const buildMinimalYoutubeEntry = ({ videoId, rawUrl, rawKeyword } = {}) => {
  if (!videoId) return null;
  const baseTitle =
    (typeof rawKeyword === "string" && rawKeyword.trim()) ||
    (typeof rawUrl === "string" && rawUrl.trim()) ||
    `YouTube Video ${videoId}`;
  const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
  return {
    id: videoId,
    title: baseTitle,
    fulltitle: baseTitle,
    channel: "",
    uploader: "",
    extractor_key: "YouTube",
    duration: null,
    thumbnails: createYoutubeThumbnailCandidates(videoId),
    description: "",
    original_url: canonicalUrl,
    webpage_url: canonicalUrl,
  };
};

const fetchYoutubeOEmbed = async (videoId) => {
  if (!videoId) return null;
  const oembedUrl =
    "https://www.youtube.com/oembed?format=json&url=" +
    encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`);
  const timeoutCtrl = createTimeoutController(8000);
  try {
    const response = await safeFetch(oembedUrl, {
      signal: timeoutCtrl?.controller?.signal,
      headers: { Accept: "application/json" },
    });
    if (!response?.ok) {
      return null;
    }
    return await response.json();
  } catch (err) {
    console.warn(`[youtube-oembed] gagal: ${err?.message || err}`);
    return null;
  } finally {
    if (timeoutCtrl?.timer) clearTimeout(timeoutCtrl.timer);
  }
};

const enrichMinimalYoutubeEntry = async (entry, { rawUrl, rawKeyword } = {}) => {
  if (!entry?.id) return entry;
  try {
    const data = await fetchYoutubeOEmbed(entry.id);
    if (!data) return entry;
    const title = data.title || entry.title || entry.fulltitle || "";
    const author = data.author_name || entry.channel || entry.uploader || "";
    const thumbnails = [...(entry.thumbnails || [])];
    if (data.thumbnail_url) {
      const normalized = String(data.thumbnail_url);
      const exists = thumbnails.some((thumb) => thumb?.url === normalized);
      if (!exists) {
        thumbnails.unshift({
          url: normalized,
          width: Number.isFinite(data.thumbnail_width) ? Number(data.thumbnail_width) : undefined,
          height: Number.isFinite(data.thumbnail_height) ? Number(data.thumbnail_height) : undefined,
        });
      }
    }
    return {
      ...entry,
      title,
      fulltitle: title,
      channel: author || entry.channel || "",
      uploader: author || entry.uploader || "",
      thumbnails,
    };
  } catch (err) {
    console.warn(`[youtube-oembed] enrich gagal: ${err?.message || err}`);
    return entry;
  }
};

const fetchYoutubeVideosByIds = async (ids = [], { language } = {}) => {
  if (!isYoutubeApiConfigured) return [];
  const unique = Array.from(new Set((ids || []).filter(Boolean)));
  if (!unique.length) return [];
  const chunks = [];
  for (let i = 0; i < unique.length; i += 50) {
    chunks.push(unique.slice(i, i + 50));
  }
  const results = [];
  for (const batch of chunks) {
    const params = { part: "snippet,contentDetails", id: batch.join(","), maxResults: String(batch.length) };
    if (language) params.hl = language;
    const data = await youtubeApiFetch("videos", params);
    if (data?.items?.length) results.push(...data.items);
  }
  return results;
};

const fetchVideoInfoFromYoutubeApi = async ({ rawUrl, rawKeyword, language }) => {
  if (!isYoutubeApiConfigured) return null;
  const keyword = typeof rawKeyword === "string" ? rawKeyword.trim() : "";
  let keywordUsed = false;
  let videoId = extractYouTubeVideoId(rawUrl);

  if (!videoId) {
    if (!keyword) return null;
    const params = {
      part: "snippet",
      type: "video",
      maxResults: "1",
      q: keyword,
    };
    if (language) params.relevanceLanguage = language;
    const searchData = await youtubeApiFetch("search", params);
    const item = searchData?.items?.find((entry) => entry?.id?.videoId);
    if (!item) return null;
    videoId = item.id.videoId;
    keywordUsed = true;
  }

  if (!videoId) return null;
  const [videoItem] = await fetchYoutubeVideosByIds([videoId], { language });
  if (!videoItem) return null;
  const entry = buildYoutubeEntryFromApiItem(videoItem);
  if (!entry) return null;
  return { entry, keywordUsed };
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.set("trust proxy", 1);
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(cors());

if (process.env.CLOUDINARY_URL) {
  cloudinary.config({ secure: true });
} else {
  console.warn("CLOUDINARY_URL belum diset; upload gambar forum & sync stiker via Cloudinary tidak aktif.");
}

const parseCloudinaryUrl = (raw) => {
  const input = String(raw || "").trim();
  if (!input) return null;
  const m = input.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  if (!m) return null;
  return { apiKey: m[1], apiSecret: m[2], cloudName: m[3] };
};

const signCloudinaryParams = (params, apiSecret) => {
  const entries = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && String(v) !== "")
    .sort(([a], [b]) => a.localeCompare(b));
  const base = entries.map(([k, v]) => `${k}=${String(v)}`).join("&");
  return createHash("sha1").update(base + apiSecret).digest("hex");
};

const uploadAudioToCloudinary = async ({ filePath, publicId, folder, mimeType }) => {
  const cfg = parseCloudinaryUrl(process.env.CLOUDINARY_AUDIO_URL);
  if (!cfg) return null;

  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = {
    folder,
    overwrite: "true",
    public_id: publicId,
    timestamp,
  };
  const signature = signCloudinaryParams(paramsToSign, cfg.apiSecret);

  const { FormData, File } = await import("undici");
  const buf = await fsp.readFile(filePath);
  const fileName = basename(filePath);
  const file = new File([buf], fileName, { type: mimeType || "audio/mpeg" });
  const form = new FormData();
  form.set("file", file);
  form.set("api_key", cfg.apiKey);
  form.set("timestamp", String(timestamp));
  form.set("signature", signature);
  form.set("folder", folder);
  form.set("public_id", publicId);
  form.set("overwrite", "true");

  const endpoint = `https://api.cloudinary.com/v1_1/${cfg.cloudName}/video/upload`;
  const res = await fetch(endpoint, { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof data?.error?.message === "string" ? data.error.message : "Upload Cloudinary gagal";
    const err = new Error(msg);
    err.details = data;
    throw err;
  }
  return {
    url: data.secure_url,
    publicId: data.public_id,
    bytes: data.bytes,
    duration: data.duration,
  };
};

const extractCloudinaryPublicIdFromUrl = (rawUrl) => {
  const value = String(rawUrl || "").trim();
  if (!value) return "";
  try {
    const parsed = new URL(value);
    const marker = "/upload/";
    const idx = parsed.pathname.indexOf(marker);
    if (idx < 0) return "";
    let rest = parsed.pathname.slice(idx + marker.length);
    rest = rest.replace(/^v\d+\//, "");
    rest = rest.replace(/^\/+/, "");
    if (!rest) return "";
    const slash = rest.lastIndexOf("/");
    const fileName = slash >= 0 ? rest.slice(slash + 1) : rest;
    const folder = slash >= 0 ? rest.slice(0, slash) : "";
    const dot = fileName.lastIndexOf(".");
    const noExt = dot > 0 ? fileName.slice(0, dot) : fileName;
    const joined = folder ? `${folder}/${noExt}` : noExt;
    return decodeURIComponent(joined).trim();
  } catch {
    return "";
  }
};

// ==== Direktori publik & jobs ====
const PUBLIC_DIR = join(__dirname, "public");
const JOBS_DIR = join(PUBLIC_DIR, "jobs");
if (!existsSync(PUBLIC_DIR)) mkdirSync(PUBLIC_DIR, { recursive: true });
if (!existsSync(JOBS_DIR)) mkdirSync(JOBS_DIR, { recursive: true });

const PUBLIC_ROOT = pathResolve(PUBLIC_DIR);
// direktori tambahan seperti thumbnail/cloud sudah dihapus

const backgroundJobs = new Map();
const backgroundQueue = [];
let backgroundProcessing = false;

const sanitizeEmail = (input = "") => {
  if (!input) return "";
  const trimmed = String(input).trim().toLowerCase();
  if (!trimmed) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "";
  return trimmed;
};

const maskEmail = (email = "") => {
  if (!email) return "";
  const [user, domain] = email.split("@");
  if (!domain) return email;
  if (user.length <= 2) return `${user[0] || ""}***@${domain}`;
  return `${user.slice(0, 2)}***@${domain}`;
};

const SAWERIA_SIGNATURE_HEADER = "Saweria-Callback-Signature";
const buildSaweriaHmacData = (payload) => {
  const version = payload?.version ?? "";
  const id = payload?.id ?? "";
  const amountRaw = payload?.amount_raw ?? "";
  const donatorName = payload?.donator_name ?? "";
  const donatorEmail = payload?.donator_email ?? "";
  return `${version}${id}${amountRaw}${donatorName}${donatorEmail}`;
};

const verifySaweriaSignature = (payload, signature, key) => {
  const data = buildSaweriaHmacData(payload);
  const expected = createHmac("sha256", key).update(data).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature || "")));
  } catch {
    return false;
  }
};

let mailTransport = null;
let mailTransportFailed = false;

const getMailTransport = () => {
  if (mailTransportFailed) return null;
  if (mailTransport) return mailTransport;
  if (!nodemailer) {
    mailTransportFailed = true;
    return null;
  }
  try {
    const smtpUrl = process.env.NOTIFY_SMTP_URL || process.env.SMTP_URL;
    if (smtpUrl) {
      mailTransport = nodemailer.createTransport(smtpUrl);
      return mailTransport;
    }
    const host = process.env.NOTIFY_SMTP_HOST;
    if (host) {
      const port = Number(process.env.NOTIFY_SMTP_PORT) || 587;
      const secure = String(process.env.NOTIFY_SMTP_SECURE || "false").toLowerCase() === "true";
      const user = process.env.NOTIFY_SMTP_USER;
      const pass = process.env.NOTIFY_SMTP_PASS;
      mailTransport = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: user && pass ? { user, pass } : undefined,
      });
      return mailTransport;
    }
  } catch (err) {
    console.warn("[notify] gagal menyiapkan transport email", err);
    mailTransportFailed = true;
    return null;
  }
  mailTransportFailed = true;
  return null;
};

const privateShares = new Map();
const PRIVATE_SHARE_TTL_MS = Math.max(5 * 60 * 1000, Number(process.env.PRIVATE_SHARE_TTL_MS) || 24 * 60 * 60 * 1000);
const PRIVATE_SHARE_SECRET = process.env.PRIVATE_SHARE_SECRET
  || createHash("sha256").update(`${__dirname}|ytmp3-private-share`).digest("hex");
let privateShareCleanupTimer = null;

const prunePrivateShares = () => {
  const now = Date.now();
  for (const [id, share] of privateShares) {
    if (share.expiresAt && share.expiresAt <= now) {
      privateShares.delete(id);
    }
  }
};

const ensureShareCleanup = () => {
  if (privateShareCleanupTimer) return;
  privateShareCleanupTimer = setInterval(prunePrivateShares, Math.min(PRIVATE_SHARE_TTL_MS, 60 * 60 * 1000));
  if (typeof privateShareCleanupTimer.unref === "function") privateShareCleanupTimer.unref();
};

const hashSharePassword = (password = "") =>
  createHash("sha256").update(`${password}:${PRIVATE_SHARE_SECRET}`).digest("hex");

const createShareToken = (share) => {
  const salt = nanoid(6);
  const signature = createHash("sha256")
    .update(`${share.id}:${share.passwordHash}:${salt}:${PRIVATE_SHARE_SECRET}`)
    .digest("hex");
  const token = `${salt}.${signature}`;
  if (!share.tokens) share.tokens = new Set();
  share.tokens.add(token);
  if (share.tokens.size > 10) {
    const latest = Array.from(share.tokens).slice(-10);
    share.tokens = new Set(latest);
  }
  return token;
};

const verifyShareToken = (share, token = "") => {
  if (!token || typeof token !== "string") return false;
  const [salt, signature] = token.split(".");
  if (!salt || !signature) return false;
  if (share.tokens && !share.tokens.has(token)) return false;
  const expected = createHash("sha256")
    .update(`${share.id}:${share.passwordHash}:${salt}:${PRIVATE_SHARE_SECRET}`)
    .digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
};

// ==== Util ====
const abrToQ = (abr) => {
  const n = Number(abr) || 128;
  if (n >= 320) return "0";
  if (n >= 256) return "1";
  if (n >= 192) return "2";
  if (n >= 160) return "3";
  if (n >= 128) return "4";
  if (n >= 96) return "5";
  if (n >= 80) return "6";
  if (n >= 64) return "7";
  return "8";
};

const sanitizeFileName = (name = "") =>
  name
    .replace(/[\\/:*?"<>|\r\n]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const CONVERT_PROGRESS_TTL = 60_000;
const convertProgressMap = new Map();
const progressTimers = new Map();
const TOOL_UPDATE_TTL = 15 * 60 * 1000;
let toolUpdateCache = { timestamp: 0, data: null };
const ZIP_SIZE_LIMIT_BYTES = Number(process.env.ZIP_SIZE_LIMIT_MB || 800) * 1024 * 1024;

const clampPercent = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.min(100, Math.max(0, Number(num.toFixed(2))));
};

const scheduleProgressCleanup = (id) => {
  if (!id) return;
  if (progressTimers.has(id)) {
    clearTimeout(progressTimers.get(id));
  }
  const timer = setTimeout(() => {
    const entry = convertProgressMap.get(id);
    if (!entry) return;
    if (Date.now() - (entry.updatedAt || 0) >= CONVERT_PROGRESS_TTL) {
      convertProgressMap.delete(id);
    }
    progressTimers.delete(id);
  }, CONVERT_PROGRESS_TTL + 5000);
  progressTimers.set(id, timer);
};

const initProgress = (id, initial = {}) => {
  if (!id) return;
  const entry = {
    id,
    stage: "init",
    percent: clampPercent(initial.percent ?? 0),
    message: initial.message || "",
    etaSeconds: initial.etaSeconds ?? null,
    etaLabel: initial.etaLabel || "",
    speed: initial.speed || "",
    size: initial.size || "",
    updatedAt: Date.now(),
  };
  convertProgressMap.set(id, entry);
  scheduleProgressCleanup(id);
};

const updateProgress = (id, patch = {}) => {
  if (!id || !convertProgressMap.has(id)) return;
  const prev = convertProgressMap.get(id);
  const next = {
    ...prev,
    ...patch,
    percent: patch.percent != null ? clampPercent(patch.percent) : prev.percent,
    updatedAt: Date.now(),
  };
  convertProgressMap.set(id, next);
  scheduleProgressCleanup(id);
};

const finishProgress = (id, stage = "complete", extra = {}) => {
  if (!id) return;
  if (!convertProgressMap.has(id)) {
    initProgress(id, { stage, percent: stage === "error" ? 0 : 100 });
  }
  updateProgress(id, {
    stage,
    percent: stage === "error" ? extra.percent ?? convertProgressMap.get(id)?.percent ?? 0 : 100,
    message: extra.message ?? (stage === "complete" ? "Selesai" : extra.message || ""),
  });
};

const clearProgress = (id) => {
  if (!id) return;
  if (progressTimers.has(id)) {
    clearTimeout(progressTimers.get(id));
    progressTimers.delete(id);
  }
  convertProgressMap.delete(id);
};

const runCommandCapture = (command, args = [], timeoutMs = 5000) =>
  new Promise((resolve, reject) => {
    try {
      const proc = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";

      const timer = setTimeout(() => {
        proc.kill();
        reject(new Error("Command timed out"));
      }, timeoutMs);

      proc.stdout.on("data", (d) => { stdout += d.toString(); });
      proc.stderr.on("data", (d) => { stderr += d.toString(); });
      proc.on("error", (err) => {
        clearTimeout(timer);
        err.stderr = stderr;
        reject(err);
      });
      proc.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          const error = new Error(`command exited with code ${code}`);
          error.code = code;
          error.stderr = stderr;
          return reject(error);
        }
        resolve(stdout.trim());
      });
    } catch (err) {
      reject(err);
    }
  });

const normalizeVersionString = (value) => String(value || "").trim();

const parseVersionSegments = (value) => {
  const normalized = normalizeVersionString(value).replace(/^[a-z]+/i, "");
  return normalized
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map((part) => Number(part));
};

const compareVersionStrings = (current, latest) => {
  const a = parseVersionSegments(current);
  const b = parseVersionSegments(latest);
  if (!a.length || !b.length) return null;
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i += 1) {
    const left = a[i] ?? 0;
    const right = b[i] ?? 0;
    if (left > right) return 1;
    if (left < right) return -1;
  }
  return 0;
};

const detectYtDlpVersion = async () => {
  const attempts = [
    () => runCommandCapture("yt-dlp", ["--version"]),
    () => runCommandCapture("python3", ["-m", "yt_dlp", "--version"]),
  ];
  for (const attempt of attempts) {
    try {
      const output = await attempt();
      if (output) return output.split(/\r?\n/)[0].trim();
    } catch { }
  }
  return null;
};

const detectFfmpegVersion = async () => {
  const commands = [];
  if (ffmpegPath) commands.push(() => runCommandCapture(ffmpegPath, ["-version"]));
  commands.push(() => runCommandCapture("ffmpeg", ["-version"]));
  for (const attempt of commands) {
    try {
      const output = await attempt();
      if (output) {
        const firstLine = output.split(/\r?\n/)[0] || "";
        const match = firstLine.match(/ffmpeg version\s+(.+)/i);
        return match ? match[1].trim() : firstLine.trim();
      }
    } catch { }
  }
  return null;
};

const fetchGithubLatestTag = async (repo) => {
  const headers = { "User-Agent": "youtubetomp3-update-checker" };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const releaseResp = await safeFetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers,
      signal: controller.signal
    });
    if (releaseResp?.ok) {
      const json = await releaseResp.json().catch(() => null);
      const tag = json?.tag_name || json?.name;
      if (tag) return String(tag).trim();
    }
    if (releaseResp?.status && releaseResp.status !== 404) {
      return null;
    }
  } catch { } finally {
    clearTimeout(timeout);
  }

  const controllerTags = new AbortController();
  const timeoutTags = setTimeout(() => controllerTags.abort(), 5000);
  try {
    const tagsResp = await safeFetch(`https://api.github.com/repos/${repo}/tags?per_page=1`, {
      headers,
      signal: controllerTags.signal
    });
    if (!tagsResp?.ok) return null;
    const tags = await tagsResp.json().catch(() => []);
    const first = Array.isArray(tags) ? tags[0] : null;
    return first?.name ? String(first.name).trim() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutTags);
  }
};

const resolveToolVersions = async () => {
  if (toolUpdateCache.data && (Date.now() - toolUpdateCache.timestamp) < TOOL_UPDATE_TTL) {
    return toolUpdateCache.data;
  }
  const [ytLocal, ffmpegLocal, ytLatest, ffmpegLatest] = await Promise.all([
    detectYtDlpVersion(),
    detectFfmpegVersion(),
    fetchGithubLatestTag("yt-dlp/yt-dlp"),
    fetchGithubLatestTag("FFmpeg/FFmpeg"),
  ]);
  const ytComparison = compareVersionStrings(ytLocal, ytLatest);
  const ffmpegComparison = compareVersionStrings(ffmpegLocal, ffmpegLatest);
  const data = {
    ytDlp: {
      current: ytLocal,
      latest: ytLatest,
      upToDate: ytComparison != null ? ytComparison >= 0 : null,
    },
    ffmpeg: {
      current: ffmpegLocal,
      latest: ffmpegLatest,
      upToDate: ffmpegComparison != null ? ffmpegComparison >= 0 : null,
    },
  };
  toolUpdateCache = { timestamp: Date.now(), data };
  return data;
};

const LANGUAGE_VARIANTS = {
  id: ["id", "in", "ms", "ms-my", "ms-id", "jv", "jw", "su"],
  en: ["en", "en-us", "en-gb", "en-au", "en-ca", "en-in", "eng"],
};

const FALLBACK_LANG = "en";

const normalizePreferredLang = (value = "") => {
  if (!value) return "";
  const normalized = String(value).trim().toLowerCase();
  if (!normalized || normalized === "auto") return "";
  if (LANGUAGE_VARIANTS.id.includes(normalized)) return "id";
  if (LANGUAGE_VARIANTS.en.includes(normalized)) return "en";
  const base = normalized.split(/[-_]/)[0];
  if (!base) return FALLBACK_LANG;
  if (LANGUAGE_VARIANTS.id.includes(base)) return "id";
  if (LANGUAGE_VARIANTS.en.includes(base)) return "en";
  return FALLBACK_LANG;
};

const SMART_TITLE_PATTERNS = [
  /\s*\((?:official(?:\s+music)?\s+video|official\s+audio|lyrics?|lyric\s+video|lirik|audio|video|visualizer|mv|music\s+video|color\s+coded|teaser|live|performance|practice|karaoke|remix).*?\)/gi,
  /\s*\[(?:official(?:\s+music)?\s+video|official\s+audio|lyrics?|lyric\s+video|lirik|audio|video|visualizer|mv|music\s+video|color\s+coded|teaser|live|performance|practice|karaoke|remix).*?\]/gi,
  /\s*-\s*(?:official(?:\s+music)?\s+video|official\s+audio|lyrics?|lyric\s+video|lirik|audio(?:\s+only)?|mv|music\s+video)\b/gi,
  /\b(?:official(?:\s+music)?\s+video|official\s+audio|lyrics?|lyric\s+video|lirik|mv|music\s+video|visualizer|audio\s+only|full\s+album|shorts)\b/gi,
  /\b(?:HD|4K|1080p|720p)\b/gi,
];

const MEDIA_HOSTS = {
  youtube: [
    "youtube.com",
    "youtu.be",
    "music.youtube.com",
    "m.youtube.com",
    "youtube-nocookie.com",
    "youtube.googleapis.com",
  ],
  spotify: ["open.spotify.com", "spotify.com", "spotify.link", "spotify.app.link"],
  soundcloud: ["soundcloud.com", "m.soundcloud.com", "soundcloud.app.goo.gl", "on.soundcloud.com"],
};

const identifyMediaSource = (value = "") => {
  if (!value) return "unknown";
  const text = String(value || "").trim();
  try {
    const url = new URL(text);
    const host = url.hostname.toLowerCase();
    for (const [key, hosts] of Object.entries(MEDIA_HOSTS)) {
      if (hosts.some((candidate) => host === candidate || host.endsWith(`.${candidate}`))) {
        return key;
      }
    }
  } catch {
    if (/https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)/i.test(text)) return "youtube";
    if (/https?:\/\/(?:www\.)?open\.spotify\.com/i.test(text) || /spotify:(?:track|album)/i.test(text)) return "spotify";
    if (/https?:\/\/(?:www\.)?soundcloud\.com/i.test(text)) return "soundcloud";
  }
  return "unknown";
};

const cleanVideoTitle = (rawTitle = "") => {
  let result = String(rawTitle || "");
  SMART_TITLE_PATTERNS.forEach((pattern) => {
    result = result.replace(pattern, "");
  });
  result = result.replace(/[-–—]\s*(?:official|lyrics?|lyric\s+video|lirik|audio)$/gi, "");
  return result.replace(/\s{2,}/g, " ").trim();
};

const extractBestThumbnail = (info) => {
  if (!info || typeof info !== "object") return null;
  if (typeof info.thumbnail === "string" && info.thumbnail.trim()) {
    return info.thumbnail.trim();
  }
  if (Array.isArray(info.thumbnails)) {
    const sorted = [...info.thumbnails]
      .filter((item) => item && typeof item === "object")
      .sort((a, b) => (Number(b?.width) || 0) - (Number(a?.width) || 0));
    const candidate = sorted.find((item) => item?.url) || sorted[0];
    if (candidate?.url) return String(candidate.url);
  }
  return null;
};

const buildVideoMetadata = (entry = {}, { requestedUrl = "", keywordUsed = false } = {}) => {
  if (!entry || typeof entry !== "object") return null;
  const baseTitle = entry.track || entry.title || entry.fulltitle || "";
  const cleaned = cleanVideoTitle(baseTitle);
  const artist = entry.artist || entry.channel || entry.uploader || entry.uploader_id || "";
  const albumSource = entry.album || entry.playlist_title || entry.playlist || "";
  const album = albumSource ? cleanVideoTitle(albumSource) : "";
  const provider = String(entry.extractor_key || entry.extractor || "").toLowerCase();
  const webpageUrl =
    entry.original_url ||
    entry.webpage_url ||
    entry.url ||
    (entry.id ? `https://www.youtube.com/watch?v=${entry.id}` : requestedUrl || "");
  const duration = Number.isFinite(entry.duration) ? Number(entry.duration) : null;
  const languageList = Array.isArray(entry.languages)
    ? entry.languages.map((lang) => (lang == null ? null : String(lang))).filter(Boolean)
    : entry.language
      ? [String(entry.language)]
      : [];
  const keywords = Array.isArray(entry.tags)
    ? entry.tags.map((tag) => (tag == null ? null : String(tag))).filter(Boolean)
    : [];

  const cover = extractBestThumbnail(entry);

  return {
    id: entry.id || null,
    title: baseTitle,
    cleanTitle: cleaned || baseTitle,
    author: entry.channel || entry.uploader || entry.channel_id || "",
    artist: artist || "",
    album: album || cleaned || baseTitle,
    cover,
    thumbnail: cover,
    duration,
    webpageUrl,
    keywords,
    languages: Array.from(new Set(languageList)),
    keywordUsed: Boolean(keywordUsed),
    provider: provider || identifyMediaSource(webpageUrl || requestedUrl),
    id3: {
      title: cleaned || baseTitle,
      artist: artist || entry.channel || "",
      album: album || cleaned || baseTitle,
      cover,
    },
  };
};

const searchYoutubeVideosFromApi = async ({ query, limit, language } = {}) => {
  if (!isYoutubeApiConfigured) return null;
  const cleanQuery = typeof query === "string" ? query.trim() : "";
  if (!cleanQuery) return [];
  const max = clamp(Number(limit) || 6, 1, 15);
  const params = {
    part: "snippet",
    type: "video",
    maxResults: String(max),
    q: cleanQuery,
  };
  if (language) params.relevanceLanguage = language;
  const data = await youtubeApiFetch("search", params);
  if (!data?.items?.length) return [];
  const ids = data.items
    .map((item) => item?.id?.videoId)
    .filter((id) => typeof id === "string" && id);
  if (!ids.length) return [];
  const videos = await fetchYoutubeVideosByIds(ids, { language });
  if (!videos.length) return [];
  const map = new Map(videos.map((item) => [item.id, item]));
  return data.items
    .map((item) => {
      const videoId = item?.id?.videoId;
      if (!videoId) return null;
      const videoItem = map.get(videoId);
      if (!videoItem) return null;
      const entry = buildYoutubeEntryFromApiItem(videoItem);
      if (!entry) return null;
      const meta = buildVideoMetadata(entry, { keywordUsed: true });
      if (meta && entry.description) meta.description = entry.description;
      return meta;
    })
    .filter(Boolean);
};

const buildYtDlpCandidates = () => {
  const envBin = typeof process.env.YTDLP_PATH === "string" ? process.env.YTDLP_PATH.trim() : "";
  const envPython =
    typeof process.env.PYTHON === "string"
      ? process.env.PYTHON.trim()
      : typeof process.env.PYTHON_PATH === "string"
        ? process.env.PYTHON_PATH.trim()
        : typeof process.env.PYTHON_BIN === "string"
          ? process.env.PYTHON_BIN.trim()
          : "";

  const candidates = [
    envBin ? { cmd: envBin, prefix: [] } : null,
    { cmd: "yt-dlp", prefix: [] },
    envPython ? { cmd: envPython, prefix: ["-m", "yt_dlp"] } : null,
    { cmd: "python3", prefix: ["-m", "yt_dlp"] },
    { cmd: "python", prefix: ["-m", "yt_dlp"] },
    process.platform === "win32" ? { cmd: "py", prefix: ["-3", "-m", "yt_dlp"] } : null,
  ].filter(Boolean);

  const seen = new Set();
  return candidates.filter(({ cmd, prefix }) => {
    const key = `${cmd} ${(prefix || []).join(" ")}`.trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const runYtDlpAttempt = (command, args, { label }) =>
  new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const proc = spawn(command.cmd, [...(command.prefix || []), ...args], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const displayArgs = [...(command.prefix || []), ...args].join(" ");
    const baseLog = `${label}: ${command.cmd} ${displayArgs}`.trim();

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("error", (err) => {
      const error = new Error("yt-dlp tidak bisa dijalankan");
      error.cause = err;
      error.stdout = stdout;
      error.stderr = stderr;
      error.baseLog = baseLog;
      error.logs = [baseLog, stderr, stdout, err.message].filter(Boolean).join("\n");
      reject(error);
    });
    proc.on("close", (code) => {
      if (code !== 0) {
        const error = new Error("yt-dlp gagal mengambil metadata");
        error.code = code;
        error.stdout = stdout;
        error.stderr = stderr;
        error.baseLog = baseLog;
        error.logs = [baseLog, stderr || stdout].filter(Boolean).join("\n");
        reject(error);
      } else {
        resolve({ stdout, stderr, baseLog });
      }
    });
  });

const runYtDlpJson = async (args, { label = "yt-dlp" } = {}) => {
  const errors = [];
  const candidates = buildYtDlpCandidates();
  let lastStdout = "";
  let lastStderr = "";
  let lastLog = "";

  for (const candidate of candidates) {
    try {
      const { stdout, stderr, baseLog } = await runYtDlpAttempt(candidate, args, { label });
      lastStdout = stdout;
      lastStderr = stderr;
      lastLog = baseLog;
      const jsonText = stdout || "{}";
      try {
        return JSON.parse(jsonText);
      } catch (parseErr) {
        const error = new Error("Respons yt-dlp tidak valid");
        error.stdout = jsonText;
        error.stderr = stderr;
        error.baseLog = baseLog;
        error.logs = [baseLog, stderr, jsonText, parseErr.message]
          .filter(Boolean)
          .join("\n");
        throw error;
      }
    } catch (err) {
      errors.push(err.logs || err.message || "yt-dlp gagal mengambil metadata");
      lastStdout = err.stdout || lastStdout;
      lastStderr = err.stderr || lastStderr;
      lastLog = err.baseLog || lastLog;
    }
  }

  const error = new Error("yt-dlp gagal mengambil metadata");
  error.logs = [lastLog, lastStderr, lastStdout, ...errors].filter(Boolean).join("\n");
  throw error;
};

const parseHtmlMeta = (html = "", property) => {
  if (!html || !property) return "";
  const rx = new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i");
  const match = rx.exec(html);
  return match ? match[1].trim() : "";
};

const decodeSpotifyJsonValue = (value = "") => {
  if (value == null) return "";
  const raw = String(value);
  try {
    return JSON.parse(`"${raw.replace(/"/g, '\\"')}"`);
  } catch {
    return raw
      .replace(/\\u0026/gi, "&")
      .replace(/\\u002f/gi, "/")
      .replace(/\\\//g, "/")
      .replace(/\\\\/g, "\\")
      .trim();
  }
};

const extractSpotifyIdFromUrl = (value = "") => {
  if (!value) return "";
  const direct = /spotify:track:([0-9A-Za-z]{22})/i.exec(value);
  if (direct) return direct[1];
  try {
    const url = new URL(value);
    if (/spotify\.link$/i.test(url.hostname) && url.pathname && url.pathname.length > 1) {
      const guess = url.pathname.replace(/^\//, "").trim();
      if (/^[0-9A-Za-z]{22}$/.test(guess)) return guess;
    }
    const parts = url.pathname.split("/").filter(Boolean);
    const trackIdx = parts.findIndex((part) => part.toLowerCase() === "track");
    if (trackIdx >= 0 && parts[trackIdx + 1] && /^[0-9A-Za-z]{22}$/.test(parts[trackIdx + 1])) {
      return parts[trackIdx + 1];
    }
  } catch { }
  return "";
};

const extractSpotifyPreviewFromHtml = (html = "") => {
  if (!html) return { url: "", durationMs: null };
  const patterns = [
    /"preview_url"\s*:\s*"([^"\\]+(?:\\.[^"\\]*)*)"/i,
    /"audioPreview"\s*:\s*{[\s\S]*?"url"\s*:\s*"([^"\\]+(?:\\.[^"\\]*)*)"/i,
    /"audioPreviewUrl"\s*:\s*"([^"\\]+(?:\\.[^"\\]*)*)"/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match) {
      const decoded = decodeSpotifyJsonValue(match[1]);
      if (decoded) {
        const durationMatch = /"preview(?:_duration|Duration)(?:_ms|Ms)?"\s*:\s*(\d{2,})/i.exec(html);
        const durationMs = durationMatch ? Number(durationMatch[1]) : null;
        const normalizedDuration = Number.isFinite(durationMs) ? durationMs : null;
        return { url: decoded, durationMs: normalizedDuration };
      }
    }
  }
  return { url: "", durationMs: null };
};

const fetchSpotifyOEmbed = async (url) => {
  if (!url) return null;
  const endpoint = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
  try {
    const resp = await safeFetch(endpoint, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0",
      },
    });
    if (!resp.ok) return null;
    const data = await resp.json().catch(() => null);
    if (!data || typeof data !== "object") return null;
    const title = typeof data.title === "string" ? data.title.trim() : "";
    const artist = typeof data.author_name === "string" ? data.author_name.trim() : "";
    const cover = typeof data.thumbnail_url === "string" ? data.thumbnail_url.trim() : "";
    const queryParts = [title, artist].filter(Boolean);
    return {
      title,
      artist,
      cover,
      searchQuery: queryParts.join(" ").trim(),
    };
  } catch {
    return null;
  }
};

const extractSpotifyDetails = async (rawUrl) => {
  if (!rawUrl) return null;
  const url = rawUrl.trim();
  const guessedId = extractSpotifyIdFromUrl(url);

  // Gunakan Spotify Web API HANYA untuk metadata, download akan dilakukan dari YouTube Music/YouTube via yt-dlp
  let spotifyMetadata = null;
  try {
    const { extractSpotifyMetadata } = await import("./lib/spotify-metadata.js");
    spotifyMetadata = await extractSpotifyMetadata(url);
  } catch (apiErr) {
    // Fallback ke yt-dlp untuk metadata jika Spotify Web API tidak tersedia atau gagal
    console.warn("[spotify] Spotify Web API tidak tersedia untuk metadata, fallback ke yt-dlp:", apiErr.message);
  }

  // Jika Spotify Web API berhasil, gunakan hasilnya untuk metadata
  if (spotifyMetadata && spotifyMetadata.title) {
    // Query untuk YouTube/YouTube Music: "judul lagu artis audio"
    const searchQuery = `${(spotifyMetadata.title || "").trim()} ${(spotifyMetadata.artist || "").trim()} audio`.trim();

    return {
      title: spotifyMetadata.title || "",
      artist: spotifyMetadata.artist || "",
      album: spotifyMetadata.album || "",
      cover: spotifyMetadata.cover || "",
      duration: spotifyMetadata.duration || null,
      searchQuery: searchQuery || `${(spotifyMetadata.title || "").trim()} ${(spotifyMetadata.artist || "").trim()} audio`.trim(),
      id: spotifyMetadata.id || guessedId || null,
      previewUrl: spotifyMetadata.previewUrl || "",
      previewDuration: spotifyMetadata.duration || null,
      previewDurationMs: spotifyMetadata.durationMs || null,
      embedUrl: spotifyMetadata.embedUrl || "",
    };
  }

  // Fallback: pakai yt-dlp seperti sebelumnya
  const args = [
    "--dump-single-json",
    "--skip-download",
    "--no-warnings",
    "--no-playlist",
    "--ignore-config",
    url,
  ];

  let entry = null;
  try {
    const json = await runYtDlpJson(args, { label: "spotify-info" });
    entry = Array.isArray(json?.entries) && json.entries.length ? json.entries[0] : json;
  } catch {
    entry = null;
  }

  const details = {};
  if (guessedId) details.id = guessedId;
  if (entry && typeof entry === "object") {
    details.title = entry.track || entry.title || entry.fulltitle || "";
    const artistSources = [];
    if (Array.isArray(entry.artists)) artistSources.push(...entry.artists);
    if (Array.isArray(entry.artist_list)) artistSources.push(...entry.artist_list);
    if (entry.artist) artistSources.push(entry.artist);
    if (entry.uploader) artistSources.push(entry.uploader);
    const artistClean = artistSources
      .flatMap((item) => {
        if (!item) return [];
        if (typeof item === "string") return [item];
        if (typeof item === "object" && item.name) return [item.name];
        return [];
      })
      .map((item) => String(item).trim())
      .filter(Boolean);
    details.artist = artistClean[0] || "";
    const trackId = typeof entry.track_id === "string" ? entry.track_id.trim() : "";
    const entryId = typeof entry.id === "string" ? entry.id.trim() : "";
    if (!details.id && trackId && /^[0-9A-Za-z]{22}$/.test(trackId)) details.id = trackId;
    if (!details.id && entryId && /^[0-9A-Za-z]{22}$/.test(entryId)) details.id = entryId;
    details.album = entry.album || entry.playlist_title || "";
    details.cover = extractBestThumbnail(entry);
    details.duration = Number.isFinite(entry.duration) ? Number(entry.duration) : null;
    const previewCandidates = [entry.preview_url, entry.audio_preview_url, entry?.audioPreview?.url];
    for (const candidate of previewCandidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        details.previewUrl = candidate.trim();
        break;
      }
    }
    if (entry?.audioPreview?.duration_ms && !details.previewDurationMs) {
      const dur = Number(entry.audioPreview.duration_ms);
      if (Number.isFinite(dur) && dur > 0) details.previewDurationMs = dur;
    }
    if (entry?.audioPreview?.duration && !details.previewDurationMs) {
      const dur = Number(entry.audioPreview.duration);
      if (Number.isFinite(dur) && dur > 0) details.previewDurationMs = dur * 1000;
    }
    const queryParts = [details.title, details.artist].filter(Boolean);
    details.searchQuery = queryParts.join(" ").trim();
  }

  if (!details.searchQuery) {
    const embedDetails = await fetchSpotifyOEmbed(url);
    if (embedDetails) {
      if (!details.title && embedDetails.title) details.title = embedDetails.title;
      if (!details.artist && embedDetails.artist) details.artist = embedDetails.artist;
      if (!details.cover && embedDetails.cover) details.cover = embedDetails.cover;
      if (!details.searchQuery && embedDetails.searchQuery) details.searchQuery = embedDetails.searchQuery;
    }
  }

  if (!details.searchQuery) {
    try {
      const resp = await safeFetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (resp.ok) {
        const html = await resp.text();
        const title = parseHtmlMeta(html, "og:title");
        const description = parseHtmlMeta(html, "og:description");
        const cover = parseHtmlMeta(html, "og:image");
        const durationMeta = parseHtmlMeta(html, "music:duration");
        const album = parseHtmlMeta(html, "music:album") || "";
        const parts = description ? description.split(" · ").map((part) => part.trim()) : [];
        const possibleArtist = parts.length > 1 ? parts[1] : parts[0] || "";
        details.title = title || details.title || "";
        details.artist = possibleArtist || details.artist || "";
        details.album = album || details.album || "";
        details.cover = cover || details.cover || "";
        const duration = Number(durationMeta);
        if (Number.isFinite(duration) && duration > 0) details.duration = duration;
        if (!details.previewUrl) {
          const previewFromHtml = extractSpotifyPreviewFromHtml(html);
          if (previewFromHtml.url) details.previewUrl = previewFromHtml.url;
          if (previewFromHtml.durationMs && !details.previewDurationMs) {
            details.previewDurationMs = previewFromHtml.durationMs;
          }
        }
        if (!details.id) {
          const uriMatch = /spotify:track:([0-9A-Za-z]{22})/i.exec(html);
          if (uriMatch) details.id = uriMatch[1];
        }
        const queryParts = [details.title, details.artist].filter(Boolean);
        details.searchQuery = queryParts.join(" ").trim();
      }
    } catch {
      // ignore fallback failure
    }
  }

  if (!details.searchQuery) {
    const fallbackParts = [details.title, details.artist].filter(Boolean);
    if (fallbackParts.length) {
      details.searchQuery = fallbackParts.join(" ").trim();
    }
  }
  if (!details.searchQuery && !details.previewUrl) return null;

  if (details.previewUrl) {
    const decoded = decodeSpotifyJsonValue(details.previewUrl);
    details.previewUrl = decoded.startsWith("//") ? `https:${decoded}` : decoded;
  }
  if (details.previewDurationMs && (!Number.isFinite(details.previewDurationMs) || details.previewDurationMs <= 0)) {
    delete details.previewDurationMs;
  }
  if (!details.previewDuration && details.previewDurationMs) {
    const seconds = details.previewDurationMs / 1000;
    if (Number.isFinite(seconds) && seconds > 0) {
      details.previewDuration = Math.round(seconds);
    }
  }
  if (details.previewDuration && (!Number.isFinite(details.previewDuration) || details.previewDuration <= 0)) {
    delete details.previewDuration;
  }
  if (details.id && !details.embedUrl) {
    details.embedUrl = `https://open.spotify.com/embed/track/${details.id}`;
  }

  return {
    title: details.title || "",
    artist: details.artist || "",
    album: details.album || "",
    cover: details.cover || "",
    duration: details.duration || null,
    searchQuery: details.searchQuery || details.title || "",
    id: details.id || null,
    previewUrl: details.previewUrl || "",
    previewDuration: details.previewDuration || null,
    previewDurationMs: details.previewDurationMs || null,
    embedUrl: details.embedUrl || "",
  };
};

const extractSoundcloudDetails = async (rawUrl) => {
  if (!rawUrl) return null;
  const url = rawUrl.trim();
  const args = [
    "--dump-single-json",
    "--skip-download",
    "--no-warnings",
    "--no-playlist",
    "--ignore-config",
    url,
  ];

  let entry = null;
  try {
    const json = await runYtDlpJson(args, { label: "soundcloud-info" });
    entry = Array.isArray(json?.entries) && json.entries.length ? json.entries[0] : json;
  } catch {
    entry = null;
  }

  const details = {};
  if (entry && typeof entry === "object") {
    details.title = entry.title || entry.track || entry.fulltitle || "";
    details.artist = entry.uploader || entry.creator || entry.author || "";
    details.album = entry.album || "";
    details.cover = extractBestThumbnail(entry);
    details.duration = Number.isFinite(entry.duration) ? Number(entry.duration) : null;
  }

  if (!details.title || !details.artist || !details.cover) {
    const endpoint = `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`;
    try {
      const resp = await safeFetch(endpoint, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0",
        },
      });
      if (resp.ok) {
        const data = await resp.json().catch(() => null);
        if (data && typeof data === "object") {
          const rawTitle = typeof data.title === "string" ? data.title.trim() : "";
          if (rawTitle) {
            const split = rawTitle.split(/\s+-\s+/);
            if (!details.artist && split.length > 1) {
              details.artist = split.shift().trim();
              details.title = split.join(" - ").trim() || details.title || rawTitle;
            } else if (!details.title) {
              details.title = rawTitle;
            }
          }
          if (!details.artist && typeof data.author_name === "string") {
            details.artist = data.author_name.trim();
          }
          if (!details.cover && typeof data.thumbnail_url === "string") {
            details.cover = data.thumbnail_url.trim();
          }
        }
      }
    } catch {
      // ignore oEmbed failure
    }
  }

  if (!details.searchQuery) {
    const parts = [details.title, details.artist].filter(Boolean);
    details.searchQuery = parts.join(" ").trim();
  }

  if (!details.title && !details.searchQuery) return null;

  return {
    title: details.title || "",
    artist: details.artist || "",
    album: details.album || "",
    cover: details.cover || "",
    duration: details.duration || null,
    searchQuery: details.searchQuery || details.title || "",
  };
};

const fetchVideoInfo = async ({ url, keyword, preferLang } = {}) => {
  const rawUrl = typeof url === "string" ? url.trim() : "";
  const rawKeyword = typeof keyword === "string" ? keyword.trim() : "";
  let target = rawUrl;
  let keywordUsed = false;
  const language = normalizePreferredLang(preferLang);
  let originalSource = null;

  if (rawUrl) {
    const sourceKind = identifyMediaSource(rawUrl);
    if (sourceKind === "spotify") {
      const spotifyDetails = await extractSpotifyDetails(rawUrl).catch(() => null);
      if (!spotifyDetails || !spotifyDetails.searchQuery) {
        throw new Error("Tidak bisa membaca metadata Spotify");
      }
      // Prioritaskan YouTube Music (ytmsearch), fallback ke YouTube biasa (ytsearch)
      // yt-dlp akan otomatis mencoba ytmsearch terlebih dahulu jika tersedia
      target = `ytmsearch1:${spotifyDetails.searchQuery}`;
      keywordUsed = true;
      originalSource = {
        type: "spotify",
        url: rawUrl,
        title: spotifyDetails.title,
        artist: spotifyDetails.artist,
        album: spotifyDetails.album,
        cover: spotifyDetails.cover,
        id: spotifyDetails.id || null,
        previewUrl: spotifyDetails.previewUrl || "",
        previewDuration: spotifyDetails.previewDuration || null,
        previewDurationMs: spotifyDetails.previewDurationMs || null,
        embedUrl: spotifyDetails.embedUrl || "",
        searchQuery: spotifyDetails.searchQuery || "",
      };
    } else if (sourceKind === "soundcloud") {
      const scDetails = await extractSoundcloudDetails(rawUrl).catch(() => null);
      originalSource = {
        type: "soundcloud",
        url: rawUrl,
        title: scDetails?.title,
        artist: scDetails?.artist,
        album: scDetails?.album,
        cover: scDetails?.cover,
      };
      if (scDetails?.searchQuery && !rawKeyword) {
        keywordUsed = false;
      }
    }
  }

  if (!target) {
    if (!rawKeyword) {
      throw new Error("URL atau kata kunci tidak valid");
    }
    keywordUsed = true;
    target = `ytsearch1:${rawKeyword}`;
  }

  const args = [
    "--dump-single-json",
    "--skip-download",
    "--no-warnings",
    "--default-search",
    "ytsearch",
    "--no-playlist",
  ];
  if (language) {
    args.push("--sub-lang", language);
  }
  if (existsSync(COOKIES_PATH)) {
    args.push("--cookies", COOKIES_PATH);
  }
  args.push("--js-runtimes", "node");
  args.push("--remote-components", "ejs:github");
  args.push(target);

  let entry;
  try {
    const json = await runYtDlpJson(args, { label: keywordUsed ? "ytsearch" : "info" });
    entry = Array.isArray(json?.entries) && json.entries.length ? json.entries[0] : json;
  } catch (err) {
    // Jika menggunakan ytmsearch dan gagal, coba fallback ke ytsearch biasa dengan query "judul artis audio"
    if (target && target.startsWith("ytmsearch") && originalSource?.type === "spotify") {
      // Update query untuk YouTube biasa: "judul artis audio"
      const spotifyTitle = (originalSource.title || "").trim();
      const spotifyArtist = (originalSource.artist || "").trim();
      const joined = [spotifyTitle, spotifyArtist, "audio"].filter(Boolean).join(" ").trim();
      const fallbackQuery = joined || target.replace("ytmsearch1:", "");
      const fallbackTarget = `ytsearch1:${fallbackQuery}`;
      const fallbackArgs = [
        "--dump-single-json",
        "--skip-download",
        "--no-warnings",
        "--default-search",
        "ytsearch",
        "--no-playlist",
      ];
      if (language) {
        fallbackArgs.push("--sub-lang", language);
      }
      if (existsSync(COOKIES_PATH)) {
        fallbackArgs.push("--cookies", COOKIES_PATH);
      }
      fallbackArgs.push("--js-runtimes", "node");
      fallbackArgs.push("--remote-components", "ejs:github");
      fallbackArgs.push(fallbackTarget);

      try {
        const fallbackJson = await runYtDlpJson(fallbackArgs, { label: "ytsearch-fallback" });
        entry = Array.isArray(fallbackJson?.entries) && fallbackJson.entries.length ? fallbackJson.entries[0] : fallbackJson;
        console.log("[spotify] YouTube Music tidak tersedia, menggunakan YouTube biasa");
      } catch (fallbackErr) {
        // Lanjut ke error handling berikutnya
        const apiFallback = await fetchVideoInfoFromYoutubeApi({ rawUrl, rawKeyword, language }).catch(() => null);
        if (apiFallback?.entry) {
          entry = apiFallback.entry;
          if (apiFallback.keywordUsed) keywordUsed = true;
        } else {
          const videoId = extractYouTubeVideoId(rawUrl || rawKeyword || "");
          const minimal = buildMinimalYoutubeEntry({ videoId, rawUrl, rawKeyword });
          if (minimal) {
            const enriched = await enrichMinimalYoutubeEntry(minimal, { rawUrl, rawKeyword }).catch(() => minimal);
            entry = enriched || minimal;
            if (!keywordUsed && rawKeyword && !rawUrl) keywordUsed = true;
            console.warn(
              `[video-info] menggunakan metadata minimal untuk ${videoId || rawUrl || rawKeyword}`,
            );
          } else {
            throw fallbackErr;
          }
        }
      }
    } else {
      const fallback = await fetchVideoInfoFromYoutubeApi({ rawUrl, rawKeyword, language }).catch(() => null);
      if (fallback?.entry) {
        entry = fallback.entry;
        if (fallback.keywordUsed) keywordUsed = true;
      } else {
        const videoId = extractYouTubeVideoId(rawUrl || rawKeyword || "");
        const minimal = buildMinimalYoutubeEntry({ videoId, rawUrl, rawKeyword });
        if (minimal) {
          const enriched = await enrichMinimalYoutubeEntry(minimal, { rawUrl, rawKeyword }).catch(() => minimal);
          entry = enriched || minimal;
          if (!keywordUsed && rawKeyword && !rawUrl) keywordUsed = true;
          console.warn(
            `[video-info] menggunakan metadata minimal untuk ${videoId || rawUrl || rawKeyword}`,
          );
        } else {
          throw err;
        }
      }
    }
  }
  if (!entry) {
    throw new Error("Video tidak ditemukan");
  }
  const metadata = buildVideoMetadata(entry, { requestedUrl: rawUrl, keywordUsed });
  if (metadata && entry.description && !metadata.description) {
    metadata.description = entry.description;
  }
  if (!metadata?.webpageUrl) {
    metadata.webpageUrl = rawUrl || metadata?.id ? `https://www.youtube.com/watch?v=${metadata.id}` : "";
  }
  if (originalSource) {
    metadata.originalSource = originalSource;
    // Untuk Spotify: SELALU gunakan metadata dari Spotify (cover HD, title, artist, album)
    // Flow: Spotify URL → Spotify Web API → UI pakai cover Spotify (HD) → searchQuery → YouTube → yt-dlp → hasil MP3/M4A pakai metadata Spotify
    // Mirip dengan SoundCloud - cover dari Spotify, bukan dari YouTube
    if (originalSource.type === "spotify") {
      // HAPUS cover dari YouTube terlebih dahulu (jangan pakai cover YouTube untuk Spotify)
      metadata.cover = "";
      metadata.thumbnail = "";
      if (metadata.id3) {
        metadata.id3.cover = "";
      }

      // Cover Spotify (HD) - SELALU digunakan
      // Spotify API returns images sorted by size (largest first), so images[0] is HD
      if (originalSource.cover) {
        // Set cover Spotify untuk UI dan download cover
        metadata.cover = originalSource.cover;
        metadata.thumbnail = originalSource.cover;
        // Pastikan ID3 juga pakai cover Spotify
        if (metadata.id3) {
          metadata.id3.cover = originalSource.cover;
        }
      }
      // Title, artist, album dari Spotify - SELALU digunakan
      if (originalSource.title) {
        metadata.title = originalSource.title;
        metadata.cleanTitle = originalSource.title;
      }
      if (originalSource.artist) metadata.artist = originalSource.artist;
      if (originalSource.album) metadata.album = originalSource.album;
    } else {
      // Untuk source lain (YouTube, SoundCloud, dll), gunakan fallback seperti sebelumnya
      if (!metadata.cover && originalSource.cover) metadata.cover = originalSource.cover;
      if (!metadata.artist && originalSource.artist) metadata.artist = originalSource.artist;
      if (!metadata.album && originalSource.album) metadata.album = originalSource.album;
    }
    if (!metadata.id3) metadata.id3 = {};
    if (metadata.id3) {
      // Untuk Spotify: SELALU gunakan metadata dari Spotify untuk ID3 tags
      if (originalSource.type === "spotify") {
        if (originalSource.title) metadata.id3.title = originalSource.title;
        if (originalSource.artist) metadata.id3.artist = originalSource.artist;
        if (originalSource.album) metadata.id3.album = originalSource.album;
        if (originalSource.cover) metadata.id3.cover = originalSource.cover; // Cover Spotify HD untuk ID3
      } else {
        // Fallback untuk source lain
        if (!metadata.id3.title && originalSource.title) metadata.id3.title = originalSource.title;
        if (!metadata.id3.artist && originalSource.artist) metadata.id3.artist = originalSource.artist;
        if (!metadata.id3.album && originalSource.album) metadata.id3.album = originalSource.album;
        if (!metadata.id3.cover && originalSource.cover) metadata.id3.cover = originalSource.cover;
      }
    }
    if (originalSource.previewUrl) {
      if (!metadata.preview || typeof metadata.preview !== "object") metadata.preview = {};
      metadata.preview.url = originalSource.previewUrl;
      metadata.preview.provider = originalSource.type || metadata.preview.provider || "spotify";
      metadata.preview.type = metadata.preview.type || "audio";
      if (originalSource.embedUrl) metadata.preview.embedUrl = originalSource.embedUrl;
      if (originalSource.previewDuration && !metadata.preview.duration) {
        metadata.preview.duration = originalSource.previewDuration;
      }
      if (originalSource.previewDurationMs && !metadata.preview.durationMs) {
        metadata.preview.durationMs = originalSource.previewDurationMs;
      }
    }
  }
  return metadata;
};

const searchYoutubeVideos = async ({ query, limit = 6, preferLang } = {}) => {
  const rawQuery = typeof query === "string" ? query.trim() : "";
  if (!rawQuery) {
    throw new Error("Kata kunci pencarian kosong");
  }
  const clamped = clamp(Number(limit) || 6, 1, 15);
  const target = `ytsearch${clamped}:${rawQuery}`;
  const language = normalizePreferredLang(preferLang);
  const args = [
    "--dump-single-json",
    "--skip-download",
    "--no-warnings",
    "--default-search",
    "ytsearch",
    "--no-playlist",
  ];
  if (language) {
    args.push("--sub-lang", language);
  }
  if (existsSync(COOKIES_PATH)) {
    args.push("--cookies", COOKIES_PATH);
  }
  args.push(target);

  try {
    const json = await runYtDlpJson(args, { label: "search" });
    const entries = Array.isArray(json?.entries) ? json.entries : [];
    return entries
      .filter(Boolean)
      .slice(0, clamped)
      .map((entry) => buildVideoMetadata(entry, { keywordUsed: true }))
      .filter(Boolean);
  } catch (err) {
    const fallback = await searchYoutubeVideosFromApi({ query: rawQuery, limit: clamped, language }).catch(() => null);
    if (fallback !== null) {
      return fallback;
    }
    const fallbackId = extractYouTubeVideoId(rawQuery);
    if (fallbackId) {
      const minimal = buildMinimalYoutubeEntry({ videoId: fallbackId, rawUrl: rawQuery, rawKeyword: rawQuery });
      const enriched = minimal ? await enrichMinimalYoutubeEntry(minimal, { rawUrl: rawQuery, rawKeyword: rawQuery }).catch(() => minimal) : null;
      const source = enriched || minimal;
      const meta = source ? buildVideoMetadata(source, { keywordUsed: false }) : null;
      if (meta) {
        console.warn(`[search] menggunakan fallback minimal untuk ${fallbackId}`);
        return [meta];
      }
    }
    throw err;
  }
};

const toPositiveInt = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.round(num);
};

const parseSampleRate = (value) => toPositiveInt(value);

const resolvePublicPath = (urlPath = "") => {
  if (typeof urlPath !== "string") return null;
  const cleaned = urlPath.replace(/\\/g, "/").trim();
  if (!cleaned.startsWith("/public/")) return null;
  const relative = cleaned.slice("/public/".length);
  const fullPath = pathResolve(PUBLIC_ROOT, relative);
  if (!fullPath.startsWith(PUBLIC_ROOT)) return null;
  return fullPath;
};

const buildAbsolutePublicUrl = (path = "") => {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const baseCandidates = [
    process.env.PUBLIC_BASE_URL,
    process.env.NOTIFY_PUBLIC_URL,
    process.env.APP_BASE_URL,
    process.env.RAILWAY_STATIC_URL,
    process.env.RAILWAY_PUBLIC_DOMAIN,
    process.env.RAILWAY_URL,
    DEFAULT_PUBLIC_BASE_URL,
  ];
  for (const candidate of baseCandidates) {
    const normalized = normalizeBaseUrl(candidate);
    if (!normalized) continue;
    try {
      return new URL(path, normalized).toString();
    } catch {
      continue;
    }
  }
  return path;
};

const probeAudioStream = async (inputPath) => {
  if (!inputPath) return null;
  const args = [
    "-v",
    "error",
    "-select_streams",
    "a:0",
    "-show_entries",
    "stream=sample_rate,channels",
    "-of",
    "json",
    inputPath,
  ];
  return await new Promise((resolve) => {
    const ffprobeBin = ffprobePath || "ffprobe";
    const proc = spawn(ffprobeBin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    proc.stdout.on("data", (d) => {
      output += d.toString();
    });
    proc.on("error", () => resolve(null));
    proc.on("close", (code) => {
      if (code !== 0) return resolve(null);
      try {
        const json = JSON.parse(output || "{}");
        const stream = Array.isArray(json.streams) ? json.streams[0] : null;
        if (!stream) return resolve(null);
        const sampleRate = parseSampleRate(stream.sample_rate);
        const channels = toPositiveInt(stream.channels);
        resolve({ sampleRate, channels });
      } catch {
        resolve(null);
      }
    });
  });
};

const probeAudioLoudness = async (inputPath) => {
  if (!inputPath) return null;
  const args = [
    "-nostats",
    "-i", inputPath,
    "-map", "a:0",
    "-filter:a", "ebur128=peak=true",
    "-f", "null",
    "-"
  ];
  return await new Promise((resolve) => {
    const bin = ffmpegPath || "ffmpeg";
    const proc = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (d) => stderr += d.toString());
    proc.on("error", (err) => {
      console.error(`[Probe Error] Failed to spawn ffmpeg for ${inputPath}:`, err);
      resolve(null);
    });
    proc.on("close", (code) => {
      // Allow code 0 or generic error if we can parse stats
      // ffmpeg might exit with non-zero on some warnings but still output stats
      try {
        const iMatch = /Integrated loudness:\s+I:\s+([-\d\.]+)\s+LUFS/.exec(stderr);
        const peakMatch = /True peak:\s+Peak:\s+([-\d\.]+)\s+(dBTP|dBFS)/.exec(stderr);
        const lraMatch = /Loudness range:\s+LRA:\s+([-\d\.]+)\s+LU/.exec(stderr);

        if (!iMatch) {
          console.log(`[Probe Warning] No loudness stats found for ${inputPath}`);
          console.log('Stderr dump:', stderr.slice(-1000));
          return resolve(null);
        }

        const result = {
          lufs: parseFloat(iMatch[1]),
          peak: peakMatch ? parseFloat(peakMatch[1]) : null,
          lra: lraMatch ? parseFloat(lraMatch[1]) : null
        };
        console.log(`[Probe Success] Analyzed ${inputPath}:`, JSON.stringify(result));
        resolve(result);
      } catch (e) {
        console.error(`[Probe Exception] Error parsing output for ${inputPath}:`, e);
        resolve(null);
      }
    });
  });
};

const generateWaveformData = async (inputPath, points = 100) => {
  if (!inputPath) return [];
  const args = [
    "-nostats",
    "-i", inputPath,
    "-ac", "1",
    "-filter:a", "aresample=200",
    "-map", "0:a",
    "-c:a", "pcm_u8",
    "-f", "data",
    "-"
  ];

  return await new Promise((resolve) => {
    const bin = ffmpegPath || "ffmpeg";
    const proc = spawn(bin, args, { stdio: ["ignore", "pipe", "ignore"] });
    const chunks = [];

    proc.stdout.on("data", (chunk) => chunks.push(chunk));
    proc.on("error", () => resolve([]));

    proc.on("close", () => {
      const buffer = Buffer.concat(chunks);
      if (buffer.length === 0) return resolve([]);

      const data = [];
      const step = Math.ceil(buffer.length / points);

      for (let i = 0; i < points; i++) {
        let max = 0;
        const start = i * step;
        const end = Math.min(start + step, buffer.length);

        for (let j = start; j < end; j++) {
          const val = Math.abs(buffer[j] - 128);
          if (val > max) max = val;
        }
        data.push(parseFloat((max / 128).toFixed(2)));
      }
      resolve(data);
    });
  });
};

const GENRE_KEYWORDS = [
  { rx: /(lo[-\s]?fi|study|chillhop|coffee shop)/i, value: "Lo-Fi" },
  { rx: /(hip\s?hop|rap)/i, value: "Hip-Hop" },
  { rx: /(trap|808|drill)/i, value: "Trap" },
  { rx: /(edm|electro|dance|club|festival)/i, value: "EDM" },
  { rx: /(rock|guitar|band)/i, value: "Rock" },
  { rx: /(metal|screamo|hardcore)/i, value: "Metal" },
  { rx: /(jazz|swing|sax)/i, value: "Jazz" },
  { rx: /(lofi|sleep|relax|ambient|meditation)/i, value: "Ambient" },
  { rx: /(piano|violin|orchestra|symphony)/i, value: "Classical" },
  { rx: /(k\-?pop|kpop)/i, value: "K-Pop" },
  { rx: /(dangdut|koplo)/i, value: "Dangdut" },
];

const MOOD_KEYWORDS = [
  { rx: /(happy|joy|summer|sunshine)/i, value: "Happy" },
  { rx: /(sad|heartbreak|galau|melancholy|cry)/i, value: "Melancholy" },
  { rx: /(relax|calm|sleep|study|focus)/i, value: "Chill" },
  { rx: /(epic|cinematic|battle|orchestra)/i, value: "Epic" },
  { rx: /(rain|night|midnight|lofi)/i, value: "Midnight" },
  { rx: /(pump|gym|workout|power)/i, value: "Hype" },
];

const ENERGY_KEYWORDS = [
  { rx: /(sleep|ambient|relax|asmr)/i, value: "Low" },
  { rx: /(lofi|study|chill|coffee)/i, value: "Medium" },
  { rx: /(edm|nightcore|dance|club|hard|festival|live)/i, value: "High" },
];

const pickFromKeywords = (text, rules, fallback) => {
  for (const rule of rules) {
    if (rule.rx.test(text)) return rule.value;
  }
  return fallback;
};

const buildAiTags = ({ title = "", description = "", channel = "", duration } = {}) => {
  const combined = `${title}\n${description}\n${channel}`;
  const genre = pickFromKeywords(combined, GENRE_KEYWORDS, "Pop");
  const mood = pickFromKeywords(combined, MOOD_KEYWORDS, duration && duration > 360 ? "Calm" : "Energetic");
  let energy = pickFromKeywords(combined, ENERGY_KEYWORDS, duration && duration > 420 ? "Medium" : "High");
  if (/acoustic|piano|ambient/i.test(combined)) energy = "Low";
  const yearMatch = /(20\d{2}|19\d{2})/.exec(description) || /(20\d{2}|19\d{2})/.exec(title);
  const year = yearMatch ? yearMatch[1] : undefined;

  const cleanTitle = title.replace(/\[[^\]]+\]/g, "").replace(/\([^)]*official[^)]*\)/ig, "").trim();
  const suggestedTitle = cleanTitle || title;
  const suggestedAlbum = suggestedTitle;
  const suggestedArtist = channel?.trim() || undefined;

  const tags = {
    title: suggestedTitle,
    artist: suggestedArtist,
    album: suggestedAlbum,
    genre,
    mood,
    energy,
  };
  if (year) tags.year = year;
  tags.comment = `AI tags · ${genre} · ${mood}${year ? ` · ${year}` : ""}`;
  return tags;
};

const formatDurationLabel = (seconds) => {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (value < 60) return `${Math.round(value)}s`;
  const minutes = Math.floor(value / 60);
  const secs = Math.round(value % 60);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h${mins ? ` ${mins}m` : ""}`.trim();
  }
  return `${minutes}m${secs ? ` ${secs}s` : ""}`.trim();
};

const slugifyTag = (value) => {
  if (!value) return null;
  const slug = value
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
  return slug || null;
};

const MOOD_EMOJIS = {
  Happy: "😊",
  Chill: "😌",
  Melancholy: "💜",
  Epic: "🔥",
  Midnight: "🌙",
  Hype: "⚡️",
  Calm: "🌿",
  Energetic: "🚀",
};

const MOOD_PLAYLIST_HINTS = {
  Happy: ["Feel Good Hits", "Sunrise Drive"],
  Chill: ["Focus Flow", "Coffee & Beats"],
  Melancholy: ["Late Night Lyrics", "Deep Focus"],
  Epic: ["Cinematic Adventure", "Boss Battle"],
  Midnight: ["Midnight Lounge", "Night Riders"],
  Hype: ["Beast Mode", "Workout Bangers"],
  Calm: ["Peaceful Piano", "Sleep Tight"],
  Energetic: ["Dance Party", "Cardio Boost"],
};

const GENRE_PLAYLIST_HINTS = {
  "Lo-Fi": ["Lo-Fi Cafe", "Study Session"],
  "Hip-Hop": ["Rap Radar"],
  Trap: ["Trap Nation"],
  EDM: ["Festival Bangers"],
  Rock: ["Alternative Anthems"],
  Metal: ["Heavy Rotation"],
  Jazz: ["Late Night Jazz"],
  Ambient: ["Deep Focus"],
  Classical: ["Cinematic Scores"],
  "K-Pop": ["K-Pop Now"],
  Dangdut: ["Dangdut Hits"],
  Pop: ["Today's Top Hits"],
};

const HOOK_GENRE_EMOJI = {
  EDM: "⚡️",
  "Lo-Fi": "🌙",
  "Hip-Hop": "🎤",
  Trap: "🔥",
  Rock: "🎸",
  Pop: "🎶",
  Jazz: "🎷",
  Ambient: "🌧️",
  Classical: "🎻",
  Dangdut: "🥁",
  "K-Pop": "💖",
};

const COVER_PRESETS = {
  EDM: {
    style: "Neon cyberpunk poster",
    visuals: "laser beams, silhouette crowd, futuristic city skyline",
    lighting: "Backlit neon glow",
    texture: "Chromatic aberration + subtle grain",
    vibe: "Festival energy",
    palette: [
      { hex: "#FF4ECD", label: "Magenta neon" },
      { hex: "#09FBD3", label: "Aqua laser" },
      { hex: "#08070B", label: "Deep midnight" },
    ],
  },
  "Lo-Fi": {
    style: "Cozy illustrated cassette cover",
    visuals: "window view, rain-streaked glass, desk setup with headphones",
    lighting: "Warm lamp light",
    texture: "Paper grain + soft blur",
    vibe: "Study & chill",
    palette: [
      { hex: "#D4A373", label: "Warm latte" },
      { hex: "#264653", label: "Deep teal" },
      { hex: "#2A9D8F", label: "Seafoam accent" },
    ],
  },
  "Hip-Hop": {
    style: "Bold street collage",
    visuals: "boom box, graffiti backdrop, dynamic typography",
    lighting: "High contrast spotlight",
    texture: "Ripped paper + spray paint",
    vibe: "Block party hype",
    palette: [
      { hex: "#FF8A00", label: "Amber pop" },
      { hex: "#161616", label: "Concrete black" },
      { hex: "#FFD60A", label: "Tape highlight" },
    ],
  },
  Rock: {
    style: "Gritty live stage poster",
    visuals: "guitar silhouette, stage smoke, crowd hands",
    lighting: "Crimson spotlight",
    texture: "Distressed paper + halftone",
    vibe: "Raw performance",
    palette: [
      { hex: "#F94144", label: "Stage red" },
      { hex: "#1B1B1B", label: "Amp black" },
      { hex: "#F3722C", label: "Amber flare" },
    ],
  },
  Ambient: {
    style: "Minimal gradient mist",
    visuals: "soft fog layers, floating geometric shapes",
    lighting: "Diffused dawn glow",
    texture: "Bloom + smooth blur",
    vibe: "Meditative soundscape",
    palette: [
      { hex: "#8ECAE6", label: "Sky blue" },
      { hex: "#023047", label: "Deep ocean" },
      { hex: "#CAD2C5", label: "Cloud mist" },
    ],
  },
  Jazz: {
    style: "Retro lounge poster",
    visuals: "sax silhouette, vinyl curves, smoky gradients",
    lighting: "Golden hour spotlight",
    texture: "Soft grain + silk paper",
    vibe: "Late night swing",
    palette: [
      { hex: "#F9C74F", label: "Brass gold" },
      { hex: "#90BE6D", label: "Olive accent" },
      { hex: "#577590", label: "Midnight blue" },
    ],
  },
  Dangdut: {
    style: "Festive batik fusion",
    visuals: "dynamic dancer silhouette, batik-inspired patterns, stage lights",
    lighting: "Vibrant spotlight sweep",
    texture: "Foil shimmer + grain",
    vibe: "Panggung hajatan",
    palette: [
      { hex: "#FF9F1C", label: "Sunset orange" },
      { hex: "#FFBF69", label: "Champagne shimmer" },
      { hex: "#2EC4B6", label: "Turquoise pop" },
    ],
  },
  Pop: {
    style: "Glossy pastel poster",
    visuals: "floating shapes, bold sans-serif title, sparkles",
    lighting: "Studio beauty light",
    texture: "Soft gloss + tiny glitter",
    vibe: "Chart-ready polish",
    palette: [
      { hex: "#FF80AB", label: "Candy pink" },
      { hex: "#845EC2", label: "Violet depth" },
      { hex: "#00C9A7", label: "Mint pop" },
    ],
  },
  default: {
    style: "Modern streaming cover",
    visuals: "abstract gradients, floating typography, subtle motion blur",
    lighting: "Soft rim light",
    texture: "Fine grain + bloom",
    vibe: "Clean digital aesthetic",
    palette: [
      { hex: "#FF6B6B", label: "Coral highlight" },
      { hex: "#5F27CD", label: "Indigo depth" },
      { hex: "#0B132B", label: "Night base" },
    ],
  },
};

const buildAiCaption = ({
  title = "",
  channel = "",
  duration,
  speedMode = "normal",
  denoise = false,
  volumeBoost = 0,
  enhancer = "none",
  format = "",
} = {}) => {
  const tags = buildAiTags({ title, channel, duration });
  const trackTitle = tags.title || title || "Track Baru";
  const artist = tags.artist || channel || "Creator";
  const moodEmoji = MOOD_EMOJIS[tags.mood] || "🎧";
  const detailParts = [];
  if (tags.genre) detailParts.push(tags.genre);
  if (tags.mood) detailParts.push(tags.mood);
  if (tags.energy) detailParts.push(tags.energy);
  const durationLabel = formatDurationLabel(duration);
  if (durationLabel) detailParts.push(durationLabel);

  const tweaks = [];
  if (speedMode === "nightcore") tweaks.push("Nightcore tempo");
  else if (speedMode === "slow_reverb") tweaks.push("Slowed + reverb vibes");
  if (denoise) tweaks.push("Noise cleaned");
  const boostVal = Number(volumeBoost);
  if (Number.isFinite(boostVal) && boostVal > 0) tweaks.push(`+${boostVal} dB boost`);
  if (enhancer && enhancer !== "none") {
    const enhancerLabels = {
      clarity: "Clarity enhancer",
      warm: "Warm tone",
      club: "Club lift",
    };
    tweaks.push(enhancerLabels[enhancer] || `Enhancer: ${enhancer}`);
  }

  const captionLines = [`${moodEmoji} ${trackTitle} — ${artist}`];
  if (detailParts.length) captionLines.push(detailParts.join(" · "));
  if (tweaks.length) captionLines.push(`Tweak: ${tweaks.join(", ")}`);
  captionLines.push("Scan QR di web atau klik link buat dengar sekarang.");

  const hashtags = new Set(["#music"]);
  const pushTag = (value) => {
    const slug = slugifyTag(value);
    if (!slug) return;
    hashtags.add(`#${slug}`);
  };

  [tags.genre, tags.mood, tags.energy, artist, format].forEach(pushTag);
  if (speedMode === "nightcore") hashtags.add("#nightcore");
  else if (speedMode === "slow_reverb") hashtags.add("#slowedreverb");
  if (denoise) hashtags.add("#noiseclean");
  if (boostVal > 0) hashtags.add("#volumeboost");

  const titleParts = trackTitle.split(/\s+/).slice(0, 2);
  titleParts.forEach(pushTag);

  const hashtagList = Array.from(hashtags).filter(Boolean).slice(0, 8);
  return { caption: captionLines.join("\n"), hashtags: hashtagList, tags };
};

const buildAiPitch = ({
  title = "",
  description = "",
  channel = "",
  duration,
  genre,
  mood,
} = {}) => {
  const tags = buildAiTags({ title, description, channel, duration });
  if (genre && typeof genre === "string" && genre.trim()) tags.genre = genre.trim();
  if (mood && typeof mood === "string" && mood.trim()) tags.mood = mood.trim();
  const trackTitle = tags.title || title || "Track Baru";
  const artist = tags.artist || channel || "Creator";
  const descriptorParts = [tags.genre, tags.mood, tags.energy].filter(Boolean);
  const descriptor = descriptorParts.length ? descriptorParts.join(" · ") : null;
  const durationLabel = formatDurationLabel(duration);
  const playlistHints = new Set();
  if (tags.mood && MOOD_PLAYLIST_HINTS[tags.mood]) {
    for (const item of MOOD_PLAYLIST_HINTS[tags.mood]) playlistHints.add(item);
  }
  if (tags.genre && GENRE_PLAYLIST_HINTS[tags.genre]) {
    for (const item of GENRE_PLAYLIST_HINTS[tags.genre]) playlistHints.add(item);
  }
  const playlists = Array.from(playlistHints).slice(0, 4);
  const hookMood = tags.mood ? tags.mood.toLowerCase() : "fresh";
  const hookGenre = tags.genre ? `${tags.genre.toLowerCase()} groove` : "sonic palette";
  const hook = `${trackTitle} menghadirkan nuansa ${hookMood} dengan ${hookGenre}${durationLabel ? ` dalam ${durationLabel}` : ""}.`;
  const pitchLines = [];
  if (descriptor) {
    pitchLines.push(`${trackTitle} oleh ${artist} memadukan ${descriptor}${durationLabel ? ` sepanjang ${durationLabel}` : ""}.`);
  } else {
    pitchLines.push(`${trackTitle} oleh ${artist}${durationLabel ? ` (${durationLabel})` : ""}.`);
  }
  if (playlists.length) {
    pitchLines.push(`Cocok untuk playlist ${playlists.join(", ")}.`);
  } else {
    pitchLines.push("Siap melengkapi daftar putar favoritmu.");
  }
  return {
    pitch: pitchLines.join(" "),
    hook,
    playlists,
    tags,
  };
};

const pickAudiophileProfile = (tags = {}) => {
  const genre = (tags.genre || "").toLowerCase();
  const mood = (tags.mood || "").toLowerCase();

  if (/(hip[- ]?hop|trap|edm|house|dance|dubstep|electro|bass|club)/.test(genre) || /(energetic|hype|club)/.test(mood)) {
    return {
      focus: "Bass Impact & Groove",
      summary: "{{TRACK}}: Fokus pada sub-bass rapat tanpa mengorbankan vokal utama.",
      eq: [
        "Low-shelf +3 dB di ~60 Hz (Q ≈ 1.0) untuk dorongan sub-bass.",
        "Potong -1.5 dB di 250 Hz (Q ≈ 1.2) agar low-mid tidak muddy.",
        "High-shelf +1 dB mulai 9 kHz supaya hi-hat tetap berkilau.",
      ],
      playback: [
        "Gunakan headphone closed-back dengan seal rapat atau speaker + sub aktif.",
        "Jaga level master sekitar -6 dBFS sebelum limiter agar transien kick tetap utuh.",
      ],
      enhancements: [
        "Periksa fase L/R di bawah 80 Hz agar bass tetap terpusat.",
      ],
    };
  }

  if (/(jazz|acoustic|folk|classical|ambient|lo[- ]?fi|lofi|blues|soul|ballad|r\u0026b|r&b)/.test(genre) || /(calm|chill|midnight|melancholy)/.test(mood)) {
    return {
      focus: "Detail & Stage Depth",
      summary: "{{TRACK}}: Prioritaskan midrange alami dan ruang ambience yang luas.",
      eq: [
        "High-pass lembut di 28 Hz (Q ≈ 0.7) untuk membersihkan rumble.",
        "Angkat +2 dB di 3 kHz (Q ≈ 1.1) demi artikulasi vokal/instrumen utama.",
        "Air boost +1.5 dB di 12 kHz dengan shelf lebar untuk nuansa udara.",
      ],
      playback: [
        "Monitor memakai headphone open-back atau nearfield dengan tweeter halus untuk imaging akurat.",
        "Posisikan diri membentuk segitiga sama sisi dengan speaker untuk kedalaman panggung terbaik.",
      ],
      enhancements: [
        "Tambahkan reverb kamar <1.2s seperlunya agar kedalaman bertambah tanpa menutup detail.",
      ],
    };
  }

  if (/(rock|metal|punk|indie|alternative)/.test(genre) || /(epic)/.test(mood)) {
    return {
      focus: "Midrange Punch & Presence",
      summary: "{{TRACK}}: Jaga serangan gitar dan vokal tanpa menusuk telinga.",
      eq: [
        "Cut -2 dB di 3.5 kHz (Q ≈ 2) bila gitar terlalu tajam.",
        "Boost +2 dB di 120 Hz (Q ≈ 1.0) untuk menambah bobot kick & bass.",
        "Shelf +1 dB di 8 kHz supaya cymbal tetap hidup.",
      ],
      playback: [
        "Gunakan monitor dengan respon cepat atau headphone semi-open untuk mengecek distorsi.",
        "Periksa kompatibilitas mono agar gitar ganda tidak saling membatalkan.",
      ],
      enhancements: [
        "Kompresi bus 2–3 dB cukup untuk menjaga energi tanpa meratakan dinamika.",
      ],
    };
  }

  return {
    focus: "Balanced Clarity",
    summary: "{{TRACK}}: Pertahankan keseimbangan frekuensi yang nyaman di berbagai perangkat.",
    eq: [
      "High-pass 25 Hz untuk membuang subsonik yang tidak terdengar.",
      "Tambahkan +1.5 dB di 2.5 kHz (Q ≈ 1.0) guna meningkatkan intelligibility.",
      "High-shelf lembut +1 dB di 10 kHz agar udara tetap hadir.",
    ],
    playback: [
      "Cross-check di speaker kecil atau earbuds supaya mid tetap jelas.",
      "Kalibrasi level monitoring sekitar 79 dB SPL agar telinga tidak cepat lelah.",
    ],
    enhancements: [
      "Aktifkan dither saat downsample untuk menjaga detail halus.",
    ],
  };
};

const buildAiAudiophileGuide = ({
  title = "",
  channel = "",
  duration,
  genre,
  mood,
  format = "",
  sampleRate,
  speedMode = "normal",
  enhancer = "none",
  denoise = false,
  volumeBoost = 0,
  normalize = false,
} = {}) => {
  const tags = buildAiTags({ title, channel, duration });
  if (genre && typeof genre === "string" && genre.trim()) tags.genre = genre.trim();
  if (mood && typeof mood === "string" && mood.trim()) tags.mood = mood.trim();

  const profile = pickAudiophileProfile(tags);
  const eq = [...(profile.eq || [])];
  const playback = [...(profile.playback || [])];
  const enhancements = [...(profile.enhancements || [])];

  const trackTitle = tags.title || title || "Track";
  const artist = tags.artist || channel || "Artist";
  const summary = (profile.summary || "{{TRACK}}").replace(/\{\{TRACK\}\}/g, `${trackTitle} — ${artist}`);

  const fmt = (format || "").toLowerCase();
  const sr = Number(sampleRate);
  let sampleAdvice;
  if (fmt === "flac" || fmt === "wav") {
    if (Number.isFinite(sr) && sr >= 96000) {
      sampleAdvice = "Pertahankan 96 kHz lossless untuk headroom mixing dan arsip.";
    } else {
      sampleAdvice = "Render lossless minimal 48 kHz; gunakan 96 kHz bila sumber dan perangkat mendukung.";
    }
  } else if (fmt === "m4a") {
    sampleAdvice = "Gunakan 44.1 kHz AAC agar encoder paling efisien dan kompatibel.";
  } else if (fmt === "mp3") {
    sampleAdvice = "Kunci di 48 kHz maksimum — MP3 tidak stabil di atas 48 kHz.";
  } else if (Number.isFinite(sr) && sr > 0) {
    sampleAdvice = `Jaga ${Math.round(sr)} Hz dan aktifkan dither saat downsample supaya detail terpelihara.`;
  } else {
    sampleAdvice = "Pertahankan minimal 48 kHz agar detail high-end tidak hilang di berbagai player.";
  }

  const durationLabel = formatDurationLabel(duration);
  if (durationLabel) {
    playback.push(`Durasi konten ${durationLabel} — cek konsistensi gain sepanjang track.`);
  }
  if (tags.mood) playback.push(`Mood terdeteksi: ${tags.mood}. Sesuaikan ambience ruangan agar nuansanya tersampaikan.`);
  if (tags.energy) playback.push(`Level energi: ${tags.energy}. Atur volume playback supaya tidak melelahkan telinga.`);

  if (speedMode === "nightcore") {
    eq.push("Tambahkan low-shelf +1 dB di 120 Hz untuk mengisi tubuh setelah pitch-up nightcore.");
    enhancements.push("Gunakan low-pass halus di 17 kHz bila terdengar aliasing akibat percepatan.");
  } else if (speedMode === "slow_reverb") {
    eq.push("High-shelf +1.5 dB di 10 kHz menjaga kilau setelah slowed + reverb.");
    enhancements.push("High-pass 30 Hz pasca reverb untuk mencegah build-up frekuensi rendah.");
  }

  const boostVal = Number(volumeBoost);
  if (Number.isFinite(boostVal) && boostVal > 0) {
    enhancements.push(`Boost +${boostVal} dB telah diterapkan — sisakan headroom minimal 1 dBTP agar tidak clip.`);
  }
  if (normalize) enhancements.push("Normalisasi aktif — targetkan -14 LUFS untuk streaming atau -9 LUFS untuk club set.");
  if (denoise) enhancements.push("Denoise aktif — setel threshold ringan agar high-hat tidak ikut hilang.");

  if (enhancer && enhancer !== "none") {
    const enhancerNotes = {
      clarity: "Mode Clarity menonjolkan vokal & hi-hat — cocok untuk fokus detail.",
      warm: "Mode Warm menambah harmonik mid, ideal untuk rekaman analog atau vokal mellow.",
      club: "Mode Club menaikkan low-mid; awasi limiter agar punch tidak pecah.",
    };
    enhancements.push(enhancerNotes[enhancer] || `Gunakan enhancer ${enhancer} seperlunya.`);
  }

  return {
    focus: profile.focus,
    summary,
    sampleRate: sampleAdvice,
    eq,
    playback,
    enhancements,
    tags,
  };
};

const buildAiHook = ({
  title = "",
  channel = "",
  duration,
  genre,
  speedMode = "normal",
  volumeBoost = 0,
  enhancer = "none",
  denoise = false,
  eq = {},
} = {}) => {
  const tags = buildAiTags({ title, channel, duration });
  if (genre && typeof genre === "string" && genre.trim()) tags.genre = genre.trim();
  const trackTitle = tags.title || title || "Track Baru";
  const artist = tags.artist || channel || "Creator";
  const emoji = HOOK_GENRE_EMOJI[tags.genre] || MOOD_EMOJIS[tags.mood] || "✨";
  const moodLabel = tags.mood ? `${tags.mood.toLowerCase()} mood` : "fresh mood";
  const energyLabel = tags.energy ? `${tags.energy.toLowerCase()} energy` : "dynamic energy";

  const tweaks = [];
  if (speedMode === "nightcore") tweaks.push("nightcore tempo");
  else if (speedMode === "slow_reverb") tweaks.push("slowed + reverb feel");
  const boostVal = Number(volumeBoost);
  if (Number.isFinite(boostVal) && boostVal > 0) tweaks.push(`+${boostVal} dB boost`);
  if (enhancer && enhancer !== "none") {
    const enhancerLabels = {
      clarity: "vocal clarity",
      warm: "warm glow",
      club: "club lift",
    };
    tweaks.push(enhancerLabels[enhancer] || `enhancer: ${enhancer}`);
  }
  if (denoise) tweaks.push("noise cleaned");

  const eqHighlights = [];
  const bassVal = Number(eq?.bass ?? 0);
  const midVal = Number(eq?.mid ?? 0);
  const trebleVal = Number(eq?.treble ?? 0);
  if (bassVal > 2) eqHighlights.push("deep bass impact");
  else if (bassVal < -2) eqHighlights.push("tight low-end");
  if (midVal > 2) eqHighlights.push("forward mids for vocals");
  if (trebleVal > 2) eqHighlights.push("sparkling high-end shimmer");

  const studioLine = [...eqHighlights, ...tweaks].length
    ? `Studio touch: ${[...eqHighlights, ...tweaks].join(', ')}.`
    : null;

  const hooks = [
    `${emoji} ${trackTitle} by ${artist} menghadirkan ${moodLabel} dengan ${energyLabel}.`,
  ];
  if (studioLine) hooks.push(studioLine);
  hooks.push("Tap & dengarkan sekarang — biar vibe-nya takeover harimu!");

  const ctas = [
    "🎧 Dengerin sekarang",
    "💾 Save ke playlist favoritmu",
  ];
  if (tags.energy === "High" || tags.mood === "Hype") ctas.push("🔥 Share ke geng untuk boost semangat");
  else ctas.push("✨ Jadikan soundtrack aktivitasmu");

  const hashtags = new Set();
  [tags.genre, tags.mood, tags.energy, artist].forEach((value) => {
    const slug = slugifyTag(value);
    if (slug) hashtags.add(`#${slug}`);
  });
  if (speedMode === "nightcore") hashtags.add("#nightcore");
  if (speedMode === "slow_reverb") hashtags.add("#slowedreverb");

  const focus = tags.genre && tags.mood ? `${tags.genre} · ${tags.mood}` : null;

  return {
    hooks: hooks.slice(0, 3),
    ctas: ctas.slice(0, 3),
    hashtags: Array.from(hashtags).slice(0, 5),
    tone: `${tags.mood || 'Fresh'} ${tags.genre || ''}`.trim(),
    emoji,
    focus,
  };
};

const buildAiCoverPrompt = ({
  title = "",
  channel = "",
  duration,
  genre,
  format = "",
  speedMode = "normal",
  enhancer = "none",
  volumeBoost = 0,
  denoise = false,
  normalize = false,
  eq = {},
} = {}) => {
  const tags = buildAiTags({ title, channel, duration });
  if (genre && typeof genre === "string" && genre.trim()) tags.genre = genre.trim();
  const trackTitle = tags.title || title || "Track Baru";
  const artist = tags.artist || channel || "Creator";
  const preset = COVER_PRESETS[tags.genre] || COVER_PRESETS.default;
  const moodDescriptor = tags.mood ? `${tags.mood.toLowerCase()} mood` : "modern mood";
  const energyDescriptor = tags.energy ? `${tags.energy.toLowerCase()} energy` : "smooth energy";

  const eqHints = [];
  if (Number(eq?.bass ?? 0) > 2) eqHints.push("visualize sub-bass waves at the bottom");
  if (Number(eq?.mid ?? 0) > 2) eqHints.push("add warm vocal aura around the center");
  if (Number(eq?.treble ?? 0) > 2) eqHints.push("sprinkle high-frequency particles around the title");
  if (Number(eq?.treble ?? 0) < -2) eqHints.push("keep top area soft and clean");
  if (enhancer === "clarity") eqHints.push("keep typography crisp and glossy");
  if (enhancer === "warm") eqHints.push("use warm light bloom");
  if (enhancer === "club") eqHints.push("accent with strobe reflections");
  if (denoise) eqHints.push("avoid noisy background, use clean gradients");
  if (normalize) eqHints.push("balanced overall contrast");

  const promptParts = [
    `Album cover for "${trackTitle}" by ${artist}.`,
    `${preset.visuals} with ${moodDescriptor} and ${energyDescriptor}.`,
    `${preset.style}, lighting ${preset.lighting}, texture ${preset.texture}.`,
  ];
  if (eqHints.length) promptParts.push(`Details: ${eqHints.join('; ')}.`);
  promptParts.push('Square format 1:1, streaming-ready, high resolution, cinematic rendering.');

  return {
    prompt: promptParts.join(' '),
    palette: preset.palette,
    style: preset.style,
    lighting: preset.lighting,
    texture: preset.texture,
    vibe: preset.vibe,
  };
};

const buildAiReleasePlan = ({
  title = "",
  channel = "",
  duration,
  genre,
  format = "",
  speedMode = "normal",
  backgroundMode = false,
  autoDownload = false,
  queueLength = 0,
  hasPlaylist = false,
  volumeBoost = 0,
} = {}) => {
  const tags = buildAiTags({ title, channel, duration });
  if (genre && typeof genre === "string" && genre.trim()) tags.genre = genre.trim();
  const trackTitle = tags.title || title || "Track Baru";
  const vibe = `${tags.genre || 'Multi-genre'} ${tags.mood || 'Fresh'}`.trim();

  const plan = [
    { timing: "-7 Hari", title: "Teaser visual", detail: `Rilis snippet 15 detik + WIP cover art untuk ${trackTitle} di Reels/Shorts.` },
    { timing: "-3 Hari", title: "Hook blast", detail: "Gunakan AI Hook + caption untuk CTA, ajak pre-save dan buka diskusi vibe." },
    { timing: "-1 Hari", title: "Komunitas & checklist", detail: "DM inner circle, siapin playlist pitch, aktifkan story countdown." },
    { timing: "Release Day", title: "Launch & QR share", detail: "Drop track, bagikan QR mini player + link share, highlight fitur preview dan caption AI." },
    { timing: "+2 Hari", title: "Konten lanjutan", detail: "Upload behind-the-scenes/lyric cut, ajak fans duet atau stitch vibe." },
    { timing: "+5 Hari", title: "Playlist follow-up", detail: "Kirim AI Playlist Pitch ke curator dan update komunitas/Discord." },
  ];

  if (backgroundMode) {
    plan.splice(2, 0, {
      timing: "-2 Hari",
      title: "Siapkan background job",
      detail: "Aktifkan Background mode di web untuk monitor convert & deliver link early access.",
    });
  }

  if (hasPlaylist || (Number(queueLength) || 0) > 1) {
    plan.push({
      timing: "+1 Minggu",
      title: "Bundle playlist",
      detail: "Rilis ZIP playlist/remix pack, gunakan Download ZIP & share QR ke subscriber.",
    });
  }

  if (autoDownload) {
    plan.push({
      timing: "Automation",
      title: "Auto-download siap",
      detail: "Aktifkan Auto-download agar hasil langsung tersimpan dan siap dibagikan.",
    });
  }

  if (Number(volumeBoost) > 6) {
    plan.push({
      timing: "+10 Hari",
      title: "High-energy recap",
      detail: "Potong video live reaction yang nunjukin boost energi +${volumeBoost} dB, ajak fans tag kamu.",
    });
  }

  const summary = `Strategi 1 minggu: teaser → hook → launch → follow-up untuk ${vibe.toLowerCase()} audience.`;
  const focus = `Fokus: ${tags.genre || 'Multi-genre'} · ${tags.mood || 'Fresh'} · ${tags.energy || 'Balanced'}`;

  return { plan, summary, focus };
};

const buildAiPressKit = ({
  title = "",
  channel = "",
  duration,
  genre,
  mood,
  format = "",
} = {}) => {
  const tags = buildAiTags({ title, channel, duration });
  if (genre && typeof genre === "string" && genre.trim()) tags.genre = genre.trim();
  if (mood && typeof mood === "string" && mood.trim()) tags.mood = mood.trim();
  const trackTitle = tags.title || title || "Rilisan Baru";
  const artist = tags.artist || channel || "Creator";
  const vibe = `${tags.genre || "Multi-genre"} · ${tags.mood || "Fresh"}`;
  const runtime = formatDurationLabel(duration);
  const formatLabel = format && typeof format === "string" && format.trim() ? format.toUpperCase() : "MP3";

  const headline = `${trackTitle} oleh ${artist} siap ${tags.energy === "High" ? "mengguncang" : "menemani"} playlist kamu`;

  const storyParts = [
    `${artist} merilis ${trackTitle}${runtime ? ` berdurasi ${runtime}` : ""} dalam format ${formatLabel}.`,
    `Rilisan ini memadukan nuansa ${vibe.toLowerCase()} dengan karakter ${tags.energy?.toLowerCase() || "dinamis"}.`,
  ];
  if (tags.comment) storyParts.push(tags.comment);

  const highlights = [
    `Genre utama: ${tags.genre || "Eksploratif"}`,
    `Mood: ${tags.mood || "Serbaguna"}`,
    `Energi: ${tags.energy || "Seimbang"}`,
  ];
  if (runtime) highlights.push(`Durasi: ${runtime}`);
  if (formatLabel) highlights.push(`Format unggulan: ${formatLabel}`);

  const socialHook = `Gunakan hashtag #${slugifyTag(trackTitle) || "MusikBaru"} untuk ikut merayakan perilisan.`;
  const quote = `"${trackTitle} adalah ${tags.mood ? tags.mood.toLowerCase() : "perjalanan"} sonik yang ${tags.energy === "High" ? "penuh energi" : "hangat"}." — ${artist}`;

  return {
    headline,
    story: storyParts.join(" "),
    highlights,
    quote,
    socialHook,
  };
};

const buildAiOutreachEmail = ({
  title = "",
  channel = "",
  duration,
  genre,
  mood,
  target = "curator",
} = {}) => {
  const tags = buildAiTags({ title, channel, duration });
  if (genre && typeof genre === "string" && genre.trim()) tags.genre = genre.trim();
  if (mood && typeof mood === "string" && mood.trim()) tags.mood = mood.trim();
  const trackTitle = tags.title || title || "Rilisan Baru";
  const artist = tags.artist || channel || "Creator";
  const vibe = `${tags.genre || "multi-genre"} • ${tags.mood || "fresh"}`;
  const durationLabel = formatDurationLabel(duration);
  const friendlyTarget = target === "press" ? "media" : target === "community" ? "komunitas" : "kurator";

  const subject = `${trackTitle} – ${tags.genre || "genre"} ${tags.mood || "mood"} terbaru dari ${artist}`;
  const opener = `Halo ${friendlyTarget},`;
  const intro = `Aku ${artist}. Mau bagi ${trackTitle}${durationLabel ? ` (${durationLabel})` : ""} yang lagi siap dipromosikan.`;
  const hook = `Nuansanya ${vibe.toLowerCase()} dengan energi ${tags.energy?.toLowerCase() || "menarik"}.`;
  const why = target === "press"
    ? "Materi ini cocok untuk liputan rilisan baru atau playlist rekomendasi mingguan."
    : target === "community"
      ? "Kusertakan assets buat challenge komunitas + QR mini player biar gampang dishare."
      : "Rasanya pas buat playlist tematik dan takeover segar di minggu ini.";
  const cta = target === "press"
    ? "Kalau tertarik, bisa aku kirim press kit lengkap & link interview."
    : target === "community"
      ? "Boleh bantu share atau pakai buat konten komunitas ya, nanti ku-repost."
      : "Boleh minta feedback atau masuk playlist kamu?";

  const extras = [`Link dengar cepat: {{preview_link}}`];
  if (tags.comment) extras.push(tags.comment);
  extras.push("Terima kasih atas waktunya!", `Salam hangat, ${artist}`);

  return {
    subject,
    opener,
    intro,
    hook,
    why,
    cta,
    extras,
  };
};

const buildAiLyricTeaser = ({
  title = "",
  channel = "",
  duration,
  genre,
  mood,
} = {}) => {
  const tags = buildAiTags({ title, channel, duration });
  if (genre && typeof genre === "string" && genre.trim()) tags.genre = genre.trim();
  if (mood && typeof mood === "string" && mood.trim()) tags.mood = mood.trim();
  const trackTitle = tags.title || title || "Rilisan Baru";
  const vibe = `${tags.genre || "pop"} ${tags.mood || "fresh"}`.toLowerCase();
  const energyEmoji = MOOD_EMOJIS[tags.mood] || "🎵";

  const opening = tags.mood === "Epic"
    ? "Langkahmu memantul, lampu kota jadi saksi"
    : tags.mood === "Calm"
      ? "Sunyi merona di balik helaan napas"
      : tags.mood === "Happy"
        ? "Tawa kita meledak seperti kembang api"
        : "Nada berputar, memori ikut menari";
  const bridge = tags.energy === "High"
    ? "Detak menaik, bass memeluk malam"
    : "Langkah melambat, kata tetap menyala";
  const closer = tags.mood === "Melancholy"
    ? "Kusimpan kisahmu di sela senja"
    : "Kita ulang lagi sampai fajar menyapa";

  const lines = [opening, bridge, closer];
  const hashtags = [
    `#${slugifyTag(trackTitle) || "NewMusic"}`,
    `#${(tags.genre || "genre").replace(/\s+/g, "")}`,
    `#${(tags.mood || "mood").replace(/\s+/g, "")}`,
  ];

  const callout = `${energyEmoji} ${trackTitle} · teaser lirik vibe ${vibe}`;

  return {
    lines,
    hashtags,
    callout,
  };
};

// ==== AI Assistant helper ====
const DEFAULT_ASSISTANT_SUGGESTIONS = [
  "Ketik /faq untuk membuka daftar pertanyaan cepat di tab Experience.",
  "Gunakan /walkthrough bila ingin tur fitur langkah demi langkah.",
  "Tekan ikon robot di kanan bawah kapan saja untuk memanggil AI Navigator.",
];

const normalizeAssistantPrompt = (value = "") =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const dedupeList = (items = []) => {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const text = typeof item === "string" ? item.trim() : "";
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result;
};

const keywordScore = (text, keywords = []) => {
  let score = 0;
  for (const entry of keywords) {
    if (!entry) continue;
    if (typeof entry === "string") {
      if (text.includes(entry)) score += Math.max(1, Math.min(4, Math.round(entry.length / 4)));
    } else if (typeof entry === "object") {
      const term = typeof entry.term === "string" ? entry.term : "";
      if (!term) continue;
      if (text.includes(term)) {
        const weight = Number(entry.weight);
        score += Number.isFinite(weight) ? weight : Math.max(1, Math.min(4, Math.round(term.length / 4)));
      }
    }
  }
  return score;
};

const assistantTopicReply = {
  donation: () =>
    "Untuk donasi tinggal klik tombol Buka Saweria. Nominal default otomatis Rp10.000 dan kamu bisa pilih Rp5.000, Rp10.000, Rp25.000, atau Rp100.000 langsung di kartu donasi neo-brutalisme. Kalau pop-up diblokir, klik tombol Buka manual supaya nominal terpilih tetap terbuka di tab baru.",
  subtitle: () =>
    "Subtitle diambil dari track Indonesia dan Inggris. Tekan Ambil Subtitle, kami ambil caption resmi, auto-generated, lalu fallback ke transkrip halaman watch bila perlu. File .srt dan .txt langsung siap di Riwayat unduhan.",
  profile: () =>
    "Tab Profil menampilkan avatar dinamis lengkap dengan XP, badge, dan milestone level. Buka Profil untuk melihat progress, klaim badge, dan lanjutkan pengalaman dari Experience Hub.",
  music: () => {
    const moodBadges = Object.entries(MOOD_EMOJIS)
      .map(([mood, emoji]) => `${emoji} ${mood}`)
      .slice(0, 6)
      .join(", ");
    return `Adaptive Background Music siap jalan. Pilih mood manual atau biarkan mode otomatis mengikuti waktu — varian yang tersedia: ${moodBadges}. Mini player tetap sinkron di setiap tab.`;
  },
  voice: () =>
    "Voice Navigation dan Narrator ada di Pengaturan → Aksesibilitas. Aktifkan lalu tekan ikon mic untuk perintah seperti 'buka donasi', 'mainkan game', atau 'bacakan halaman'. Narrator akan membaca konten langsung di browser.",
  offline: () =>
    "Converter ini sudah PWA-ready. Tekan tombol 'Pasang aplikasi' di header untuk instal di HP/desktop, kemudian semua tab termasuk Experience Hub dan mini player bisa dipakai offline setelah sekali sinkron.",
  game: () =>
    "Neo Runner ada di tab Experience sebagai panel terpisah seperti mini player. Tekan Mulai, gunakan Space atau tap untuk lompat, dan coba kombinasi ↑↑↓↓←→←→BA buat membuka animasi easter egg.",
  avatar: () =>
    "Dynamic Avatar ada di Experience Hub. Klik avatar melayang untuk membuka profil, lihat level, serta daftar achievement. Aktivitas seperti convert, donasi, voice command, dan main game otomatis menambah poin.",
  performance: () =>
    "Supaya konversi lebih kencang, ikuti Tips Kecepatan: pilih format yang pas, aktifkan auto-download, dan gunakan Background Mode untuk antrean panjang. Volume booster dan EQ stepper sudah ramah sentuhan di desktop maupun mobile.",
  accessibility: () =>
    "Pengaturan menyediakan opsi aksesibilitas: tema kontras tinggi, teks besar, hingga pengurangan animasi. Kamu juga bisa menyesuaikan dashboard, tata letak mini player, dan preferensi font typewriter dari panel Customizable Dashboard.",
  walkthrough: () =>
    "Butuh tur singkat? Tekan tombol Mulai Walkthrough di Experience Hub. Ada indikator progres dan kamu bisa jalankan ulang kapan saja dari panel Pengaturan.",
  issues: () =>
    "Kalau tombol terasa tidak merespons, coba muat ulang sekali untuk menyegarkan service worker. Kamu juga bisa buka Pengaturan → Offline Mode untuk memaksa pembaruan cache lalu jalankan ulang fitur yang bermasalah.",
};

const ASSISTANT_TOPICS = [
  {
    key: "donation",
    keywords: ["donasi", "donate", "saweria", "dukungan", "support", "tip", "100000", "100 ribu", "100k", "100rb"],
    suggestions: [
      "Gunakan tombol nominal cepat Rp5.000–Rp100.000 di kartu donasi.",
      "Aktifkan animasi confetti dengan memilih tombol Rp100.000.",
      "Izinkan pop-up browser supaya Saweria terbuka otomatis.",
    ],
  },
  {
    key: "subtitle",
    keywords: ["subtitle", "subtitel", "transkrip", "transcript", "caption video", "captions", "teks video"],
    suggestions: [
      "Pilih prioritas bahasa di form subtitle bila ingin fokus Indonesia atau Inggris.",
      "Unduh versi .srt atau .txt dari Riwayat unduhan setelah proses selesai.",
      "Aktifkan Narrator Mode kalau ingin teks dibacakan langsung.",
    ],
  },
  {
    key: "profile",
    keywords: ["profil", "avatar", "xp", "badge", "poin", "achievement"],
    suggestions: [
      "Buka tab Profil untuk melihat level avatar dan daftar badge.",
      "Jelajahi Experience Hub agar XP naik lebih cepat.",
      "Donasi, main game, dan pakai voice command untuk mengumpulkan badge baru.",
    ],
  },
  {
    key: "music",
    keywords: ["musik", "lagu", "background", "bgm", "adaptive", "soundtrack"],
    suggestions: [
      "Buka Experience Hub → bagian Music untuk ganti mood secara manual.",
      "Gunakan voice command 'musik chill' setelah mengaktifkan Voice Navigation.",
      "Mini player bisa tetap memutar musik sambil kamu buka tab lain.",
    ],
  },
  {
    key: "voice",
    keywords: ["voice", "narrator", "narator", "perintah suara", "mic", "microphone", "speech"],
    suggestions: [
      "Aktifkan Voice & Narrator dari Pengaturan → Aksesibilitas.",
      "Ucapkan perintah seperti 'buka donasi' atau 'mainkan game' untuk navigasi cepat.",
      "Gunakan narrator untuk membacakan FAQ panjang otomatis.",
    ],
  },
  {
    key: "offline",
    keywords: ["offline", "pwa", "install", "pasang aplikasi", "app", "aplikasi"],
    suggestions: [
      "Tekan tombol Pasang aplikasi di header saat koneksi stabil.",
      "Buka situs sekali saat online supaya cache offline terbarui.",
      "Gunakan mini player offline untuk memutar hasil konversi terakhir.",
    ],
  },
  {
    key: "game",
    keywords: ["game", "neo runner", "minigame", "mini game", "konami", "easter egg"],
    suggestions: [
      "Masuk ke tab Experience lalu buka panel Neo Runner.",
      "Gunakan Space atau tap layar di mobile untuk melompat.",
      "Coba kode ↑↑↓↓←→←→BA untuk animasi rahasia.",
    ],
  },
  {
    key: "avatar",
    keywords: ["avatar", "profil", "profile", "achievement", "badge", "level", "poin"],
    suggestions: [
      "Klik avatar melayang untuk melihat profil dan pencapaian.",
      "Selesaikan walkthrough dan main Neo Runner untuk lencana tambahan.",
      "Aktifkan Reward System agar poin tersimpan di perangkatmu.",
    ],
  },
  {
    key: "performance",
    keywords: ["cepat", "lambat", "lemot", "antri", "antrean", "background mode", "auto download", "konversi"],
    suggestions: [
      "Gunakan Tips Kecepatan di panel utama sebelum convert.",
      "Aktifkan Background Mode untuk antrean panjang atau banyak link.",
      "Pilih format yang sesuai supaya proses encoding lebih ringan.",
    ],
  },
  {
    key: "accessibility",
    keywords: ["aksesibilitas", "accessibility", "kontras", "font besar", "tema", "layout", "custom", "dashboard"],
    suggestions: [
      "Toggle High Contrast dari Pengaturan → Aksesibilitas.",
      "Aktifkan Reduced Motion bila ingin animasi lebih tenang.",
      "Atur tata letak Experience Hub lewat panel Customizable Dashboard.",
    ],
  },
  {
    key: "walkthrough",
    keywords: ["walkthrough", "tutorial", "panduan", "tour", "guide"],
    suggestions: [
      "Tekan tombol Mulai Walkthrough di Experience Hub.",
      "Gunakan /walkthrough di chat ini untuk memicu tur otomatis.",
      "Ikuti indikator progres agar tidak melewatkan langkah penting.",
    ],
  },
  {
    key: "issues",
    keywords: ["error", "gagal", "tidak bisa", "bug", "masalah", "rusak"],
    suggestions: [
      "Refresh halaman untuk memuat ulang service worker terbaru.",
      "Cek koneksi lalu coba ulang fitur setelah cache diperbarui.",
      "Laporkan detail langkah ke tim bila masalah terus muncul.",
    ],
  },
];

const buildAssistantResponse = async (prompt, history = [], clientState = {}) => {
  const raw = typeof prompt === "string" ? prompt.trim() : String(prompt ?? "").trim();
  const lowerRaw = raw.toLowerCase();
  if (!raw) {
    return {
      reply: "Hai! Mau bantuan convert video?",
      suggestions: ["Convert", "Format", "Trim", "Antrian"],
    };
  }

  // Special commands
  if (/^\/?walkthrough$/i.test(raw)) {
    return {
      reply: "**Walkthrough**: 1. Paste URL 2. Pilih format 3. Convert.",
      suggestions: ["Step 1", "Step 2", "Step 3"],
    };
  }

  if (/^\/?faq$/i.test(raw)) {
    return {
      reply: "**FAQ**: **M4A** tercepat, **MP3** universal, **FLAC** studio.",
      suggestions: ["Format", "Trim", "Cookies"],
    };
  }

  if (
    /(appeal|banding|diban|di ban|keban|kena ban|forum diblokir|forum dikunci)/i.test(lowerRaw) ||
    /(saya mau appeal|mau appeal|ajukan appeal)/i.test(lowerRaw)
  ) {
    const forumState = clientState?.forum || {};
    const violationCount = Number(forumState?.violationCount || 0);
    const disabledFeatures = Array.isArray(forumState?.disabledFeatures) ? forumState.disabledFeatures : [];
    const hasForumBlockSignal = violationCount >= 5 || disabledFeatures.length > 0 || Boolean(forumState?.forumDisabled);
    return {
      reply: hasForumBlockSignal
        ? "Siap, aku proses appeal kamu sekarang dan kirim ke admin dashboard. Mohon tunggu, aku akan sertakan data akun, socket, dan fitur yang terblokir."
        : "Siap, aku bantu kirim appeal. Kalau forum kamu memang diblokir, appeal akan langsung masuk ke admin dashboard untuk direview.",
      suggestions: ["Tulis alasan singkat", "Cek status appeal", "Buat tiket tambahan"],
      action: "submit_forum_appeal",
      params: {
        reason: raw,
      },
    };
  }

  try {
    // Use AI for intelligent CS responses
    const aiResponse = await callGroqAPI(raw, {
      website: "YTConv",
      siteUrl: "https://ytconv.up.railway.app",
      siteName: "YTConv - YouTube to MP3/M4A Converter",
      role: "customer_service",
      instructions: `Kamu adalah Customer Service AI dari YTConv (situs konverter YouTube terbaik di Indonesia). 
Nama kamu: YTConv CS Bot.
Sifat kamu: Ramah, profesional, super helpful, dan sangat paham platform YTConv.
Bahasa: Sesuaikan dengan bahasa user (multibahasa: Indonesia, Inggris, Melayu, campuran slang sopan, dll).
Alur bantu:
1. Sapa dan identifikasi masalah user.
2. Tanyakan detail jika perlu.
3. Berikan solusi langkah demi langkah yang jelas.
4. Jika tidak bisa diselesaikan, sarankan buat tiket dengan mengembalikan action: 'open_ticket' dan isi params.context ringkasan masalah.
5. Selalu profesional, JANGAN sebut 'Dikalfe Project'. Selalu sebut platformnya sebagai 'YTConv'.

Features di YTConv:
- Convert YouTube → MP3, M4A, FLAC, WAV, OGG, OPUS
- Trim audio (potong bagian tertentu)
- Edit metadata/ID3 tags (judul, artis, album)
- Normalisasi volume
- Antrian multi-link
- Riwayat download
- Favorites/Playlist
- Floating Mini Player
- Voice Command
- Format: Spotify-like (M4A), Ringtone (MP3 trimmed), DJ Loop
- Smart Cache (download sama tidak perlu proses ulang)

Kendala umum:
- Error 'age-restricted': perlu upload cookies.txt valid
- Video tidak bisa: coba URL berbeda atau hubungi CS
- Format tidak bisa dimainkan di iPhone: gunakan M4A
- Lambat: pilih format M4A, centang 'Abaikan playlist'

Jika user sangat butuh bantuan lanjut atau masalah teknis kompleks:
- Respons dengan menyarankan buat tiket
- Return JSON: {"reply": "...", "action": "open_ticket", "params": {"context": "[ringkasan masalah user]"}}

Kontak darurat: forumwargaytmp3@gmail.com (atau tombol Email Bantuan di footer, sebelah tombol Lapor WhatsApp).`,
      features: ["Convert", "Trim", "Metadata", "Queue", "History", "Settings"],
      timestamp: new Date().toISOString(),
      history: history,
      clientState: clientState
    });

    let reply = "";
    let action = null;
    let params = null;
    let suggestions = [];

    if (typeof aiResponse === 'object') {
      reply = aiResponse.reply || "Maaf, ada kendala.";
      action = aiResponse.action;
      params = aiResponse.params;
      suggestions = aiResponse.suggestions || [];
    } else {
      reply = String(aiResponse);
    }

    // Default suggestions if none provided
    if (!suggestions || suggestions.length === 0) {
      suggestions = [
        "Cara convert",
        "Pilih format",
        "Trim audio",
        "Metadata",
        "Antrian",
        "Pengaturan"
      ].slice(0, 4);
    }

    return {
      reply,
      suggestions,
      action,
      params
    };
  } catch (error) {
    console.error("[Assistant] Groq API error:", error);

    // Fallback to basic responses
    const fallbackResponses = {
      "convert": "**Oke!** Paste URL → Pilih **MP3** → Convert. **Gampang!**",
      "trim": "**Trim**: Isi start/end pake detik atau `mm:ss`. **Mudah!**",
      "format": "**MP3** universal, **M4A** tercepat, **FLAC** studio. **Pilih sesuai kebutuhan!**",
      "queue": "**Antrian**: Add URL ke playlist. **Praktis!**",
      "metadata": "**Metadata**: Isi judul, artis, album. **Biar rapih!**",
      "cookies": "**Cookies**: Upload file di dropzone. **Bypass age-gate!**",
      "bantuan": "**Butuh bantuan?** Tanyain aja! **Siap bantu!**",
      "hai": "**Hai!** Mau convert apa? **Langsung aja!**",
      "halo": "**Halo!** Ready to convert! **Kirim URLnya!**"
    };

    let reply = "**Hai!** Mau convert video? **Kirim URLnya!**";

    for (const [key, value] of Object.entries(fallbackResponses)) {
      if (lowerRaw.includes(key)) {
        reply = value;
        break;
      }
    }

    return {
      reply,
      suggestions: ["Convert", "Format", "Trim", "Pengaturan"],
    };
  }
};

const validateConvertPayload = (payload = {}) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload tidak valid");
  }
  const url = typeof payload.url === "string" ? payload.url.trim() : "";
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("URL tidak valid");
  }
  const format = String(payload.format || "mp3").toLowerCase();
  if (!SUPPORTED_FORMATS.has(format)) {
    throw new Error("Format tidak didukung");
  }
  const speedMode = payload.speedMode || "normal";
  if (!VALID_SPEED_MODES.has(speedMode)) {
    throw new Error("Mode kecepatan tidak dikenali");
  }
  if (payload.sampleRate !== undefined) {
    const sr = Number(payload.sampleRate);
    if (!Number.isFinite(sr) || sr <= 0) {
      throw new Error("sampleRate tidak valid");
    }
  }
  if (payload.trim && typeof payload.trim === "object") {
    const { start, end } = payload.trim;
    if (start !== undefined) {
      const s = Number(start);
      if (!Number.isFinite(s) || s < 0) throw new Error("trim.start tidak valid");
    }
    if (end !== undefined) {
      const e = Number(end);
      if (!Number.isFinite(e) || e < 0) throw new Error("trim.end tidak valid");
    }
    if (start !== undefined && end !== undefined) {
      if (Number(end) < Number(start)) throw new Error("trim.end harus >= trim.start");
    }
  }
  if (payload.volumeBoost !== undefined) {
    const boost = Number(payload.volumeBoost);
    if (!Number.isFinite(boost) || boost < -24 || boost > 24) {
      throw new Error("volumeBoost di luar batas");
    }
  }
  return {
    ...payload,
    url,
    format,
    speedMode,
  };
};

const enqueueBackgroundJob = (payload = {}) => {
  const normalized = validateConvertPayload(payload);
  const notifyEmail = sanitizeEmail(payload.notifyEmail || normalized.notifyEmail);
  if (Object.prototype.hasOwnProperty.call(normalized, "notifyEmail")) delete normalized.notifyEmail;
  const id = nanoid(12);
  const job = {
    id,
    status: "queued",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    payload: normalized,
    logs: "",
    notify: notifyEmail ? { email: notifyEmail, masked: maskEmail(notifyEmail) } : null,
  };
  backgroundJobs.set(id, job);
  backgroundQueue.push(id);
  job.queuePosition = backgroundQueue.length;
  processBackgroundQueue().catch(() => { });
  return job;
};

const processBackgroundQueue = async () => {
  if (backgroundProcessing) return;
  backgroundProcessing = true;
  while (backgroundQueue.length) {
    const jobId = backgroundQueue.shift();
    const job = backgroundJobs.get(jobId);
    if (!job) continue;
    job.queuePosition = 0;
    job.status = "processing";
    job.startedAt = Date.now();
    job.updatedAt = Date.now();
    try {
      const result = await convertSingle({ ...job.payload, noPlaylist: true });
      job.status = "done";
      job.completedAt = Date.now();
      job.result = {
        downloadUrl: result.downloadUrl,
        fileName: result.fileName,
        format: result.format,
        baseName: result.baseName,
        ext: result.ext,
        sampleRate: result.sampleRate,
        channels: result.channels,
        speedMode: result.speedMode,
        soundEffect: result.soundEffect,
        vpnFriendly: result.vpnFriendly,
        smartResume: result.smartResume,
        videoQuality: result.videoQuality,
      };
      if (result.fullPath) job.result.fullPath = result.fullPath;
      job.logs = (result.logs || "").slice(-8000);
    } catch (err) {
      job.status = "error";
      job.completedAt = Date.now();
      job.error = err.message || "Gagal memproses";
      job.logs = (err.logs || "").slice(-8000);
    }
    job.updatedAt = Date.now();
    if (job.notify?.email) {
      try {
        await dispatchJobNotification(job);
      } catch (err) {
        console.warn("[notify] gagal memproses notifikasi job", err);
      }
    }
  }
  backgroundProcessing = false;
};

const serializeJob = (job) => {
  if (!job) return null;
  const data = {
    id: job.id,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    queuePosition: job.queuePosition,
  };
  if (job.error) data.error = job.error;
  if (job.logs) data.logs = job.logs;
  if (job.result) {
    data.result = {
      downloadUrl: job.result.downloadUrl,
      fileName: job.result.fileName,
      format: job.result.format,
      baseName: job.result.baseName,
      ext: job.result.ext,
    };
    if (job.result.sampleRate !== undefined) data.result.sampleRate = job.result.sampleRate;
    if (job.result.channels !== undefined) data.result.channels = job.result.channels;
    if (job.result.speedMode) data.result.speedMode = job.result.speedMode;
    if (job.result.soundEffect) data.result.soundEffect = job.result.soundEffect;
    if (job.result.vpnFriendly !== undefined) data.result.vpnFriendly = job.result.vpnFriendly;
    if (job.result.smartResume !== undefined) data.result.smartResume = job.result.smartResume;
    if (job.result.videoQuality) data.result.videoQuality = job.result.videoQuality;
  }
  if (job.notify?.masked) {
    data.notify = {
      email: job.notify.masked,
      sentAt: job.notify.sentAt || null,
    };
  }
  return data;
};

const dispatchJobNotification = async (job) => {
  if (!job || !job.notify?.email) return;
  if (job.notify.sentAt) return;
  if (!["done", "error"].includes(job.status)) return;
  const transport = getMailTransport();
  if (!transport) return;
  const from = process.env.NOTIFY_FROM_EMAIL || process.env.NOTIFY_EMAIL_FROM || "no-reply@youtubetomp3.app";
  const subject = job.status === "done" ? "Konversi selesai" : "Konversi gagal";
  const lines = [];
  lines.push("Halo,");
  lines.push("");
  if (job.status === "done") {
    lines.push("File yang kamu konversi sudah siap diunduh.");
  } else {
    lines.push("Maaf, konversi latar gagal diproses.");
  }
  if (job.result?.fileName) lines.push(`File: ${job.result.fileName}`);
  if (job.result?.format) lines.push(`Format: ${job.result.format}`);
  if (job.result?.downloadUrl && job.status === "done") {
    const link = buildAbsolutePublicUrl(job.result.downloadUrl);
    lines.push("");
    lines.push(`Unduh: ${link}`);
  }
  if (job.error) {
    lines.push("");
    lines.push(`Error: ${job.error}`);
  }
  lines.push("");
  lines.push(`Job ID: ${job.id}`);
  if (job.logs) {
    lines.push("");
    lines.push("Ringkasan log (akhir):");
    lines.push(job.logs.split(/\n+/).slice(-6).join("\n"));
  }
  lines.push("");
  lines.push("Terima kasih sudah memakai converter kami.");
  try {
    await transport.sendMail({
      to: job.notify.email,
      from,
      subject,
      text: lines.join("\n"),
    });
    job.notify.sentAt = Date.now();
  } catch (err) {
    console.warn("[notify] gagal mengirim email", err);
    job.notify.lastError = err?.message || String(err);
  }
};

const resolveJobFilePath = (job) => {
  if (!job) return null;
  if (job.result?.fullPath) return job.result.fullPath;
  if (job.result?.downloadUrl) return resolvePublicPath(job.result.downloadUrl);
  return null;
};

const VIDEO_FORMATS = new Set(["mp4", "webm", "mkv"]);
const SUPPORTED_FORMATS = new Set([
  "mp3",
  "m4a",
  "aac",
  "opus",
  "flac",
  "wav",
  "aiff",
  "alac",
  "caf",
  "ogg",
  "mp4",
  "webm",
  "mkv",
]);
const VALID_SPEED_MODES = new Set(["normal", "nightcore", "slow_reverb"]);

const FORMAT_RULES = {
  mp3: {
    abr: [320, 256, 192, 128, 64],
    sampleRates: [44100, 48000],
    speedModes: ["normal", "nightcore", "slow_reverb"],
  },
  m4a: {
    abr: [192],
    sampleRates: [44100],
    speedModes: ["normal"],
  },
  aac: {
    abr: [320, 256, 192, 128],
    sampleRates: [44100, 48000],
    speedModes: ["normal"],
  },
  opus: {
    abr: [256, 192, 160],
    sampleRates: [48000],
    speedModes: ["normal", "nightcore"],
  },
  flac: {
    abr: [320, 256, 192],
    sampleRates: [96000],
    speedModes: ["normal"],
  },
  wav: {
    abr: [],
    sampleRates: [48000, 44100, 96000],
    speedModes: ["normal"],
  },
  aiff: {
    abr: [],
    sampleRates: [48000, 44100, 96000],
    speedModes: ["normal"],
  },
  alac: {
    abr: [],
    sampleRates: [96000, 48000, 44100],
    speedModes: ["normal"],
  },
  caf: {
    abr: [],
    sampleRates: [96000, 48000, 44100],
    speedModes: ["normal"],
  },
  ogg: {
    abr: [256, 192, 160, 128],
    sampleRates: [48000, 44100],
    speedModes: ["normal", "nightcore"],
  },
  mp4: {
    abr: [],
    sampleRates: [48000, 44100],
    speedModes: ["normal"],
    video: true,
    audioCodec: "aac",
    videoQualities: ["best", "2160", "1440", "1080", "720", "480", "360"],
  },
  webm: {
    abr: [],
    sampleRates: [48000, 44100],
    speedModes: ["normal"],
    video: true,
    audioCodec: "libopus",
    videoQualities: ["best", "2160", "1440", "1080", "720", "480", "360"],
  },
  mkv: {
    abr: [],
    sampleRates: [48000, 44100],
    speedModes: ["normal"],
    video: true,
    audioCodec: "aac",
    videoQualities: ["best", "2160", "1440", "1080", "720", "480", "360"],
  },
};

const pickFormatSampleRate = (fmt) => {
  const rule = FORMAT_RULES[fmt];
  if (rule?.sampleRates?.length) return rule.sampleRates[0];
  return 44100;
};

const sanitizeFormatOptions = (fmt, { abr, sampleRate, speedMode, videoQuality }) => {
  const rule = FORMAT_RULES[fmt] || {};
  let cleanedAbr = abr;
  if (Array.isArray(rule.abr)) {
    const abrNumber = Number(abr);
    cleanedAbr = rule.abr.includes(abrNumber) ? abrNumber : (rule.abr[0] ?? null);
    if (!rule.abr.length) cleanedAbr = null;
  }

  let cleanedSampleRate = undefined;
  if (sampleRate !== undefined) {
    const srNumber = parseSampleRate(sampleRate);
    if (Array.isArray(rule.sampleRates) && rule.sampleRates.length) {
      cleanedSampleRate = rule.sampleRates.includes(srNumber) ? srNumber : rule.sampleRates[0];
    } else {
      cleanedSampleRate = srNumber || undefined;
    }
  }

  let cleanedSpeed = speedMode;
  if (Array.isArray(rule.speedModes) && rule.speedModes.length) {
    cleanedSpeed = rule.speedModes.includes(speedMode) ? speedMode : rule.speedModes[0];
  }

  let cleanedVideoQuality = undefined;
  if (Array.isArray(rule.videoQualities) && rule.videoQualities.length) {
    const normalized = typeof videoQuality === "string" ? videoQuality.trim().toLowerCase() : "";
    if (!normalized) {
      cleanedVideoQuality = rule.videoQualities[0];
    } else {
      const match = rule.videoQualities.find((opt) => String(opt).toLowerCase() === normalized);
      cleanedVideoQuality = match || rule.videoQualities[0];
    }
  }

  return {
    abr: cleanedAbr,
    sampleRate: cleanedSampleRate,
    speedMode: cleanedSpeed,
    videoQuality: cleanedVideoQuality,
  };
};

const buildVideoFormatSelector = (fmt, quality = "best") => {
  const rule = FORMAT_RULES[fmt];
  if (!rule?.video) return null;
  const normalized = typeof quality === "string" ? quality.trim() : "";
  const resolved = normalized || rule.videoQualities?.[0] || "best";
  const limit = resolved !== "best" ? `[height<=${resolved}]` : "";
  const filter = (ext) => `${limit}${ext ? `[ext=${ext}]` : ""}`;
  if (fmt === "mp4") {
    return `bv*${filter("mp4")}+ba[ext=m4a]/b${filter("mp4")}/bv*${limit}+ba/best`;
  }
  if (fmt === "webm") {
    return `bv*${filter("webm")}+ba[ext=webm]/b${filter("webm")}/bv*${limit}+ba/best`;
  }
  return `bv*${limit}+ba/b${limit}/bv*${limit}+ba/best`;
};

const deriveFilterSampleRate = (fmt, requested, detected) => {
  const requestedRate = parseSampleRate(requested);
  const rule = FORMAT_RULES[fmt];
  if (requestedRate) {
    if (!rule?.sampleRates?.length || rule.sampleRates.includes(requestedRate)) return requestedRate;
    return rule.sampleRates[0];
  }
  const detectedRate = parseSampleRate(detected);
  if (detectedRate && (!rule?.sampleRates?.length || rule.sampleRates.includes(detectedRate))) {
    return detectedRate;
  }
  if (rule?.sampleRates?.length) return rule.sampleRates[0];
  return pickFormatSampleRate(fmt);
};

const buildAudioFilters = ({
  normalize = false,
  speedMode = "normal",
  denoise = false,
  volumeBoost = 0,
  enhancer = "none",
  soundEffect = "none",
  sampleRate,
  sourceSampleRate,
  crossfade = false
} = {}) => {
  const filters = [];
  const baseSampleRate =
    parseSampleRate(sampleRate) ||
    parseSampleRate(sourceSampleRate) ||
    44100;
  if (speedMode && speedMode !== "normal") {
    if (speedMode === "nightcore") {
      const refSampleRate = baseSampleRate || 44100;
      const boosted = Math.max(8000, Math.round(refSampleRate * 1.25));
      filters.push(`asetrate=${boosted}`, `aresample=${refSampleRate}`);
    } else if (speedMode === "slow_reverb") {
      filters.push("atempo=0.85", "aecho=0.6:0.6:1000:0.25");
    }
  }
  if (denoise) filters.push("afftdn");
  const boost = Number(volumeBoost);
  if (!Number.isNaN(boost) && boost !== 0) {
    filters.push(`volume=${clamp(boost, -20, 20)}dB`);
  }
  if (enhancer && typeof enhancer === "string" && enhancer !== "none") {
    if (enhancer === "clarity") {
      filters.push("acompressor=threshold=-18dB:ratio=2:attack=5:release=50", "equalizer=f=3200:t=h:w=2:g=3");
    } else if (enhancer === "warm") {
      filters.push("equalizer=f=160:t=h:w=2:g=4", "equalizer=f=6400:t=h:w=2:g=-3");
    } else if (enhancer === "club") {
      filters.push("acompressor=threshold=-16dB:ratio=3:attack=8:release=80", "equalizer=f=90:t=h:w=2:g=5", "equalizer=f=8500:t=h:w=2:g=2");
    }
  }
  if (soundEffect && typeof soundEffect === "string" && soundEffect !== "none") {
    if (soundEffect === "reverb") {
      filters.push("aecho=0.7:0.5:1200:0.3");
    } else if (soundEffect === "echo") {
      filters.push("aecho=0.8:0.88:60:0.4");
    } else if (soundEffect === "lofi") {
      filters.push("aresample=12000", "acrusher=bits=8:mode=log:mix=0.6");
    }
  }
  if (crossfade) {
      // Fake a gapless/crossfade smoothing by fading in to remove pop sounds on playback
      filters.push("afade=t=in:ss=0:d=1.5");
  }
  if (normalize) filters.push("loudnorm=I=-14:TP=-1.5:LRA=11");
  return filters;
};

const applyAudioFilters = (args, filters = []) => {
  if (filters && filters.length) {
    args.push("-filter:a", filters.join(","));
  }
};

const runFfmpeg = (args) => new Promise((resolve, reject) => {
  const ff = spawn(ffmpegPath || "ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
  let logs = "";
  ff.stdout.on("data", (d) => (logs += d.toString()));
  ff.stderr.on("data", (d) => (logs += d.toString()));
  ff.on("error", (err) => {
    const error = new Error(err.code === "ENOENT" ? "ffmpeg tidak ditemukan" : err.message || "ffmpeg gagal");
    error.logs = logs;
    reject(error);
  });
  ff.on("close", (code) => {
    if (code === 0) resolve(logs);
    else {
      const error = new Error(`ffmpeg exit ${code}`);
      error.logs = logs;
      reject(error);
    }
  });
});

const vttToSrt = (input = "") => {
  const clean = (input || "").replace(/^WEBVTT.*\n+/i, "").replace(/\r/g, "");
  const blocks = clean.split(/\n\n+/);
  const lines = [];
  let idx = 1;
  for (const block of blocks) {
    const parts = block.split(/\n+/).map((line) => line.trim());
    if (!parts.length) continue;
    let cursor = 0;
    if (/^\d+$/.test(parts[cursor])) cursor += 1;
    if (cursor >= parts.length) continue;
    const timeLine = parts[cursor];
    if (!timeLine.includes("-->")) continue;
    const [rawStart, rawEndWithMeta] = timeLine.split("-->");
    if (!rawEndWithMeta) continue;
    const start = rawStart.trim().replace(/\./g, ",");
    const end = rawEndWithMeta.trim().split(/\s+/)[0]?.replace(/\./g, ",");
    if (!start || !end) continue;
    const textLines = parts.slice(cursor + 1).map((line) => line.replace(/<[^>]+>/g, "").trim()).filter(Boolean);
    if (!textLines.length) continue;
    lines.push(String(idx));
    lines.push(`${start} --> ${end}`);
    lines.push(...textLines);
    lines.push("");
    idx += 1;
  }
  return lines.join("\n").trim();
};

const decodeHtmlEntities = (input = "") =>
  (input || "")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    });

const stripHtml = (input = "") =>
  decodeHtmlEntities((input || "").replace(/<br\s*\/?>(?=\s*\n?)/gi, "\n").replace(/<[^>]+>/g, "")).replace(/\s+$/gm, "");

const msToSrtTime = (value) => {
  const ms = Math.max(0, Math.round(Number(value) || 0));
  const totalSeconds = Math.floor(ms / 1000);
  const milli = ms % 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (num, len = 2) => String(num).padStart(len, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(milli, 3)}`;
};

const parseClockTime = (value) => {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (/^\d+(?:\.\d+)?ms$/i.test(trimmed)) return Number.parseFloat(trimmed) || 0;
  if (/^\d+(?:\.\d+)?s$/i.test(trimmed)) return (Number.parseFloat(trimmed) || 0) * 1000;
  if (/^\d+(?:\.\d+)?m$/i.test(trimmed)) return (Number.parseFloat(trimmed) || 0) * 60 * 1000;
  if (/^\d+(?:\.\d+)?h$/i.test(trimmed)) return (Number.parseFloat(trimmed) || 0) * 3600 * 1000;
  if (/^\d{1,2}:\d{2}:\d{2}(?:\.\d+)?$/.test(trimmed)) {
    const [h, m, s] = trimmed.split(":");
    const seconds = Number.parseFloat(s) || 0;
    return ((Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + seconds) * 1000;
  }
  return null;
};

const convertSrvXmlToSrt = (xml = "") => {
  const entries = [];
  const regex = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;
  let match;
  while ((match = regex.exec(xml))) {
    const attrs = match[1] || "";
    const text = stripHtml(match[2] || "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    const startMatch = attrs.match(/\bt="([^"]+)"/i) || attrs.match(/\bbegin="([^"]+)"/i);
    const durMatch = attrs.match(/\bd="([^"]+)"/i) || attrs.match(/\bdur="([^"]+)"/i);
    const endMatch = attrs.match(/\bend="([^"]+)"/i);
    const startRaw = startMatch ? Number.parseFloat(startMatch[1]) : null;
    const durRaw = durMatch ? Number.parseFloat(durMatch[1]) : null;
    const endRaw = endMatch ? Number.parseFloat(endMatch[1]) : null;
    const start = Number.isFinite(startRaw) ? startRaw : parseClockTime(startMatch?.[1]) || 0;
    let end = Number.isFinite(endRaw) ? endRaw : parseClockTime(endMatch?.[1]);
    let dur = Number.isFinite(durRaw) ? durRaw : parseClockTime(durMatch?.[1]);
    entries.push({
      start,
      dur,
      end,
      text,
    });
  }
  entries.sort((a, b) => (a.start || 0) - (b.start || 0));
  if (!entries.length) return "";
  for (let i = 0; i < entries.length; i += 1) {
    const item = entries[i];
    if (!Number.isFinite(item.end)) {
      if (Number.isFinite(item.dur)) item.end = (item.start || 0) + item.dur;
      else if (entries[i + 1]) item.end = entries[i + 1].start;
    }
    if (!Number.isFinite(item.end)) item.end = (item.start || 0) + 2000;
  }
  const lines = [];
  let idx = 1;
  for (const item of entries) {
    const start = msToSrtTime(item.start || 0);
    const end = msToSrtTime(item.end || ((item.start || 0) + 2000));
    lines.push(String(idx));
    lines.push(`${start} --> ${end}`);
    lines.push(...item.text.split(/\n+/).map((line) => line.trim()).filter(Boolean));
    lines.push("");
    idx += 1;
  }
  return lines.join("\n").trim();
};

const convertTtmlToSrt = (xml = "") => {
  const entries = [];
  const regex = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;
  let match;
  while ((match = regex.exec(xml))) {
    const attrs = match[1] || "";
    const text = stripHtml(match[2] || "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    const beginMatch = attrs.match(/\bbegin="([^"]+)"/i);
    const endMatch = attrs.match(/\bend="([^"]+)"/i);
    const durMatch = attrs.match(/\bdur="([^"]+)"/i);
    const start = parseClockTime(beginMatch?.[1]) || 0;
    let end = parseClockTime(endMatch?.[1]);
    const dur = parseClockTime(durMatch?.[1]);
    entries.push({ start, end, dur, text });
  }
  entries.sort((a, b) => (a.start || 0) - (b.start || 0));
  if (!entries.length) return "";
  for (let i = 0; i < entries.length; i += 1) {
    const item = entries[i];
    if (!Number.isFinite(item.end)) {
      if (Number.isFinite(item.dur)) item.end = (item.start || 0) + item.dur;
      else if (entries[i + 1]) item.end = entries[i + 1].start;
    }
    if (!Number.isFinite(item.end)) item.end = (item.start || 0) + 2000;
  }
  const lines = [];
  let idx = 1;
  for (const item of entries) {
    const start = msToSrtTime(item.start || 0);
    const end = msToSrtTime(item.end || ((item.start || 0) + 2000));
    lines.push(String(idx));
    lines.push(`${start} --> ${end}`);
    lines.push(...item.text.split(/\n+/).map((line) => line.trim()).filter(Boolean));
    lines.push("");
    idx += 1;
  }
  return lines.join("\n").trim();
};

const convertJson3ToSrt = (jsonText = "") => {
  try {
    const data = JSON.parse(jsonText || "{}");
    const events = Array.isArray(data.events) ? data.events : [];
    const entries = [];
    for (const event of events) {
      const start = Number(event.tStartMs || event.tstartMs || 0);
      const dur = Number(event.dDurationMs || event.dur || 0);
      let text = "";
      if (Array.isArray(event.segs)) {
        text = event.segs.map((seg) => (typeof seg?.utf8 === "string" ? seg.utf8 : "")).join("");
      } else if (typeof event.utf8 === "string") {
        text = event.utf8;
      }
      text = stripHtml(text).replace(/\s+/g, " ").trim();
      if (!text) continue;
      entries.push({ start, dur, text });
    }
    if (!entries.length) return "";
    entries.sort((a, b) => (a.start || 0) - (b.start || 0));
    for (let i = 0; i < entries.length; i += 1) {
      const item = entries[i];
      if (!item.dur && entries[i + 1]) item.dur = entries[i + 1].start - item.start;
      if (!item.dur || item.dur <= 0) item.dur = 2000;
    }
    const lines = [];
    let idx = 1;
    for (const item of entries) {
      lines.push(String(idx));
      lines.push(`${msToSrtTime(item.start || 0)} --> ${msToSrtTime((item.start || 0) + item.dur)}`);
      lines.push(...item.text.split(/\n+/).map((line) => line.trim()).filter(Boolean));
      lines.push("");
      idx += 1;
    }
    return lines.join("\n").trim();
  } catch {
    return "";
  }
};

const normalizeSrt = (text = "") => {
  const normalized = (text || "").replace(/\r/g, "").trim();
  if (!normalized) return "";
  return normalized.endsWith("\n") ? normalized : `${normalized}\n`;
};

const convertSubtitleToSrt = (content = "", ext = "") => {
  const lower = String(ext || "").toLowerCase();
  if (lower === "srt") return normalizeSrt(content);
  if (lower === "vtt" || lower === "webvtt") return normalizeSrt(vttToSrt(content));
  if (lower === "ttml" || lower === "dfxp" || lower === "xml") return normalizeSrt(convertTtmlToSrt(content));
  if (lower === "srv3" || lower === "srv2" || lower === "srv1") return normalizeSrt(convertSrvXmlToSrt(content));
  if (lower === "json3") return normalizeSrt(convertJson3ToSrt(content));
  const converted = vttToSrt(content);
  if (converted) return normalizeSrt(converted);
  throw new Error(`Format subtitle ${ext || ""} tidak didukung`);
};

const parseLangPreferences = (input) =>
  String(input || "")
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);

const wildcardToRegex = (pattern) => {
  if (!pattern) return /^$/i;
  let regex = "";
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    if (char === "*") {
      regex += ".*";
      continue;
    }
    if (char === "." && pattern[i + 1] === "*") {
      regex += "(?:[._-].*)?";
      i += 1;
      continue;
    }
    if (char === "?") {
      regex += ".";
      continue;
    }
    if (/[[\]{}()+?.,\\^$|#\s]/.test(char)) {
      regex += `\\${char}`;
    } else {
      regex += char;
    }
  }
  return new RegExp(`^${regex}$`, "i");
};

const SUPPORTED_SUB_EXTS = ["srt", "vtt", "webvtt", "ttml", "dfxp", "srv3", "srv2", "srv1", "json3"];

const pickSourceFromCatalog = (catalog = {}, patterns = []) => {
  const entries = Object.entries(catalog || {})
    .map(([lang, sources]) => {
      const list = Array.isArray(sources) ? sources : [sources];
      const filtered = list
        .map((item) => (item && item.url ? { ...item, ext: String(item.ext || "").toLowerCase() } : null))
        .filter(Boolean);
      return filtered.length ? { lang, sources: filtered } : null;
    })
    .filter(Boolean);
  if (!entries.length) return null;

  const pickByPattern = (pattern) => {
    const rx = wildcardToRegex(pattern);
    const match = entries.find((entry) => rx.test(entry.lang));
    if (!match) return null;
    for (const ext of SUPPORTED_SUB_EXTS) {
      const src = match.sources.find((item) => item.ext === ext);
      if (src) return { lang: match.lang, source: src };
    }
    return { lang: match.lang, source: match.sources[0] };
  };

  for (const pattern of patterns) {
    const picked = pickByPattern(pattern);
    if (picked) return picked;
  }

  const english = pickByPattern("en.*") || pickByPattern("en");
  if (english) return english;

  const fallback = entries[0];
  for (const ext of SUPPORTED_SUB_EXTS) {
    const src = fallback.sources.find((item) => item.ext === ext);
    if (src) return { lang: fallback.lang, source: src };
  }
  return { lang: fallback.lang, source: fallback.sources[0] };
};

const sanitizeLangKey = (lang, auto) => {
  const clean = String(lang || (auto ? "auto" : "subtitle"))
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (clean) return clean;
  return auto ? "auto" : "subtitle";
};

const selectSubtitleTrack = (info, { patterns = [], preferAuto = true } = {}) => {
  const entries = Array.isArray(info?.entries) ? info.entries : [info];
  for (const entry of entries) {
    if (!entry) continue;
    const manual = pickSourceFromCatalog(entry.subtitles, patterns);
    const auto = pickSourceFromCatalog(entry.automatic_captions, patterns);
    if (manual && !preferAuto) {
      return { ...manual.source, lang: manual.lang, auto: false };
    }
    if (preferAuto && auto) {
      return { ...auto.source, lang: auto.lang, auto: true };
    }
    if (manual) {
      return { ...manual.source, lang: manual.lang, auto: false };
    }
    if (auto) {
      return { ...auto.source, lang: auto.lang, auto: true };
    }
  }
  return null;
};

const extractJsonFromSource = (source = "", marker = "") => {
  if (!source || !marker) return null;
  const index = source.indexOf(marker);
  if (index === -1) return null;
  let start = index + marker.length;
  while (start < source.length && source[start] !== "{" && source[start] !== "[") {
    start += 1;
  }
  if (start >= source.length) return null;
  const openChar = source[start];
  const closeChar = openChar === "[" ? "]" : "}";
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < source.length; i += 1) {
    const char = source[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === "\\") {
        escape = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }
    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === openChar) depth += 1;
    else if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, i + 1);
      }
    }
  }
  return null;
};

const parseWatchPlayerResponse = (html = "") => {
  const markers = [
    "ytInitialPlayerResponse = ",
    "ytInitialPlayerResponse=",
    "window[\"ytInitialPlayerResponse\"] = ",
    "window['ytInitialPlayerResponse'] = ",
  ];
  for (const marker of markers) {
    const jsonText = extractJsonFromSource(html, marker);
    if (!jsonText) continue;
    try {
      return JSON.parse(jsonText);
    } catch {
      // ignore and try next marker
    }
  }
  return null;
};

const parseLangFromVssId = (vssId = "") => {
  const value = String(vssId || "").trim();
  if (!value) return "";
  if (value.startsWith("a.")) return value.slice(2);
  if (value.startsWith(".")) return value.slice(1);
  return value;
};

const ensureCaptionUrl = (baseUrl = "", { translateTo } = {}) => {
  if (!baseUrl) return null;
  let url;
  try {
    url = new URL(baseUrl, "https://www.youtube.com");
  } catch {
    return null;
  }
  if (!url.searchParams.get("fmt")) {
    url.searchParams.set("fmt", "srv3");
  }
  const fmt = url.searchParams.get("fmt") || "srv3";
  if (translateTo) {
    url.searchParams.set("tlang", translateTo);
  } else {
    url.searchParams.delete("tlang");
  }
  return { url: url.toString(), ext: fmt.toLowerCase() };
};

const pushCaptionEntry = (catalog, lang, entry) => {
  const key = String(lang || (entry?.auto ? "auto" : "subtitle"))
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!key) return;
  if (!catalog[key]) catalog[key] = [];
  catalog[key].push(entry);
};

const buildCaptionCatalogFromTracks = (tracks = []) => {
  const manual = {};
  const auto = {};
  for (const track of tracks) {
    if (!track?.baseUrl) continue;
    const langCode = (track.languageCode || parseLangFromVssId(track.vssId) || "subtitle").toLowerCase();
    const isAuto = track.kind === "asr" || /^a\./i.test(track.vssId || "");
    const base = ensureCaptionUrl(track.baseUrl);
    if (!base) continue;
    const name =
      track.name?.simpleText ||
      (Array.isArray(track.name?.runs) ? track.name.runs.map((run) => run?.text || "").join("") : "");
    const common = {
      url: base.url,
      ext: base.ext,
      name,
      auto: isAuto,
      trackKind: track.kind,
      originalLang: langCode,
    };
    const target = isAuto ? auto : manual;
    pushCaptionEntry(target, langCode, common);

    const translations = Array.isArray(track.translationLanguages)
      ? track.translationLanguages.map((item) => item?.languageCode).filter(Boolean)
      : [];
    for (const translation of translations) {
      const translatedLang = String(translation || "").toLowerCase();
      if (!translatedLang || translatedLang === langCode) continue;
      const translated = ensureCaptionUrl(track.baseUrl, { translateTo: translatedLang });
      if (!translated) continue;
      pushCaptionEntry(target, translatedLang, {
        ...common,
        url: translated.url,
        ext: translated.ext,
        translated: true,
        translatedFrom: langCode,
      });
    }
  }
  return { subtitles: manual, automatic_captions: auto };
};

const extractYouTubeVideoId = (input = "") => {
  const value = String(input || "").trim();
  if (!value) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value;
  try {
    const url = new URL(value);
    if (/youtu\.be$/i.test(url.hostname)) {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] && /^[a-zA-Z0-9_-]{11}$/.test(parts[0])) return parts[0];
    }
    if (/youtube\.com$/i.test(url.hostname)) {
      const v = url.searchParams.get("v");
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
      const shorts = url.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
      if (shorts) return shorts[1];
      const embed = url.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
      if (embed) return embed[1];
    }
  } catch {
    // ignore
  }
  const match = value.match(/([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
};

const fetchWithTimeout = async (url, { timeout = 15000, headers = {} } = {}) => {
  if (!fetchImpl) {
    throw new Error("Lingkungan tidak mendukung fetch untuk subtitle");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, timeout));
  try {
    const response = await safeFetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36",
        "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
        ...headers,
      },
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
};

const fetchSubtitleViaYtDlp = async ({ url, langOpt, preferAuto }) => {
  const args = ["--dump-single-json", "--no-progress", "--skip-download", "--no-warnings"];
  if (ffmpegPath) args.push("--ffmpeg-location", ffmpegPath);
  if (existsSync(COOKIES_PATH)) args.push("--cookies", COOKIES_PATH);
  args.push(url);

  let stdout = "";
  let stderr = "";
  const logs = [`yt-dlp ${args.join(" ")}`];

  try {
    await new Promise((resolve, reject) => {
      const proc = spawn("yt-dlp", args, { stdio: ["ignore", "pipe", "pipe"] });
      proc.stdout.on("data", (d) => {
        const chunk = d.toString();
        stdout += chunk;
      });
      proc.stderr.on("data", (d) => {
        const chunk = d.toString();
        stderr += chunk;
      });
      proc.on("error", (err) => {
        const error = new Error("yt-dlp tidak bisa dijalankan");
        error.cause = err;
        reject(error);
      });
      proc.on("close", (code) => {
        if (code !== 0) {
          const error = new Error("yt-dlp gagal mengambil metadata subtitle");
          reject(error);
        } else {
          resolve();
        }
      });
    });
  } catch (err) {
    const error = new Error(err.message || "yt-dlp gagal");
    error.logs = [...logs, stdout, stderr].filter(Boolean).join("\n");
    throw error;
  }

  const patterns = parseLangPreferences(langOpt);
  let info;
  try {
    info = JSON.parse(stdout || "{}");
  } catch (err) {
    const error = new Error("Respons yt-dlp tidak valid");
    error.logs = [...logs, stderr, stdout].filter(Boolean).join("\n");
    throw error;
  }

  const track = selectSubtitleTrack(info, { patterns, preferAuto });
  if (!track || !track.url) {
    const error = new Error("Subtitle tidak ditemukan");
    error.logs = [...logs, stderr, stdout].filter(Boolean).join("\n");
    throw error;
  }

  let body;
  try {
    const response = await fetchWithTimeout(track.url, {});
    if (!response.ok) {
      const error = new Error(`Gagal mengunduh subtitle (${response.status})`);
      error.logs = [...logs, stderr, stdout, `HTTP ${response.status}`].filter(Boolean).join("\n");
      throw error;
    }
    body = await response.text();
  } catch (err) {
    if (err.logs) throw err;
    const error = new Error(err.message || "Gagal mengambil subtitle");
    error.logs = [...logs, stderr, stdout].filter(Boolean).join("\n");
    throw error;
  }

  let srt;
  try {
    srt = convertSubtitleToSrt(body, track.ext);
  } catch (err) {
    const error = new Error(err.message || "Gagal mengonversi subtitle");
    error.logs = [...logs, stderr, stdout].filter(Boolean).join("\n");
    throw error;
  }

  const safeLang = sanitizeLangKey(track.lang, track.auto);
  return {
    srt,
    safeLang,
    lang: track.lang || safeLang,
    auto: Boolean(track.auto),
    logs: [...logs, stderr].filter(Boolean).join("\n").slice(-8000),
  };
};

const fetchSubtitleViaWatch = async ({ url, langOpt, preferAuto }) => {
  const logs = [];
  const appendLog = (value) => {
    if (!value) return;
    logs.push(value);
  };

  const videoId = extractYouTubeVideoId(url);
  if (!videoId) {
    const error = new Error("ID video YouTube tidak dikenali");
    error.logs = logs.join("\n");
    throw error;
  }

  const watchUrl = new URL("https://www.youtube.com/watch");
  watchUrl.searchParams.set("v", videoId);
  watchUrl.searchParams.set("hl", "en");
  watchUrl.searchParams.set("bpctr", "9999999999");
  watchUrl.searchParams.set("has_verified", "1");
  appendLog(`fetch ${watchUrl.toString()}`);

  let html;
  try {
    const response = await fetchWithTimeout(watchUrl.toString(), {
      headers: {
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9,id;q=0.8",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36",
      },
    });
    appendLog(`watch status ${response.status}`);
    if (!response.ok) {
      const error = new Error(`Gagal membuka halaman YouTube (HTTP ${response.status})`);
      error.logs = logs.join("\n");
      throw error;
    }
    html = await response.text();
  } catch (err) {
    if (err?.logs) throw err;
    const error = new Error(err.message || "Gagal membuka halaman YouTube");
    error.logs = logs.join("\n");
    throw error;
  }

  const playerResponse = parseWatchPlayerResponse(html);
  if (!playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length) {
    const error = new Error("Subtitle tidak ditemukan di halaman YouTube");
    error.logs = logs.join("\n");
    throw error;
  }

  const catalog = buildCaptionCatalogFromTracks(
    playerResponse.captions.playerCaptionsTracklistRenderer.captionTracks,
  );

  const patterns = parseLangPreferences(langOpt);
  const track = selectSubtitleTrack({ entries: [{ ...catalog }] }, { patterns, preferAuto });
  if (!track || !track.url) {
    const error = new Error("Subtitle tidak ditemukan");
    error.logs = logs.join("\n");
    throw error;
  }

  appendLog(
    `pilih track ${track.lang || track.originalLang || "unknown"} (${track.ext || "srv3"})${track.translated ? " · translate" : ""
    }${track.auto ? " · auto" : ""}`,
  );

  let body;
  try {
    const response = await fetchWithTimeout(track.url, {
      headers: {
        "accept-language": "en-US,en;q=0.9,id;q=0.8",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36",
      },
    });
    appendLog(`subtitle status ${response.status}`);
    if (!response.ok) {
      const error = new Error(`Gagal mengunduh subtitle (HTTP ${response.status})`);
      error.logs = logs.join("\n");
      throw error;
    }
    body = await response.text();
  } catch (err) {
    if (err?.logs) throw err;
    const error = new Error(err.message || "Gagal mengambil subtitle");
    error.logs = logs.join("\n");
    throw error;
  }

  let srt;
  try {
    srt = convertSubtitleToSrt(body, track.ext);
  } catch (err) {
    const error = new Error(err.message || "Gagal mengonversi subtitle");
    error.logs = logs.join("\n");
    throw error;
  }

  const safeLang = sanitizeLangKey(track.lang, track.auto);
  return {
    srt,
    safeLang,
    lang: track.lang || safeLang,
    auto: Boolean(track.auto),
    translated: Boolean(track.translated),
    translatedFrom: track.translatedFrom || track.originalLang || null,
    originalLang: track.originalLang || null,
    logs: logs.join("\n").slice(-8000),
  };
};

const fetchSubtitleViaPyTube = async ({ url, langOpt, preferAuto }) => {
  const args = [
    join(__dirname, "download_subtitle.py"),
    url,
    langOpt || "",
    preferAuto ? "1" : "0",
  ];
  let stdout = "";
  let stderr = "";
  const logs = [`python3 ${args.map((arg) => (arg.includes(" ") ? `"${arg}"` : arg)).join(" ")}`];
  try {
    await new Promise((resolve, reject) => {
      const proc = spawn("python3", args, { stdio: ["ignore", "pipe", "pipe"] });
      proc.stdout.on("data", (d) => {
        stdout += d.toString();
      });
      proc.stderr.on("data", (d) => {
        stderr += d.toString();
      });
      proc.on("error", (err) => {
        const error = new Error("PyTube tidak bisa dijalankan");
        error.cause = err;
        reject(error);
      });
      proc.on("close", (code) => {
        if (code !== 0) {
          const error = new Error("PyTube gagal mengambil subtitle");
          reject(error);
        } else {
          resolve();
        }
      });
    });
  } catch (err) {
    const error = new Error(err.message || "PyTube gagal mengambil subtitle");
    error.logs = [...logs, stderr].filter(Boolean).join("\n");
    throw error;
  }

  try {
    const parsed = JSON.parse(stdout || "{}");
    if (!parsed.srt) {
      throw new Error("Subtitle kosong");
    }
    return {
      srt: parsed.srt,
      lang: parsed.lang,
      safeLang: sanitizeLangKey(parsed.lang, parsed.auto),
      auto: Boolean(parsed.auto),
      logs: [...logs, stderr].filter(Boolean).join("\n").slice(-8000),
    };
  } catch (err) {
    const error = new Error(err.message || "PyTube menghasilkan data tidak valid");
    error.logs = [...logs, stderr, stdout].filter(Boolean).join("\n");
    throw error;
  }
};

const srtToPlainText = (input = "") => {
  const normalized = (input || "").replace(/\r/g, "");
  const blocks = normalized.split(/\n\n+/);
  const texts = [];
  for (const block of blocks) {
    const lines = block.split(/\n+/).map((line) => line.trim());
    if (!lines.length) continue;
    let cursor = 0;
    if (/^\d+$/.test(lines[cursor])) cursor += 1;
    if (cursor < lines.length && lines[cursor].includes("-->")) cursor += 1;
    const content = lines
      .slice(cursor)
      .map((line) => line.replace(/<[^>]+>/g, "").trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (content) texts.push(content);
  }
  return texts.join("\n");
};

const buildSubtitlePreview = (text = "") =>
  (text || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join("\n");

const ffmpegToMp3 = (input, output, opts = {}) => {
  const { abr = 192, id3 = {}, trim = {}, sampleRate, cover, filters = [] } = opts;
  return new Promise((resolve, reject) => {
    const args = ["-y"];
    const { start, end } = trim || {};
    const hasStart = typeof start === "number" && !isNaN(start);
    const hasEnd = typeof end === "number" && !isNaN(end);
    if (hasStart) args.push("-ss", String(start));
    args.push("-i", input);
    if (cover) args.push("-i", cover);
    if (hasEnd) {
      if (hasStart) args.push("-t", String(end - start));
      else args.push("-to", String(end));
    }
    applyAudioFilters(args, filters);
    for (const [k, v] of Object.entries(id3 || {})) {
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        args.push("-metadata", `${k}=${v}`);
      }
    }
    if (sampleRate) args.push("-ar", String(sampleRate));
    if (cover) {
      args.push(
        "-map", "0:a", "-map", "1:v",
        "-id3v2_version", "3",
        "-c:v", "mjpeg",
        "-metadata:s:v", "title=Album cover",
        "-metadata:s:v", "comment=Cover (front)",
        "-disposition:v:0", "attached_pic"
      );
    } else {
      args.push("-map", "0:a", "-vn");
    }
    args.push("-codec:a", "libmp3lame", "-b:a", `${abr}k`, output);
    const ff = spawn(ffmpegPath || "ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let logs = "";
    ff.stdout.on("data", (d) => (logs += d.toString()));
    ff.stderr.on("data", (d) => (logs += d.toString()));
    ff.on("error", (err) => {
      if (err.code === "ENOENT") return reject(new Error("ffmpeg tidak ditemukan"));
      reject(err);
    });
    ff.on("close", (code) => {
      if (code === 0) resolve(logs);
      else reject(new Error(logs));
    });
  });
};

const ffmpegToFlac = (input, output, opts = {}) => {
  const { id3 = {}, trim = {}, sampleRate, cover, filters = [] } = opts;
  return new Promise((resolve, reject) => {
    const args = ["-y"];
    const { start, end } = trim || {};
    const hasStart = typeof start === "number" && !isNaN(start);
    const hasEnd = typeof end === "number" && !isNaN(end);
    if (hasStart) args.push("-ss", String(start));
    args.push("-i", input);
    if (cover) args.push("-i", cover);
    if (hasEnd) {
      if (hasStart) args.push("-t", String(end - start));
      else args.push("-to", String(end));
    }
    applyAudioFilters(args, filters);
    for (const [k, v] of Object.entries(id3 || {})) {
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        args.push("-metadata", `${k}=${v}`);
      }
    }
    if (sampleRate) args.push("-ar", String(sampleRate));
    if (cover) {
      args.push(
        "-map", "0:a", "-map", "1:v",
        "-c:v", "mjpeg",
        "-metadata:s:v", "title=Album cover",
        "-metadata:s:v", "comment=Cover (front)",
        "-disposition:v:0", "attached_pic"
      );
    } else {
      args.push("-map", "0:a", "-vn");
    }
    args.push("-codec:a", "flac", "-compression_level", "12", output);
    const ff = spawn(ffmpegPath || "ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let logs = "";
    ff.stdout.on("data", (d) => (logs += d.toString()));
    ff.stderr.on("data", (d) => (logs += d.toString()));
    ff.on("error", (err) => {
      if (err.code === "ENOENT") return reject(new Error("ffmpeg tidak ditemukan"));
      reject(err);
    });
    ff.on("close", (code) => {
      if (code === 0) resolve(logs);
      else reject(new Error(logs));
    });
  });
};

const ffmpegToM4a = (input, output, opts = {}) => {
  const { id3 = {}, trim = {}, sampleRate, cover, filters = [], abr = 192 } = opts;
  return new Promise((resolve, reject) => {
    const args = ["-y"];
    const { start, end } = trim || {};
    const hasStart = typeof start === "number" && !isNaN(start);
    const hasEnd = typeof end === "number" && !isNaN(end);
    if (hasStart) args.push("-ss", String(start));
    args.push("-i", input);
    if (cover) args.push("-i", cover);
    if (hasEnd) {
      if (hasStart) args.push("-t", String(end - start));
      else args.push("-to", String(end));
    }
    applyAudioFilters(args, filters);
    for (const [k, v] of Object.entries(id3 || {})) {
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        args.push("-metadata", `${k}=${v}`);
      }
    }
    if (sampleRate) args.push("-ar", String(sampleRate));
    if (cover) {
      args.push(
        "-map", "0:a", "-map", "1:v",
        "-c:v", "mjpeg",
        "-metadata:s:v", "title=Album cover",
        "-metadata:s:v", "comment=Cover (front)",
        "-disposition:v:0", "attached_pic"
      );
    } else {
      args.push("-map", "0:a", "-vn");
    }
    const targetAbr = Number(abr) || 192;
    args.push("-codec:a", "aac", "-b:a", `${targetAbr}k`, output);
    const ff = spawn(ffmpegPath || "ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let logs = "";
    ff.stdout.on("data", (d) => (logs += d.toString()));
    ff.stderr.on("data", (d) => (logs += d.toString()));
    ff.on("error", (err) => {
      if (err.code === "ENOENT") return reject(new Error("ffmpeg tidak ditemukan"));
      reject(err);
    });
    ff.on("close", (code) => {
      if (code === 0) resolve(logs);
      else reject(new Error(logs));
    });
  });
};

const ffmpegToAac = (input, output, opts = {}) => {
  const { id3 = {}, trim = {}, sampleRate, filters = [], abr = 256 } = opts;
  return new Promise((resolve, reject) => {
    const args = ["-y"];
    const { start, end } = trim || {};
    const hasStart = typeof start === "number" && !Number.isNaN(start);
    const hasEnd = typeof end === "number" && !Number.isNaN(end);
    if (hasStart) args.push("-ss", String(start));
    args.push("-i", input);
    if (hasEnd) {
      if (hasStart) args.push("-t", String(end - start));
      else args.push("-to", String(end));
    }
    applyAudioFilters(args, filters);
    for (const [k, v] of Object.entries(id3 || {})) {
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        args.push("-metadata", `${k}=${v}`);
      }
    }
    if (sampleRate) args.push("-ar", String(sampleRate));
    args.push("-map", "0:a", "-vn");
    const targetAbr = Number(abr) || 256;
    args.push("-c:a", "aac", "-b:a", `${targetAbr}k`, output);
    const ff = spawn(ffmpegPath || "ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let logs = "";
    ff.stdout.on("data", (d) => (logs += d.toString()));
    ff.stderr.on("data", (d) => (logs += d.toString()));
    ff.on("error", (err) => {
      if (err.code === "ENOENT") return reject(new Error("ffmpeg tidak ditemukan"));
      reject(err);
    });
    ff.on("close", (code) => {
      if (code === 0) resolve(logs);
      else reject(new Error(logs));
    });
  });
};

const ffmpegToOpus = (input, output, opts = {}) => {
  const { id3 = {}, trim = {}, sampleRate, filters = [], abr = 192 } = opts;
  return new Promise((resolve, reject) => {
    const args = ["-y"];
    const { start, end } = trim || {};
    const hasStart = typeof start === "number" && !Number.isNaN(start);
    const hasEnd = typeof end === "number" && !Number.isNaN(end);
    if (hasStart) args.push("-ss", String(start));
    args.push("-i", input);
    if (hasEnd) {
      if (hasStart) args.push("-t", String(end - start));
      else args.push("-to", String(end));
    }
    applyAudioFilters(args, filters);
    for (const [k, v] of Object.entries(id3 || {})) {
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        args.push("-metadata", `${k}=${v}`);
      }
    }
    if (sampleRate) args.push("-ar", String(sampleRate));
    args.push("-map", "0:a", "-vn");
    const targetAbr = Math.max(64, Number(abr) || 192);
    args.push("-c:a", "libopus", "-b:a", `${targetAbr}k`, "-vbr", "on", "-compression_level", "10", output);
    const ff = spawn(ffmpegPath || "ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let logs = "";
    ff.stdout.on("data", (d) => (logs += d.toString()));
    ff.stderr.on("data", (d) => (logs += d.toString()));
    ff.on("error", (err) => {
      if (err.code === "ENOENT") return reject(new Error("ffmpeg tidak ditemukan"));
      reject(err);
    });
    ff.on("close", (code) => {
      if (code === 0) resolve(logs);
      else reject(new Error(logs));
    });
  });
};

const ffmpegToWav = (input, output, opts = {}) => {
  const { trim = {}, sampleRate, filters = [] } = opts;
  return new Promise((resolve, reject) => {
    const args = ["-y"];
    const { start, end } = trim || {};
    const hasStart = typeof start === "number" && !isNaN(start);
    const hasEnd = typeof end === "number" && !isNaN(end);
    if (hasStart) args.push("-ss", String(start));
    args.push("-i", input);
    if (hasEnd) {
      if (hasStart) args.push("-t", String(end - start));
      else args.push("-to", String(end));
    }
    if (sampleRate) args.push("-ar", String(sampleRate));
    applyAudioFilters(args, filters);
    args.push("-map", "0:a", "-vn", "-codec:a", "pcm_s16le", output);
    const ff = spawn(ffmpegPath || "ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let logs = "";
    ff.stdout.on("data", (d) => (logs += d.toString()));
    ff.stderr.on("data", (d) => (logs += d.toString()));
    ff.on("error", (err) => {
      if (err.code === "ENOENT") return reject(new Error("ffmpeg tidak ditemukan"));
      reject(err);
    });
    ff.on("close", (code) => {
      if (code === 0) resolve(logs);
      else reject(new Error(logs));
    });
  });
};

const ffmpegToOgg = (input, output, opts = {}) => {
  const { trim = {}, sampleRate, filters = [] } = opts;
  return new Promise((resolve, reject) => {
    const args = ["-y"];
    const { start, end } = trim || {};
    const hasStart = typeof start === "number" && !isNaN(start);
    const hasEnd = typeof end === "number" && !isNaN(end);
    if (hasStart) args.push("-ss", String(start));
    args.push("-i", input);
    if (hasEnd) {
      if (hasStart) args.push("-t", String(end - start));
      else args.push("-to", String(end));
    }
    if (sampleRate) args.push("-ar", String(sampleRate));
    applyAudioFilters(args, filters);
    args.push("-map", "0:a", "-vn", "-codec:a", "libvorbis", "-qscale:a", "5", output);
    const ff = spawn(ffmpegPath || "ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let logs = "";
    ff.stdout.on("data", (d) => (logs += d.toString()));
    ff.stderr.on("data", (d) => (logs += d.toString()));
    ff.on("error", (err) => {
      if (err.code === "ENOENT") return reject(new Error("ffmpeg tidak ditemukan"));
      reject(err);
    });
    ff.on("close", (code) => {
      if (code === 0) resolve(logs);
      else reject(new Error(logs));
    });
  });
};

const ffmpegToAiff = (input, output, opts = {}) => {
  const { id3 = {}, trim = {}, sampleRate, filters = [] } = opts;
  return new Promise((resolve, reject) => {
    const args = ["-y"];
    const { start, end } = trim || {};
    const hasStart = typeof start === "number" && !Number.isNaN(start);
    const hasEnd = typeof end === "number" && !Number.isNaN(end);
    if (hasStart) args.push("-ss", String(start));
    args.push("-i", input);
    if (hasEnd) {
      if (hasStart) args.push("-t", String(end - start));
      else args.push("-to", String(end));
    }
    applyAudioFilters(args, filters);
    for (const [k, v] of Object.entries(id3 || {})) {
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        args.push("-metadata", `${k}=${v}`);
      }
    }
    if (sampleRate) args.push("-ar", String(sampleRate));
    args.push("-map", "0:a", "-vn", "-c:a", "pcm_s16be", output);
    const ff = spawn(ffmpegPath || "ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let logs = "";
    ff.stdout.on("data", (d) => (logs += d.toString()));
    ff.stderr.on("data", (d) => (logs += d.toString()));
    ff.on("error", (err) => {
      if (err.code === "ENOENT") return reject(new Error("ffmpeg tidak ditemukan"));
      reject(err);
    });
    ff.on("close", (code) => {
      if (code === 0) resolve(logs);
      else reject(new Error(logs));
    });
  });
};

const ffmpegToAlac = (input, output, opts = {}) => {
  const { id3 = {}, trim = {}, sampleRate, filters = [] } = opts;
  return new Promise((resolve, reject) => {
    const args = ["-y"];
    const { start, end } = trim || {};
    const hasStart = typeof start === "number" && !Number.isNaN(start);
    const hasEnd = typeof end === "number" && !Number.isNaN(end);
    if (hasStart) args.push("-ss", String(start));
    args.push("-i", input);
    if (hasEnd) {
      if (hasStart) args.push("-t", String(end - start));
      else args.push("-to", String(end));
    }
    applyAudioFilters(args, filters);
    for (const [k, v] of Object.entries(id3 || {})) {
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        args.push("-metadata", `${k}=${v}`);
      }
    }
    if (sampleRate) args.push("-ar", String(sampleRate));
    args.push("-map", "0:a", "-vn", "-c:a", "alac", output);
    const ff = spawn(ffmpegPath || "ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let logs = "";
    ff.stdout.on("data", (d) => (logs += d.toString()));
    ff.stderr.on("data", (d) => (logs += d.toString()));
    ff.on("error", (err) => {
      if (err.code === "ENOENT") return reject(new Error("ffmpeg tidak ditemukan"));
      reject(err);
    });
    ff.on("close", (code) => {
      if (code === 0) resolve(logs);
      else reject(new Error(logs));
    });
  });
};

const ffmpegToCaf = (input, output, opts = {}) => {
  const { trim = {}, sampleRate, filters = [] } = opts;
  return new Promise((resolve, reject) => {
    const args = ["-y"];
    const { start, end } = trim || {};
    const hasStart = typeof start === "number" && !Number.isNaN(start);
    const hasEnd = typeof end === "number" && !Number.isNaN(end);
    if (hasStart) args.push("-ss", String(start));
    args.push("-i", input);
    if (hasEnd) {
      if (hasStart) args.push("-t", String(end - start));
      else args.push("-to", String(end));
    }
    applyAudioFilters(args, filters);
    if (sampleRate) args.push("-ar", String(sampleRate));
    args.push("-map", "0:a", "-vn", "-c:a", "pcm_s16le", output);
    const ff = spawn(ffmpegPath || "ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let logs = "";
    ff.stdout.on("data", (d) => (logs += d.toString()));
    ff.stderr.on("data", (d) => (logs += d.toString()));
    ff.on("error", (err) => {
      if (err.code === "ENOENT") return reject(new Error("ffmpeg tidak ditemukan"));
      reject(err);
    });
    ff.on("close", (code) => {
      if (code === 0) resolve(logs);
      else reject(new Error(logs));
    });
  });
};

const ffmpegConvertVideo = (input, output, opts = {}) => {
  const {
    trim = {},
    filters = [],
    sampleRate,
    abr,
    audioCodec = "aac",
    videoCodec = "copy",
    preferCopyAudio = true,
    faststart = false,
    extraArgs = [],
  } = opts;
  const args = ["-y"];
  const { start, end } = trim || {};
  const hasStart = typeof start === "number" && !Number.isNaN(start);
  const hasEnd = typeof end === "number" && !Number.isNaN(end);
  if (hasStart) args.push("-ss", String(start));
  args.push("-i", input);
  if (hasEnd) {
    if (hasStart) args.push("-t", String(Math.max(0, end - start)));
    else args.push("-to", String(end));
  }
  const audioFilters = Array.isArray(filters) ? filters.filter(Boolean) : [];
  if (audioFilters.length) args.push("-filter:a", audioFilters.join(","));
  if (sampleRate) args.push("-ar", String(sampleRate));
  args.push("-c:v", videoCodec || "copy");
  const audioBitrate = Number(abr);
  const hasAbr = Number.isFinite(audioBitrate) && audioBitrate > 0;
  const needEncodeAudio =
    !preferCopyAudio ||
    audioFilters.length > 0 ||
    (typeof sampleRate === "number" && Number.isFinite(sampleRate)) ||
    hasAbr ||
    (audioCodec && audioCodec !== "copy");
  if (needEncodeAudio) {
    args.push("-c:a", audioCodec || "aac");
    if (hasAbr) args.push("-b:a", `${audioBitrate}k`);
  } else {
    args.push("-c:a", "copy");
  }
  if (faststart) args.push("-movflags", "+faststart");
  if (Array.isArray(extraArgs) && extraArgs.length) args.push(...extraArgs);
  args.push(output);
  return runFfmpeg(args);
};

const ffmpegToMp4Video = (input, output, opts = {}) => {
  const { abr, preferCopyAudio = true, videoCodec = "copy", ...rest } = opts || {};
  return ffmpegConvertVideo(input, output, {
    ...rest,
    abr,
    preferCopyAudio,
    audioCodec: "aac",
    videoCodec,
    faststart: true,
  });
};

const ffmpegToWebmVideo = (input, output, opts = {}) => {
  const { abr, preferCopyAudio = true, videoCodec = "copy", ...rest } = opts || {};
  return ffmpegConvertVideo(input, output, {
    ...rest,
    abr,
    preferCopyAudio,
    audioCodec: "libopus",
    videoCodec,
  });
};

const ffmpegToMkvVideo = (input, output, opts = {}) => {
  const { abr, preferCopyAudio = true, videoCodec = "copy", ...rest } = opts || {};
  return ffmpegConvertVideo(input, output, {
    ...rest,
    abr,
    preferCopyAudio,
    audioCodec: "aac",
    videoCodec,
  });
};

const ffmpegCreateRingtone = (input, output, opts = {}) => {
  const {
    start = 0,
    duration = 30,
    fadeIn = 0.6,
    fadeOut = 1.2,
    codecArgs = [],
  } = opts;
  return new Promise((resolve, reject) => {
    const args = ["-y"];
    if (start > 0) args.push("-ss", String(start));
    args.push("-i", input);
    if (duration > 0) args.push("-t", String(duration));
    args.push("-ac", "2", "-ar", "44100");
    const fades = [];
    if (fadeIn > 0) fades.push(`afade=t=in:st=0:d=${fadeIn.toFixed(2)}`);
    if (fadeOut > 0) {
      const fadeStart = Math.max(duration - fadeOut, 0);
      fades.push(`afade=t=out:st=${fadeStart.toFixed(2)}:d=${fadeOut.toFixed(2)}`);
    }
    if (fades.length) {
      args.push("-af", fades.join(","));
    }
    args.push(...codecArgs, output);
    const ff = spawn(ffmpegPath || "ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let logs = "";
    ff.stdout.on("data", (d) => (logs += d.toString()));
    ff.stderr.on("data", (d) => (logs += d.toString()));
    ff.on("error", (err) => {
      if (err.code === "ENOENT") return reject(new Error("ffmpeg tidak ditemukan"));
      reject(err);
    });
    ff.on("close", (code) => {
      if (code === 0) resolve(logs);
      else reject(new Error(logs));
    });
  });
};

const createRingtoneVariants = async ({ sourcePath, id, baseName, trimOpt, request = {} }) => {
  const enabled = request && (request.enabled === true || request.enabled === "true" || request.enabled === 1);
  if (!enabled || !sourcePath) return [];
  const variants = [];
  const length = clamp(Number(request.length) || 30, 5, 60);
  const fadeIn = clamp(Number(request.fadeIn) || 0.6, 0, 10);
  const fadeOut = clamp(Number(request.fadeOut) || 1.2, 0, 10);
  const start = trimOpt?.start ? Math.max(Number(trimOpt.start), 0) : 0;
  const stem = sanitizeFileName(request.fileStem || `${baseName || id}-ringtone`) || `${id}-ringtone`;

  const addVariant = async ({ ext, codecArgs, platform }) => {
    const outName = `${id}.ring.${ext}`;
    const outputPath = join(JOBS_DIR, outName);
    await ffmpegCreateRingtone(sourcePath, outputPath, {
      start,
      duration: length,
      fadeIn,
      fadeOut,
      codecArgs,
    });
    variants.push({
      format: ext,
      platform,
      downloadUrl: `/public/jobs/${outName}`,
      fileName: `${stem}.${ext}`,
      duration: length,
    });
  };

  try {
    await addVariant({
      ext: "m4r",
      platform: "iphone",
      codecArgs: ["-c:a", "aac", "-b:a", "192k"],
    });
  } catch (err) {
    console.warn("Gagal membuat ringtone m4r", err);
  }

  try {
    await addVariant({
      ext: "ogg",
      platform: "android",
      codecArgs: ["-c:a", "libvorbis", "-qscale:a", "5"],
    });
  } catch (err) {
    console.warn("Gagal membuat ringtone ogg", err);
  }

  return variants;
};

const SPOTIFY_PREVIEW_HEADERS = {
  Accept: "audio/*;q=0.9,*/*;q=0.8",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  Referer: "https://open.spotify.com/",
};

const downloadSpotifyPreview = async ({ previewUrl, id }) => {
  if (!previewUrl || !id) {
    throw new Error("Preview Spotify tidak valid");
  }
  let response;
  try {
    response = await safeFetch(previewUrl, { headers: SPOTIFY_PREVIEW_HEADERS, redirect: "follow" });
  } catch (err) {
    const error = new Error("Tidak bisa mengambil preview Spotify");
    error.cause = err;
    throw error;
  }
  if (!response?.ok) {
    const error = new Error("Preview Spotify tidak tersedia");
    error.status = response?.status;
    throw error;
  }
  let buffer;
  try {
    const arrayBuffer = await response.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
  } catch (err) {
    const error = new Error("Gagal membaca data preview Spotify");
    error.cause = err;
    throw error;
  }
  if (!buffer?.length) {
    throw new Error("Preview Spotify kosong");
  }
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  let ext = "mp3";
  if (contentType.includes("ogg")) ext = "ogg";
  else if (contentType.includes("aac")) ext = "aac";
  else if (contentType.includes("flac")) ext = "flac";
  else if (contentType.includes("wav")) ext = "wav";
  else if (contentType.includes("mpeg")) ext = "mp3";
  const filename = `${id}.spotify.${ext}`;
  const fullPath = join(JOBS_DIR, filename);
  await fsp.writeFile(fullPath, buffer);
  return {
    filename,
    fullPath,
    ext,
    logs: `spotify-preview: ${previewUrl}`,
    source: "spotify-preview",
    contentType,
  };
};



const parseEtaString = (value = "") => {
  const text = String(value || "").trim();
  if (!text) return null;
  const parts = text.split(":").map((v) => Number(v));
  if (parts.some((n) => Number.isNaN(n))) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return null;
};

const parseYtDlpProgressLine = (line = "") => {
  if (!line.includes("[download]")) return null;
  const percentMatch = line.match(/\[download\]\s+(\d+(?:\.\d+)?)%/i);
  if (!percentMatch) return null;
  const percent = Number(percentMatch[1]);
  const ofMatch = line.match(/\bof\s+([0-9.]+\s*(?:[KMG]i?B))/i);
  const speedMatch = line.match(/\bat\s+([0-9.]+\s*(?:[KMG]i?B\/s))/i);
  const etaMatch = line.match(/ETA\s+([0-9:]+)/i);
  const timeMatch = line.match(/\bin\s+([0-9:.]+)/i);
  const etaLabel = etaMatch ? etaMatch[1] : timeMatch ? "00:00" : "";
  const etaSeconds = etaMatch ? parseEtaString(etaMatch[1]) : timeMatch ? 0 : null;
  const sizeLabel = ofMatch ? ofMatch[1] : "";
  const speedLabel = speedMatch ? speedMatch[1] : "";
  return {
    percent,
    etaLabel,
    etaSeconds,
    sizeLabel,
    speedLabel,
  };
};

const buildYtDlpFallbackArgs = (args = []) => {
  const next = Array.isArray(args) ? [...args] : [];
  if (!next.length) return next;

  const url = next[next.length - 1];
  const isUrlLike = typeof url === "string" && (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("ytsearch:"));
  const urlArg = isUrlLike ? next.pop() : null;

  const hasExtractorArgs = next.includes("--extractor-args");
  if (!hasExtractorArgs) {
    next.push("--extractor-args", "youtube:player_client=android");
  }

  if (!next.includes("--force-ipv4")) {
    next.push("--force-ipv4");
  }

  for (let i = 0; i < next.length - 1; i++) {
    if (next[i] === "-f" && typeof next[i + 1] === "string") {
      const selector = next[i + 1];
      if (selector.includes("bestaudio")) {
        next[i + 1] = "bestaudio/best";
      }
      break;
    }
  }

  if (urlArg) next.push(urlArg);
  return next;
};

const runYtDlpDownload = ({ args, id, onProgress }) =>
  new Promise((resolve, reject) => {
    const isWin = process.platform === "win32";
    const cmd = isWin ? "python" : "yt-dlp";
    const spawnArgs = isWin ? ["-m", "yt_dlp", ...args] : args;
    const proc = spawn(cmd, spawnArgs, { stdio: ["ignore", "pipe", "pipe"] });
    let logs = "";
    let stdoutBuffer = "";
    const handleLine = (line) => {
      if (typeof onProgress !== "function") return;
      const parsed = parseYtDlpProgressLine(line);
      if (!parsed) return;
      onProgress({
        stage: "downloading",
        percent: parsed.percent,
        etaSeconds: parsed.etaSeconds,
        etaLabel: parsed.etaLabel,
        size: parsed.sizeLabel,
        speed: parsed.speedLabel,
      });
    };
    proc.stdout.on("data", (d) => {
      const chunk = d.toString();
      logs += chunk;
      stdoutBuffer += chunk;
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() || "";
      lines.forEach(handleLine);
    });
    proc.stderr.on("data", (d) => {
      const chunk = d.toString();
      logs += chunk;
      if (typeof onProgress === "function") {
        chunk.split(/\r?\n/).forEach(handleLine);
      }
    });
    proc.on("error", (err) => {
      const error = new Error("yt-dlp tidak bisa dijalankan");
      error.cause = err;
      error.logs = logs;
      reject(error);
    });
    proc.on("close", (code) => {
      if (code !== 0) {
        const error = new Error("yt-dlp gagal");
        error.logs = logs;
        return reject(error);
      }
      const files = readdirSync(JOBS_DIR).filter((f) =>
        f.startsWith(`${id}.`) &&
        !f.endsWith('.cover.jpg') &&
        !f.endsWith('.part') &&
        !f.endsWith('.ytdl')
      );
      if (!files.length) {
        const error = new Error("Output tidak ditemukan");
        error.logs = logs;
        return reject(error);
      }
      const filename = files[0];
      const fullPath = join(JOBS_DIR, filename);
      const ext = filename.split(".").pop();
      resolve({ filename, fullPath, ext, logs });
    });
  });

const runPythonDownload = ({ url, id, baseLogs = "" }) =>
  new Promise((resolve, reject) => {
    let pyLogs = "";
    const scriptArgs = [
      join(__dirname, "download_audio.py"),
      url,
      JOBS_DIR,
      id,
    ];
    if (existsSync(COOKIES_PATH)) {
      scriptArgs.push(COOKIES_PATH);
    }

    const pyCmd = process.platform === "win32" ? "python" : "python3";
    const py = spawn(pyCmd, scriptArgs, { stdio: ["ignore", "pipe", "pipe"] });

    py.stdout.on("data", (d) => {
      const s = d.toString();
      pyLogs += s;
    });
    py.stderr.on("data", (d) => (pyLogs += d.toString()));

    py.on("error", (err) => {
      const error = new Error("Downloader helper tidak bisa dijalankan");
      error.cause = err;
      error.logs = baseLogs + pyLogs;
      reject(error);
    });

    py.on("close", async (code) => {
      if (code !== 0) {
        const lines = pyLogs.trim().split(/\r?\n/);
        const lastLines = lines.slice(-3).join('; ');
        let msg = `Downloader helper gagal (Code: ${code}): ${lastLines}`;
        if (/Sign in|cookies|restricted|private|confirm your age/i.test(pyLogs)) {
          msg += " [HINT: Video mungkin dibatasi. Coba upload cookies terbaru di Admin Panel]";
        }
        const error = new Error(msg);
        error.logs = baseLogs + pyLogs;
        return reject(error);
      }
      try {
        const entries = await fsp.readdir(JOBS_DIR);
        const filename = entries.find(
          (name) =>
            name.startsWith(`${id}.`) &&
            !name.endsWith('.cover.jpg') &&
            !name.endsWith('.part') &&
            !name.endsWith('.ytdl')
        );
        if (!filename) {
          throw new Error('Downloader helper tidak menghasilkan file');
        }
        const fullPath = join(JOBS_DIR, filename);
        const ext = filename.split('.').pop();
        resolve({ filename, fullPath, ext, logs: baseLogs + pyLogs });
      } catch (err) {
        const error = new Error(err.message || "Downloader helper output tidak valid");
        error.logs = baseLogs + pyLogs;
        if (!error.cause) error.cause = err;
        reject(error);
      }
    });
  });

const convertSingle = async (payload = {}) => {
  const {
    format = "mp3",
    abr = 192,
    sampleRate,
    fileName,
    noPlaylist = true,
    id3 = {},
    trim,
    normalize = false,
    atmos = false,
    speedMode = "normal",
    denoise = false,
    volumeBoost = 0,
    enhancer = "none",
    soundEffect = "none",
    vpnFriendly = false,
    smartResume = false,
    videoQuality: videoQualityPreference = "best",
  } = payload;

  let coverUrl = typeof payload.coverUrl === "string" ? payload.coverUrl : undefined;
  let url = typeof payload.url === "string" ? payload.url.trim() : "";
  const keywordQuery = typeof payload.keyword === "string" ? payload.keyword.trim() : "";
  const preferredLangRaw = typeof payload.preferredLang === "string" ? payload.preferredLang.trim() : "";
  const preferredLang = normalizePreferredLang(preferredLangRaw);
  const ringtoneRequest = payload.ringtone || {};
  const initialSourceKind = url ? identifyMediaSource(url) : "unknown";
  let originalSource = url && initialSourceKind !== "unknown"
    ? { type: initialSourceKind, url }
    : null;

  const progressIdRaw = typeof payload.progressId === "string" ? payload.progressId.trim() : "";
  const progressId = progressIdRaw ? progressIdRaw : "";
  if (progressId) {
    initProgress(progressId, { stage: "init", message: "Menyiapkan konversi", percent: 1 });
  }
  const emitProgress = progressId
    ? (patch) => updateProgress(progressId, patch)
    : () => { };
  const finalizeProgress = progressId
    ? (stage, extra) => finishProgress(progressId, stage, extra)
    : () => { };

  try {
    emitProgress({ stage: "validating", message: "Memvalidasi input", percent: 3 });

    let metadata = null;
    if (!url || !/^https?:\/\//.test(url)) {
      if (!keywordQuery) {
        throw new Error("URL atau kata kunci tidak valid");
      }
      try {
        metadata = await fetchVideoInfo({ keyword: keywordQuery, preferLang: preferredLang });
        url = metadata?.webpageUrl || "";
        emitProgress({ stage: "metadata", message: "Mencari dari kata kunci", percent: 7 });
      } catch (err) {
        const error = new Error(err?.message || "Tidak menemukan hasil pencarian");
        error.logs = err?.logs;
        throw error;
      }
    }

    if (!url || !/^https?:\/\//.test(url)) {
      throw new Error("URL tidak valid");
    }

    emitProgress({ stage: "metadata", message: "Mengambil metadata", percent: 8 });
    if (!metadata) {
      metadata = await fetchVideoInfo({ url, preferLang: preferredLang }).catch(() => null);
    }

    if (metadata?.webpageUrl) {
      url = metadata.webpageUrl;
    }

    emitProgress({ stage: "metadata", message: "Metadata siap", percent: 12 });

    // === DUPLICATE DETECTOR / CACHE CHECK ===
    const cacheKeyPayload = {
      videoId: metadata?.id || metadata?.videoId || url,
      format,
      abr,
      sampleRate,
      trim,
      normalize,
      atmos,
      speedMode,
      denoise,
      volumeBoost,
      enhancer,
      soundEffect,
      smartResume,
      videoQuality: videoQualityPreference,
      id3: id3 || {} // Include metadata in cache key to distinguish custom tags
    };
    const cacheKey = createHash("md5").update(JSON.stringify(cacheKeyPayload)).digest("hex");

    const cached = CacheStore.get(cacheKey);
    /* Cache disabled for debugging Audio Insight
    if (cached && cached.fileName) {
       const cachedPath = join(process.cwd(), 'public/jobs', cached.fileName);
       if (existsSync(cachedPath)) {
          emitProgress({ stage: "encoding", message: "Mengambil dari cache", percent: 100 });
          // Return cached result with duplicate flag
          return { ...cached, isDuplicate: true, logs: cached.logs + '\n[Info] Retrieved from cache.' };
       }
    }
    */
    // === END DUPLICATE DETECTOR ===

    if (metadata?.originalSource) {
      originalSource = originalSource
        ? { ...originalSource, ...metadata.originalSource }
        : metadata.originalSource;
    }

    if (!metadata && originalSource) {
      metadata = { originalSource };
      if (originalSource.previewUrl) {
        metadata.preview = {
          url: originalSource.previewUrl,
          provider: originalSource.type || "spotify",
          type: "audio",
          embedUrl: originalSource.embedUrl || "",
          duration: originalSource.previewDuration || null,
          durationMs: originalSource.previewDurationMs || null,
        };
      }
    } else if (metadata && originalSource && !metadata.originalSource && originalSource.type !== "unknown") {
      metadata.originalSource = originalSource;
      if (originalSource.previewUrl && (!metadata.preview || typeof metadata.preview !== "object")) {
        metadata.preview = {
          url: originalSource.previewUrl,
          provider: originalSource.type || "spotify",
          type: "audio",
          embedUrl: originalSource.embedUrl || "",
          duration: originalSource.previewDuration || null,
          durationMs: originalSource.previewDurationMs || null,
        };
      }
    }

    if (!coverUrl && metadata?.cover) {
      coverUrl = metadata.cover;
    }

    const fmt = String(format || "").toLowerCase();
    if (!SUPPORTED_FORMATS.has(fmt)) {
      throw new Error("Format tidak didukung");
    }
    const isVideoFormat = VIDEO_FORMATS.has(fmt);
    const previewProvider = (metadata?.preview?.provider || metadata?.originalSource?.type || "").toLowerCase();
    const spotifyPreviewUrl = !isVideoFormat && previewProvider === "spotify"
      ? (metadata?.preview?.url || metadata?.originalSource?.previewUrl || "")
      : "";
    if (!VALID_SPEED_MODES.has(speedMode || "normal")) {
      throw new Error("Mode kecepatan tidak dikenali");
    }

    const denoiseEnabled = typeof denoise === "string"
      ? ["1", "true", "yes", "on"].includes(denoise.toLowerCase())
      : !!denoise;

    let boostValue = Number(volumeBoost);
    if (Number.isNaN(boostValue)) boostValue = 0;
    boostValue = clamp(boostValue, -20, 20);

    const enhancerKey = typeof enhancer === "string" ? enhancer.trim().toLowerCase() : "none";
    const VALID_ENHANCERS = new Set(["none", "clarity", "warm", "club"]);
    const enhancerMode = VALID_ENHANCERS.has(enhancerKey) ? enhancerKey : "none";

    const soundEffectKey = typeof soundEffect === "string" ? soundEffect.trim().toLowerCase() : "none";
    const VALID_SOUND_EFFECTS = new Set(["none", "reverb", "echo", "lofi"]);
    const soundEffectMode = VALID_SOUND_EFFECTS.has(soundEffectKey) ? soundEffectKey : "none";

    const vpnMode = typeof vpnFriendly === "string"
      ? ["1", "true", "yes", "on"].includes(vpnFriendly.trim().toLowerCase())
      : !!vpnFriendly;
    const resumeMode = typeof smartResume === "string"
      ? ["1", "true", "yes", "on"].includes(smartResume.trim().toLowerCase())
      : !!smartResume;

    let sr;
    if (sampleRate !== undefined) {
      sr = Number(sampleRate);
      if (Number.isNaN(sr) || sr <= 0) {
        throw new Error("sampleRate tidak valid");
      }
    }

    const sanitizedOptions = sanitizeFormatOptions(fmt, {
      abr,
      sampleRate: sr,
      speedMode,
      videoQuality: videoQualityPreference,
    });
    const effectiveSpeedMode = sanitizedOptions.speedMode || "normal";
    const targetAbr = sanitizedOptions.abr != null ? sanitizedOptions.abr : (fmt === "mp3" ? Number(abr) || 192 : null);
    sr = sanitizedOptions.sampleRate !== undefined ? sanitizedOptions.sampleRate : sr;
    const targetVideoQuality = sanitizedOptions.videoQuality || "best";

    let trimOpt = null;
    if (trim && (trim.start !== undefined || trim.end !== undefined)) {
      const hasStart = trim.start !== undefined;
      const hasEnd = trim.end !== undefined;
      const startVal = hasStart ? Number(trim.start) : 0;
      const endVal = hasEnd ? Number(trim.end) : undefined;
      if ((hasStart && Number.isNaN(startVal)) ||
        (hasEnd && Number.isNaN(endVal)) ||
        (hasStart && hasEnd && endVal < startVal)) {
        throw new Error("trim tidak valid");
      }
      trimOpt = {};
      if (hasStart) trimOpt.start = startVal;
      if (hasEnd) trimOpt.end = endVal;
    }

    const id = nanoid(10);
    const outTpl = join(JOBS_DIR, `${id}.%(ext)s`);
    const metaBaseRaw = metadata?.cleanTitle || metadata?.title || keywordQuery || "";
    const manualFileName = sanitizeFileName(fileName || "");
    const id3Title = sanitizeFileName(id3?.title || "");
    const metaArtist = sanitizeFileName(id3?.artist || metadata?.artist || metadata?.author || "");
    const titleCandidate = sanitizeFileName(metaBaseRaw || id3?.title || keywordQuery || id) || id;
    const bitrateLabel = !isVideoFormat && (targetAbr || sanitizedOptions.abr)
      ? `${targetAbr || sanitizedOptions.abr}kbps`
      : "";
    let qualityLabel = "";
    if (isVideoFormat) {
      qualityLabel = targetVideoQuality && targetVideoQuality !== "best"
        ? `${targetVideoQuality}p`
        : "";
    } else if (!bitrateLabel && sr) {
      qualityLabel = `${Math.round((sr || 0) / 1000)}kHz`;
    }
    const suffixTokens = [bitrateLabel, qualityLabel].filter(Boolean);
    const autoPattern = [metaArtist, titleCandidate].filter(Boolean).join(" - ") || titleCandidate;
    const autoName = suffixTokens.length
      ? `${autoPattern} (${suffixTokens.join(" · ")})`
      : autoPattern;
    const autoBaseName = sanitizeFileName(autoName) || titleCandidate || id;
    const baseName = manualFileName || id3Title || autoBaseName;

    let coverPath = null;
    if (coverUrl && /^https?:\/\//.test(coverUrl) && ["mp3", "m4a", "flac"].includes(fmt)) {
      try {
        const imgResp = await safeFetch(coverUrl);
        if (imgResp.ok) {
          const buf = Buffer.from(await imgResp.arrayBuffer());
          coverPath = join(JOBS_DIR, `${id}.cover.jpg`);
          await fsp.writeFile(coverPath, buf);
        }
      } catch { }
    }

    const args = ["--newline", "--no-progress"];
    if (ffmpegPath) {
      args.push("--ffmpeg-location", ffmpegPath);
    }
    if (existsSync(COOKIES_PATH)) {
      args.push("--cookies", COOKIES_PATH);
    }
    args.push("--js-runtimes", "node");
    args.push("--remote-components", "ejs:github");
    if (noPlaylist) args.push("--no-playlist");
    args.push("-o", outTpl);

    emitProgress({ stage: "downloading", message: "Menyiapkan unduhan", percent: 15 });

    const sanitizedAbrForDownload = isVideoFormat ? undefined : targetAbr || Number(abr) || undefined;
    const baseAudioSelector = atmos ? "bestaudio[channels>2]/bestaudio/best" : "bestaudio/best";

    if (isVideoFormat) {
      const selector = buildVideoFormatSelector(fmt, targetVideoQuality);
      if (selector) args.push("-f", selector);
      if (fmt === "mp4") {
        args.push("--merge-output-format", "mp4");
      } else if (fmt === "webm") {
        args.push("--merge-output-format", "webm");
      } else if (fmt === "mkv") {
        args.push("--merge-output-format", "mkv");
      }
    } else if (fmt === "m4a") {
      args.push("-f", "bestaudio[ext=m4a]/bestaudio/best");
    } else if (fmt === "alac") {
      args.push("-f", baseAudioSelector);
      args.push("-x", "--audio-format", "alac");
    } else if (fmt === "aac") {
      args.push("-f", baseAudioSelector);
      args.push("-x", "--audio-format", "aac");
      if (sanitizedAbrForDownload) args.push("--audio-quality", abrToQ(sanitizedAbrForDownload));
    } else if (fmt === "opus") {
      args.push("-f", baseAudioSelector);
      args.push("-x", "--audio-format", "opus");
      if (sanitizedAbrForDownload) args.push("--audio-quality", abrToQ(sanitizedAbrForDownload));
    } else if (fmt === "flac") {
      args.push("-f", baseAudioSelector);
      args.push("-x", "--audio-format", "flac");
    } else if (fmt === "mp3") {
      args.push("-f", baseAudioSelector);
      args.push("-x", "--audio-format", "mp3", "--audio-quality", abrToQ(sanitizedAbrForDownload));
    } else if (fmt === "wav") {
      args.push("-f", baseAudioSelector);
      args.push("-x", "--audio-format", "wav");
    } else if (fmt === "aiff") {
      args.push("-f", baseAudioSelector);
      args.push("-x", "--audio-format", "wav");
    } else if (fmt === "caf") {
      args.push("-f", baseAudioSelector);
      args.push("-x", "--audio-format", "wav");
    } else if (fmt === "ogg") {
      args.push("-f", baseAudioSelector);
      args.push("-x", "--audio-format", "ogg");
    }
    if (resumeMode) {
      args.push("--continue", "--no-overwrites");
    }
    if (vpnMode) {
      const chunkSize = String(process.env.VPN_HTTP_CHUNK_SIZE || "4M");
      args.push("--concurrent-fragments", "1", "--http-chunk-size", chunkSize);
      const proxyUrl = process.env.VPN_PROXY_URL;
      if (proxyUrl) args.push("--proxy", proxyUrl);
    }
    if (vpnMode || resumeMode) {
      const retryCount = String(process.env.VPN_RETRY_COUNT || 12);
      const fragmentRetry = String(process.env.VPN_FRAGMENT_RETRY_COUNT || 12);
      args.push("--retries", retryCount, "--fragment-retries", fragmentRetry);
    }
    args.push(url);

    const mapDownloadPercent = (pct) => 15 + (Math.min(Math.max(Number(pct) || 0, 0), 100) * 0.65);
    const handleDownloadProgress = (info) => {
      if (!info || typeof info.percent !== "number") return;
      const details = [];
      if (info.etaLabel) details.push(`ETA ${info.etaLabel}`);
      else if (typeof info.etaSeconds === "number" && info.etaSeconds >= 0) details.push(`ETA ${info.etaSeconds}s`);
      if (info.speed) details.push(info.speed);
      if (info.size) details.push(info.size);
      emitProgress({
        stage: "downloading",
        percent: mapDownloadPercent(info.percent),
        etaSeconds: typeof info.etaSeconds === "number" ? info.etaSeconds : null,
        etaLabel: info.etaLabel || "",
        speed: info.speed || "",
        size: info.size || "",
        message: `Mengunduh${details.length ? ` · ${details.join(" · ")}` : ""}`,
      });
    };

    let logs = "";
    let downloadResult = null;

    // Untuk Spotify: metadata dari spotDL, download dari YouTube Music/YouTube via yt-dlp
    // Preview URL hanya untuk metadata, tidak digunakan untuk download

    if (!downloadResult) {
      try {
        downloadResult = await runYtDlpDownload({ args, id, onProgress: handleDownloadProgress });
        logs = downloadResult.logs || "";
      } catch (err) {
        const baseLogs = err.logs || "";
        if (isVideoFormat) {
          if (coverPath) try { await fsp.unlink(coverPath); } catch { }
          const videoError = new Error(err.message || "Gagal mengunduh");
          videoError.logs = (baseLogs || "").slice(-8000);
          throw videoError;
        }
        const shouldRetryWithFallbackArgs = /Requested format is not available|HTTP Error 400|HTTP Error 403|Forbidden|Sign in|cookies|confirm your age|precondition|This video is unavailable/i.test(baseLogs || "");
        if (shouldRetryWithFallbackArgs) {
          try {
            emitProgress({ stage: "downloading", message: "Mencoba mode kompatibilitas", percent: mapDownloadPercent(18) });
            const fallbackArgs = buildYtDlpFallbackArgs(args);
            downloadResult = await runYtDlpDownload({ args: fallbackArgs, id, onProgress: handleDownloadProgress });
            logs = downloadResult.logs || baseLogs;
          } catch (retryErr) {
            logs = retryErr?.logs || logs || baseLogs;
          }
        }
        if (!downloadResult) {
          try {
            emitProgress({ stage: "downloading", message: "Downloader cadangan", percent: mapDownloadPercent(20) });
            downloadResult = await runPythonDownload({ url, id, baseLogs });
            logs = downloadResult.logs || baseLogs;
          } catch (pyErr) {
            if (coverPath) try { await fsp.unlink(coverPath); } catch { }
            const finalError = new Error(pyErr.message || err.message || "Gagal mengunduh");
            const combinedLogs = [logs, baseLogs, pyErr.logs].filter(Boolean).join("\n");
            finalError.logs = combinedLogs.slice(-8000);
            throw finalError;
          }
        }
      }
    }

    if (!downloadResult) {
      if (coverPath) try { await fsp.unlink(coverPath); } catch { }
      throw new Error("Gagal mengunduh");
    }

    let { filename, fullPath, ext } = downloadResult;
    logs = (downloadResult.logs || logs || "").slice(-8000);

    emitProgress({ stage: "processing", message: "Memproses audio", percent: 82 });

    const audioProbe = await probeAudioStream(fullPath).catch(() => null);
    // Calculate LUFS before conversion (for "Original" stats)
    // Note: This might add some processing time
    const audioInsightBefore = await probeAudioLoudness(fullPath).catch(() => null);
    if (audioInsightBefore) {
      audioInsightBefore.waveform = await generateWaveformData(fullPath).catch(() => []);
    }

    const detectedSampleRate = audioProbe?.sampleRate;
    const filterSampleRate = deriveFilterSampleRate(fmt, sr, detectedSampleRate);
    const filters = buildAudioFilters({
      normalize,
      speedMode: effectiveSpeedMode,
      denoise: denoiseEnabled,
      volumeBoost: boostValue,
      enhancer: enhancerMode,
      soundEffect: soundEffectMode,
      sampleRate: filterSampleRate,
      sourceSampleRate: detectedSampleRate,
      crossfade: !!payload.crossfade
    });

    const id3Clean = Object.entries(id3 || {}).reduce((acc, [k, v]) => {
      if (v !== undefined && v !== null && String(v).trim() !== "") acc[k] = v;
      return acc;
    }, {});
    if (!id3Clean.title && metadata?.id3?.title) id3Clean.title = metadata.id3.title;
    if (!id3Clean.artist && metadata?.id3?.artist) id3Clean.artist = metadata.id3.artist;
    if (!id3Clean.album && metadata?.id3?.album) id3Clean.album = metadata.id3.album;
    if (!id3Clean.genre) {
      const autoGenre = buildAiTags({
        title: id3Clean.title || baseName,
        channel: id3Clean.artist || "",
      }).genre;
      if (autoGenre) id3Clean.genre = autoGenre;
    }
    const hasId3 = Object.keys(id3Clean).length > 0;
    const hasTrim = !!trimOpt && Object.keys(trimOpt).length > 0;
    const hasFilters = filters.length > 0;
    const hasCover = !!coverPath;
    const rule = FORMAT_RULES[fmt];
    const detectedRate = parseSampleRate(detectedSampleRate);
    const needSampleRate = sr !== undefined || (!!rule?.sampleRates?.length && !rule.sampleRates.includes(detectedRate));
    const finalSamplePreference = sr !== undefined ? sr : (needSampleRate ? filterSampleRate : undefined);

    const finalize = async (targetExt, converter, extraOpts = {}) => {
      const tmpOut = join(JOBS_DIR, `${id}.tmp.${targetExt}`);
      await converter(fullPath, tmpOut, {
        ...extraOpts,
        trim: trimOpt || {},
        sampleRate: finalSamplePreference,
        filters,
      });
      await fsp.unlink(fullPath);
      filename = `${id}.${targetExt}`;
      fullPath = join(JOBS_DIR, filename);
      await fsp.rename(tmpOut, fullPath);
      ext = targetExt;
    };

    emitProgress({ stage: "encoding", message: "Mengonversi dengan ffmpeg", percent: 88 });

    try {
      if (fmt === "mp3") {
        const needConvert = ext !== "mp3" || hasId3 || hasTrim || hasFilters || hasCover || needSampleRate;
        if (needConvert) {
          await finalize("mp3", ffmpegToMp3, { abr: targetAbr || 192, id3: id3Clean, cover: coverPath });
        }
      } else if (fmt === "flac") {
        const needConvert = ext !== "flac" || hasId3 || hasTrim || hasFilters || hasCover || needSampleRate;
        if (needConvert) {
          await finalize("flac", ffmpegToFlac, { id3: id3Clean, cover: coverPath });
        }
      } else if (fmt === "m4a") {
        const needConvert = ext !== "m4a" || hasId3 || hasTrim || hasFilters || hasCover || needSampleRate;
        if (needConvert) {
          await finalize("m4a", ffmpegToM4a, { id3: id3Clean, cover: coverPath, abr: targetAbr || 192 });
        }
      } else if (fmt === "aac") {
        const needConvert = ext !== "aac" || hasId3 || hasTrim || hasFilters || needSampleRate;
        if (needConvert) {
          await finalize("aac", ffmpegToAac, { id3: id3Clean, abr: targetAbr || 256 });
        }
      } else if (fmt === "opus") {
        const needConvert = ext !== "opus" || hasId3 || hasTrim || hasFilters || needSampleRate;
        if (needConvert) {
          await finalize("opus", ffmpegToOpus, { id3: id3Clean, abr: targetAbr || 192 });
        }
      } else if (fmt === "wav") {
        const needConvert = ext !== "wav" || hasTrim || hasFilters || needSampleRate;
        if (needConvert) {
          await finalize("wav", ffmpegToWav, {});
        }
      } else if (fmt === "aiff") {
        const needConvert = ext !== "aiff" || hasId3 || hasTrim || hasFilters || needSampleRate;
        if (needConvert) {
          await finalize("aiff", ffmpegToAiff, { id3: id3Clean });
        }
      } else if (fmt === "alac") {
        const needConvert =
          ext !== "m4a" || hasId3 || hasTrim || hasFilters || hasCover || needSampleRate;
        if (needConvert) {
          await finalize("m4a", ffmpegToAlac, { id3: id3Clean, sampleRate: sr });
        }
        ext = "m4a";
      } else if (fmt === "caf") {
        const needConvert = ext !== "caf" || hasTrim || hasFilters || needSampleRate;
        if (needConvert) {
          await finalize("caf", ffmpegToCaf, {});
        }
      } else if (fmt === "ogg") {
        const needConvert = ext !== "ogg" || hasTrim || hasFilters || needSampleRate;
        if (needConvert) {
          await finalize("ogg", ffmpegToOgg, {});
        }
      } else if (fmt === "mp4") {
        const preferCopyAudio = !hasFilters && !needSampleRate && (targetAbr == null);
        const needConvert =
          ext !== "mp4" || hasTrim || hasFilters || needSampleRate || targetAbr != null;
        if (needConvert) {
          await finalize("mp4", ffmpegToMp4Video, {
            abr: targetAbr || undefined,
            preferCopyAudio,
          });
        }
      } else if (fmt === "webm") {
        const preferCopyAudio = !hasFilters && !needSampleRate && (targetAbr == null);
        const needConvert =
          ext !== "webm" || hasTrim || hasFilters || needSampleRate || targetAbr != null;
        if (needConvert) {
          await finalize("webm", ffmpegToWebmVideo, {
            abr: targetAbr || undefined,
            preferCopyAudio,
          });
        }
      } else if (fmt === "mkv") {
        const preferCopyAudio = !hasFilters && !needSampleRate && (targetAbr == null);
        const needConvert =
          ext !== "mkv" || hasTrim || hasFilters || needSampleRate || targetAbr != null;
        if (needConvert) {
          await finalize("mkv", ffmpegToMkvVideo, {
            abr: targetAbr || undefined,
            preferCopyAudio,
          });
        }
      }
    } catch (err) {
      if (coverPath) try { await fsp.unlink(coverPath); } catch { }
      const error = new Error(err.message || "ffmpeg gagal");
      error.logs = (logs + (err.logs || "")).slice(-8000);
      throw error;
    }

    emitProgress({ stage: "encoding", message: "Finishing", percent: 93 });

    if (coverPath) try { await fsp.unlink(coverPath); } catch { }

    const audioInsightAfter = await probeAudioLoudness(fullPath).catch(() => null);
    if (audioInsightAfter) {
      audioInsightAfter.waveform = await generateWaveformData(fullPath).catch(() => []);
    }

    const audioInsight = {
      before: audioInsightBefore || null,
      after: audioInsightAfter || null,
      lufs: audioInsightAfter?.lufs ?? audioInsightBefore?.lufs,
      peak: audioInsightAfter?.peak ?? audioInsightBefore?.peak,
      dr: audioInsightAfter?.lra ?? audioInsightBefore?.lra,
      targetLufs: normalize ? '-14 LUFS' : 'Original',
    };

    const downloadUrl = `/public/jobs/${filename}`;
    const finalExt = ext;
    const downloadFileName = `${baseName}.${finalExt}`;
    const finalSampleRate = finalSamplePreference
      ? Math.round(finalSamplePreference)
      : (filters.some((f) => /^aresample=/.test(f)) ? filterSampleRate : detectedSampleRate) || null;
    const metadataResponse = metadata
      ? {
        id: metadata.id || null,
        title: metadata.title || null,
        cleanTitle: metadata.cleanTitle || null,
        author: metadata.author || null,
        artist: metadata.artist || null,
        album: metadata.album || null,
        cover: metadata.cover || null,
        duration: metadata.duration || null,
        webpageUrl: metadata.webpageUrl || null,
        keywords: metadata.keywords || [],
        languages: metadata.languages || [],
        keywordUsed: metadata.keywordUsed || false,
        provider: metadata.provider || null,
        originalSource: metadata.originalSource || null,
        preview: metadata.preview
          ? {
            url: metadata.preview.url || null,
            provider: metadata.preview.provider || null,
            type: metadata.preview.type || null,
            embedUrl: metadata.preview.embedUrl || null,
            duration: metadata.preview.duration || null,
            durationMs: metadata.preview.durationMs || null,
          }
          : null,
      }
      : null;
    emitProgress({ stage: "ringtone", message: "Menyiapkan ringtone", percent: 95 });
    const ringtoneVariants = await createRingtoneVariants({
      sourcePath: fullPath,
      id,
      baseName,
      trimOpt,
      request: ringtoneRequest,
    });
    if (Array.isArray(ringtoneVariants) && ringtoneVariants.length) {
      emitProgress({ stage: "ringtone", message: "Ringtone siap", percent: 97 });
    }

    // Handle Output Folder Management (Auto-save)
    const outputDir = payload.outputDir ? String(payload.outputDir).trim() : null;
    const organizeBy = payload.organizeBy ? String(payload.organizeBy).trim() : 'none';
    let savedPath = null;

    if (outputDir) {
      try {
        emitProgress({ stage: "saving", message: "Menyimpan ke folder tujuan", percent: 98 });
        let targetDir = outputDir;

        // Sanitization helper
        const sanitizeName = (name) => (name || 'Unknown').replace(/[<>:"/\\|?*]+/g, '_').trim();

        if (organizeBy === 'artist') {
          const artistName = sanitizeName(metadata?.artist || metadata?.author || 'Unknown Artist');
          targetDir = join(outputDir, artistName);
        } else if (organizeBy === 'playlist') {
          const playlistName = sanitizeName(metadata?.playlist || metadata?.album || 'Unknown Playlist');
          targetDir = join(outputDir, playlistName);
        }

        await fsp.mkdir(targetDir, { recursive: true });
        const targetPath = join(targetDir, downloadFileName);

        // Copy instead of move to keep downloadUrl valid for browser
        await fsp.copyFile(fullPath, targetPath);
        savedPath = targetPath;
        logs += `\n[Info] File saved to: ${targetPath}`;
      } catch (err) {
        logs += `\n[Warning] Gagal menyimpan ke folder output: ${err.message}`;
      }
    }

    const response = {
      ok: true,
      id,
      format: finalExt,
      downloadUrl,
      fileName: downloadFileName,
      logs: (logs || "").slice(-8000),
      baseName,
      fullPath,
      ext: finalExt,
      sampleRate: finalSampleRate,
      channels: audioProbe?.channels || null,
      speedMode: effectiveSpeedMode,
      soundEffect: soundEffectMode,
      vpnFriendly: vpnMode,
      smartResume: resumeMode,
      videoQuality: targetVideoQuality,
      spotifyPreview: downloadResult?.source === "spotify-preview",
      metadata: metadataResponse,
      ringtones: ringtoneVariants,
      audioInsight,
      savedPath,
      progressId: progressId || null,
    };

    try {
      const fmtLower = String(finalExt || "").toLowerCase();
      const abrNum = Number(targetAbr);
      const allowed = new Set([320, 256, 192, 128, 64]);
      if (fmtLower === "mp3" && allowed.has(abrNum) && process.env.CLOUDINARY_AUDIO_URL) {
        emitProgress({ stage: "uploading", message: "Menyimpan ke cloud", percent: 99 });
        const uploaded = await uploadAudioToCloudinary({
          filePath: fullPath,
          publicId: `${id}-${abrNum}kbps`,
          folder: `audio/mp3/${abrNum}kbps`,
          mimeType: "audio/mpeg",
        });
        if (uploaded?.url) {
          response.cloudinaryAudio = {
            url: uploaded.url,
            publicId: uploaded.publicId,
            abr: abrNum,
            bytes: uploaded.bytes,
            duration: uploaded.duration,
          };
        }
      }
    } catch (err) {
      logs += `\n[Warning] Cloud upload gagal: ${String(err?.message || err)}`;
      response.logs = (logs || "").slice(-8000);
    }

    CacheStore.set(cacheKey, response);

    if (progressId) {
      finalizeProgress("complete", { message: "Konversi selesai" });
    }
    return response;
  } catch (err) {
    finalizeProgress("error", { message: err?.message || "Konversi gagal" });
    throw err;
  }
};

const sanitizeHistoryCommand = (payload = {}) => {
  const cloned = JSON.parse(JSON.stringify(payload || {}));
  delete cloned.progressId;
  delete cloned.noPlaylist;
  delete cloned._token;
  delete cloned._session;
  return cloned;
};

const computeXpForConversion = (payload = {}, result = {}) => {
  let xp = 50;
  const fmt = String(payload.format || result.format || "").toLowerCase();
  if (["flac", "wav", "alac", "aiff"].includes(fmt)) xp += 25;
  if (["mp4", "webm", "mkv", "mov"].includes(fmt)) xp += 15;
  if (payload.soundEffect && payload.soundEffect !== "none") xp += 10;
  if (payload.enhancer && payload.enhancer !== "none") xp += 15;
  if (payload.normalize) xp += 5;
  if (payload.vpnFriendly) xp += 10;
  if (payload.smartResume) xp += 10;
  if (payload.keyword) xp += 10;
  if (Array.isArray(result?.ringtones) && result.ringtones.length) xp += 10;
  return xp;
};

const buildConversionContext = (payload = {}, overrides = {}) => {
  const now = new Date();
  return {
    batchSize: Number(overrides.batchSize ?? payload.batchSize ?? 1) || 1,
    convertHour: now.getHours(),
  };
};

const buildHistoryRecordPayload = (payload = {}, result = {}) => {
  const metadata = result?.metadata || {};
  const durationSeconds = Number(metadata.duration || payload.durationSeconds || 0) || 0;
  const cloudUrl = result?.cloudinaryAudio?.url || null;
  return {
    title:
      metadata.title || metadata.cleanTitle || payload.title || result.baseName || null,
    artist: metadata.artist || metadata.author || null,
    album: metadata.album || null,
    format: result.format || payload.format || null,
    bitrate: payload.abr || payload.bitrate || null,
    sourceUrl: metadata.webpageUrl || payload.url || null,
    downloadUrl: cloudUrl || result.downloadUrl || null,
    cloudUrl,
    durationSeconds,
    preview: metadata.preview || null,
    command: sanitizeHistoryCommand(payload),
    resultId: result.id || null,
    playlist: payload.playlistId || null,
    context: payload.context || null,
  };
};

const downloadSubtitle = async (payload = {}) => {
  const url = typeof payload.url === "string" ? payload.url.trim() : "";
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("URL tidak valid");
  }

  const preferAuto = payload.preferAuto !== false;
  const langOpt = typeof payload.lang === "string" && payload.lang.trim() ? payload.lang.trim() : "id.*,en.*,en";
  const baseOutput = sanitizeFileName(payload.fileName || payload.title || "subtitle");
  const downloadBase = baseOutput || "subtitle";

  const id = nanoid(10);
  let logs = "";
  let finalSrtName = "";
  let finalTxtName = "";
  const errors = [];
  const appendLogs = (value) => {
    logs = [logs, value].filter(Boolean).join("\n").slice(-8000);
  };
  const attempt = async (fn) => {
    try {
      const output = await fn();
      appendLogs(output?.logs);
      return output;
    } catch (err) {
      errors.push(err);
      appendLogs(err?.logs);
      return null;
    }
  };

  let result = await attempt(() => fetchSubtitleViaYtDlp({ url, langOpt, preferAuto }));
  if (!result) {
    result = await attempt(() => fetchSubtitleViaWatch({ url, langOpt, preferAuto }));
  }
  if (!result) {
    result = await attempt(() => fetchSubtitleViaPyTube({ url, langOpt, preferAuto }));
  }
  if (!result) {
    const message =
      errors[errors.length - 1]?.message || errors[0]?.message || "Gagal mengambil subtitle";
    const error = new Error(message);
    error.logs = logs;
    throw error;
  }

  const fetchError = errors[0] || null;

  try {
    const safeLang = result.safeLang || sanitizeLangKey(result.lang, result.auto);
    const finalStem = `${id}.${safeLang}`;
    finalSrtName = `${finalStem}.srt`;
    const srtPath = join(JOBS_DIR, finalSrtName);
    await fsp.writeFile(srtPath, result.srt, "utf8");

    const plain = srtToPlainText(result.srt);
    const lines = plain
      ? plain
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
      : [];
    const words = plain
      ? plain
        .trim()
        .split(/\s+/)
        .filter(Boolean)
      : [];
    const preview = buildSubtitlePreview(plain);
    finalTxtName = `${finalStem}.txt`;
    const txtPath = join(JOBS_DIR, finalTxtName);
    await fsp.writeFile(txtPath, `${plain}\n`, "utf8");

    return {
      ok: true,
      logs,
      lang: safeLang,
      auto: Boolean(result.auto),
      srtUrl: `/public/jobs/${finalSrtName}`,
      srtFileName: `${downloadBase}.${safeLang}.srt`,
      txtUrl: `/public/jobs/${finalTxtName}`,
      txtFileName: `${downloadBase}.${safeLang}.txt`,
      preview,
      text: plain,
      lineCount: lines.length,
      wordCount: words.length,
      translated: Boolean(result.translated),
      translatedFrom: result.translatedFrom || null,
      originalLang: result.originalLang || null,
    };
  } catch (err) {
    if (finalSrtName) {
      try { await fsp.unlink(join(JOBS_DIR, finalSrtName)); } catch { }
    }
    if (finalTxtName) {
      try { await fsp.unlink(join(JOBS_DIR, finalTxtName)); } catch { }
    }
    const message = err.message || fetchError?.message || "Gagal mengambil subtitle";
    const error = new Error(message);
    error.logs = [logs, err.logs || ""].filter(Boolean).join("\n").slice(-8000);
    throw error;
  }
};

// ==== Serve static UI & hasil unduhan ====
app.get("/manifest.webmanifest", (req, res) => {
  res.setHeader("Content-Type", "application/manifest+json");
  res.sendFile(join(__dirname, "public-ui", "manifest.webmanifest"));
});

// ==== Cloudinary Upload ====
app.post("/api/upload-forum-image", async (req, res) => {
  try {
    const { image } = req.body; // Expecting base64 string
    if (!image) {
      return res.status(400).json({ error: "No image provided" });
    }

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(image, {
      folder: "forum_uploads",
      resource_type: "image"
    });

    return res.json({
      ok: true,
      url: result.secure_url,
      public_id: result.public_id
    });
  } catch (err) {
    console.error("Cloudinary upload error:", err);
    return res.status(500).json({ error: "Upload failed: " + (err.message || err) });
  }
});

app.post(["/api/saweria/webhook", "/saweria/webhook", "/webhook/saweria"], async (req, res) => {
  try {
    if (!SAWERIA_STREAM_KEY) {
      return res.status(500).json({ error: "SAWERIA_STREAM_KEY belum dikonfigurasi" });
    }
    const signature = String(req.header(SAWERIA_SIGNATURE_HEADER) || "").trim();
    if (!signature) return res.sendStatus(401);
    const valid = verifySaweriaSignature(req.body || {}, signature, SAWERIA_STREAM_KEY);
    if (!valid) return res.sendStatus(403);

    const result = await recordSaweriaSupportEvent(req.body, {
      ip: req.ip,
      userAgent: req.get("user-agent") || "",
    });
    return res.json({ ok: true, applied: result.applied });
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Webhook Saweria gagal" });
  }
});

app.get("/api/support/hall-of-fame", async (req, res) => {
  try {
    const limitRaw = req.query?.limit;
    const limit = limitRaw ? Number(limitRaw) : 10;
    const topMonth = await listSupportLeaderboard({ period: "month", limit });
    const topAll = await listSupportLeaderboard({ period: "all", limit });
    const recent = await listRecentSupports({ limit });
    const topMonthSafe = Array.isArray(topMonth)
      ? topMonth.map((row) => ({
        rank: row.rank,
        name: row.name,
        totalAmount: row.totalAmount,
        lastAt: row.lastAt,
      }))
      : [];
    const topAllSafe = Array.isArray(topAll)
      ? topAll.map((row) => ({
        rank: row.rank,
        name: row.name,
        totalAmount: row.totalAmount,
        lastAt: row.lastAt,
      }))
      : [];
    const recentSafe = Array.isArray(recent)
      ? recent.map((row) => ({
        id: row.id,
        createdAt: row.createdAt,
        amountRaw: row.amountRaw,
        donatorName: row.donatorName,
        message: row.message,
      }))
      : [];
    return res.json({ ok: true, topMonth: topMonthSafe, topAll: topAllSafe, recent: recentSafe });
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Gagal memuat hall of fame" });
  }
});

app.use("/", express.static(join(__dirname, "public-ui")));
app.use("/public", express.static(PUBLIC_DIR));

// ==== User accounts ====
app.post("/api/auth/google", async (req, res) => {
  if (!isGoogleLoginConfigured) {
    return res.status(503).json({ error: "Login Google belum dikonfigurasi" });
  }
  try {
    const credential = req.body?.credential;
    const referralCode = req.body?.referralCode;
    if (!credential || typeof credential !== "string") {
      return res.status(400).json({ error: "Token Google tidak valid" });
    }
    const payload = await verifyGoogleIdToken(credential);
    const summary = await upsertGoogleUser({
      googleId: payload.sub,
      email: payload.email,
      name: payload.name,
      avatarUrl: payload.picture,
      referralCode: referralCode,
    });
    const token = createSessionToken(summary.id);
    return res.json({ ok: true, token, user: summary });
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Gagal login" });
  }
});

app.get("/api/auth/config", (req, res) => {
  return res.json({
    ok: true,
    googleClientId: GOOGLE_CLIENT_ID || null,
    turnstileSiteKey: TURNSTILE_SITE_KEY || null,
    turnstileStrict: TURNSTILE_STRICT,
  });
});

app.get("/api/server-time", (req, res) => {
  const now = new Date();
  const time = now.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jakarta'
  });
  return res.json({ time });
});

const startTime = Date.now();

app.get("/api/health", (req, res) => {
  const parseIntEnv = (v) => {
    const n = Number.parseInt(String(v ?? ""), 10);
    return Number.isFinite(n) ? n : null;
  };
  const parseJsonEnv = (v) => {
    const raw = typeof v === "string" ? v.trim() : "";
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  const maintenance = process.env.MAINTENANCE_MODE === "true";
  const now = Date.now();

  let maintenanceInfo = null;
  if (maintenance) {
    const progressRaw = parseIntEnv(process.env.MAINTENANCE_PROGRESS);
    const progress = progressRaw == null ? null : clamp(progressRaw, 0, 100);
    const etaMinutesRaw = parseIntEnv(process.env.MAINTENANCE_ETA_MINUTES);
    const etaSeconds = etaMinutesRaw == null ? null : clamp(etaMinutesRaw, 0, 7 * 24 * 60) * 60;
    const etaEndAt = etaSeconds == null ? null : now + etaSeconds * 1000;

    maintenanceInfo = {
      id: process.env.MAINTENANCE_ID || null,
      title: process.env.MAINTENANCE_TITLE || null,
      description: process.env.MAINTENANCE_DESC || null,
      detail: process.env.MAINTENANCE_DETAIL || process.env.RAILWAY_GIT_COMMIT_MESSAGE || process.env.VERCEL_GIT_COMMIT_MESSAGE || null,
      steps: parseJsonEnv(process.env.MAINTENANCE_STEPS_JSON),
      whatsNew: parseJsonEnv(process.env.MAINTENANCE_WHATS_NEW_JSON),
      tip: process.env.MAINTENANCE_TIP || null,
      services: parseJsonEnv(process.env.MAINTENANCE_SERVICES_JSON),
      progress,
      etaSeconds,
      etaEndAt,
    };
  }

  return res.json({
    ok: true,
    status: "online",
    maintenance,
    maintenanceInfo,
    healthcheckPath: "/api/health",
    uptime: process.uptime(),
    timestamp: now,
    startTime: startTime,
    storageDuration: "24h" // Default ephemeral storage policy
  });
});

app.get("/api/cheats/config", (req, res) => {
  if (!CHEATS_ENABLED) {
    return res.json({ ok: true, enabled: false });
  }
  return res.json({ ok: true, enabled: true });
});

app.post("/api/cheats/claim", async (req, res) => {
  if (!CHEATS_ENABLED) {
    return res.status(404).json({ error: "Cheat dimatikan" });
  }
  const user = await requireUserSession(req, res);
  if (!user) return;
  const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
  if (!code) {
    return res.status(400).json({ error: "Kode cheat wajib diisi" });
  }
  try {
    const result = await claimCheatForUser(user.id, code);
    const summary = await buildUserSummaryById(user.id);
    return res.json({
      ok: true,
      applied: result.applied,
      alreadyClaimed: result.alreadyClaimed,
      xp: result.xp,
      xpDelta: result.xpDelta ?? 0,
      level: result.level,
      cheat: result.cheat,
      badgesAwarded: result.badgesAwarded || [],
      user: summary,
    });
  } catch (err) {
    const message = err?.message || "Cheat gagal";
    const status = /wajib|dikenali|pengguna/i.test(message) ? 400 : 500;
    return res.status(status).json({ error: message });
  }
});

app.post("/api/users/:id/xp", async (req, res) => {
  const sessionUser = await requireUserSession(req, res);
  if (!sessionUser) return;

  const targetId = String(req.params.id || "").trim();
  if (!targetId) {
    return res.status(400).json({ error: "User ID tidak valid" });
  }
  if (sessionUser.id !== targetId && sessionUser.role !== "admin") {
    return res.status(403).json({ error: "Tidak diizinkan" });
  }

  const { delta, reason, event_id, eventId } = req.body || {};
  const numericDelta = Number(delta);
  if (!Number.isFinite(numericDelta)) {
    return res.status(400).json({ error: "Delta XP tidak valid" });
  }

  const roundedDelta = Math.trunc(numericDelta);
  const eventKey = typeof event_id === "string" && event_id.trim()
    ? event_id.trim()
    : typeof eventId === "string" && eventId.trim()
      ? eventId.trim()
      : `client-sync:${targetId}:${Date.now()}`;
  const reasonText = typeof reason === "string" && reason.trim() ? reason.trim() : "client-sync";

  try {
    let applied = false;
    let xpResult = null;
    if (roundedDelta !== 0) {
      xpResult = await recordXpEventForUser(targetId, {
        eventId: eventKey,
        delta: roundedDelta,
        reason: reasonText,
        metadata: { source: "client-sync" },
      });
      applied = Boolean(xpResult?.applied);
    }
    const summary = await buildUserSummaryById(targetId);
    return res.json({
      ok: true,
      applied,
      xp: xpResult?.xp ?? summary?.xp ?? 0,
      level: xpResult?.level ?? summary?.level ?? 1,
      user: summary,
    });
  } catch (err) {
    const message = err?.message || "Gagal memperbarui XP";
    const status = /wajib|tidak valid/i.test(message) ? 400 : 500;
    return res.status(status).json({ error: message });
  }
});

app.get("/api/session", async (req, res) => {
  const user = await resolveRequestUser(req);
  if (!user) return res.status(401).json({ error: "Belum login" });
  const summary = await buildUserSummaryById(user.id);
  return res.json({ ok: true, user: summary });
});

app.post("/api/qr-login/issue", async (req, res) => {
  const user = await requireUserSession(req, res);
  if (!user) return;
  const entry = issueQrLoginToken(user.id);
  const host = req.get("host") || "";
  const scheme = req.protocol || "https";
  const loginUrl = `${scheme}://${host}/#qr-login=${entry.token}`;
  const summary = await buildUserSummaryById(user.id);
  return res.json({
    ok: true,
    token: entry.token,
    loginUrl,
    expiresAt: entry.expiresAt,
    ttlMs: QR_LOGIN_TTL_MS,
    user: summary,
  });
});

app.post("/api/qr-login/consume", async (req, res) => {
  const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
  const result = consumeQrLoginToken(token);
  if (result?.error) {
    return res.status(result.status || 400).json({ error: result.error });
  }
  const entry = result.entry;
  const summary = await buildUserSummaryById(entry.userId);
  if (!summary) {
    return res.status(404).json({ error: "Akun tidak ditemukan" });
  }
  const sessionToken = createSessionToken(summary.id);
  return res.json({ ok: true, token: sessionToken, user: summary });
});

app.post("/api/qr-login/decode", async (req, res) => {
  const imageDataUrl = typeof req.body?.imageDataUrl === "string" ? req.body.imageDataUrl.trim() : "";
  if (!imageDataUrl) {
    return res.status(400).json({ error: "Data gambar kosong" });
  }
  const match = imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match?.[2]) {
    return res.status(400).json({ error: "Format gambar tidak valid" });
  }
  try {
    const mimeType = match[1] || "image/png";
    const buffer = Buffer.from(match[2], "base64");
    const form = new FormData();
    const blob = new Blob([buffer], { type: mimeType });
    form.append("file", blob, "qr.png");
    const resp = await fetch("https://api.qrserver.com/v1/read-qr-code/", {
      method: "POST",
      body: form,
    });
    const payload = await resp.json().catch(() => null);
    const raw = payload?.[0]?.symbol?.[0]?.data || "";
    if (!raw) {
      return res.status(404).json({ error: "QR tidak terbaca" });
    }
    return res.json({ ok: true, data: raw });
  } catch (err) {
    return res.status(500).json({ error: "Gagal membaca QR" });
  }
});

app.post("/api/logout", async (req, res) => {
  const user = await resolveRequestUser(req);
  if (user) {
    await revokeUserSession(user.id);
  }
  return res.json({ ok: true });
});

app.get("/api/dashboard", async (req, res) => {
  const user = await requireUserSession(req, res);
  if (!user) return;
  const summary = await buildUserSummaryById(user.id);
  const history = await listUserHistory(user.id, { limit: 10 });
  return res.json({ ok: true, user: summary, recent: history });
});

app.get("/api/history", async (req, res) => {
  const user = await requireUserSession(req, res);
  if (!user) return;
  const query = req.query?.q || req.query?.query;
  const limitRaw = req.query?.limit;
  const limit = limitRaw ? Number(limitRaw) : undefined;
  const history = await listUserHistory(user.id, { query, limit });
  return res.json({ ok: true, history });
});

app.get("/api/history/:id", async (req, res) => {
  const user = await requireUserSession(req, res);
  if (!user) return;
  const entry = await getHistoryEntry(user.id, req.params.id);
  if (!entry) return res.status(404).json({ error: "Riwayat tidak ditemukan" });
  return res.json({ ok: true, entry });
});

app.post("/api/history/:id/redownload", async (req, res) => {
  const user = await requireUserSession(req, res);
  if (!user) return;
  const entry = await getHistoryEntry(user.id, req.params.id);
  if (!entry) return res.status(404).json({ error: "Riwayat tidak ditemukan" });
  if (entry.downloadUrl) {
    const filePath = resolvePublicPath(entry.downloadUrl);
    if (filePath) {
      try {
        await fsp.access(filePath);
        return res.json({ ok: true, downloadUrl: entry.downloadUrl, cached: true });
      } catch { }
    }
  }
  if (entry.payload && typeof entry.payload === "object") {
    try {
      const progressId = typeof req.body?.progressId === "string" ? req.body.progressId : "";
      const payload = { ...entry.payload };
      if (progressId) payload.progressId = progressId;
      const result = await convertSingle(payload);
      if (result?.downloadUrl) {
        await updateHistoryEntry(user.id, entry.id, {
          downloadUrl: result.downloadUrl,
          format: result.format || entry.format,
          bitrate: result.bitrate || entry.bitrate,
        });
        return res.json({ ok: true, downloadUrl: result.downloadUrl, cached: false });
      }
      return res.status(500).json({ error: "Gagal mengulang konversi" });
    } catch (err) {
      return res.status(500).json({ error: err?.message || "Gagal mengulang konversi" });
    }
  }
  return res.status(404).json({ error: "File tidak tersedia" });
});

app.post("/api/cloudinary/delete", async (req, res) => {
  const user = await requireUserSession(req, res);
  if (!user) return;

  if (!process.env.CLOUDINARY_URL && !process.env.CLOUDINARY_AUDIO_URL) {
    return res.status(503).json({ ok: false, error: "Cloudinary belum dikonfigurasi" });
  }

  const rawUrl = typeof req.body?.url === "string" ? req.body.url.trim() : "";
  if (!rawUrl) {
    return res.status(400).json({ ok: false, error: "URL cloud wajib diisi" });
  }

  const publicId = extractCloudinaryPublicIdFromUrl(rawUrl);
  if (!publicId) {
    return res.status(400).json({ ok: false, error: "URL Cloudinary tidak valid" });
  }

  const allowedPrefix = `ytconv/user-library/${user.id}/`;
  if (!publicId.startsWith(allowedPrefix)) {
    return res.status(403).json({ ok: false, error: "Tidak diizinkan menghapus file ini" });
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: "video",
      invalidate: true,
    });
    const status = String(result?.result || "").toLowerCase();
    if (!status || (status !== "ok" && status !== "not found")) {
      const msg = typeof result?.result === "string" ? result.result : "Gagal menghapus file Cloudinary";
      return res.status(502).json({ ok: false, error: msg });
    }
    return res.json({ ok: true, publicId, result: status });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || "Gagal hapus file di Cloudinary" });
  }
});

app.get("/api/referral-code", async (req, res) => {
  const user = await requireUserSession(req, res);
  if (!user) return;
  const code = await ensureReferralForUser(user.id);
  const summary = await buildUserSummaryById(user.id);
  return res.json({ ok: true, code, user: summary });
});

// ==== Assistant chat ====
app.post("/api/assistant-chat", async (req, res) => {
  try {
    const { prompt = "", messages = [], clientState = {} } = req.body || {};
    const trimmed = typeof prompt === "string" ? prompt.trim() : String(prompt ?? "").trim();
    if (!trimmed) {
      return res.status(400).json({ error: "Prompt wajib diisi" });
    }

    const responsePayload = await buildAssistantResponse(trimmed, messages, clientState);
    const user = await resolveRequestUser(req);

    return res.json(responsePayload);
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Gagal memproses percakapan" });
  }
});

// ==== API convert ====
app.get("/api/turnstile-config", (req, res) => {
  return res.json({
    ok: true,
    siteKey: TURNSTILE_SITE_KEY,
    configured: isTurnstileConfigured
  });
});

app.post("/api/convert", async (req, res) => {
  const user = await resolveRequestUser(req);
  try {
    const payload = { ...(req.body || {}) };
    try {
      await verifyTurnstileToken(payload.captchaToken, req.ip);
    } catch (err) {
      const status = err?.statusCode || 400;
      const message = err?.message || "Verifikasi captcha gagal";
      return res.status(status).json({ error: message });
    }
    delete payload.captchaToken;
    
    // 🛑 Content Restriction Layer
    const blockList = ["slot", "gacor", "judi", "porn", "bokep", "xxx"];
    const inputStr = String(payload.url || payload.keyword || "").toLowerCase();
    if (blockList.some(keyword => inputStr.includes(keyword))) {
      return res.status(403).json({ error: "Video/URL ini diblokir (Content Restriction Layer). Coba yang lain." });
    }

    // 🥇 Smart Cache Layer
    let result = null;
    const cacheKey = `smart_cache:${payload.url}:${payload.format}:${payload.abr}`;
    const cachedResult = CacheStore.get(cacheKey);
    
    if (cachedResult) {
      console.log(`[Smart Cache] Instant hit for ${cacheKey}`);
      result = cachedResult;
      result.fromCache = true;
    } else {
      result = await convertSingle(payload);
      if (result && result.downloadUrl) {
         CacheStore.set(cacheKey, result, 24 * 60 * 60 * 1000); // Cache 24 jam
      }
    }
    
    // 🏷️ Watermark Invisible (Tracking)
    result.trackingId = "WT-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1000);

    if (user) {
      const historyPayload = buildHistoryRecordPayload(payload, result);
      const xpGain = computeXpForConversion(payload, result);
      const context = buildConversionContext(payload);
      const record = await recordConversionForUser(user.id, {
        ...historyPayload,
        xpGain,
        context,
      });
      return res.json({ ...result, userProgress: record });
    }
    return res.json(result);
  } catch (e) {
    const msg = e?.message || "Gagal memproses";
    const status = /tidak valid|tidak dikenali/i.test(msg) ? 400 : 500;
    return res.status(status).json({ error: msg, logs: e?.logs });
  }
});

app.get("/api/progress/:id", (req, res) => {
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ error: "ID tidak valid" });
  const progress = convertProgressMap.get(id);
  if (!progress) return res.status(404).json({ error: "Progress tidak ditemukan" });
  return res.json({ ok: true, progress });
});

app.get("/api/tool-versions", async (req, res) => {
  try {
    const tools = await resolveToolVersions();
    return res.json({ ok: true, tools, checkedAt: Date.now() });
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Gagal mengecek versi" });
  }
});

app.get("/api/trending-now", async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(12, Number(req.query.limit) || 6));
    const includeYoutube = String(req.query.includeYoutube || "") === "1";
    const force = String(req.query.force || "") === "1";
    const playlistId = parseSpotifyPlaylistId(req.query.playlist || "");
    const cacheKey = `trending-now:v2:${limit}:${includeYoutube ? 1 : 0}:${playlistId || "default"}`;
    const cached = CacheStore.get(cacheKey);
    const ttlMs = 15 * 60 * 1000;
    if (!force && cached?.items && Date.now() - (cached.cachedAt || 0) < ttlMs) {
      return res.json({ ok: true, source: "cache", cachedAt: cached.cachedAt || null, items: cached.items });
    }

    let spotifyItems = [];
    if (isSpotifyConfigured) {
      try {
        spotifyItems = await fetchSpotifyTrendingTracks({ limit, playlistId });
      } catch (e) {
        console.error("Spotify API error, using fallback:", e.message);
      }
    }

    if (!spotifyItems.length) {
      const fallback = [
        { title: "DtMF", artist: "Bad Bunny", spotifyUrl: "", spotifyCover: "" },
        { title: "Tití Me Preguntó", artist: "Bad Bunny", spotifyUrl: "", spotifyCover: "" },
        { title: "Golden", artist: "HUNTRX, EJAE, AUDREY NUNA, REI AMI", spotifyUrl: "", spotifyCover: "" },
        { title: "Ordinary", artist: "Alex Warren", spotifyUrl: "", spotifyCover: "" },
        { title: "Big Guy", artist: "Ice Spice", spotifyUrl: "", spotifyCover: "" },
        { title: "Zoo", artist: "Shakira", spotifyUrl: "", spotifyCover: "" },
      ];
      spotifyItems = fallback.slice(0, limit);
    }

    const items = spotifyItems.map((row, idx) => {
      const query = [row.title, row.artist].filter(Boolean).join(" ").trim();
      return {
        rank: idx + 1,
        title: row.title,
        artist: row.artist,
        query,
        youtube: null,
        spotify: {
          url: row.spotifyUrl,
          cover: row.spotifyCover,
        },
      };
    });

    if (includeYoutube) {
      const concurrency = 2;
      let cursor = 0;
      const worker = async () => {
        while (cursor < items.length) {
          const i = cursor;
          cursor += 1;
          const row = items[i];
          if (!row?.query) continue;
          try {
            const info = await fetchVideoInfo({ keyword: `${row.query} audio`, preferLang: "id" });
            row.youtube = info
              ? {
                id: info.id || "",
                title: info.title || row.title,
                url: info.webpageUrl || (info.id ? `https://www.youtube.com/watch?v=${info.id}` : ""),
                thumbnail: info.thumbnail || info.cover || "",
                channel: info.uploader || info.channel || info.artist || "",
              }
              : null;
          } catch {
            row.youtube = null;
          }
        }
      };
      await Promise.all(Array.from({ length: concurrency }, () => worker()));
    }

    CacheStore.set(cacheKey, { items });
    const stored = CacheStore.get(cacheKey);
    return res.json({ ok: true, source: "live", cachedAt: stored?.cachedAt || Date.now(), items });
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Gagal memuat trending" });
  }
});

app.get("/api/turn-credentials", async (req, res) => {
  try {
    const secret = (process.env.TURN_SHARED_SECRET || "").trim();
    const urlsRaw = (process.env.TURN_URLS || "").trim();
    if (!secret || !urlsRaw) {
      return res.status(503).json({ error: "turn_not_configured" });
    }
    const ttl = Math.max(60, Math.min(24 * 60 * 60, Number(process.env.TURN_TTL_SECONDS) || 6 * 60 * 60));
    const userId = String(req.query.userId || "").slice(0, 80);
    const nowSec = Math.floor(Date.now() / 1000);
    const exp = nowSec + ttl;
    const username = userId ? `${exp}:${userId}` : String(exp);
    const credential = createHmac("sha1", secret).update(username).digest("base64");
    const urls = urlsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return res.json({
      ttl,
      iceServers: [
        { urls: ["stun:stun.l.google.com:19302"] },
        { urls, username, credential },
      ],
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message || "turn_error" });
  }
});

app.post("/api/video-info", async (req, res) => {
  try {
    const body = req.body || {};
    const preferLang = normalizePreferredLang(body.lang || body.preferredLang);
    const info = await fetchVideoInfo({
      url: body.url,
      keyword: body.keyword,
      preferLang,
    });
    return res.json({ ok: true, info });
  } catch (e) {
    const msg = e?.message || "Gagal mengambil info video";
    const status = /tidak valid|kata kunci/i.test(msg)
      ? 400
      : /tidak ditemukan/i.test(msg)
        ? 404
        : 500;
    return res.status(status).json({ error: msg, logs: e?.logs });
  }
});

app.post("/api/search", async (req, res) => {
  try {
    const body = req.body || {};
    const preferLang = normalizePreferredLang(body.lang || body.preferredLang);
    const results = await searchYoutubeVideos({
      query: body.query || body.keyword,
      limit: body.limit,
      preferLang,
    });
    return res.json({ ok: true, results });
  } catch (e) {
    const msg = e?.message || "Gagal mencari video";
    const status = /kosong|valid/i.test(msg) ? 400 : 500;
    return res.status(status).json({ error: msg, logs: e?.logs });
  }
});

app.post("/api/background", async (req, res) => {
  try {
    const body = { ...(req.body || {}) };
    try {
      await verifyTurnstileToken(body.captchaToken, req.ip);
    } catch (err) {
      const status = err?.statusCode || 400;
      const message = err?.message || "Verifikasi captcha gagal";
      return res.status(status).json({ error: message });
    }
    delete body.captchaToken;
    const job = enqueueBackgroundJob(body);
    return res.json({ ok: true, job: serializeJob(job) });
  } catch (e) {
    const msg = e?.message || "Gagal membuat job";
    const status = /tidak valid|tidak dikenali|batas/i.test(msg) ? 400 : 500;
    return res.status(status).json({ error: msg });
  }
});

app.get("/api/background", (req, res) => {
  const jobs = Array.from(backgroundJobs.values())
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 25)
    .map(serializeJob);
  return res.json({ ok: true, jobs });
});

app.get("/api/background/:id", (req, res) => {
  const job = backgroundJobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "Job tidak ditemukan" });
  return res.json({ ok: true, job: serializeJob(job) });
});

app.post("/api/private-share", async (req, res) => {
  try {
    const body = req.body || {};
    const downloadUrl = typeof body.downloadUrl === "string" ? body.downloadUrl.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!downloadUrl) {
      return res.status(400).json({ error: "Link unduhan tidak valid" });
    }
    if (!password || password.length < 4) {
      return res.status(400).json({ error: "Password minimal 4 karakter" });
    }
    const filePath = resolvePublicPath(downloadUrl);
    if (!filePath) {
      return res.status(400).json({ error: "File tidak dikenali" });
    }
    let stat;
    try {
      stat = await fsp.stat(filePath);
    } catch {
      return res.status(404).json({ error: "File tidak ditemukan" });
    }
    const id = nanoid(10);
    const share = {
      id,
      filePath,
      fileName: sanitizeFileName(body.fileName || basename(filePath)) || basename(filePath),
      downloadUrl,
      passwordHash: hashSharePassword(password),
      createdAt: Date.now(),
      expiresAt: Date.now() + PRIVATE_SHARE_TTL_MS,
      size: Number(stat.size) || 0,
      tokens: new Set(),
    };
    privateShares.set(id, share);
    ensureShareCleanup();
    return res.json({
      ok: true,
      room: {
        id,
        expiresAt: share.expiresAt,
        fileName: share.fileName,
        size: share.size,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Gagal membuat private room" });
  }
});

app.get("/api/private-share/:id", (req, res) => {
  const share = privateShares.get(req.params.id);
  if (!share) return res.status(404).json({ error: "Room tidak ditemukan" });
  if (share.expiresAt && share.expiresAt <= Date.now()) {
    privateShares.delete(req.params.id);
    return res.status(410).json({ error: "Room kedaluwarsa" });
  }
  return res.json({
    ok: true,
    room: {
      id: share.id,
      fileName: share.fileName,
      size: share.size,
      expiresAt: share.expiresAt,
      createdAt: share.createdAt,
    },
  });
});

app.post("/api/private-share/:id/unlock", (req, res) => {
  const share = privateShares.get(req.params.id);
  if (!share) return res.status(404).json({ error: "Room tidak ditemukan" });
  if (share.expiresAt && share.expiresAt <= Date.now()) {
    privateShares.delete(req.params.id);
    return res.status(410).json({ error: "Room kedaluwarsa" });
  }
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!password) return res.status(400).json({ error: "Password wajib diisi" });
  const hash = hashSharePassword(password);
  let match = false;
  try {
    match = timingSafeEqual(Buffer.from(hash), Buffer.from(share.passwordHash));
  } catch {
    match = false;
  }
  if (!match) return res.status(403).json({ error: "Password salah" });
  const token = createShareToken(share);
  return res.json({ ok: true, token, fileName: share.fileName, size: share.size });
});

app.get("/api/private-share/:id/download", async (req, res) => {
  const share = privateShares.get(req.params.id);
  if (!share) return res.status(404).json({ error: "Room tidak ditemukan" });
  if (share.expiresAt && share.expiresAt <= Date.now()) {
    privateShares.delete(req.params.id);
    return res.status(410).json({ error: "Room kedaluwarsa" });
  }
  const token = typeof req.query.token === "string" ? req.query.token : "";
  if (!verifyShareToken(share, token)) {
    return res.status(403).json({ error: "Token tidak valid" });
  }
  try {
    await fsp.access(share.filePath);
  } catch {
    privateShares.delete(req.params.id);
    return res.status(404).json({ error: "File sudah tidak tersedia" });
  }
  res.setHeader("Cache-Control", "no-store");
  res.download(share.filePath, share.fileName, (err) => {
    if (err) console.warn("[share] gagal mengirim file", err);
  });
});

app.post("/api/ai-tags", (req, res) => {
  try {
    const body = req.body || {};
    const tags = buildAiTags({
      title: body.title,
      description: body.description,
      channel: body.channel,
      duration: body.duration,
    });
    return res.json({ ok: true, tags });
  } catch (e) {
    const msg = e?.message || "Gagal membuat tag";
    return res.status(400).json({ error: msg });
  }
});

app.post("/api/ai-caption", (req, res) => {
  try {
    const body = req.body || {};
    const result = buildAiCaption({
      title: body.title,
      channel: body.channel,
      duration: body.duration,
      speedMode: body.speedMode,
      denoise: body.denoise,
      volumeBoost: body.volumeBoost,
      enhancer: body.enhancer,
      format: body.format,
    });
    return res.json({ ok: true, caption: result.caption, hashtags: result.hashtags, tags: result.tags });
  } catch (e) {
    const msg = e?.message || "Gagal membuat caption";
    return res.status(400).json({ error: msg });
  }
});

app.post("/api/ai-pitch", (req, res) => {
  try {
    const body = req.body || {};
    const result = buildAiPitch({
      title: body.title,
      description: body.description,
      channel: body.channel,
      duration: body.duration,
      genre: body.genre,
      mood: body.mood,
    });
    return res.json({
      ok: true,
      pitch: result.pitch,
      hook: result.hook,
      playlists: result.playlists,
      tags: result.tags,
    });
  } catch (e) {
    const msg = e?.message || "Gagal membuat pitch";
    return res.status(400).json({ error: msg });
  }
});

app.post("/api/ai-audiophile", (req, res) => {
  try {
    const body = req.body || {};
    const result = buildAiAudiophileGuide({
      title: body.title,
      channel: body.channel,
      duration: body.duration,
      genre: body.genre,
      mood: body.mood,
      format: body.format,
      sampleRate: body.sampleRate,
      speedMode: body.speedMode,
      enhancer: body.enhancer,
      denoise: body.denoise,
      volumeBoost: body.volumeBoost,
      normalize: body.normalize,
    });
    return res.json({ ok: true, guide: result });
  } catch (e) {
    const msg = e?.message || "Gagal membuat panduan audiophile";
    return res.status(400).json({ error: msg });
  }
});

app.post("/api/ai-hook", (req, res) => {
  try {
    const body = req.body || {};
    const result = buildAiHook({
      title: body.title,
      channel: body.channel,
      duration: body.duration,
      genre: body.genre,
      speedMode: body.speedMode,
      volumeBoost: body.volumeBoost,
      enhancer: body.enhancer,
      denoise: body.denoise,
      eq: body.eq,
    });
    return res.json({ ok: true, ...result });
  } catch (e) {
    const msg = e?.message || "Gagal membuat hook";
    return res.status(400).json({ error: msg });
  }
});

app.post("/api/ai-cover", (req, res) => {
  try {
    const body = req.body || {};
    const result = buildAiCoverPrompt({
      title: body.title,
      channel: body.channel,
      duration: body.duration,
      genre: body.genre,
      format: body.format,
      speedMode: body.speedMode,
      enhancer: body.enhancer,
      volumeBoost: body.volumeBoost,
      denoise: body.denoise,
      normalize: body.normalize,
      eq: body.eq,
    });
    return res.json({ ok: true, ...result });
  } catch (e) {
    const msg = e?.message || "Gagal membuat prompt cover";
    return res.status(400).json({ error: msg });
  }
});

app.post("/api/ai-release", (req, res) => {
  try {
    const body = req.body || {};
    const result = buildAiReleasePlan({
      title: body.title,
      channel: body.channel,
      duration: body.duration,
      genre: body.genre,
      format: body.format,
      speedMode: body.speedMode,
      backgroundMode: body.backgroundMode,
      autoDownload: body.autoDownload,
      queueLength: body.queueLength,
      hasPlaylist: body.hasPlaylist,
      volumeBoost: body.volumeBoost,
    });
    return res.json({ ok: true, plan: result.plan, summary: result.summary, focus: result.focus });
  } catch (e) {
    const msg = e?.message || "Gagal membuat timeline";
    return res.status(400).json({ error: msg });
  }
});

app.post("/api/ai-presskit", (req, res) => {
  try {
    const body = req.body || {};
    const result = buildAiPressKit({
      title: body.title,
      channel: body.channel,
      duration: body.duration,
      genre: body.genre,
      mood: body.mood,
      format: body.format,
    });
    return res.json({ ok: true, presskit: result });
  } catch (e) {
    const msg = e?.message || "Gagal membuat press kit";
    return res.status(400).json({ error: msg });
  }
});

app.post("/api/ai-outreach", (req, res) => {
  try {
    const body = req.body || {};
    const result = buildAiOutreachEmail({
      title: body.title,
      channel: body.channel,
      duration: body.duration,
      genre: body.genre,
      mood: body.mood,
      target: body.target,
    });
    return res.json({ ok: true, outreach: result });
  } catch (e) {
    const msg = e?.message || "Gagal membuat email";
    return res.status(400).json({ error: msg });
  }
});

app.post("/api/ai-lyrics", (req, res) => {
  try {
    const body = req.body || {};
    const result = buildAiLyricTeaser({
      title: body.title,
      channel: body.channel,
      duration: body.duration,
      genre: body.genre,
      mood: body.mood,
    });
    return res.json({ ok: true, teaser: result });
  } catch (e) {
    const msg = e?.message || "Gagal membuat teaser lirik";
    return res.status(400).json({ error: msg });
  }
});

app.post("/api/subtitle", async (req, res) => {
  try {
    const result = await downloadSubtitle(req.body || {});
    return res.json(result);
  } catch (e) {
    const msg = e?.message || "Gagal mengambil subtitle";
    const status = /tidak valid/i.test(msg) ? 400 : 500;
    return res.status(status).json({ error: msg, logs: e?.logs });
  }
});

// ==== API convert playlist (ZIP) ====
app.post("/api/convert-playlist", async (req, res) => {
  const user = await resolveRequestUser(req);
  try {
    const body = { ...(req.body || {}) };
    try {
      await verifyTurnstileToken(body.captchaToken, req.ip);
    } catch (err) {
      const status = err?.statusCode || 400;
      const message = err?.message || "Verifikasi captcha gagal";
      return res.status(status).json({ error: message });
    }
    delete body.captchaToken;
    const rawItems = Array.isArray(body.items)
      ? body.items
      : Array.isArray(body.urls)
        ? body.urls.map((url) => ({ url }))
        : [];
    if (!rawItems.length) {
      return res.status(400).json({ error: "Daftar URL kosong" });
    }

    const commonOpts = {
      format: body.format,
      abr: body.abr,
      sampleRate: body.sampleRate,
      noPlaylist: true,
      normalize: body.normalize,
      trim: body.trim,
      coverUrl: body.coverUrl,
      atmos: body.atmos,
      speedMode: body.speedMode,
    };

    const results = [];
    const contextOverrides = { batchSize: rawItems.length };

    for (let i = 0; i < rawItems.length; i += 1) {
      const item = rawItems[i];
      const url = typeof item === "string" ? item : item?.url;
      if (!url || !/^https?:\/\//.test(url)) {
        return res.status(400).json({ error: `URL tidak valid pada entri ${i + 1}` });
      }
      const perId3 = (item && typeof item.id3 === "object") ? item.id3 : body.id3;
      const perFileName = sanitizeFileName(item?.fileName || item?.title || "");
      const singlePayload = {
        ...commonOpts,
        url,
        id3: perId3,
        fileName: perFileName,
        batchSize: rawItems.length,
      };
      const singleResult = await convertSingle(singlePayload);
      if (user) {
        const historyPayload = buildHistoryRecordPayload(singlePayload, singleResult);
        const xpGain = computeXpForConversion(singlePayload, singleResult);
        await recordConversionForUser(user.id, {
          ...historyPayload,
          xpGain,
          context: buildConversionContext(singlePayload, contextOverrides),
        });
      }
      results.push({ ...singleResult, sourceUrl: url, providedName: perFileName });
    }

    const zipId = nanoid(10);
    const safeBase = sanitizeFileName(body.zipName || `playlist-${zipId}`) || `playlist-${zipId}`;
    const zipFileName = `${safeBase}.zip`;
    const zipPath = join(JOBS_DIR, zipFileName);

    const width = String(results.length).length;
    const tempDir = join(JOBS_DIR, `${zipId}_tmp`);
    await fsp.mkdir(tempDir, { recursive: true });

    const entryNames = [];
    for (let idx = 0; idx < results.length; idx += 1) {
      const item = results[idx];
      const trackNo = String(idx + 1).padStart(width, "0");
      const base = sanitizeFileName(item.baseName) || item.providedName || `Track ${idx + 1}`;
      const entryName = `${trackNo} - ${base}.${item.ext}`;
      entryNames.push(entryName);
      await fsp.copyFile(item.fullPath, join(tempDir, entryName));
    }

    try {
      await new Promise((resolve, reject) => {
        const isWin = process.platform === "win32";
        let proc;
        let zipLogs = "";
        if (isWin) {
          const quotedDest = zipPath.replace(/'/g, "''");
          const entriesArg = entryNames.map((n) => `'${n.replace(/'/g, "''")}'`).join(", ");
          const psCommand = `$ErrorActionPreference='Stop'; Compress-Archive -Path @(${entriesArg}) -DestinationPath '${quotedDest}' -Force`;
          proc = spawn("powershell", ["-NoProfile", "-Command", psCommand], { cwd: tempDir, windowsHide: true });
        } else {
          proc = spawn("zip", ["-q", "-j", zipPath, ...entryNames], { cwd: tempDir });
        }
        proc.stdout.on("data", (d) => (zipLogs += d.toString()));
        proc.stderr.on("data", (d) => (zipLogs += d.toString()));
        proc.on("error", (err) => {
          const error = new Error(isWin ? "Compress-Archive gagal dijalankan" : "zip command gagal dijalankan");
          error.logs = zipLogs;
          reject(error);
        });
        proc.on("close", (code) => {
          if (code === 0) resolve();
          else {
            const error = new Error(`${isWin ? "Compress-Archive" : "zip"} keluar dengan kode ${code}`);
            error.logs = zipLogs;
            reject(error);
          }
        });
      });
    } finally {
      try { await fsp.rm(tempDir, { recursive: true, force: true }); } catch { }
    }

    let zipSize = 0;
    try {
      const stat = await fsp.stat(zipPath);
      zipSize = Number(stat.size) || 0;
    } catch { }

    if (ZIP_SIZE_LIMIT_BYTES && zipSize > ZIP_SIZE_LIMIT_BYTES) {
      try { await fsp.unlink(zipPath); } catch { }
      return res.status(400).json({ error: `ZIP melebihi batas ${Math.round(ZIP_SIZE_LIMIT_BYTES / (1024 * 1024))} MB` });
    }

    const responseBody = {
      ok: true,
      id: zipId,
      count: results.length,
      downloadUrl: `/public/jobs/${zipFileName}`,
      fileName: zipFileName,
      size: zipSize,
      entries: results.map((item, idx) => ({
        url: item.sourceUrl,
        fileName: `${String(idx + 1).padStart(width, "0")} - ${(sanitizeFileName(item.baseName) || item.providedName || `Track ${idx + 1}`)}.${item.ext}`,
        format: item.format,
      })),
    };
    if (user) {
      responseBody.user = await buildUserSummaryById(user.id);
    }
    return res.json(responseBody);
  } catch (e) {
    const msg = e?.message || "Gagal memproses playlist";
    return res.status(500).json({ error: msg });
  }
});

// ==== Admin: upload cookies.txt (Authorization: Bearer <token>) ====
const BEARER = process.env.ADMIN_BEARER || "";
const ADMIN_USER_HASH = process.env.ADMIN_USER_HASH || "";
const ADMIN_PASS_HASH = process.env.ADMIN_PASS_HASH || "";
const ADMIN_ENABLED = Boolean(BEARER && ADMIN_USER_HASH && ADMIN_PASS_HASH);

const hashText = (value) => createHash("sha256").update(String(value ?? ""), "utf8").digest("hex");

const safeCompare = (left, right) => {
  const a = Buffer.from(String(left ?? ""), "utf8");
  const b = Buffer.from(String(right ?? ""), "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
};

const isAdminBearerValid = (req) => {
  if (!ADMIN_ENABLED) return false;
  const auth = req.get("Authorization") || "";
  return auth === `Bearer ${BEARER}`;
};

app.post("/admin/login", (req, res) => {
  try {
    if (!ADMIN_ENABLED) {
      return res.status(503).json({ error: "admin_disabled" });
    }
    const { username = "", password = "" } = req.body || {};
    const validUser = safeCompare(hashText(username), ADMIN_USER_HASH);
    const validPass = safeCompare(hashText(password), ADMIN_PASS_HASH);
    if (!validUser || !validPass) {
      return res.status(401).json({ error: "invalid credentials" });
    }
    return res.json({ ok: true, token: BEARER });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.post("/admin/upload-cookies", express.text({ type: "*/*", limit: "2mb" }), async (req, res) => {
  try {
    if (!ADMIN_ENABLED) {
      return res.status(503).json({ error: "admin_disabled" });
    }
    const auth = req.get("Authorization") || "";
    if (auth !== `Bearer ${BEARER}`) {
      return res.status(401).json({ error: "unauthorized" });
    }

    await fsp.writeFile(COOKIES_PATH, req.body, "utf8");
    const stat = await fsp.stat(COOKIES_PATH);
    const workerBase = process.env.WORKER_API_BASE;
    const workerSecret = process.env.WORKER_SHARED_SECRET;
    if (workerBase && workerSecret) {
      const workerUrl = `${workerBase.replace(/\/$/, "")}/admin/upload-cookies`;
      try {
        const resp = await fetch(workerUrl, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            Authorization: `Bearer ${workerSecret}`,
          },
          body: req.body,
        });
        if (!resp.ok) {
          console.warn("Worker upload-cookies responded with", resp.status);
        }
      } catch (err) {
        console.warn("Failed to forward cookies to worker", err);
      }
    }
    return res.json({ ok: true, path: COOKIES_PATH, bytes: stat.size, mtime: stat.mtime });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// Status cookies — ESM-friendly (tanpa require)
app.get("/admin/cookies-status", (req, res) => {
  try {
    if (!ADMIN_ENABLED) return res.json({ exists: false, disabled: true });
    if (!existsSync(COOKIES_PATH)) return res.json({ exists: false });
    const size = statSync(COOKIES_PATH).size;
    return res.json({ exists: true, path: COOKIES_PATH, bytes: size });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

app.get("/admin/download-cookies", async (req, res) => {
  try {
    if (!ADMIN_ENABLED) {
      return res.status(503).json({ error: "admin_disabled" });
    }
    const auth = req.get("Authorization") || "";
    if (auth !== `Bearer ${BEARER}`) return res.status(401).json({ error: "unauthorized" });

    const text = await fsp.readFile(COOKIES_PATH, "utf8");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.send(text);
  } catch (e) {
    if (e?.code === "ENOENT") return res.status(404).json({ error: "not_found" });
    return res.status(500).json({ error: e.message });
  }
});

// User's explicitly requested dynamic TURN endpoint
app.get("/api/turn", async (req, res) => {
  try {
    const apiKey = process.env.TURN_API_KEY || "7bb7d1bfd87f29842119eec69eba12d3af0e";
    const response = await axios.get(
      `https://ytconv.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`
    );
    res.json(response.data);
  } catch (err) {
    console.error("TURN credentials fetch failed:", err?.message);
    res.status(500).json({ error: "Failed to fetch ICE servers." });
  }
});

app.get("/api/turn-credentials", async (req, res) => {
  // Providing dynamic fallback public TURN/STUN servers to clients.
  try {
    const apiKey = process.env.TURN_API_KEY || "7bb7d1bfd87f29842119eec69eba12d3af0e";
    const response = await axios.get(
      `https://ytconv.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`
    );

    // metered returns an array of objects or an object. Let's ensure standard format.
    const items = Array.isArray(response.data) ? response.data : [response.data];
    let iceServers = [];

    items.forEach(item => {
      // some APIs return nested iceServers, some return the array flat.
      if (item.iceServers) iceServers = iceServers.concat(item.iceServers);
      else if (item.urls) iceServers.push(item);
    });

    // If parsing fails or API returns something unexpected, fallback.
    if (!iceServers.length) iceServers = response.data;

    return res.json({ iceServers });
  } catch (err) {
    console.warn("Fallback to static ICE due to Metered failure", err?.message);
    const iceServers = [
      { urls: 'stun:stun.relay.metered.ca:80' },
      { urls: 'turn:standard.relay.metered.ca:80', username: '58f25dcefc88997a05a5fbbb', credential: 'ulLNhCZCp6eQkFu3' },
      { urls: 'turn:standard.relay.metered.ca:443?transport=tcp', username: '58f25dcefc88997a05a5fbbb', credential: 'ulLNhCZCp6eQkFu3' }
    ];
    return res.json({ iceServers });
  }
});

app.get("/internal/worker/cookies", async (req, res) => {
  try {
    const workerSecret = process.env.WORKER_SHARED_SECRET;
    if (!workerSecret) {
      return res.status(503).json({ error: "worker_secret_missing" });
    }
    const auth = req.get("Authorization") || "";
    if (auth !== `Bearer ${workerSecret}`) {
      return res.status(401).json({ error: "unauthorized" });
    }
    const text = await fsp.readFile(COOKIES_PATH, "utf8");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.send(text);
  } catch (e) {
    if (e?.code === "ENOENT") return res.status(404).json({ error: "not_found" });
    return res.status(500).json({ error: e.message });
  }
});

// ===== /api/contact: Ticket Submission Endpoint =====
const userViolations = new Map(); // userId -> { count, banned, bannedAt }
const supportTickets = new Map(); // ticketId -> ticket payload
const activityLogs = [];
const MAX_ACTIVITY_LOGS = 300;
const conversionMetrics = {
  entered: 0,
  started: 0,
  success: 0,
  errors: 0,
  errorReasons: {},
  durations: [],
};
const controlState = {
  convertEnabled: true,
  queueLength: 0,
  processing: 0,
  waiting: 0,
};
const retentionUsers = new Map();
const apiRouteStats = new Map();
const forumAppeals = new Map();
const abMetrics = {
  A: { started: 0, success: 0 },
  B: { started: 0, success: 0 },
};
const healthMetrics = {
  requestCount: 0,
  errorCount: 0,
  totalResponseMs: 0,
};

const pushActivityLog = (type, message, meta = {}) => {
  activityLogs.unshift({
    id: `LOG-${Date.now().toString(36).toUpperCase()}`,
    type,
    message,
    meta,
    at: new Date().toISOString(),
  });
  if (activityLogs.length > MAX_ACTIVITY_LOGS) activityLogs.length = MAX_ACTIVITY_LOGS;
};

const INDONESIAN_BADWORDS = [
  'anjing','bangsat','brengsek','goblok','bodoh','tolol','idiot','bajingan',
  'sialan','kampret','keparat','babi','kontol','memek','tai','monyet','asu',
  'cuk','jancok','jancuk','dancok','setan','laknat','nggak tau diri','mampus',
  'kurang ajar','ngentot','coli','bacot','ngaco','bgst','bgs','g0blok'
];


const SUPPORT_CONTACT_EMAIL = process.env.SUPPORT_CONTACT_EMAIL || "forumwargaytmp3@gmail.com";

const buildAppealId = () => `APL-${Date.now().toString(36).toUpperCase().slice(-8)}`;

const submitForumAppeal = async ({
  source = "unknown",
  userId = "",
  name = "Warga",
  email = "",
  room = "umum",
  reason = "",
  socketId = "",
  disabledFeatures = [],
  metadata = {},
} = {}) => {
  const appealId = buildAppealId();
  const submittedAt = new Date().toISOString();
  const normalizedDisabled = Array.isArray(disabledFeatures)
    ? disabledFeatures.map((x) => String(x || "").trim()).filter(Boolean).slice(0, 12)
    : [];
  const appeal = {
    appealId,
    source,
    userId: String(userId || "").slice(0, 120),
    name: String(name || "Warga").slice(0, 120),
    email: String(email || "").slice(0, 240),
    room: String(room || "umum").slice(0, 60),
    reason: String(reason || "").slice(0, 2400),
    socketId: String(socketId || "").slice(0, 120),
    disabledFeatures: normalizedDisabled,
    metadata: metadata && typeof metadata === "object" ? metadata : {},
    status: "pending",
    statusLabel: "Pending",
    submittedAt,
    updatedAt: submittedAt,
    reviewedAt: null,
    reviewedBy: "",
    reviewNote: "",
  };
  forumAppeals.set(appealId, appeal);
  pushActivityLog("forum_appeal_submitted", `Forum appeal ${appealId} dibuat`, {
    appealId,
    userId: appeal.userId,
    source,
  });
  io.emit("admin:appealCreated", {
    appealId,
    submittedAt,
    userId: appeal.userId,
    name: appeal.name,
    status: appeal.status,
    source,
  });

  const appealLines = [
    "=== Forum Appeal Request ===",
    `Appeal ID : ${appeal.appealId}`,
    `Source    : ${appeal.source}`,
    `User ID   : ${appeal.userId || "-"}`,
    `Name      : ${appeal.name || "-"}`,
    `Email     : ${appeal.email || "-"}`,
    `Room      : ${appeal.room || "-"}`,
    `Socket ID : ${appeal.socketId || "-"}`,
    `Disabled  : ${appeal.disabledFeatures.join(", ") || "-"}`,
    `Reason    : ${appeal.reason || "-"}`,
    `Time      : ${appeal.submittedAt}`,
    "SLA       : 2x24 jam",
  ];
  await sendSupportEmail({ subject: `[Forum Appeal] ${appeal.appealId}`, lines: appealLines });
  return appeal;
};

const sendSupportEmail = async ({ subject, lines = [], html = null, to = SUPPORT_CONTACT_EMAIL }) => {
  const transport = getMailTransport();
  if (!transport) return { sent: false, reason: "mail_transport_unavailable" };
  const from = process.env.NOTIFY_FROM_EMAIL || process.env.NOTIFY_EMAIL_FROM || "no-reply@youtubetomp3.app";
  const text = Array.isArray(lines) ? lines.filter(Boolean).join("\n") : String(lines || "");
  try {
    await transport.sendMail({ to, from, subject: String(subject || "YTConv Notification"), text, html: html || undefined });
    return { sent: true };
  } catch (err) {
    console.warn("[support-email] gagal mengirim email", err);
    return { sent: false, reason: err?.message || String(err) };
  }
};

app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on("finish", () => {
    const elapsed = Date.now() - startedAt;
    healthMetrics.requestCount += 1;
    healthMetrics.totalResponseMs += elapsed;
    if (res.statusCode >= 500) healthMetrics.errorCount += 1;
    const routeKey = `${req.method} ${req.path}`;
    const rec = apiRouteStats.get(routeKey) || { hits: 0, errors: 0, totalMs: 0 };
    rec.hits += 1;
    rec.totalMs += elapsed;
    if (res.statusCode >= 400) rec.errors += 1;
    apiRouteStats.set(routeKey, rec);
  });
  next();
});

app.post('/api/contact', async (req, res) => {
  try {
    const { ticketId, name, email, category, message, proofs } = req.body || {};
    if (!name || !email || !message) {
      return res.status(400).json({ ok: false, error: 'Lengkapi data tiket' });
    }
    const tid = ticketId || ('TKT-' + Date.now().toString(36).toUpperCase().slice(-8));
    const ticket = {
      ticketId: tid,
      name: String(name).slice(0, 100),
      email: String(email).slice(0, 200),
      category: String(category || 'lainnya').slice(0, 50),
      message: String(message).slice(0, 2000),
      proofCount: Array.isArray(proofs) ? proofs.length : 0,
      submittedAt: new Date().toISOString(),
      ip: req.ip
    };

    const uploadedProofs = [];
    if (Array.isArray(proofs) && proofs.length) {
      const limited = proofs.slice(0, 4);
      for (const proof of limited) {
        const directUrl = typeof proof?.url === "string" ? proof.url.trim() : "";
        if (/^https?:\/\//i.test(directUrl)) {
          uploadedProofs.push({
            name: String(proof?.name || "attachment"),
            url: directUrl,
            type: String(proof?.type || ""),
            size: Number(proof?.size || 0) || 0,
          });
          continue;
        }
        const dataUrl = typeof proof?.dataUrl === "string" ? proof.dataUrl : "";
        if (!dataUrl.startsWith("data:")) continue;
        try {
          const isVideo = /^data:video\//i.test(dataUrl);
          const result = await cloudinary.uploader.upload(dataUrl, {
            folder: "ytconv/support-tickets",
            resource_type: isVideo ? "video" : "image",
            public_id: `${tid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
            overwrite: false,
          });
          if (result?.secure_url) {
            uploadedProofs.push({
              name: String(proof?.name || result?.original_filename || "attachment"),
              url: String(result.secure_url),
              type: String(proof?.type || ""),
              size: Number(proof?.size || 0) || 0,
            });
          }
        } catch (uploadErr) {
          console.warn("[/api/contact] gagal upload proof ke Cloudinary", uploadErr?.message || uploadErr);
        }
      }
    }

    // Log the ticket for admin
    console.log('[YTConv CS Ticket]', JSON.stringify(ticket));

    const emailBody = [
      `=== YTConv Support Ticket ===`,
      `Ticket ID : ${tid}`,
      `From      : ${name} <${email}>`,
      `Category  : ${category}`,
      `Message   : ${message}`,
      `Proofs    : ${uploadedProofs.length} attachment(s)`,
      `Time      : ${ticket.submittedAt}`,
      `To        : ${SUPPORT_CONTACT_EMAIL}`
    ].join('\n');
    console.log('[YTConv CS Email]\n' + emailBody);

    const firstFileLink = uploadedProofs[0]?.url || "";
    const filesHtml = uploadedProofs.length
      ? `<ul>${uploadedProofs.map((f) => `<li><a href="${String(f.url)}" target="_blank" rel="noopener noreferrer">${String(f.name || "Lihat File")}</a></li>`).join("")}</ul>`
      : "<span>Tidak ada file</span>";
    const htmlBody = `
<p style="font-family: helvetica, arial, sans-serif;">Halo Admin,</p>
<p style="font-family: helvetica, arial, sans-serif;">Ada pesan baru dari <b>Forum Warga</b>.</p>
<hr>
<p style="font-family: helvetica, arial, sans-serif;"><b>🆔 ID Tiket:</b> ${tid}</p>
<p style="font-family: helvetica, arial, sans-serif;"><b>👤 Nama:</b> ${ticket.name}</p>
<p style="font-family: helvetica, arial, sans-serif;"><b>📧 Email:</b> ${ticket.email}</p>
<p style="font-family: helvetica, arial, sans-serif;"><b>📂 Kategori:</b> ${ticket.category}</p>
<p style="font-family: helvetica, arial, sans-serif;"><b>💬 Pesan:</b><br>${ticket.message.replace(/\n/g, "<br>")}</p>
<p style="font-family: helvetica, arial, sans-serif;"><b>📎 File:</b><br>${filesHtml}</p>
<p style="font-family: helvetica, arial, sans-serif;"><b>🕒 Waktu:</b> ${ticket.submittedAt}</p>
<hr>
<p style="font-family: helvetica, arial, sans-serif; font-size: 12px; color: gray;">Pesan ini dikirim otomatis oleh sistem Forum Warga.<br>Mohon tidak membalas email ini.</p>
`;

    const subject = `[YTConv Ticket] ${tid} • ${ticket.category}`;
    const emailResult = await sendSupportEmail({ subject, lines: [emailBody], html: htmlBody });
    if (!emailResult.sent) {
      console.warn(`[YTConv CS Ticket] email belum terkirim untuk ${tid}: ${emailResult.reason || 'unknown reason'}`);
    }

    const statusLink = `${DEFAULT_PUBLIC_BASE_URL || "https://ytconv.up.railway.app"}/ticket-status.html?ticket_id=${encodeURIComponent(tid)}`;
    const autoReplyHtml = `
<div style="font-family: Arial, sans-serif; background:#f4f6f9; padding:20px;">
  <div style="max-width:600px; margin:auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 10px 25px rgba(0,0,0,0.08);">
    <div style="background: linear-gradient(135deg, #4f46e5, #06b6d4); padding:20px; color:white;">
      <h2 style="margin:0;">📩 Laporan Diterima</h2>
      <p style="margin:5px 0 0; font-size:13px;">YtConv Support System</p>
    </div>
    <div style="padding:25px;">
      <p style="font-size:16px;">Halo <b>${ticket.name}</b>,</p>
      <p>Terima kasih telah mengirimkan laporan. Kami telah menerima pesan kamu dan saat ini sedang dalam proses penanganan.</p>
      <div style="background:#f1f5f9; padding:15px; border-radius:8px; margin:20px 0;">
        <p style="margin:5px 0;"><b>🆔 ID Tiket:</b> ${tid}</p>
        <p style="margin:5px 0;"><b>📂 Kategori:</b> ${ticket.category}</p>
        <p style="margin:5px 0;"><b>🕒 Waktu:</b> ${ticket.submittedAt}</p>
      </div>
      <div style="margin-top:15px;">
        <p style="margin-bottom:5px;"><b>💬 Pesan kamu:</b></p>
        <div style="background:#fafafa; padding:12px; border-radius:6px; font-size:14px;">${ticket.message.replace(/\n/g, "<br>")}</div>
      </div>
      <p style="margin-top:20px;">⏳ Estimasi respon: <b>2x24 jam</b><br>Mohon simpan ID tiket kamu untuk keperluan tracking.</p>
      <p><a href="${statusLink}" target="_blank" rel="noopener noreferrer">Cek Status Tiket</a></p>
      <div style="text-align:center; margin:25px 0;">
        <span style="background:#4f46e5; color:white; padding:10px 18px; border-radius:6px; font-size:14px;">Tiket kamu sedang diproses 🚀</span>
      </div>
    </div>
    <div style="background:#f9fafb; padding:15px; text-align:center; font-size:12px; color:#777;">
      Email ini dikirim otomatis oleh sistem Forum Warga.<br>Mohon tidak membalas email ini.
    </div>
  </div>
</div>`;
    const autoReplyLines = [
      `Halo ${ticket.name},`,
      `Tiket ${tid} sudah diterima.`,
      `Kategori: ${ticket.category}`,
      `Waktu: ${ticket.submittedAt}`,
      `Cek status: ${statusLink}`,
    ];
    const autoReplyResult = await sendSupportEmail({
      to: ticket.email,
      subject: `[TIKET ${tid}] Laporan kamu sudah diterima`,
      lines: autoReplyLines,
      html: autoReplyHtml,
    });

    supportTickets.set(tid, {
      ...ticket,
      proofs: uploadedProofs,
      status: "received",
      statusLabel: "Diterima",
      statusUpdatedAt: ticket.submittedAt,
      statusHistory: [{ status: "received", label: "Diterima", at: ticket.submittedAt, note: "Tiket dibuat oleh user" }],
      adminReply: "",
      chatHistory: [{
        id: `CHAT-${Date.now().toString(36).toUpperCase().slice(-8)}`,
        sender: "user",
        message: ticket.message,
        at: ticket.submittedAt,
      }],
      statusLink,
      autoReplyEmailStatus: autoReplyResult.sent ? "sent" : "queued",
    });
    pushActivityLog("ticket_created", `Tiket ${tid} dibuat`, { ticketId: tid, category: ticket.category });
    io.emit("admin:newTicket", {
      ticketId: tid,
      submittedAt: ticket.submittedAt,
      category: ticket.category,
      status: "received",
      statusLabel: "Diterima",
      name: ticket.name,
    });

    res.json({
      ok: true,
      ticketId: tid,
      message: 'Tiket diterima, tim akan membalas dalam 1x24 jam.',
      emailStatus: emailResult.sent ? 'sent' : 'queued',
      autoReplyEmailStatus: autoReplyResult.sent ? 'sent' : 'queued',
      fileLink: firstFileLink || null,
      fileLinks: uploadedProofs.map((f) => f.url),
      statusLink,
    });
  } catch (e) {
    console.error('[/api/contact error]', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});



app.post('/api/forum/moderation-report', async (req, res) => {
  try {
    const body = req.body || {};
    const reportId = 'MOD-' + Date.now().toString(36).toUpperCase().slice(-8);
    const payload = {
      reportId,
      userId: String(body.userId || '').slice(0, 100),
      name: String(body.name || 'Warga').slice(0, 80),
      email: String(body.email || '').slice(0, 200),
      text: String(body.text || '').slice(0, 2000),
      violationCount: Number(body.violationCount || 0),
      room: String(body.room || 'umum').slice(0, 50),
      submittedAt: new Date().toISOString(),
      ip: req.ip,
    };

    console.warn('[Forum AutoMod Report]', JSON.stringify(payload));

    const lines = [
      '=== Forum Auto Moderation Report ===',
      `Report ID : ${payload.reportId}`,
      `User      : ${payload.name} (${payload.userId || '-'})`,
      `Email     : ${payload.email || '-'}`,
      `Room      : ${payload.room}`,
      `Count     : ${payload.violationCount}/5`,
      `Message   : ${payload.text}`,
      `Time      : ${payload.submittedAt}`,
    ];

    const emailResult = await sendSupportEmail({
      subject: `[Forum AutoMod] ${payload.reportId} • ${payload.violationCount}/5`,
      lines,
    });

    return res.json({ ok: true, reportId, emailStatus: emailResult.sent ? 'sent' : 'queued' });
  } catch (e) {
    console.error('[/api/forum/moderation-report error]', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/api/forum/appeal", express.json({ limit: "512kb" }), async (req, res) => {
  try {
    const body = req.body || {};
    const userId = String(body.userId || "").trim();
    const reason = String(body.reason || body.message || "").trim();
    if (!userId) return res.status(400).json({ ok: false, error: "user_id_required" });
    if (!reason) return res.status(400).json({ ok: false, error: "reason_required" });

    const violationRec = userViolations.get(userId);
    const blockedByServer = Boolean(violationRec?.banned);
    const disabledFeatures = Array.isArray(body.disabledFeatures) ? body.disabledFeatures : [];
    const blockedByClient = disabledFeatures.length > 0 || Number(body.violationCount || 0) >= 5;

    if (!blockedByServer && !blockedByClient) {
      return res.status(400).json({
        ok: false,
        error: "not_blocked",
        message: "Status blocked belum terdeteksi dari server/client.",
      });
    }

    const appeal = await submitForumAppeal({
      source: "ai_navigator",
      userId,
      name: body.name || "Warga",
      email: body.email || "",
      room: body.room || "umum",
      reason,
      socketId: body.socketId || "",
      disabledFeatures,
      metadata: {
        violationCount: Number(body.violationCount || 0),
        googleAccount: body.googleAccount || null,
        blockedByServer,
        blockedByClient,
      },
    });
    return res.json({
      ok: true,
      appealId: appeal.appealId,
      status: appeal.status,
      submittedAt: appeal.submittedAt,
      message: `✅ Appeal ${appeal.appealId} berhasil dikirim ke admin dashboard.`,
    });
  } catch (e) {
    console.error("[/api/forum/appeal error]", e);
    return res.status(500).json({ ok: false, error: e?.message || "appeal_failed" });
  }
});

app.get("/api/ticket/:ticketId", (req, res) => {
  const ticketId = String(req.params.ticketId || "").trim().toUpperCase();
  if (!ticketId) return res.status(400).json({ ok: false, error: "ticket_id_invalid" });
  const ticket = supportTickets.get(ticketId);
  if (!ticket) return res.status(404).json({ ok: false, error: "ticket_not_found" });
  return res.json({
    ok: true,
    ticket: {
      ticketId: ticket.ticketId,
      name: ticket.name,
      email: ticket.email,
      category: ticket.category,
      message: ticket.message,
      status: ticket.status,
      statusLabel: ticket.statusLabel,
      statusUpdatedAt: ticket.statusUpdatedAt,
      statusHistory: ticket.statusHistory || [],
      adminReply: ticket.adminReply || "",
      chatHistory: ticket.chatHistory || [],
      submittedAt: ticket.submittedAt,
      proofs: (ticket.proofs || []).map((p) => ({ name: p.name, url: p.url, type: p.type, size: p.size })),
    },
  });
});

app.get("/api/admin/tickets", (req, res) => {
  if (!isAdminBearerValid(req)) return res.status(401).json({ ok: false, error: "unauthorized" });
  const items = Array.from(supportTickets.values())
    .sort((a, b) => String(b.submittedAt || "").localeCompare(String(a.submittedAt || "")))
    .map((ticket) => ({
      ticketId: ticket.ticketId,
      name: ticket.name,
      email: ticket.email,
      category: ticket.category,
      message: ticket.message,
      status: ticket.status,
      statusLabel: ticket.statusLabel,
      statusUpdatedAt: ticket.statusUpdatedAt,
      submittedAt: ticket.submittedAt,
      proofs: ticket.proofs || [],
      adminReply: ticket.adminReply || "",
    }));
  return res.json({ ok: true, tickets: items });
});

app.get("/api/admin/appeals", (req, res) => {
  if (!isAdminBearerValid(req)) return res.status(401).json({ ok: false, error: "unauthorized" });
  const appeals = Array.from(forumAppeals.values())
    .sort((a, b) => String(b.submittedAt || "").localeCompare(String(a.submittedAt || "")));
  return res.json({ ok: true, appeals });
});

app.patch("/api/admin/appeals/:appealId", express.json({ limit: "256kb" }), (req, res) => {
  if (!isAdminBearerValid(req)) return res.status(401).json({ ok: false, error: "unauthorized" });
  const appealId = String(req.params.appealId || "").trim().toUpperCase();
  const appeal = forumAppeals.get(appealId);
  if (!appeal) return res.status(404).json({ ok: false, error: "appeal_not_found" });
  const status = String(req.body?.status || "").trim().toLowerCase();
  if (!["accepted", "rejected", "pending"].includes(status)) {
    return res.status(400).json({ ok: false, error: "invalid_status" });
  }
  const statusLabelMap = { accepted: "Diterima", rejected: "Ditolak", pending: "Pending" };
  appeal.status = status;
  appeal.statusLabel = statusLabelMap[status] || status;
  appeal.reviewNote = String(req.body?.reviewNote || "").slice(0, 1200);
  appeal.reviewedBy = String(req.body?.reviewedBy || "admin").slice(0, 120);
  appeal.reviewedAt = status === "pending" ? null : new Date().toISOString();
  appeal.updatedAt = new Date().toISOString();
  forumAppeals.set(appealId, appeal);
  pushActivityLog("forum_appeal_updated", `Appeal ${appealId} -> ${appeal.statusLabel}`, {
    appealId,
    status: appeal.status,
  });
  io.emit("admin:appealUpdated", {
    appealId,
    status: appeal.status,
    statusLabel: appeal.statusLabel,
  });
  return res.json({ ok: true, appeal });
});

app.get("/api/admin/stats", (req, res) => {
  if (!isAdminBearerValid(req)) return res.status(401).json({ ok: false, error: "unauthorized" });
  const now = new Date();
  const dayBuckets = new Map();
  const tickets = Array.from(supportTickets.values());
  tickets.forEach((ticket) => {
    const submittedAt = ticket?.submittedAt ? new Date(ticket.submittedAt) : null;
    if (!submittedAt || Number.isNaN(submittedAt.getTime())) return;
    const key = submittedAt.toISOString().slice(0, 10);
    dayBuckets.set(key, (dayBuckets.get(key) || 0) + 1);
  });
  const ticketsPerDay = Array.from({ length: 7 }).map((_, idx) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (6 - idx));
    const key = date.toISOString().slice(0, 10);
    return {
      date: key,
      total: dayBuckets.get(key) || 0,
    };
  });
  const byStatus = tickets.reduce((acc, t) => {
    const key = String(t?.status || "received");
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const memory = process.memoryUsage?.() || {};
  const durations = conversionMetrics.durations.length ? conversionMetrics.durations : [0];
  const avgDuration = durations.reduce((a, b) => a + b, 0) / Math.max(1, conversionMetrics.durations.length);
  const maxDuration = Math.max(...durations);
  const minDuration = conversionMetrics.durations.length ? Math.min(...durations) : 0;
  const avgResponseMs = healthMetrics.requestCount ? (healthMetrics.totalResponseMs / healthMetrics.requestCount) : 0;
  const errorRate = healthMetrics.requestCount ? (healthMetrics.errorCount / healthMetrics.requestCount) * 100 : 0;
  const cpu = process.cpuUsage();
  const cpuLoadEstimate = Number((((cpu.user + cpu.system) / 1000) / Math.max(1, process.uptime() * 1000) * 100).toFixed(2));
  const apiStats = Array.from(apiRouteStats.entries()).map(([route, rec]) => ({
    route,
    hits: rec.hits,
    errors: rec.errors,
    avgMs: Number((rec.totalMs / Math.max(1, rec.hits)).toFixed(2)),
  })).sort((a, b) => b.hits - a.hits).slice(0, 20);
  const returningUsers = Array.from(retentionUsers.values()).filter((u) => Number(u.sessions || 0) > 1).length;
  const newUsers = Math.max(0, retentionUsers.size - returningUsers);
  const appeals = Array.from(forumAppeals.values()).sort((a, b) => String(b.submittedAt || "").localeCompare(String(a.submittedAt || "")));
  const appealsByStatus = appeals.reduce((acc, item) => {
    const key = String(item?.status || "pending");
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const blockedForumUsers = Array.from(userViolations.values()).filter((x) => x?.banned).length;
  const disabledFeatureUsage = {};
  appeals.forEach((a) => {
    (a.disabledFeatures || []).forEach((f) => {
      const key = String(f || "").trim();
      if (!key) return;
      disabledFeatureUsage[key] = (disabledFeatureUsage[key] || 0) + 1;
    });
  });
  const successRate = conversionMetrics.started ? (conversionMetrics.success / conversionMetrics.started) * 100 : 0;
  const predictedNextHourUsers = Number(((conversionMetrics.entered / Math.max(1, process.uptime() / 3600))).toFixed(0));
  const smartInsights = [];
  if (successRate < 40 && conversionMetrics.started >= 5) smartInsights.push("Conversion success rendah dibanding jumlah start.");
  if (conversionMetrics.errors >= 3) smartInsights.push("Error conversion meningkat, cek error tracking.");
  if ((healthMetrics.errorCount / Math.max(1, healthMetrics.requestCount)) > 0.05) smartInsights.push("Error API rate di atas 5%.");
  if (!smartInsights.length) smartInsights.push("Sistem relatif stabil dalam window monitoring saat ini.");
  return res.json({
    ok: true,
    timestamp: Date.now(),
    uptimeSeconds: Math.floor(process.uptime()),
    activeSocketClients: Number(io?.engine?.clientsCount || 0),
    forumRooms: roomUsers.size,
    tickets: {
      total: tickets.length,
      byStatus,
      all: tickets
        .slice()
        .sort((a, b) => String(b.submittedAt || "").localeCompare(String(a.submittedAt || "")))
        .map((t) => ({
          ticketId: t.ticketId,
          status: t.status,
          statusLabel: t.statusLabel,
          submittedAt: t.submittedAt,
          category: t.category,
          email: t.email,
          name: t.name,
          message: t.message,
          proofs: t.proofs || [],
          statusHistory: t.statusHistory || [],
          chatHistory: t.chatHistory || [],
        })),
      newest: tickets
        .slice()
        .sort((a, b) => String(b.submittedAt || "").localeCompare(String(a.submittedAt || "")))
        .slice(0, 5)
        .map((t) => ({
          ticketId: t.ticketId,
          status: t.status,
          statusLabel: t.statusLabel,
          submittedAt: t.submittedAt,
          category: t.category,
          email: t.email,
        })),
      perDay: ticketsPerDay,
    },
    live: {
      activeUsers: activeUsers.size,
      pageStats: getLiveBreakdown("page"),
      roomStats: getLiveBreakdown("room"),
      conversion: getConversionStats(),
      users: getLiveUsers(),
    },
    conversionFunnel: {
      entered: conversionMetrics.entered,
      started: conversionMetrics.started,
      success: conversionMetrics.success,
    },
    processingTime: {
      avgMs: Number(avgDuration.toFixed(2)),
      minMs: Number(minDuration.toFixed(2)),
      maxMs: Number(maxDuration.toFixed(2)),
    },
    queue: {
      length: controlState.queueLength,
      processing: controlState.processing,
      waiting: controlState.waiting,
    },
    health: {
      cpuPercentEstimate: cpuLoadEstimate,
      avgResponseMs: Number(avgResponseMs.toFixed(2)),
      errorRate: Number(errorRate.toFixed(2)),
      requestCount: healthMetrics.requestCount,
    },
    errors: {
      total: conversionMetrics.errors,
      reasons: conversionMetrics.errorReasons,
    },
    apiMonitoring: apiStats,
    retention: {
      totalUsers: retentionUsers.size,
      newUsers,
      returningUsers,
    },
    appeals: {
      total: appeals.length,
      byStatus: appealsByStatus,
      all: appeals.slice(0, 200),
    },
    moderation: {
      blockedForumUsers,
      disabledFeatureUsage,
    },
    abTesting: abMetrics,
    smartInsights,
    predictive: {
      nextHourUsers: predictedNextHourUsers,
      peakHourHint: "Biasanya traffic puncak sekitar 20:00-22:00 (estimasi rule-based).",
    },
    activityLogs: activityLogs.slice(0, 80),
    control: {
      convertEnabled: controlState.convertEnabled,
    },
    runtime: {
      rss: Number(memory.rss || 0),
      heapUsed: Number(memory.heapUsed || 0),
      heapTotal: Number(memory.heapTotal || 0),
      external: Number(memory.external || 0),
    },
  });
});

app.patch("/api/admin/tickets/:ticketId", express.json({ limit: "512kb" }), async (req, res) => {
  if (!isAdminBearerValid(req)) return res.status(401).json({ ok: false, error: "unauthorized" });
  const ticketId = String(req.params.ticketId || "").trim().toUpperCase();
  const ticket = supportTickets.get(ticketId);
  if (!ticket) return res.status(404).json({ ok: false, error: "ticket_not_found" });
  const status = String(req.body?.status || ticket.status || "received").trim().toLowerCase();
  const statusLabel = String(req.body?.statusLabel || "").trim() || ({
    received: "Diterima",
    reviewing: "Diproses",
    waiting_user: "Menunggu User",
    resolved: "Selesai",
    rejected: "Ditolak",
  }[status] || status);
  const adminReply = String(req.body?.adminReply || "").slice(0, 4000);
  const nowIso = new Date().toISOString();
  ticket.status = status;
  ticket.statusLabel = statusLabel;
  ticket.statusUpdatedAt = nowIso;
  if (adminReply) ticket.adminReply = adminReply;
  if (!Array.isArray(ticket.statusHistory)) ticket.statusHistory = [];
  ticket.statusHistory.push({ status, label: statusLabel, at: nowIso, note: adminReply || "Update status admin" });
  supportTickets.set(ticketId, ticket);
  io.emit("admin:ticketUpdated", {
    ticketId,
    status,
    statusLabel,
    adminReply,
    statusUpdatedAt: nowIso,
  });
  pushActivityLog("ticket_updated", `Tiket ${ticketId} diubah ke ${statusLabel}`, { ticketId, status });

  const statusLink = ticket.statusLink || `${DEFAULT_PUBLIC_BASE_URL || "https://ytconv.up.railway.app"}/ticket-status.html?ticket_id=${encodeURIComponent(ticketId)}`;
  const replyHtml = `
  <div style="font-family:Arial,sans-serif;padding:18px;background:#f8fafc;">
    <div style="max-width:640px;margin:auto;background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:18px;">
      <h3 style="margin-top:0;">Update Status Tiket ${ticketId}</h3>
      <p>Status terbaru: <b>${statusLabel}</b></p>
      ${adminReply ? `<p>Pesan admin:</p><div style="background:#f3f4f6;padding:10px;border-radius:6px;">${adminReply.replace(/\n/g, "<br>")}</div>` : ""}
      <p><a href="${statusLink}" target="_blank" rel="noopener noreferrer">Cek Status Tiket</a></p>
    </div>
  </div>`;
  await sendSupportEmail({
    to: ticket.email,
    subject: `[TIKET ${ticketId}] Update status: ${statusLabel}`,
    lines: [`Tiket ${ticketId} status terbaru: ${statusLabel}`, `Cek status: ${statusLink}`],
    html: replyHtml,
  });

  return res.json({ ok: true, ticket });
});

app.post("/api/admin/tickets/:ticketId/chat", express.json({ limit: "512kb" }), (req, res) => {
  if (!isAdminBearerValid(req)) return res.status(401).json({ ok: false, error: "unauthorized" });
  const ticketId = String(req.params.ticketId || "").trim().toUpperCase();
  const ticket = supportTickets.get(ticketId);
  if (!ticket) return res.status(404).json({ ok: false, error: "ticket_not_found" });
  const text = String(req.body?.message || "").trim();
  if (!text) return res.status(400).json({ ok: false, error: "message_required" });
  const adminCount = Array.isArray(ticket.chatHistory) ? ticket.chatHistory.filter((x) => x?.sender === "admin").length : 0;
  if (adminCount >= 3) return res.status(400).json({ ok: false, error: "admin_chat_limit_reached", limit: 3 });
  const nowIso = new Date().toISOString();
  const chatEntry = {
    id: `CHAT-${Date.now().toString(36).toUpperCase().slice(-8)}`,
    sender: "admin",
    message: text.slice(0, 2000),
    at: nowIso,
  };
  if (!Array.isArray(ticket.chatHistory)) ticket.chatHistory = [];
  ticket.chatHistory.push(chatEntry);
  supportTickets.set(ticketId, ticket);
  io.emit("admin:ticketChat", { ticketId, chat: chatEntry });
  pushActivityLog("admin_reply", `Admin membalas tiket ${ticketId}`, { ticketId });
  return res.json({ ok: true, chat: chatEntry, ticketId });
});

app.post("/api/ticket/:ticketId/chat", express.json({ limit: "512kb" }), (req, res) => {
  const ticketId = String(req.params.ticketId || "").trim().toUpperCase();
  const ticket = supportTickets.get(ticketId);
  if (!ticket) return res.status(404).json({ ok: false, error: "ticket_not_found" });
  const text = String(req.body?.message || "").trim();
  if (!text) return res.status(400).json({ ok: false, error: "message_required" });
  const userCount = Array.isArray(ticket.chatHistory) ? ticket.chatHistory.filter((x) => x?.sender === "user").length : 0;
  if (userCount >= 3) return res.status(400).json({ ok: false, error: "user_chat_limit_reached", limit: 3 });
  const nowIso = new Date().toISOString();
  const chatEntry = {
    id: `CHAT-${Date.now().toString(36).toUpperCase().slice(-8)}`,
    sender: "user",
    message: text.slice(0, 2000),
    at: nowIso,
  };
  if (!Array.isArray(ticket.chatHistory)) ticket.chatHistory = [];
  ticket.chatHistory.push(chatEntry);
  ticket.status = ticket.status === "resolved" ? "reviewing" : ticket.status;
  ticket.statusLabel = ticket.status === "reviewing" ? "Diproses" : ticket.statusLabel;
  ticket.statusUpdatedAt = nowIso;
  supportTickets.set(ticketId, ticket);
  io.emit("admin:ticketChat", { ticketId, chat: chatEntry });
  io.emit("admin:ticketUpdated", { ticketId, status: ticket.status, statusLabel: ticket.statusLabel, statusUpdatedAt: nowIso });
  pushActivityLog("user_reply", `User membalas tiket ${ticketId}`, { ticketId });
  return res.json({ ok: true, chat: chatEntry, ticketId, remaining: Math.max(0, 3 - (userCount + 1)) });
});

app.post("/api/admin/control", express.json({ limit: "128kb" }), (req, res) => {
  if (!isAdminBearerValid(req)) return res.status(401).json({ ok: false, error: "unauthorized" });
  const action = String(req.body?.action || "").trim();
  if (action === "toggle_convert") {
    controlState.convertEnabled = !controlState.convertEnabled;
  } else if (action === "clear_queue") {
    controlState.queueLength = 0;
    controlState.processing = 0;
    controlState.waiting = 0;
  } else if (action === "kick_user") {
    const socketId = String(req.body?.socketId || "");
    const target = io.sockets.sockets.get(socketId);
    if (target) target.disconnect(true);
  } else {
    return res.status(400).json({ ok: false, error: "unknown_action" });
  }
  pushActivityLog("admin_control", `Control action: ${action}`, { action });
  io.emit("admin:controlUpdated", { ...controlState });
  emitDashboardStats();
  return res.json({ ok: true, control: { ...controlState } });
});

app.get("/ticket/:ticketId", (req, res) => {
  const ticketId = String(req.params.ticketId || "").trim().toUpperCase();
  if (!ticketId) return res.sendFile(join(__dirname, "public-ui", "ticket-status.html"));
  return res.redirect(302, `/ticket-status.html?ticket_id=${encodeURIComponent(ticketId)}`);
});

app.get("/admin/tickets", (req, res) => {
  res.sendFile(join(__dirname, "public-ui", "admin-tickets.html"));
});

app.get("/admin/dashboard", (req, res) => {
  res.sendFile(join(__dirname, "public-ui", "admin-dashboard.html"));
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: true,
    credentials: true,
  },
});

const roomUsers = new Map();
const socketState = new Map();
const activeUsers = new Map();

const getLiveBreakdown = (field) => {
  const result = {};
  activeUsers.forEach((user) => {
    const key = String(user?.[field] || "unknown");
    result[key] = (result[key] || 0) + 1;
  });
  return result;
};

const getConversionStats = () => {
  let converting = 0;
  let success = 0;
  activeUsers.forEach((user) => {
    if (user?.status === "converting") converting += 1;
    if (user?.status === "success") success += 1;
  });
  return { converting, success };
};

const getLiveUsers = () => Array.from(activeUsers.entries()).map(([socketId, user]) => ({
  socketId,
  page: user.page || "unknown",
  room: user.room || null,
  status: user.status || "idle",
  durationSeconds: user.connectedAt ? Math.max(0, Math.floor((Date.now() - new Date(user.connectedAt).getTime()) / 1000)) : 0,
  journey: Array.isArray(user.journey) ? user.journey.join(" → ") : "",
  actions: Array.isArray(user.actionTrail) ? user.actionTrail : [],
  clientId: user.clientId || "",
  abVariant: user.abVariant || "A",
  geo: user.geo || { country: "unknown", city: "unknown" },
  userAgent: user.userAgent || "",
  connectedAt: user.connectedAt || null,
  lastSeenAt: user.lastSeenAt || null,
}));

const emitDashboardStats = () => {
  io.emit("dashboard_stats", {
    totalUsers: activeUsers.size,
    pageStats: getLiveBreakdown("page"),
    roomStats: getLiveBreakdown("room"),
    conversion: getConversionStats(),
    users: getLiveUsers(),
  });
};

const getOrCreateRoomMap = (room) => {
  const key = String(room || "umum");
  if (!roomUsers.has(key)) roomUsers.set(key, new Map());
  return roomUsers.get(key);
};

const broadcastRoomUsers = (room) => {
  const users = Array.from(getOrCreateRoomMap(room).values()).map((u) => ({
    userId: u.userId,
    name: u.name,
  }));
  io.to(`forum:${room}`).emit("forum:users", { room, users });
};

io.on("connection", (socket) => {
  activeUsers.set(socket.id, {
    page: "unknown",
    room: null,
    status: "idle",
    journey: [],
    actionTrail: [],
    convertStartedAt: null,
    clientId: "",
    abVariant: "A",
    geo: {
      country: String(socket.handshake?.headers?.["cf-ipcountry"] || socket.handshake?.headers?.["x-vercel-ip-country"] || "unknown"),
      city: String(socket.handshake?.headers?.["x-vercel-ip-city"] || "unknown"),
    },
    userAgent: socket.handshake?.headers?.["user-agent"] || "",
    connectedAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
  });
  conversionMetrics.entered += 1;
  pushActivityLog("user_connected", `Socket ${socket.id} connected`, { socketId: socket.id });
  emitDashboardStats();

  socket.on("page_change", (payload) => {
    const page = String(payload?.page || "unknown").slice(0, 128);
    const rec = activeUsers.get(socket.id);
    if (!rec) return;
    const clientId = String(payload?.clientId || rec.clientId || "").slice(0, 120);
    const abVariant = String(payload?.abVariant || rec.abVariant || "A").toUpperCase() === "B" ? "B" : "A";
    rec.clientId = clientId;
    rec.abVariant = abVariant;
    if (clientId) {
      const retentionRec = retentionUsers.get(clientId) || { sessions: 0, lastSeenAt: null };
      if (!retentionRec.lastSeenAt || (Date.now() - new Date(retentionRec.lastSeenAt).getTime()) > 30 * 60 * 1000) {
        retentionRec.sessions += 1;
      }
      retentionRec.lastSeenAt = new Date().toISOString();
      retentionUsers.set(clientId, retentionRec);
    }
    rec.page = page || "unknown";
    rec.journey = Array.isArray(rec.journey) ? rec.journey : [];
    rec.journey.push(rec.page);
    if (rec.journey.length > 12) rec.journey = rec.journey.slice(-12);
    rec.lastSeenAt = new Date().toISOString();
    activeUsers.set(socket.id, rec);
    emitDashboardStats();
  });

  socket.on("user_action", (payload) => {
    const rec = activeUsers.get(socket.id);
    if (!rec) return;
    const action = String(payload?.action || "unknown_action").slice(0, 120);
    const detail = String(payload?.detail || "").slice(0, 200);
    rec.actionTrail = Array.isArray(rec.actionTrail) ? rec.actionTrail : [];
    rec.actionTrail.push({
      action,
      detail,
      at: new Date().toISOString(),
      page: rec.page || "unknown",
    });
    if (rec.actionTrail.length > 40) rec.actionTrail = rec.actionTrail.slice(-40);
    rec.lastSeenAt = new Date().toISOString();
    activeUsers.set(socket.id, rec);
    pushActivityLog("user_action", `${socket.id}: ${action}`, { socketId: socket.id, action, detail });
    emitDashboardStats();
  });

  socket.on("conversion_start", (payload) => {
    const rec = activeUsers.get(socket.id);
    if (!rec) return;
    const incomingVariant = String(payload?.abVariant || rec.abVariant || "A").toUpperCase() === "B" ? "B" : "A";
    rec.abVariant = incomingVariant;
    if (!controlState.convertEnabled) {
      socket.emit("conversion_blocked", { message: "Konversi sedang dinonaktifkan admin sementara." });
      return;
    }
    rec.status = "converting";
    rec.convertStartedAt = Date.now();
    rec.journey = Array.isArray(rec.journey) ? rec.journey : [];
    rec.journey.push("convert:start");
    conversionMetrics.started += 1;
    abMetrics[rec.abVariant || "A"].started += 1;
    controlState.processing += 1;
    controlState.queueLength = Math.max(controlState.queueLength, controlState.processing);
    controlState.waiting = Math.max(0, controlState.queueLength - controlState.processing);
    rec.lastSeenAt = new Date().toISOString();
    activeUsers.set(socket.id, rec);
    emitDashboardStats();
  });

  socket.on("conversion_success", () => {
    const rec = activeUsers.get(socket.id);
    if (!rec) return;
    rec.status = "success";
    rec.journey = Array.isArray(rec.journey) ? rec.journey : [];
    rec.journey.push("convert:success");
    if (rec.convertStartedAt) {
      conversionMetrics.durations.push(Date.now() - rec.convertStartedAt);
      if (conversionMetrics.durations.length > 1000) conversionMetrics.durations.shift();
    }
    rec.convertStartedAt = null;
    conversionMetrics.success += 1;
    abMetrics[rec.abVariant || "A"].success += 1;
    controlState.processing = Math.max(0, controlState.processing - 1);
    controlState.queueLength = Math.max(0, controlState.queueLength - 1);
    controlState.waiting = Math.max(0, controlState.queueLength - controlState.processing);
    pushActivityLog("conversion_success", `Conversion success from ${socket.id}`, { socketId: socket.id });
    rec.lastSeenAt = new Date().toISOString();
    activeUsers.set(socket.id, rec);
    emitDashboardStats();
  });

  socket.on("conversion_idle", () => {
    const rec = activeUsers.get(socket.id);
    if (!rec) return;
    rec.status = "idle";
    rec.lastSeenAt = new Date().toISOString();
    activeUsers.set(socket.id, rec);
    emitDashboardStats();
  });

  socket.on("conversion_error", (payload) => {
    const rec = activeUsers.get(socket.id);
    const reason = String(payload?.reason || "unknown_error").slice(0, 120);
    conversionMetrics.errors += 1;
    conversionMetrics.errorReasons[reason] = (conversionMetrics.errorReasons[reason] || 0) + 1;
    controlState.processing = Math.max(0, controlState.processing - 1);
    controlState.queueLength = Math.max(0, controlState.queueLength - 1);
    controlState.waiting = Math.max(0, controlState.queueLength - controlState.processing);
    if (rec) {
      rec.status = "idle";
      rec.journey = Array.isArray(rec.journey) ? rec.journey : [];
      rec.journey.push(`convert:error:${reason}`);
      rec.lastSeenAt = new Date().toISOString();
      activeUsers.set(socket.id, rec);
    }
    pushActivityLog("conversion_error", `Conversion error ${reason}`, { socketId: socket.id, reason });
    emitDashboardStats();
  });

  socket.on("forum:chatMessage", async (payload) => {
    const from = socketState.get(socket.id);
    if (!from) return;
    const room = String(from.room || "umum");
    const text = String(payload?.text || "").trim();
    const userId = from.userId;

    if (!text) return;

    // Auto Moderation: Check bad words
    const lower = text.toLowerCase();
    const isBad = INDONESIAN_BADWORDS.some(w => lower.includes(w));

    // Check if user already banned
    const rec = userViolations.get(userId) || { count: 0, banned: false };
    if (rec.banned) {
      socket.emit("forum:banned", {
        message: "Kamu telah diblokir dari forum karena 5 pelanggaran bahasa. Silakan ajukan appeal via AI Navigator / tiket bantuan.",
        appealUrl: "#"
      });
      return;
    }

    if (isBad) {
      rec.count += 1;
      const remaining = 5 - rec.count;
      if (rec.count >= 5) {
        rec.banned = true;
        rec.bannedAt = Date.now();
        userViolations.set(userId, rec);
        // Auto-report to admin log
        console.warn(`[Forum AutoMod] USER BANNED: userId=${userId} name=${from.name} after 5 violations.`);
        socket.emit("forum:modAction", {
          type: "ban",
          message: "🚫 Kamu telah diblokir permanen dari forum karena 5x pelanggaran bahasa kasar. Untuk appeal, hubungi YTConv CS Bot dan ketik 'saya mau appeal'."
        });
        // Broadcast moderation event to room (anonymous)
        io.to(`forum:${room}`).emit("forum:modNotice", { message: "Seorang pengguna telah diblokir oleh sistem moderasi otomatis." });
      } else {
        userViolations.set(userId, rec);
        socket.emit("forum:modAction", {
          type: "warning",
          count: rec.count,
          message: `⚠️ Peringatan ${rec.count}/5: Pesan kamu mengandung kata tidak sopan dan telah dihapus. (${remaining} peringatan lagi sebelum diblokir)`
        });
      }
      return; // don't broadcast
    }

    // Broadcast clean message to room
    io.to(`forum:${room}`).emit("forum:chatMessage", {
      userId,
      name: from.name,
      text,
      at: Date.now()
    });
  });

  socket.on("forum:appeal", async (payload) => {
    const from = socketState.get(socket.id);
    if (!from) return;
    const rec = userViolations.get(from.userId);
    if (rec?.banned) {
      const appeal = await submitForumAppeal({
        source: "forum_socket",
        userId: from.userId,
        name: from.name,
        room: from.room || "umum",
        reason: String(payload?.reason || "Appeal via forum socket"),
        socketId: socket.id,
        metadata: {
          bannedByServer: true,
          violationCount: Number(rec?.count || 0),
        },
      });
      socket.emit("forum:appealSubmitted", {
        appealId: appeal.appealId,
        message: `✅ Appeal kamu (${appeal.appealId}) telah diterima! Tim akan mereview dalam 2x24 jam. Notifikasi juga dikirim ke ${SUPPORT_CONTACT_EMAIL}.`
      });
    }
  });

  socket.on("forum:join", (payload) => {
    const room = String(payload?.room || "umum");
    const userId = String(payload?.userId || socket.id);
    const name = String(payload?.name || "Warga");
    const prev = socketState.get(socket.id);
    if (prev?.room && prev.room !== room) {
      try {
        socket.leave(`forum:${prev.room}`);
      } catch { }
      const prevRoomMap = getOrCreateRoomMap(prev.room);
      prevRoomMap.delete(prev.userId);
      broadcastRoomUsers(prev.room);
    }

    socket.join(`forum:${room}`);
    socketState.set(socket.id, { room, userId, name });
    const active = activeUsers.get(socket.id);
    if (active) {
      active.room = room;
      active.lastSeenAt = new Date().toISOString();
      activeUsers.set(socket.id, active);
    }
    const map = getOrCreateRoomMap(room);
    map.set(userId, { userId, name, socketId: socket.id });
    broadcastRoomUsers(room);
    emitDashboardStats();
  });

  socket.on("forum:leave", () => {
    const prev = socketState.get(socket.id);
    if (!prev) return;
    try {
      socket.leave(`forum:${prev.room}`);
    } catch { }
    const map = getOrCreateRoomMap(prev.room);
    map.delete(prev.userId);
    socketState.delete(socket.id);
    const active = activeUsers.get(socket.id);
    if (active) {
      active.room = null;
      active.lastSeenAt = new Date().toISOString();
      activeUsers.set(socket.id, active);
    }
    broadcastRoomUsers(prev.room);
    emitDashboardStats();
  });

  socket.on("call:offer", (payload) => {
    const from = socketState.get(socket.id);
    if (!from) return;
    const room = String(payload?.room || from.room || "umum");
    const toUserId = String(payload?.toUserId || "");
    const offer = payload?.offer;
    const callId = String(payload?.callId || "");
    if (!toUserId || !offer || !callId) return;
    const map = getOrCreateRoomMap(room);
    const target = map.get(toUserId);
    if (!target?.socketId) return;
    io.to(target.socketId).emit("call:offer", {
      room,
      callId,
      fromUserId: from.userId,
      fromName: from.name,
      offer,
    });
  });

  socket.on("call:answer", (payload) => {
    const from = socketState.get(socket.id);
    if (!from) return;
    const room = String(payload?.room || from.room || "umum");
    const toUserId = String(payload?.toUserId || "");
    const answer = payload?.answer;
    const callId = String(payload?.callId || "");
    if (!toUserId || !answer || !callId) return;
    const map = getOrCreateRoomMap(room);
    const target = map.get(toUserId);
    if (!target?.socketId) return;
    io.to(target.socketId).emit("call:answer", {
      room,
      callId,
      fromUserId: from.userId,
      answer,
    });
  });

  socket.on("call:ice", (payload) => {
    const from = socketState.get(socket.id);
    if (!from) return;
    const room = String(payload?.room || from.room || "umum");
    const toUserId = String(payload?.toUserId || "");
    const candidate = payload?.candidate;
    const callId = String(payload?.callId || "");
    if (!toUserId || !candidate || !callId) return;
    const map = getOrCreateRoomMap(room);
    const target = map.get(toUserId);
    if (!target?.socketId) return;
    io.to(target.socketId).emit("call:ice", {
      room,
      callId,
      fromUserId: from.userId,
      candidate,
    });
  });

  socket.on("call:end", (payload) => {
    const from = socketState.get(socket.id);
    if (!from) return;
    const room = String(payload?.room || from.room || "umum");
    const toUserId = String(payload?.toUserId || "");
    const callId = String(payload?.callId || "");
    if (!toUserId || !callId) return;
    const map = getOrCreateRoomMap(room);
    const target = map.get(toUserId);
    if (target?.socketId) {
      io.to(target.socketId).emit("call:end", {
        room,
        callId,
        fromUserId: from.userId,
      });
    }
  });

  socket.on("disconnect", () => {
    const prev = socketState.get(socket.id);
    if (prev) {
      const map = getOrCreateRoomMap(prev.room);
      map.delete(prev.userId);
      socketState.delete(socket.id);
      broadcastRoomUsers(prev.room);
    }
    activeUsers.delete(socket.id);
    pushActivityLog("user_disconnected", `Socket ${socket.id} disconnected`, { socketId: socket.id });
    emitDashboardStats();
  });
});

const server = httpServer.listen(PORT, HOST, () => {
  console.log(`Server jalan di ${HOST}:${PORT}`);
  
  // 💥 Auto Maintenance: Keep yt-dlp up-to-date
  const autoUpdate = () => {
    console.log("[Auto-Maintenance] Checking for yt-dlp updates...");
    const updateProc = spawn("yt-dlp", ["-U"]);
    updateProc.on('close', (code) => {
        console.log(`[Auto-Maintenance] yt-dlp update finished with code ${code}`);
    });
  };
  
  // Run once immediately on startup, then every 24 hours
  setTimeout(autoUpdate, 5000); 
  setInterval(autoUpdate, 24 * 60 * 60 * 1000);
});

export {
  app,
  server,
  io,
  buildAssistantResponse,
  sanitizeFormatOptions,
  FORMAT_RULES,
  buildVideoFormatSelector,
  initProgress,
  updateProgress,
  finishProgress,
  clearProgress,
  resolveToolVersions,
  createSessionToken,
};
