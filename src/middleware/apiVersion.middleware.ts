import { Request, Response, NextFunction } from "express";

export function requireApiVersion(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const version = req.headers["x-api-version"];
  if (!version) {
    res
      .status(400)
      .json({ status: "error", message: "API version header required" });
    return;
  }
  next();
}
