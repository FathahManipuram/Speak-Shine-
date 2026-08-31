import { describe, it, expect } from "vitest";
import { generateSVGPoster, generatePNGPosterBuffer } from "./posterGenerator.js";

describe("posterGenerator", () => {
  it("correctly generates an SVG for monthly reflection with multi-part questions", () => {
    const svgDataUri = generateSVGPoster({
      topic: "Monthly Reflection",
      question: "1. How many reviews did you attend this month?\n2. How many reviews passed and how many failed?\n3. How many extensions did you take this month?",
      category: "Monthly Reflection",
      contentType: "question",
      vocabulary: [
        { word: "feedback", meaning: "information given to help improvement", example: "I received feedback." }
      ],
      vocabRequiredCount: 1,
    });

    expect(svgDataUri).toContain("data:image/svg+xml;base64,");
    const decoded = Buffer.from(svgDataUri.replace("data:image/svg+xml;base64,", ""), "base64").toString("utf-8");
    expect(decoded).toContain("MONTHLY REFLECTION CHALLENGE");
    expect(decoded).toContain("REFLECTION QUESTIONS");
    expect(decoded).toContain("How many reviews did you attend this month?");
    expect(decoded).toContain("How many reviews passed and how many failed?");
    expect(decoded).toContain("How many extensions did you take this month?");
  });

  it("handles single-line questions with embedded numbers correctly", () => {
    const svgDataUri = generateSVGPoster({
      topic: "Monthly Goal Setting",
      question: "1. What is your main goal? 2. What is your dream target? 3. What steps will you take?",
      category: "Monthly Goals",
      contentType: "question",
    });

    const decoded = Buffer.from(svgDataUri.replace("data:image/svg+xml;base64,", ""), "base64").toString("utf-8");
    expect(decoded).toContain("MONTHLY GOALS CHALLENGE");
    expect(decoded).toContain("GOAL SETTING QUESTIONS");
    expect(decoded).toContain("What is your main goal?");
    expect(decoded).toContain("What is your dream target?");
    expect(decoded).toContain("What steps will you take?");
  });

  it("generates a valid PNG buffer from generatePNGPosterBuffer", async () => {
    const pngBuffer = await generatePNGPosterBuffer({
      topic: "Personal Experience",
      question: "What is your best memory?",
      category: "Personal Experience",
    });

    expect(Buffer.isBuffer(pngBuffer)).toBe(true);
    expect(pngBuffer.length).toBeGreaterThan(1000);
    // PNG file signature check (89 50 4E 47 0D 0A 1A 0A)
    expect(pngBuffer[0]).toBe(0x89);
    expect(pngBuffer[1]).toBe(0x50);
    expect(pngBuffer[2]).toBe(0x4e);
    expect(pngBuffer[3]).toBe(0x47);
  });
});
