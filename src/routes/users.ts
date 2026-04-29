import { Router } from "express";
import { getMe } from "../controllers/authController";
import { authenticate } from "../middleware/auth.middleware";
import { apiLimiter } from "../middleware/rateLimiter.middleware";

const router = Router();

router.get("/me", authenticate, apiLimiter, getMe);

export default router;
