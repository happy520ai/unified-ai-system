# Phase 277A Public Knowledge Library Import Preview with Multi-layer Novelty Guard

## Purpose

Phase 277A adds a local preview pipeline for public open knowledge sources and a deterministic multi-layer novelty guard. It prepares the system to combine private project knowledge, public reference libraries, local cleaning, local chunking, local keyword/metadata indexing, RAG source selection, cache, and paid API preflight protection.

This phase does not call models and does not train models.

## Current status

The upstream chain through Phase 274A is passed. Phase 275A cache hardening and Phase 276A quality-cost routing are used as upstream metadata when their evidence exists and is passed.

The system remains not-production-ready. MiMo is not the default provider, and the default NVIDIA `/chat` lane is unchanged.

## Why public knowledge import matters

Private project evidence answers current project state. Public knowledge can provide general background such as encyclopedia facts, public-domain text, and structured entity data. Keeping those layers separate lets RAG pick useful public context without letting it override project truth.

## What counts as public knowledge

Public knowledge includes offline reference snapshots, public-domain books, and structured public metadata. Examples include Kiwix / Wikipedia snapshots, Project Gutenberg texts, Wikidata entity JSON, DBpedia, Open Library metadata, arXiv metadata, PubMed metadata, and OpenAlex metadata.

## Recommended public sources

- Kiwix / ZIM / Wikipedia for encyclopedia background.
- Project Gutenberg for public-domain books and classic texts.
- Wikidata for structured entity, property, and relation previews.
- Future manifest-only sources: DBpedia, Open Library, arXiv metadata, PubMed metadata, and OpenAlex metadata.

## Kiwix / Wikipedia preview

This phase defines a Kiwix / ZIM adapter contract and validates a small local HTML sample. It does not parse a real large ZIM file. `zimParserAvailable=false` is recorded unless a parser already exists.

## Project Gutenberg preview

This phase imports a tiny local TXT fixture, removes preview header/footer boilerplate, preserves title, author, and body, then creates local chunks and metadata.

## Wikidata preview

This phase imports a tiny local JSON fixture, parses the entity id, labels, description, and claim count, and produces a preview entity record. It does not import a full Wikidata dump.

## What this phase imports

Only local fixture files under `apps/ai-gateway-service/fixtures/public-knowledge` are read. The accepted import preview is limited by cleaning, source trust, and novelty guard results.

## What this phase does not import

This phase does not download large datasets. It does not fully import Wikipedia, Wikidata, Gutenberg, Kiwix, DBpedia, Open Library, arXiv, PubMed, OpenAlex, or Common Crawl.

This phase does not send public knowledge to any provider.

## Import pipeline

The preview pipeline is:

1. read local fixture;
2. clean with deterministic rules;
3. reject secret-like content;
4. create document metadata;
5. chunk text locally;
6. assign source trust score;
7. check private knowledge index;
8. check public knowledge index;
9. check current batch index;
10. hold near duplicates for review;
11. build keyword and metadata index previews only for accepted clean new knowledge;
12. produce RAG source selection metadata.

## Cleaning

Cleaning removes HTML tags, navigation noise, extra whitespace, and preview Gutenberg boilerplate. LLM cleaning is disabled and `llmCleaningCalled=false`.

Secret-like content is rejected or sanitized and is not indexed.

## Chunking

Chunking is deterministic. Each chunk includes source id, document id, title, chunk index, text, character length, estimated tokens, source trust score, license note, and freshness metadata.

## Index preview

The index preview builds local keyword, metadata, source family, and trust score indexes. `embeddingIndexBuilt=false` and `vectorIndexBuilt=false`.

Only chunks that pass the deterministic novelty guard with `noveltyDecision=new` can be accepted for the import preview.

## Source trust score

Trust scores are conservative:

- project and phase evidence: `0.95`
- academic or standards material: `0.88`
- government or public institutions: `0.86`
- official public docs: `0.85`
- recognized references and Wikidata structured entity: `0.80`
- Wikipedia / Kiwix snapshot: `0.75`
- Project Gutenberg public-domain text: `0.70`
- unknown source: `0.30`
- low-trust web: `0.20`

Public knowledge cannot override project evidence. Sources below `0.70` are rejected by default, and `unknown_source` is rejected by default.

## Freshness policy

Wikipedia / Kiwix and Wikidata use periodic snapshot freshness. Project Gutenberg uses stable public-domain snapshot freshness. Freshness does not make public knowledge authoritative for current project state.

## License and attribution notes

Every source family has a license note in the manifest. Before any real large import, the system must check manifest, license, disk budget, source trust, and index budget.

## Public knowledge vs project evidence priority

Project phase evidence remains authoritative for current project status, blockers, provider state, and route readiness. Public knowledge is background context only and cannot override the latest project evidence.

## Multi-layer novelty guard

The novelty guard is deterministic preview logic. It uses normalized text hash, title hash, source canonical id, and keyword overlap. It does not call MiMo, paid APIs, embeddings, semantic models, or LLM cleaning.

Current decisions are:

- `duplicate_private`: reject.
- `duplicate_public`: reject.
- `duplicate_current_batch`: reject.
- `near_duplicate`: review required, reject for automatic import.
- `new`: eligible for import preview if clean, trusted, and attributed.

This is not production-grade semantic dedup.

## Private knowledge dedup

If a candidate already exists in private project knowledge or phase evidence, it is not imported again. Project evidence remains the truth source for project status and current capabilities.

## Public knowledge dedup

If a candidate already exists in the public knowledge preview index, it is not learned again. Public knowledge already present should not consume disk, index budget, review attention, or future model context.

## Current batch dedup

If a candidate repeats inside the current import batch, the duplicate candidate is rejected. This avoids importing the same text twice during one local preview run.

## Near-duplicate review policy

Near duplicates are not automatically imported. The preview records `reviewRequired=true` and `acceptedForImport=false`. A future phase may add human review or stronger semantic dedup, but this phase does not.

## Why public knowledge already present should not be imported again

Re-importing known public knowledge wastes storage and index budget, increases RAG noise, and can make source selection less clear. The preview rejects known content before it can enter the accepted import preview.

## Only new authoritative clean knowledge can be imported

Only authoritative, clean, source-attributed, trusted, and new knowledge can proceed into import preview. Private duplicates, public duplicates, current batch duplicates, low-trust content, unclean content, secret-like content, and near duplicates are not auto-imported.

## RAG source selection integration

The preview builds selected context packs for public questions such as "Who was Albert Einstein?" and keeps project status queries ranked by private phase evidence first.

## Token saving impact

Local fixture reads, deterministic cleaning, chunking, keyword indexing, novelty checks, and source selection metadata do not produce LLM tokens. This phase avoids paid API calls and prepares future RAG to send smaller selected context packs when a model call is explicitly approved.

## Safety boundaries

- No large dataset download.
- No full Wikipedia, Wikidata, or Gutenberg import.
- No MiMo call.
- No paid API call.
- No embedding call.
- No LLM cleaning.
- No semantic model call.
- No public knowledge sent to a provider.
- No duplicate private knowledge import.
- No duplicate public knowledge import.
- No duplicate current batch import.
- No near-duplicate auto-import.
- No change to default NVIDIA `/chat`.
- No MiMo default.
- No `legacy/` modification.
- No `PROJECT_CONTEXT.md` creation.
- No Codex CLI or real Codex exec.
- No workflow runner.
- No worktree.
- No auto commit or auto push.
- This is a local import preview, not a production public knowledge library.
- This is deterministic preview dedup, not production-grade semantic dedup.

## Verification commands

```powershell
node --check apps/ai-gateway-service/src/knowledge-import/publicKnowledgeManifest.js
node --check apps/ai-gateway-service/src/knowledge-import/publicKnowledgeImportPolicy.js
node --check apps/ai-gateway-service/src/knowledge-import/publicKnowledgeImportTypes.js
node --check apps/ai-gateway-service/src/knowledge-import/publicKnowledgeCleaner.js
node --check apps/ai-gateway-service/src/knowledge-import/publicKnowledgeChunker.js
node --check apps/ai-gateway-service/src/knowledge-import/publicKnowledgeSourceTrust.js
node --check apps/ai-gateway-service/src/knowledge-import/publicKnowledgeIndexPreview.js
node --check apps/ai-gateway-service/src/knowledge-import/publicKnowledgeNoveltyGuard.js
node --check apps/ai-gateway-service/src/knowledge-import/publicKnowledgeDedupIndex.js
node --check apps/ai-gateway-service/src/knowledge-import/publicKnowledgeImportBenchmark.js
node --check apps/ai-gateway-service/src/knowledge-import/adapters/kiwixZimAdapterPreview.js
node --check apps/ai-gateway-service/src/knowledge-import/adapters/gutenbergTextAdapterPreview.js
node --check apps/ai-gateway-service/src/knowledge-import/adapters/wikidataJsonAdapterPreview.js
node --check apps/ai-gateway-service/src/entrypoints/runPublicKnowledgeImportPreview.js
node --check apps/ai-gateway-service/src/entrypoints/verifyPublicKnowledgeImportPreview.js
cmd /c pnpm run import:public-knowledge:preview
cmd /c pnpm run verify:phase277a-public-knowledge-import-preview
```

## Next phase options

Recommended next route: Phase 278A Free Model Assisted Daily Knowledge Enrichment Pipeline.

Phase 277A establishes the public knowledge import preview and multi-layer novelty guard. A next preview can add free-model-assisted summaries, tags, QA cards, `40 requests/min` limit, `2 hours/day` budget, authoritative source selection, cleaning, dedup, and ledger metadata while still not calling MiMo or any paid API.
