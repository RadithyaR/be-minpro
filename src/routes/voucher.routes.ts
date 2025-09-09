import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import {
  createVoucher,
  deleteVoucher,
  getEventVoucher,
  getUserVoucher,
  getVoucherById,
  testAuth,
  updateVoucher,
  useVoucher,
  validateVoucher,
} from "../controllers/event/voucher.controller";

const router = Router();

/* ========================
   🔹 ORGANIZER ONLY ROUTES
======================== */
// Voucher routes
router.post("/", authMiddleware(["event_organizer"]), createVoucher);
router.get("/", authMiddleware(), getUserVoucher);
router.get("/:id", authMiddleware(), getVoucherById);
router.get("/event/:eventId", getEventVoucher);
router.put("/:id", authMiddleware(["event_organizer"]), updateVoucher);
router.delete("/:id", authMiddleware(["event_organizer"]), deleteVoucher);
router.post("/validate", authMiddleware(["customer"]), validateVoucher);
router.post("/use", authMiddleware(["customer"]), useVoucher);

router.get("/debug/auth", authMiddleware(), testAuth);

export default router;
