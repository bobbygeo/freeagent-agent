import { createServer } from "node:http";
import { getConfig } from "./config.js";
import { loadTokens, saveTokens, isAccessTokenFresh, type TokenSet } from "./tokens.js";

function basicAuthHeader(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

export function buildAuthorizeUrl(state = "freeagent-agent"): string {
  const { apiBase, clientId, redirectUri } = getConfig();
  const url = new URL(`${apiBase}/approve_app`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeCode(code: string): Promise<TokenSet> {
  const { apiBase, clientId, clientSecret, redirectUri, userAgent } = getConfig();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  const res = await fetch(`${apiBase}/token_endpoint`, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(clientId, clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "User-Agent": userAgent,
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`Token exchange failed (${res.status}): ${await res.text()}`);
  }

  const json = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in?: number;
    token_type?: string;
  };

  return saveTokens(json);
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenSet> {
  const { apiBase, clientId, clientSecret, userAgent } = getConfig();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const res = await fetch(`${apiBase}/token_endpoint`, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(clientId, clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "User-Agent": userAgent,
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`Token refresh failed (${res.status}): ${await res.text()}`);
  }

  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
  };

  return saveTokens({
    access_token: json.access_token,
    refresh_token: json.refresh_token ?? refreshToken,
    expires_in: json.expires_in,
    token_type: json.token_type,
  });
}

export async function getValidAccessToken(): Promise<string> {
  let tokens = loadTokens();
  if (!tokens) {
    throw new Error('Not authenticated. Run: npm run auth');
  }
  if (!isAccessTokenFresh(tokens)) {
    tokens = await refreshAccessToken(tokens.refresh_token);
  }
  return tokens.access_token;
}

/** Opens a one-shot localhost callback server and walks the OAuth code flow. */
export async function runInteractiveAuth(): Promise<TokenSet> {
  const { port, redirectUri, bindHost } = getConfig();
  const expected = new URL(redirectUri);
  if (expected.hostname !== "localhost" && expected.hostname !== "127.0.0.1") {
    throw new Error(
      `Interactive auth expects a localhost redirect URI. Got: ${redirectUri}`,
    );
  }

  const authorizeUrl = buildAuthorizeUrl();
  console.log("\nOpen this URL in your browser and approve the app:\n");
  console.log(authorizeUrl);
  console.log(`\nWaiting for callback on ${redirectUri} …\n`);
  console.log("(Or with Docker already up, open http://127.0.0.1:3847/auth)\n");

  return new Promise((resolve, reject) => {
    const listenHost = bindHost === "0.0.0.0" ? "127.0.0.1" : bindHost;
    const server = createServer(async (req, res) => {
      try {
        const reqUrl = new URL(req.url ?? "/", `http://${listenHost}:${port}`);
        if (reqUrl.pathname !== expected.pathname) {
          res.writeHead(404).end("Not found");
          return;
        }

        const error = reqUrl.searchParams.get("error");
        if (error) {
          res.writeHead(400).end(`OAuth error: ${error}`);
          server.close();
          reject(new Error(`OAuth error: ${error}`));
          return;
        }

        const code = reqUrl.searchParams.get("code");
        if (!code) {
          res.writeHead(400).end("Missing code");
          return;
        }

        const tokens = await exchangeCode(code);
        res.writeHead(200, { "Content-Type": "text/html" }).end(
          "<h1>FreeAgent connected</h1><p>You can close this tab and return to the terminal.</p>",
        );
        server.close();
        resolve(tokens);
      } catch (err) {
        res.writeHead(500).end(String(err));
        server.close();
        reject(err);
      }
    });

    server.listen(port, listenHost);
  });
}
