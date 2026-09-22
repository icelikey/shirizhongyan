/**
 * Jev 真实 API 冒烟脚本（scripts/jev-smoke.ts）
 *
 * 单测不打真实 API（CI 与队友本地可能无 Key），连通性由本脚本验证。
 *
 *   TYPESAFE_API_KEY=apikey_xxx npx tsx scripts/jev-smoke.ts
 *
 * 验证三件事：
 *   1. API 连通、认证有效
 *   2. 裁判能区分「言之有物的质询」与「空泛不服」——这是机制可信的前提
 *   3. 实际延迟（演示时要报的数字）
 */
import { RB_GUESS } from "../contracts/rulebooks.data";
import { buildPanel } from "../api/world/judges";
import { jevEnabled } from "../api/world/jev";
import { jevVote, analyzeSpeech } from "../api/world/jevJudge";

const SEATS = [0, 1, 2, 3, 4, 5];
const SEED = "smoke-seed";

const SUBSTANTIVE =
  "《等距裁断》以先提交者胜，然本规则书另设反悔窗许三秒内撤回重提。" +
  "若甲先提交后于反悔窗内撤回重提，乙在其间提交，则二人等距时孰为先提交者，" +
  "原文未言明。两解皆通，请另立判例明之。";

const FRIVOLOUS = "我不服这条判定，这对我很不公平，应该改判我赢才对。";

function line(label: string, value: unknown): void {
  console.log(`  ${label.padEnd(14)}${String(value)}`);
}

async function main(): Promise<void> {
  if (!jevEnabled()) {
    console.error("✗ 未配置 TYPESAFE_API_KEY，无法验证真实 API。");
    console.error("  用法：TYPESAFE_API_KEY=apikey_xxx npx tsx scripts/jev-smoke.ts");
    process.exit(1);
  }

  const panel = buildPanel({
    size: 3,
    seed: SEED,
    clauseId: "c-guess-tie",
    excludeSeats: SEATS,
  });
  const aiJudge = panel.judges.find(j => j.kind !== "algorithm")!;
  console.log(`裁判席：${aiJudge.name}（${aiJudge.kind}）\n`);

  /* ---- 1. 言之有物的质询，应当采纳 ---- */
  console.log("① 实质质询（预期：采纳，支持度高，论据强）");
  const good = await jevVote({
    judge: aiJudge,
    book: RB_GUESS,
    clauseId: "c-guess-tie",
    assertion: SUBSTANTIVE,
    seed: SEED,
  });
  line("由 Jev 裁断", good.byJev ? "是" : "否（已降级）");
  line("模型", good.model ?? "—");
  line("耗时", good.elapsedMs !== null ? `${good.elapsedMs} ms` : "—");
  line("支持度", good.support?.toFixed(2) ?? "—");
  line("论据强度", good.strength?.toFixed(2) ?? "—");
  line("裁断", good.vote.upheld ? "采纳" : "驳回");
  line("理由", good.vote.reason);

  /* ---- 2. 空泛不服，应当驳回 ---- */
  console.log("\n② 空泛质询（预期：驳回，支持度低，论据 0）");
  const weak = await jevVote({
    judge: aiJudge,
    book: RB_GUESS,
    clauseId: "c-guess-tie",
    assertion: FRIVOLOUS,
    seed: SEED,
  });
  line("耗时", weak.elapsedMs !== null ? `${weak.elapsedMs} ms` : "—");
  line("支持度", weak.support?.toFixed(2) ?? "—");
  line("论据强度", weak.strength?.toFixed(2) ?? "—");
  line("裁断", weak.vote.upheld ? "采纳" : "驳回");
  line("理由", weak.vote.reason);

  /* ---- 3. 狼人杀发言分析 ---- */
  console.log("\n③ 发言分析（预期：识别悍跳 + 矛盾）");
  const speech = await analyzeSpeech({
    history: ["我就是个普通村民，没什么信息，听大家的。"],
    speech: "我是预言家，昨晚验的2号是狼人，大家跟我票。",
    publicContext: "第二天白天，昨夜无人死亡，场上6人存活。",
  });
  if (speech) {
    line("耗时", `${speech.elapsedMs} ms`);
    line("矛盾概率", speech.contradiction.toFixed(2));
    line("风格", `${speech.style}（置信 ${speech.styleConfidence.toFixed(2)}）`);
    line("信息量", speech.informativeness.toFixed(2));
  } else {
    console.log("  返回 null（Jev 不可用）");
  }

  /* ---- 判定机制是否真的可区分 ---- */
  const discriminates =
    good.support !== null &&
    weak.support !== null &&
    good.support > weak.support &&
    good.vote.upheld &&
    !weak.vote.upheld;

  console.log(
    `\n${discriminates ? "✓" : "✗"} 裁判${discriminates ? "能" : "未能"}区分实质质询与空泛不服`,
  );
  if (!discriminates) {
    console.error("  这意味着质询机制不可信，需调整 SUPPORT_THRESHOLD 或问题表述。");
    process.exit(1);
  }
}

main().catch(e => {
  console.error("✗ 冒烟失败：", e instanceof Error ? e.message : e);
  process.exit(1);
});
