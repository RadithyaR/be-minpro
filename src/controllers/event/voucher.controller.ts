import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import { error } from "console";

//create voucher
export const createVoucher = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    const { eventId, nominal, quota } = req.body;

    if (!eventId || !nominal || !quota) {
      return res.status(400).json({
        error: "Missing required Field",
      });
    }

    //validasi event
    const event = await prisma.event.findUnique({
      where: { id: Number(eventId) },
    });

    if (!event) {
      return res.status(404).json({
        error: "Event Not Found",
      });
    }

    if (event.userId !== userId) {
      return res.status(403).json({
        error: "You can only create voucher for your own events",
      });
    }

    // Validasi nominal tidak negatif
    if (Number(nominal) <= 0) {
      return res.status(400).json({ error: "Nominal must be greater than 0" });
    }

    // Validasi quota tidak negatif
    if (Number(quota) <= 0) {
      return res.status(400).json({ error: "Quota must be greater than 0" });
    }

    //create voucher
    const voucher = await prisma.voucher.create({
      data: {
        userId: userId,
        eventId: Number(eventId),
        nominal: Number(nominal),
        quota: Number(quota),
      },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            price: true,
            startDate: true,
            endDate: true,
          },
        },
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    res.status(201).json({
      message: "Voucher created successfully",
      data: voucher,
    });
  } catch (error) {
    console.error("Create voucher error:", error);
    res.status(500).json({ error: "Failed to create voucher" });
  }
};

//get voucher for user
export const getUserVoucher = async (req: Request, res: Response) => {
  try {
    // console.log("Req.user:", req.user);
    // console.log("Req headers:", req.headers);

    const userId = req.user!.userId;

    // console.log("Extracted userId:", userId);

    const vouchers = await prisma.voucher.findMany({
      where: { userId: userId },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            price: true,
            startDate: true,
            endDate: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      message: "User vouchers retrieved successfully",
      data: vouchers,
    });
  } catch (error) {
    console.error("Get event vouchers error:", error);
    res.status(500).json({ error: "Failed to fetch vouchers" });
  }
};

// GET voucher by ID
export const getVoucherById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const voucher = await prisma.voucher.findUnique({
      where: { id: Number(id) },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            price: true,
            startDate: true,
            endDate: true,
            locationType: true,
          },
        },
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    if (!voucher) {
      return res.status(404).json({ error: "Voucher not found" });
    }

    // Customer hanya bisa melihat voucher mereka sendiri
    // Organizer bisa melihat voucher mereka sendiri atau voucher untuk event mereka
    if (req.user!.role === "customer" && voucher.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Untuk organizer, cek jika voucher adalah milik mereka atau untuk event mereka
    if (req.user!.role === "event_organizer") {
      if (voucher.userId !== userId) {
        // Cek jika voucher untuk event yang dimiliki organizer
        const event = await prisma.event.findUnique({
          where: { id: voucher.eventId },
        });
        if (!event || event.userId !== userId) {
          return res.status(403).json({ error: "Access denied" });
        }
      }
    }

    res.json({
      message: "Voucher retrieved successfully",
      data: voucher,
    });
  } catch (error) {
    console.error("Get voucher error:", error);
    res.status(500).json({ error: "Failed to retrieve voucher" });
  }
};

// get voucher pada event
export const getEventVoucher = async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;

    // Validasi event ownership
    const event = await prisma.event.findUnique({
      where: { id: Number(eventId) },
    });

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    ///get event
    const vouchers = await prisma.voucher.findMany({
      where: { eventId: Number(eventId) },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        event: {
          select: {
            id: true,
            name: true,
            price: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      message: "Event vouchers retrieved successfully",
      data: vouchers,
    });
  } catch (error) {
    console.error("Get event vouchers error:", error);
    res.status(500).json({ error: "Failed to retrieve event vouchers" });
  }
};

// update voucher (Event Organizer )
export const updateVoucher = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { nominal, quota } = req.body;

    if (req.user!.role !== "event_organizer") {
      return res.status(403).json({ error: "Access denied. Organizer only." });
    }

    // Cari voucher
    const voucher = await prisma.voucher.findUnique({
      where: { id: Number(id) },
      include: {
        event: true,
      },
    });

    if (!voucher) {
      return res.status(404).json({ error: "Voucher not found" });
    }

    // Validasi ownership, hanya organizer pemilik voucher
    if (voucher.userId !== userId) {
      return res
        .status(403)
        .json({ error: "Access denied. Not your voucher." });
    }

    const updateData: any = {};

    if (nominal !== undefined) {
      if (Number(nominal) <= 0) {
        return res
          .status(400)
          .json({ error: "Nominal must be greater than 0" });
      }
      updateData.nominal = Number(nominal);
    }

    if (quota !== undefined) {
      if (Number(quota) <= 0) {
        return res.status(400).json({ error: "Quota must be greater than 0" });
      }
      updateData.quota = Number(quota);
    }

    const updatedVoucher = await prisma.voucher.update({
      where: { id: Number(id) },
      data: updateData,
      include: {
        event: {
          select: {
            id: true,
            name: true,
            price: true,
          },
        },
      },
    });

    res.json({
      message: "Voucher updated successfully",
      data: updatedVoucher,
    });
  } catch (error) {
    console.error("Update voucher error:", error);
    res.status(500).json({ error: "Failed to update voucher" });
  }
};

//Delete voucher
export const deleteVoucher = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    if (req.user!.role !== "event_organizer") {
      return res.status(403).json({ error: "Access denied. Organizer only." });
    }

    // Cari voucher
    const voucher = await prisma.voucher.findUnique({
      where: { id: Number(id) },
    });

    if (!voucher) {
      return res.status(404).json({ error: "Voucher not found" });
    }

    // Validasi ownership, hanya organizer pemilik voucher
    if (voucher.userId !== userId) {
      return res
        .status(403)
        .json({ error: "Access denied. Not your voucher." });
    }

    await prisma.voucher.delete({
      where: { id: Number(id) },
    });

    res.json({ message: "Voucher deleted successfully" });
  } catch (error) {
    console.error("Delete voucher error:", error);
    res.status(500).json({ error: "Failed to delete voucher" });
  }
};

// validasi voucher utk transaction (Customer only)
export const validateVoucher = async (req: Request, res: Response) => {
  try {
    const { voucherId, eventId } = req.body;
    const userId = req.user!.userId;

    if (req.user!.role !== "customer") {
      return res.status(403).json({ error: "Access denied. Customer only." });
    }

    if (!voucherId || !eventId) {
      return res.status(400).json({
        error: "voucherId and eventId are required",
      });
    }

    const voucher = await prisma.voucher.findUnique({
      where: { id: Number(voucherId) },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            price: true,
            startDate: true,
            endDate: true,
          },
        },
      },
    });

    if (!voucher) {
      return res.status(404).json({ error: "Voucher not found" });
    }

    // Validasi ownership, hanya customer pemilik voucher
    if (voucher.userId !== userId) {
      return res.status(403).json({ error: "This voucher is not yours" });
    }

    // Validasi event
    if (voucher.eventId !== Number(eventId)) {
      return res.status(400).json({
        valid: false,
        message: "This voucher is not valid for this event",
      });
    }

    // Validasi quota
    if (voucher.quota <= 0) {
      return res.status(400).json({
        valid: false,
        message: "Voucher quota has been exhausted",
      });
    }

    // Validasi tanggal event
    const now = new Date();
    if (now < voucher.event.startDate) {
      return res.status(400).json({
        valid: false,
        message: "Event has not started yet",
      });
    }

    if (now > voucher.event.endDate) {
      return res.status(400).json({
        valid: false,
        message: "Event has ended",
      });
    }

    // Hitung discount amount
    const discountAmount = Math.min(voucher.nominal, voucher.event.price);

    res.json({
      valid: true,
      message: "Voucher is valid",
      data: {
        voucher: {
          id: voucher.id,
          nominal: voucher.nominal,
          discountAmount: discountAmount,
          quota: voucher.quota,
        },
        event: voucher.event,
      },
    });
  } catch (error) {
    console.error("Validate voucher error:", error);
    res.status(500).json({ error: "Failed to validate voucher" });
  }
};

// use voucher, customer telah mengguanakn voucher
export const useVoucher = async (req: Request, res: Response) => {
  try {
    const { voucherId } = req.body;
    const userId = req.user!.userId;

    if (req.user!.role !== "customer") {
      return res.status(403).json({ error: "Access denied. Customer only." });
    }

    if (!voucherId) {
      return res.status(400).json({ error: "voucherId is required" });
    }

    const voucher = await prisma.voucher.findUnique({
      where: { id: Number(voucherId) },
    });

    if (!voucher) {
      return res.status(404).json({ error: "Voucher not found" });
    }

    // Validasi ownership, hanya customer pemilik voucher
    if (voucher.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Validasi quota
    if (voucher.quota <= 0) {
      return res.status(400).json({ error: "Voucher quota exhausted" });
    }

    // Update voucher
    const updatedVoucher = await prisma.voucher.update({
      where: { id: Number(voucherId) },
      data: {
        quota: { decrement: 1 },
        isUsed: true,
      },
    });

    res.json({
      message: "Voucher used successfully",
      data: updatedVoucher,
    });
  } catch (error) {
    console.error("Use voucher error:", error);
    res.status(500).json({ error: "Failed to use voucher" });
  }
};

// refund voucher / rollback transaction
export const refundVoucher = async (voucherId: number) => {
  try {
    const voucher = await prisma.voucher.findUnique({
      where: { id: voucherId },
    });

    if (!voucher) {
      throw new Error("Voucher not found");
    }

    // mengembalikan quota
    const updatedVoucher = await prisma.voucher.update({
      where: { id: voucherId },
      data: {
        quota: { increment: 1 },
      },
    });

    return updatedVoucher;
  } catch (error) {
    console.error("Refund voucher error:", error);
    throw error;
  }
};

export const testAuth = () => {
  (req: Request, res: Response) => {
    console.log("Debug - Req.user:", req.user);
    res.status(200).json({
      user: req.user,
      message: "Auth debug successful",
      timestamp: new Date().toISOString(),
    });
  };
};
