/**
 * storage.js — Cloudflare R2 client (S3-compatible)
 * Exports uploadToR2, uploadBufferToR2, deleteFromR2, getR2Key,
 *         getPresignedUploadUrl, getPresignedDownloadUrl
 *
 * IMPORTANT: The S3 client is created lazily (on first use) so that
 * dotenv.config() in server.js has time to load .env before we read
 * process.env.  ES-module imports are hoisted, so top-level code here
 * runs BEFORE server.js body — reading env vars eagerly would pick up
 * stale / empty values.
 */

import { S3Client, DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs";
import path from "path";

// ── Lazy-initialised singletons ──────────────────────────────────────────────
// WHY TWO CLIENTS:
// Cloudflare R2 requires different URL styles for different operations:
//   _r2        — forcePathStyle:true  — server-side PutObject/DeleteObject/GetObject
//   _r2Presign — forcePathStyle:false — presigned URLs (browser PUT/GET directly to R2)
//
// Path-style presigned URLs ALWAYS fail on R2 with "SignatureDoesNotMatch"
// because R2 signs against virtual-hosted style (bucket in subdomain).

let _r2        = null;
let _r2Presign = null;
let _bucket    = null;
let _publicUrl = null;

function _initEnv() {
  const R2_ENDPOINT          = process.env.R2_ENDPOINT;
  const R2_ACCESS_KEY_ID     = process.env.R2_ACCESS_KEY_ID;
  const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
  _bucket    = process.env.R2_BUCKET_NAME || "speak-shine-videos";
  _publicUrl = (process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");

  const missing = [];
  if (!R2_ENDPOINT)          missing.push("R2_ENDPOINT");
  if (!R2_ACCESS_KEY_ID)     missing.push("R2_ACCESS_KEY_ID");
  if (!R2_SECRET_ACCESS_KEY) missing.push("R2_SECRET_ACCESS_KEY");
  if (!_bucket)              missing.push("R2_BUCKET_NAME");

  if (missing.length > 0) {
    throw new Error(
      `R2 storage is not configured. Missing: ${missing.join(", ")}. ` +
      "Set these environment variables and restart."
    );
  }
  return { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY };
}

/**
 * S3 client with forcePathStyle:true — for server-side direct operations
 * (PutObject, DeleteObject, GetObject). R2's account-scoped endpoint URL
 * requires path-style for these calls.
 */
function getR2Client() {
  if (_r2) return _r2;

  const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = _initEnv();

  console.log("[R2] Initialising direct-ops S3 client:", {
    endpoint: R2_ENDPOINT,
    bucket: _bucket,
    accessKeyId: R2_ACCESS_KEY_ID.substring(0, 8) + "...",
    secretKeyLength: R2_SECRET_ACCESS_KEY.length,
    forcePathStyle: true,
  });

  _r2 = new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT,
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });

  // Strip checksum headers R2 rejects (401/501 with newer @aws-sdk/client-s3)
  _r2.middlewareStack.add(
    (next) => async (args) => {
      if (args.request?.headers) {
        for (const h of Object.keys(args.request.headers)) {
          const lower = h.toLowerCase();
          if (
            lower.startsWith("x-amz-checksum-") ||
            lower === "x-amz-sdk-checksum-algorithm"
          ) {
            delete args.request.headers[h];
          }
        }
      }
      return next(args);
    },
    { step: "build", name: "r2StripChecksumHeaders", priority: "low" }
  );

  console.log("[R2] S3 client ready");
  return _r2;
}

/**
 * S3 client for presigned URL generation.
 * Cloudflare R2 requires forcePathStyle: true for presigned URLs too —
 * the endpoint is account-scoped (ACCOUNT.r2.cloudflarestorage.com),
 * so the bucket MUST be in the path. Virtual-hosted style would generate
 * a subdomain (BUCKET.ACCOUNT.r2.cloudflarestorage.com) that doesn't resolve.
 */
function getR2PresignClient() {
  if (_r2Presign) return _r2Presign;

  const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = _initEnv();

  console.log("[R2] Initialising presign S3 client:", {
    endpoint: R2_ENDPOINT,
    bucket: _bucket,
    accessKeyId: R2_ACCESS_KEY_ID.substring(0, 8) + "...",
    forcePathStyle: true,
  });

  _r2Presign = new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT,
    forcePathStyle: true,  // Required — R2 uses path-style, not virtual-hosted
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });

  console.log("[R2] Presign S3 client ready");
  return _r2Presign;
}

function getBucket()    { if (!_bucket)    getR2Client(); return _bucket; }
function getPublicUrl() { if (!_publicUrl && _publicUrl !== "") getR2Client(); return _publicUrl; }

// ── Public helpers ──────────────────────────────────────────────────────────

/**
 * Build a unique R2 object key for a video.
 * Format: videos/{userId}/{date}/{uuid}.{ext}
 */
export function getR2Key(userId, originalName) {
  const ext  = path.extname(originalName || ".webm") || ".webm";
  const date = new Date().toISOString().slice(0, 10);
  const uid  = Math.random().toString(36).slice(2, 10);
  return `videos/${userId}/${date}/${uid}${ext}`;
}

/**
 * Upload a local file to R2.
 * Uses PutObjectCommand (single PUT, up to 5 GB on R2).
 */
export async function uploadToR2(filePath, key, mimeType = "video/webm") {
  const body = fs.readFileSync(filePath);
  await getR2Client().send(new PutObjectCommand({
    Bucket:      getBucket(),
    Key:         key,
    Body:        body,
    ContentType: mimeType,
  }));
  return `${getPublicUrl()}/${key}`;
}

/**
 * Upload a Buffer directly to R2 (avoids writing to a temp file).
 */
export async function uploadBufferToR2(buffer, key, mimeType = "video/mp4") {
  await getR2Client().send(new PutObjectCommand({
    Bucket:      getBucket(),
    Key:         key,
    Body:        buffer,
    ContentType: mimeType,
  }));
  return `${getPublicUrl()}/${key}`;
}

const PROXY_UPLOAD_MAX_BYTES = 110 * 1024 * 1024;

/**
 * Read a Node Readable stream into a Buffer (for R2 PutObject compatibility).
 */
async function readStreamToBuffer(stream, expectedLength = 0) {
  const chunks = [];
  let total = 0;
  for await (const chunk of stream) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > PROXY_UPLOAD_MAX_BYTES) {
      throw new Error("Upload exceeds 110MB limit");
    }
    chunks.push(buf);
  }
  const body = Buffer.concat(chunks);
  if (expectedLength > 0 && body.length !== expectedLength) {
    console.warn(
      `[R2] Content-Length mismatch: header=${expectedLength} received=${body.length}`
    );
  }
  return body;
}

/**
 * Upload from an Express request stream (proxy-upload).
 * Buffers up to 110MB then PutObject — avoids R2 401 on streaming + checksum.
 */
export async function streamUploadToR2(stream, key, mimeType, contentLength) {
  const body = await readStreamToBuffer(stream, contentLength);
  await getR2Client().send(new PutObjectCommand({
    Bucket:      getBucket(),
    Key:         key,
    Body:        body,
    ContentType: mimeType,
    ContentLength: body.length,
  }));
  return `${getPublicUrl()}/${key}`;
}

/**
 * Delete an object from R2 by key.
 */
export async function deleteFromR2(key) {
  try {
    await getR2Client().send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
    console.log(`[R2] Deleted: ${key}`);
  } catch (err) {
    console.log(`[R2] Delete failed (ignored): ${err.message}`);
  }
}

/**
 * Generate a presigned PUT URL so the browser can upload directly to R2.
 * The URL expires in 15 minutes.
 */
export async function getPresignedUploadUrl(key, mimeType = "video/webm") {
  try {
    console.log("[R2] Generating presigned URL - key:", key, "mimeType:", mimeType);

    const command = new PutObjectCommand({
      Bucket:      getBucket(),
      Key:         key,
      // NOTE: Do NOT include ContentType in the presigned PUT command.
      // If ContentType is signed, the browser must send the exact same header value.
      // WebM/MP4 codec variants (e.g. "video/mp4; codecs=avc1") differ from "video/mp4",
      // causing a signature mismatch. Omitting it lets the browser send any Content-Type.
    });

    const url = await getSignedUrl(getR2PresignClient(), command, { expiresIn: 900 });
    console.log("[R2] Presigned upload URL generated successfully");
    return url;
  } catch (error) {
    console.error("[R2] Failed to generate presigned URL:", {
      message: error.message,
      code: error.code,
      name: error.name,
    });
    throw new Error(`Failed to generate upload URL: ${error.message}`);
  }
}

/**
 * Generate a presigned GET URL for downloading from R2.
 */
export async function getPresignedDownloadUrl(key, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: key,
  });
  return getSignedUrl(getR2PresignClient(), command, { expiresIn });
}

// Expose client getter for modules that need direct access
export { getR2Client as r2Client };
export { getBucket as BUCKET };
