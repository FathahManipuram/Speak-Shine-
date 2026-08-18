import dotenv from "dotenv";
dotenv.config();
import { getTextKey, getTextModel } from "../backend/services/ai/groqKeyManager.js";
import fetch from "node-fetch";

async function testGroq() {
  const apiKey = getTextKey();
  const model = getTextModel();
  console.log("Using model:", model, "apiKey present:", !!apiKey);

  const prompt = `You are an English vocabulary teacher.
Generate exactly 5 vocabulary words for topic: "Career Advancement", question: "What is your biggest career goal?".
Return ONLY a valid JSON object in this exact format:
{
  "words": [
    {"word": "initiative", "meaning": "the ability to act independently", "example": "Taking initiative at work helped her get promoted."}
  ]
}`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model || "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        max_tokens: 1500,
        response_format: { type: "json_object" },
      }),
    });

    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Fetch error:", err.message);
  }
}

testGroq();
