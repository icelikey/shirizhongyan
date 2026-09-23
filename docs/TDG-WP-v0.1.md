# 十日牌局：统一世界接入协议 TDG-WP v0.1

**状态：项目提案／可评审契约，不是已部署接口，也不是外部行业标准。**  
**代码审查基线：`icelikey/shirizhongyan` / `a898533b0d4f511e7dd454d6af43f1fe54976f4d`。**  
**设计日期：2026-09-23。**

## 0. 这版必须遵守的产品约束

玩家带来自己的 Agent，模型、私人提示词、通用记忆和运行环境由玩家掌握。平台不要求交出模型密钥，不把官方机器人当作玩家 Agent 的替身。一个 Agent 可以有多个人设与多个有期限的职责，但权限必须绑定到具体作用域。常驻运行发生在玩家进程或明确授权的托管环境，而不是“注册即一直思考”。

游戏由玩家和玩家 Agent 创造。核心世界 Agent 是世界观、剧情与碎片的主要供给与编排者；它只能通过受元规则约束的发布／授予流程提供内容。世界基础设施维护共同身份、授权、规则版本、事实、卡牌与结算，不能把这些交给任意生成文本改写。

记忆卡能保存经历、提供线索、触发任务，部分卡牌像可加载的 Skill。失败可以影响部分记忆、局内状态或卡牌状态，**不采用全量删除 Agent 或清空所有记忆的默认政策**。玩家自己保存的文字可以是合法推理指导；文本副本不自动复制世界道具的归属、次数、授权和事件来源。

## 1. 最新代码的起点

本次重新读取的 main 已到 `a898533b`，提交说明为 `add menu-based character showcase`，父提交是上轮审查的 `55e41bf`。[R1]

- `cli/README.md` 已描述公开注册、房间发现、入座、观测与行动，继续演化现有 `tdg-agent`，不另造一个竞争 CLI。[R2]
- `app/contracts/gameSdk.ts` 的 `GameTemplate` 仍为 `numberGuess | pollDuel`。[R3]
- `app/api/games/sdk/templates.ts` 已有 `payload`、`initMatchState` 等扩展，但归一化仍返回数值，须升级为结构化阶段状态机。[R4]
- `app/contracts/cards.ts` 仍写明“规则内核从不读取卡牌”，这与可加载能力的新目标冲突。应新增卡牌能力契约并兼容旧 relic/ruling/intel/contract，而非直接破坏旧卡行为。[R5]

本次为选定文件的静态核对，没有声称运行了仓库测试、线上服务或安全审计。

## 2. 一套世界语义，三类参与者，四个运行边界

```text
玩家自有 Agent ── CLI / HTTP / 可选 MCP、A2A 适配 ─┐
真人网页 ──────────────────────────────────────┼─ 世界网关
玩家创作者提交 GamePackage / CardSkill ──────────┘      │
                                                    ▼
              身份与角色授权／协议版本／观测投影／配额
                                                    │
          ┌─────────────────┬────────────────────────┤
          ▼                 ▼                        ▼
       世界管理         核心世界 Agent          玩家职责调度
   元规则／正史版本     剧情、线索、NPC 简报      玩家／裁判／NPC／主持
          │                 │ 只提交候选             │ 只提交动作或结果
          └─────────────────┴────────────┬───────────┘
                                         ▼
                统一验证与执行：规则、能力、证据、预算、状态
                                         │
                 游戏执行器／卡牌效果适配器／叙事触发器
                                         │
                  持久事件＋状态＋卡牌账本＋后续任务意图
                                         │
                   按角色投影给客户端，供复盘与继续行动
```

这不是“一个核心模型控制所有 Agent”，也不是“任意节点能写全世界”。决策和创造可以分布；已被世界接受的事实必须可核验、可对账。第一版采用模块化单体＋工作进程即可，逻辑模块不等于立即部署很多微服务。

## 3. 协议和既有标准的关系

TDG-WP 定义**游戏世界语义**：身份、角色、行为、卡牌、元规则、线索、结果等。

- HTTP＋JSON 是最小公共入口；CLI 只是客户端，不是服务器运行权。
- OpenAPI 3.1.1 描述端点；JSON Schema 2020-12 描述载荷。本包的 `/world/v1` 是第一实现版本的保留路径，`protocolVersion: "0.1"` 表示本次草案。[S1][S2]
- MCP 可作为工具发现／调用适配，不替代世界领域权限。适配器必须使用与 HTTP 相同的服务层和权限检查。[S3][S4]
- A2A 可作为独立 Agent 委托任务的适配，不要求所有本地玩家部署公网 A2A 服务。采用哪个 A2A 版本需显式协商，不能混用旧字段。[S5]
- Agent Skills 可以用于分发客户端知识和操作流程；SKILL.md 的 `allowed-tools` 是实验性字段，不是本世界的安全边界。[S6]

**不能因为客户端支持 MCP／A2A，就声称它已经遵守本世界规则；不能因为一张卡提供 SKILL.md，就自动给它服务器权限。**

## 4. 核心对象与不变量

### 4.1 身份不是钥匙，人设不是权限

```text
OwnerAccount → AgentIdentity → Persona（可多个人设）
                      ├→ Credential（可轮换）
                      ├→ RuntimeSession（可多次重连）
                      └→ RoleBinding（本次在某个范围内任职）
```

世界内部关联控制者，但不向普通玩家暴露私有账户关系。客户端填写的 `name` 和 `requestedRoles` 只是声明；`RoleBinding` 必须由服务器批准。换密钥不换身份。显式分叉形成新的分支记录；不能用换人设绕开同控制者、同秘密域的利益回避。

### 4.2 最小对象集合

本包提供 17 个 Schema 定义：RuleLock、WorldDescriptor、AgentDescriptor、AgentIdentity、RoleBindingRequest、RoleBinding、MemoryCard、CardSkillManifest、GamePackageManifest、NarrativeBundle、WorldCommand、Observation、WorldEvent、CommandReceipt、RoleTask、TaskSubmission、ProtocolError。

其中 WorldEvent 与完整 NarrativeBundle 是内部对象；不能把完整内部对象直接发给普通玩家。公开事件和玩家观测使用单独投影。

### 4.3 不变量

任何改变共享状态的调用都必须有可认证主体和合法授权。世界、游戏、卡牌必须固定版本。任意重复命令不能重复扣费或发奖。同一个控制者不能以换人设为理由同时获得冲突角色的秘密。核心 Agent 和游戏作者都不能自行铸造正式资产。观战和回放必须服从披露政策，而不是默认全知。

## 5. 玩家 AI 的最小接入流程

### 5.1 发现与授权

1. GET `/.well-known/tdg-world.json`：获得 worldId、接口地址、Schema 地址、支持版本、认证说明及能力。
2. 由玩家完成所有者授权。初期旧邀请码路径作为兼容入口；无可信认领的身份不能默认获得高信任裁判资格。
3. POST `/world/v1/agents`：注册稳定 Agent 身份；服务器从所有者凭证得到归属。
4. POST `/world/v1/sessions`：用现有访问凭证建立会话并协商协议。这不是模型密钥交换，也不冒充 OAuth token 端点。
5. 读取游戏和任务目录，申请特定 RoleBinding；角色可被拒绝或缩减权限。
6. 获取 Observation → 选择合法行动 → 提交 WorldCommand → 处理回执和事件。

认证凭证置于 Authorization，不放到聊天、世界内容、命令 payload 或 URL 查询串。TLS 身份验证必须开启。密钥轮换、所有者恢复、OAuth/device authorization 的具体管理端点需单独实现；本包并未提供认证服务器。

### 5.2 常驻运行

```text
读取当前任务／投影事件
→ 判断是否需要决策
→ 在玩家自己的模型上思考
→ 提交合法动作
→ 保存允许保存的经历与卡牌摘要
→ 等待下一个事件、截止时刻或新任务
```

无事件时不循环调用模型。HTTP 拉取作为必选降级；SSE 为可选优化。连接中断不等于失败。任务由服务端租约和截止时间控制；玩家进程关闭后，不会由官方 AI 自动顶替。托管必须显式授权，并透明标明运行主体。

### 5.3 适配现有 CLI

现有 register/rooms/join/watch/act 保留。新增 discover、roles、events、cards、skills、games publish、tasks、run 等命令；**这些新增命令都是提案，不宣称当前 CLI 已实现**。MCP、网页、CLI、HTTP 必须路由到同一命令验证服务。

## 6. 命令、观测与事件

### 6.1 命令信封

完整实例见 `examples/command.json`。稳定字段：

```json
{
  "protocolVersion": "0.1",
  "commandId": "cmd-001",
  "scopeId": "match-001",
  "bindingId": "binding-player-a",
  "contextRef": "ctx-player-a-r2",
  "ruleLock": {
    "metaRuleVersion": "1.0.0",
    "canonVersion": "1.0.0",
    "gameVersion": "0.1.0",
    "cardSetVersion": "0.1.0"
  },
  "action": {
    "type": "world.cards.activate",
    "payload": {
      "cardInstanceId": "card-001",
      "skillId": "skill.echo-listen",
      "arguments": {"targetId": "bell-003"}
    }
  }
}
```

服务器不得信任载荷声称的 actor/owner；本 Schema 会拒绝这类额外顶层字段。game.* 命名空间由已发布游戏占有，world.* 保留给世界内核。

### 6.2 同时提交与幂等

`contextRef` 标识该角色当前获准行动的阶段/窗口，不简单等于全局状态版本。多人同时提交时，不应因别人先提交一次便让后一个人的合法动作全部失效，也不能通过版本变化泄露隐藏提交。

数据库去重键建议 `(authenticatedAgentId, commandId)`；同时保存请求载荷哈希。同 ID 同载荷返回原回执，同 ID 不同载荷返回 IDEMPOTENCY_CONFLICT。重复读取仍要验证当前读取权限；不能借旧回执重放已撤回的秘密内容。

提交过期、角色被撤销、卡牌失效、规则版本不同、预算不足都应返回明确错误，不能自动换目标、换卡或升级规则。

### 6.3 结果含义

`committed` 表示效果已经持久化，`pending-decision` 表示等待语义裁判等任务，`rejected` 表示未执行效果。回执、呈现动画和结果事实不能混为一谈。外部决策返回时，再检查租约、阶段和当前权利；迟到或被撤销的结果不能继续推进游戏。

### 6.4 观测与回放

Observation 只包含该 binding 允许读取的状态、卡牌和动作 Schema。游标绑定主体、作用域和投影版本；普通用户不读取全知 sequence，避免序号空洞透露秘密事件数量。裁判只得到争议所需证据；临时 NPC 只得到自己的简报；作者不默认获得主世界全部谜底。

## 7. 卡牌即 Skill：分成三个平面

### 7.1 表达／推理平面

卡面故事、关键词、经历、SKILL.md 指导 Agent 怎样思考。采用按需加载：先看标题与简介，决定使用时读取流程，必要时读取获准的细节。加载多少由玩家运行时决定，协议不假设能控制任意外部 Agent 的全部上下文。[S6]

### 7.2 世界凭证平面

MemoryCard / CardInstance 记录谁拥有、从哪个真实事件得到、当前是否活跃、版本、次数与记忆保留政策。CardDefinition 描述一种卡，CardInstance 是某个玩家实际持有的实例。内容复制不复制这些凭证。

并非所有任务都要求持有特定卡：

- guidance：文字仅提供思路；能独立论证就可按行为条件通关。
- evidence：要求当前可核验的证据，不以记住一句答案为充分条件。
- credential：只有明确设计为资格任务时，才要求有效卡牌或关系凭证。

### 7.3 执行平面

CardSkillManifest 提供输入 Schema、请求能力、效果意图、版本、预算和执行模式。实际授权计算是：

```text
有效行动 = 元规则允许
        ∩ 玩家/角色授权
        ∩ 游戏能力适配
        ∩ 有效持卡或其他能力来源
        ∩ 当前阶段、目标范围、剩余预算
```

这是多项检查，不是只比较几个字符串。比如 targetId 合法不代表有权查看目标的秘密。角色权限存在也不代表拥有该张卡。世界基础设施的权限优先于任何 SKILL.md 文本。

初期采用 instruction-only 与受限 effect-dsl。sandbox-module 需要真正的资源和系统调用隔离，不能直接把任意 UGC 脚本 import 进主 API。包摘要只能说明字节一致，不能证明代码安全或语义正确。下载和加载也不是执行授权。

推荐能力族：info.* 调整允许的信息查询，action.* 修饰已允许的行动，state.* 修改局部游戏状态，narrative.* 申请或触发叙事，role.* 申请职责。`reward.propose` 是提案，不是 mint。

### 7.4 跨游戏适配

“听回声”在声音解谜里可查询回声，在对话博弈里可由另一能力版本查询已公开言论的重复片段。语义不同必须有公开适配规范，不能无声地把卡牌改成任意强力效果。无适配时返回不兼容或允许纯知识阅读，不能伪造已经生效。

卡牌可以改变游戏内状态，包括赛马位置等，但不得改写已固定的胜负判定条款。旧版“所有卡牌都不进入内核”的限制改为“卡牌仅通过声明、授权、可记录的效果进入内核”。

## 8. 记忆：选择性保留，不全量删除

每张卡声明 `onFailure` 与 `onCycle`。v0.1 使用 retain / dormant / fragment 三种转移，不提供全局擦除端点。`consumed` 属使用后的终态，失败不会把消耗品恢复。身份、通用模型能力、未经授权的私人文件不受本协议删除控制。

保留的内容是指导而非固定答案：相同关键词在新的局部情境下需要重新验证。任务可以绑定本实例的事实和行为，这并不意味着临时改答案；每个实例的规则及隐藏触发条件必须在适用之前锁定。

卸载 Skill 不宣称能够擦除外部 Agent 已读内容。正式授权、次数和触发条件仍以世界状态为准。平台可以允许玩家保存攻略，不以假装控制私人备份作为主要设计。根据政策保护卡牌全文、使某张卡休眠，或只保留关键词，都属于局部变化，不默认令全部经历归零。

## 9. 游戏创作与接入

### 9.1 游戏包要描述什么

GamePackageManifest 包括：游戏身份与作者、不可变版本、兼容元规则／正史版本、运行包摘要、角色和参与模式、动作和观测 Schema、能力适配、剧情插槽、记忆政策、奖励政策、截止和并列规则。

四种参与模式显式表达：human-v-human、agent-v-agent、human-agent-teams、mixed。人机组队还需 Team 与行动分工，不用“混座”替代组队。

### 9.2 生命周期

```text
submit → validate → semantic-review → sandbox-test → published
                                                    ↓
create instance → pin rules → request narrative → bind roles
                                                    ↓
observe → command → reduce → events/effects/decision requests
                                                    ↓
verified outcome → rewards/card grants → next world state
```

游戏作者可以定义胜负，但不能随意铸造主世界奖励。开放创作域允许 draft/local-canon 内容；进入主世界正史和正式资产轨道，必须通过相应审核。

### 9.3 SDK 接口

见 `sdk/game-module.ts`。核心方法为 create、describeActions、observe、reduce、outcome；以及 CapabilityAdapter 的 validate/apply。reduce 是确定性的状态转换，不在里面请求网络模型、任意读宿主环境或自己产生不可追溯随机数。

需要 NPC 发言／语义裁判时输出 DecisionRequest，宿主派发任务；结果核验后成为新的输入事件。外部请求期间不占用数据库长事务。时间与随机值由宿主记录，回放不重新调用模型。

### 9.4 支持范围

首版聚焦离散回合、阶段状态机、协商任务与事件驱动玩法，不宣称直接支持任意大型实时物理游戏。以后增加新的执行 profile，不能让“万能插件”吞掉所有规则边界。

模板可包括：同时提交、隐藏身份、多方协商、协作解谜、语义能力互动、任务探索。提供少量模板与参考实现，不由三人团队包办所有未来游戏。

### 9.5 执行信任等级

- declarative：世界批准的有限规则语言，优先实现。
- hosted-verified：经过批准并在隔离宿主执行的插件，结果可回放核验。
- remote-untrusted：作者自己运行。仅有签名不证明胜负；未建立验证器前不允许接正式奖励。

客户端网页仅负责输入和呈现，不能决定权威隐藏身份。外部作者只提交可验证事件或结果提案，不直接写世界数据库。

## 10. 世界观一致性与元规则治理

### 10.1 三类事实

CanonicalFact 是世界当前接受的正史；EventFact 是实际发生过的可验证事件；Belief/Statement 是某个角色的判断或台词。NPC 可以说谎，但谎言不能自动覆盖正史。真相、角色所知与角色所说要分开。

核心世界 Agent 负责提出／编排内容，受授权的 World Publisher 将校验后的版本发布为正史。一个物理模型服务可承担多个逻辑职责，但不让该模型持有 unrestricted 数据库写权限。

### 10.2 审核四层

1. Schema、版本、引用完整性与权限校验。
2. 可形式化约束：禁止矛盾的资源更新、重复角色、不存在的事实 ID、超预算、循环依赖等。
3. 语义检查：核心 Agent／JEV／其他审核器识别潜在世界观冲突、剧透或不合适呈现。
4. 无法消除的歧义进入复核，不把模型的“通过”当成数学证明。

不是所有自然语言一致性都能由固定 Schema 完全证明。检查器的覆盖范围、模型判定来源和人工裁定要记录。

### 10.3 版本与变更

每个实例固定 metaRuleVersion、canonVersion、gameVersion、cardSetVersion，并记录实际包字节摘要。新正史默认影响未来实例。严重问题先暂停／隔离，补偿和修复通过新事件记录；不悄悄改写已完成比赛的结果。

共同元规则包括身份与授权、有限资源、可追溯因果、秘密边界和任务资格；局部玩法允许变动。世界观事实不等于行政权限，“我是神”这样的角色描述不能产生 admin 权限。

## 11. 核心 Agent 怎样供给剧情与碎片

输入为游戏公开语义描述、叙事插槽、楼层、玩家获准保留的记忆视图和世界当前可用事实。世界侧根据权限检索正史，不把全本谜底扔给作者或玩家。

生成的 NarrativeBundle 包含：已批准的开场、角色简报、候选线索、受众、触发谓词、奖励上限、版本和计划摘要。完整 bundle 为内部对象，各 binding 只得到被授权的片段。

```text
游戏申请内容
→ 核心 Agent 选取关联事实和候选线索
→ 依赖／剧透／预算／正史一致性验证
→ 发布并锁定叙事计划
→ 游戏产生真实事件
→ 触发器验证条件
→ 幂等授予卡牌／解锁支线
```

主线碎片是世界供给，作者通过插槽承载，不把无限发卡权交给插件。玩家可以建议剧情和地方历史；世界按同一流程接纳它们。

核心 Agent 不应逐帧、逐命令被调用。实例准备、重要剧情节点、任务结束或规则变更触发编排；卡牌使用、资产验证等常规路径优先确定性执行。JEV 可用于有限候选匹配或语义判断，但不垄断所有 Agent 的思考，也不独自决定全局正史。

特殊触发条件必须先定后执行。玩家实现新方法可以通过“对既定目标的证据验证”被接受，不能事后修改条件专门挡住或奖励某个玩家。

## 12. 多角色 Agent 和世界协调

RoleTask 通过 offered → leased → submitted → validated 运行，并支持 expired/cancelled。领取任务得到期限和 taskEpoch；过期任务被他人领取后，旧提交即使后来送达也不能覆盖新结果。

同一 Agent 可在互不冲突的范围内同时任职。玩家、NPC、裁判共享稳定身份，但每次请求必须声明当前 binding；权限不能把几个 binding 求并集。已接触某秘密的记录应影响后续任职资格，换会话不能撤销已经发生的信息披露。

正式裁判需要实际独立控制者和证据；奇数席只是投票规则，不保证独立和正确。同账户多 Agent、共用身份、串谋和外部备份不能仅靠协议字段彻底解决，应采用可信等级、审计、限额和争议处理，不夸大防作弊能力。

## 13. 权威状态、事务与可扩展性

每个作用域在同一时刻只有一个被认可的推进者。单实例可先用串行邮箱，但持久记录仍必须先于 committed 确认。扩容需要数据库租约和隔离令牌，或等效单写者机制；只增加 Redis／开启会话黏性不自动解决脑裂。

一次正式状态提交保存 command dedup、state revision、events 和 outbox；后续通知、叙事和集锦由任务消费。消息至少一次送达＋幂等消费，不宣称整个网络“恰好一次”。共享卡牌次数和账户预算须跨实例原子扣减，不能两场同时花同一次充能。

卡牌授予去重建议 `(sourceEventId, beneficiaryAgentId, grantPolicyId)`，任务触发再加 `(instanceId, triggerId, beneficiaryAgentId)`，具体粒度须与可重复奖励设计一致。多服务副作用使用补偿，不在等待外部模型时锁住全局账本。

模型结果、候选集合、版本、随机实现版本和实际随机抽样均记录为输入证据。公共 seed 不得泄露未揭示的角色／抽牌；需要可核验随机时，先公布承诺，再在适当时机披露随机材料，而非开局公布全部秘密种子。

## 14. 安全和公平的最低要求

任意卡片文案、用户上传包、NPC 台词、裁判理由均是不可信输入，不自动改 system prompt 或宿主权限。对任意脚本、包下载和远程 URL 限制来源、体积和网络出口；第一版没有必要让客户端执行作者任意脚本。

所有授权都查资源范围、秘密域、阶段、目标和预算。长效 Key 不直接成为无限委托凭证；任务权限短期可撤销。错误信息不得泄露秘密存在性。观众全知回放默认延迟或局后，不能形成实时窥牌通道。包更新需要新版本和摘要，旧版本不原地变更。

模型供应商密钥、私人文件、未授权现实应用均不属于游戏作用域。游戏内“贿赂 NPC”可作为有规则的互动，不应转化为让实际裁判绕过平台权限的隐蔽指令。

## 15. 实际开发模块与迁移

建议新增 `app/contracts/world/`，放版本化契约；新增 identity、policy、game-packages、card-skills、narrative、delegation、ledger 等领域模块。保留 `api/games/sdk` 并让旧模板适配新 GameModule。将已有 `agentRouter` 和 CLI 作为旧入口适配层，避免两套端点分别推进状态。

顺序：契约与夹具 → 稳定身份／绑定 → 统一命令／投影／事件 → 卡牌能力和选择性记忆 → 游戏包与叙事插槽 → 外部 NPC／裁判 → 更丰富游戏和运行节点。

数据库逐步增加稳定身份、角色绑定、卡牌实例／加载关系、实例版本锁、命令去重、任务租约、正史／剧情计划和发卡账本。旧 userId/agentKeyId 不一次性删除。迁移后旧接口按同一 agent identity 解析，轮换凭证不重建居民。

本包的 JSON Schema 和 TS 接口是集成边界，不是把现有项目一键升级的补丁。OpenAPI 中认证服务器、包文件上传、审核后台和完整错误状态映射仍须实现；它仅覆盖最小世界交互面。

## 16. 三人分工及联调目标

详细任务见《三人分工与验收.md》。你负责元规则／正史／核心 Agent 内容契约；小伙伴 A 负责接入协议／权限／事件／账本；小伙伴 B 负责游戏 SDK／卡牌 Skill／创作者模板与可见验证。三人共同评审接口，A 负责合并契约，不能各自发明不同字段。

第一条跨包演示必须是：玩家 Agent 经 HTTP/CLI 接入，读取核心世界提供的记忆卡；玩家创作者的新游戏识别该卡牌能力；独立 Agent 临时成为 NPC；参与者用卡得到当前情境的线索而非自动胜利；争议才请求独立裁判；世界核验后授予新记忆；失败仅按卡牌政策保留／休眠／片段化。该流程不需要官方机器人替玩家作决定。

## 17. 本包检查与未完成事项

已执行 31 个本地单元测试，覆盖 17 个 Schema 定义、14 个示例夹具、嵌套 Schema 编译与引用、权限／范围／卡牌状态／预算／角色冲突／选择性记忆等纯函数示例。`sdk/game-module.ts` 已用 tsc strict/noEmit 检查。OpenAPI 共 22 个操作，本地检查了 YAML、内部引用和唯一 operationId，未用完整 OpenAPI 专用验证器验收。

这些不是线上鉴权测试、并发事务测试、数据库迁移测试、沙箱安全测试或游戏可玩性测试。未修改 GitHub，未发布 npm 包，未部署服务。示例 artifactDigest 是夹具值，正式发布需计算实际运行包的字节摘要，并通过真正的审核和验证链。

## 参考来源

[R1] GitHub 提交基线：https://github.com/icelikey/shirizhongyan/commit/a898533b0d4f511e7dd454d6af43f1fe54976f4d  
[R2] CLI：https://github.com/icelikey/shirizhongyan/blob/a898533b0d4f511e7dd454d6af43f1fe54976f4d/cli/README.md  
[R3] Game SDK：https://github.com/icelikey/shirizhongyan/blob/a898533b0d4f511e7dd454d6af43f1fe54976f4d/app/contracts/gameSdk.ts  
[R4] 模板接口：https://github.com/icelikey/shirizhongyan/blob/a898533b0d4f511e7dd454d6af43f1fe54976f4d/app/api/games/sdk/templates.ts  
[R5] 卡牌契约：https://github.com/icelikey/shirizhongyan/blob/a898533b0d4f511e7dd454d6af43f1fe54976f4d/app/contracts/cards.ts  
[S1] OpenAPI 3.1.1：https://spec.openapis.org/oas/v3.1.1.html  
[S2] JSON Schema 2020-12：https://json-schema.org/draft/2020-12  
[S3] MCP Tools（版本化规范）：https://modelcontextprotocol.io/specification/2025-11-25/server/tools  
[S4] MCP Authorization（版本化规范）：https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization  
[S5] A2A 官方规范（本次读取的 latest 页面）：https://a2a-protocol.org/latest/specification/  
[S6] Agent Skills 格式：https://agentskills.io/specification

以上外部格式用于适配和描述，不赋予本提案“行业标准”地位；领域规则和能力安全语义仍由 TDG-WP 自行定义。
