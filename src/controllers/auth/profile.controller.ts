
import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import bcrypt from "bcrypt";
import path from "path";
import fs from "fs";
import multer from "multer";

// === Multer config khusus profile ===
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), "public/profile");

    // cek folder, kalau belum ada -> buat
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

export const uploadProfile = multer({ storage });

export const getProfile = async (req: Request, res: Response) => {
  try {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId;

    if (!userId || isNaN(Number(userId))) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await prisma.user.findUnique({
      where: { id: Number(userId) },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        bio: true,
        profilePicture: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({
      message: "Profile fetched successfully",
      user,
    });
  } catch (err) {
    console.error("Get profile error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userPayload = (req as any).user;
    const userId = userPayload?.id || userPayload?.userId;

    if (!userId || isNaN(Number(userId))) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { fullName, phone, bio, password } = req.body;
    const file = req.file;

    const existing = await prisma.user.findUnique({ where: { id: Number(userId) } });
    if (!existing) {
      return res.status(404).json({ error: "User not found" });
    }

    const data: Record<string, any> = {};
    if (typeof fullName === "string" && fullName.trim())
      data.fullName = fullName.trim();
    if (typeof phone === "string" && phone.trim())
      data.phone = phone.trim();
    if (typeof bio === "string" && bio.trim())
      data.bio = bio.trim();
    if (typeof password === "string" && password.trim())
      data.password = await bcrypt.hash(password, 10);

    if (file) {
      // hapus file lama kalau ada
      if (existing.profilePicture) {
        try {
          const oldAbsPath = path.join(process.cwd(), "public", existing.profilePicture);
          if (fs.existsSync(oldAbsPath)) {
            await fs.promises.unlink(oldAbsPath);
          }
        } catch (delErr) {
          console.warn("⚠️ Failed to delete old image:", delErr);
        }
      }

      // simpan path baru
      data.profilePicture = `profile/${file.filename}`;
    }

    const updatedUser = await prisma.user.update({
      where: { id: Number(userId) },
      data,
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        bio: true,
        profilePicture: true,
        role: true,
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
