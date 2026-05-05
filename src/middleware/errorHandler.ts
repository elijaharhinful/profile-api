import { Request, Response, NextFunction } from "express";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error(err);

  if (err.name === "MulterError") {
    res.status(400).json({ status: "error", message: err.message });
    return;
  }

  res.status(500).json({ status: "error", message: "Internal server error" });
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ status: "error", message: "Route not found" });
}
