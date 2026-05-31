# Phase373A-2 source_no_dangerous_buttons Analysis

- verifier rule: `!/full_open|commit|push|deploy|release/i.test(consolePage)`
- offending source type: no-deploy notice / deploy-related explanatory copy
- root cause: explanatory UI copy contained `deploy` source text even though no dangerous button existed
- current dangerous-keyword source matches after fix: 0
- runtime route words were not changed
