import { Request, Response } from "express";
import prisma from "../../lib/prisma";

export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== "string") {
      return res.status(400).json({ error: "Invalid token" });
    }

    const user = await prisma.user.findFirst({
      where: { verificationToken: token },
    });

    if (!user) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        verificationToken: null,
      },
    });

    return res.json({ message: "Email verified successfully" });
  } catch (err) {
    console.error("❌ VerifyEmail Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
