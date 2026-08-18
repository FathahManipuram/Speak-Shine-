import fs from "fs";
import { generatePNGPosterBuffer } from "../api/posterGenerator.js";

async function run() {
  const buf = await generatePNGPosterBuffer({
    topic: "Learned Skills",
    question: "What's the most useful thing you've learned outside school?",
    category: "Personal Experience",
    contentType: "question",
    vocabulary: [{ word: "Resilience", meaning: "ability to recover" }, { word: "Practicality", meaning: "useful in practice" }]
  });
  fs.writeFileSync("scratch/exact_test.png", buf);
  console.log("SUCCESS: Saved scratch/exact_test.png, size:", buf.length);
}

run();
