import express, { Application, json, urlencoded } from "express";
import cors from "cors";
import morgan from "morgan";

// routes
import authRouter from "./routes/auth.routes";


// import userRouter from "./routes/user.routes";
import eventRouter from "./routes/event.routes";
import voucherRouter from "./routes/voucher.routes";
import transactionRouter from "./routes/transaction.routes";
import reviewRouter from "./routes/review.routes";

// Dashboard
import revenueRouter from "./routes/revenue.routes";
import attendeeRouter from "./routes/attendees.routes";
import overviewRouter from "./routes/overview.routes";
import topEventRoutes from "./routes/topevents.routes";
import transactionStatusRoutes from "./routes/transactionstatus.routes";
import profileRouter from "./routes/profile.routes";



export default class App {
  private app: Application;

  constructor() {
    this.app = express();

    this.configure();
    this.routes();
    this.errorHandling();
  }

  private configure(): void {
    this.app.use(cors());
    this.app.use(json());
    this.app.use(urlencoded({ extended: true }));
    this.app.use(express.static("public"));
    this.app.use(morgan("dev")); // logging
  }

  private routes(): void {
    this.app.use("/auth", authRouter);
    this.app.use("/", eventRouter);
    this.app.use("/voucher", voucherRouter);
    this.app.use("/transaction", transactionRouter);
    this.app.use("/review", reviewRouter);
    this.app.use("/api/revenue", revenueRouter);
    this.app.use("/api/attendees", attendeeRouter);
    this.app.use("/api/overview", overviewRouter);
    this.app.use("/api/topevents", topEventRoutes);
    this.app.use("/api/transactions/status", transactionStatusRoutes);
    this.app.use("/api/event", eventRouter);
    this.app.use("/api/transactions", transactionRouter);
    this.app.use("/api/profile", profileRouter);

  }

  private errorHandling(): void {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({ error: "Route not found" });
    });

    // global error handler
    this.app.use(
      (
        err: any,
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
      ) => {
        console.error("Unhandled Error:", err);
        res.status(500).json({ error: "Internal server error" });
      }
    );
  }

  public start(port: number = 8000): void {
    this.app.listen(port, () => {
      console.log(`[API] Server running on http://localhost:${port}`);
    });
  }
}
