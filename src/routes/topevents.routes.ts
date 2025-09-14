import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

/**
 *
 * return event dengan penjualan tiket terbanyak
 */
router.get("/", async (req, res) => {
  try {
    // ambil eventId dari query string
    const { eventId } = req.query;

    // kalau ada eventId, convert ke array number
    let eventIds: number[] | undefined;
    if (eventId) {
      eventIds = String(eventId)
        .split(",")         // "123,456" → ["123","456"]
        .map((id) => Number(id))
        .filter((id) => !isNaN(id));
    }

    const events = await prisma.event.findMany({
      where: eventIds ? { id: { in: eventIds } } : undefined,
      include: {
        transactions: {
          where: {
            statusId: 5, // hanya yang sudah dibayar
          },
        },
      },
    });

    const data = events.map((e) => {
      const tickets = e.transactions.reduce(
        (sum, tx) => sum + tx.quantity,
        0
      );
      const revenue = e.transactions.reduce(
        (sum, tx) => sum + tx.finalAmount,
        0
      );

      return {
        name: e.name,
        tickets,
        revenue,
      };
    });

    // sort by tickets & ambil 5 besar
    data.sort((a, b) => b.tickets - a.tickets);
    res.json(data.slice(0, 5));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch top events" });
  }
});


export default router;
