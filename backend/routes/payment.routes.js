/**
 * Payment Routes
 * Razorpay checkout and admin paid-status management
 */

import express from "express";
import rateLimit from "express-rate-limit";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import {
  createOrder,
  getPaymentConfig,
  getUserWallet,
  verifyPayment,
  adminTogglePaid,
  adminAdjustWallet,
  adminGetStudentWallet,
  getMyTransactions,
  adminGetAllTransactions,
  handleWebhook,
} from "../controllers/paymentController.js";

const router = express.Router();

// ── Dedicated rate limiter for sensitive payment endpoints ─────────────────────
// The general API limiter allows 200 req/min which is too broad for payments.
// /create-order  — throttled to prevent Razorpay API quota exhaustion
// /verify        — throttled to prevent brute-force signature guessing
const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,          // 1 minute window
  max: 5,                        // 5 attempts per IP per minute
  message: { error: "Too many payment requests. Please wait a moment and try again." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Razorpay webhook — server-to-server, no JWT, auth via HMAC signature ──────
// express.raw() is applied in server.js BEFORE express.json() for this route.
// Must be registered BEFORE authMiddleware-guarded routes.
router.post("/webhook", handleWebhook);

// ── User endpoints ─────────────────────────────────────────────────────────────
router.get("/config",           getPaymentConfig);
router.get("/wallet",           authMiddleware, getUserWallet);
router.post("/create-order",    authMiddleware, paymentLimiter, createOrder);
router.post("/verify",          authMiddleware, paymentLimiter, verifyPayment);
router.get("/my-transactions",  authMiddleware, getMyTransactions);

// ── Admin endpoints ────────────────────────────────────────────────────────────
router.patch("/admin/toggle-paid/:phone",   authMiddleware, requireRole("admin", "admins"), adminTogglePaid);
router.post("/admin/wallet-adjust",         authMiddleware, requireRole("admin", "admins"), adminAdjustWallet);
router.get("/admin/wallet-history/:phone",  authMiddleware, requireRole("admin", "admins", "viewer"), adminGetStudentWallet);
router.get("/admin/all",                    authMiddleware, requireRole("admin", "admins", "viewer"), adminGetAllTransactions);

export default router;
