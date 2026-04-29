import rateLimit from "express-rate-limit";

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
  keyGenerator: (req, res) => {
    const r = req as unknown as { user?: { id: string } };
    return r.user?.id ?? req.ip ?? "unknown";
  },
});
