import { Router } from "express";
import {
  createProfile,
  getProfile,
  getAllProfiles,
  deleteProfile,
  searchProfiles,
} from "../controllers/profileController";

const router = Router();

router.post("/", createProfile);
router.get("/search", searchProfiles);
router.get("/", getAllProfiles);
router.get("/:id", getProfile);
router.delete("/:id", deleteProfile);

export default router;
