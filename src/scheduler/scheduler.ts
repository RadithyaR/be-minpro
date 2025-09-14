import cron from "node-cron";
import prisma from "../lib/prisma";

const expireTransaction = async (transactionId: number) => {
  try {
    await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id: transactionId },
        include: { points: true, coupons: true, voucher: true, event: true },
      });

      if (!transaction) return;

      //Rollback event seats
      await tx.event.update({
        where: { id: transaction.eventId },
        data: { availableSeats: { increment: transaction.quantity } },
      });

      // Rollback points
      for (const point of transaction.points) {
        const pointsUsed = point.amount - (point.remaining || 0);
        await tx.point.update({
          where: { id: point.id },
          data: {
            remaining: { increment: pointsUsed },
            transactionId: null,
          },
        });
      }

      // Rollback coupons
      for (const coupon of transaction.coupons) {
        await tx.coupon.update({
          where: { id: coupon.id },
          data: {
            isUsed: false,
            transactionId: null,
          },
        });
      }

      // Rollback voucher
      if (transaction.voucherId) {
        await tx.voucher.update({
          where: { id: transaction.voucherId },
          data: {
            quota: { increment: 1 },
            isUsed: false,
          },
        });
      }

      // Update transaction status to EXPIRED
      await tx.transaction.update({
        where: { id: transactionId },
        data: { statusId: 6 }, // EXPIRED
      });
    });
  } catch (error) {
    console.error("Error expiring transaction:", error);
  }
};

const autoCancelTransaction = async (transactionId: number) => {
  try {
    await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id: transactionId },
        include: { points: true, coupons: true, voucher: true, event: true },
      });

      if (!transaction) return;

      //Rollback event seats
      await tx.event.update({
        where: { id: transaction.eventId },
        data: { availableSeats: { increment: transaction.quantity } },
      });

      // Rollback points
      for (const point of transaction.points) {
        const pointsUsed = point.amount - (point.remaining || 0);
        await tx.point.update({
          where: { id: point.id },
          data: {
            remaining: { increment: pointsUsed },
            transactionId: null,
          },
        });
      }

      // Rollback coupons
      for (const coupon of transaction.coupons) {
        await tx.coupon.update({
          where: { id: coupon.id },
          data: {
            isUsed: false,
            transactionId: null,
          },
        });
      }

      // Rollback voucher
      if (transaction.voucherId) {
        await tx.voucher.update({
          where: { id: transaction.voucherId },
          data: {
            quota: { increment: 1 },
            isUsed: false,
          },
        });
      }

      // Update transaction status to CANCELLED (bukan EXPIRED)
      await tx.transaction.update({
        where: { id: transactionId },
        data: { statusId: 4 }, // CANCELLED
      });
    });
  } catch (error) {
    console.error("Error auto-cancelling transaction:", error);
  }
};

const checkAndUpdateEventStatus = async () => {
  try {
    const now = new Date();

    console.log("Running event status check...");

    // Update event yang sudah lewat endDate menjadi INACTIVE
    const completedEvents = await prisma.event.findMany({
      where: {
        endDate: { lte: now },
        statusEvent: { not: "INACTIVE" }, // Hanya event yang belum INACTIVE
      },
    });

    console.log(`Found ${completedEvents.length} events to mark as INACTIVE`);

    for (const event of completedEvents) {
      await prisma.event.update({
        where: { id: event.id },
        data: { statusEvent: "INACTIVE" },
      });
      console.log(`Marked event as INACTIVE: ${event.id} - ${event.name}`);
    }

    // Optional: Update event yang startDate sudah lewat tetapi endDate belum menjadi ACTIVE
    const activeEvents = await prisma.event.findMany({
      where: {
        startDate: { lte: now },
        endDate: { gt: now },
        statusEvent: { not: "ACTIVE" }, // Hanya event yang belum ACTIVE
      },
    });

    console.log(`Found ${activeEvents.length} events to mark as ACTIVE`);

    for (const event of activeEvents) {
      await prisma.event.update({
        where: { id: event.id },
        data: { statusEvent: "ACTIVE" },
      });
      console.log(`Marked event as ACTIVE: ${event.id} - ${event.name}`);
    }
  } catch (error) {
    console.error("Error updating event status:", error);
  }
};

const scheduleTask = () => {
  try {
    const scheduleRule = "*/30 * * * *"; //periksa setiap 30 menit

    const eventStatusScheduleRule = "0 0 * * *"; // periksa setiap hari jam 00:00

    cron.schedule(scheduleRule, async () => {
      console.log("Running transaction expiry check...");

      //Batalkan transaksi yang sudah lebih dari 2 jam belum dibayar (PENDING)
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

      const expiredTransactions = await prisma.transaction.findMany({
        where: {
          status: { name: "PENDING" },
          createdAt: { lte: twoHoursAgo },
          paymentProof: null,
        },
        include: { status: true },
      });

      console.log(`Found ${expiredTransactions.length} expired transactions`);

      for (const transaction of expiredTransactions) {
        await expireTransaction(transaction.id);
        console.log(`Expired transaction: ${transaction.id}`);
      }

      //Batalkan transaksi yang sudah lebih dari 3 hari belum dikonfirmasi
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

      const unconfirmedTransactions = await prisma.transaction.findMany({
        where: {
          status: { name: "PAID" },
          createdAt: { lte: threeDaysAgo },
          paymentProof: { not: null }, // Sudah upload payment proof
        },
        include: { status: true },
      });

      console.log(
        `Found ${unconfirmedTransactions.length} unconfirmed transactions`
      );

      for (const transaction of unconfirmedTransactions) {
        await autoCancelTransaction(transaction.id);
        console.log(
          `Auto-cancelled unconfirmed transaction: ${transaction.id}`
        );
      }
    });
    // Scheduler BARU untuk event status check
    cron.schedule(eventStatusScheduleRule, async () => {
      console.log("Running event status check...");
      await checkAndUpdateEventStatus();
    });

    console.log("Event status scheduler started (runs daily at 00:00)");
    console.log("Transaction expiry scheduler started (runs every 30 minutes)");
  } catch (error) {
    console.error("Error in transaction expiration scheduler:", error);
  }
};

export default scheduleTask;
