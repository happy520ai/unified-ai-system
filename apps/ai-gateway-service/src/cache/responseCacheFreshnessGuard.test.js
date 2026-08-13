import { describe, it, expect } from "vitest";
import { evaluateResponseCacheFreshness } from "./responseCacheFreshnessGuard.js";

describe("response-cache-freshness-guard", () => {
  it("returns valid freshness for empty input", () => {
    const result = evaluateResponseCacheFreshness();
    expect(result.freshnessValid).toBe(true);
    expect(result.staleReason).toBe(null);
    expect(result.invalidated).toBe(false);
    expect(result.ttlValid).toBe(true);
  });

  it("detects freshness-required keywords in English", () => {
    for (const term of ["current", "latest", "today", "now", "status"]) {
      const result = evaluateResponseCacheFreshness({ query: `what is ${term}` });
      expect(result.freshnessRequired).toBe(true);
    }
  });

  it("detects freshness-required keywords in Chinese", () => {
    for (const term of ["当前", "现在", "最新", "阻塞"]) {
      const result = evaluateResponseCacheFreshness({ query: `${term}状态` });
      expect(result.freshnessRequired).toBe(true);
    }
  });

  it("does not require freshness for normal queries", () => {
    const result = evaluateResponseCacheFreshness({ query: "what is python?" });
    expect(result.freshnessRequired).toBe(false);
  });

  it("marks invalid when cache record is invalidated", () => {
    const result = evaluateResponseCacheFreshness({ invalidated: true });
    expect(result.freshnessValid).toBe(false);
    expect(result.staleReason).toBe("cache_record_invalidated");
  });

  it("marks invalid when TTL expired", () => {
    const result = evaluateResponseCacheFreshness({ ttlValid: false });
    expect(result.freshnessValid).toBe(false);
    expect(result.staleReason).toBe("cache_record_expired");
  });

  it("marks invalid when evidence hash changed", () => {
    const result = evaluateResponseCacheFreshness({
      recordLatestEvidenceHash: "old-hash-123",
      latestEvidenceHash: "new-hash-456",
    });
    expect(result.freshnessValid).toBe(false);
    expect(result.staleReason).toBe("latest_evidence_changed");
  });

  it("prioritizes invalidated over ttlValid in stale reason", () => {
    const result = evaluateResponseCacheFreshness({
      invalidated: true,
      ttlValid: false,
    });
    expect(result.staleReason).toBe("cache_record_invalidated");
  });

  it("prioritizes ttlValid over evidenceChanged in stale reason", () => {
    const result = evaluateResponseCacheFreshness({
      ttlValid: false,
      recordLatestEvidenceHash: "old",
      latestEvidenceHash: "new",
    });
    expect(result.staleReason).toBe("cache_record_expired");
  });

  it("does not mark evidence changed when recordLatestEvidenceHash is empty", () => {
    const result = evaluateResponseCacheFreshness({
      latestEvidenceHash: "some-hash",
      recordLatestEvidenceHash: "",
    });
    expect(result.freshnessValid).toBe(true);
  });

  it("does not mark evidence changed when hashes match", () => {
    const result = evaluateResponseCacheFreshness({
      latestEvidenceHash: "same-hash",
      recordLatestEvidenceHash: "same-hash",
    });
    expect(result.freshnessValid).toBe(true);
  });

  it("passes through latestEvidenceHash in result", () => {
    const result = evaluateResponseCacheFreshness({
      latestEvidenceHash: "my-evidence-hash",
    });
    expect(result.latestEvidenceHash).toBe("my-evidence-hash");
  });
});
