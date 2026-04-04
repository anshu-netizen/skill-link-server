import { Request, Response } from "express";
import Booking from "../models/Booking.model";
import User from "../models/User.model";

const ACTIVE_BOOKING_STATUSES = ["pending", "accepted", "in_progress"];
const BUFFER_MS = 60 * 60 * 1000; // 1 hour
const SLOT_STEP_MINUTES = 30;

const formatDateTimeLocal = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// CREATE BOOKING (job seeker only)
export const createBooking = async (req: Request, res: Response) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not authorized",
      });
    }

    if (user.role !== "jobSeeker") {
      return res.status(403).json({
        success: false,
        message: "Only job seekers can create bookings",
      });
    }

    const {
      providerId,
      serviceTitle,
      description,
      bookingDate,
      durationMinutes,
      address,
      city,
      phone,
      price,
      notes,
      lat,
      lng,
    } = req.body;

    if (
      !providerId ||
      !serviceTitle ||
      !bookingDate ||
      !durationMinutes ||
      !address ||
      !city ||
      !phone ||
      price === undefined ||
      lat === undefined ||
      lng === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          "providerId, serviceTitle, bookingDate, durationMinutes, address, city, phone, price, lat, and lng are required",
      });
    }

    const provider = await User.findById(providerId);

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: "Provider not found",
      });
    }

    if (provider.role !== "jobProvider") {
      return res.status(400).json({
        success: false,
        message: "Selected user is not a provider",
      });
    }

    const startTime = new Date(bookingDate);

    if (isNaN(startTime.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking date",
      });
    }

    const duration = Number(durationMinutes);

    if (!Number.isFinite(duration) || duration < 30) {
      return res.status(400).json({
        success: false,
        message: "Minimum booking duration is 30 minutes",
      });
    }

    const now = new Date();

    if (startTime.getTime() <= now.getTime()) {
      return res.status(400).json({
        success: false,
        message: "You cannot book a service in the past",
      });
    }

    const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

    const requestedBlockedStart = new Date(startTime.getTime() - BUFFER_MS);
    const requestedBlockedEnd = new Date(endTime.getTime() + BUFFER_MS);

    const conflictingBooking = await Booking.findOne({
      provider: providerId,
      status: { $in: ACTIVE_BOOKING_STATUSES },
      bookingDate: { $lt: requestedBlockedEnd },
      endTime: { $gt: requestedBlockedStart },
    });

    if (conflictingBooking) {
      return res.status(400).json({
        success: false,
        message:
          "This provider is not available at the selected time. Please choose another slot.",
      });
    }

    const booking = await Booking.create({
      seeker: user._id,
      provider: providerId,
      serviceTitle,
      description: description || "",
      bookingDate: startTime,
      endTime,
      durationMinutes: duration,
      address,
      city,
      phone,
      price: Number(price),
      lat: Number(lat),
      lng: Number(lng),
      status: "pending",
      notes: notes || "",
    });

    const populatedBooking = await Booking.findById(booking._id)
      .populate("seeker", "fullName email phone city")
      .populate(
        "provider",
        "fullName email phone city skills experienceLevel workingHours availability companyName companyDescription bio profileImage"
      );

    return res.status(201).json({
      success: true,
      message: "Booking created successfully",
      booking: populatedBooking,
    });
  } catch (error) {
    console.error("CREATE BOOKING ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while creating booking",
    });
  }
};

// GET BOOKINGS CREATED BY LOGGED-IN SEEKER
export const getMyBookings = async (req: Request, res: Response) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not authorized",
      });
    }

    if (user.role !== "jobSeeker") {
      return res.status(403).json({
        success: false,
        message: "Only job seekers can view their bookings",
      });
    }

    const bookings = await Booking.find({ seeker: user._id })
      .populate(
        "provider",
        "fullName email phone city skills experienceLevel workingHours availability companyName companyDescription bio profileImage"
      )
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    console.error("GET MY BOOKINGS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching seeker bookings",
    });
  }
};

// GET BOOKINGS RECEIVED BY LOGGED-IN PROVIDER
export const getProviderBookings = async (req: Request, res: Response) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not authorized",
      });
    }

    if (user.role !== "jobProvider") {
      return res.status(403).json({
        success: false,
        message: "Only providers can view provider bookings",
      });
    }

    const bookings = await Booking.find({ provider: user._id })
      .populate("seeker", "fullName email phone city")
      .populate(
        "provider",
        "fullName email phone city skills experienceLevel workingHours availability companyName companyDescription bio profileImage"
      )
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    console.error("GET PROVIDER BOOKINGS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching provider bookings",
    });
  }
};

// GET SINGLE BOOKING BY ID
export const getBookingById = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    const { bookingId } = req.params;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not authorized",
      });
    }

    const booking = await Booking.findById(bookingId)
      .populate("seeker", "fullName email phone city address")
      .populate(
        "provider",
        "fullName email phone city address skills experienceLevel experienceYears workingHours availability companyName companyDescription bio profileImage isVerified isActive"
      );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    const isSeeker = String(booking.seeker?._id || booking.seeker) === String(user._id);
    const isProvider =
      String(booking.provider?._id || booking.provider) === String(user._id);

    if (!isSeeker && !isProvider) {
      return res.status(403).json({
        success: false,
        message: "You can only view your own booking",
      });
    }

    return res.status(200).json({
      success: true,
      booking,
    });
  } catch (error) {
    console.error("GET BOOKING BY ID ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching booking",
    });
  }
};

// PROVIDER UPDATES BOOKING STATUS
export const updateBookingStatus = async (req: Request, res: Response) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not authorized",
      });
    }

    if (user.role !== "jobProvider") {
      return res.status(403).json({
        success: false,
        message: "Only providers can update booking status",
      });
    }

    const { bookingId } = req.params;
    const { status } = req.body;

    const allowedStatuses = [
      "accepted",
      "rejected",
      "in_progress",
      "completed",
      "cancelled",
    ];

    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message:
          "Valid status is required: accepted, rejected, in_progress, completed, cancelled",
      });
    }

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (String(booking.provider) !== String(user._id)) {
      return res.status(403).json({
        success: false,
        message: "You can only update your own bookings",
      });
    }

    booking.status = status;
    await booking.save();

    const updatedBooking = await Booking.findById(booking._id)
      .populate("seeker", "fullName email phone city")
      .populate(
        "provider",
        "fullName email phone city skills experienceLevel workingHours availability companyName companyDescription bio profileImage"
      );

    return res.status(200).json({
      success: true,
      message: "Booking status updated successfully",
      booking: updatedBooking,
    });
  } catch (error) {
    console.error("UPDATE BOOKING STATUS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating booking status",
    });
  }
};

// GET AVAILABLE SLOTS FOR A PROVIDER ON A SELECTED DATE
export const getProviderAvailableSlots = async (req: Request, res: Response) => {
  try {
    const { providerId } = req.params;
    const { date, durationMinutes } = req.query;

    if (!providerId) {
      return res.status(400).json({
        success: false,
        message: "Provider id is required",
      });
    }

    if (!date || !durationMinutes) {
      return res.status(400).json({
        success: false,
        message: "date and durationMinutes are required",
      });
    }

    const provider = await User.findById(providerId);

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: "Provider not found",
      });
    }

    if (provider.role !== "jobProvider") {
      return res.status(400).json({
        success: false,
        message: "Selected user is not a provider",
      });
    }

    const workStartHour = provider.workingHours?.startHour ?? 9;
    const workEndHour = provider.workingHours?.endHour ?? 18;

    const duration = Number(durationMinutes);

    if (!Number.isFinite(duration) || duration < 30) {
      return res.status(400).json({
        success: false,
        message: "Minimum booking duration is 30 minutes",
      });
    }

    const selectedDate = String(date);
    const dayStart = new Date(`${selectedDate}T00:00:00`);
    const dayEnd = new Date(`${selectedDate}T23:59:59.999`);

    if (isNaN(dayStart.getTime()) || isNaN(dayEnd.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date",
      });
    }

    const existingBookings = await Booking.find({
      provider: providerId,
      status: { $in: ACTIVE_BOOKING_STATUSES },
      bookingDate: { $lte: dayEnd },
      endTime: { $gte: dayStart },
    }).sort({ bookingDate: 1 });

    const now = new Date();
    const slots: string[] = [];

    for (
      let totalMinutes = workStartHour * 60;
      totalMinutes < workEndHour * 60;
      totalMinutes += SLOT_STEP_MINUTES
    ) {
      const slotStart = new Date(dayStart);
      slotStart.setHours(0, totalMinutes, 0, 0);

      const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000);

      const workDayEnd = new Date(dayStart);
      workDayEnd.setHours(workEndHour, 0, 0, 0);

      if (slotEnd.getTime() > workDayEnd.getTime()) {
        continue;
      }

      if (slotStart.getTime() <= now.getTime()) {
        continue;
      }

      const requestedBlockedStart = new Date(slotStart.getTime() - BUFFER_MS);
      const requestedBlockedEnd = new Date(slotEnd.getTime() + BUFFER_MS);

      const hasConflict = existingBookings.some((booking) => {
        const existingStart = new Date(booking.bookingDate);
        const existingEnd = new Date(booking.endTime);

        return (
          existingStart.getTime() < requestedBlockedEnd.getTime() &&
          existingEnd.getTime() > requestedBlockedStart.getTime()
        );
      });

      if (!hasConflict) {
        slots.push(formatDateTimeLocal(slotStart));
      }
    }

    return res.status(200).json({
      success: true,
      slots,
    });
  } catch (error) {
    console.error("GET AVAILABLE SLOTS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching available slots",
    });
  }
};