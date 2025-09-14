import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import { sendEmail } from "../../utils/email";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Menghitung diskon
const calculateDiscounts = (
  baseAmount: number,
  amount: number,
  couponNominal: number,
  voucherNominal: number
) => {
  const pointsDiscount = Math.min(amount, baseAmount);
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
    finalAmount: Math.max(0, finalAmount),
  };
};

// CREATE Transaction (Customer only)
export const createTransaction = async (req: Request, res: Response) => {
  let transactionResult: any = null;

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

    // Get user points dengan filter yang benar
    const userPoints = await prisma.point.findMany({
      where: {
        userId: userId,
        expiredAt: { gt: now },
        OR: [{ remaining: { gt: 0 } }, { remaining: null }],
      },
      orderBy: { expiredAt: "asc" },
    });

    const totalAvailablePoints = userPoints.reduce(
      (sum, point) =>
        sum + (point.remaining !== null ? point.remaining : point.amount),
      0
    );

    console.log("TOTAL POINT:", userPoints);

    // Validasi points
    if (pointsToUse > totalAvailablePoints) {
      return res.status(400).json({ error: "Not enough points" });
    }

    // Get user coupons dengan filter yang benar
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
      });

      if (
        !voucher ||
        voucher.userId !== userId ||
        Number(voucher.eventId) !== Number(eventId)
      ) {
        return res.status(400).json({ error: "Invalid voucher" });
      }

      if (voucher.quota <= 0 || voucher.isUsed) {
        return res.status(400).json({ error: "Voucher already used" });
      }

      voucherNominal = voucher.nominal;
    }

    // Hitung amounts
    const baseAmount = event.price * quantity;
    const { pointsDiscount, couponDiscount, voucherDiscount, finalAmount } =
      calculateDiscounts(
        baseAmount,
        pointsToUse || 0,
        couponNominal || 0,
        voucherNominal
      );

    transactionResult = await prisma.$transaction(async (tx) => {
      //Kurangi available seats
      const updatedEvent = await tx.event.update({
        where: { id: Number(eventId) },
        data: { availableSeats: { decrement: quantity } },
      });

      //Create transaction terlebih dahulu
      const transaction = await tx.transaction.create({
        data: {
          userId: userId,
          eventId: Number(eventId),
          quantity: quantity,
          baseAmount: baseAmount,
          discountPoint: pointsDiscount,
          discountCoupon: couponDiscount,
          discountVoucher: voucherDiscount,
          finalAmount: finalAmount,
          voucherId: voucherId ? Number(voucherId) : null,
          statusId: 1, // PENDING
        },
      });

      //Update points jika digunakan
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

          await tx.point.update({
            where: { id: point.id },
            data: {
              remaining: availableInThisPoint - pointsToUseFromThis,
              transactionId: transaction.id,
            },
          });

          pointsRemaining -= pointsToUseFromThis;
        }
      }

      //Update coupons jika digunakan
      if (couponNominal > 0) {
        let couponRemaining = couponNominal;

        for (const coupon of userCoupons) {
          if (couponRemaining <= 0) break;

          const couponValueToUse = Math.min(couponRemaining, coupon.nominal);

          await tx.coupon.update({
            where: { id: coupon.id },
            data: {
              isUsed: couponValueToUse === coupon.nominal,
              nominal: coupon.nominal - couponValueToUse,
              transactionId: transaction.id,
            },
          });

          couponRemaining -= couponValueToUse;
        }
      }

      //Update voucher jika digunakan
      if (voucherId) {
        await tx.voucher.update({
          where: { id: Number(voucherId) },
          data: {
            quota: { decrement: 1 },
            isUsed: true,
          },
        });
      }

      // Return transaction dengan relasi
      return await tx.transaction.findUnique({
        where: { id: transaction.id },
        include: {
          event: true,
          voucher: true,
          points: true,
          coupons: true,
        },
      });
    });

    // Set timeout untuk expired transaction (2 jam)

    res.status(201).json({
      message: "Transaction created successfully",
      data: transactionResult,
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
    const { id } = req.params;
    const paymentProof = req.file ? req.file.path : null;

    if (!paymentProof) {
      return res.status(400).json({ error: "Payment proof is required" });
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id: Number(id) },
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
      where: { id: Number(id) },
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

    res.json({
      message: "Payment proof uploaded successfully",
      data: updatedTransaction,
    });
  } catch (error) {
    console.error("Upload payment proof error:", error);
    res.status(500).json({ error: "Failed to upload payment proof" });
  }
};

// ===============================
// APPROVE transaction (Organizer -> PAID -> DONE)
// ===============================
export const approveTransaction = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const transaction = await prisma.transaction.findUnique({
      where: { id: Number(id) },
      include: {
        status: true,
        event: { select: { name: true } },
        user: { select: { email: true, fullName: true } }, 
      },
    });

    if (!transaction) return res.status(404).json({ error: "Transaction not found" });

    // send email to user
    await sendEmail(
      transaction.user.email, // 
      "Transaksi Disetujui",
      `Hai ${transaction.user.fullName}, 
      transaksi kamu untuk event "${transaction.event.name}" telah disetujui.`
    );

    const updated = await prisma.transaction.update({
      where: { id: Number(id) },
      data: { statusId: 5 }, // DONE
      include: { event: true, user: true, status: true },
    });

    res.json({ message: "Transaction approved -> DONE", data: updated });
  } catch (err) {
    console.error("Approve transaction error:", err);
    res.status(500).json({ error: "Failed to approve transaction" });
  }
};

// GET User Transactions (Customer only)
export const getUserTransactions = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const role = (req as any).user.role;

    let transactions;

    if (role === "customer") {
      transactions = await prisma.transaction.findMany({
        where: { userId },
        include: {
          event: {
            select: {
              id: true,
              name: true,
              eventImage: true,
              startDate: true,
              endDate: true,
              reviews: true,
            },
          },
          status: true,
          voucher: true,
        },
        orderBy: { createdAt: "desc" },
      });
    } else if (role === "event_organizer") {
      transactions = await prisma.transaction.findMany({
        where: { event: { userId } },
        include: {
          user: { select: { id: true, fullName: true, email: true } },
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
    } else {
      return res.status(403).json({ error: "Invalid role" });
    }

    res.json({
      message: "User transactions retrieved successfully",
      data: transactions,
    });
  } catch (error) {
    console.error("Get user transactions error:", error);
    res.status(500).json({ error: "Failed to retrieve transactions" });
  }
};

// GET all transactions (filter by status)
export const getTransactions = async (req: Request, res: Response) => {
  try {
    const { status } = req.query;

    const transactions = await prisma.transaction.findMany({
      where: status ? { status: String(status).toUpperCase() as any } : {},
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        event: { select: { id: true, name: true } },
        status: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json({
      message: "Transactions retrieved successfully",
      data: transactions,
    });
  } catch (err) {
    console.error("Error fetching transactions:", err);
    res.status(500).json({ error: "Failed to fetch transactions" });
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
        event: {
          include: {
            user: {
              select: {
                fullName: true,
                email: true,
              },
            },
          },
        },
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
        statusId: 5, // DONE
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
    await transporter.sendMail({
      from: `"EventKu" <${process.env.EMAIL_USER}>`,
      to: transaction.event.user.email,
      subject: "Transaction Approved",
      html: `
        <p>Halo ${transaction.event.user.fullName || "User"},</p>
        <p>Transaksi anda pada ${transaction.event.name} Diterima</p>
      `,
    });

    res.json({
      message: "Transaction accepted successfully",
      data: updatedTransaction,
    });
  } catch (error) {
    console.error("Accept transaction error:", error);
    res.status(500).json({ error: "Failed to accept transaction" });
  }
};
// ===============================
// REJECT transaction (Organizer -> PAID -> REJECT)
// ===============================
export const rejectTransaction = async (req: Request, res: Response) => {
  try {
    const organizerId = (req as any).user.userId;
    const { id } = req.params;

   const transaction = await prisma.transaction.findUnique({
      where: { id: Number(id) },
      include: {
        event: {
          include: {
            user: {
              select: {
                fullName: true,
                email: true,
              },
            },
          },
        },
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

    // Validasi: hanya transaction dengan status PENDING yang bisa di-reject
    if (
      transaction.status.name !== "PENDING" &&
      transaction.status.name !== "PAID"
    ) {
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
          statusId: 3, // REJECTED
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
    await transporter.sendMail({
      from: `"EventKu" <${process.env.EMAIL_USER}>`,
      to: transaction.event.user.email,
      subject: "Transaction Rejected",
      html: `
        <p>Halo ${transaction.event.user.fullName || "User"},</p>
        <p>Transaksi anda pada ${transaction.event.name} Ditolak</p>
      `,
    });

    res.json({
      message: "Transaction rejected successfully",
      data: updatedTransaction,
    });
  } catch (error) {
    console.error("Reject transaction error:", error);
    res.status(500).json({ error: "Failed to reject transaction" });
  }
};

// ===============================
// CANCEL after DONE (Customer request cancel)
// ===============================
export const cancelAfterDone = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const transaction = await prisma.transaction.findUnique({
    where: { id: Number(id) },
    include: {
      status: true,
      event: { select: { name: true } },
      user: { select: { email: true, fullName: true } }, 
    },
  });

  if (!transaction) return res.status(404).json({ error: "Transaction not found" });

  // send email to user
  await sendEmail(
    transaction.user.email, // 
    "Transaksi Dibatalkan",
    `Hai ${transaction.user.fullName}, 
    transaksi kamu untuk event "${transaction.event.name}" telah dibatalkan.`
  );

    // rollback seat
    await prisma.event.update({
      where: { id: transaction.eventId },
      data: { availableSeats: { increment: transaction.quantity } },
    });

    // rollback point
    if ((transaction.discountPoint ?? 0) > 0) {
      await prisma.point.updateMany({
        where: { transactionId: transaction.id },
        data: { transactionId: null },
      });
    }

    // rollback coupon
    if ((transaction.discountCoupon ?? 0) > 0) {
      await prisma.coupon.updateMany({
        where: { transactionId: transaction.id },
        data: { isUsed: false, transactionId: null },
      });
    }

    // rollback voucher
    if (transaction.voucherId) {
      await prisma.voucher.update({
        where: { id: transaction.voucherId },
        data: { quota: { increment: 1 }, isUsed: false },
      });
    }

    const updated = await prisma.transaction.update({
      where: { id: Number(id) },
      data: { statusId: 4 }, // CANCELLED
      include: { event: true, user: true, status: true },
    });

    res.json({ message: "Transaction cancelled after DONE", data: updated });
  } catch (err) {
    console.error("Cancel after DONE error:", err);
    res.status(500).json({ error: "Failed to cancel transaction" });
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

