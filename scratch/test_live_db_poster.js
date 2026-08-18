import dotenv from "dotenv";
dotenv.config();
import { connectDB } from "../backend/config/database.js";
import { generatePNGPosterBuffer } from "../api/posterGenerator.js";
import Status from "../models/statusSchema.js";
import fs from "fs";

async function test() {
  await connectDB();
  const status = await Status.findOne().lean();
  const png = await generatePNGPosterBuffer({
    topic: status.todayTopic,
    question: status.todayQuestion,
    category: status.todayCategory,
    contentType: status.todayContentType,
    vocabulary: status.todayVocabulary,
  });
  fs.writeFileSync("scratch/live_db_poster.png", png);
  console.log("SUCCESS! Saved scratch/live_db_poster.png, size:", png.length);
  process.exit(0);
}

test();
