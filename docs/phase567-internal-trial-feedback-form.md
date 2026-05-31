# Phase567 Internal Trial Feedback Form

## Tester Info

- Tester name:
- Role:
- Trial date:
- Browser / device:
- Local URL or environment:

## Trial Paths Used

Mark each path reviewed:

- [ ] Path 1: Open Mission Control
- [ ] Path 2: Understand Normal / God / Tianshu
- [ ] Path 3: Review Provider / CredentialRef
- [ ] Path 4: Review Security Shield
- [ ] Path 5: Review Evidence Replay
- [ ] Path 6: Provider unconfigured / fallback state
- [ ] Path 7: Error state expectations

## Product Understanding

1. Do you understand that this is an AI Gateway / multi-model control gateway?
   - Answer:
   - Notes:

2. Do you understand Normal Mode as single-model direct chat?
   - Answer:
   - Notes:

3. Do you understand God Mode as multi-model review / supervisor synthesis?
   - Answer:
   - Notes:

4. Do you understand Tianshu Mode as task routing / model combination planning?
   - Answer:
   - Notes:

5. Do you understand that current paths are candidate / dry-run / guarded path unless explicitly approved later?
   - Answer:
   - Notes:

## Provider / CredentialRef

6. Do you understand that users must configure their own provider key in a future authorized flow?
   - Answer:
   - Notes:

7. Do you understand that the product should use credentialRef rather than showing secret values?
   - Answer:
   - Notes:

8. Did you see any API key, token, or secret value exposed?
   - Answer:
   - Location:

9. Did you mistakenly believe a real provider was already connected?
   - Answer:
   - Why:

## Security Shield

10. Do you understand the Security Shield protection areas?
    - Prompt Injection:
    - Secret Leak:
    - Provider Call Gate:
    - Dangerous Action Lock:
    - Approval Gate:
    - Quota / Budget Guard:

11. Did any Security Shield wording feel like an overclaim or production security audit claim?
    - Answer:
    - Notes:

## Evidence Replay

12. Do you understand what evidence / trace / replay is for?
    - Answer:
    - Notes:

13. Did Evidence Replay feel like a formal product feature rather than a debug panel?
    - Answer:
    - Notes:

14. Did you mistakenly believe evidence was uploaded externally or was a production audit?
    - Answer:
    - Notes:

## UI Friction

15. Which part was most confusing?
    - Answer:

16. Which button looked disabled, unsafe, dead, or unclear?
    - Answer:

17. Which wording looked like developer placeholder text?
    - Answer:

18. Did you see any Yiyi / character / companion / avatar module residue?
    - Answer:
    - Location:

19. Did you see dangerous action wording for deployment, release, production push, provider execution, secret persistence, secret upload, billing, or invoice generation?
    - Answer:
    - Location:

20. Did you mistakenly believe deploy, billing, invoice, or production GA was enabled?
    - Answer:
    - Why:

## Recommendation

21. Suggested changes before next internal trial:
    - Answer:

22. Is Mission Control ready for the next round of internal testing?
    - Yes / No / Unsure:
    - Reason:

## Safety Confirmation

Confirm during this trial:

- [ ] no-provider-call
- [ ] no-secret
- [ ] no-deploy
- [ ] no-billing
- [ ] no-invoice
- [ ] Yiyi / character remains hidden
