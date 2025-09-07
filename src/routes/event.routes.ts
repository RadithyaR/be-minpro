import { Router } from "express";
import {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
} from "../controllers/event/event.controller";

import {
  getMyEvents,
  getEventStatistics,
} from "../controllers/event/dashboard.controller";

import { getAttendees } from "../controllers/event/attendee.controller";

import { authMiddleware } from "../../middleware/auth.middleware";
import { singleFile } from "../utils/uploader";

const router = Router();

/* ========================
   🔹 PUBLIC ROUTES (semua user)
======================== */
router.get("/events", getEvents);
router.get("/events/:id", authMiddleware(), getEventById);

/* ========================
   🔹 ORGANIZER ONLY ROUTES
======================== */
// event
router.post(
  "/events",
  authMiddleware(["event_organizer"]),
  singleFile("evt", "event-images", "eventImage"),
  createEvent
);
router.put("/events/:id", authMiddleware(["event_organizer"]), updateEvent);
router.delete("/events/:id", authMiddleware(["event_organizer"]), deleteEvent);

// // Dashboard & stats
router.get(
  "/dashboard/my-events",
  authMiddleware(["event_organizer"]),
  getMyEvents
);
router.get(
  "/dashboard/statistics",
  authMiddleware(["event_organizer"]),
  getEventStatistics
);

// // Attendees
router.get(
  "/events/:eventId/attendees",
  authMiddleware(["event_organizer"]),
  getAttendees
);

export default router;
