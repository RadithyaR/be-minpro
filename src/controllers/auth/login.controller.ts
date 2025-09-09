import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { token } from "morgan";

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Cari user + role tunggal
    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Cek password
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: "Invalid Password" });
    }

    // Cari eventId (kalau ada)
    const events = await prisma.event.findMany({
      where: { userId: user.id },
      select: { id: true },
    });

    const eventIds = events.map(e => e.id); 

    // Role aktif default dari DB
    const activeRole = user.role.name as "customer" | "event_organizer";

    // Generate token untuk role aktif
    const activeToken = jwt.sign(
      { userId: user.id, role: activeRole },
      process.env.JWT_SECRET!,
      { expiresIn: "1d" }
    );

    // Tambahin role lain secara manual
    const allRoles: ("customer" | "event_organizer")[] =
      activeRole === "customer"
        ? ["customer", "event_organizer"]
        : ["event_organizer", "customer"];

    const accounts = allRoles.map((role) => ({
      id: user.id,
      role,
      token: jwt.sign({ userId: user.id, role }, process.env.JWT_SECRET!, {
        expiresIn: "1d",
      }),
    }));

    // Response ke frontend
    return res.json({
      message: "Login success",
      token: activeToken,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: activeRole,
      },
      accounts,
      eventId : eventIds.length > 0 ? eventIds : null,
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
