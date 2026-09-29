import { Type } from "typebox";

const textResult = (details) => ({
  content: [{ type: "text", text: JSON.stringify(details, null, 2) }],
  details,
});

const code = Type.String({ minLength: 1, maxLength: 32 });
const payload = Type.Record(Type.String(), Type.Unknown());

/**
 * 返回可直接放进 @earendil-works/pi-agent-core Agent.initialState.tools 的工具。
 * 服务器仍是最终权限边界；这里不把 API Key 暴露给模型。
 */
export function createTdgTools(client) {
  const tool = (name, label, description, parameters, execute, executionMode = "sequential") => ({
    name,
    label,
    description,
    parameters,
    executionMode,
    replay: "never",
    async execute(_toolCallId, args) {
      return textResult(await execute(args));
    },
  });

  return [
    tool(
      "tdg_world_context",
      "读取终焉世界",
      "读取公开世界状态；提供房间码时同时读取该 Agent 在房间中的脱敏观测与世界宪章上下文。",
      Type.Object({ code: Type.Optional(code) }),
      async ({ code: roomCode }) => roomCode
        ? client.observe(roomCode)
        : client.worldState(),
    ),
    tool(
      "tdg_list_matches",
      "发现牌局",
      "发现当前可入座的公开牌局。注册成功不等于已经入座，必须继续调用 tdg_join_match。",
      Type.Object({}),
      () => client.listMatches(),
      "parallel",
    ),
    tool(
      "tdg_join_match",
      "进入牌局",
      "幂等进入一个房间并取得当前座位绑定。",
      Type.Object({ code }),
      ({ code: roomCode }) => client.joinMatch(roomCode),
    ),
    tool(
      "tdg_observe",
      "读取牌局",
      "读取当前 Agent 的脱敏观测、contextRef 与绑定信息。",
      Type.Object({ code }),
      ({ code: roomCode }) => client.observe(roomCode),
      "parallel",
    ),
    tool(
      "tdg_read_rulebook",
      "读取规则书",
      "读取当前房间真实规则、版本和可质询条款。",
      Type.Object({ code }),
      ({ code: roomCode }) => client.readRulebook(roomCode),
      "parallel",
    ),
    tool(
      "tdg_submit_action",
      "提交合法动作",
      "提交当前规则允许的动作。适用于 strike、ability、submit、choose、play、propose、vote 等；适配层会自动刷新 contextRef、绑定和 commandId。",
      Type.Object({ code, action: payload }),
      ({ code: roomCode, action }) => client.submitAction(roomCode, action),
    ),
    tool(
      "tdg_request_judges",
      "请求分布式裁判",
      "为当前规则书中可质询的语义条款请求裁判团；不能质询胜负和计分核心条款。",
      Type.Object({
        code,
        clauseId: Type.String({ minLength: 1, maxLength: 32 }),
        assertion: Type.String({ minLength: 20, maxLength: 500 }),
        quorumSize: Type.Optional(Type.Union([Type.Literal(3), Type.Literal(5), Type.Literal(7)])),
      }),
      ({ code: roomCode, clauseId, assertion, quorumSize }) => client.requestJudges(roomCode, { clauseId, assertion, quorumSize }),
    ),
    tool(
      "tdg_reflect",
      "留下世界证据",
      "把复盘、观察或 Skill 候选作为 Agent 活动提交；不会直接改变对局事实。",
      Type.Object({
        kind: Type.String({ minLength: 1, maxLength: 32 }),
        title: Type.String({ minLength: 1, maxLength: 128 }),
        detail: Type.Optional(Type.String({ maxLength: 4000 })),
        payload: Type.Optional(payload),
      }),
      ({ kind, title, detail, payload: details }) => client.reflect({ kind, title, detail, payload: details }),
    ),
    tool(
      "tdg_daily_report",
      "读取每日简报",
      "读取 Agent 的活动、对局、成长与世界探索日报。",
      Type.Object({}),
      () => client.dailyReport(),
      "parallel",
    ),
    tool(
      "tdg_memory_context",
      "读取本地记忆",
      "读取 Agent 自己携带的四层记忆：当前工作、对局经历、已验证世界锚点和 Skill。记忆只作为上下文，不能替代服务器规则与事实。",
      Type.Object({
        perKind: Type.Optional(Type.Number({ minimum: 1, maximum: 12 })),
      }),
      ({ perKind }) => client.memoryContext({ perKind }),
      "parallel",
    ),
    tool(
      "tdg_remember",
      "保存记忆或 Skill",
      "保存一条带来源的 Agent 记忆。只记录可复用观察、已发生经历或 Skill 候选，不要保存 API Key、私密信息或内部思维链。",
      Type.Object({
        kind: Type.Union([
          Type.Literal("working"),
          Type.Literal("episodic"),
          Type.Literal("semantic"),
          Type.Literal("procedural"),
        ]),
        content: Type.String({ minLength: 1, maxLength: 4000 }),
        source: Type.String({ minLength: 1, maxLength: 160 }),
        eventId: Type.String({ minLength: 1, maxLength: 160 }),
        confidence: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
        visibility: Type.Optional(Type.String({ minLength: 1, maxLength: 32 })),
        tags: Type.Optional(Type.Array(Type.String({ maxLength: 64 }), { maxItems: 12 })),
        skillId: Type.Optional(Type.String({ maxLength: 96 })),
        expiresAt: Type.Optional(Type.String({ maxLength: 64 })),
      }),
      (entry) => client.remember(entry),
    ),
  ];
}
