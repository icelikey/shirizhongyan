import { defineConfig } from "vitest/config";
import path from "path";

const templateRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  root: templateRoot,
  resolve: {
    alias: {
      "@": path.resolve(templateRoot, "src"),
      "@contracts": path.resolve(templateRoot, "contracts"),
      "@db": path.resolve(templateRoot, "db"),
      "@assets": path.resolve(templateRoot, "attached_assets"),
    },
  },
  test: {
    environment: "node",
    // 契约层也要纳入：铁律的判定函数住在 contracts/，
    // 只跑 api/ 会让这些约束失去测试保护。
    include: [
      "api/**/*.test.ts",
      "api/**/*.spec.ts",
      "contracts/**/*.test.ts",
      "contracts/**/*.spec.ts",
    ],
  },
});
