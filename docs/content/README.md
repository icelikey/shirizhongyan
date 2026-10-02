# 终焉文字叙事内容包 v1

状态：`content-ready`

本目录只承载可被游戏运行时读取的原创文字、线索、卡片和战报模板，不包含代码、页面、图片或音频。入口清单是 [`manifest.json`](manifest.json)，三个游戏包分别位于：

- [`werewolf-12-core.json`](werewolf-12-core.json)：月影村 · 狼人杀
- [`superpower-billiards-core.json`](superpower-billiards-core.json)：终焉 · 巫蛊娃娃异能桌球
- [`superpower-race-core.json`](superpower-race-core.json)：金壤 · 超能力赛马

## 接入约定

每个游戏包都使用 `schemaVersion: "endings.content.v1"`，根对象至少包含：

| 字段 | 用途 |
|---|---|
| `contentId` | 内容身份，发布后不可复用；格式为 `endings.<game>.<kind>` |
| `game` | 运行时绑定，包括 `gameId`、`template`、`recordKey`、`rulebookId` 和世界贡献映射 |
| `openingCards` | 开场卡片序列；`order` 只控制展示顺序，`id` 才是引用键 |
| `rules` | 面向玩家的玩法说明、阶段、合法动作和不可越权边界 |
| `storyFragments` | 由事件或条件触发的剧情碎片，必须保留证据引用 |
| `clues` | 可发现线索，标明公开时机、来源事件和可信度 |
| `dropTable` | 按权重抽取的 `memory` / `skill` 卡；卡片效果只能作用于信息、时机、路线或合法能力窗口 |
| `battleReportTemplate` | 把真实事件流改写成小说化战报的受约束模板，不生成隐藏思维链 |
| `projections` | `human` 与 `agent` 两套展现层；Agent 层是结构化事实和候选动作，不是模型内部思考记录 |
| `fallback` | TTS、模型、3D 或网络不可用时的降级文字路径 |

## 稳定 ID 约定

- 运行时 ID 沿用代码注册表：`game.gameId` 不作为内容文案标题的替代物。
- 内容 ID 使用小写、点分段、不可复用：`endings.werewolf12.fragment.night-trace`。
- 同一内容包中所有 `id`、`cardId`、`reportTemplateId`、`dropTableId` 唯一；引用只指向稳定 ID，不引用数组下标。
- `openingCards[].order`、掉落 `weight` 和文案都可以在小版本调整；稳定 ID、`schemaVersion`、运行时绑定和事件钩子变更时必须升版本。
- `evidenceRefs` 只接受事件 ID、规则条款 ID、卡片 ID 或运行时回放键；没有来源的传闻只能停留在 `storyFragments[].status: "candidate"`。

## 双展现层

`human` 层回答“玩家现在看见什么、下一步能做什么”；`agent` 层回答“该席位被授权知道哪些事实、有哪些合法候选、哪些结论不能提前下”。Agent 层不记录或模拟未落库的隐藏思维链，只能使用 `facts`、`legalOptions`、`evidenceRefs`、`decisionFrame` 和 `doNotInfer` 等结构化字段。

三款游戏都保留三类权限边界：

1. 公开层：所有席位或观众都能看到的阶段、公开事件和结算结果。
2. 席位层：只向角色、持球席位、参赛动物或被授权的 Agent 投影的信息。
3. 系统层：用于确定性结算和回放的事实，只在合法揭示节点转为公开层。

## 原创边界

本包只使用终焉项目自己的大陆、卡片、事件、席位和世界规则。三款游戏的文字均为原创表达，不复制任何外部作品的角色、地点、台词、关卡、谜底、叙述句式或剧情顺序。狼人杀、桌球、赛马作为通用玩法名使用；世界内的场景、线索和碎片均为本项目重新设计。

## 当前未完成项

- 本次只新增 `docs/content/` 内容文件，没有修改 `app/`、`contracts/`、页面、数据库或其他目录。
- 运行时目前没有统一的内容包加载器；接入时需把 `contentId`、`rulebookId`、事件钩子和掉落映射接入现有注册表与奖励回写。
- 巫蛊娃娃和赛马的 `rulebookId` 是本内容层的稳定 ID；现有代码对这两个模板没有像狼人杀那样导出的单一规则常量，工程接入时需将其写入发布迁移和回放兼容表。
- 文字包尚未经过真实房间、真人 + Agent 整局、事件回放和前端双投影验收；本目录的验证只证明结构、引用、JSON 和写入边界正确。

## 建议验证

在项目根目录执行以下只读检查：

```powershell
$root = 'E:\video\ice\世界树\时间移民\偃月牵丝\Kimi_Agent_智斗游戏架构'
$content = Join-Path $root 'docs\content'

Get-ChildItem -LiteralPath $content -Recurse -File | Select-Object FullName, Length

Get-ChildItem -LiteralPath $content -Filter '*.json' -File | ForEach-Object {
  Get-Content -LiteralPath $_.FullName -Raw -Encoding UTF8 | ConvertFrom-Json | Out-Null
  "JSON_OK $($_.Name)"
}

$jsonFiles = Get-ChildItem -LiteralPath $content -Filter '*.json' -File
$ids = foreach ($file in $jsonFiles) {
  $doc = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
  $doc.contentId
  $doc.game.gameId
  $doc.openingCards.id
  $doc.storyFragments.id
  $doc.clues.id
  $doc.dropTable.id
  $doc.dropTable.entries.id
  $doc.battleReportTemplate.id
}
if (($ids | Group-Object | Where-Object Count -gt 1).Count -gt 0) { throw 'DUPLICATE_CONTENT_ID' }
'UNIQUE_IDS_OK'

$outside = git -C $root status --short -- docs/content
if ($outside) { $outside } else { 'CONTENT_SCOPE_OK' }
```

JSON 通过不等于运行时接入完成；必须继续执行项目已有的类型检查、规则测试、密态投影测试、回放测试和真人 + Agent 整局验收。
