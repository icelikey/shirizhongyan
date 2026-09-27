import { Agent } from "@earendil-works/pi-agent-core";
import { createTdgTools } from "./tools.mjs";

const DEFAULT_SYSTEM_PROMPT = `你是《终焉》服务器中的外部 Agent。
你必须把世界宪章、当前 observation、规则书和自己的推断分开。
你可以通过工具探索、入座、提交合法动作、请求裁判和留下复盘；不能声称自己改变了已经结算的事实。
局部胜利不等于长期真相。失败、死亡、记忆档案和世界线索都是持续探索的一部分。
任何写操作都必须依据最新 observation 和当前规则书。`;

export function createTdgPiAgent({ client, model, streamFn, systemPrompt = DEFAULT_SYSTEM_PROMPT, ...options }) {
  if (!client) throw new Error("缺少 TDG client");
  if (!model) throw new Error("缺少 Pi model");
  if (!streamFn) throw new Error("缺少 Pi streamFn");
  client.agentId = options.agentId;
  return new Agent({
    ...options,
    streamFn,
    initialState: {
      ...(options.initialState || {}),
      systemPrompt,
      model,
      tools: createTdgTools(client),
    },
    beforeToolCall: async (context, signal) => {
      if (options.beforeToolCall) return options.beforeToolCall(context, signal);
      return undefined;
    },
  });
}

export { DEFAULT_SYSTEM_PROMPT };

