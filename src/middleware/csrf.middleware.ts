import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

const CSRF_HEADER = "x-csrf-token";
const CSRF_COOKIE = "csrf_token";

export function issueCsrfToken(req: Request, res: Response, next: NextFunction) {
  if (!req.cookies?.[CSRF_COOKIE]) {
    const token = crypto.randomBytes(32).toString("hex");
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false, // readable by JS so the web portal can attach it to headers
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });
  }
  next();
}

export function verifyCsrfToken(req: Request, res: Response, next: NextFunction) {
  const safeMethods = ["GET", "HEAD", "OPTIONS"];
  if (safeMethods.includes(req.method)) return next();

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER];

  if (!cookieToken || cookieToken !== headerToken) {
    return res.status(403).json({ status: "error", message: "CSRF token mismatch" });
  }
  next();
}