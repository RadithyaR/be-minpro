import prisma from "../lib/prisma";

export const cleanupExpiredVouchers = async () => {
  try {
    const now = new Date();

    //Hapus voucher yang eventnya sydah selesai
    const expiredVouchers = await prisma.voucher.deleteMany({
      where: {
        event: {
          endDate: { lt: now },
        },
      },
    });
    console.log(`Cleaned up ${expiredVouchers.count} expired vouchers`);
  } catch (error) {
    console.error("Voucher cleanup error:", error);
  }
};

export const startCleanVoucher = () => {
  cleanupExpiredVouchers();

  //Menjalankan proses setiap hari
  setInterval(cleanupExpiredVouchers, 24 * 60 * 60 * 1000);
  console.log("Background Jobs started");
};
