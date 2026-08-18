import dotenv from "dotenv";
dotenv.config();
import { connectDB } from "../backend/config/database.js";
import { ensureTodayVocabulary } from "../backend/services/ai/vocabularyGenerator.js";
import Status from "../models/statusSchema.js";

async function test() {
  await connectDB();
  console.log("Connected to DB, running ensureTodayVocabulary()...");
  
  // Clear todayVocabulary in DB to trigger fresh generation test
  await Status.updateOne({}, { $set: { todayVocabulary: [] } });

  const words = await ensureTodayVocabulary();
  console.log("Generated Words Result:", JSON.stringify(words, null, 2));

  const status = await Status.findOne().lean();
  console.log("DB Status stored vocabulary count:", status.todayVocabulary?.length);

  process.exit(0);
}

test();
