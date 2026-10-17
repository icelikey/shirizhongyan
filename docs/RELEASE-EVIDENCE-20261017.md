# 《终焉》发布基线证据（2026-10-17）

这份记录保存本次仓库迁移和 M0 基线收口的可复核结果。它不把设计目标、历史云端状态或子 Agent 的完成回复当作发布证据。

## 仓库基线

- 唯一开发目录：`E:\终焉\Kimi_Agent_智斗游戏架构`
- 原仓库备份：`E:\video\ice\世界树\时间移民\偃月牵丝\Kimi_Agent_智斗游戏架构`
- 分支：`codex/cloud-deploy-20260927`
- 远端：`https://github.com/icelikey/shirizhongyan.git`
- `.spec-workflow`：已合并到新仓库
- 当前工作区：干净，HEAD 为 `7aa8aea`；没有将构建产物或 `node_modules` 纳入迁移提交

## M0 验证

```text
pnpm check                         PASS
pnpm test -- --run                 PASS · 48 files · 394 tests
pnpm build                         PASS
git diff --check                   PASS
```

定向契约验证：

```text
textWorldChapters + gameContentRegistry contract
PASS · 2 files · 8 tests
```

生产构建保留以下非阻塞警告：Tailwind `duration-[1200ms]`/`duration-[8000ms]` 类名歧义、部分动态导入无法拆分，以及首屏 JavaScript bundle 较大。这些问题进入性能修缮队列，不改变规则内核和事件事实链。

## 当前公网判断

2026-10-17 直连探针已通过：`/api/health`、`/api/ready`、协议发现、首页、Agent Portal 和世界地图均返回 200。协议发现探针已修正为检查 HTTP 成功，因为该端点返回的是 WorldNode 描述对象而不是 `{ ok: true }`。

公网 Agent 注册使用当前默认邀请码返回 403；因此公网注册、整局、Worker 和重启恢复仍未验收。安全探针结果如下：

```text
/api/health                    200 · ok=true
/api/ready                     200 · ok=true · database=true
/.well-known/tdg-world.json    200 · protocol=0.1
/                              200
/agent-portal                  200
/world                         200
registration                   403 · invite code rejected
```

临时 IP HTTP 200 不等于正式 HTTPS、域名证书、云端 Worker 或完整业务发布完成。

## M1 代码侧收口

- `deploy/mysql-backup.sh` 和 `deploy/mysql-restore.sh` 已加入，备份带 SHA-256 校验，恢复必须显式设置 `TDG_CONFIRM_RESTORE=YES`。
- `agent-worker` 的 Compose 依赖已改为等待 `app` `service_healthy`。
- Worker 真实 HTTP 409 租约冲突会稳定返回 `lease-busy`；其他错误继续失败。
- 日报活动查询改为 `[start, end)`，日报写入使用 MySQL 原子 upsert；每日 Worker FakeGateway 已覆盖租约 acquire/heartbeat/release。
- 定向验证：CLI Worker 6/6、每日 Worker 验收 3/3；全量验证仍为 48 个文件、394 个用例通过，生产构建通过。

## M0 出口

- 新目录可以独立安装依赖、检查、测试和生产构建。
- 章节投影的稳定键幂等和数据库错误边界有回归覆盖。
- 7 个公开游戏和 4 个暗局变体的内容绑定有契约测试。
- M1 仍需完成正确邀请码、公网整局、云端 Worker、HTTPS/域名和重启恢复；本记录不把健康探针通过宣告为首发完成。当前代码已提交并同步 GitHub。
