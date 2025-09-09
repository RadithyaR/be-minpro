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

/**
 * Auth middleware
 * @param roles - opsional, daftar role yang boleh akses
 */
export const authMiddleware = (roles: string[] = []): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(" ")[1];
    const role = req.headers.role; // Ambil role dari header
    if (!token) return res.status(401).json({ error: "No token provided" });

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
        userId: number;
        role: string;
      };

      req.user = decoded;

      // kalau roles ada isinya, cek role user
      if (roles != role) {
        return res.status(403).json({ error: "Forbidden: insufficient role"});
      }

      next();
    } catch (err) {
      return res.status(401).json({ error: "Invalid token" });
    }
  };
};
