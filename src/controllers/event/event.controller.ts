import { NextFunction, Request, Response } from "express";
import prisma from "../../lib/prisma";
import { Event } from "@prisma/client";

// // CREATE Event (Organizer only)
export const createEvent = async (req: Request, res: Response) => {
  try {
    // console.log("Request body:", req.body);
    // console.log("Request files:", req.file);
    const userId = (req as any).user.userId;
    console.log(userId);
    const eventImage = req.file ? req.file.path : null;

    const {
      name,
      description,
      startDate,
      endDate,
      locationType,
      address,
      city,
      link,
      price,
      availableSeats,
    } = req.body;

    //validasi tipe lokasi
    if (locationType === "offline" && (!address || !city)) {
      return res.status(400).json({
        error: "Address and city are required for offline events",
      });
    }

    if (locationType === "online" && !link) {
      return res.status(400).json({
        error: "Link is required for online events",
      });
    }

    const event = await prisma.event.create({
      data: {
        name: name,
        description: description,
        eventImage: eventImage,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        locationType: locationType,
        address: address,
        city: city,
        link: link,
        price: Number(price),
        availableSeats: Number(availableSeats),
        userId: userId,
      },
    });

    return res.status(201).json({ message: "Event created", event });
  } catch (err) {
    console.error("Create event error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// // GET all events (Public)
export const getEvents = async (req: Request, res: Response) => {
  try {
    const events = await prisma.event.findMany({ include: { user: true } });

    const eventsWithStatus = events.map((event) => {
      const now = new Date();
      const startDate = new Date(event.startDate);
      const endDate = new Date(event.endDate);

      let status: string;

      if (now < startDate) {
        status = "upcoming"; // jika belum mulai status upcoming
      } else if (now >= startDate && now <= endDate) {
        status = "ongoing"; // jika sedang berjalan status ongoing
      } else {
        status = "finished"; //jika selesai status finished
      }

      return {
        ...event,
        status, // field virtual untuk status event
      };
    });

    return res.json(eventsWithStatus);
  } catch (err) {
    console.error("Get events error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// GET events by organizer (Organizer only)
export const getEventsByOrganizer = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const events = await prisma.event.findMany({
      where: {
        userId: userId, // Filter by organizer's user ID
      },
      include: {
        user: true,
        transactions: {
          include: {
            status: true,
          },
        },
        reviews: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Tambahkan status virtual dan statistics
    const eventsWithDetails = events.map((event) => {
      const now = new Date();
      const startDate = new Date(event.startDate);
      const endDate = new Date(event.endDate);

      let status: string;
      if (now < startDate) status = "upcoming";
      else if (now >= startDate && now <= endDate) status = "ongoing";
      else status = "finished";

      // Hitung statistics
      const totalTransactions = event.transactions.length;
      const completedTransactions = event.transactions.filter(
        (t) => t.status.name === "DONE"
      ).length;
      const totalRevenue = event.transactions
        .filter((t) => t.status.name === "DONE")
        .reduce((sum, t) => sum + t.finalAmount, 0);

      const averageRating =
        event.reviews.length > 0
          ? event.reviews.reduce((sum, r) => sum + r.rating, 0) /
            event.reviews.length
          : 0;

      return {
        ...event,
        status,
        statistics: {
          totalTransactions,
          completedTransactions,
          totalRevenue,
          averageRating: Math.round(averageRating * 10) / 10, // 1 decimal place
          availableSeats: event.availableSeats,
          totalSeats: event.availableSeats + totalTransactions, // assuming initial quota
        },
      };
    });

    return res.json({
      message: "Organizer events retrieved successfully",
      data: eventsWithDetails,
    });
  } catch (err) {
    console.error("Get organizer events error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// // GET event by ID (Public)
export const getEventById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const event = await prisma.event.findUnique({
      where: { id: Number(id) },
      include: { user: { select: { fullName: true } } },
    });
    if (!event) return res.status(404).json({ error: "Event not found" });

    // status virtual
    const now = new Date();
    const startDate = new Date(event.startDate);
    const endDate = new Date(event.endDate);

    let status: string;

    if (now < startDate) {
      status = "upcoming";
    } else if (now >= startDate && now <= endDate) {
      status = "ongoing";
    } else {
      status = "finished";
    }

    const eventWithStatus = {
      ...event,
      status,
    };

    return res.json(eventWithStatus);
  } catch (err) {
    console.error("Get event error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// // UPDATE event (Organizer only)
export const updateEvent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const event = await prisma.event.findUnique({ where: { id: Number(id) } });

    if (!event) return res.status(404).json({ error: "Event not found" });

    const updatedEvent = await prisma.event.update({
      where: { id: Number(id) },
      data,
    });

    return res.json({ message: "Event updated", event: updatedEvent });
  } catch (err) {
    console.error("Update event error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// // DELETE event (Organizer only)
export const deleteEvent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const event = await prisma.event.findUnique({ where: { id: Number(id) } });
    if (!event) return res.status(404).json({ error: "Event not found" });

    await prisma.event.delete({ where: { id: Number(id) } });

    return res.json({ message: "Event deleted" });
  } catch (err) {
    console.error("Delete event error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
