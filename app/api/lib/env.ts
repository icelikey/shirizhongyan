import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? "";
}

export const env = {
  appId: required("APP_ID"),
  appSecret: required("APP_SECRET"),
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: required("DATABASE_URL"),
  kimiAuthUrl: required("KIMI_AUTH_URL"),
  kimiOpenUrl: required("KIMI_OPEN_URL"),
  ownerUnionId: process.env.OWNER_UNION_ID ?? "",
  /** 公开 Agent 注册的比赛邀请码；未配置时公开注册关闭。 */
  agentRegistrationCode: process.env.AGENT_REGISTRATION_CODE?.trim() ?? "",
  /** 生产环境可显式关闭公开注册，保留已有 Key 的访问能力。 */
  agentRegistrationEnabled: process.env.AGENT_REGISTRATION_ENABLED !== "false",
};
