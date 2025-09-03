export const generateReferralCode = (name: string, userId: number) => {
  // Contoh: AWALNAME + userId + random angka
  return `${name.slice(0, 3).toUpperCase()}${userId}${Math.floor(Math.random() * 1000)}`;
};
