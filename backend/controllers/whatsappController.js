/**
 * backend/controllers/whatsappController.js
 */

import {
  getStatus,
  sendDailyPosterToGroup,
  sendDailySubmissionReportToGroup,
  getSubmissionReportSummary,
  restartWhatsAppBot,
  logoutWhatsAppBot,
} from "../services/whatsapp/whatsappService.js";
import Status from "../../models/statusSchema.js";

function maskPhoneNumber(phone) {
  if (!phone) return null;
  const p = String(phone).replace(/\D/g, "");
  const country = p.length > 10 ? `+${p.slice(0, p.length - 10)} ` : "+";
  const last4 = p.slice(-4);
  return `${country}••••• ••${last4}`;
}

function maskTargetGroup(jid) {
  if (!jid) return null;
  const [id, domain] = String(jid).split("@");
  if (!domain) return jid;
  const start = id.slice(0, 4);
  const end = id.slice(-4);
  return `${start}••••••••${end}@${domain}`;
}

export async function getWhatsAppStatus(req, res) {
  try {
    const status = getStatus();
    const dbStatus = await Status.findOne()
      .select("todayTopic todayQuestion todayCategory todayContentType todayImageUrl todayAudioUrl isPictureDescriptionDay isStorySummaryDay todayVocabulary todayImageInstructions")
      .lean();

    const submissionSummary = await getSubmissionReportSummary();

    return res.json({
      success: true,
      ...status,
      userPhone: maskPhoneNumber(status.userPhone),
      targetGroup: maskTargetGroup(status.targetGroup),
      submissionSummary,
      todayQuestion: dbStatus ? {
        topic: dbStatus.todayTopic,
        question: dbStatus.todayQuestion,
        category: dbStatus.todayCategory,
        contentType: dbStatus.todayContentType,
        imageUrl: dbStatus.todayImageUrl,
        audioUrl: dbStatus.todayAudioUrl,
        imageInstructions: dbStatus.todayImageInstructions,
        vocabulary: dbStatus.todayVocabulary,
        isPictureDescriptionDay: dbStatus.isPictureDescriptionDay,
        isStorySummaryDay: dbStatus.isStorySummaryDay,
      } : null,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function sendPoster(req, res) {
  try {
    const { topic, question, category, targetGroup } = req.body || {};
    const result = await sendDailyPosterToGroup({ topic, question, category, targetGroup });
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error("[WhatsAppController] sendPoster error:", err.message);
    return res.status(400).json({ success: false, error: err.message });
  }
}

export async function sendSubmissionReport(req, res) {
  try {
    const { targetGroup } = req.body || {};
    const result = await sendDailySubmissionReportToGroup({ targetGroup });
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error("[WhatsAppController] sendSubmissionReport error:", err.message);
    return res.status(400).json({ success: false, error: err.message });
  }
}

export async function reconnectWhatsApp(req, res) {
  try {
    await restartWhatsAppBot();
    return res.json({ success: true, message: "Reconnection started. QR code refreshed." });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

export async function logoutWhatsApp(req, res) {
  try {
    await logoutWhatsAppBot();
    return res.json({ success: true, message: "Logged out from WhatsApp." });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
