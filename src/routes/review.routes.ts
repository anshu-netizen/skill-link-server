import express from "express";
import {
  createReview,
  getProviderReviews,
  getMyReviewableBookings,
} from "../controllers/review.controller";
import { protect } from "../middleware/auth.middleware";

const router = express.Router();

router.post("/", protect, createReview);
router.get("/provider/:providerId", getProviderReviews);
router.get("/my-reviewable-bookings", protect, getMyReviewableBookings);

export default router;