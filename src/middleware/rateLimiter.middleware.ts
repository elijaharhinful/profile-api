import rateLimit, { ipKeyGenerator } from "express-rate-limit";

// 10 req/min for auth endpoints (IP-based)
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many requests, please try again later",
  },
});

// 60 req/min per authenticated user (fall back to IP)
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many requests, please try again later",
  },
  keyGenerator: (req) => {
    const r = req as unknown as { user?: { id: string } };
    if (r.user?.id) return r.user.id;

    const ip = req.ip ?? req.socket?.remoteAddress ?? "unknown";
    return ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  },
  validate: { xForwardedForHeader: false },
});

export const exchangeCodeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many requests, please try again later",
  },
});
