# Public Knowledge Preview Fixtures

These tiny fixtures are used only by Phase 277A local import preview.

They are not full public datasets. They are not downloaded automatically. They do not call any model, embedding service, MiMo API, or paid API.

Fixture roles:

- `gutenberg-sample.txt`: clean/chunk/index preview.
- `wikipedia-sample.html`: Kiwix/Wikipedia adapter contract preview.
- `wikidata-sample.json`: Wikidata entity parser preview.
- `private-duplicate-sample.txt`: deterministic private knowledge duplicate rejection.
- `public-duplicate-sample.txt`: deterministic public knowledge duplicate rejection.
- `current-batch-duplicate-sample.txt`: deterministic current batch duplicate rejection.
- `near-duplicate-sample.txt`: review-required near duplicate preview.
- `low-trust-sample.txt`: low-trust default rejection preview.

`secret-like-sample.txt` contains a synthetic test marker only and must be rejected or sanitized by the cleaner before any evidence or index output.
