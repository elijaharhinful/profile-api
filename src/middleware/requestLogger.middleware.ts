import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";

interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

export function requestLogger(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on("finish", () => {
    const duration_ms = Date.now() - start;
    const user_id = req.user?.id ?? null;

    prisma.requestLog
      .create({
        data: {
          method: req.method,
          path: req.path,
          status_code: res.statusCode,
          ip: req.ip ?? null,
          user_agent: req.headers["user-agent"] ?? null,
          duration_ms,
          ...(user_id ? { user: { connect: { id: user_id } } } : {}),
        },
      })
      .catch(() => {
        // silent — logging must never crash the app
      });
  });

  next();
}
