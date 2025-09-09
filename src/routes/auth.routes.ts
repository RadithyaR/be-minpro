import { Router } from "express";

// Controllers
import { register } from "../controllers/auth/register.controller";
import { login } from "../controllers/auth/login.controller";
import { updateProfile } from "../controllers/auth/profile.controller";
import {
  getUserCoupon,
  getUserPoint,
  getUserPointsAndCoupons,
} from "../controllers/auth/points-coupons.controller";
import { forgotPassword } from "../controllers/auth/forgot-password.controllers";
import { resetPassword } from "../controllers/auth/reset-password.controllers";

// Middleware
import { authMiddleware } from "../../middleware/auth.middleware";

const router = Router();

// Auth
router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// Profile
router.put("/profile", authMiddleware, updateProfile);

// User Points & Coupons
router.get("/points-coupons", authMiddleware(), getUserPointsAndCoupons);
router.get("/points", authMiddleware(), getUserPoint);
router.get("/coupons", authMiddleware(), getUserCoupon);

export default router;
