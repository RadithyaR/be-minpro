import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { processReferral } from "../referral/referral.controller";
import { sendEmail } from "../../utils/email"; // util untuk kirim email

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, fullName, referralCode } = req.body;

    // cek email sudah dipakai
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser)
      return res.status(400).json({ error: "Email already in use" });

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // ambil role default "customer"
    const roleCustomer = await prisma.role.findFirst({
      where: { name: "customer" },
    });
    if (!roleCustomer)
      return res.status(400).json({ error: "Default customer role not found" });

    // buat user baru
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        fullName,
        roleId: roleCustomer.id,
      },
    });

    // proses referral (bonus poin, kupon, dsb)
    const newReferralCode = await processReferral(newUser, referralCode);

    // kirim email ke user baru, tapi aman kalau SMTP belum dikonfigurasi
    try {
      if (
        referralCode &&
        process.env.SMTP_HOST &&
        process.env.SMTP_USER &&
        process.env.SMTP_PASS
      ) {
        await sendEmail(
          newUser.email,
          "Selamat! Anda mendapat kupon",
          `Hi ${newUser.fullName},\nAnda mendapat kupon Rp20.000 karena mendaftar dengan referral code.\nKode referral Anda: ${newReferralCode}`
        );
      }
    } catch (emailErr) {
      console.warn("Email gagal dikirim:", emailErr);
    }

    // generate JWT token
    const token = jwt.sign(
      { userId: newUser.id, role: "customer" },
      process.env.JWT_SECRET!,
      { expiresIn: "1d" }
    );

    return res.status(201).json({
      message: "Account created successfully",
      referralCode: newReferralCode,
      token,
    });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
