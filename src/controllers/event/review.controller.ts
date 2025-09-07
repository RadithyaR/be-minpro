import { Request, Response } from "express";
import prisma from "../../lib/prisma";

// CREATE Review (Customer only)
export const createReview = async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).user.userId;
    const { eventId, rating, comment } = req.body;

    // Validasi input
    if (!eventId || !rating || !comment) {
      return res.status(400).json({
        error: "Event ID, rating, and comment are required",
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        error: "Rating must be between 1 and 5",
      });
    }

    // Validasi: customer harus sudah attended event tersebut
    const transaction = await prisma.transaction.findFirst({
      where: {
        userId: customerId,
        eventId: Number(eventId),
        status: {
          name: { in: ["PAID", "DONE"] }, // Status yang menandakan sudah bayar dan attended
        },
      },
      include: {
        event: {
          include: {
            reviews: {
              where: { userId: customerId },
            },
          },
        },
      },
    });

    if (!transaction) {
      return res.status(400).json({
        error: "You must attend the event before leaving a review",
      });
    }

    // Validasi: event sudah selesai (endDate sudah lewat)
    const eventEndDate = new Date(transaction.event.endDate);
    if (new Date() < eventEndDate) {
      return res.status(400).json({
        error: "You can only review after the event has ended",
      });
    }

    // Validasi: customer belum memberikan review untuk event ini
    if (transaction.event.reviews.length > 0) {
      return res.status(400).json({
        error: "You have already reviewed this event",
      });
    }

    // Create review
    const review = await prisma.review.create({
      data: {
        userId: customerId,
        eventId: Number(eventId),
        rating: Number(rating),
        comment: comment.trim(),
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            profilePicture: true,
          },
        },
        event: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Update event average rating
    await updateEventAverageRating(Number(eventId));

    res.status(201).json({
      message: "Review created successfully",
      data: review,
    });
  } catch (error) {
    console.error("Create review error:", error);
    res.status(500).json({ error: "Failed to create review" });
  }
};

// GET Review by ID (Public atau berdasarkan ownership)
export const getReviewById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId; // Optional, untuk validasi ownership

    const review = await prisma.review.findUnique({
      where: { id: Number(id) },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            profilePicture: true,
          },
        },
        event: {
          select: {
            id: true,
            name: true,
            eventImage: true,
          },
        },
      },
    });

    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    // Jika user terautentikasi, cek apakah ini review mereka
    const isOwner = userId ? review.userId === userId : false;

    res.json({
      message: "Review retrieved successfully",
      data: {
        ...review,
        isOwner: isOwner,
      },
    });
  } catch (error) {
    console.error("Get review error:", error);
    res.status(500).json({ error: "Failed to retrieve review" });
  }
};

// GET Reviews for Event (Public)
export const getEventReviews = async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const { page = 1, limit = 10, sort = "newest" } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const reviews = await prisma.review.findMany({
      where: { eventId: Number(eventId) },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            profilePicture: true,
          },
        },
      },
      orderBy: {
        createdAt: sort === "oldest" ? "asc" : "desc",
      },
      skip: skip,
      take: Number(limit),
    });

    const totalReviews = await prisma.review.count({
      where: { eventId: Number(eventId) },
    });

    const averageRating = await prisma.review.aggregate({
      where: { eventId: Number(eventId) },
      _avg: { rating: true },
    });

    res.json({
      message: "Event reviews retrieved successfully",
      data: {
        reviews,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(totalReviews / Number(limit)),
          totalReviews,
          averageRating: averageRating._avg.rating || 0,
        },
      },
    });
  } catch (error) {
    console.error("Get event reviews error:", error);
    res.status(500).json({ error: "Failed to retrieve reviews" });
  }
};

// GET User's Reviews (Customer only)
export const getUserReviews = async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).user.userId;

    const reviews = await prisma.review.findMany({
      where: { userId: customerId },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            eventImage: true,
            startDate: true,
            endDate: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      message: "User reviews retrieved successfully",
      data: reviews,
    });
  } catch (error) {
    console.error("Get user reviews error:", error);
    res.status(500).json({ error: "Failed to retrieve reviews" });
  }
};

// UPDATE Review (Customer only - their own reviews)
export const updateReview = async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).user.userId;
    const { id } = req.params;
    const { rating, comment } = req.body;

    const review = await prisma.review.findUnique({
      where: { id: Number(id) },
      include: { event: true, user: true },
    });

    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    if (review.userId !== customerId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Validasi: rating harus antara 1-5 jika diupdate
    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({
        error: "Rating must be between 1 and 5",
      });
    }

    // Validasi: pastikan review untuk event yang valid
    const event = await prisma.event.findUnique({
      where: { id: review.eventId },
    });

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    const updatedReview = await prisma.review.update({
      where: { id: Number(id) },
      data: {
        rating: rating ? Number(rating) : undefined,
        comment: comment ? comment.trim() : undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            profilePicture: true,
          },
        },
        event: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Update event average rating
    await updateEventAverageRating(review.eventId);

    res.json({
      message: "Review updated successfully",
      data: updatedReview,
    });
  } catch (error) {
    console.error("Update review error:", error);
    res.status(500).json({ error: "Failed to update review" });
  }
};

// DELETE Review (Customer only - their own reviews)
export const deleteReview = async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).user.userId;
    const { id } = req.params;

    const review = await prisma.review.findUnique({
      where: { id: Number(id) },
      include: { event: true },
    });

    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    if (review.userId !== customerId) {
      return res.status(403).json({ error: "Access denied" });
    }

    await prisma.review.delete({
      where: { id: Number(id) },
    });

    // Update event average rating
    await updateEventAverageRating(review.eventId);

    res.json({ message: "Review deleted successfully" });
  } catch (error) {
    console.error("Delete review error:", error);
    res.status(500).json({ error: "Failed to delete review" });
  }
};

// GET Organizer's Event Reviews (Organizer only)
export const getOrganizerEventReviews = async (req: Request, res: Response) => {
  try {
    const organizerId = (req as any).user.userId;
    const { eventId } = req.params;

    // Validasi event ownership
    const event = await prisma.event.findUnique({
      where: { id: Number(eventId) },
      include: {
        reviews: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                profilePicture: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    if (event.userId !== organizerId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const averageRating = await prisma.review.aggregate({
      where: { eventId: Number(eventId) },
      _avg: { rating: true },
      _count: { id: true },
    });

    res.json({
      message: "Organizer event reviews retrieved successfully",
      data: {
        event: {
          id: event.id,
          name: event.name,
          averageRating: averageRating._avg.rating || 0,
          totalReviews: averageRating._count.id,
        },
        reviews: event.reviews,
      },
    });
  } catch (error) {
    console.error("Get organizer reviews error:", error);
    res.status(500).json({ error: "Failed to retrieve reviews" });
  }
};

// Helper function to update event average rating
const updateEventAverageRating = async (eventId: number) => {
  const averageRating = await prisma.review.aggregate({
    where: { eventId: eventId },
    _avg: { rating: true },
  });

  // Anda bisa menambahkan field averageRating di model Event jika needed
  // Atau simpan di cache untuk performance
  console.log(
    `Event ${eventId} average rating updated: ${averageRating._avg.rating}`
  );
};
