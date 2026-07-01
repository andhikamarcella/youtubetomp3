export const extractTurnstileToken = (req) => req.body?.turnstileToken || req.body?.captchaToken || req.body?.cfTurnstileResponse || req.get("cf-turnstile-response") || req.get("x-turnstile-token") || "";

export const verifyTurnstile = async ({ token, remoteIp, secretKey, strict = false, timeoutMs = 7000, fetchImpl = fetch } = {}) => {
  const trimmed = typeof token === "string" ? token.trim() : "";
  if (!secretKey) {
    if (strict) return { ok: false, error: "turnstile_required", status: 400 };
    return { ok: true, bypassed: true, reason: "missing_secret" };
  }
  if (!trimmed) {
    if (strict) return { ok: false, error: "turnstile_required", status: 400 };
    return { ok: true, bypassed: true, reason: "missing_token" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, Number(timeoutMs) || 7000));
  timer.unref?.();
  try {
    const params = new URLSearchParams({ secret: secretKey, response: trimmed });
    if (remoteIp) params.set("remoteip", remoteIp);
    const response = await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!data?.success) return { ok: false, error: "turnstile_failed", status: 400, codes: data?.["error-codes"] || [] };
    return { ok: true, data };
  } catch (err) {
    return { ok: !strict, error: "turnstile_timeout", status: strict ? 408 : 200, bypassed: !strict, cause: err?.name || err?.message };
  } finally {
    clearTimeout(timer);
  }
};

export const createTurnstileMiddleware = (env, { routes = env.TURNSTILE_REQUIRED_ROUTES || [] } = {}) => async (req, res, next) => {
  if (!routes.includes(req.path)) return next();
  const result = await verifyTurnstile({ token: extractTurnstileToken(req), remoteIp: req.ip, secretKey: env.TURNSTILE_SECRET_KEY, strict: env.TURNSTILE_STRICT, timeoutMs: env.TURNSTILE_TIMEOUT_MS });
  if (!result.ok) return res.status(result.status || 400).json({ ok: false, error: result.error, message: result.error === "turnstile_required" ? "Verifikasi anti-bot diperlukan." : "Verifikasi anti-bot gagal." });
  return next();
};
