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

本次没有重新宣称 ECS 健康。2026-10-16 的最新复核记录为：`69.5.21.20` 的 SSH banner、`/api/health` 和 `/api/ready` 均超时。恢复 ECS 后，必须重新执行资源预检、容器状态、数据库就绪、公网探针、Agent 整局和重启恢复验收。

## M0 出口

- 新目录可以独立安装依赖、检查、测试和生产构建。
- 章节投影的稳定键幂等和数据库错误边界有回归覆盖。
- 7 个公开游戏和 4 个暗局变体的内容绑定有契约测试。
- 代码仍需提交并同步 GitHub；公网恢复属于下一阶段 M1，不由本记录提前宣告完成。
