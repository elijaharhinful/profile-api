import { Router } from "express";
import {
  getAuthConfig,
  initiateWebOAuth,
  handleWebCallback,
  handleCliExchange,
  refreshToken,
  logout,
  getMe,
  getCsrfToken,
} from "../controllers/authController";
import { authenticate } from "../middleware/auth.middleware";
import { authLimiter } from "../middleware/rateLimiter.middleware";

const router = Router();

// Public
router.get("/config", getAuthConfig);
router.get("/csrf-token", getCsrfToken);

// GitHub OAuth — Web
router.get("/github", authLimiter, initiateWebOAuth);
router.get("/github/callback", handleWebCallback);

// GitHub OAuth — CLI
router.post("/cli/exchange", authLimiter, handleCliExchange);

// Token management
router.post("/refresh", authLimiter, refreshToken);
router.post("/logout", authenticate, logout);

// Authenticated user info
router.get("/me", authenticate, getMe);

export default router;
