import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { getConfig } from "./config.js";

export type TokenSet = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  token_type?: string;
  obtained_at: number;
};

export function loadTokens(): TokenSet | null {
  const { tokenPath } = getConfig();
  if (!existsSync(tokenPath)) return null;
  return JSON.parse(readFileSync(tokenPath, "utf8")) as TokenSet;
}

export function saveTokens(tokens: Omit<TokenSet, "obtained_at"> & { obtained_at?: number }) {
  const { tokenPath } = getConfig();
  const payload: TokenSet = {
    ...tokens,
    obtained_at: tokens.obtained_at ?? Date.now(),
  };
  writeFileSync(tokenPath, JSON.stringify(payload, null, 2), { mode: 0o600 });
  return payload;
}

export function isAccessTokenFresh(tokens: TokenSet, skewMs = 60_000): boolean {
  const lifetimeMs = (tokens.expires_in ?? 3600) * 1000;
  return Date.now() < tokens.obtained_at + lifetimeMs - skewMs;
}
