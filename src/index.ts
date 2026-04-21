import express from "express";
import cors from "cors";
import profileRoutes from "./routes/profiles";
import { errorHandler, notFound } from "./middleware/errorHandler";
import dotenv from "dotenv";
import { prisma } from "./lib/prisma";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: "*" }));
app.use(express.json());

// Ensure CORS header is always present (even on errors)
app.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});

// Routes
app.use("/api/profiles", profileRoutes);

app.get("/", (_req, res) => {
  res.send("Welcome to the Profile API");
});

// 404 and error handlers
app.use(notFound);
app.use(errorHandler);

// Connect to Postgres then start server
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
