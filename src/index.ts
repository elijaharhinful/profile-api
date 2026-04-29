import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

import profileRoutes from "./routes/profiles";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import { errorHandler, notFound } from "./middleware/errorHandler";
import { issueCsrfToken } from "./middleware/csrf.middleware";
import { requestLogger } from "./middleware/requestLogger.middleware";
import { prisma } from "./lib/prisma";
import { config } from "./config/env";

dotenv.config();

const app = express();
const PORT = config.port;

app.set("trust proxy", 1);

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-API-Version",
      "X-CSRF-Token",
    ],
    exposedHeaders: ["Set-Cookie"],
  }),
);

app.use(express.json());
app.use(cookieParser());

app.use(issueCsrfToken);

app.use(requestLogger);

app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "Insighta Labs+ API", version: "1" });
});

app.use("/auth", authRoutes);
app.use("/api/profiles", profileRoutes);
app.use("/api/users", userRoutes);

app.use(notFound);
app.use(errorHandler);

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
