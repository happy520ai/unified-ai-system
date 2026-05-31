# Phase328C Tianshu Planner Accuracy Evaluation Design

Phase328C evaluates the real Phase328A Tianshu runtime through `/three-mode/execute`.

It measures task classification, model selection, fallback correctness, God escalation correctness, final answer presence, latency, and estimated cost.

It does not bypass the Planner or call models directly.
