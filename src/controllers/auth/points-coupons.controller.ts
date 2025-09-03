import { Request, Response } from "express";
import prisma from "../../lib/prisma";

export const getUserPointsAndCoupons = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    const points = await prisma.point.findMany({
      where: { userId, expiredAt: { gte: new Date() } },
    });

    const coupons = await prisma.coupon.findMany({
      where: { userId, expiredAt: { gte: new Date() }, isUsed: false },
    });

    return res.json({ points, coupons });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
