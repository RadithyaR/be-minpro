"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auth = auth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function auth(requiredRole) {
    return (req, res, next) => {
        const authHeader = req.headers.authorization;
        if (!authHeader)
            return res.status(401).json({ error: "No token provided" });
        const token = authHeader.split(" ")[1];
        try {
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            if (requiredRole && decoded.role !== requiredRole) {
                return res.status(403).json({ error: "Forbidden: insufficient role" });
            }
            req.user = decoded;
            next();
        }
        catch (err) {
            return res.status(401).json({ error: "Invalid token" });
        }
    };
}
