import { cleanPublicKnowledgeText } from "../publicKnowledgeCleaner.js";

export function importKiwixZimSamplePreview(input = {}) {
  const source = input.source ?? {};
  const title = input.title ?? "Albert Einstein";
  const cleaner = cleanPublicKnowledgeText({
    rawText: input.html ?? input.text ?? "",
    sourceFamily: "kiwix-zim",
  });

  return {
    adapter: "kiwix-zim-preview",
    adapterMode: "contract-and-sample-preview",
    zimParserAvailable: false,
    autoDownloadEnabled: false,
    articlesExtracted: 0,
    sampleArticlesExtracted: cleaner.rejected ? 0 : 1,
    document: cleaner.rejected ? null : {
      sourceId: source.sourceId ?? "kiwix-wikipedia-preview",
      sourceFamily: "kiwix-zim",
      documentId: "kiwix-wikipedia-preview:einstein",
      title,
      text: cleaner.cleanedText,
      licenseNote: source.licenseNote ?? "requires source-specific attribution / license handling",
      freshnessPolicy: source.freshnessPolicy ?? "periodic_snapshot",
      snapshotDate: "2026-05-01",
    },
    cleaner,
    paidApiCallCount: 0,
    externalApiCalled: false,
    embeddingApiCalled: false,
    llmCleaningCalled: false,
  };
}
