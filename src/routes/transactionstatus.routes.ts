import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

/**
 * 
 * return jumlah transaksi per status
 */
router.get("/status", async (req, res) => {
  try {
    // ambil eventId dari query (?eventId=1,2,3)
const { eventId } = req.query;
let eventIds: number[] | undefined;

if (eventId) {
  eventIds = String(eventId)
    .split(",")
    .map((id) => Number(id))
    .filter((id) => !isNaN(id));
}

const statuses = await prisma.paymentStatus.findMany({
  include: {
    _count: {
      select: {
        transactions: {
          where: {
            eventId: { in: eventIds && eventIds.length > 0 ? eventIds : [] }
          },
        },
      },
    },
  },
});

    // format ke bentuk yg diinginkan frontend
    const data = statuses.map((s) => ({
      name: s.name,
      value: s._count.transactions,
    }));

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch transaction status" });
  }
});

/**
 * 
 * recent transaction 5 transaksi terbaru
 */
router.get("/recent", async (req, res) => {
  try {
    // ambil eventId dari query (?eventId=1,2,3)
const { eventId } = req.query;
let eventIds: number[] | undefined;

  if (eventId) {
    eventIds = String(eventId)
      .split(",")
      .map((id) => Number(id))
      .filter((id) => !isNaN(id));
  }

  const tx = await prisma.transaction.findMany({
    where: {
      eventId: {
        in: eventIds && eventIds.length > 0 ? eventIds : [], // kalau kosong → hasil 0
      },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: {
      user: true,
      event: true,
      status: true,
    },
  });
    // format ke bentuk yg diinginkan frontend

    const data = tx.map((t) => ({
      user: t.user.fullName,
      event: t.event.name, 
      amount: t.finalAmount, 
      status: t.status.name, 
      date: t.createdAt.toISOString().split("T")[0],
    }));

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch recent transactions" });
  }
});

export default router;
