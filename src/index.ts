import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

import profileRoutes from "./routes/profiles";
import authRoutes from "./routes/auth";
import { errorHandler, notFound } from "./middleware/errorHandler";
import { issueCsrfToken } from "./middleware/csrf.middleware";
import { requestLogger } from "./middleware/requestLogger.middleware";
import { prisma } from "./lib/prisma";
import { config } from "./config/env";

dotenv.config();

const app = express();
const PORT = config.port;

// ─── CORS ──────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: [config.frontendUrl],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-API-Version", "X-CSRF-Token"],
  })
);

// ─── Body + cookies ────────────────────────────────────────────────────────
app.use(express.json());
app.use(cookieParser());

// ─── CSRF token issuance (for web clients) ─────────────────────────────────
app.use(issueCsrfToken);

// ─── Request logging ───────────────────────────────────────────────────────
app.use(requestLogger);

// ─── Health check ──────────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "Insighta Labs+ API", version: "1" });
});

// ─── Routes ────────────────────────────────────────────────────────────────
app.use("/auth", authRoutes);
app.use("/api/profiles", profileRoutes);

// ─── Error handlers ────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Start ─────────────────────────────────────────────────────────────────
prisma
  .$connect()
  .then(() => {
    console.log("Connected to PostgreSQL via Prisma");
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err: unknown) => {
    console.error("Database connection error:", err);
    process.exit(1);
  });

export default app;
