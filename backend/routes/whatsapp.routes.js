/**
 * backend/routes/whatsapp.routes.js
 */

import express from "express";
import {
  getWhatsAppStatus,
  sendPoster,
  sendSubmissionReport,
  reconnectWhatsApp,
  logoutWhatsApp,
} from "../controllers/whatsappController.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";

const router = express.Router();

// Admin only routes
router.get("/status", authMiddleware, requireRole("admin", "admins"), getWhatsAppStatus);
router.post("/send-poster", authMiddleware, requireRole("admin", "admins"), sendPoster);
router.post("/send-submission-report", authMiddleware, requireRole("admin", "admins"), sendSubmissionReport);
router.post("/reconnect", authMiddleware, requireRole("admin", "admins"), reconnectWhatsApp);
router.post("/logout", authMiddleware, requireRole("admin", "admins"), logoutWhatsApp);

export default router;
