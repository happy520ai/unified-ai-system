export function encodeCompactTrace(facts) {
  const factMap = new Map(facts.map((fact) => [fact.key, fact.value]));
  const noFlags = ["provider", "secret", "deploy", "chat", "execute", "codex-config"];
  const pointerValue = factMap.get("evidenceRefs");
  const pointer = Array.isArray(pointerValue) ? pointerValue[0] : pointerValue;
  const mission = factMap.get("mission") ?? "unknown";
  return [
    `P=641R-AIO`,
    `SRC=${factMap.get("source") ?? "fixture"}`,
    `MODE=${factMap.get("mode") ?? "normal"}`,
    `MISSION=${mission}`,
    `NO=${noFlags.join(",")}`,
    `PTR=${pointer ?? "evidence/phase641r"}`,
  ].join(";");
}
