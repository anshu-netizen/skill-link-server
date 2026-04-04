import { Request, Response } from "express";
import User from "../models/User.model";

// Get all job providers
export const getAllProviders = async (req: Request, res: Response) => {
  try {
    const { city, skill, experienceLevel, search } = req.query;

    const query: any = {
      role: "jobProvider",
      isActive: true,
    };

    if (city) {
      query.city = { $regex: city, $options: "i" };
    }

    if (skill) {
      query.skills = { $in: [new RegExp(String(skill), "i")] };
    }

    if (experienceLevel) {
      query.experienceLevel = experienceLevel;
    }

    if (search) {
      query.$or = [
        { fullName: { $regex: String(search), $options: "i" } },
        { companyName: { $regex: String(search), $options: "i" } },
        { skills: { $in: [new RegExp(String(search), "i")] } },
      ];
    }

    const providers = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: providers.length,
      providers,
    });
  } catch (error) {
    console.error("GET ALL PROVIDERS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching providers",
    });
  }
};

// Get provider by id
export const getProviderById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const provider = await User.findOne({
      _id: id,
      role: "jobProvider",
      isActive: true,
    }).select("-password");

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: "Provider not found",
      });
    }

    return res.status(200).json({
      success: true,
      provider,
    });
  } catch (error) {
    console.error("GET PROVIDER BY ID ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching provider",
    });
  }
};

// Get my profile
export const getMyProfile = async (req: Request, res: Response) => {
  try {
    const authUser = req.user;

    if (!authUser) {
      return res.status(401).json({
        success: false,
        message: "User not authorized",
      });
    }

    const user = await User.findById(authUser._id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("GET MY PROFILE ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching profile",
    });
  }
};

// Update my profile
export const updateMyProfile = async (req: Request, res: Response) => {
  try {
    const authUser = req.user;

    if (!authUser) {
      return res.status(401).json({
        success: false,
        message: "User not authorized",
      });
    }

    const existingUser = await User.findById(authUser._id);

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const {
      fullName,
      phone,
      address,
      city,
      profileImage,
      bio,
      skills,
      experienceLevel,
      experienceYears,
      availability,
      companyName,
      companyDescription,
      workingHours,
    } = req.body;

    const updateData: any = {};

    if (typeof fullName === "string") updateData.fullName = fullName.trim();
    if (typeof phone === "string") updateData.phone = phone.trim();
    if (typeof address === "string") updateData.address = address.trim();
    if (typeof city === "string") updateData.city = city.trim();
    if (typeof profileImage === "string") updateData.profileImage = profileImage.trim();
    if (typeof bio === "string") updateData.bio = bio.trim();
    if (typeof availability === "string") updateData.availability = availability.trim();

    if (Array.isArray(skills)) {
      updateData.skills = skills
        .filter((skill) => typeof skill === "string")
        .map((skill) => skill.trim())
        .filter(Boolean);
    }

    if (
      experienceLevel !== undefined &&
      ["", "beginner", "intermediate", "expert"].includes(experienceLevel)
    ) {
      updateData.experienceLevel = experienceLevel;
    }

    if (
      experienceYears !== undefined &&
      typeof experienceYears === "number" &&
      experienceYears >= 0
    ) {
      updateData.experienceYears = experienceYears;
    }

    if (existingUser.role === "jobProvider") {
      if (typeof companyName === "string") {
        updateData.companyName = companyName.trim();
      }

      if (typeof companyDescription === "string") {
        updateData.companyDescription = companyDescription.trim();
      }

      if (workingHours) {
        const { startHour, endHour } = workingHours;

        if (
          !Number.isInteger(startHour) ||
          !Number.isInteger(endHour) ||
          startHour < 0 ||
          startHour > 23 ||
          endHour < 1 ||
          endHour > 24 ||
          startHour >= endHour
        ) {
          return res.status(400).json({
            success: false,
            message:
              "workingHours must have valid startHour and endHour values",
          });
        }

        updateData.workingHours = {
          startHour,
          endHour,
        };
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      authUser._id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select("-password");

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("UPDATE MY PROFILE ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating profile",
    });
  }
};

// Get my working hours
export const getMyWorkingHours = async (req: Request, res: Response) => {
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
        message: "Only providers can view working hours",
      });
    }

    const provider = await User.findById(user._id).select(
      "fullName role availability workingHours"
    );

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: "Provider not found",
      });
    }

    return res.status(200).json({
      success: true,
      workingHours: provider.workingHours || {
        startHour: 9,
        endHour: 18,
      },
      availability: provider.availability || "",
      provider,
    });
  } catch (error) {
    console.error("GET MY WORKING HOURS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching working hours",
    });
  }
};

// Update my working hours
export const updateMyWorkingHours = async (req: Request, res: Response) => {
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
        message: "Only providers can update working hours",
      });
    }

    const { startHour, endHour, availability } = req.body;

    if (
      startHour === undefined ||
      endHour === undefined ||
      !Number.isInteger(startHour) ||
      !Number.isInteger(endHour)
    ) {
      return res.status(400).json({
        success: false,
        message: "startHour and endHour must be integers",
      });
    }

    if (startHour < 0 || startHour > 23 || endHour < 1 || endHour > 24) {
      return res.status(400).json({
        success: false,
        message:
          "startHour must be between 0 and 23, and endHour between 1 and 24",
      });
    }

    if (startHour >= endHour) {
      return res.status(400).json({
        success: false,
        message: "startHour must be less than endHour",
      });
    }

    const updateData: any = {
      workingHours: {
        startHour,
        endHour,
      },
    };

    if (typeof availability === "string") {
      updateData.availability = availability.trim();
    }

    const updatedProvider = await User.findByIdAndUpdate(
      user._id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedProvider) {
      return res.status(404).json({
        success: false,
        message: "Provider not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Working hours updated successfully",
      user: updatedProvider,
    });
  } catch (error) {
    console.error("UPDATE WORKING HOURS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating working hours",
    });
  }
};