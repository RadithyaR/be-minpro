import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        role: true, //JOIN ke tabel roles
      },
    });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const accounts = [
      {
        id: user.id,
        role: user.role.name,
        token: jwt.sign(
          { userId: user.id, role: user.role.name },
          process.env.JWT_SECRET!,
          { expiresIn: "1d" }
        ),
      },
    ];

    return res.json({ message: "Login success", accounts });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
