import { Request, Response } from "express";
import prisma from "../../lib/prisma";

// CREATE Event (Organizer only)
export const createEvent = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { title, description, date, location, price, quota } = req.body;

    const event = await prisma.event.create({
      data: { name: title, description, startDate: date, endDate: date, locationId: location, price, availableSeats: quota, userId: userId },
    });

    return res.status(201).json({ message: "Event created", event });
  } catch (err) {
    console.error("Create event error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// GET all events (Public)
export const getEvents = async (req: Request, res: Response) => {
  try {
    const events = await prisma.event.findMany({ include: { user: true } });
    return res.json(events);
  } catch (err) {
    console.error("Get events error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// GET event by ID (Public)
export const getEventById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const event = await prisma.event.findUnique({ where: { id: Number(id) } });
    if (!event) return res.status(404).json({ error: "Event not found" });
    return res.json(event);
  } catch (err) {
    console.error("Get event error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// UPDATE event (Organizer only)
export const updateEvent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = req.body;

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

// DELETE event (Organizer only)
export const deleteEvent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.event.delete({ where: { id: Number(id) } });

    return res.json({ message: "Event deleted" });
  } catch (err) {
    console.error("Delete event error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
