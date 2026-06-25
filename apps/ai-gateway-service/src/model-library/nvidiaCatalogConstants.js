/**
 * Shared constants for NVIDIA catalog data files.
 *
 * Extracted from nvidiaCatalogData.js so that nvidiaCatalogDataExtended.js can
 * reference the same source URLs without creating a circular import.
 */

export const OFFICIAL_SOURCE_URLS = Object.freeze({
  llmApis: "https://docs.api.nvidia.com/nim/reference/llm-apis",
  retrievalApis: "https://docs.api.nvidia.com/nim/reference/retrieval-apis",
  buildModels: "https://build.nvidia.com/models",
  buildNvidia: "https://build.nvidia.com/nvidia",
});
