"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../src/prisma"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const referral_1 = require("../utils/referral");
const router = (0, express_1.Router)();
// REGISTER
router.post("/register", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password, fullName, referralCode } = req.body;
        const existingUser = yield prisma_1.default.user.findUnique({ where: { email } });
        if (existingUser)
            return res.status(400).json({ error: "Email already used" });
        const hashedPassword = yield bcrypt_1.default.hash(password, 10);
        const roleCustomer = yield prisma_1.default.role.findFirst({ where: { name: "customer" } });
        if (!roleCustomer)
            return res.status(400).json({ error: "Default role not found" });
        // buat user
        const newUser = yield prisma_1.default.user.create({
            data: {
                email,
                password: hashedPassword,
                fullName,
                roleId: roleCustomer.id,
            },
        });
        // generate referral
        const newReferralCode = (0, referral_1.generateReferralCode)(fullName, newUser.id);
        yield prisma_1.default.referral.create({
            data: { code: newReferralCode, userId: newUser.id },
        });
        // jika ada referral orang lain
        if (referralCode) {
            const ref = yield prisma_1.default.referral.findUnique({ where: { code: referralCode } });
            if (!ref)
                return res.status(400).json({ error: "Referral code invalid" });
            // kasih bonus point
            yield prisma_1.default.point.createMany({
                data: [
                    { userId: newUser.id, amount: 10000, description: "Referral bonus (new user)", type: "BONUS" },
                    { userId: ref.userId, amount: 10000, description: "Referral bonus (referrer)", type: "BONUS" },
                ],
            });
        }
        res.status(201).json({ message: "Register success", userId: newUser.id });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
}));
// LOGIN
router.post("/login", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password } = req.body;
        const user = yield prisma_1.default.user.findUnique({ where: { email }, include: { role: true } });
        if (!user)
            return res.status(401).json({ error: "Invalid credentials" });
        const valid = yield bcrypt_1.default.compare(password, user.password);
        if (!valid)
            return res.status(401).json({ error: "Invalid credentials" });
        const token = jsonwebtoken_1.default.sign({ userId: user.id, role: user.role.name }, process.env.JWT_SECRET, { expiresIn: "1d" });
        res.json({ token, role: user.role.name });
    }
    catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
}));
// SWITCH ROLE
router.patch("/switch-role", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { userId, newRole } = req.body;
        if (!["customer", "event organizer"].includes(newRole)) {
            return res.status(400).json({ error: "Invalid role" });
        }
        const role = yield prisma_1.default.role.findFirst({ where: { name: newRole } });
        if (!role)
            return res.status(400).json({ error: "Role not found" });
        yield prisma_1.default.user.update({
            where: { id: userId },
            data: { roleId: role.id },
        });
        res.json({ message: `Role switched to ${newRole}` });
    }
    catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
}));
exports.default = router;
