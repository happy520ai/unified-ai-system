import {
  PUBLIC_KNOWLEDGE_MANIFEST_VERSION,
  PUBLIC_KNOWLEDGE_MODE,
} from "./publicKnowledgeImportTypes.js";

export function createPublicKnowledgeManifest() {
  return {
    manifestVersion: PUBLIC_KNOWLEDGE_MANIFEST_VERSION,
    mode: "local-preview-only",
    autoDownloadEnabled: false,
    fullDatasetImportEnabled: false,
    sources: [
      {
        sourceId: "kiwix-wikipedia-preview",
        family: "kiwix-zim",
        displayName: "Kiwix Wikipedia Preview",
        licenseNote: "requires source-specific attribution / license handling",
        recommendedUse: ["encyclopedia", "general_knowledge"],
        defaultPriority: "medium",
        trustTier: "public-reference",
        freshnessPolicy: "periodic_snapshot",
        importStatus: "adapter-preview-only",
        autoDownloadAllowed: false,
        fullImportAllowedThisPhase: false,
      },
      {
        sourceId: "project-gutenberg-preview",
        family: "project-gutenberg",
        displayName: "Project Gutenberg Preview",
        licenseNote: "public-domain text; attribution and Gutenberg terms still required",
        recommendedUse: ["literature", "history", "writing_style", "classic_texts"],
        defaultPriority: "medium",
        trustTier: "public-domain-reference",
        freshnessPolicy: "stable_public_domain_snapshot",
        importStatus: "fixture-preview-only",
        autoDownloadAllowed: false,
        fullImportAllowedThisPhase: false,
      },
      {
        sourceId: "wikidata-json-preview",
        family: "wikidata-json",
        displayName: "Wikidata JSON Preview",
        licenseNote: "structured public data; source-specific license and attribution required",
        recommendedUse: ["entity", "property", "relationship", "knowledge_graph_preview"],
        defaultPriority: "medium",
        trustTier: "public-structured-reference",
        freshnessPolicy: "periodic_snapshot",
        importStatus: "fixture-preview-only",
        autoDownloadAllowed: false,
        fullImportAllowedThisPhase: false,
      },
      futureManifestOnlySource("dbpedia-preview", "dbpedia", "DBpedia Preview", ["linked_data", "entity_background"]),
      futureManifestOnlySource("open-library-metadata-preview", "open-library", "Open Library Metadata Preview", ["book_metadata"]),
      futureManifestOnlySource("arxiv-metadata-preview", "arxiv-metadata", "arXiv Metadata Preview", ["academic_metadata"]),
      futureManifestOnlySource("pubmed-metadata-preview", "pubmed-metadata", "PubMed Metadata Preview", ["biomedical_metadata"]),
      futureManifestOnlySource("openalex-metadata-preview", "openalex-metadata", "OpenAlex Metadata Preview", ["scholarly_metadata"]),
    ],
  };
}

export function createManifestSummary(manifest = createPublicKnowledgeManifest()) {
  return {
    sourceFamilyCount: new Set(manifest.sources.map((source) => source.family)).size,
    sources: manifest.sources,
    mode: PUBLIC_KNOWLEDGE_MODE,
    autoDownloadEnabled: manifest.autoDownloadEnabled,
    fullDatasetImportEnabled: manifest.fullDatasetImportEnabled,
  };
}

export function getPublicKnowledgeSource(sourceId, manifest = createPublicKnowledgeManifest()) {
  return manifest.sources.find((source) => source.sourceId === sourceId) ?? null;
}

function futureManifestOnlySource(sourceId, family, displayName, recommendedUse) {
  return {
    sourceId,
    family,
    displayName,
    licenseNote: "future optional source; requires source-specific license handling before import",
    recommendedUse,
    defaultPriority: "low",
    trustTier: "future-public-source",
    freshnessPolicy: "manifest_only",
    importStatus: "manifest-only-not-imported",
    autoDownloadAllowed: false,
    fullImportAllowedThisPhase: false,
  };
}
