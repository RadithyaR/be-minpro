import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import {
  startOfDay, endOfDay,
  startOfMonth, endOfMonth,
  startOfYear, endOfYear
} from "date-fns";

const prisma = new PrismaClient();
const router = Router();

router.get("/", async (req, res) => {
  try {
    const { period } = req.query;
    const now = new Date();

    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (period === "day") {
      startDate = startOfDay(now);
      endDate = endOfDay(now);
    } else if (period === "month") {
      startDate = startOfMonth(now);
      endDate = endOfMonth(now);
    } else if (period === "year") {
      startDate = startOfYear(now);
      endDate = endOfYear(now);
    }

    const { eventId } = req.query;

    // kalau ada eventId, convert ke array number
    let eventIds: number[] | undefined;
    if (eventId) {
      eventIds = String(eventId)
        .split(",")         // "123,456" → ["123","456"]
        .map((id) => Number(id))
        .filter((id) => !isNaN(id));
    }

    const whereFilter = startDate && endDate
    ? {
        createdAt: { gte: startDate, lte: endDate },
        statusId: 5, // langsung pakai FK, bukan relasi
        eventId: eventIds ? { in: eventIds } : undefined
      }
    : {
        statusId: 5, // langsung pakai FK, bukan relasi
        eventId: eventIds ? { in: eventIds } : undefined
      };


    // total revenue
    const revenueResult = await prisma.transaction.aggregate({
      _sum: { finalAmount: true },
      where: whereFilter
    });

    // total attends
    const attendResult = await prisma.transaction.aggregate({
      _sum: { quantity: true },
      where: whereFilter
    });

    // total events hosted
    const eventFilter = {
    ...(startDate && endDate
      ? { startDate: { gte: startDate, lte: endDate } }
      : {}),
    ...(eventIds
      ? eventIds.length > 0
        ? { id: { in: eventIds } }
        : { id: { in: [] } } // kalau kosong = ga ada hasil
      : { id: { in: [] } }), // kalau null juga = ga ada hasil
};


const eventCount = await prisma.event.count({ where: eventFilter });


    res.json({
      totalRevenue: revenueResult._sum.finalAmount || 0,
      totalAttends: attendResult._sum.quantity || 0,
      eventsHosted: eventCount,
      period: period || "all"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch overview data" });
  }
});

export default router;
