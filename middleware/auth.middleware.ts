import { Request, Response, NextFunction, RequestHandler } from "express";
import jwt from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: number;
        role: string;
      };
    }
  }
}

export const authMiddleware = (roles: string[] = []): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    let token: string | undefined;
    if (!authHeader) {
      return res.status(401).json({ error: "No token provided" });
    }

    try {
      token = authHeader.split(" ")[1];
        if (!token) {
          return res.status(401).json({ error: "Malformed token" });
        }
    } catch (err) {
      return res.status(401).json({ error: "Invalid token" });
    }
    

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "default_secret") as {
        userId: number;
        role: string;
      };

      req.user = decoded;

      if (roles.length > 0 && !roles.includes(decoded.role)) {
        return res.status(403).json({ error: "Forbidden: insufficient role" });
      }

      next();
    } catch (err) {
      return res.status(401).json({ error: "Invalid token" });
    }
  };
};
