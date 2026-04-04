import mongoose, { Schema, Document, Model } from "mongoose";

export type BookingStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "in_progress"
  | "completed"
  | "cancelled";

export interface IBooking extends Document {
  seeker: mongoose.Types.ObjectId;
  provider: mongoose.Types.ObjectId;
  serviceTitle: string;
  description?: string;
  bookingDate: Date;
  endTime: Date;
  durationMinutes: number;
  address: string;
  city: string;
  phone: string;
  price: number;
  lat: number;
  lng: number;
  status: BookingStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const bookingSchema = new Schema<IBooking>(
  {
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
    serviceTitle: {
      type: String,
      required: [true, "Service title is required"],
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    bookingDate: {
      type: Date,
      required: [true, "Booking date is required"],
    },
    endTime: {
      type: Date,
      required: [true, "End time is required"],
    },
    durationMinutes: {
      type: Number,
      required: [true, "Duration is required"],
      min: [30, "Minimum duration is 30 minutes"],
      default: 60,
    },
    address: {
      type: String,
      required: [true, "Address is required"],
      trim: true,
    },
    city: {
      type: String,
      required: [true, "City is required"],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, "Phone is required"],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    lat: {
      type: Number,
      required: [true, "Latitude is required"],
    },
    lng: {
      type: Number,
      required: [true, "Longitude is required"],
    },
    status: {
      type: String,
      enum: [
        "pending",
        "accepted",
        "rejected",
        "in_progress",
        "completed",
        "cancelled",
      ],
      default: "pending",
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

bookingSchema.index({ provider: 1, bookingDate: 1, endTime: 1 });

const Booking: Model<IBooking> =
  mongoose.models.Booking || mongoose.model<IBooking>("Booking", bookingSchema);

export default Booking;