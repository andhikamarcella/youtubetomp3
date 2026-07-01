import { isIP } from "node:net";

const privateRanges = [
  /^10\./, /^127\./, /^0\./, /^169\.254\./, /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./, /^::1$/, /^fc/i, /^fd/i, /^fe80:/i,
];

export const isPrivateHostname = (hostname = "") => {
  const host = String(hostname).toLowerCase();
  if (["localhost", "0.0.0.0"].includes(host)) return true;
  if (isIP(host)) return privateRanges.some((re) => re.test(host));
  return false;
};

export const validatePublicMediaUrl = (value, env = process.env) => {
  const raw = String(value || "").trim();
  const maxLen = Number(env.MAX_URL_LENGTH || 2048);
  if (!raw || raw.length > maxLen) return { ok: false, error: "invalid_url" };
  let url;
  try { url = new URL(raw); } catch { return { ok: false, error: "invalid_url" }; }
  if (env.BLOCK_FILE_PROTOCOL !== "false" && url.protocol === "file:") return { ok: false, error: "file_protocol_blocked" };
  if (!["http:", "https:"].includes(url.protocol)) return { ok: false, error: "protocol_blocked" };
  if (env.BLOCK_LOCALHOST_URLS !== "false" && isPrivateHostname(url.hostname)) return { ok: false, error: "private_url_blocked" };
  const supported = /(^|\.)(youtube\.com|youtu\.be|music\.youtube\.com|soundcloud\.com|spotify\.com)$/i.test(url.hostname);
  if (!supported) return { ok: false, error: "unsupported_domain" };
  return { ok: true, url };
};
