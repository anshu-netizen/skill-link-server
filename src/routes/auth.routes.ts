import express from "express";
import {
  registerUser,
  loginUser,
  getMe,
  verifyEmail,
  resendVerificationEmail,
  testEmail,
} from "../controllers/auth.controller";
import { protect } from "../middleware/auth.middleware";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/verify-email", verifyEmail);
router.post("/resend-verification-email", resendVerificationEmail);
router.get("/test-email", testEmail);
router.get("/me", protect, getMe);

export default router;