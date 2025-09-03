import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const accounts = [
      {
        id: user.id,
        role: "customer",
        token: jwt.sign({ userId: user.id, role: "customer" }, process.env.JWT_SECRET!, { expiresIn: "1d" }),
      },
      {
        id: user.id,
        role: "event_organizer",
        token: jwt.sign({ userId: user.id, role: "event_organizer" }, process.env.JWT_SECRET!, { expiresIn: "1d" }),
      },
    ];

    return res.json({ message: "Login success", accounts });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
