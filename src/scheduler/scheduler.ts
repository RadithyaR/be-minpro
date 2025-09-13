import cron from "node-cron";
import prisma from "../lib/prisma";
import { cancelTransaction } from "../controllers/event/transaction.controller";

const scheduleTask = () => {
  try {
    const scheduleRule = "*/30 * * * *"; // execute every 30 minutes

    cron.schedule(scheduleRule, async () => {
      // code yang di eksekusi
      //batalkan transaksi yang sudah lebih dari 2 jam belum dibayar
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

      const expiredTransactions = await prisma.transaction.findMany({
        where: {
          status: {
            name: "PENDING",
          },
          createdAt: {
            lte: twoHoursAgo,
          },
        },
        include: {
          status: true,
        },
      });

      console.log(`Found ${expiredTransactions.length} expired transactions`);

      for (const transaction of expiredTransactions) {
        await cancelTransaction(transaction.id);
        console.log(`Cancelled expired transaction: ${transaction.id}`);
      }

      //batalkan transaksi yang sudah lebih dari 3 hari belum di konfirmasi
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

      const unconfirmedTransactions = await prisma.transaction.findMany({
        where: {
          status: {
            name: "PAID",
          },
          createdAt: {
            lte: threeDaysAgo,
          },
        },
        include: {
          status: true,
        },
      });

      console.log(
        `Found ${unconfirmedTransactions.length} unconfirmed transactions`
      );

      for (const transaction of unconfirmedTransactions) {
        await cancelTransaction(transaction.id);
        console.log(`Cancelled unconfirmed transaction: ${transaction.id}`);
      }
    });
  } catch (error) {
    console.error("Error in transaction expiration scheduler:", error);
  }
};

export default scheduleTask;
