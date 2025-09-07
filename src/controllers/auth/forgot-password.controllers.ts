import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import crypto from "crypto";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 1000 * 60 * 15); // 15 menit

    await prisma.user.update({
      where: { email },
      data: {
        resetPasswordToken: token,
        resetPasswordExpiry: expiry,
      },
    });

    await transporter.sendMail({
      from: `"EventKu" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Reset your password",
      html: `
        <p>Halo ${user.fullName || "User"},</p>
        <p>Klik link berikut untuk reset password (berlaku 15 menit):</p>
        <a href="http://localhost:3000/reset-password?token=${token}">
          Reset Password
        </a>
      `,
    });

    return res.json({ message: "Password reset link sent to your email" });
  } catch (err) {
    console.error("❌ ForgotPassword Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
