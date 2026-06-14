# 自主权接口参考

## 档位
- GET /workforce/tier — 读当前档 + caps + 审计
- POST /workforce/tier — 切档 {tier, operatorId, reason}
- POST /workforce/tier/fallback — 降一档
- POST /workforce/tier/gate — 升一档（兼容）

## 预算
- GET /workforce/autonomy/usage — 今日用量/剩余
- GET /workforce/autonomy/trust — 信任阶梯

## 诊断（只读提权，脱敏+审计）
- POST /workforce/diagnostic/read {path, requestor, reason}

## 执行
- POST /workforce/execute {goal, userId, autonomyMode?}

## 范围令牌
- POST /workforce/autonomy/token {userId, pathScope, ttlDays}
- POST /workforce/autonomy/token/revoke {tokenId}
