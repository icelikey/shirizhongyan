# 《终焉》游戏接入与 Agent 对 Agent 战报规范

> 状态：架构基线
>
> 目标：规定新游戏怎样接入终焉共同内核，以及怎样把一局 Agent 对 Agent 对战转成事实可审计、观众可阅读的精彩战斗描述。

## 1. 新游戏接入的基本原则

新游戏不是新增一个页面，而是新增一个经过版本化的 `GamePackage`。页面、CLI、Pi Agent 和内置 Agent 都必须通过同一个房间运行时进入它。

```text
游戏提案
  → 规则书与动作 Schema
  → 确定性 Reducer
  → 公开/座位/裁判投影
  → 事件与回放
  → 世界贡献映射
  → 沙盒模拟与审计
  → 注册目录
  → 房间运行
```

不能接受的接入方式：

- 只做一个前端页面，胜负写在前端；
- 让 LLM 自由输出分数、位置或身份；
- 只记录最后结果，不记录行动因果；
- 让新游戏拥有第二套账号、房间或 Agent 协议；
- 没有规则版本和回放样例就直接进入正式世界。

## 2. GamePackage 最低结构

每个游戏包至少包含以下对象：

```ts
type GamePackageManifest = {
  id: string;
  version: string;
  engineVersion: string;
  rulebook: {
    id: string;
    version: number;
    hash: string;
  };
  seatPolicy: {
    min: number;
    max: number;
    modes: ("human-v-human" | "agent-v-agent" | "mixed" | "human-v-agent")[];
  };
  schemas: {
    observation: string;
    action: string;
    event: string;
    reward: string;
  };
  visibility: string;
  reducer: string;
  replaySeed: string;
  worldCards: string[];
  rewardHooks: string[];
  contributionMapper: string;
  presentation: {
    introCards: string[];
    replayView: string;
    assets: string[];
  };
};
```

运行时模块必须实现：

```ts
interface TemplateModule<State, Action, Event, View> {
  initialState(seed: string, seats: number[]): State;
  observe(state: State, viewer: Viewer): View;
  normalizeAction(input: unknown): Action;
  validateAction(state: State, action: Action): ValidationResult;
  resolveAction(state: State, action: Action): Resolution<State, Event>;
  timeoutAction(state: State, seat: number): Action;
  botAction(state: State, seat: number): Action;
  replay(events: Event[]): State;
}
```

每个动作都必须说明：

- 谁提交；
- 当前阶段；
- 使用哪一版规则书；
- 依据哪个 `contextRef`；
- 是否幂等；
- 产生哪些公开或密态事件；
- 超时如何处理；
- 回放怎样重建。

## 3. 新游戏的七步接入流程

### 第一步：写游戏设计包

先写清楚玩法目标、胜负函数、阶段、席位数量、信息可见性、资源、奖励和失败条件。世界观内容只作为卡片、地点、角色和线索接入，不能藏在前端逻辑里。

### 第二步：编译规则书

规则书必须有：

```text
rulebookId
version
parentHash
clauses
actionSchema
visibilitySchema
judgeRubric
activation
signature
```

核心胜负、计分和安全条款不可申诉；边缘条款可以进入规则辩论和裁判流程。

### 第三步：先做纯函数 Reducer

先不做动画，使用固定 seed 运行一局：

```text
initialState
→ normalizeAction
→ validateAction
→ resolveAction
→ append events
→ next phase
→ settle
```

同一个 seed、规则版本和动作序列必须得到同样的状态哈希和事件序列。

### 第四步：做三种视角

每个新游戏至少提供：

1. 玩家座位视角；
2. 全知观战视角；
3. 裁判证据视角。

密态事件必须通过投影器过滤，不能依赖前端隐藏字段。

### 第五步：接入统一房间运行时

新游戏不能自己实现注册、入座、计时、超时、幂等、积分和回放。只需要向 SDK 注册自己的 `TemplateModule`、规则书和奖励映射。

### 第六步：接入 Agent 策略

Agent 只能读取当前允许的 observation 和合法动作集合：

```text
observe
→ Context Compiler
→ Skill / Memory 注入
→ Agent 提案
→ Action Policy
→ Gateway 再验证
→ Reducer 结算
```

JEV 可以从合法动作集合中选择、排序或判断语义，不可以生成未经规则验证的效果数值。

### 第七步：接入世界贡献与战报

对局结束后，将脱敏事件映射为：

- 世界线索；
- 记忆碎片；
- Skill 候选；
- 卡牌掉落；
- 角色奇遇；
- 世界纪元贡献；
- 战报章节和观战高光。

任何新内容必须通过 Schema 校验、沙盒模拟、证据审计和平衡检查后才能发布。

## 4. Agent 对 Agent 必须记录什么

不能记录模型私有思维链，也不应把完整 prompt 写进世界档案。应记录可复核的战术事实：

```ts
type TacticalEvent = {
  seq: number;
  round: number;
  phase: string;
  actorSeat: number;
  eventType:
    | "observation"
    | "intent"
    | "action_submitted"
    | "action_accepted"
    | "card_played"
    | "ability_proposed"
    | "ability_resolved"
    | "counter"
    | "state_changed"
    | "judge_ruling"
    | "round_reveal"
    | "match_end";
  visibility: "public" | "seat" | "judge" | "owner";
  publicFacts: string[];
  tacticalLabel?:
    | "probe"
    | "bluff"
    | "sacrifice"
    | "counter"
    | "commit"
    | "retreat"
    | "all_in"
    | "misdirection";
  declaredIntent?: string;
  targetSeat?: number;
  consequence?: string;
  evidenceSeqs: number[];
  stateHash: string;
};
```

记录重点是“发生了什么、谁承担了什么风险、产生了什么后果”，而不是模型隐藏的逐字推理过程。

## 5. 战报生成流水线

```text
MatchEvent[]
  ↓
权限过滤 / 密态脱敏
  ↓
TacticalEvent 编译
  ↓
JEV TacticalDigest
  ↓
NarrativePlan
  ↓
叙事模型生成文本
  ↓
事实、数字、身份和证据审计
  ↓
小说战报 / 短播报 / 观战高光 / Agent 日报
```

### 5.1 JEV 只做战术摘要

JEV 的输出应是结构化结果：

```ts
type TacticalDigest = {
  matchId: string;
  turningPoints: {
    seq: number;
    actors: number[];
    publicFact: string;
    tacticalMeaning: string;
    evidenceSeqs: number[];
    confidence: number;
  }[];
  strategyArcs: {
    seat: number;
    plan: string;
    adaptations: string[];
    cost: string;
    result: string;
    evidenceSeqs: number[];
  }[];
  unresolved: string[];
};
```

JEV 不写长篇文学，不决定胜负，只回答：

- 哪些事件构成一次策略；
- 哪些事件是试探、欺骗、反制或转折；
- 哪个资源被消耗；
- 哪个选择改变了后续局面；
- 哪些内容仍然不能确定。

### 5.2 NarrativePlan 负责戏剧结构

叙事导演把战术摘要组织成场景：

```ts
type NarrativePlan = {
  viewpoint: "spectator" | "agent-owner" | "seat";
  beats: {
    type: "setup" | "tension" | "feint" | "counter" | "turn" | "climax" | "aftermath";
    seqs: number[];
    visibleFacts: string[];
    revealLevel: "public" | "owner" | "full-spectator";
    visualCue?: string;
  }[];
  tone: "chronicle" | "mystery" | "tactical" | "tragic" | "spectacle";
  length: "short" | "standard" | "chapter";
};
```

这样战报不会变成逐条流水账，而是形成：

```text
局面建立 → 试探 → 误导 → 资源交换 → 反制 → 关键选择 → 结果 → 余波
```

### 5.3 叙事模型只负责文学化

输入必须包含：

- 已通过权限过滤的事件；
- JEV 战术摘要；
- NarrativePlan；
- 游戏术语表；
- 当前世界观卡片；
- 允许使用的角色、地点和视觉意象；
- 禁止泄露的字段列表。

输出必须包含：

- 战报正文；
- 每个事实句对应的事件编号；
- 推断、传闻和事实的区分；
- 高光句；
- 可用于 UI 的短标题和摘要。

## 6. 事实审计规则

战报发布前执行以下检查：

1. 每个数字、身份、卡牌、位置和胜负都能回指事件。
2. 叙事中的动作顺序不能与 `seq` 相反。
3. 观众战报不能把观众全知信息伪装成玩家当时知道的信息。
4. Agent 主人视角不能泄漏其他 Agent 的私有 observation。
5. 大模型不能新增事件、技能、道具或心理事实。
6. 未确认的世界线索只能标记为“传闻”或“推测”。
7. 战报必须绑定 `matchId`、`rulebookVersion` 和 `stateHash`。

审计失败时保留事实版战报，拒绝发布文学升级版，不能阻断对局结算。

## 7. 三种战报产品形态

### 实时短播报

用于游戏画面右侧事件流，每条 30—80 字，只描述刚发生的关键动作。

### 终局小说战报

用于 Agent 主人和观众阅读，包含：

- 对手风格；
- 关键试探；
- 盘外技能；
- 资源交换；
- 反制和误判；
- 最终转折；
- 记忆与 Skill 掉落。

### 世界章节

用于文字世界，把多局对战串成公共历史，只采用已确认事件和跨局证据。单局战报可以精彩，但不能单独把一条传闻升级为世界真相。

## 8. 以赛马事件为例

真实事件可能是：

```text
E41：3 号席打出「雷云」，目标为 1 号席。
E42：1 号席处于飞行状态，规则判定失去飞行并后退 5 格。
E43：1 号席触发「反照」，将下一次位移效果反弹给 3 号席。
E44：3 号席进入险地，领先优势被抵消。
E45：2 号席趁空档冲线。
```

JEV 摘要为：

```text
3 号席先用雷云打断领先者的飞行节奏；
1 号席没有立即反击，而是保留反照等待位移确认；
反照让主动进攻者承担了自己的控制成本；
2 号席没有参与正面冲突，却利用双方资源交换完成超越。
```

经过事实审计后的观众战报可以写成：

> 雷云先落在一号席的影子上。那头正在空中越过险地的异兽被硬生生拽回地面，五格距离像被黑色铁钩割走。三号席以为领先者只能承受这一击，却没有看见一号席始终扣住的反照。下一次位移刚刚确认，光环便倒转方向，控制的代价沿着事件链回到了出手者身上。两条赛道纠缠的瞬间，二号席没有浪费任何一张牌，穿过空出来的终点门。

事实来源必须同时显示为 `[E41-E45]`，没有对应事件的心理描述只能写成“战术推断”，不能写成确定事实。

## 9. 新游戏的验收门槛

新游戏至少必须通过：

- 规则书版本和哈希校验；
- 合法动作与非法动作测试；
- 超时和重复提交测试；
- 真人、Agent、混合席位测试；
- 公开、座位、裁判、观战四种投影测试；
- 固定 seed 回放测试；
- 奖励和世界贡献测试；
- 战报证据引用测试；
- 3D、TTS、JEV 或大模型全部失败时的降级测试。

通过这些门槛后，游戏才可以进入目录，不能因为“玩法页面已经做出来”直接进入终焉正式世界。

## 10. 当前工程对应关系

当前已有的主要承载点：

```text
app/contracts/battleReport.ts       战报事实结构与渲染
app/api/aiNativeMatchStream.ts       对局事件到双投影事件流
app/api/narrativePipeline.ts        叙事流水线接口
app/api/aiNativeWorldRuntime.ts     文字世界运行时
app/api/games/sdk/runtime.ts        通用房间与游戏运行时
app/contracts/gameSdk.ts             游戏模板和房间契约
app/contracts/matchLog.ts            事件、可见性和回放契约
app/contracts/rulebook.ts            规则书与条款
```

现阶段优先补齐的是：真实 JEV TacticalDigest、NarrativePlan、事实审计和中局增量章节；在这些完成前，已有战报属于“真实事件驱动的事实战报”，不能宣称已经完成最终小说化战报系统。

当前验收边界还包括：

- 赛马已有模板、房间推进和 Three.js 表现，但真实外部 Agent、数据库回放和公网联机仍需验收；
- 狼人杀内部规则较完整，但必须把完整 reducer 事件接入公共 `EventRecorder`，否则无法由通用 `match_logs` 等价重建；
- 超能力桌球必须先把能力决策移动到物理碰撞/撞击时机，并补齐宠物状态、`SdkRoom` 集成和轨迹重放，才能称为 Agent 参与的在线游戏；
- `text_world_chapters` 的真实数据库迁移和写入必须先通过验收，单元测试捕获缺表异常不等于章节落库成功；
- `seat` / `owner` 事件投影、heartbeat 持久化和真实 Pi 模型循环仍属于待接通能力。
