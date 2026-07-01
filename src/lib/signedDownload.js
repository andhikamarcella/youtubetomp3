import { createHmac, timingSafeEqual } from "node:crypto";
import { basename, resolve, sep } from "node:path";

const b64url = (value) => Buffer.from(value).toString("base64url");
const sign = (payload, secret) => createHmac("sha256", secret).update(payload).digest("base64url");

export const createSignedDownloadToken = ({ file, secret, ttlSeconds = 1800, now = Date.now() }) => {
  if (!secret) throw new Error("download_token_secret_missing");
  const payload = JSON.stringify({ file: basename(file), exp: Math.floor(now / 1000) + Math.max(60, Number(ttlSeconds) || 1800) });
  const encoded = b64url(payload);
  return `${encoded}.${sign(encoded, secret)}`;
};

export const verifySignedDownloadToken = ({ token, secret, now = Date.now() }) => {
  if (!secret) throw new Error("download_token_secret_missing");
  const [encoded, mac] = String(token || "").split(".");
  if (!encoded || !mac) throw new Error("download_token_invalid");
  const expected = sign(encoded, secret);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("download_token_invalid");
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  if (!payload?.file || payload.exp < Math.floor(now / 1000)) throw new Error("download_token_expired");
  return { file: basename(payload.file), exp: payload.exp };
};

export const safeResolveDownloadPath = (rootDir, file) => {
  const root = resolve(rootDir);
  const target = resolve(root, basename(file));
  if (target !== root && target.startsWith(root + sep)) return target;
  throw new Error("download_path_invalid");
};
