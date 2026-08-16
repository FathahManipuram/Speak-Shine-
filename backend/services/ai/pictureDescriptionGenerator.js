/**
 * pictureDescriptionGenerator.js
 *
 * Two-step pipeline for generating a daily Picture Description challenge:
 *
 *  1. Groq (Llama) generates structured challenge metadata:
 *       { title, imageQuery, instructions, difficulty, speakingDuration }
 *
 *  2. Pexels API searches for a real photograph using `imageQuery` and
 *     returns the best match with full attribution metadata.
 *
 * Requires:
 *   PEXELS_API_KEY  — free at https://www.pexels.com/api/
 *   GROQ_API_KEY / GROQ_API_KEYS — already used by the rest of the app
 *
 * Returns:
 *   {
 *     title, instructions, difficulty, speakingDuration,
 *     imageQuery,
 *     imageUrl, imageSource, imagePageUrl,
 *     imagePhotographer, imagePhotographerUrl,
 *   }
 */

import fetch from "node-fetch";
import { getTextKey, markKeyExhausted, parseRetryAfter } from "./groqKeyManager.js";

// ── Difficulty pool ───────────────────────────────────────────────────────────
const DIFFICULTIES = ["easy", "medium", "hard"];

// ── Groq: generate challenge metadata ────────────────────────────────────────

const GROQ_PROMPT = `You are creating a daily Picture Description speaking challenge for intermediate English learners (B1–B2 level).

Generate ONE challenge. Return ONLY valid JSON — no markdown, no extra text.

Rules:
- imageQuery: a vivid, specific 3–8 word phrase suitable for a photo search (e.g. "busy fish market early morning" or "elderly man reading in library")
- Avoid generic queries like "people", "nature", "city"
- title: 2–5 word label describing the scene (e.g. "A Morning at the Market")
- instructions: 1–2 sentences telling the speaker what to describe and discuss (mention: what you see, what might be happening, what you think/feel about it)
- difficulty: one of "easy", "medium", or "hard"
- speakingDuration: seconds — 60 for easy, 90 for medium, 120 for hard

Response format:
{
  "type": "PICTURE_DESCRIPTION",
  "title": "...",
  "imageQuery": "...",
  "instructions": "...",
  "difficulty": "easy"|"medium"|"hard",
  "speakingDuration": 60|90|120
}`;

async function generateChallengeMetadata() {
  let lastError = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const apiKey = getTextKey();
    if (!apiKey) throw new Error("All Groq API keys exhausted — picture description generation unavailable");

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: GROQ_PROMPT }],
        temperature: 0.9,
        max_tokens: 300,
      }),
    });

    if (res.status === 429) {
      const errText = await res.text();
      markKeyExhausted(apiKey, parseRetryAfter(errText) || undefined);
      continue;
    }

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Groq API error ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) throw new Error("Empty response from Groq");

    // Parse JSON — handle optional markdown fences
    let jsonStr = raw;
    const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) jsonStr = fence[1].trim();
    else {
      const s = raw.indexOf("{");
      const e = raw.lastIndexOf("}");
      if (s !== -1 && e !== -1) jsonStr = raw.slice(s, e + 1);
    }

    try {
      const parsed = JSON.parse(jsonStr);
      if (!parsed.title || !parsed.imageQuery || !parsed.instructions || !parsed.difficulty || !parsed.speakingDuration) {
        throw new Error("Missing required fields in Groq response");
      }
      // Normalise difficulty
      if (!DIFFICULTIES.includes(parsed.difficulty)) parsed.difficulty = "medium";

      return {
        title: parsed.title.trim(),
        imageQuery: parsed.imageQuery.trim(),
        instructions: parsed.instructions.trim(),
        difficulty: parsed.difficulty,
        speakingDuration: Number(parsed.speakingDuration) || 90,
      };
    } catch (parseErr) {
      lastError = parseErr;
      console.warn("[PictureGen] JSON parse failed, retrying…", parseErr.message);
      continue;
    }
  }

  throw new Error(`Picture description metadata generation failed: ${lastError?.message}`);
}

// ── Pexels: fetch an image for the query ──────────────────────────────────────

async function fetchPexelsImage(query) {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "PEXELS_API_KEY is not set. " +
      "Sign up free at https://www.pexels.com/api/ and add it to Infisical / .env"
    );
  }

  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=10&orientation=landscape`;

  const res = await fetch(url, {
    headers: { Authorization: apiKey },
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Pexels API error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();

  if (!data.photos || data.photos.length === 0) {
    throw new Error(`No Pexels results found for query: "${query}"`);
  }

  // Pick the best photo — prefer one with a large/original size
  const photo = data.photos[0];

  // Use large2x for best resolution, appending w=1280 for crisp display
  const baseUrl = photo.src?.large2x || photo.src?.large || photo.src?.original || "";
  const imageUrl = baseUrl.includes("?")
    ? baseUrl.replace(/w=\d+/, "w=1280").replace(/h=\d+/, "h=853")
    : baseUrl + "?auto=compress&cs=tinysrgb&w=1280&h=853&fit=crop";

  return {
    imageUrl,
    imageSource: "Pexels",
    imagePageUrl: photo.url,
    imagePhotographer: photo.photographer,
    imagePhotographerUrl: photo.photographer_url,
    imageSearchQuery: query,
  };
}

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Generate a full Picture Description challenge:
 * Groq metadata + Pexels image lookup.
 *
 * @returns {Promise<{
 *   title: string,
 *   instructions: string,
 *   difficulty: string,
 *   speakingDuration: number,
 *   imageQuery: string,
 *   imageUrl: string,
 *   imageSource: string,
 *   imagePageUrl: string,
 *   imagePhotographer: string,
 *   imagePhotographerUrl: string,
 * }>}
 */
export async function generatePictureDescriptionChallenge() {
  console.log("[PictureGen] Generating challenge metadata via Groq…");
  const metadata = await generateChallengeMetadata();
  console.log(`[PictureGen] Title: "${metadata.title}" | Query: "${metadata.imageQuery}" | Difficulty: ${metadata.difficulty}`);

  console.log(`[PictureGen] Searching Pexels for: "${metadata.imageQuery}"…`);
  const imageData = await fetchPexelsImage(metadata.imageQuery);
  console.log(`[PictureGen] ✅ Image found: ${imageData.imageUrl}`);

  return {
    ...metadata,
    ...imageData,
  };
}
