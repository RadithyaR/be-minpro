// controllers/user/profile.controller.ts
import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import bcrypt from "bcrypt";

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { fullName, password, profilePicture, phone, bio } = req.body;

    const data: Record<string, any> = {};

    if (fullName) data.fullName = fullName.trim();
    if (profilePicture) data.profilePicture = profilePicture;
    if (phone) data.phone = phone.trim();
    if (bio) data.bio = bio.trim();

    if (password) {
      data.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        fullName: true,
        profilePicture: true,
        phone: true,
        bio: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    console.error("Update profile error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
