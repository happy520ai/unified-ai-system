import type { ContractMetadata, RequestContext, ResultEnvelope } from "./common.js";

export type KnowledgeRetrieveMode = "keyword";

export interface KnowledgeRetrieveRequest {
  context?: RequestContext;
  query: string;
  mode?: KnowledgeRetrieveMode;
  sourceIds?: string[];
  topK?: number;
  minScore?: number;
  filters?: ContractMetadata;
  metadata?: ContractMetadata;
}

export interface KnowledgeDocumentRef {
  sourceId: string;
  documentId: string;
  title?: string;
  uri?: string;
  metadata?: ContractMetadata;
}

export interface KnowledgeLoadDocumentInput {
  documentId?: string;
  title?: string;
  uri?: string;
  text?: string;
  content?: string;
  metadata?: ContractMetadata;
}

export interface KnowledgeLoadRequest {
  sourceId: string;
  sourceTitle?: string;
  documents: KnowledgeLoadDocumentInput[];
  metadata?: ContractMetadata;
}

export interface KnowledgeLoadResponse {
  phase?: string;
  status: "loaded";
  sourceId: string;
  loadedCount: number;
  sourceCount: number;
  documentCount: number;
  documents: KnowledgeDocumentRef[];
}

export type KnowledgeLoadResult = ResultEnvelope<KnowledgeLoadResponse>;

export interface KnowledgeHighlight {
  term: string;
  startOffset: number;
  endOffset: number;
}

export interface KnowledgeCitation {
  label?: string;
  uri?: string;
  startOffset?: number;
  endOffset?: number;
}

export interface KnowledgeScoreBreakdown {
  termCoverage?: number;
  titleCoverage?: number;
  sourceCoverage?: number;
  documentIdCoverage?: number;
  bodyCoverage?: number;
  phraseMatch?: boolean;
  contiguousMatch?: boolean;
  exactMatch?: boolean;
  matchedTermCount?: number;
  fieldWeights?: ContractMetadata;
}

export interface KnowledgeChunk {
  id: string;
  text: string;
  rank?: number;
  score?: number;
  scoreBreakdown?: KnowledgeScoreBreakdown;
  snippet?: string;
  highlights?: KnowledgeHighlight[];
  matchedTerms?: string[];
  document: KnowledgeDocumentRef;
  citations?: KnowledgeCitation[];
  metadata?: ContractMetadata;
}

export interface KnowledgeRetrieveResponse {
  query: string;
  normalizedQuery?: string;
  mode?: KnowledgeRetrieveMode;
  chunks: KnowledgeChunk[];
  topHit?: KnowledgeChunk | null;
  topChunk?: KnowledgeChunk | null;
  topDocument?: KnowledgeDocumentRef | null;
  traceId?: string;
  metadata?: ContractMetadata;
}

export type KnowledgeRetrieveResult = ResultEnvelope<KnowledgeRetrieveResponse>;

export type KnowledgeInfraMode = "local-keyword" | "vector";
export type KnowledgeInfraReadinessStatus = "disabled" | "not-configured" | "configured" | "not-ready" | "ready";

export interface KnowledgeInfraComponentReadiness {
  id?: string;
  status: KnowledgeInfraReadinessStatus;
  configured: boolean;
  reason?: string;
  model?: string;
  baseUrlPresent?: boolean;
  apiKeyPresent?: boolean;
  connectionStringPresent?: boolean;
  table?: string;
  namespace?: string;
}

export interface KnowledgeInfraReadinessResponse {
  mode: KnowledgeInfraMode;
  defaultMode: "local-keyword";
  enabled: boolean;
  status: KnowledgeInfraReadinessStatus;
  productionReady: boolean;
  blockers: string[];
  config?: ContractMetadata;
  embedding: KnowledgeInfraComponentReadiness;
  vectorStore: KnowledgeInfraComponentReadiness;
  pgvector: KnowledgeInfraComponentReadiness;
  interfaces: {
    embeddingProvider: {
      name: "KnowledgeEmbeddingProvider";
      methods: string[];
    };
    vectorStore: {
      name: "KnowledgeVectorStore";
      methods: string[];
    };
  };
  notes?: string;
}

export type KnowledgeInfraReadinessResult = ResultEnvelope<KnowledgeInfraReadinessResponse>;

export interface RagChatKnowledgeOptions {
  query?: string;
  sourceIds?: string[];
  topK?: number;
  minScore?: number;
  filters?: ContractMetadata;
  metadata?: ContractMetadata;
}

export interface RagChatRequest {
  context?: RequestContext;
  prompt?: string;
  query?: string;
  providerId?: string;
  model?: string;
  options?: ContractMetadata;
  metadata?: ContractMetadata;
  knowledge?: RagChatKnowledgeOptions;
}

export interface RagChatCitation {
  index: number;
  label: string;
  sourceId?: string | null;
  documentId?: string | null;
  title?: string;
  uri?: string;
  snippet: string;
  matchedTerms: string[];
  highlights?: KnowledgeHighlight[];
  score?: number | null;
  scoreBreakdown?: KnowledgeScoreBreakdown | null;
  metadata?: ContractMetadata;
}

export interface RagChatKnowledgeSummary {
  query: string;
  mode?: KnowledgeRetrieveMode;
  retrieved: boolean;
  chunkCount: number;
  topHit?: KnowledgeChunk | null;
  topChunk?: KnowledgeChunk | null;
  topDocument?: KnowledgeDocumentRef | null;
  citations: RagChatCitation[];
  metadata?: ContractMetadata;
}

export interface RagChatResponse {
  answer: string;
  text: string;
  outputText: string;
  chat: ContractMetadata;
  rag: {
    enabled: true;
    mode: "service-side";
    phase: "phase-29a-service-rag-chat";
    prompt: string;
    knowledgeInjected: boolean;
    citationCount: number;
  };
  knowledge: RagChatKnowledgeSummary;
  metadata?: ContractMetadata;
}

export type RagChatResult = ResultEnvelope<RagChatResponse>;
