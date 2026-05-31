import { readFileSync } from "node:fs";

const text = readFileSync("tools/phase3983a/phase3983a-gvc-single-file-target.md", "utf8");

if (!text.includes("status: FIXED") || text.includes("status: BROKEN")) {
  console.error("Phase3983A target is not fixed.");
  process.exit(1);
}

console.log("Phase3983A target fixed.");
