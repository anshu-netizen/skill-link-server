import express from "express";
import {
  getAllProviders,
  getProviderById,
  getMyProfile,
  updateMyProfile,
  getMyWorkingHours,
  updateMyWorkingHours,
} from "../controllers/user.controller";
import { protect } from "../middleware/auth.middleware";
import upload from "../middleware/upload.middleware";

const router = express.Router();

router.get("/providers", getAllProviders);
router.get("/providers/:id", getProviderById);

router.get("/me", protect, getMyProfile);
router.put("/me", protect, upload.single("profileImage"), updateMyProfile);

router.get("/me/working-hours", protect, getMyWorkingHours);
router.put("/me/working-hours", protect, updateMyWorkingHours);

export default router;