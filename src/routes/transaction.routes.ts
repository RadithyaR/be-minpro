import { Router } from "express";

import { authMiddleware } from "../../middleware/auth.middleware";
import { singleFile } from "../utils/uploader";
import {
  acceptTransaction,
  createTransaction,
  getTransactions,
  getEventTransactions,
  getTransactionById,
  getUserTransactions,
  rejectTransaction,
  uploadPaymentProof,
  approveTransaction,
  cancelAfterDone,
  // refundTransaction,
} from "../controllers/event/transaction.controller";

const router = Router();

router.post("/", authMiddleware(["customer"]), createTransaction);
router.get(
  "/user",
  authMiddleware(["customer", "event_organizer"]),
  getUserTransactions
);
router.get(
  "/",
  authMiddleware(["customer", "event_organizer"]),
  getTransactions
);
router.get(
  "/:id",
  authMiddleware(["customer", "event_organizer"]),
  getTransactionById
);
router.post(
  "/:id/payment",
  authMiddleware(["customer"]),
  singleFile("pp", "payment-proof", "paymentProof"),
  uploadPaymentProof
);

router.patch(
  "/:id/approve",
  authMiddleware(["customer", "event_organizer"]),
  approveTransaction
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

router.patch("/:id/cancel", authMiddleware(["event_organizer", "customer"]), cancelAfterDone);
// router.patch(
//   "/:id/refund",
//   authMiddleware(["event_organizer"]),
//   refundTransaction
// );

export default router;
