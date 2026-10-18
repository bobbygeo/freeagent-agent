import { getConfig } from "./config.js";
import { getValidAccessToken } from "./oauth.js";

export async function freeagentFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const { apiBase, userAgent } = getConfig();
  const token = await getValidAccessToken();
  const url = path.startsWith("http") ? path : `${apiBase}${path.startsWith("/") ? "" : "/"}${path}`;

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");
  headers.set("User-Agent", userAgent);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, { ...init, headers });
  if (res.status === 429) {
    throw new Error("FreeAgent rate limit hit (429). Back off and retry.");
  }
  return res;
}

export async function freeagentJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await freeagentFetch(path, init);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`FreeAgent ${res.status} ${path}: ${text}`);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}
