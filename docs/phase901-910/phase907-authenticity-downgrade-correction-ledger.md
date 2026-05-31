# Phase907 Authenticity Downgrade / Correction Ledger

## Goal

Record conservative wording when Phase821-900 evidence does not prove an external Provider API call.

## Verified facts

- correctionRequired=true
- correctionLedgerGenerated=true

## Boundaries

- does not delete original evidence
- does not force confirmed status

## Outputs

- apps/ai-gateway-service/evidence/phase901_910/authenticity-correction-ledger.json

## Non-claims

- Local guarded executor attempts are not external Provider API proof.
- Mock, simulated, dry-run, or unknown evidence is never promoted to confirmed Provider response.
- This phase does not read raw secret values or auth.json.
- This phase does not modify default /chat or /chat-gateway/execute behavior.
