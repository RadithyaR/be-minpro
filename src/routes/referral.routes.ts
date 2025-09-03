import { Router } from "express";
import { register } from "../controllers/auth/register.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import { getMyReferrals } from "../controllers/referral/referral.controller";

const router = Router();

/* ========================
   🔹 AUTH ROUTES
======================== */
router.post("/register", register);

// Lihat siapa saja yang pakai referral code user
router.get("/my-referrals", authMiddleware(["customer"]), getMyReferrals);

export default router;
