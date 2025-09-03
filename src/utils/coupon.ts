import prisma from "../lib/prisma";

export const createCoupon = async (userId: number, nominal: number, expiredInMonths = 3) => {
  const expiry = new Date();
  expiry.setMonth(expiry.getMonth() + expiredInMonths);

  const coupon = await prisma.coupon.create({
    data: {
      userId,
      nominal,
      expiredAt: expiry,
      isUsed: false,
    },
  });

  return coupon;
};

// Fungsinya: bikin kupon untuk user baru atau bonus referral.