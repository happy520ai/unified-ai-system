export function encodeJsonlFacts(facts) {
  return facts.map((fact) => JSON.stringify(fact)).join("\n");
}
