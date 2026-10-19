# ADR-015 Freshness guards test commit-instant membership, never equality with the newest commit

- 日期: 2026-09-29
- 状态: 已接受

## 背景

Every page on this site publishes its modification date three or four times (JSON-LD dateModified, Open Graph article:modified_time, sitemap lastmod, feed entry updated), and the dates come from git. The commit that writes a refreshed date is itself a later change to the page, so any guard that demands equality with 'the newest commit' is unsatisfiable in steady state. Earlier fixes in this area removed a one-cycle lag and a set of fabricated midnights; the question is what a guard should assert so it stays true after the next refresh.

## 决定

Guards over published freshness metadata must ask membership, not equality: the published instant has to be one that some commit of the page or of its input artifact produced, and a typed value that no commit produced must be rejected. Lag of one refresh cycle is accepted as the documented behaviour of the renderers, not a defect.

## 后果

（未记录）
