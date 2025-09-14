import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router();

router.get("/", async (req, res) => {
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

const attendees = await prisma.transaction.findMany({
  where: {
    statusId: 5, // hanya yang DONE
    eventId: {
      in: eventIds && eventIds.length > 0 ? eventIds : [], // kosong → hasil 0
    },
  },
  include: {
    user: { select: { fullName: true } },
    event: { select: { name: true } },
  },
  orderBy: { createdAt: "desc" },
});
    // format ke bentuk yg diinginkan frontend


    const formatted = attendees.map((t) => ({
      name: t.user.fullName,
      qty: t.quantity,
      price: `Rp.${t.finalAmount}`,
      event: t.event.name,
    }));

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch attendees" });
  }
});

export default router;
