import { describe, it, expect } from "vitest";
import { matchVocabularyInTranscript } from "./submitGate.js";

describe("matchVocabularyInTranscript", () => {
  const sampleVocab = [
    { word: "collaborate", meaning: "work together" },
    { word: "resilience", meaning: "ability to recover" },
    { word: "self-discipline", meaning: "control over actions" },
    { word: "strategy", meaning: "plan of action" },
    { word: "articulate", meaning: "speak clearly" },
    { word: "time management", meaning: "manage time" },
  ];

  it("should match exact words", () => {
    const transcript = "We must collaborate and articulate our strategy clearly.";
    const matches = matchVocabularyInTranscript(transcript, sampleVocab);
    expect(matches).toContain("collaborate");
    expect(matches).toContain("articulate");
    expect(matches).toContain("strategy");
    expect(matches.length).toBe(3);
  });

  it("should match verb tenses and gerunds (-ed, -ing, -s)", () => {
    const transcript = "Yesterday we collaborated with the team and were articulating several new ideas.";
    const matches = matchVocabularyInTranscript(transcript, sampleVocab);
    expect(matches).toContain("collaborate");
    expect(matches).toContain("articulate");
  });

  it("should match irregular word variants (resilient <-> resilience, strategies <-> strategy)", () => {
    const transcript = "She has a very resilient mindset and used different strategies to succeed.";
    const matches = matchVocabularyInTranscript(transcript, sampleVocab);
    expect(matches).toContain("resilience");
    expect(matches).toContain("strategy");
  });

  it("should match hyphenated vs spaced multi-word phrases", () => {
    const transcript = "His self discipline and good time-management helped him pass.";
    const matches = matchVocabularyInTranscript(transcript, sampleVocab);
    expect(matches).toContain("self-discipline");
    expect(matches).toContain("time management");
  });

  it("should support array of plain strings as well as objects", () => {
    const stringVocab = ["innovative", "persevere", "adaptability"];
    const transcript = "They created an innovation and persevered through hardship.";
    const matches = matchVocabularyInTranscript(transcript, stringVocab);
    expect(matches).toContain("innovative");
    expect(matches).toContain("persevere");
  });

  it("should tolerate minor speech-to-text slips (Levenshtein distance <= 1)", () => {
    const transcript = "We showed great colaboration and reached our goal.";
    const matches = matchVocabularyInTranscript(transcript, sampleVocab);
    expect(matches).toContain("collaborate");
  });
});
