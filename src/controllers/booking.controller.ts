import { Request, Response } from "express";
import Booking from "../models/Booking.model";
import User from "../models/User.model";
import sendEmail from "../utils/sendEmail";

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

const formatEmailDate = (dateValue: Date | string) => {
  return new Date(dateValue).toLocaleString();
};

const sendBookingEmailSafely = async ({
  to,
  subject,
  html,
}: {
  to?: string;
  subject: string;
  html: string;
}) => {
  try {
    if (!to) return;
    await sendEmail({ to, subject, html });
  } catch (error) {
    console.error("EMAIL ERROR:", error);
  }
};

const getBookingEmailHtml = ({
  title,
  intro,
  serviceTitle,
  bookingDate,
  durationMinutes,
  address,
  city,
  price,
  status,
  seekerName,
  providerName,
}: {
  title: string;
  intro: string;
  serviceTitle: string;
  bookingDate: Date | string;
  durationMinutes?: number;
  address?: string;
  city?: string;
  price?: number;
  status: string;
  seekerName?: string;
  providerName?: string;
}) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; color: #111827;">
      <div style="background: #0F4AA1; padding: 20px; border-radius: 12px 12px 0 0; color: white;">
        <h2 style="margin: 0;">${title}</h2>
      </div>

      <div style="border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
        <p style="margin-top: 0; font-size: 15px; line-height: 1.6;">${intro}</p>

        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; margin-top: 16px;">
          <p style="margin: 8px 0;"><strong>Service:</strong> ${serviceTitle}</p>
          <p style="margin: 8px 0;"><strong>Date & Time:</strong> ${formatEmailDate(
            bookingDate
          )}</p>
          ${
            durationMinutes
              ? `<p style="margin: 8px 0;"><strong>Duration:</strong> ${durationMinutes} minutes</p>`
              : ""
          }
          ${
            seekerName
              ? `<p style="margin: 8px 0;"><strong>Seeker:</strong> ${seekerName}</p>`
              : ""
          }
          ${
            providerName
              ? `<p style="margin: 8px 0;"><strong>Provider:</strong> ${providerName}</p>`
              : ""
          }
          ${
            address
              ? `<p style="margin: 8px 0;"><strong>Address:</strong> ${address}</p>`
              : ""
          }
          ${city ? `<p style="margin: 8px 0;"><strong>City:</strong> ${city}</p>` : ""}
          ${
            price !== undefined
              ? `<p style="margin: 8px 0;"><strong>Price:</strong> Rs. ${price}</p>`
              : ""
          }
          <p style="margin: 8px 0;"><strong>Status:</strong> ${status}</p>
        </div>

        <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">
          Thank you for using SkillLink.
        </p>
      </div>
    </div>
  `;
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

    if (populatedBooking) {
      const bookingData: any = populatedBooking;
      const seeker = bookingData.seeker;
      const providerData = bookingData.provider;

      void sendBookingEmailSafely({
        to: providerData?.email,
        subject: "New Booking Request",
        html: getBookingEmailHtml({
          title: "New Booking Request",
          intro: `You have received a new booking request from ${seeker?.fullName || "a customer"}.`,
          serviceTitle: bookingData.serviceTitle,
          bookingDate: bookingData.bookingDate,
          durationMinutes: bookingData.durationMinutes,
          address: bookingData.address,
          city: bookingData.city,
          price: bookingData.price,
          status: "pending",
          seekerName: seeker?.fullName,
          providerName: providerData?.fullName,
        }),
      });

      void sendBookingEmailSafely({
        to: seeker?.email,
        subject: "Booking Request Submitted",
        html: getBookingEmailHtml({
          title: "Booking Request Submitted",
          intro: `Your booking request has been submitted successfully and is waiting for provider approval.`,
          serviceTitle: bookingData.serviceTitle,
          bookingDate: bookingData.bookingDate,
          durationMinutes: bookingData.durationMinutes,
          address: bookingData.address,
          city: bookingData.city,
          price: bookingData.price,
          status: "pending",
          seekerName: seeker?.fullName,
          providerName: providerData?.fullName,
        }),
      });
    }

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

    const isSeeker =
      String((booking as any).seeker?._id || (booking as any).seeker) ===
      String(user._id);
    const isProvider =
      String((booking as any).provider?._id || (booking as any).provider) ===
      String(user._id);

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

    if (updatedBooking) {
      const bookingData: any = updatedBooking;
      const seeker = bookingData.seeker;
      const providerData = bookingData.provider;

      if (status === "accepted") {
        void sendBookingEmailSafely({
          to: seeker?.email,
          subject: "Booking Accepted",
          html: getBookingEmailHtml({
            title: "Booking Accepted",
            intro: `${providerData?.fullName || "Your provider"} has accepted your booking request.`,
            serviceTitle: bookingData.serviceTitle,
            bookingDate: bookingData.bookingDate,
            durationMinutes: bookingData.durationMinutes,
            address: bookingData.address,
            city: bookingData.city,
            price: bookingData.price,
            status: "accepted",
            seekerName: seeker?.fullName,
            providerName: providerData?.fullName,
          }),
        });

        void sendBookingEmailSafely({
          to: providerData?.email,
          subject: "You Accepted a Booking",
          html: getBookingEmailHtml({
            title: "Booking Accepted",
            intro: `You have successfully accepted this booking.`,
            serviceTitle: bookingData.serviceTitle,
            bookingDate: bookingData.bookingDate,
            durationMinutes: bookingData.durationMinutes,
            address: bookingData.address,
            city: bookingData.city,
            price: bookingData.price,
            status: "accepted",
            seekerName: seeker?.fullName,
            providerName: providerData?.fullName,
          }),
        });
      }

      if (status === "rejected") {
        void sendBookingEmailSafely({
          to: seeker?.email,
          subject: "Booking Rejected",
          html: getBookingEmailHtml({
            title: "Booking Rejected",
            intro: `Unfortunately, your booking request has been rejected. Please choose another slot or provider.`,
            serviceTitle: bookingData.serviceTitle,
            bookingDate: bookingData.bookingDate,
            durationMinutes: bookingData.durationMinutes,
            address: bookingData.address,
            city: bookingData.city,
            price: bookingData.price,
            status: "rejected",
            seekerName: seeker?.fullName,
            providerName: providerData?.fullName,
          }),
        });

        void sendBookingEmailSafely({
          to: providerData?.email,
          subject: "Booking Rejected",
          html: getBookingEmailHtml({
            title: "Booking Rejected",
            intro: `You have rejected this booking request.`,
            serviceTitle: bookingData.serviceTitle,
            bookingDate: bookingData.bookingDate,
            durationMinutes: bookingData.durationMinutes,
            address: bookingData.address,
            city: bookingData.city,
            price: bookingData.price,
            status: "rejected",
            seekerName: seeker?.fullName,
            providerName: providerData?.fullName,
          }),
        });
      }

      if (status === "in_progress") {
        void sendBookingEmailSafely({
          to: seeker?.email,
          subject: "Booking In Progress",
          html: getBookingEmailHtml({
            title: "Booking In Progress",
            intro: `Your booking is now in progress.`,
            serviceTitle: bookingData.serviceTitle,
            bookingDate: bookingData.bookingDate,
            durationMinutes: bookingData.durationMinutes,
            address: bookingData.address,
            city: bookingData.city,
            price: bookingData.price,
            status: "in_progress",
            seekerName: seeker?.fullName,
            providerName: providerData?.fullName,
          }),
        });

        void sendBookingEmailSafely({
          to: providerData?.email,
          subject: "Booking Marked In Progress",
          html: getBookingEmailHtml({
            title: "Booking In Progress",
            intro: `You marked this booking as in progress.`,
            serviceTitle: bookingData.serviceTitle,
            bookingDate: bookingData.bookingDate,
            durationMinutes: bookingData.durationMinutes,
            address: bookingData.address,
            city: bookingData.city,
            price: bookingData.price,
            status: "in_progress",
            seekerName: seeker?.fullName,
            providerName: providerData?.fullName,
          }),
        });
      }

      if (status === "completed") {
        void sendBookingEmailSafely({
          to: seeker?.email,
          subject: "Booking Completed",
          html: getBookingEmailHtml({
            title: "Booking Completed",
            intro: `Your service has been marked as completed.`,
            serviceTitle: bookingData.serviceTitle,
            bookingDate: bookingData.bookingDate,
            durationMinutes: bookingData.durationMinutes,
            address: bookingData.address,
            city: bookingData.city,
            price: bookingData.price,
            status: "completed",
            seekerName: seeker?.fullName,
            providerName: providerData?.fullName,
          }),
        });

        void sendBookingEmailSafely({
          to: providerData?.email,
          subject: "Booking Completed Successfully",
          html: getBookingEmailHtml({
            title: "Booking Completed",
            intro: `You have successfully completed this booking.`,
            serviceTitle: bookingData.serviceTitle,
            bookingDate: bookingData.bookingDate,
            durationMinutes: bookingData.durationMinutes,
            address: bookingData.address,
            city: bookingData.city,
            price: bookingData.price,
            status: "completed",
            seekerName: seeker?.fullName,
            providerName: providerData?.fullName,
          }),
        });
      }

      if (status === "cancelled") {
        void sendBookingEmailSafely({
          to: seeker?.email,
          subject: "Booking Cancelled",
          html: getBookingEmailHtml({
            title: "Booking Cancelled",
            intro: `This booking has been cancelled.`,
            serviceTitle: bookingData.serviceTitle,
            bookingDate: bookingData.bookingDate,
            durationMinutes: bookingData.durationMinutes,
            address: bookingData.address,
            city: bookingData.city,
            price: bookingData.price,
            status: "cancelled",
            seekerName: seeker?.fullName,
            providerName: providerData?.fullName,
          }),
        });

        void sendBookingEmailSafely({
          to: providerData?.email,
          subject: "Booking Cancelled",
          html: getBookingEmailHtml({
            title: "Booking Cancelled",
            intro: `This booking has been cancelled.`,
            serviceTitle: bookingData.serviceTitle,
            bookingDate: bookingData.bookingDate,
            durationMinutes: bookingData.durationMinutes,
            address: bookingData.address,
            city: bookingData.city,
            price: bookingData.price,
            status: "cancelled",
            seekerName: seeker?.fullName,
            providerName: providerData?.fullName,
          }),
        });
      }
    }

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

      const hasConflict = existingBookings.some((booking: any) => {
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