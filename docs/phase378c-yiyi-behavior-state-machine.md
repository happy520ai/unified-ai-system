# Phase378C Yiyi Behavior State Machine

- 依依的状态只用于 UI 表达，不授予任何执行权限。
- 状态覆盖 welcome、thinking、guiding、security_guard、red_team_blocked、evidence_explaining 等场景。
- forbiddenActions 显式包含 read_secret / bypass_approval / deploy。
