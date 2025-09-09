import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import revenueRoutes from "./routes/revenue.routes";
import attendeeRoutes from "./routes/attendees.routes";
import overviewRoutes from "./routes/overview.routes";
import topEventRoutes from "./routes/topevents.routes";
import transactionStatusRoutes from "./routes/transactionstatus.routes";
import eventRouter from "./routes/event.routes";

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
app.use("/api/revenue", revenueRoutes);
app.use("/api/attendees", attendeeRoutes);
app.use("/api/overview", overviewRoutes);
app.use("/api/topevents", topEventRoutes);
app.use("/api/transactions/status", transactionStatusRoutes);
app.use("/api/event", eventRouter);

app.get("/", (req, res) => {
  res.send("API running...");
});

app.listen(PORT, () => {
  console.log(`Server running is on http://localhost:${PORT}`);
});
