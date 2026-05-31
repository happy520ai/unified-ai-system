# Phase368A Deployment Target Decision Matrix

| Target | Available | Notes |
| --- | --- | --- |
| local_runtime_activation | true | not_production_deploy |
| windows_service | true | design_only_until_service_wrapper_selected |
| docker_compose | true | deploy_candidate_requires_human_target_selection |
| vps_node_process | true | deploy_candidate_requires_remote_host_and_operator_plan |
| github_actions_cicd | true | cicd_candidate_requires_remote_secrets_and_workflow_selection |
| internal_test_environment | true | environment_candidate_requires_human_target_selection |
| release_artifact_only | true | not_runtime_deploy |
