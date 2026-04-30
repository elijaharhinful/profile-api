import rateLimit from "express-rate-limit";
import { Request } from "express";

// Normalize IPv6-mapped IPv4 addresses (e.g. ::ffff:1.2.3.4 -> 1.2.3.4)
// and handle proxy forwarded IPs correctly
function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  let ip: string;
  if (forwarded) {
    ip = (typeof forwarded === "string" ? forwarded : forwarded[0])
      .split(",")[0]
      .trim();
  } else {
    ip = req.ip ?? req.socket?.remoteAddress ?? "unknown";
  }
  // Strip IPv6 prefix
  return ip.replace(/^::ffff:/, "");
}

// 10 req/min for auth endpoints (IP-based)
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIp,
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
  keyGenerator: getClientIp,
  message: {
    status: "error",
    message: "Too many requests, please try again later",
  },
});

export const exchangeCodeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getClientIp,
  message: {
    status: "error",
    message: "Too many requests, please try again later",
  },
});
