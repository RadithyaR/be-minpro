import { NextFunction, Request, Response } from "express";
import prisma from "../../lib/prisma";
import EventService from "../../services/event.service";
import { Event } from "@prisma/client";

// // CREATE Event (Organizer only)
export const createEvent = async (req: Request, res: Response) => {
  try {
    console.log("Request body:", req.body);
    console.log("Request files:", req.file);
    const userId = (req as any).user.userId;
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
      quota,
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
        availableSeats: Number(quota),
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
    return res.json(events);
  } catch (err) {
    console.error("Get events error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// // GET event by ID (Public)
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

// // UPDATE event (Organizer only)
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

// // DELETE event (Organizer only)
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
