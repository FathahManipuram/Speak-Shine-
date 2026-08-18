/**
 * backend/services/whatsapp/whatsappService.js
 *
 * WhatsApp bot service using @whiskeysockets/baileys.
 * Links to the user's WhatsApp number via QR code scan and sends
 * the daily question poster + caption to the configured TARGET_GROUP.
 */

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import QRCode from "qrcode";
import qrcodeTerminal from "qrcode-terminal";
import { generatePNGPosterBuffer } from "../../../api/posterGenerator.js";
import Status from "../../../models/statusSchema.js";
import WhatsAppAuth from "../../../models/whatsAppAuthSchema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUTH_DIR = path.resolve(process.cwd(), "auth");

const pinoLogger = pino({ level: "silent" });

let sock = null;
let isConnected = false;
let isConnecting = false;
let currentQR = null;
let currentQRDataUrl = null;
let userPhone = null;
let userJid = null;
let reconnectTimer = null;
let socketIoInstance = null;

export function setSocketIo(io) {
  socketIoInstance = io;
}

function broadcastStatus() {
  if (!socketIoInstance) return;
  try {
    socketIoInstance.emit("whatsapp:status", getStatus());
  } catch (err) {
    // Ignore socket broadcast errors
  }
}

/**
 * Restores all Baileys auth files from MongoDB into AUTH_DIR.
 * Ensures the session survives container destruction, server restarts, and deployments.
 */
async function restoreAuthFromMongo() {
  try {
    const docs = await WhatsAppAuth.find({}).lean();
    if (!docs || docs.length === 0) return 0;
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }
    for (const doc of docs) {
      const filePath = path.join(AUTH_DIR, doc.key);
      fs.writeFileSync(filePath, doc.value, "utf-8");
    }
    console.log(`[WhatsApp] 📥 Restored ${docs.length} session credential files from MongoDB`);
    return docs.length;
  } catch (err) {
    console.warn("[WhatsApp] Could not restore auth from MongoDB:", err.message);
    return 0;
  }
}

let isSyncingToMongo = false;
async function syncAuthDirToMongo() {
  if (isSyncingToMongo) return;
  isSyncingToMongo = true;
  try {
    if (!fs.existsSync(AUTH_DIR)) return;
    const files = fs.readdirSync(AUTH_DIR);
    if (files.length === 0) return;

    const operations = [];
    for (const file of files) {
      const filePath = path.join(AUTH_DIR, file);
      try {
        if (fs.statSync(filePath).isFile()) {
          const content = fs.readFileSync(filePath, "utf-8");
          operations.push({
            updateOne: {
              filter: { key: file },
              update: { $set: { value: content, updatedAt: new Date() } },
              upsert: true,
            },
          });
        }
      } catch {}
    }

    const chunkSize = 500;
    for (let i = 0; i < operations.length; i += chunkSize) {
      const chunk = operations.slice(i, i + chunkSize);
      await WhatsAppAuth.bulkWrite(chunk, { ordered: false });
    }
  } catch (err) {
    console.warn("[WhatsApp] Could not sync auth to MongoDB:", err.message);
  } finally {
    isSyncingToMongo = false;
  }
}

/**
 * Removes all auth files from MongoDB when user deliberately logs out.
 */
async function clearMongoAuth() {
  try {
    await WhatsAppAuth.deleteMany({});
    console.log("[WhatsApp] 🗑️ Cleared auth credentials from MongoDB");
  } catch (err) {
    console.warn("[WhatsApp] Could not clear auth from MongoDB:", err.message);
  }
}

function getSavedPhone() {
  try {
    const credsPath = path.join(AUTH_DIR, "creds.json");
    if (fs.existsSync(credsPath)) {
      const data = JSON.parse(fs.readFileSync(credsPath, "utf-8"));
      if (data?.me?.id) {
        return data.me.id.split(":")[0]?.split("@")[0];
      }
    }
  } catch {}
  return null;
}

function hasSavedCredentials() {
  try {
    const credsPath = path.join(AUTH_DIR, "creds.json");
    if (fs.existsSync(credsPath)) {
      const data = JSON.parse(fs.readFileSync(credsPath, "utf-8"));
      return !!(data?.me?.id || data?.account);
    }
  } catch {}
  return false;
}

/**
 * Initializes and connects the WhatsApp client using Baileys.
 */
export async function initWhatsAppBot() {
  if (isConnecting || isConnected) return sock;
  isConnecting = true;

  try {
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }

    // 1. Restore persistent session files from MongoDB if available
    await restoreAuthFromMongo();

    if (sock) {
      try {
        sock.ev?.removeAllListeners();
        sock.end?.();
      } catch {}
      sock = null;
    }

    console.log("[WhatsApp] 🔄 Initializing WhatsApp multi-device client...");
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version, isLatest } = await fetchLatestBaileysVersion().catch(() => ({
      version: [2, 3000, 1015901307],
      isLatest: false,
    }));

    console.log(`[WhatsApp] Using WA version ${version.join(".")}${isLatest ? " (latest)" : ""}`);

    sock = makeWASocket({
      version,
      logger: pinoLogger,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pinoLogger),
      },
      browser: ["Speak & Shine", "Chrome", "1.0.0"],
      generateHighQualityLinkPreview: true,
      syncFullHistory: false,
      markOnlineOnConnect: true,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
    });

    sock.ev.on("creds.update", async () => {
      await saveCreds();
      await syncAuthDirToMongo();
    });

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        currentQR = qr;
        isConnecting = false;
        isConnected = false;
        try {
          currentQRDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 6 });
        } catch (err) {
          console.warn("[WhatsApp] Failed to generate QR data URL:", err.message);
        }

        console.log("\n=======================================================");
        console.log("📱 [WhatsApp] Scan this QR Code with your WhatsApp app:");
        console.log("   (WhatsApp > Settings/3 dots > Linked Devices > Link a Device)");
        console.log("=======================================================\n");
        qrcodeTerminal.generate(qr, { small: true });
        broadcastStatus();
      }

      if (connection === "open") {
        isConnected = true;
        isConnecting = false;
        currentQR = null;
        currentQRDataUrl = null;

        const rawJid = sock.user?.id || "";
        userJid = rawJid;
        userPhone = rawJid.split(":")[0]?.split("@")[0] || rawJid.split("@")[0];

        console.log(`\n✅ [WhatsApp] Connected successfully as +${userPhone} (${sock.user?.name || "Speak & Shine Bot"})\n`);
        await syncAuthDirToMongo();
        broadcastStatus();
      }

      if (connection === "close") {
        isConnected = false;
        isConnecting = false;
        
        const statusCode = lastDisconnect?.error instanceof Boom
          ? lastDisconnect.error.output?.statusCode
          : lastDisconnect?.error?.statusCode;

        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        console.log(`[WhatsApp] ⚠️ Connection closed. Status code: ${statusCode || "unknown"}. Reconnect: ${!isLoggedOut}`);

        if (isLoggedOut) {
          console.log("[WhatsApp] 🚪 Logged out from WhatsApp. Resetting auth credentials...");
          currentQR = null;
          currentQRDataUrl = null;
          userPhone = null;
          userJid = null;
          await clearAuthDir();
          broadcastStatus();
          scheduleReconnect(2000);
        } else {
          // Restart required (515) or temporary socket drop
          broadcastStatus();
          scheduleReconnect(1500);
        }
      }
    });

    return sock;
  } catch (err) {
    isConnecting = false;
    isConnected = false;
    console.error("[WhatsApp] ❌ Initialization error:", err.message);
    scheduleReconnect(5000);
    return null;
  }
}

function scheduleReconnect(delayMs) {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    initWhatsAppBot();
  }, delayMs);
}

async function clearAuthDir() {
  try {
    await clearMongoAuth();
    if (fs.existsSync(AUTH_DIR)) {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn("[WhatsApp] Could not clear auth folder:", err.message);
  }
}

/**
 * Returns current status of the WhatsApp bot.
 */
export function getStatus() {
  const targetGroup = process.env.TARGET_GROUP || "";
  const savedPhone = getSavedPhone();
  const hasCreds = hasSavedCredentials();

  return {
    isConnected,
    isConnecting,
    isReconnecting: !isConnected && hasCreds,
    userPhone: userPhone || savedPhone,
    userJid: userJid || (savedPhone ? `${savedPhone}@s.whatsapp.net` : null),
    targetGroup,
    hasTargetGroup: !!targetGroup,
    hasSavedCredentials: hasCreds,
    // Only supply QR code if we do not already have an authenticated saved session
    qrCodeDataUrl: isConnected || (hasCreds && !currentQR) ? null : currentQRDataUrl,
    authDirExists: hasCreds,
  };
}

/**
 * Manually reconnect / refresh QR code.
 */
export async function restartWhatsAppBot() {
  if (sock) {
    try {
      sock.ev?.removeAllListeners();
      sock.end?.(new Error("Manual restart requested"));
    } catch {}
  }
  sock = null;
  isConnected = false;
  isConnecting = false;
  currentQR = null;
  currentQRDataUrl = null;
  return await initWhatsAppBot();
}

/**
 * Log out and remove credentials.
 */
export async function logoutWhatsAppBot() {
  if (sock) {
    try {
      await sock.logout();
    } catch {
      // Ignore
    }
    try {
      sock.end(new Error("User logout"));
    } catch {
      // Ignore
    }
  }
  sock = null;
  isConnected = false;
  isConnecting = false;
  currentQR = null;
  currentQRDataUrl = null;
  userPhone = null;
  userJid = null;
  await clearAuthDir();
  broadcastStatus();
  return { success: true };
}

/**
 * Sends the daily challenge poster, picture, or audio to the configured TARGET_GROUP.
 * Supports:
 * - Regular Question Challenges (HD Vector Poster)
 * - Picture Description Challenges (Challenge Image + Instructions)
 * - Audio Story Challenges (Story Poster + MP3 Audio file)
 *
 * @param {object} [options]
 * @param {string} [options.topic]
 * @param {string} [options.question]
 * @param {string} [options.category]
 * @param {string} [options.targetGroup] - override target group if needed
 */
export async function sendDailyPosterToGroup(options = {}) {
  const targetGroup = options.targetGroup || process.env.TARGET_GROUP;

  if (!targetGroup) {
    throw new Error("TARGET_GROUP is not configured. Please set TARGET_GROUP in Infisical or environment.");
  }

  if (!sock || !isConnected) {
    throw new Error("WhatsApp bot is not connected. Please scan the QR code from the Admin Dashboard first.");
  }

  // Fetch full status from DB to inspect content type and attachments
  const status = await Status.findOne().lean();

  const contentType = options.contentType || status?.todayContentType || "question";
  let topic = options.topic || status?.todayTopic || "Speaking Practice";
  let question = options.question || status?.todayQuestion || "";
  let category = options.category || status?.todayCategory || "General";
  const vocabulary = status?.todayVocabulary || [];
  const frontendUrl = process.env.FRONTEND_URL || "https://speakandshine.com";

  if (!question && !topic) {
    throw new Error("No active daily challenge found in database.");
  }

  const isPicture = contentType === "picture_description" || status?.isPictureDescriptionDay;
  const isStory = contentType === "story_audio" || status?.isStorySummaryDay;
  const vocabReq = isPicture
    ? (status?.vocabPictureRequiredCount ?? 1)
    : isStory
    ? (status?.vocabStoryRequiredCount ?? 3)
    : (status?.vocabNormalRequiredCount ?? 3);

  // Format vocabulary lines if present
  let vocabSection = "";
  if (Array.isArray(vocabulary) && vocabulary.length > 0) {
    const vocabList = vocabulary.map(v => `• *${v.word}*: ${v.meaning}`).join("\n");
    vocabSection = `\n🎯 *Focus Vocabulary (Use at least ${vocabReq} in your video):*\n${vocabList}\n`;
  }

  console.log(`[WhatsApp] 📦 Preparing dispatch for "${topic}" (Type: ${contentType})...`);

  // ── CASE 1: PICTURE DESCRIPTION CHALLENGE ──────────────────────────────────
  if (isPicture) {
    let imageBuffer = null;
    const imageUrl = status?.todayImageUrl;

    if (imageUrl) {
      try {
        console.log(`[WhatsApp] 🖼️ Fetching challenge picture from: ${imageUrl}`);
        const res = await fetch(imageUrl);
        if (res.ok) {
          const arrayBuf = await res.arrayBuffer();
          imageBuffer = Buffer.from(arrayBuf);
        }
      } catch (fetchErr) {
        console.warn("[WhatsApp] Could not fetch remote picture, falling back to generated poster:", fetchErr.message);
      }
    }

    // If picture download failed or no URL, generate dedicated picture poster
    if (!imageBuffer) {
      imageBuffer = await generatePNGPosterBuffer({
        topic,
        question: status?.todayImageInstructions || question,
        category: "Picture Description",
        contentType: "picture_description",
        vocabulary,
        vocabRequiredCount: vocabReq,
      });
    }

    const instructions = status?.todayImageInstructions || question || "Describe what you see in this picture in detail: people, setting, actions, emotions, and your perspective.";

    const caption = [
      `🖼️ *SPEAK & SHINE — PICTURE DESCRIPTION CHALLENGE* 🖼️`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📸 *Challenge Theme:* ${topic}`,
      ``,
      `📝 *Your Speaking Task:*`,
      `${instructions}`,
      vocabSection,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🎥 *TASK:* Record your 2-3 minute video describing this picture!`,
      `🚀 *Submit your video here:* ${frontendUrl}`,
    ].filter(Boolean).join("\n");

    console.log(`[WhatsApp] 📤 Sending picture challenge to group: ${targetGroup}...`);
    await sock.sendMessage(targetGroup, {
      image: imageBuffer,
      mimetype: "image/jpeg",
      caption,
    });

    console.log(`[WhatsApp] ✅ Picture description challenge sent successfully!`);
    return { success: true, targetGroup, topic, type: "picture_description", sentAt: new Date() };
  }

  // ── CASE 2: AUDIO STORY SUMMARY CHALLENGE ──────────────────────────────────
  if (isStory) {
    const posterBuffer = await generatePNGPosterBuffer({
      topic,
      question: question || "Listen to the audio story and record a short video summary in your own words.",
      category: "Story Summary",
      contentType: "story_audio",
      vocabulary,
      vocabRequiredCount: vocabReq,
    });

    const caption = [
      `🎧 *SPEAK & SHINE — SATURDAY STORY SUMMARY* 🎧`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📖 *Story Title:* ${topic}`,
      ``,
      `📝 *Your Assignment:*`,
      `1. Listen to the audio story on the Speak & Shine webapp.`,
      `2. Understand the key characters, the plot, and the resolution.`,
      `3. Record your video summarizing the story in your own words!`,
      vocabSection,
      `━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🎥 *TASK:* Record your 2-3 minute story summary video!`,
      `🚀 *Listen & submit here:* ${frontendUrl}`,
    ].filter(Boolean).join("\n");

    console.log(`[WhatsApp] 📤 Sending story poster to group: ${targetGroup}...`);
    await sock.sendMessage(targetGroup, {
      image: posterBuffer,
      mimetype: "image/png",
      caption,
    });

    // If audio URL is available, also send the audio file directly into the WhatsApp group!
    if (status?.todayAudioUrl) {
      try {
        console.log(`[WhatsApp] 🎵 Sending story audio file to group: ${status.todayAudioUrl}...`);
        await sock.sendMessage(targetGroup, {
          audio: { url: status.todayAudioUrl },
          mimetype: "audio/mp4",
          ptt: false,
          fileName: `${topic.replace(/[^a-zA-Z0-9_-]/g, "_")}.mp3`,
        });
        console.log(`[WhatsApp] ✅ Story audio file delivered to group!`);
      } catch (audioErr) {
        console.warn("[WhatsApp] Could not send audio file attachment (non-fatal):", audioErr.message);
      }
    }

    console.log(`[WhatsApp] ✅ Story summary challenge sent successfully!`);
    return { success: true, targetGroup, topic, type: "story_audio", sentAt: new Date() };
  }

  // ── CASE 3: REGULAR DAILY QUESTION CHALLENGE ─────────────────────────────────
  console.log(`[WhatsApp] 🎨 Generating updated HD poster for "${topic}" (${category})...`);
  const pngBuffer = await generatePNGPosterBuffer({
    topic,
    question,
    category,
    contentType: "question",
    vocabulary,
    vocabRequiredCount: vocabReq,
  });

  const caption = [
    `🌟 *SPEAK & SHINE — DAILY SPEAKING CHALLENGE* 🌟`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🏷️ *Topic:* ${topic}`,
    `📂 *Category:* ${category}`,
    ``,
    `❓ *TODAY'S QUESTION:*`,
    `${question}`,
    vocabSection,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🎥 *TASK:* Record & submit your 1-minute speaking video!`,
    `🚀 *Submit here:* ${frontendUrl}`,
  ].filter(Boolean).join("\n");

  console.log(`[WhatsApp] 📤 Sending HD poster to group: ${targetGroup}...`);
  await sock.sendMessage(targetGroup, {
    image: pngBuffer,
    mimetype: "image/png",
    caption,
  });

  console.log(`[WhatsApp] ✅ Poster sent successfully to ${targetGroup}!`);

  return {
    success: true,
    targetGroup,
    topic,
    category,
    type: "question",
    sentAt: new Date(),
  };
}

/**
 * Render dynamic submission report template with live data tokens.
 */
export function buildSubmissionReportMessage({
  paidUsers = [],
  submittedUsers = [],
  pendingUsers = [],
  status = {},
  customTemplate = null,
  timeSlot = null,
}) {
  const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const dateStr = nowIST.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  
  // Format current IST time e.g. "04:00 PM"
  const timeStr = timeSlot || nowIST.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const totalPaid = paidUsers.length;
  const submittedCount = submittedUsers.length;
  const pendingCount = pendingUsers.length;
  const percent = totalPaid > 0 ? Math.round((submittedCount / totalPaid) * 100) : 0;
  const frontendUrl = process.env.FRONTEND_URL || "https://speak-shine.sidhartht.online";
  const topicName = status?.todayTopic || "Speaking Practice";

  // Build submitted list string
  let submittedListStr = "";
  if (submittedUsers.length > 0) {
    submittedListStr = submittedUsers.map((u, i) => {
      const displayName = u.name || `Student ${u.phone ? u.phone.slice(-4) : i + 1}`;
      const streakText = (u.streak && u.streak > 0) ? ` 🔥 ${u.streak}d streak` : "";
      return `${i + 1}. ${displayName}${streakText}`;
    }).join("\n");
  } else {
    submittedListStr = "_No submissions yet today._";
  }

  // Build pending list string
  let pendingListStr = "";
  if (pendingUsers.length > 0) {
    pendingListStr = pendingUsers.map((u, i) => {
      const displayName = u.name || `Student ${u.phone ? u.phone.slice(-4) : i + 1}`;
      return `${i + 1}. ${displayName}`;
    }).join("\n");
  } else {
    pendingListStr = "🎉 _All paid students have completed today's challenge! Amazing work!_ 🌟";
  }

  // Top streak student
  const topStreakUserObj = [...paidUsers].sort((a, b) => (b.streak || 0) - (a.streak || 0))[0];
  const topStreakUser = topStreakUserObj && (topStreakUserObj.streak || 0) > 0
    ? `${topStreakUserObj.name || "Student"} (${topStreakUserObj.streak}d streak 🔥)`
    : "None yet";

  // Visual emoji progress bar: 10 blocks (e.g. 70% => [███████░░░])
  const filledBlocks = Math.min(10, Math.max(0, Math.round(percent / 10)));
  const progressBar = "█".repeat(filledBlocks) + "░".repeat(10 - filledBlocks);

  // If a custom template is provided, replace tokens
  if (customTemplate && typeof customTemplate === "string" && customTemplate.trim().length > 0) {
    return customTemplate
      .replace(/\{date\}/gi, dateStr)
      .replace(/\{time\}/gi, timeStr)
      .replace(/\{submitted_list\}/gi, submittedListStr)
      .replace(/\{pending_list\}/gi, pendingListStr)
      .replace(/\{submitted_count\}/gi, String(submittedCount))
      .replace(/\{pending_count\}/gi, String(pendingCount))
      .replace(/\{total_paid\}/gi, String(totalPaid))
      .replace(/\{percent\}/gi, `${percent}%`)
      .replace(/\{progress_bar\}/gi, `[${progressBar}]`)
      .replace(/\{topic\}/gi, topicName)
      .replace(/\{app_url\}/gi, frontendUrl)
      .replace(/\{top_streak_user\}/gi, topStreakUser);
  }

  // Default Standard Template
  let message = `📊 *SPEAK & SHINE — DAILY SUBMISSION REPORT*\n`;
  message += `📅 *Date:* ${dateStr}\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  message += `✅ *SUBMITTED TODAY (${submittedCount}/${totalPaid})*\n`;
  message += `${submittedListStr}\n\n`;

  message += `⏳ *PENDING SUBMISSIONS (${pendingCount}/${totalPaid})*\n`;
  message += `${pendingListStr}\n\n`;

  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📈 *Completion Rate:* ${percent}% [${progressBar}]\n`;
  if (pendingCount > 0) {
    message += `💡 *Reminder:* Please record and submit your 1-minute speaking video before midnight (12:00 AM) to keep your streak active!\n`;
  } else {
    message += `🏆 *Congratulations everyone on 100% daily submissions!*\n`;
  }
  message += `🚀 *Submit your video here:* ${frontendUrl}\n`;

  return message;
}

/**
 * Gets a count summary of paid students who have submitted vs pending today.
 */
export async function getSubmissionReportSummary() {
  try {
    const User = (await import("../../../models/userSchema.js")).default;
    const Status = (await import("../../../models/statusSchema.js")).default;
    const paidUsers = await User.find({ paid: true }).sort({ name: 1 }).lean();
    const status = await Status.findOne().lean();
    const submittedUsers = paidUsers.filter(u => u.completed);
    const pendingUsers = paidUsers.filter(u => !u.completed);
    
    const previewMessage = buildSubmissionReportMessage({
      paidUsers,
      submittedUsers,
      pendingUsers,
      status,
      customTemplate: status?.submissionReportTemplate,
    });

    return {
      totalPaid: paidUsers.length,
      submittedCount: submittedUsers.length,
      pendingCount: pendingUsers.length,
      submittedNames: submittedUsers.map(u => u.name || `User ${u.phone ? u.phone.slice(-4) : ""}`).filter(Boolean),
      pendingNames: pendingUsers.map(u => u.name || `User ${u.phone ? u.phone.slice(-4) : ""}`).filter(Boolean),
      previewMessage,
    };
  } catch (err) {
    return { totalPaid: 0, submittedCount: 0, pendingCount: 0, submittedNames: [], pendingNames: [], previewMessage: "" };
  }
}

/**
 * Sends a daily submission status report listing submitted vs pending (paid) users to TARGET_GROUP.
 */
export async function sendDailySubmissionReportToGroup(options = {}) {
  const targetGroup = options.targetGroup || process.env.TARGET_GROUP;
  if (!targetGroup) {
    throw new Error("TARGET_GROUP is not configured in .env");
  }

  if (!sock || !isConnected) {
    throw new Error("WhatsApp bot is not connected. Please connect WhatsApp from the Admin Dashboard first.");
  }

  // 1. Fetch all PAID users only
  const User = (await import("../../../models/userSchema.js")).default;
  const Status = (await import("../../../models/statusSchema.js")).default;
  const [paidUsers, status] = await Promise.all([
    User.find({ paid: true }).sort({ name: 1 }).lean(),
    Status.findOne().lean(),
  ]);

  if (!paidUsers || paidUsers.length === 0) {
    console.log("[WhatsApp] No paid users found for submission report.");
    return { success: false, message: "No paid users found in the system." };
  }

  const submittedUsers = paidUsers.filter(u => u.completed);
  const pendingUsers = paidUsers.filter(u => !u.completed);

  // Determine template: check slot-specific template or global template or custom override in options
  const timeSlot = options.timeSlot || null;
  let customTemplate = options.template || null;
  if (!customTemplate) {
    if (timeSlot && status?.submissionReportSlotTemplates && status.submissionReportSlotTemplates[timeSlot]) {
      customTemplate = status.submissionReportSlotTemplates[timeSlot];
    } else if (status?.submissionReportTemplate) {
      customTemplate = status.submissionReportTemplate;
    }
  }

  const message = buildSubmissionReportMessage({
    paidUsers,
    submittedUsers,
    pendingUsers,
    status,
    customTemplate,
    timeSlot,
  });

  console.log(`[WhatsApp] 📤 Dispatching submission report to ${targetGroup}...`);
  await sock.sendMessage(targetGroup, { text: message });
  console.log(`[WhatsApp] ✅ Submission report sent successfully to ${targetGroup}!`);

  const totalPaid = paidUsers.length;
  const submittedCount = submittedUsers.length;
  const pendingCount = pendingUsers.length;
  const percent = totalPaid > 0 ? Math.round((submittedCount / totalPaid) * 100) : 0;

  return {
    success: true,
    targetGroup,
    totalPaid,
    submittedCount,
    pendingCount,
    percent,
    message,
    sentAt: new Date(),
  };
}
