# Phase 24 Real Usage Knowledge Sample

## delivery-operations

The Phase 24 delivery operations document describes the daily command rhythm
for Unified AI System. Operators start with help, then use dev for managed
startup, status for managed state, health for service health, logs for
attributed output, and idle to safely return the chain to stopped. The concrete
commands are help:phase14a, dev:phase7b, status:phase10a, health:phase12a,
logs:phase16a, and idle:phase15a. This document is expected to be the top hit
for a delivery operations query.

## knowledge-default-mode

The knowledge default mode remains local-keyword with in-memory storage.
Documents are loaded through POST /knowledge/load with sourceId, documentId,
title, content, and metadata. Retrieval is performed through
POST /knowledge/retrieve and returns topHit, topChunk, topDocument, snippet,
highlights, matchedTerms, scoreBreakdown, and document metadata.

## vector-production-mode

The explicit vector production path is enabled only when KNOWLEDGE_INFRA_MODE
is vector and the embedding plus pgvector environment variables are present.
Phase 23Z passed a real Gemini embedding and pgvector write/read/retrieve
probe. The vector path is not mixed into the default NVIDIA chat route.
