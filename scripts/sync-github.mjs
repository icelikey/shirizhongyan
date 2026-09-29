#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, openSync, readFileSync, closeSync, unlinkSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const defaultRoot = resolve(scriptDir, "..");

function parseArgs(argv) {
  const args = { projectRoot: defaultRoot, remote: "origin", dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--dry-run") args.dryRun = true;
    else if (token === "--project-root") args.projectRoot = resolve(argv[++i]);
    else if (token === "--remote") args.remote = argv[++i];
    else throw new Error("未知参数：" + token);
  }
  return args;
}

function git(root, args) {
  try {
    return execFileSync("git", ["-c", "http.sslBackend=schannel", "-C", root, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 60000,
    }).trim();
  } catch (error) {
    const detail = String(error?.stderr || "").replace(/\s+/g, " ").trim().slice(0, 240);
    throw new Error("Git 操作失败：" + args.join(" ") + (detail ? "；" + detail : ""));
  }
}

function isBlockedPath(path) {
  const leaf = basename(path);
  return leaf.startsWith(".env")
    || leaf.endsWith(".pem")
    || leaf.endsWith(".key")
    || leaf.startsWith("auth")
    || leaf.startsWith("credential")
    || leaf.startsWith("secret")
    || leaf === "agent.json"
    || path.startsWith("app/.tmp-");
}

function hasSecret(text) {
  return /PRIVATE KEY|sk-[A-Za-z0-9]{20}|tdg_[A-Za-z0-9_-]{24}|AIza[0-9A-Za-z_-]{30}/.test(text);
}

function changedPaths(status) {
  return status.split(/\r?\n/).filter(Boolean).map((line) => line.slice(3).replace(/^"|"$/g, ""));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = resolve(args.projectRoot);
  if (!existsSync(join(root, ".git"))) throw new Error("ProjectRoot 不是 Git 仓库根目录。");

  const lockPath = join(root, ".git", "zhongyan-sync.lock");
  let lockFd;
  try {
    lockFd = openSync(lockPath, "wx");
  } catch (error) {
    if (error?.code === "EEXIST") {
      console.log("同步任务已在运行，跳过本轮。");
      return;
    }
    throw error;
  }

  try {
    const branch = git(root, ["branch", "--show-current"]);
    if (!branch) throw new Error("当前处于 detached HEAD，停止自动同步。");
    git(root, ["ls-remote", "--exit-code", args.remote, "HEAD"]);

    const status = git(root, ["status", "--porcelain=v1", "--untracked-files=all"]);
    if (!status) {
      console.log("工作区没有待同步改动。");
      return;
    }

    for (const path of changedPaths(status)) {
      if (isBlockedPath(path)) throw new Error("检测到不应自动上传的文件：" + path);
      if (/\.(test|spec)\.(ts|tsx|mjs|js)$/.test(path) || path.endsWith("scripts/sync-github.mjs") || path.endsWith("scripts/sync-github.ps1")) continue;
      const fullPath = join(root, path);
      if (!existsSync(fullPath)) continue;
      const contents = readFileSync(fullPath, "utf8");
      if (hasSecret(contents)) throw new Error("检测到疑似密钥内容：" + path);
    }

    git(root, ["diff", "--check"]);
    if (args.dryRun) {
      console.log("DryRun：将同步分支 " + branch + "，改动 " + status.split(/\r?\n/).length + " 项。");
      return;
    }

    git(root, ["add", "-A"]);
    git(root, ["commit", "-m", "sync: " + new Date().toISOString()]);
    git(root, ["push", args.remote, branch]);
    console.log("已同步分支 " + branch + " 到 GitHub。");
  } finally {
    if (lockFd !== undefined) closeSync(lockFd);
    try { unlinkSync(lockPath); } catch {}
  }
}

try {
  main();
} catch (error) {
  try {
    appendFileSync(join(defaultRoot, "scripts", "sync-github-task.log"), new Date().toISOString() + " " + (error?.message || "同步失败") + "\n", "utf8");
  } catch {}
  console.error(error?.message || "同步失败");
  process.exitCode = 1;
}
