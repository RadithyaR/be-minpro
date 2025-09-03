import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import { sendEmail } from "../../utils/email";

export const acceptTransaction = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const transaction = await prisma.transaction.update({
      where: { id: Number(id) },
      data: { statusId: 2 }, 
      include: { user: true, event: true },
    });

    // kirim email ke user
    await sendEmail(
      transaction.user.email,
      "Transaction Accepted",
      `Hi ${transaction.user.fullName},\n\nYour transaction for event "${transaction.event.name}" has been accepted.\n\nCheers,\nEvent App`
    );

    return res.json({ message: "Transaction accepted", transaction });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const rejectTransaction = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const transaction = await prisma.transaction.update({
      where: { id: Number(id) },
      data: { statusId: 3 },
      include: { user: true, event: true },
    });

    await sendEmail(
      transaction.user.email,
      "Transaction Rejected",
      `Hi ${transaction.user.fullName},\n\nYour transaction for event "${transaction.event.name}" has been rejected. Points/coupons used are returned.\n\nCheers,\nEvent App`
    );

    return res.json({ message: "Transaction rejected", transaction });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
};
