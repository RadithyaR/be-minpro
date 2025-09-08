import prisma from "../lib/prisma";

export class TransactionExpiryService {
  // Check transactions yang expired (2 jam tidak upload payment)
  private async checkExpiredTransactions() {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const expiredTransactions = await prisma.transaction.findMany({
      where: {
        status: { name: "PENDING" },
        createdAt: { lt: twoHoursAgo },
        paymentProof: null,
      },
      include: {
        event: true,
        points: true,
        coupons: true,
        voucher: true,
      },
    });

    for (const transaction of expiredTransactions) {
      try {
        await this.cancelTransaction(transaction.id, "EXPIRED");
        console.log(`Transaction ${transaction.id} expired automatically`);
      } catch (error) {
        console.error(`Failed to expire transaction ${transaction.id}:`, error);
      }
    }
  }

  // Check transactions yang waiting confirmation > 3 hari
  private async checkAutoCancelTransactions() {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const autoCancelTransactions = await prisma.transaction.findMany({
      where: {
        status: { name: "WAITING_CONFIRMATION" },
        createdAt: { lt: threeDaysAgo },
      },
      include: {
        event: true,
        points: true,
        coupons: true,
        voucher: true,
      },
    });

    for (const transaction of autoCancelTransactions) {
      try {
        await this.cancelTransaction(transaction.id, "CANCELLED");
        console.log(
          `Transaction ${transaction.id} auto-cancelled (3 days no response)`
        );
      } catch (error) {
        console.error(
          `Failed to auto-cancel transaction ${transaction.id}:`,
          error
        );
      }
    }
  }

  // Fungsi cancel transaction dengan rollback
  public async cancelTransaction(
    transactionId: number,
    reason: "EXPIRED" | "CANCELLED" | "REJECTED"
  ) {
    return await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id: transactionId },
        include: {
          event: true,
          points: true,
          coupons: true,
          voucher: true,
        },
      });

      if (!transaction) throw new Error("Transaction not found");

      // Kembalikan available seats
      await tx.event.update({
        where: { id: transaction.eventId },
        data: { availableSeats: { increment: transaction.quantity } },
      });

      // Kembalikan points
      if (transaction.discountPoint !== null && transaction.discountPoint > 0) {
        if (transaction.discountPoint > 0) {
          const usedPoints = await tx.point.findMany({
            where: { transactionId: transactionId },
          });

          for (const point of usedPoints) {
            await tx.point.update({
              where: { id: point.id },
              data: {
                remaining: { increment: point.amount },
                transactionId: null,
              },
            });
          }
        }
      }

      // Kembalikan coupons
      if (
        transaction.discountCoupon !== null &&
        transaction.discountCoupon > 0
      ) {
        if (transaction.discountCoupon > 0) {
          const usedCoupons = await tx.coupon.findMany({
            where: { transactionId: transactionId },
          });

          for (const coupon of usedCoupons) {
            await tx.coupon.update({
              where: { id: coupon.id },
              data: {
                isUsed: false,
                nominal: coupon.nominal,
                transactionId: null,
              },
            });
          }
        }
      }

      // Kembalikan voucher
      if (transaction.voucherId) {
        await tx.voucher.update({
          where: { id: transaction.voucherId },
          data: {
            quota: { increment: 1 },
            isUsed: false,
          },
        });
      }

      // Tentukan status berdasarkan reason
      let statusId: number;
      switch (reason) {
        case "EXPIRED":
          statusId = 5; // EXPIRED
          break;
        case "CANCELLED":
          statusId = 4; // CANCELLED
          break;
        case "REJECTED":
          statusId = 3; // REJECTED
          break;
        default:
          statusId = 4; // CANCELLED
      }

      // Update transaction status
      return await tx.transaction.update({
        where: { id: transactionId },
        data: { statusId },
        include: {
          event: true,
          status: true,
        },
      });
    });
  }
}
