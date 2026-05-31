# Phase596 Task 3 Token Budget Note

Phase596 uses the existing token budget report to benchmark repeated tasks against the 16k policy. The policy keeps project state, evidence refs, diff metadata, relevant files, long context summary, and prompt content inside a bounded pack.

The repeated benchmark estimates full-context tokens versus context-pack tokens for every task. The goal is not exact tokenizer parity; the goal is a stable, comparable estimate that shows whether the context pack avoids repeated large reads.

Current evidence records budget respected for all benchmark tasks and average token saving above the 80 percent threshold.
