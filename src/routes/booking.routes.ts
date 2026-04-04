import express from "express";
import {
  createBooking,
  getMyBookings,
  getProviderBookings,
  getBookingById,
  updateBookingStatus,
  getProviderAvailableSlots,
} from "../controllers/booking.controller";
import { protect } from "../middleware/auth.middleware";

const router = express.Router();

router.post("/", protect, createBooking);
router.get("/my-bookings", protect, getMyBookings);
router.get("/provider-bookings", protect, getProviderBookings);
router.get("/:bookingId", protect, getBookingById);
router.patch("/:bookingId/status", protect, updateBookingStatus);
router.get("/provider-slots/:providerId", getProviderAvailableSlots);

export default router;