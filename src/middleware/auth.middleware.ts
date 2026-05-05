import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { hashToken } from "../lib/crypto";
import { cacheGet, cacheSet } from "../lib/redis";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: string;
  };
  sessionId?: string;
}

export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // Web portal: read from HTTP-only cookie
    let token = req.cookies?.access_token;

    // CLI / API: read from Authorization header
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.slice(7);
      }
    }

    if (!token) {
      res.status(401).json({ status: "error", message: "Authentication required" });
      return;
    }

    const hashedToken = hashToken(token);
    const cacheKey = `session:${hashedToken}`;

    const cachedSession = await cacheGet(cacheKey);
    let sessionData;

    if (cachedSession) {
      sessionData = JSON.parse(cachedSession);
    } else {
      const session = await prisma.session.findUnique({
        where: { access_token: hashedToken },
        include: { user: true },
      });

      if (!session) {
        res.status(401).json({ status: "error", message: "Invalid token" });
        return;
      }

      if (session.revoked_at) {
        res.status(401).json({ status: "error", message: "Session revoked" });
        return;
      }

      if (session.access_expiry < new Date()) {
        res.status(401).json({ status: "error", message: "Token expired" });
        return;
      }

      if (!session.user.is_active) {
        res.status(403).json({ status: "error", message: "Account is inactive" });
        return;
      }

      sessionData = {
        sessionId: session.id,
        user: {
          id: session.user.id,
          username: session.user.username,
          role: session.user.role,
        },
      };

      // Cache the valid session for 5 minutes (300 seconds)
      cacheSet(cacheKey, JSON.stringify(sessionData), 300).catch(() => null);
    }

    req.user = sessionData.user;
    req.sessionId = sessionData.sessionId;

    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ status: "error", message: "Authentication required" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ status: "error", message: "Insufficient permissions" });
      return;
    }
    next();
  };
}