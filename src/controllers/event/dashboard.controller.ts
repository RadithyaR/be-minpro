import { Request, Response } from "express";
import prisma from "../../lib/prisma";

// 🔹 Get all events owned by organizer
export const getMyEvents = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    const events = await prisma.event.findMany({
      where: { userId },
    });

    return res.json(events);
  } catch (err) {
    console.error("Get my events error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// 🔹 Statistik transaksi berdasarkan status
export const getEventStatistics = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { period } = req.query as { period?: string }; // "year", "month", "day"

    // group transaksi berdasarkan statusId
    const stats = await prisma.transaction.groupBy({
      by: ["statusId"], // ✅ pakai statusId
      _count: {
        _all: true, // ✅ ambil total count
      },
      where: {
        event: { userId },
      },
    });

    // ambil mapping statusId -> status.name
    const statuses = await prisma.paymentStatus.findMany({
      where: { id: { in: stats.map((s) => s.statusId) } },
    });

    // gabungkan hasil
    const result = stats.map((s) => {
      const status = statuses.find((st) => st.id === s.statusId);
      return {
        statusId: s.statusId,
        statusName: status?.name ?? "UNKNOWN",
        count: s._count._all, // ✅ ambil angka dari _count._all
      };
    });

    return res.json({
      period, // sementara cuma dikembalikan
      stats: result,
    });
  } catch (err) {
    console.error("Get stats error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
