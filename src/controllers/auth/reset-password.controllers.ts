import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import bcrypt from "bcrypt";

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: token,
        resetPasswordExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        resetPasswordToken: null,
        resetPasswordExpiry: null,
      },
    });

    return res.json({ message: "Password reset successful" });
  } catch (err) {
    console.error("❌ ResetPassword Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
