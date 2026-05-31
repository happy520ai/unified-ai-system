# Real Approval Filling Guide

1. Open the draft file in `docs/approvals/phase361/drafts/`.
2. Fill `approvalId`, `approvalDecision`, `approverNameRef`, `approverRole`, `approverOrgRef`, `approvalTimestamp`, `approvedScope`, `conditions`, `expiration`, and `revocationPolicy` with real human-entered values.
3. Remove `draftOnly`, `notAnApproval`, and `requiresHumanCompletion`, or set them to `false` before promotion.
4. Copy the completed file into `docs/approvals/phase361/` with the matching non-draft filename.
5. Run the validation and Phase361 verifiers again.
