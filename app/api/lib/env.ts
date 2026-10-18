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

const PLACEHOLDER_SECRETS = new Set([
  "replace-this-before-sharing",
  "change-me-long-random-secret",
  "change-me-demo-invite",
  "tdg-demo-2026",
]);

/**
 * Production must never silently boot with values from compose examples.
 * Keeping this validator pure makes the deployment contract testable without
 * importing the process-wide environment in unit tests.
 */
export function validateProductionConfig(input: {
  appSecret: string;
  agentRegistrationEnabled: boolean;
  agentRegistrationCode: string;
}) {
  if (PLACEHOLDER_SECRETS.has(input.appSecret) || input.appSecret.length < 32) {
    throw new Error(
      "APP_SECRET must be a non-placeholder value with at least 32 characters in production",
    );
  }
  if (
    input.agentRegistrationEnabled &&
    (!input.agentRegistrationCode || PLACEHOLDER_SECRETS.has(input.agentRegistrationCode))
  ) {
    throw new Error(
      "AGENT_REGISTRATION_CODE must be a non-placeholder value when public registration is enabled",
    );
  }
}

if (env.isProduction) {
  validateProductionConfig({
    appSecret: env.appSecret,
    agentRegistrationEnabled: env.agentRegistrationEnabled,
    agentRegistrationCode: env.agentRegistrationCode,
  });
}
