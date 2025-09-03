import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import crypto from "crypto";

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

    // TODO: ganti dengan nodemailer biar kirim email sungguhan
    console.log(`🔗 Reset password link: https://your-frontend.com/reset-password?token=${token}`);

    return res.json({ message: "Password reset link sent to your email" });
  } catch (err) {
    console.error("❌ ForgotPassword Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
