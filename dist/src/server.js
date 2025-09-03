"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_1 = __importDefault(require("../routes/auth"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use(express_1.default.json());
// routes
app.use("/api/auth", auth_1.default);
app.get("/", (req, res) => {
    res.send("API running...");
});
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log('Server running on http://localhost:8000'));
