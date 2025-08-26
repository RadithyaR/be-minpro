import express, {
  Application,
  json,
  NextFunction,
  Request,
  Response,
  urlencoded,
} from "express";
import cors from "cors";

const PORT = 8000;

export default class App {
  private app: Application;

  constructor() {
    this.app = express();

    this.configure();
  }

  private configure(): void {
    this.app.use(cors());
    this.app.use(json());
    this.app.use(urlencoded({ extended: true }));
    this.app.use(express.static("public"));
  }

  public start(): void {
    this.app.listen(PORT, () =>
      console.log(`[API] Local: http://localhost:${PORT}`)
    );
  }
}
