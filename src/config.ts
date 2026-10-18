import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv();

export type FreeAgentEnv = "sandbox" | "production";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}. Copy .env.example to .env and fill it in.`);
  }
  return value;
}

export function getConfig() {
  const env = (process.env.FREEAGENT_ENV?.trim() || "sandbox") as FreeAgentEnv;
  if (env !== "sandbox" && env !== "production") {
    throw new Error('FREEAGENT_ENV must be "sandbox" or "production"');
  }

  const apiBase =
    env === "sandbox"
      ? "https://api.sandbox.freeagent.com/v2"
      : "https://api.freeagent.com/v2";

  return {
    env,
    apiBase,
    clientId: required("FREEAGENT_CLIENT_ID"),
    clientSecret: required("FREEAGENT_CLIENT_SECRET"),
    redirectUri:
      process.env.FREEAGENT_REDIRECT_URI?.trim() ||
      "http://127.0.0.1:3847/oauth/callback",
    tokenPath: resolve(
      process.env.FREEAGENT_TOKEN_PATH?.trim() || ".oauth-tokens.json",
    ),
    port: Number(process.env.PORT || 3847),
    /** Bind address for the HTTP server. Use 0.0.0.0 inside Docker. */
    bindHost: process.env.BIND_HOST?.trim() || "127.0.0.1",
    userAgent: "freeagent-agent/0.1.0",
  };
}
