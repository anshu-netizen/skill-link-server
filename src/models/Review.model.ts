import mongoose, { Schema, Document, Model } from "mongoose";

export interface IReview extends Document {
  booking: mongoose.Types.ObjectId;
  seeker: mongoose.Types.ObjectId;
  provider: mongoose.Types.ObjectId;
  rating: number;
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    booking: {
      type: Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      unique: true, // one review per booking
    },
    seeker: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    provider: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rating: {
      type: Number,
      required: [true, "Rating is required"],
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot be more than 5"],
    },
    comment: {
      type: String,
      default: "",
      trim: true,
      maxlength: [1000, "Comment cannot exceed 1000 characters"],
    },
  },
  {
    timestamps: true,
  }
);

reviewSchema.index({ provider: 1, createdAt: -1 });
reviewSchema.index({ seeker: 1, createdAt: -1 });

const Review: Model<IReview> =
  mongoose.models.Review || mongoose.model<IReview>("Review", reviewSchema);

export default Review;