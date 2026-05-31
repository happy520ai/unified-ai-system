import { safeStat, normalizePath, openCodeLoopPaths, runProcess, sleep } from "./opencodeLoopShared.js";
import { containsPlainSecret, redactSecretsInText } from "../security/secretSafety.js";

export function parseModelDescriptor(rawModel) {
  try {
    const parsed = JSON.parse(String(rawModel || "{}"));
    return {
      modelId: typeof parsed.id === "string" ? parsed.id : null,
      providerId: typeof parsed.providerID === "string" ? parsed.providerID : null,
      variant: typeof parsed.variant === "string" ? parsed.variant : null,
    };
  } catch {
    return {
      modelId: null,
      providerId: null,
      variant: null,
    };
  }
}

export function sessionMatchesRepo(session, repoRoot) {
  const repo = normalizePath(repoRoot);
  const candidates = [session?.path, session?.directory]
    .map((value) => normalizePath(value))
    .filter(Boolean);
  return candidates.some((value) => value === repo || value.startsWith(`${repo}/`));
}

export function pickCandidateSession({ repoRoot, sentAfterMs = null, sessions }) {
  const repoSessions = [...(sessions || [])]
    .filter((session) => sessionMatchesRepo(session, repoRoot))
    .sort((left, right) => Number(right.timeUpdatedMs || 0) - Number(left.timeUpdatedMs || 0));
  if (repoSessions.length === 0) {
    return null;
  }
  if (Number.isFinite(sentAfterMs)) {
    const postSendSessions = repoSessions.filter((session) => Number(session.timeUpdatedMs || 0) >= sentAfterMs);
    if (postSendSessions.length > 0) {
      return postSendSessions[0];
    }
  }
  return repoSessions[0];
}

export function buildInboxImportFromSession({ importedAt, session, assistantMessage, parts }) {
  const model = parseModelDescriptor(session?.model);
  const textParts = [];
  let reasoningPartCount = 0;
  let toolPartCount = 0;
  let toolErrorCount = 0;
  let patchPartCount = 0;
  let stepPartCount = 0;

  for (const part of parts || []) {
    const partType = String(part?.type || "");
    if (partType === "text") {
      const text = redactSecretsInText(String(part?.text || "").trim());
      if (text) {
        textParts.push(text);
      }
      continue;
    }
    if (partType === "reasoning") {
      reasoningPartCount += 1;
      continue;
    }
    if (partType === "tool") {
      toolPartCount += 1;
      if (String(part?.state?.status || "").toLowerCase() === "error") {
        toolErrorCount += 1;
      }
      continue;
    }
    if (partType === "patch") {
      patchPartCount += 1;
      continue;
    }
    if (partType === "step-start" || partType === "step-finish") {
      stepPartCount += 1;
    }
  }

  const assistantText = textParts.join("\n\n").trim();
  const markdownBody = assistantText || [
    "# OpenCode Result",
    "",
    "No assistant text parts were captured from the latest repo session.",
    "",
    "This usually means the session has not produced a user-visible answer yet or only produced non-text parts.",
  ].join("\n");

  if (containsPlainSecret(markdownBody)) {
    throw new Error("Refusing to import OpenCode result because the extracted assistant text appears to contain a plaintext secret.");
  }

  const metadata = {
    importedAt,
    source: "db-latest",
    sessionId: session?.id || null,
    assistantMessageId: assistantMessage?.id || null,
    sessionTitle: session?.title || null,
    sessionAgent: session?.agent || null,
    sessionPath: session?.path || session?.directory || null,
    modelId: model.modelId,
    modelProvider: model.providerId,
    modelVariant: model.variant,
    sessionUpdatedMs: Number(session?.timeUpdatedMs || 0) || null,
    assistantMessageUpdatedMs: Number(assistantMessage?.timeUpdatedMs || 0) || null,
    textPartCount: textParts.length,
    reasoningPartCount,
    toolPartCount,
    toolErrorCount,
    patchPartCount,
    stepPartCount,
    contentLength: markdownBody.length,
    requiresReview: true,
    goNoGo: "pending-review",
    completionVerified: false,
    providerCalledByThisProcess: false,
    opencodeDesktopSendExecuted: false,
    codexCliInvoked: false,
    codexExecInvoked: false,
    workflowRunnerEnabled: false,
    worktreeCreated: false,
    autoCommit: false,
    autoPush: false,
    note: "Imported the latest repo-matching OpenCode assistant message from the local OpenCode DB. This import does not approve the result; run opencode:desktop:review next.",
  };

  return {
    markdown: [
      "# OpenCode Result",
      "",
      `- importedAt: ${importedAt}`,
      `- source: db-latest`,
      `- sessionId: ${metadata.sessionId || "unknown"}`,
      `- sessionTitle: ${metadata.sessionTitle || "unknown"}`,
      `- modelProvider: ${metadata.modelProvider || "unknown"}`,
      `- modelId: ${metadata.modelId || "unknown"}`,
      `- toolErrorCount: ${toolErrorCount}`,
      `- patchPartCount: ${patchPartCount}`,
      "",
      "## Assistant Output",
      "",
      markdownBody.startsWith("# OpenCode Result") ? markdownBody.replace(/^# OpenCode Result\s*/u, "").trim() : markdownBody,
      "",
    ].join("\n"),
    metadata,
  };
}

export async function readOpencodeSessionCatalog({ dbPath = openCodeLoopPaths.defaultDbPath, limit = 20 } = {}) {
  const dbStats = await safeStat(dbPath);
  if (!dbStats.exists) {
    return {
      dbPath,
      dbExists: false,
      sessions: [],
    };
  }

  const python = buildSessionCatalogPython({ dbPath, limit });
  const stdout = await runPythonCode(python);
  const parsed = JSON.parse(stdout);
  return {
    dbPath,
    dbExists: true,
    dbModifiedAt: dbStats.modifiedAt,
    sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    totalSessionCount: Number(parsed.totalSessionCount || 0),
  };
}

export async function readLatestAssistantSessionResult({
  dbPath = openCodeLoopPaths.defaultDbPath,
  sessionId,
}) {
  const python = buildLatestAssistantPython({ dbPath, sessionId });
  const stdout = await runPythonCode(python);
  return JSON.parse(stdout);
}

export async function previewLatestRepoSession({
  repoRoot,
  dbPath = openCodeLoopPaths.defaultDbPath,
  sentAfterMs = null,
  preferredSessionId = null,
}) {
  const catalog = await readOpencodeSessionCatalog({ dbPath, limit: 30 });
  const preferred = preferredSessionId
    ? catalog.sessions.find((session) => session.id === preferredSessionId)
    : null;
  return {
    ...catalog,
    candidateSession: preferred || pickCandidateSession({
      repoRoot,
      sentAfterMs,
      sessions: catalog.sessions,
    }),
  };
}

export async function importLatestRepoSessionResult({
  repoRoot,
  dbPath = openCodeLoopPaths.defaultDbPath,
  sentAfterMs = null,
  preferredSessionId = null,
}) {
  const preview = await previewLatestRepoSession({
    repoRoot,
    dbPath,
    sentAfterMs,
    preferredSessionId,
  });
  const session = preview.candidateSession;
  if (!session) {
    throw new Error("No repo-matching OpenCode session was found in the local OpenCode DB.");
  }
  const latest = await readLatestAssistantSessionResult({
    dbPath,
    sessionId: session.id,
  });
  return buildInboxImportFromSession({
    importedAt: new Date().toISOString(),
    session: latest.session,
    assistantMessage: latest.assistantMessage,
    parts: latest.parts,
  });
}

export async function waitForLatestRepoSessionResult({
  repoRoot,
  dbPath = openCodeLoopPaths.defaultDbPath,
  sentAfterMs = null,
  preferredSessionId = null,
  timeoutMs = 180000,
  pollMs = 5000,
}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() <= deadline) {
    const preview = await previewLatestRepoSession({
      repoRoot,
      dbPath,
      sentAfterMs,
      preferredSessionId,
    });
    const candidateSession = preview.candidateSession;
    if (candidateSession && (!Number.isFinite(sentAfterMs) || Number(candidateSession.timeUpdatedMs || 0) >= sentAfterMs)) {
      const imported = await importLatestRepoSessionResult({
        repoRoot,
        dbPath,
        sentAfterMs,
        preferredSessionId: candidateSession.id,
      });
      if ((imported.metadata.textPartCount || 0) > 0 || (imported.metadata.toolPartCount || 0) > 0) {
        return imported;
      }
    }
    await sleep(pollMs);
  }
  return null;
}

function buildSessionCatalogPython({ dbPath, limit }) {
  return `
import json
import sqlite3

conn = sqlite3.connect(${JSON.stringify(dbPath)})
cur = conn.cursor()
total = cur.execute("select count(*) from session").fetchone()[0]
rows = cur.execute(
    "select id, title, agent, model, path, directory, time_updated from session order by time_updated desc limit ?",
    (${Number(limit)},)
).fetchall()
result = {
    "totalSessionCount": total,
    "sessions": [
        {
            "id": row[0],
            "title": row[1],
            "agent": row[2],
            "model": row[3],
            "path": row[4],
            "directory": row[5],
            "timeUpdatedMs": row[6],
        }
        for row in rows
    ],
}
print(json.dumps(result, ensure_ascii=False))
conn.close()
`;
}

function buildLatestAssistantPython({ dbPath, sessionId }) {
  return `
import json
import sqlite3

conn = sqlite3.connect(${JSON.stringify(dbPath)})
cur = conn.cursor()
session_row = cur.execute(
    "select id, title, agent, model, path, directory, time_updated from session where id = ? limit 1",
    (${JSON.stringify(sessionId)},)
).fetchone()
if session_row is None:
    raise SystemExit("session_not_found")
message_row = cur.execute(
    "select id, time_updated from message where session_id = ? and json_extract(data, '$.role') = 'assistant' order by time_updated desc limit 1",
    (${JSON.stringify(sessionId)},)
).fetchone()
parts = []
assistant_message = None
if message_row is not None:
    assistant_message = {
        "id": message_row[0],
        "timeUpdatedMs": message_row[1],
    }
    part_rows = cur.execute(
        "select data from part where message_id = ? order by time_updated asc",
        (message_row[0],)
    ).fetchall()
    for (raw_data,) in part_rows:
        data = json.loads(raw_data)
        tool_value = data.get("tool")
        tool_name = None
        if isinstance(tool_value, dict):
            tool_name = tool_value.get("name") or tool_value.get("id")
        elif isinstance(tool_value, str):
            tool_name = tool_value
        state_value = data.get("state")
        state = None
        if isinstance(state_value, dict):
            state = {
                "status": state_value.get("status"),
            }
        parts.append({
            "type": data.get("type"),
            "text": data.get("text"),
            "time": data.get("time"),
            "toolName": tool_name,
            "state": state,
        })
result = {
    "session": {
        "id": session_row[0],
        "title": session_row[1],
        "agent": session_row[2],
        "model": session_row[3],
        "path": session_row[4],
        "directory": session_row[5],
        "timeUpdatedMs": session_row[6],
    },
    "assistantMessage": assistant_message,
    "parts": parts,
}
print(json.dumps(result, ensure_ascii=False))
conn.close()
`;
}

async function runPythonCode(pythonCode) {
  const attempts = [
    { command: "python", args: ["-"] },
    { command: "py", args: ["-3", "-"] },
  ];
  let lastError = null;
  for (const attempt of attempts) {
    try {
      return await runProcess({
        command: attempt.command,
        args: attempt.args,
        input: pythonCode,
      });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Python is not available for OpenCode DB reads.");
}

