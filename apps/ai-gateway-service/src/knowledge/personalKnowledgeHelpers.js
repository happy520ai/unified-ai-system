import { createHash } from "crypto";
import path from "path";

/**
 * Shared constants and pure helper functions for PersonalKnowledgeRAG.
 * Extracted to keep the main module under the 500-line limit.
 */

/* ==================================================================== */
/*  Constants                                                            */
/* ==================================================================== */

export const DATA_DIR = path.join(process.cwd(), ".data", "knowledge");
export const DOCS_DIR = path.join(DATA_DIR, "documents");
export const CHUNKS_DIR = path.join(DATA_DIR, "chunks");
export const INDEX_FILE = path.join(DATA_DIR, "index.json");

/** Common English / Chinese stop words stripped during embedding. */
export const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for",
  "from", "has", "have", "he", "her", "his", "how", "i", "if",
  "in", "into", "is", "it", "its", "my", "no", "not", "of", "on",
  "or", "our", "she", "so", "than", "that", "the", "their", "them",
  "then", "there", "these", "they", "this", "to", "up", "us", "was",
  "we", "what", "when", "which", "who", "will", "with", "you", "your",
  "的", "了", "和", "是", "在", "我", "有", "也", "不", "人",
  "都", "一", "一个", "上", "就", "很", "到", "说", "要", "去",
  "你", "会", "着", "没有", "看", "好", "自己", "这", "他", "她",
  "吗", "呢", "什么", "那", "被", "从", "把", "让", "向", "对",
]);

/** Maximum number of documents allowed in the knowledge base */
export const MAX_DOCUMENTS = 500;

/** Maximum number of documents in a single import batch */
export const MAX_IMPORT_DOCUMENTS = 100;

/* ==================================================================== */
/*  Pure helper functions                                                */
/* ==================================================================== */

/**
 * Tokenize text into lower-case terms, stripping stop words and
 * very short tokens.
 * @param {string} text
 * @returns {string[]}
 */
export function tokenize(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

/**
 * Split text into sentences using common delimiters.
 * @param {string} text
 * @returns {string[]}
 */
export function splitSentences(text) {
  const parts = text.split(/(?<=[.!?。！？\n])\s*/);
  return parts.map((s) => s.trim()).filter(Boolean);
}

/**
 * Get the trailing `overlap` characters of text for chunk overlap.
 * @param {string} text
 * @param {number} overlap
 * @returns {string}
 */
export function overlapTail(text, overlap) {
  if (!overlap || overlap <= 0) return "";
  if (text.length <= overlap) return text;
  return text.slice(text.length - overlap);
}

/**
 * Create a chunk record.
 * @param {string} text
 * @param {string} docId
 * @param {number} index
 * @returns {object}
 */
export function createChunk(text, docId, index) {
  const chunkId = `${docId}-c${index}`;
  return {
    chunkId,
    docId,
    index,
    text: text.trim(),
    charCount: text.trim().length,
    createdAt: new Date().toISOString(),
    metadata: {},
    embedding: null,
  };
}

/**
 * Generate a deterministic document ID from the name.
 * @param {string} name
 * @returns {string}
 */
export function generateId(name) {
  const slug = String(name)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const hash = sha256(name + Date.now()).slice(0, 8);
  return `${slug || "doc"}-${hash}`;
}

/**
 * SHA-256 hex digest.
 * @param {string} input
 * @returns {string}
 */
export function sha256(input) {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Extract file extension (without dot) from a filename.
 * @param {string} name
 * @returns {string}
 */
export function extractExtension(name) {
  const match = String(name).toLowerCase().match(/\.([^.]+)$/);
  return match ? match[1] : "txt";
}

/**
 * Format byte count into a human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
export function humanBytes(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

/**
 * Calculate cosine similarity between two sparse embedding vectors.
 *
 * @param {Map<string, number>} a
 * @param {Map<string, number>} b
 * @returns {number}  Similarity in [0, 1]
 */
export function cosineSimilarity(a, b) {
  if (!a || !b || a.size === 0 || b.size === 0) return 0;

  let dot = 0;
  let magA = 0;
  let magB = 0;

  // Iterate over the smaller map for efficiency
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];

  for (const [term, va] of small) {
    magA += va * va;
    const vb = large.get(term);
    if (vb !== undefined) {
      dot += va * vb;
    }
  }

  for (const [, vb] of large) {
    magB += vb * vb;
  }

  // If we iterated over `a` as small, magA is for `a`; otherwise swap
  if (a.size > b.size) {
    [magA, magB] = [magB, magA];
  }

  const denominator = Math.sqrt(magA) * Math.sqrt(magB);
  if (denominator === 0) return 0;
  return dot / denominator;
}

/**
 * Split document content into overlapping chunks.
 * @param {string} content
 * @param {string} docId
 * @param {number} chunkSize
 * @param {number} chunkOverlap
 * @returns {object[]}
 */
export function chunkDocument(content, docId, chunkSize, chunkOverlap) {
  const text = content.replace(/\r\n/g, "\n");
  const paragraphs = text.split(/\n{2,}/);
  const chunks = [];
  let buffer = "";
  let seqIndex = 0;

  for (const paragraph of paragraphs) {
    const candidate = buffer ? `${buffer}\n\n${paragraph}` : paragraph;

    if (candidate.length <= chunkSize) {
      buffer = candidate;
      continue;
    }

    if (buffer) {
      chunks.push(createChunk(buffer, docId, seqIndex));
      seqIndex++;
    }

    if (paragraph.length > chunkSize) {
      const sentences = splitSentences(paragraph);
      buffer = "";

      for (const sentence of sentences) {
        const next = buffer ? `${buffer} ${sentence}` : sentence;
        if (next.length > chunkSize && buffer) {
          chunks.push(createChunk(buffer, docId, seqIndex));
          seqIndex++;
          buffer = overlapTail(buffer, chunkOverlap) + " " + sentence;
        } else {
          buffer = next;
        }
      }
    } else {
      if (chunks.length > 0) {
        const prevText = chunks[chunks.length - 1].text;
        const overlap = overlapTail(prevText, chunkOverlap);
        buffer = overlap ? `${overlap}\n${paragraph}` : paragraph;
      } else {
        buffer = paragraph;
      }
    }
  }

  if (buffer.trim()) {
    chunks.push(createChunk(buffer, docId, seqIndex));
  }

  return chunks;
}

/**
 * Generate a sparse TF-IDF embedding for the given text.
 * @param {string} text
 * @param {Map<string, number>} df
 * @param {number} totalChunks
 * @returns {Map<string, number>}
 */
export function generateEmbedding(text, df, totalChunks) {
  const terms = tokenize(text);
  if (terms.length === 0) return new Map();

  const tf = new Map();
  for (const term of terms) {
    tf.set(term, (tf.get(term) ?? 0) + 1);
  }
  for (const [term, count] of tf) {
    tf.set(term, count / terms.length);
  }

  const N = totalChunks || 1;
  const embedding = new Map();
  for (const [term, tfScore] of tf) {
    const dfVal = df.get(term) ?? 0;
    const idf = Math.log((N + 1) / (dfVal + 1)) + 1;
    embedding.set(term, tfScore * idf);
  }

  return embedding;
}

/**
 * Search for the most relevant chunks given a query embedding.
 * @param {Map<string, number>} queryEmbedding
 * @param {Map<string, object>} chunks
 * @param {object} options
 * @returns {object[]}
 */
export function searchChunks(queryEmbedding, chunks, options = {}) {
  const topK = options.topK ?? 5;
  const minScore = options.minScore ?? 0;
  const generateEmbeddingFn = options.generateEmbedding;
  const df = options.df;
  const totalChunks = options.totalChunks;

  if (queryEmbedding.size === 0) return [];

  const results = [];

  for (const chunk of chunks.values()) {
    if (options.docId && chunk.docId !== options.docId) continue;

    const chunkEmbedding = chunk.embedding;
    if (!chunkEmbedding || chunkEmbedding.size === 0) continue;

    const score = cosineSimilarity(queryEmbedding, chunkEmbedding);
    if (score >= minScore) {
      results.push({
        chunkId: chunk.chunkId,
        docId: chunk.docId,
        score,
        text: chunk.text,
        index: chunk.index,
        metadata: chunk.metadata ?? {},
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
}

/**
 * Build a context string suitable for prompt injection.
 * @param {object[]} results
 * @param {Map<string, object>} documents
 * @param {number} maxChars
 * @returns {string}
 */
export function buildContext(results, documents, maxChars) {
  if (results.length === 0) return "";

  const sections = [];
  let totalLength = 0;

  for (const result of results) {
    const doc = documents.get(result.docId);
    const docName = doc?.name ?? result.docId;

    const header = `[Source: ${docName} | Chunk #${result.index} | Relevance: ${(result.score * 100).toFixed(1)}%]`;
    const body = result.text;
    const section = `${header}\n${body}`;

    if (totalLength + section.length > maxChars) {
      const remaining = maxChars - totalLength;
      if (remaining > 100) {
        sections.push(section.slice(0, remaining) + "\n[...truncated]");
      }
      break;
    }

    sections.push(section);
    totalLength += section.length;
  }

  return [
    "--- Retrieved Knowledge Context ---",
    ...sections,
    "--- End Knowledge Context ---",
  ].join("\n\n");
}
