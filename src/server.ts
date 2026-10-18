#!/usr/bin/env node
/**
 * Long-running local HTTP server (default port 3847).
 * Used by Docker and for OAuth without colliding with apps on :3000.
 */
import { createServer } from "node:http";
import { getConfig } from "./config.js";
import {
  buildAuthorizeUrl,
  exchangeCode,
  getValidAccessToken,
} from "./oauth.js";
import { loadTokens } from "./tokens.js";
import {
  getCompany,
  listBankAccounts,
  listBankFeeds,
} from "./tools.js";

function html(body: string, status = 200) {
  return {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
    body: `<!doctype html><html><head><meta charset="utf-8"><title>freeagent-agent</title>
<style>body{font-family:system-ui,sans-serif;max-width:40rem;margin:2rem auto;padding:0 1rem;line-height:1.45}
code,pre{background:#f4f4f5;padding:.15rem .35rem;border-radius:4px}a{color:#0b57d0}</style>
</head><body>${body}</body></html>`,
  };
}

function json(data: unknown, status = 200) {
  return {
    status,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data, null, 2),
  };
}

async function handle(reqUrl: URL, method: string) {
  const { redirectUri } = getConfig();
  const callbackPath = new URL(redirectUri).pathname;

  if (reqUrl.pathname === "/health" || reqUrl.pathname === "/") {
    const tokens = loadTokens();
    return json({
      ok: true,
      service: "freeagent-agent",
      authenticated: Boolean(tokens),
      redirect_uri: redirectUri,
    });
  }

  if (reqUrl.pathname === "/auth") {
    const url = buildAuthorizeUrl();
    return {
      status: 302,
      headers: { Location: url, "Content-Type": "text/plain" },
      body: `Redirecting to FreeAgent…\n${url}\n`,
    };
  }

  if (reqUrl.pathname === callbackPath) {
    const error = reqUrl.searchParams.get("error");
    if (error) {
      return html(`<h1>OAuth error</h1><p>${error}</p>`, 400);
    }
    const code = reqUrl.searchParams.get("code");
    if (!code) {
      return html("<h1>Missing code</h1>", 400);
    }
    await exchangeCode(code);
    return html(
      "<h1>FreeAgent connected</h1><p>Tokens saved. You can close this tab.</p><p><a href=\"/health\">Health</a> · <a href=\"/api/company\">Company</a></p>",
    );
  }

  if (reqUrl.pathname === "/api/company" && method === "GET") {
    await getValidAccessToken();
    return json(await getCompany());
  }

  if (reqUrl.pathname === "/api/accounts" && method === "GET") {
    await getValidAccessToken();
    return json({ bank_accounts: await listBankAccounts() });
  }

  if (reqUrl.pathname === "/api/feeds" && method === "GET") {
    await getValidAccessToken();
    return json({ bank_feeds: await listBankFeeds() });
  }

  return html(
    `<h1>freeagent-agent</h1>
    <ul>
      <li><a href="/health">/health</a></li>
      <li><a href="/auth">/auth</a> — start FreeAgent OAuth</li>
      <li><a href="/api/company">/api/company</a></li>
      <li><a href="/api/accounts">/api/accounts</a></li>
      <li><a href="/api/feeds">/api/feeds</a></li>
    </ul>`,
    404,
  );
}

function main() {
  const { port, bindHost, redirectUri } = getConfig();

  const server = createServer(async (req, res) => {
    try {
      const reqUrl = new URL(req.url ?? "/", `http://${bindHost}:${port}`);
      const result = await handle(reqUrl, req.method ?? "GET");
      res.writeHead(result.status, result.headers);
      res.end(result.body);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: message }));
    }
  });

  server.listen(port, bindHost, () => {
    console.log(`freeagent-agent listening on http://${bindHost}:${port}`);
    console.log(`OAuth callback: ${redirectUri}`);
    console.log(`Start auth:     http://127.0.0.1:${port}/auth`);
  });
}

main();
