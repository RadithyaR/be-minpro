
import express from "express";
import { getProfile, updateProfile, uploadProfile } from "../controllers/auth/profile.controller";
import { authMiddleware } from "../../middleware/auth.middleware";
import multer from "multer";
import path from "path";

const router = express.Router();

// Konfigurasi multer untuk upload avatar
const storage = multer.diskStorage({
  destination: path.join(__dirname, "../../public/profile"),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// GET profile
router.get("/", authMiddleware(['customer','event_organizer']), getProfile);


// PUT profile (dengan upload avatar opsional)
router.put("/", authMiddleware(['customer','event_organizer']), uploadProfile.single("profilePicture"), updateProfile);

export default router;
