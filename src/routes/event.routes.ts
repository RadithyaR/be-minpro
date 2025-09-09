import { Router } from "express";
import {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  getEventsByOrganizer,
  upload,
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
router.get("/event-detail/:id", getEventById);

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
router.get(
  "/getEventsByOrganizer",
  authMiddleware(["event_organizer"]),
  getEventsByOrganizer
);
router.put("/updateEvent/:id", authMiddleware(["event_organizer"]), upload.single("eventImage"), updateEvent);
router.delete("/deleteEvent/:id", authMiddleware(["event_organizer"]), deleteEvent);

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
