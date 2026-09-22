/**
 * 用 esbuild 打包引擎冒烟脚本并在 node 中运行。
 * 用法：node scripts/run-spire-smoke.mjs
 */
import { build } from 'esbuild'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outfile = path.join(root, 'node_modules', '.tmp', 'spire-smoke.mjs')

await build({
  entryPoints: [path.join(root, 'scripts', 'spire-smoke.ts')],
  bundle: true,
  outfile,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  alias: { '@': path.join(root, 'src') },
  logLevel: 'warning',
})

const res = spawnSync(process.execPath, [outfile], { stdio: 'inherit' })
process.exit(res.status ?? 1)
