# 三档开关操作手册

## 日常（conservative）
启动即是。不烧钱，候选分支要人工 git merge。

## 临时升级
```bash
POST /workforce/tier {tier:"unlimited", operatorId:"owner", reason:"批量任务"}
```

## 用完关掉
```bash
POST /workforce/tier {tier:"conservative", operatorId:"owner", reason:"收工"}
```

## 查看当前档
```bash
GET /workforce/tier
```

## 紧急刹车
```bash
POST /workforce/tier/fallback {operatorId:"owner", reason:"异常"}
```

> 档位持久，重启不丢。不自动回落——前端开关是唯一控制源。
