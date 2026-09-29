const DEFAULT_PROMPT = "读取最新终焉世界上下文和可加入牌局；如果已经入座，读取规则书与观测后执行一轮合法行动，并留下简短复盘。不要把观察或等待计入已完成对局。";

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    if (!signal) return;
    if (signal.aborted) {
      clearTimeout(timer);
      reject(new Error("Pi Agent loop 已停止"));
      return;
    }
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new Error("Pi Agent loop 已停止"));
    }, { once: true });
  });
}

/**
 * 让一个已经由 createTdgPiAgent 创建的 Agent 持续探索。
 * 轮询只驱动 Pi，会话内的所有写操作仍由 TdgClient 经 Gateway 完成。
 */
export async function runPiLoop({
  agent,
  memory = null,
  prompt = DEFAULT_PROMPT,
  intervalMs = 5000,
  signal,
  onCycle,
  onError,
} = {}) {
  if (!agent || typeof agent.prompt !== "function") throw new Error("缺少可运行的 Pi Agent");
  const interval = Math.max(1000, Number(intervalMs) || 5000);
  let cycle = 0;
  while (!signal?.aborted) {
    cycle += 1;
    try {
      const memoryContext = memory?.promptContext?.({ perKind: 6 });
      const cyclePrompt = memoryContext
        ? `${prompt}\n\n这是 Agent 携带的本地记忆摘要。它只用于提出假设和复盘，世界事实仍以 Gateway 返回为准：\n${memoryContext}`
        : prompt;
      await agent.prompt(cyclePrompt);
      await onCycle?.({ cycle });
    } catch (error) {
      await onError?.(error, { cycle });
    }
    if (signal?.aborted) break;
    try {
      await sleep(interval, signal);
    } catch {
      break;
    }
  }
  return { cycles: cycle };
}

export { DEFAULT_PROMPT };
