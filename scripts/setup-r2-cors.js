/**
 * Script to automatically configure CORS policy on Cloudflare R2 Bucket
 * Run: node scripts/setup-r2-cors.js
 */
import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = process.env;

if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  console.error("❌ Missing R2 environment variables in .env");
  process.exit(1);
}

const s3 = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const corsRules = [
  {
    AllowedOrigins: ["*"], // Allows uploads from production domain, localhost, etc.
    AllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
    AllowedHeaders: ["*"],
    ExposeHeaders: ["ETag"],
    MaxAgeSeconds: 3600,
  },
];

async function applyCors() {
  console.log(`Setting up CORS on R2 bucket: ${R2_BUCKET_NAME}...`);
  try {
    await s3.send(
      new PutBucketCorsCommand({
        Bucket: R2_BUCKET_NAME,
        CORSConfiguration: {
          CORSRules: corsRules,
        },
      })
    );
    console.log("✅ R2 Bucket CORS configuration applied successfully!");
    
    // Verify
    try {
      const res = await s3.send(new GetBucketCorsCommand({ Bucket: R2_BUCKET_NAME }));
      console.log("Current CORS Configuration:", JSON.stringify(res.CORSRules, null, 2));
    } catch {
      // Ignored if getCors fails
    }
  } catch (err) {
    console.error("❌ Failed to set R2 CORS:", err.message);
    console.log("\nIf PutBucketCors is not supported by your token, set CORS in Cloudflare Dashboard:");
    console.log("Cloudflare Dashboard -> R2 -> " + R2_BUCKET_NAME + " -> Settings -> CORS Policy");
    console.log(JSON.stringify(corsRules, null, 2));
  }
}

applyCors();
