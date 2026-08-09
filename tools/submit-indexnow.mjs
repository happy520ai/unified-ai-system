import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const configPath = resolve(repoRoot, "docs/indexnow.json");
const args = new Set(process.argv.slice(2));
const allowedArgs = new Set(["--submit"]);
const unexpectedArgs = [...args].filter((arg) => !allowedArgs.has(arg));

if (unexpectedArgs.length > 0) {
  throw new Error(`Unknown argument(s): ${unexpectedArgs.join(", ")}`);
}

const config = JSON.parse(await readFile(configPath, "utf8"));
const keyPath = resolve(repoRoot, "docs", config.keyFile);
const key = (await readFile(keyPath, "utf8")).trim();
const keyLocation = new URL(config.keyFile, "https://happy520ai.github.io/unified-ai-system/").href;
const payload = validateAndBuildPayload({ config, key, keyLocation });

if (!args.has("--submit")) {
  writeResult({
    ok: true,
    mode: "dry-run",
    endpoint: config.endpoint,
    keyLocation,
    urlList: payload.urlList,
    note: "No network request was made. Add --submit after the key file is live.",
  });
} else {
  const keyResponse = await fetch(keyLocation, {
    headers: { "user-agent": "unified-ai-system-indexnow/0.4.6" },
  });
  const liveKey = (await keyResponse.text()).trim();
  if (!keyResponse.ok || liveKey !== key) {
    throw new Error(
      `IndexNow key verification failed at ${keyLocation} with HTTP ${keyResponse.status}.`,
    );
  }

  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
      "user-agent": "unified-ai-system-indexnow/0.4.6",
    },
    body: JSON.stringify(payload),
  });
  const responseText = (await response.text()).trim();
  const accepted = response.status === 200 || response.status === 202;

  writeResult({
    ok: accepted,
    mode: "submit",
    status: response.status,
    statusText: response.statusText,
    keyVerified: true,
    submittedUrlCount: payload.urlList.length,
    response: responseText || null,
    note: accepted
      ? "IndexNow received the URLs; crawling, indexing, ranking, and traffic are not guaranteed."
      : "IndexNow did not accept the submission.",
  });

  if (!accepted) process.exitCode = 1;
}

function validateAndBuildPayload({ config, key, keyLocation }) {
  if (config.endpoint !== "https://api.indexnow.org/indexnow") {
    throw new Error("Unexpected IndexNow endpoint.");
  }
  if (!/^[A-Za-z0-9-]{8,128}$/.test(key) || config.keyFile !== `${key}.txt`) {
    throw new Error("The IndexNow key file is invalid or does not match its filename.");
  }
  if (!Array.isArray(config.urlList) || config.urlList.length === 0) {
    throw new Error("IndexNow urlList must contain at least one URL.");
  }

  const urlList = [...new Set(config.urlList)];
  for (const value of urlList) {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.host !== config.host ||
      !url.pathname.startsWith("/unified-ai-system/")
    ) {
      throw new Error(`URL is outside the verified project path: ${value}`);
    }
  }

  return {
    host: config.host,
    key,
    keyLocation,
    urlList,
  };
}

function writeResult(result) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
