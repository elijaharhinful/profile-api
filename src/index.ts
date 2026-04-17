import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import profileRoutes from "./routes/profiles";
import { errorHandler, notFound } from "./middleware/errorHandler";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/profile-api";

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

// 404 and error handlers
app.use(notFound);
app.use(errorHandler);

// Connect to MongoDB then start server
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB");
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err: unknown) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

export default app;
