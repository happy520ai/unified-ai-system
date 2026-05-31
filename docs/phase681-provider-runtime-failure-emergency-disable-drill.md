# Phase681 Provider Runtime Failure / Emergency Disable Drill

Phase681 simulates:
- missing approval
- non-NVIDIA provider blocked
- raw secret detected
- missing rollback
- maxRequests exceeded
- timeout simulated
- budget exceeded simulated
- marker missing classification
- recursive spawn attempt
- emergency disable active

The drill does not add Provider requests. Blocked cases are not marked completed, and failed cases are not marked passed.
