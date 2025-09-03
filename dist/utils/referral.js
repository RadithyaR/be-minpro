"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateReferralCode = generateReferralCode;
function generateReferralCode(fullName, userId) {
    const prefix = fullName.split(" ")[0].toUpperCase().slice(0, 4);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}${userId}${random}`;
}
