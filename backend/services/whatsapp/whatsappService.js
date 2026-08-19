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
let isFirstBootConnection = true;

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

let watchdogInterval = null;
let connectingStartedAt = null;

/**
 * Robust background watchdog: checks every 20 seconds.
 * If server restarted, network blipped, or cloud container woke up,
 * automatically re-establishes WhatsApp connection without any admin clicks!
 */
export function startWhatsAppWatchdog() {
  if (watchdogInterval) return;
  watchdogInterval = setInterval(async () => {
    try {
      const hasCreds = hasSavedCredentials();
      const mongoDocs = hasCreds ? 1 : await WhatsAppAuth.countDocuments().catch(() => 0);

      // 1. Silent Auto-Heal: credentials exist, but not connected and not currently connecting
      if (!isConnected && !isConnecting && (hasCreds || mongoDocs > 0)) {
        console.log("[WhatsApp Watchdog] 🩺 WhatsApp disconnected with saved session — auto-healing connection now...");
        await initWhatsAppBot();
      }
      // 2. Anti-Stuck: if connection attempt is hung for >45s, reset state and reconnect
      else if (isConnecting && connectingStartedAt && Date.now() - connectingStartedAt > 45000) {
        console.warn("[WhatsApp Watchdog] ⚠️ WhatsApp connection attempt stuck for >45s — resetting socket and retrying...");
        isConnecting = false;
        connectingStartedAt = null;
        await initWhatsAppBot();
      }
    } catch (err) {
      // Non-fatal watchdog catch
    }
  }, 20000);
}

/**
 * Ensures the WhatsApp bot is connected before dispatching messages.
 * If disconnected but credentials exist in MongoDB or local disk, it automatically initializes and waits for connection.
 */
export async function ensureWhatsAppConnected(timeoutMs = 15000) {
  if (isConnected && sock) return sock;

  const hasCreds = hasSavedCredentials();
  const mongoDocs = hasCreds ? 1 : await WhatsAppAuth.countDocuments().catch(() => 0);

  if (!hasCreds && mongoDocs === 0) {
    throw new Error("WhatsApp bot is not connected and no saved credentials found. Please scan the QR code from the Admin Dashboard first.");
  }

  console.log("[WhatsApp] ⏳ Socket disconnected prior to auto-dispatch — performing instant silent reconnect...");
  if (!sock || !isConnecting) {
    await initWhatsAppBot();
  }

  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    if (isConnected && sock) {
      console.log("[WhatsApp] ⚡ Instant silent reconnect succeeded!");
      return sock;
    }
    await new Promise(r => setTimeout(r, 600));
  }

  if (!isConnected || !sock) {
    throw new Error("WhatsApp bot is still connecting or network timed out. Please check WhatsApp Gateway in Admin Dashboard.");
  }
  return sock;
}

/**
 * Initializes and connects the WhatsApp client using Baileys.
 */
export async function initWhatsAppBot() {
  startWhatsAppWatchdog();

  if (isConnecting || isConnected) return sock;
  isConnecting = true;
  connectingStartedAt = Date.now();

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
        connectingStartedAt = null;
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
        connectingStartedAt = null;
        currentQR = null;
        currentQRDataUrl = null;

        const rawJid = sock.user?.id || "";
        userJid = rawJid;
        userPhone = rawJid.split(":")[0]?.split("@")[0] || rawJid.split("@")[0];

        console.log(`\n✅ [WhatsApp] Connected successfully as +${userPhone} (${sock.user?.name || "Speak & Shine Bot"})\n`);
        await syncAuthDirToMongo();
        broadcastStatus();

        // 🚀 Automatically send Deployment Success notification on server startup
        if (isFirstBootConnection) {
          isFirstBootConnection = false;
          setTimeout(async () => {
            try {
              console.log("[WhatsApp] 🚀 Dispatching automated deployment notification to personal phone...");
              await sendDeploymentNotification({ status: "success" });
            } catch (err) {
              console.warn("[WhatsApp] ⚠️ Deployment notification error:", err.message);
            }
          }, 3000);
        }
      }

      if (connection === "close") {
        isConnected = false;
        isConnecting = false;
        connectingStartedAt = null;
        
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
    connectingStartedAt = null;
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

  // Ensure WhatsApp socket is connected (auto-connects from MongoDB if needed)
  await ensureWhatsAppConnected(15000);

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

export const DEFAULT_SUBMISSION_TEMPLATES = {
  comprehensive: `📊 *SPEAK & SHINE — DAILY SUBMISSION REPORT*\n📅 *Date:* {date} | ⏰ *Time:* {time}\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n✅ *SUBMITTED TODAY ({submitted_count}/{total_paid})*\n{submitted_list}\n\n⏳ *PENDING SUBMISSIONS ({pending_count}/{total_paid})*\n{pending_list}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n📈 *Completion Rate:* {percent} {progress_bar}\n💡 *Reminder:* Please record and submit your 1-minute speaking video before midnight (12:00 AM) to keep your streak active!\n🚀 *Submit your video here:* {app_url}`,
  urgent: `⚠️ *FINAL CALL — URGENT SUBMISSION REMINDER* ⚠️\n📅 *Date:* {date} | ⏰ *Time:* {time}\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n⏳ *Pending Students ({pending_count} remaining):*\n{pending_list}\n\n🏆 *Top Scorer Today:* {top_points_user}\n📈 *Class Progress:* {percent} {progress_bar}\n\n⚡ Midnight deadline approaching! Record & submit your video now to pints & keep your streak!\n\n🚀 *Submit here:* {app_url}`,
  motivation: `🌟 *SPEAK & SHINE — DAILY PROGRESS UPDATE* 🌟\n📅 *Date:* {date} | ⏰ *Time:* {time}\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🏆 *Top Scorer Today:* {top_points_user}\n📈 *Completion Rate:* {percent} {progress_bar}\n\n✅ *Submitted Heroes ({submitted_count}/{total_paid}):*\n{submitted_list}\n\n⏳ *Still Time to Submit ({pending_count} pending):*\n{pending_list}\n\n🚀 *Submit your video now:* {app_url}`,
  custom: `🔔 *SPEAK & SHINE — DAILY UPDATE*\n📅 *Date:* {date} | ⏰ *Time:* {time}\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n⏳ *Pending Students ({pending_count} left):*\n{pending_list}\n\n🚀 *Submit your video here:* {app_url}`,
};

/**
 * Render dynamic submission report template with live data tokens.
 */
export function buildSubmissionReportMessage({
  paidUsers = [],
  submittedUsers = [],
  pendingUsers = [],
  status = {},
  customTemplate = null,
  templateType = "comprehensive",
  timeSlot = null,
}) {
  const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const dateStr = nowIST.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  
  const formatTime12h = (t) => {
    if (!t) return "";
    if (/^\d{1,2}:\d{2}$/.test(t)) {
      const [h, m] = t.split(":").map(Number);
      const period = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
    }
    return t;
  };

  // Format current IST time e.g. "04:00 PM"
  const timeStr = timeSlot ? formatTime12h(timeSlot) : nowIST.toLocaleTimeString("en-IN", {
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
      const scoreText = (u.todayScore != null && u.todayScore > 0) ? ` ⭐ ${Math.round(u.todayScore)} pts` : ((u.streak && u.streak > 0) ? ` 🔥 ${u.streak}d` : "");
      return `${i + 1}. ${displayName}${scoreText}`;
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

  // Top points student today (users who completed and have todayScore)
  const usersWithScoreToday = paidUsers
    .filter(u => u.completed && u.todayScore != null && u.todayScore > 0)
    .sort((a, b) => (b.todayScore || 0) - (a.todayScore || 0));

  const topPointsUserObj = usersWithScoreToday[0];
  const topPointsUser = topPointsUserObj
    ? `${topPointsUserObj.name || `Student ${topPointsUserObj.phone ? topPointsUserObj.phone.slice(-4) : ""}`} (${Math.round(topPointsUserObj.todayScore)} pts 🌟)`
    : (submittedUsers.length > 0 ? `${submittedUsers[0].name || "Student"} (Completed ✅)` : "None yet");

  // Visual emoji progress bar: 10 blocks (e.g. 70% => [███████░░░])
  const filledBlocks = Math.min(10, Math.max(0, Math.round(percent / 10)));
  const progressBar = "█".repeat(filledBlocks) + "░".repeat(10 - filledBlocks);

  // Determine which template string to use:
  let templateToUse = customTemplate;
  if (!templateToUse || typeof templateToUse !== "string" || !templateToUse.trim()) {
    const savedTemplates = status?.submissionReportTemplates || {};
    templateToUse = savedTemplates[templateType] || status?.submissionReportTemplate || DEFAULT_SUBMISSION_TEMPLATES[templateType] || DEFAULT_SUBMISSION_TEMPLATES.comprehensive;
  }

  return templateToUse
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
    .replace(/\{top_points_user\}/gi, topPointsUser)
    .replace(/\{top_streak_user\}/gi, topPointsUser);
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
      templateType: "comprehensive",
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

  // Ensure WhatsApp socket is connected (auto-connects from MongoDB if needed)
  await ensureWhatsAppConnected(15000);

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

  // Match slot options
  const timeSlot = options.timeSlot || null;
  let templateType = options.templateType || "comprehensive";
  let customTemplate = options.template || null;

  if (timeSlot && status?.submissionReportSlots) {
    const matchedSlot = status.submissionReportSlots.find(s => s.time === timeSlot);
    if (matchedSlot) {
      templateType = matchedSlot.templateType || templateType;
      if (matchedSlot.customTemplate && matchedSlot.customTemplate.trim()) {
        customTemplate = matchedSlot.customTemplate;
      }
    }
  }

  const message = buildSubmissionReportMessage({
    paidUsers,
    submittedUsers,
    pendingUsers,
    status,
    templateType,
    customTemplate,
    timeSlot,
  });

  console.log(`[WhatsApp] 📤 Dispatching submission report (${templateType}) to ${targetGroup}...`);
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
    templateType,
    message,
    sentAt: new Date(),
  };
}

/**
 * Sends a direct WhatsApp message to the admin's personal phone number.
 */
export async function sendAdminDirectMessage(text, options = {}) {
  const Status = (await import("../../../models/statusSchema.js")).default;
  const Auth = (await import("../../../models/authSchema.js")).default;
  const status = await Status.findOne().lean().catch(() => null);
  const adminAuth = await Auth.findOne({ role: { $in: ["admin", "admins"] } }).lean().catch(() => null);

  const rawPhone = options.phone || status?.adminNotifyPhone || process.env.ADMIN_NOTIFY_PHONE || adminAuth?.phone || userPhone || getSavedPhone();
  if (!rawPhone) {
    console.log("[WhatsApp] ℹ️ No admin phone configured for direct notification.");
    return { success: false, message: "No admin phone number configured." };
  }

  let cleanPhone = String(rawPhone).replace(/[^0-9]/g, "");
  // If Indian phone entered without country code (10 digits starting with 6-9), prepend 91
  if (cleanPhone.length === 10 && /^[6-9]/.test(cleanPhone)) {
    cleanPhone = `91${cleanPhone}`;
  }

  if (!cleanPhone || cleanPhone.length < 7) {
    return { success: false, message: "Invalid admin phone number format." };
  }

  // Ensure WhatsApp socket is connected
  await ensureWhatsAppConnected(25000);

  // Look up exact JID using onWhatsApp to ensure delivery across devices
  let recipientJid = `${cleanPhone}@s.whatsapp.net`;
  try {
    const lookup = await sock.onWhatsApp(cleanPhone).catch(() => []);
    if (Array.isArray(lookup) && lookup.length > 0 && lookup[0]?.exists && lookup[0]?.jid) {
      recipientJid = lookup[0].jid;
    }
  } catch (err) {
    console.warn("[WhatsApp] JID lookup failed, using standard format:", err.message);
  }

  console.log(`[WhatsApp] 📲 Sending personal admin message to ${recipientJid} (${cleanPhone})...`);
  await sock.sendMessage(recipientJid, { text });
  console.log(`[WhatsApp] ✅ Personal admin message sent successfully to ${recipientJid}!`);

  return { success: true, recipient: cleanPhone, jid: recipientJid, sentAt: new Date() };
}

/**
 * Sends automated deployment success or startup failure notifications to the admin's personal number.
 */
export async function sendDeploymentNotification({ status = "success", error = null, extra = {} } = {}) {
  try {
    const Status = (await import("../../../models/statusSchema.js")).default;
    const dbStatus = await Status.findOne().lean().catch(() => null);

    const isEnabled = dbStatus?.deploymentNotifyEnabled !== false && process.env.DEPLOYMENT_NOTIFY_ENABLED !== "false";
    if (!isEnabled) {
      console.log("[WhatsApp] ℹ️ Deployment notifications are disabled in settings.");
      return { success: false, message: "Deployment notifications disabled." };
    }

    const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const dateStr = nowIST.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const timeStr = nowIST.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    const env = process.env.NODE_ENV || "production";
    const appUrl = process.env.FRONTEND_URL || "https://speak-shine.sidhartht.online";
    const slotCount = Array.isArray(dbStatus?.submissionReportSlots) ? dbStatus.submissionReportSlots.length : 0;
    const botPhone = userPhone || getSavedPhone() || "Active";

    let message = "";
    if (status === "success") {
      message = [
        `🚀 *SPEAK & SHINE — DEPLOYMENT SUCCESSFUL* ✅`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `📅 *Date:* ${dateStr}`,
        `⏰ *Time:* ${timeStr} (IST)`,
        `🌐 *Environment:* ${env}`,
        `🟢 *API Server:* Online & Healthy`,
        `📱 *WhatsApp Gateway:* Connected (+${botPhone})`,
        `🤖 *Auto-Send Schedule:* ${slotCount} active time slots configured`,
        `🚀 *App URL:* ${appUrl}`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `✨ All automated student reminders and background services are running smoothly!`,
      ].join("\n");
    } else {
      const errorMsg = typeof error === "string" ? error : (error?.message || "Unknown critical error");
      const errorStack = error?.stack ? error.stack.split("\n").slice(0, 4).join("\n") : "";

      message = [
        `🚨 *SPEAK & SHINE — DEPLOYMENT / SERVER FAILURE ALERT* ⚠️`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `📅 *Date:* ${dateStr}`,
        `⏰ *Time:* ${timeStr} (IST)`,
        `🌐 *Environment:* ${env}`,
        `🔴 *Status:* Server Boot / Runtime Failure`,
        ``,
        `❌ *Error Reason:*`,
        `${errorMsg}`,
        errorStack ? `\n📋 *Trace:* \n\`\`\`${errorStack}\`\`\`` : "",
        `━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `⚠️ Please check server logs and restart if needed.`,
      ].filter(Boolean).join("\n");
    }

    return await sendAdminDirectMessage(message, { phone: extra?.phone || extra?.customPhone });
  } catch (err) {
    console.warn("[WhatsApp] Could not send deployment notification:", err.message);
    return { success: false, error: err.message };
  }
}
