import { cleanPublicKnowledgeText } from "../publicKnowledgeCleaner.js";

export function importGutenbergTextPreview(input = {}) {
  const source = input.source ?? {};
  const cleaner = cleanPublicKnowledgeText({
    rawText: input.text ?? "",
    sourceFamily: "project-gutenberg",
  });
  const lines = cleaner.cleanedText.split(/\s{2,}|\n/).map((line) => line.trim()).filter(Boolean);
  const title = input.title ?? inferField(cleaner.cleanedText, "Title") ?? "Project Gutenberg Sample";
  const author = input.author ?? inferField(cleaner.cleanedText, "Author") ?? "Unknown";

  return {
    adapter: "project-gutenberg-text-preview",
    adapterMode: "fixture-text-preview",
    documentsImported: cleaner.rejected ? 0 : 1,
    document: cleaner.rejected ? null : {
      sourceId: source.sourceId ?? "project-gutenberg-preview",
      sourceFamily: "project-gutenberg",
      documentId: "project-gutenberg-preview:sample",
      title,
      author,
      text: lines.join(" "),
      licenseNote: source.licenseNote ?? "public-domain text; attribution and Gutenberg terms still required",
      freshnessPolicy: source.freshnessPolicy ?? "stable_public_domain_snapshot",
      snapshotDate: "2026-05-01",
    },
    cleaner,
    paidApiCallCount: 0,
    externalApiCalled: false,
    embeddingApiCalled: false,
    llmCleaningCalled: false,
  };
}

function inferField(text, field) {
  const match = String(text).match(new RegExp(`${field}:\\s*([^\\.]+)`, "i"));
  return match?.[1]?.trim() ?? null;
}
