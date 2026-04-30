import { Router } from "express";
import {
  createProfile,
  getProfile,
  getAllProfiles,
  deleteProfile,
  searchProfiles,
  exportProfiles,
} from "../controllers/profileController";
import { authenticate, requireRole } from "../middleware/auth.middleware";
import { requireApiVersion } from "../middleware/apiVersion.middleware";
import { apiLimiter } from "../middleware/rateLimiter.middleware";

const router = Router();

// All profile routes require API version header, then auth + rate limit
router.use(requireApiVersion, authenticate, apiLimiter);

// Admin-only mutations
router.post("/", requireRole("admin"), createProfile);
router.delete("/:id", requireRole("admin"), deleteProfile);

// Read endpoints — both roles
router.get("/export", exportProfiles);
router.get("/search", searchProfiles);
router.get("/", getAllProfiles);
router.get("/:id", getProfile);

export default router;
