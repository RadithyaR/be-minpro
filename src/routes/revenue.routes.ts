import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { format } from "date-fns";

const prisma = new PrismaClient();
const router = Router();

router.get("/", async (req, res) => {
  try {
    // ambil eventId dari query (contoh: ?eventId=1,2,3)
    const { eventId } = req.query;
    let eventIds: number[] | undefined;

    if (eventId) {
      eventIds = String(eventId)
        .split(",")
        .map((id) => Number(id))
        .filter((id) => !isNaN(id));
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        statusId: 2,
        eventId: {
          in: eventIds && eventIds.length > 0 ? eventIds : [-1], // kasih id dummy yg pasti ga ada
        },
      },
      select: {
        createdAt: true,
        finalAmount: true,
      },
    });

    // Group by bulan manual (karena Prisma belum bisa native groupBy month)
    const revenueByMonth: Record<
      string,
      { month: string; month_number: number; revenue: number }
    > = {};

    transactions.forEach((tx) => {
      const monthLabel = format(tx.createdAt, "MMM yyyy"); // contoh: "Sep 2025"
      const monthNumber = tx.createdAt.getMonth() + 1; // getMonth() 0-11

      if (!revenueByMonth[monthLabel]) {
        revenueByMonth[monthLabel] = {
          month: monthLabel,
          month_number: monthNumber,
          revenue: 0,
        };
      }

      revenueByMonth[monthLabel].revenue += tx.finalAmount;
    });

    // urutkan berdasarkan bulan
    const result = Object.values(revenueByMonth).sort(
      (a, b) => a.month_number - b.month_number
    );

    res.json(result);
  } catch (err) {
    console.error("Error fetching revenue data:", err);
    res.status(500).json({ error: "Failed to fetch revenue data" });
  }
});

export default router;
