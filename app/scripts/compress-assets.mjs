/**
 * 素材压缩脚本（scripts/compress-assets.mjs）
 *
 *   node scripts/compress-assets.mjs --dry     只报告，不改文件
 *   node scripts/compress-assets.mjs           就地压缩
 *
 * 为什么用调色板量化而非降质量：PNG 是无损格式，quality 参数对它无效
 * （实测反而变大）。palette 量化把全彩降为 256 色索引，对本项目的
 * 插画与背景（色彩层次平缓、无渐变噪点）几乎无可见损失，体积降约 60%。
 *
 * 为什么不转 WebP：会改扩展名，代码里 101 处引用路径全要跟着改，
 * 收益不值这个风险。保持 .png 则零代码改动。
 *
 * 跳过 SVG（本就很小）与已足够小的 PNG。
 */
import { readdir, stat, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// 必须用 fileURLToPath：项目路径含中文，直接取 .pathname 会得到 URL 编码串
const PUBLIC_DIR = fileURLToPath(new URL("../public/", import.meta.url));

/** 小于此值不处理（KB）——省下的体积不值一次重编码 */
const SKIP_UNDER_KB = 300;

/** 调色板色数。256 是 PNG-8 上限，对插画够用 */
const PALETTE_COLORS = 256;

const dryRun = process.argv.includes("--dry");

function kb(bytes) {
  return Math.round(bytes / 1024);
}

async function main() {
  const files = (await readdir(PUBLIC_DIR)).filter(f =>
    f.toLowerCase().endsWith(".png"),
  );

  let totalBefore = 0;
  let totalAfter = 0;
  let processed = 0;
  let skipped = 0;
  const failures = [];

  for (const name of files) {
    const path = join(PUBLIC_DIR, name);
    const before = (await stat(path)).size;
    totalBefore += before;

    if (kb(before) < SKIP_UNDER_KB) {
      totalAfter += before;
      skipped += 1;
      continue;
    }

    const tmp = `${path}.tmp.png`;

    try {
      await sharp(path)
        .png({ palette: true, colors: PALETTE_COLORS, effort: 7 })
        .toFile(tmp);

      const after = (await stat(tmp)).size;

      // 量化后反而变大就放弃（少数高噪点图会这样）
      if (after >= before) {
        await unlink(tmp);
        totalAfter += before;
        skipped += 1;
        continue;
      }

      if (dryRun) {
        await unlink(tmp);
      } else {
        await rename(tmp, path);
      }

      totalAfter += after;
      processed += 1;
      const pct = Math.round((1 - after / before) * 100);
      console.log(
        `  ${name.padEnd(26)} ${String(kb(before)).padStart(5)} KB → ${String(kb(after)).padStart(5)} KB  (-${pct}%)`,
      );
    } catch (e) {
      await unlink(tmp).catch(() => {});
      totalAfter += before;
      failures.push(`${name}: ${e.message}`);
    }
  }

  console.log("");
  console.log(`${dryRun ? "[预演] " : ""}处理 ${processed} 张，跳过 ${skipped} 张`);
  console.log(
    `总计 ${kb(totalBefore)} KB → ${kb(totalAfter)} KB  (-${Math.round((1 - totalAfter / totalBefore) * 100)}%)`,
  );

  if (failures.length) {
    console.log("\n失败：");
    for (const f of failures) console.log(`  ${f}`);
  }
  if (dryRun) {
    console.log("\n未改动任何文件。去掉 --dry 以实际压缩。");
  }
}

main().catch(e => {
  console.error("压缩失败：", e);
  process.exit(1);
});
