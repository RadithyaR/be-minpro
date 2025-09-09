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

export const getUserPoint = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    const totalPoints = await prisma.point.aggregate({
      where: { userId: userId },
      _sum: {
        amount: true, // Ganti 'points' dengan nama field yang sesuai di tabel Anda
      },
    });

    const points = await prisma.point.findMany({
      where: { userId: userId },
    });

    return res.json({
      totalPoints: totalPoints._sum.amount || 0,
      points,
    });
  } catch (error) {}
};

export const getUserCoupon = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    const totalCoupon = await prisma.coupon.aggregate({
      where: { userId: userId },
      _sum: {
        nominal: true, // Ganti 'points' dengan nama field yang sesuai di tabel Anda
      },
    });

    const coupons = await prisma.coupon.findMany({
      where: { userId: userId },
    });

    return res.json({
      totalCoupon: totalCoupon._sum.nominal || 0,
      coupons,
    });
  } catch (error) {}
};
