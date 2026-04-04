import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import User from "../models/User.model";
import generateToken from "../utils/generateToken";
import sendEmail from "../utils/sendEmail";

// Register user
export const registerUser = async (req: Request, res: Response) => {
  try {
    const {
      fullName,
      email,
      password,
      role,
      phone,
      address,
      city,
      bio,
      skills,
      experienceLevel,
      experienceYears,
      availability,
      companyName,
      companyDescription,
    } = req.body;

    if (!fullName || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "Full name, email, password, and role are required",
      });
    }

    if (!["jobSeeker", "jobProvider", "admin"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role selected",
      });
    }

    if (
      role === "jobProvider" &&
      (!skills || !Array.isArray(skills) || skills.length === 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Skills are required for job providers",
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const rawVerificationToken = crypto.randomBytes(32).toString("hex");
    const hashedVerificationToken = crypto
      .createHash("sha256")
      .update(rawVerificationToken)
      .digest("hex");

    const userData: any = {
      fullName,
      email,
      password: hashedPassword,
      role,
      phone: phone || "",
      address: address || "",
      city: city || "",
      bio: bio || "",
      profileImage: "",
      isActive: true,
      isVerified: false,
      emailVerificationToken: hashedVerificationToken,
      emailVerificationTokenExpires: new Date(Date.now() + 1000 * 60 * 60), // 1 hour
    };

    if (role === "jobSeeker") {
      userData.skills = [];
      userData.experienceLevel = "";
      userData.experienceYears = 0;
      userData.availability = "";
      userData.companyName = "";
      userData.companyDescription = "";
    }

    if (role === "jobProvider") {
      userData.skills = Array.isArray(skills) ? skills : [];
      userData.experienceLevel = experienceLevel || "";
      userData.experienceYears = experienceYears || 0;
      userData.availability = availability || "";
      userData.companyName = companyName || "";
      userData.companyDescription = companyDescription || "";
    }

    if (role === "admin") {
      userData.skills = [];
      userData.experienceLevel = "";
      userData.experienceYears = 0;
      userData.availability = "";
      userData.companyName = "";
      userData.companyDescription = "";
    }

    const user = await User.create(userData);

    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${rawVerificationToken}`;

    await sendEmail({
      to: user.email,
      subject: "Verify your SkillLink account",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>Verify your email</h2>
          <p>Hello ${user.fullName},</p>
          <p>Click the button below to verify your SkillLink account:</p>
          <a
            href="${verifyUrl}"
            style="display:inline-block;padding:12px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;"
          >
            Verify Email
          </a>
          <p style="margin-top:16px;">This link will expire in 1 hour.</p>
        </div>
      `,
    });

    return res.status(201).json({
      success: true,
      message: "User registered successfully. Verification email sent.",
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while registering user",
    });
  }
};

// Verify email
export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== "string") {
      return res.status(400).json({
        success: false,
        message: "Invalid or missing verification token",
      });
    }

    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationTokenExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Verification token is invalid or expired",
      });
    }

    user.isVerified = true;
    user.emailVerificationToken = "";
    user.emailVerificationTokenExpires = undefined;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (error) {
    console.error("VERIFY EMAIL ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while verifying email",
    });
  }
};

// Login user
export const loginUser = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isPasswordMatched = await bcrypt.compare(password, user.password);

    if (!isPasswordMatched) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email before logging in",
      });
    }

    const token = generateToken(String(user._id));

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        phone: user.phone,
        address: user.address,
        city: user.city,
        profileImage: user.profileImage,
        bio: user.bio,
        skills: user.skills,
        experienceLevel: user.experienceLevel,
        experienceYears: user.experienceYears,
        availability: user.availability,
        companyName: user.companyName,
        companyDescription: user.companyDescription,
        isActive: user.isActive,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while logging in",
    });
  }
};

// Get current logged in user
export const getMe = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User not authorized",
      });
    }

    return res.status(200).json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    console.error("GET ME ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching current user",
    });
  }
};