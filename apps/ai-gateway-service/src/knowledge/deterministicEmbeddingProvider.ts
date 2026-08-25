// Credential-free deterministic embedding provider (v1).
//
// Produces a stable, L2-normalized feature vector from token n-gram hashing.
// It is deterministic across restarts and processes, needs no API key, and
// makes the vector retrieval path exercisable end-to-end. It is NOT a
// semantic model: similarity approximates shared lexical/subword structure.
// Inject a provider that already participates in the gateway's governed
// provider-operation lifecycle for semantic-quality retrieval.

import { createHash } from "node:crypto";

export const DETERMINISTIC_EMBEDDING_ID = "deterministic-hash-v1";
export const DETERMINISTIC_EMBEDDING_DIMENSIONS = 256;

export interface DeterministicEmbeddingProvider {
  id: typeof DETERMINISTIC_EMBEDDING_ID;
  dimensions: number;
  credentialFree: true;
  embedText(text: string): number[];
}

export function createDeterministicEmbeddingProvider(
  options: { dimensions?: number } = {},
): DeterministicEmbeddingProvider {
  const dimensions = Math.max(2, Math.floor(options.dimensions ?? DETERMINISTIC_EMBEDDING_DIMENSIONS));

  function embedText(text: string): number[] {
    const vector = new Array<number>(dimensions).fill(0);
    const tokens = tokenize(text);
    if (tokens.length === 0) return vector;

    // Token unigrams, bigrams, and character 4-grams give the hashed vector
    // some tolerance to word order and morphology without any model.
    const features: string[] = [
      ...tokens.map((token) => `t:${token}`),
      ...tokens.slice(1).map((token, index) => `b:${tokens[index]}|${token}`),
      ...characterGrams(tokens.join(" ")),
    ];

    for (const feature of features) {
      const digest = createHash("sha1").update(feature, "utf8").digest();
      const bucket = digest.readUInt32BE(0) % dimensions;
      // Signed hashing: second byte picks the sign to reduce collision bias.
      const sign = digest[4] % 2 === 0 ? 1 : -1;
      vector[bucket] += sign;
    }

    let normSquared = 0;
    for (const value of vector) normSquared += value * value;
    const norm = Math.sqrt(normSquared);
    if (norm === 0) return vector;
    return vector.map((value) => value / norm);
  }

  return {
    id: DETERMINISTIC_EMBEDDING_ID,
    dimensions,
    credentialFree: true as const,
    embedText,
  };
}

function tokenize(text: string): string[] {
  return String(text ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 0);
}

function characterGrams(text: string): string[] {
  const grams: string[] = [];
  const compact = text.replace(/\s+/g, " ");
  const width = 4;
  if (compact.length <= width) {
    return compact.trim() ? [`c:${compact}`] : [];
  }
  for (let index = 0; index + width <= compact.length; index += 2) {
    grams.push(`c:${compact.slice(index, index + width)}`);
  }
  return grams;
}
