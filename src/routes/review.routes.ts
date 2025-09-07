import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import {
  createReview,
  deleteReview,
  getEventReviews,
  getOrganizerEventReviews,
  getReviewById,
  getUserReviews,
  updateReview,
} from "../controllers/event/review.controller";

const router = Router();

/* ========================
   🔹 PUBLIC ROUTES (semua user)
======================== */

router.get("/event/:eventId", getEventReviews);
router.get("/:id", getReviewById);

/* ========================
   🔹 CUSTOMER ROUTES 
======================== */
router.post("/", authMiddleware(["customer"]), createReview);
router.get("/user/my-reviews", authMiddleware(["customer"]), getUserReviews);
router.put("/:id", authMiddleware(["customer"]), updateReview);
router.delete("/:id", authMiddleware(["customer"]), deleteReview);

/* ========================
   🔹 ORGANIZER ROUTES 
======================== */
router.get(
  "/organizer/event/:eventId",
  authMiddleware(["event_organizer"]),
  getOrganizerEventReviews
);

export default router;
