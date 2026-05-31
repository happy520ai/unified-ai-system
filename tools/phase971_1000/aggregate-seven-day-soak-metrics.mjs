import { existsSync, readFileSync } from "node:fs";

const days = Array.from({ length: 7 }, (_, index) => `local-self-use/v1/soak/day-${String(index + 1).padStart(2, "0")}.template.json`);
const records = days
  .filter((path) => existsSync(path))
  .map((path) => JSON.parse(readFileSync(path, "utf8")));
const realLogs = records.filter((record) => record.isRealUseLog === true);
const result = {
  completed: true,
  recordsFound: records.length,
  realUseLogCount: realLogs.length,
  totalMinutesUsed: realLogs.reduce((sum, record) => sum + Number(record.minutesUsed || 0), 0),
  totalProviderRequests: realLogs.reduce((sum, record) => sum + Number(record.providerRequests || 0), 0),
  realSevenDaySoakCompleted: realLogs.length === 7,
};
console.log(JSON.stringify(result, null, 2));
