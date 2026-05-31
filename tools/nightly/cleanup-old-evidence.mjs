import { existsSync, readdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";

const evidenceDir = "apps/ai-gateway-service/evidence";
const maxAgeDays = 30;

console.log("[Cleanup] Cleaning old evidence files...");

if (!existsSync(evidenceDir)) {
  console.log("[Cleanup] Evidence directory not found, skipping.");
  process.exit(0);
}

const cutoffDate = new Date();
cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

let deletedCount = 0;
let keptCount = 0;

function cleanDirectory(dirPath) {
  const entries = readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      cleanDirectory(fullPath);
      continue;
    }

    try {
      const stats = statSync(fullPath);
      if (stats.mtime < cutoffDate) {
        unlinkSync(fullPath);
        deletedCount++;
      } else {
        keptCount++;
      }
    } catch (err) {
      console.error(`[Cleanup] Error processing ${fullPath}: ${err.message}`);
    }
  }
}

cleanDirectory(evidenceDir);

console.log(`[Cleanup] Deleted ${deletedCount} files older than ${maxAgeDays} days`);
console.log(`[Cleanup] Kept ${keptCount} files`);
