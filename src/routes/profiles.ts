import { Router } from "express";
import {
  createProfile,
  getProfile,
  getAllProfiles,
  deleteProfile,
} from "../controllers/profileController";

const router = Router();

router.post("/", createProfile);
router.get("/", getAllProfiles);
router.get("/:id", getProfile);
router.delete("/:id", deleteProfile);

export default router;
