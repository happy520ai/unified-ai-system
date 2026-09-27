// The arithmetic guard behind the measurement dataset, kept in its own module so it can be aimed at
// fixtures. A builder that also holds the rule cannot be imported to test the rule without either
// running the network pass or hiding it behind a "was I executed?" check - and that check silently
// turned this tool into a no-op that exited 0 on a relative invocation path.

const LABEL_FIELDS = ["verdict", "outcome"];

// Returns either { block } or { failure } - never a silently empty success, because an instrument that
// counts nothing and reports "clean" is the failure mode this file exists to avoid.
export function evaluateQuestion(q, data) {
  const rows = Array.isArray(data.rows) ? data.rows : [];
  const tally = data.tally ?? null;
  const labelField = rows.length === 0 ? null
    : LABEL_FIELDS.find((k) => rows[0] && Object.prototype.hasOwnProperty.call(rows[0], k)) ?? null;

  // An empty sample is not a measurement of zero. If the registry is unreachable, or the selection
  // filter matches nothing, every script would "succeed" with an empty tally and the published
  // dataset would look clean while proving nothing - so refusal has to be the shape of that case.
  if (rows.length === 0) {
    return { failure: { id: q.id, status: "empty_sample", stderr: `attempted=${data.attempted ?? 0} rows=0` } };
  }
  if (labelField === null) {
    return { failure: { id: q.id, status: "no_label_field", stderr: `row keys: ${Object.keys(rows[0]).join(",")}` } };
  }
  if (tally && labelField) {
    const sum = Object.values(tally).reduce((a, b) => a + b, 0);
    const recount = {};
    for (const row of rows) recount[row[labelField]] = (recount[row[labelField]] || 0) + 1;
    const mismatched = Object.keys(recount).filter((k) => recount[k] !== tally[k]);
    const unseen = Object.keys(tally).filter((k) => !(k in recount));
    if (sum !== rows.length || mismatched.length > 0 || unseen.length > 0) {
      return {
        failure: {
          id: q.id,
          status: "arithmetic",
          stderr: `sum=${sum} rows=${rows.length} mismatched=${mismatched.join(",") || "none"} tally_keys_unseen_in_rows=${unseen.join(",") || "none"}`,
        },
      };
    }
  }
  return {
    block: {
      id: q.id,
      title: q.title,
      script: q.script,
      row_label_field: labelField,
      asked_with: data.asked_with_revision ?? data.asked_with ?? null,
      attempted: data.attempted ?? rows.length,
      verdicts: tally ?? Object.fromEntries(Object.entries(data).filter(([k]) => !["rows", "tally", "attempted"].includes(k))),
      rows,
    },
  };
}

export const MEASUREMENT_QUESTIONS = [
  {
    id: "tools-list-pagination",
    title: "Does tools/list paginate?",
    script: "tools/survey-mcp-tools-list-pagination.mjs",
  },
  {
    id: "protocol-revision-tolerance",
    title: "Will a server agree to a protocol revision that does not exist?",
    script: "tools/survey-mcp-revision-tolerance.mjs",
  },
  {
    id: "session-enforcement",
    title: "If a server issues an MCP-Session-Id, does it require it back?",
    script: "tools/survey-mcp-session-enforcement.mjs",
  },
  { id: "server-discover-support", title: "Does anyone implement server/discover?", script: "tools/survey-mcp-server-discover.mjs" },
  { id: "instructions-field", title: "How much server-written instructions prose reaches a client?", script: "tools/survey-mcp-instructions-field.mjs" },
];
