import prisma from "../../lib/prisma";
import { generateReferralCode } from "../../utils/referral";
import { User } from "@prisma/client";

// proses referral & generate code
export const processReferral = async (user: User, referralCode?: string) => {
  // generate kode referral unik
  let newReferralCode = generateReferralCode(user.fullName, user.id);
  const existing = await prisma.referral.findUnique({ where: { code: newReferralCode } });
  if (existing) newReferralCode = `${newReferralCode}${Date.now()}`;

  await prisma.referral.create({ data: { code: newReferralCode, userId: user.id } });

  if (referralCode) {
    const ref = await prisma.referral.findUnique({ where: { code: referralCode } });
    if (ref) {
      const expiry = new Date();
      expiry.setMonth(expiry.getMonth() + 3);

      // bonus referrer
      await prisma.point.create({
        data: {
          userId: ref.userId,
          amount: 10000,
          type: "BONUS",
          description: `Referral bonus from ${user.fullName}`,
          expiredAt: expiry,
          remaining: 10000,
        },
      });

      // bonus user baru
      await prisma.coupon.create({
        data: { userId: user.id, nominal: 20000, expiredAt: expiry, isUsed: false },
      });
    }
  }

  return newReferralCode;
};


// Lihat siapa saja yang pakai referral code user
export const getMyReferrals = async (req: any, res: any) => {
  try {
    const userId = req.user.userId;

    const referrals = await prisma.referral.findMany({
      where: { userId },
      include: { user: { select: { fullName: true, email: true } } },
    });

    return res.json({ referrals });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
};