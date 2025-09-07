import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import { sendEmail } from "../../utils/email";

// Menghitung diskon
const calculateDiscounts = (
  baseAmount: number,
  pointsAmount: number,
  couponNominal: number,
  voucherNominal: number
) => {
  const pointsDiscount = Math.min(pointsAmount, baseAmount);
  const remainingAfterPoints = baseAmount - pointsDiscount;

  const couponDiscount = Math.min(couponNominal, remainingAfterPoints);
  const remainingAfterCoupon = remainingAfterPoints - couponDiscount;

  const voucherDiscount = Math.min(voucherNominal, remainingAfterCoupon);

  const finalAmount =
    baseAmount - pointsDiscount - couponDiscount - voucherDiscount;

  return {
    pointsDiscount,
    couponDiscount,
    voucherDiscount,
    finalAmount,
  };
};

// CREATE Transaction (Customer only)
export const createTransaction = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { eventId, quantity, pointsToUse, couponNominal, voucherId } =
      req.body;

    // Validasi input
    if (!eventId || !quantity) {
      return res
        .status(400)
        .json({ error: "Event ID and quantity are required" });
    }

    if (quantity <= 0) {
      return res.status(400).json({ error: "Quantity must be greater than 0" });
    }

    // Get event details
    const event = await prisma.event.findUnique({
      where: { id: Number(eventId) },
    });

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Validasi event status
    const now = new Date();
    if (now > new Date(event.endDate)) {
      return res
        .status(400)
        .json({ error: "Cannot purchase tickets for finished events" });
    }

    if (event.availableSeats < quantity) {
      return res.status(400).json({ error: "Not enough available seats" });
    }

    // get user point
    const userPoints = await prisma.point.findMany({
      where: {
        userId: userId,
        type: "EARNED",
        expiredAt: { gt: now },
        OR: [
          { remaining: { gt: 0 } },
          { remaining: null }, // point yang belum pernah digunakan
        ],
      },
      orderBy: { expiredAt: "asc" }, // Gunakan yang mau expired duluan
    });

    const totalAvailablePoints = userPoints.reduce(
      (sum, point) =>
        sum + (point.remaining !== null ? point.remaining : point.amount),
      0
    );

    // Validasi points
    if (pointsToUse > totalAvailablePoints) {
      return res.status(400).json({ error: "Not enough points" });
    }

    // Get yser coupon
    const userCoupons = await prisma.coupon.findMany({
      where: {
        userId: userId,
        isUsed: false,
        expiredAt: { gt: now },
      },
    });

    const totalAvailableCoupons = userCoupons.reduce(
      (sum, coupon) => sum + coupon.nominal,
      0
    );

    // Validasi coupon
    if (couponNominal > totalAvailableCoupons) {
      return res.status(400).json({ error: "Not enough coupon value" });
    }

    // Validasi voucher
    let voucher: any = null;
    let voucherNominal = 0;

    if (voucherId) {
      voucher = await prisma.voucher.findUnique({
        where: { id: Number(voucherId) },
        include: { event: true },
      });

      if (
        !voucher ||
        voucher.userId !== userId ||
        voucher.eventId !== eventId
      ) {
        return res.status(400).json({ error: "Invalid voucher" });
      }

      if (voucher.quota <= 0 || voucher.isUsed) {
        return res.status(400).json({ error: "Voucher already used" });
      }

      voucherNominal = voucher.nominal;
    }

    // menghitung amouit amounts
    const baseAmount = event.price * quantity;
    const { pointsDiscount, couponDiscount, voucherDiscount, finalAmount } =
      calculateDiscounts(
        baseAmount,
        pointsToUse || 0,
        couponNominal || 0,
        voucherNominal
      );

    const transaction = await prisma.$transaction(async (prisma) => {
      // mengurangi available seats
      await prisma.event.update({
        where: { id: eventId },
        data: { availableSeats: { decrement: quantity } },
      });

      // update point
      if (pointsToUse > 0) {
        let pointsRemaining = pointsToUse;

        for (const point of userPoints) {
          if (pointsRemaining <= 0) break;

          const availableInThisPoint =
            point.remaining !== null ? point.remaining : point.amount;
          const pointsToUseFromThis = Math.min(
            pointsRemaining,
            availableInThisPoint
          );

          await prisma.point.update({
            where: { id: point.id },
            data: {
              remaining: availableInThisPoint - pointsToUseFromThis,
              transactionId: transaction.id, // akan diconnect setelah transaction dibuat
            },
          });

          pointsRemaining -= pointsToUseFromThis;
        }
      }

      // Gunakan coupons
      if (couponNominal > 0) {
        let couponRemaining = couponNominal;

        for (const coupon of userCoupons) {
          if (couponRemaining <= 0) break;

          const couponValueToUse = Math.min(couponRemaining, coupon.nominal);

          await prisma.coupon.update({
            where: { id: coupon.id },
            data: {
              isUsed: couponValueToUse === coupon.nominal, // marked as used jika habis
              nominal: coupon.nominal - couponValueToUse,
              transactionId: transaction.id,
            },
          });

          couponRemaining -= couponValueToUse;
        }
      }

      // Gunakan voucher
      if (voucherId) {
        await prisma.voucher.update({
          where: { id: Number(voucherId) },
          data: {
            quota: { decrement: 1 },
            isUsed: true,
          },
        });
      }

      // Create transaction
      return await prisma.transaction.create({
        data: {
          userId: userId,
          eventId: eventId,
          quantity: quantity,
          baseAmount: baseAmount,
          discountPoint: pointsDiscount,
          discountCoupon: couponDiscount,
          discountVoucher: voucherDiscount,
          finalAmount: finalAmount,
          voucherId: voucherId ? Number(voucherId) : null,
          statusId: 1, // PENDING
        },
        include: {
          event: true,
          voucher: true,
          points: true,
          coupons: true,
        },
      });
    });

    // Set timeout untuk expired transaction (2 jam)
    setTimeout(async () => {
      const freshTransaction = await prisma.transaction.findUnique({
        where: { id: transaction.id },
        include: { status: true },
      });

      if (freshTransaction && freshTransaction.status.name === "PENDING") {
        await cancelTransaction(transaction.id, "EXPIRED");
      }
    }, 2 * 60 * 60 * 1000);

    res.status(201).json({
      message: "Transaction created successfully",
      data: transaction,
      paymentDeadline: new Date(Date.now() + 2 * 60 * 60 * 1000),
    });
  } catch (error) {
    console.error("Create transaction error:", error);
    res.status(500).json({ error: "Failed to create transaction" });
  }
};

// UPLOAD Payment Proof (Customer only)
export const uploadPaymentProof = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { transactionId } = req.params;
    const paymentProof = req.file ? req.file.path : null;

    if (!paymentProof) {
      return res.status(400).json({ error: "Payment proof is required" });
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id: Number(transactionId) },
      include: { status: true },
    });

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    if (transaction.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (transaction.status.name !== "PENDING") {
      return res.status(400).json({
        error: "Cannot upload payment proof for this transaction status",
      });
    }

    const updatedTransaction = await prisma.transaction.update({
      where: { id: Number(transactionId) },
      data: {
        paymentProof: paymentProof,
        statusId: 2, // PAID - menunggu konfirmasi admin
      },
      include: {
        event: true,
        status: true,
      },
    });

    // Set timeout untuk auto cancel jika admin tidak respon (3 hari)
    setTimeout(async () => {
      const freshTransaction = await prisma.transaction.findUnique({
        where: { id: updatedTransaction.id },
        include: { status: true },
      });

      if (freshTransaction && freshTransaction.status.name === "PAID") {
        await cancelTransaction(transaction.id, "CANCELLED");
      }
    }, 3 * 24 * 60 * 60 * 1000); // 3 hari

    res.json({
      message: "Payment proof uploaded successfully",
      data: updatedTransaction,
    });
  } catch (error) {
    console.error("Upload payment proof error:", error);
    res.status(500).json({ error: "Failed to upload payment proof" });
  }
};

// EXPIRE Transaction - FIXED
export const cancelTransaction = async (
  transactionId: number,
  reason: "EXPIRED" | "CANCELLED" | "FAILED"
) => {
  return await prisma.$transaction(async (prisma) => {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        event: true,
        points: true,
        coupons: true,
        voucher: true,
      },
    });

    if (!transaction) throw new Error("Transaction not found");

    // mengembalikan available seats
    await prisma.event.update({
      where: { id: transaction.eventId },
      data: { availableSeats: { increment: transaction.quantity } },
    });

    // mengembalikan points
    if (transaction.discountPoint !== null && transaction.discountPoint > 0) {
      if (transaction.discountPoint > 0) {
        const usedPoints = await prisma.point.findMany({
          where: { transactionId: transactionId },
        });

        for (const point of usedPoints) {
          await prisma.point.update({
            where: { id: point.id },
            data: {
              remaining: { increment: point.amount }, // Kembalikan remaining points
              transactionId: null, // Putus relation dengan transaction
            },
          });
        }
      }
    }

    //mengembalikan coupons
    if (transaction.discountCoupon !== null && transaction.discountCoupon > 0) {
      if (transaction.discountCoupon > 0) {
        const usedCoupons = await prisma.coupon.findMany({
          where: { transactionId: transactionId },
        });

        for (const coupon of usedCoupons) {
          await prisma.coupon.update({
            where: { id: coupon.id },
            data: {
              isUsed: false,
              nominal: { increment: coupon.nominal }, // Kembalikan nominal
              transactionId: null,
            },
          });
        }
      }
    }

    //mengembalikann voucher
    if (transaction.voucherId) {
      await prisma.voucher.update({
        where: { id: transaction.voucherId },
        data: {
          quota: { increment: 1 },
          isUsed: false,
        },
      });
    }

    //Update transaction status
    const statusId = reason === "EXPIRED" ? 6 : reason === "CANCELLED" ? 4 : 3;

    return await prisma.transaction.update({
      where: { id: transactionId },
      data: { statusId: statusId },
      include: {
        event: true,
        status: true,
      },
    });
  });
};

// GET User Transactions (Customer only)
export const getUserTransactions = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    const transactions = await prisma.transaction.findMany({
      where: { userId: userId },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            eventImage: true,
            startDate: true,
            endDate: true,
          },
        },
        status: true,
        voucher: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      message: "User transactions retrieved successfully",
      data: transactions,
    });
  } catch (error) {
    console.error("Get user transactions error:", error);
    res.status(500).json({ error: "Failed to retrieve transactions" });
  }
};

// GET Transaction by ID
export const getTransactionById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    const transaction = await prisma.transaction.findUnique({
      where: { id: Number(id) },
      include: {
        event: true,
        status: true,
        voucher: true,
        points: true,
        coupons: true,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    // Validasi ownership
    if (
      transaction.userId !== userId &&
      (req as any).user.role !== "event_organizer"
    ) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json({
      message: "Transaction retrieved successfully",
      data: transaction,
    });
  } catch (error) {
    console.error("Get transaction error:", error);
    res.status(500).json({ error: "Failed to retrieve transaction" });
  }
};

// ACCEPT Transaction (Organizer only)
export const acceptTransaction = async (req: Request, res: Response) => {
  try {
    const organizerId = (req as any).user.userId;
    const { id } = req.params;

    const transaction = await prisma.transaction.findUnique({
      where: { id: Number(id) },
      include: {
        event: true,
        status: true,
      },
    });

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    // Validasi: hanya organizer pemilik event yang bisa accept
    if (transaction.event.userId !== organizerId) {
      return res.status(403).json({ error: "Access denied. Not your event." });
    }

    // Validasi: hanya transaction dengan status PAID yang bisa di-accept
    if (transaction.status.name !== "PAID") {
      return res.status(400).json({
        error: "Cannot accept transaction with current status",
      });
    }

    // Validasi: harus ada payment proof
    if (!transaction.paymentProof) {
      return res.status(400).json({ error: "No payment proof uploaded" });
    }

    const updatedTransaction = await prisma.transaction.update({
      where: { id: Number(id) },
      data: {
        statusId: 2, // PAID -> DONE
      },
      include: {
        event: true,
        status: true,
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });

    // Kirim email notifikasi ke customer

    res.json({
      message: "Transaction accepted successfully",
      data: updatedTransaction,
    });
  } catch (error) {
    console.error("Accept transaction error:", error);
    res.status(500).json({ error: "Failed to accept transaction" });
  }
};

// REJECT Transaction (Organizer only)
export const rejectTransaction = async (req: Request, res: Response) => {
  try {
    const organizerId = (req as any).user.userId;
    const { id } = req.params;

    const transaction = await prisma.transaction.findUnique({
      where: { id: Number(id) },
      include: {
        event: true,
        status: true,
        points: true,
        coupons: true,
        voucher: true,
      },
    });

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    // Validasi: hanya organizer pemilik event yang bisa reject
    if (transaction.event.userId !== organizerId) {
      return res.status(403).json({ error: "Access denied. Not your event." });
    }

    // Validasi: hanya transaction dengan status PAID yang bisa di-reject
    if (transaction.status.name !== "PAID") {
      return res.status(400).json({
        error: "Cannot reject transaction with current status",
      });
    }

    const updatedTransaction = await prisma.$transaction(async (prisma) => {
      // mengembalikan available seats
      await prisma.event.update({
        where: { id: transaction.eventId },
        data: { availableSeats: { increment: transaction.quantity } },
      });

      // mengembalikan points jika digunakan
      if (transaction.discountPoint !== null && transaction.discountPoint > 0) {
        if (transaction.discountPoint > 0) {
          const usedPoints = await prisma.point.findMany({
            where: { transactionId: transaction.id },
          });

          for (const point of usedPoints) {
            await prisma.point.update({
              where: { id: point.id },
              data: {
                remaining: { increment: point.amount },
                transactionId: null,
              },
            });
          }
        }
      }
      // mengembalikan coupons jika digunakan
      if (transaction.discountPoint !== null && transaction.discountPoint > 0) {
        if (transaction.discountPoint > 0) {
          const usedCoupons = await prisma.coupon.findMany({
            where: { transactionId: transaction.id },
          });

          for (const coupon of usedCoupons) {
            await prisma.coupon.update({
              where: { id: coupon.id },
              data: {
                isUsed: false,
                nominal: { increment: coupon.nominal },
                transactionId: null,
              },
            });
          }
        }
      }

      // mengembalikan  voucher jika digunakan
      if (transaction.voucherId) {
        await prisma.voucher.update({
          where: { id: transaction.voucherId },
          data: {
            quota: { increment: 1 },
            isUsed: false,
          },
        });
      }

      // Update transaction status to FAILED
      return await prisma.transaction.update({
        where: { id: Number(id) },
        data: {
          statusId: 3, // FAILED
        },
        include: {
          event: true,
          status: true,
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
            },
          },
        },
      });
    });

    //  Kirim email notifikasi ke customer

    res.json({
      message: "Transaction rejected successfully",
      data: updatedTransaction,
    });
  } catch (error) {
    console.error("Reject transaction error:", error);
    res.status(500).json({ error: "Failed to reject transaction" });
  }
};

// GET Transactions (Event Organizer)
export const getEventTransactions = async (req: Request, res: Response) => {
  try {
    const organizerId = (req as any).user.userId;
    const { eventId } = req.params;

    // Validasi event ownership
    const event = await prisma.event.findUnique({
      where: { id: Number(eventId) },
    });

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    if (event.userId !== organizerId) {
      return res.status(403).json({ error: "Access denied. Not your event." });
    }

    const transactions = await prisma.transaction.findMany({
      where: { eventId: Number(eventId) },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        status: true,
        voucher: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      message: "Event transactions retrieved successfully",
      data: transactions,
    });
  } catch (error) {
    console.error("Get event transactions error:", error);
    res.status(500).json({ error: "Failed to retrieve event transactions" });
  }
};
