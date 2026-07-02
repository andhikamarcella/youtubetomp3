import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

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

export const isSupportedMediaHostname = (hostname = "") => /(^|\.)(youtube\.com|youtu\.be|music\.youtube\.com|soundcloud\.com|spotify\.com)$/i.test(String(hostname || ""));

export const validatePublicMediaUrl = (value, env = process.env) => {
  const raw = String(value || "").trim();
  const maxLen = Number(env.MAX_URL_LENGTH || 2048);
  if (!raw || raw.length > maxLen) return { ok: false, error: "invalid_url" };
  let url;
  try { url = new URL(raw); } catch { return { ok: false, error: "invalid_url" }; }
  if (env.BLOCK_FILE_PROTOCOL !== "false" && url.protocol === "file:") return { ok: false, error: "file_protocol_blocked" };
  if (url.protocol !== "https:") return { ok: false, error: "protocol_blocked" };
  if (env.BLOCK_LOCALHOST_URLS !== "false" && isPrivateHostname(url.hostname)) return { ok: false, error: "private_url_blocked" };
  if (!isSupportedMediaHostname(url.hostname)) return { ok: false, error: "unsupported_domain" };
  return { ok: true, url };
};

export const resolvePublicHostname = async (hostname, env = process.env) => {
  const host = String(hostname || "").trim().toLowerCase();
  if (!host) return { ok: false, error: "invalid_hostname" };
  if (env.BLOCK_LOCALHOST_URLS !== "false" && isPrivateHostname(host)) return { ok: false, error: "private_url_blocked" };
  if (isIP(host)) return { ok: true, addresses: [host] };
  let records;
  try {
    records = await lookup(host, { all: true, verbatim: true });
  } catch {
    return { ok: false, error: "dns_lookup_failed" };
  }
  const addresses = records.map((record) => String(record.address || "")).filter(Boolean);
  if (!addresses.length) return { ok: false, error: "dns_lookup_failed" };
  if (env.BLOCK_PRIVATE_IP_URLS !== "false" && addresses.some((address) => isPrivateHostname(address))) {
    return { ok: false, error: "private_url_blocked" };
  }
  return { ok: true, addresses };
};

export const validatePublicMediaUrlDeep = async (value, env = process.env) => {
  const base = validatePublicMediaUrl(value, env);
  if (!base.ok) return base;
  const resolved = await resolvePublicHostname(base.url.hostname, env);
  if (!resolved.ok) return { ok: false, error: resolved.error };
  return { ...base, addresses: resolved.addresses };
};
