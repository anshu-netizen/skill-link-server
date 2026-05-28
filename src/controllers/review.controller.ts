import { Request, Response } from "express";
import Booking from "../models/Booking.model";
import Review from "../models/Review.model";
import User from "../models/User.model";

const updateProviderRatingStats = async (providerId: string) => {
  const stats = await Review.aggregate([
    {
      $match: {
        provider: (await import("mongoose")).default.Types.ObjectId.createFromHexString(
          providerId
        ),
      },
    },
    {
      $group: {
        _id: "$provider",
        averageRating: { $avg: "$rating" },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  const averageRating = stats[0]?.averageRating ?? 0;
  const totalReviews = stats[0]?.totalReviews ?? 0;

  await User.findByIdAndUpdate(providerId, {
    averageRating: Number(averageRating.toFixed(1)),
    totalReviews,
  });
};

// CREATE REVIEW
export const createReview = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    const { bookingId, rating, comment } = req.body;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not authorized",
      });
    }

    if (user.role !== "jobSeeker") {
      return res.status(403).json({
        success: false,
        message: "Only job seekers can write reviews",
      });
    }

    if (!bookingId || rating === undefined) {
      return res.status(400).json({
        success: false,
        message: "bookingId and rating are required",
      });
    }

    const numericRating = Number(rating);

    if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be a number between 1 and 5",
      });
    }

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (String(booking.seeker) !== String(user._id)) {
      return res.status(403).json({
        success: false,
        message: "You can only review your own completed booking",
      });
    }

    if (booking.status !== "completed") {
      return res.status(400).json({
        success: false,
        message: "You can only review a completed booking",
      });
    }

    const existingReview = await Review.findOne({ booking: bookingId });

    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: "You have already reviewed this booking",
      });
    }

    const review = await Review.create({
      booking: booking._id,
      seeker: booking.seeker,
      provider: booking.provider,
      rating: numericRating,
      comment: comment || "",
    });

    await updateProviderRatingStats(String(booking.provider));

    const populatedReview = await Review.findById(review._id)
      .populate("seeker", "fullName profileImage")
      .populate("provider", "fullName profileImage averageRating totalReviews")
      .populate("booking", "serviceTitle bookingDate status");

    return res.status(201).json({
      success: true,
      message: "Review submitted successfully",
      review: populatedReview,
    });
  } catch (error) {
    console.error("CREATE REVIEW ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while creating review",
    });
  }
};

// GET ALL REVIEWS FOR A PROVIDER
export const getProviderReviews = async (req: Request, res: Response) => {
  try {
    const { providerId } = req.params;

    const provider = await User.findById(providerId).select(
      "fullName averageRating totalReviews role"
    );

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

    const reviews = await Review.find({ provider: providerId })
      .populate("seeker", "fullName profileImage")
      .populate("booking", "serviceTitle bookingDate")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      provider: {
        _id: provider._id,
        fullName: provider.fullName,
        averageRating: provider.averageRating ?? 0,
        totalReviews: provider.totalReviews ?? 0,
      },
      count: reviews.length,
      reviews,
    });
  } catch (error) {
    console.error("GET PROVIDER REVIEWS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching provider reviews",
    });
  }
};

// GET MY REVIEWABLE BOOKINGS
export const getMyReviewableBookings = async (req: Request, res: Response) => {
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
        message: "Only job seekers can view reviewable bookings",
      });
    }

    const completedBookings = await Booking.find({
      seeker: user._id,
      status: "completed",
    })
      .populate(
        "provider",
        "fullName email phone city profileImage averageRating totalReviews"
      )
      .sort({ updatedAt: -1 });

    const bookingIds = completedBookings.map((booking) => booking._id);

    const existingReviews = await Review.find({
      booking: { $in: bookingIds },
    }).select("booking");

    const reviewedBookingIds = new Set(
      existingReviews.map((review) => String(review.booking))
    );

    const reviewableBookings = completedBookings.filter(
      (booking) => !reviewedBookingIds.has(String(booking._id))
    );

    return res.status(200).json({
      success: true,
      count: reviewableBookings.length,
      bookings: reviewableBookings,
    });
  } catch (error) {
    console.error("GET REVIEWABLE BOOKINGS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching reviewable bookings",
    });
  }
};