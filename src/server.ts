import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import authRoutes from "./routes/auth.routes";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: "http://localhost:3000", credentials: true }));

// routes
app.use("/", authRoutes);

app.get("/", (req, res) => {
  res.send("API running...");
});

app.listen(PORT, () => {
  console.log(`Server running is on http://localhost:${PORT}`);
});
