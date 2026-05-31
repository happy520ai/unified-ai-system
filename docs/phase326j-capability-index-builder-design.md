# Phase326J Tianshu Capability Index Builder Dry-Run Design

## Purpose

Phase326J simulates a capability index builder for Tianshu Mode.

The builder uses mock user-configured models and optional evidence metadata. It does not call providers, read secrets, or enable Tianshu runtime.

## Index Sources

- mock_inventory
- evidence_metadata
- model_id_heuristic
- user_config_stub

If `model_id_heuristic` is used, it must be marked as inference and not treated as real evaluation.

