import mongoose, { Schema, Document, Model } from "mongoose";

export type UserRole = "jobSeeker" | "jobProvider" | "admin";

export interface IWorkingHours {
  startHour: number;
  endHour: number;
}

export interface IUser extends Document {
  fullName: string;
  email: string;
  password: string;
  role: UserRole;
  phone?: string;
  address?: string;
  city?: string;
  profileImage?: string;
  bio?: string;
  skills?: string[];
  experienceLevel?: "" | "beginner" | "intermediate" | "expert";
  experienceYears?: number;
  availability?: string;
  companyName?: string;
  companyDescription?: string;
  workingHours?: IWorkingHours;
  isActive: boolean;
  isVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationTokenExpires?: Date;
  averageRating?: number;
  totalReviews?: number;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
    },
    role: {
      type: String,
      enum: ["jobSeeker", "jobProvider", "admin"],
      required: [true, "Role is required"],
      default: "jobSeeker",
    },
    phone: {
      type: String,
      default: "",
    },
    address: {
      type: String,
      default: "",
    },
    city: {
      type: String,
      default: "",
    },
    profileImage: {
      type: String,
      default: "",
    },
    bio: {
      type: String,
      default: "",
    },
    skills: {
      type: [String],
      default: [],
    },
    experienceLevel: {
      type: String,
      enum: ["", "beginner", "intermediate", "expert"],
      default: "",
    },
    experienceYears: {
      type: Number,
      default: 0,
    },
    availability: {
      type: String,
      default: "",
    },
    companyName: {
      type: String,
      default: "",
    },
    companyDescription: {
      type: String,
      default: "",
    },
    workingHours: {
      startHour: {
        type: Number,
        default: 9,
        min: 0,
        max: 23,
      },
      endHour: {
        type: Number,
        default: 18,
        min: 1,
        max: 24,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      default: "",
    },
    emailVerificationTokenExpires: {
      type: Date,
      default: null,
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalReviews: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", userSchema);

export default User;