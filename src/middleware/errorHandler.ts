import { Request, Response, NextFunction } from "express";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error(err);

  if (err.name === "MulterError" || (err as any).code?.startsWith("LIMIT_")) {
    let message = err.message;
    const code = (err as any).code;

    if (code === "LIMIT_UNEXPECTED_FILE" || message === "Unexpected field") {
      message = "You can only upload one file at a time using the 'file' field.";
    } else if (code === "LIMIT_FILE_SIZE") {
      message = "File is too large. Maximum size allowed is 50MB.";
    }

    res.status(400).json({ status: "error", message });
    return;
  }

  res.status(500).json({ status: "error", message: "Internal server error" });
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ status: "error", message: "Route not found" });
}
