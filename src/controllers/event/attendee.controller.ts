import { Request, Response } from "express";
import prisma from "../../lib/prisma";

// Get attendees for event
export const getAttendees = async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;

    const attendees = await prisma.transaction.findMany({
      where: {
        eventId: Number(eventId),
        status: {
          name: "ACCEPTED", // ✅ filter berdasarkan nama status di tabel PaymentStatus
        },
      },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
      },
    });

    return res.json(attendees);
  } catch (err) {
    console.error("Get attendees error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
