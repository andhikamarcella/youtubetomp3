const buckets = new Map();

export const createRateLimiter = ({ windowMs = 60_000, max = 60, name = "global", enabled = true, keyGenerator } = {}) => {
  const safeWindow = Math.max(1000, Number(windowMs) || 60_000);
  const safeMax = Math.max(1, Number(max) || 60);
  return (req, res, next) => {
    if (!enabled) return next();
    const now = Date.now();
    const principal = keyGenerator ? keyGenerator(req) : (req.user?.id || req.ip || req.socket?.remoteAddress || "unknown");
    const key = `${name}:${principal}`;
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + safeWindow };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    res.setHeader("RateLimit-Limit", String(safeMax));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, safeMax - bucket.count)));
    res.setHeader("RateLimit-Reset", String(retryAfter));
    if (bucket.count > safeMax) {
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({ ok: false, error: "rate_limited", message: "Terlalu banyak permintaan. Coba lagi sebentar lagi.", retryAfter });
    }
    return next();
  };
};

export const clearRateLimitBuckets = () => buckets.clear();
