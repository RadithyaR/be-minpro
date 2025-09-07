import { Router } from "express";

import { authMiddleware } from "../../middleware/auth.middleware";
import { singleFile } from "../utils/uploader";
import {
  acceptTransaction,
  createTransaction,
  getEventTransactions,
  getTransactionById,
  getUserTransactions,
  rejectTransaction,
  uploadPaymentProof,
} from "../controllers/event/transaction.controller";

const router = Router();

router.post("/", authMiddleware(["customer"]), createTransaction);
router.get("/", authMiddleware(["customer"]), getUserTransactions);
router.get("/:id", authMiddleware(["customer"]), getTransactionById);
router.post(
  "/:id/payment",
  authMiddleware(["customer"]),
  singleFile("pp", "payment-proof", "paymentProof"),
  uploadPaymentProof
);

router.get(
  "/event/:eventId",
  authMiddleware(["event_organizer"]),
  getEventTransactions
);
router.patch(
  "/:id/accept",
  authMiddleware(["event_organizer"]),
  acceptTransaction
);
router.patch(
  "/:id/reject",
  authMiddleware(["event_organizer"]),
  rejectTransaction
);

export default router;
