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

const router = express.Router();

router.get("/providers", getAllProviders);
router.get("/providers/:id", getProviderById);

router.get("/me", protect, getMyProfile);
router.put("/me", protect, updateMyProfile);

router.get("/me/working-hours", protect, getMyWorkingHours);
router.put("/me/working-hours", protect, updateMyWorkingHours);

export default router;  