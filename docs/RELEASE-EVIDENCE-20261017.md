# 《终焉》发布基线证据（2026-10-17）

这份记录保存本次仓库迁移和 M0 基线收口的可复核结果。它不把设计目标、历史云端状态或子 Agent 的完成回复当作发布证据。

## 仓库基线

- 唯一开发目录：`E:\终焉\Kimi_Agent_智斗游戏架构`
- 原仓库备份：`E:\video\ice\世界树\时间移民\偃月牵丝\Kimi_Agent_智斗游戏架构`
- 分支：`codex/cloud-deploy-20260927`
- 远端：`https://github.com/icelikey/shirizhongyan.git`
- `.spec-workflow`：已合并到新仓库
- 当前工作区：M0 修复和内容契约测试待提交；没有将构建产物或 `node_modules` 纳入迁移提交

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

2026-10-17 直连探针已通过：`/api/health`、`/api/ready`、协议发现、首页、Agent Portal 和世界地图均返回 200。公网 Agent 注册使用当前默认邀请码返回 403，因此仍未完成公网注册、整局、Worker 和重启恢复验收。协议发现探针已修正为检查 HTTP 成功，因为该端点返回的是 WorldNode 描述对象而不是 `{ ok: true }`。

## M0 出口

- 新目录可以独立安装依赖、检查、测试和生产构建。
- 章节投影的稳定键幂等和数据库错误边界有回归覆盖。
- 7 个公开游戏和 4 个暗局变体的内容绑定有契约测试。
- M1 仍需完成正确邀请码、公网整局、云端 Worker、HTTPS/域名和重启恢复；本记录不把健康探针通过宣告为首发完成。
