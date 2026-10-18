# freeagent-agent

Connect an AI agent to the [FreeAgent API](https://dev.freeagent.com/docs) for bank feed monitoring and payment reconciliation.

FreeAgent bank feeds stay connected inside FreeAgent (Open Banking). This project authenticates via OAuth and exposes tools to:

- list bank accounts and feed status
- pull **unexplained** transactions
- propose invoice matches (read-only)
- create **bank transaction explanations** (reconcile / mark invoice paid)

## FreeAgent developer app form

| Field | Suggested value |
|---|---|
| **Name** | `freeagent-agent` |
| **Description** | Personal agent for bank reconciliation via the FreeAgent API |
| **App Homepage URL** | `https://github.com/bobbygeo/freeagent-agent` |
| **OAuth Redirect URIs** | `http://127.0.0.1:3847/oauth/callback` |
| **Enable Accountancy Practice API** | **Off** |

Add that redirect URI in FreeAgent (you can keep any old `:3000` URI as well). Copy Client ID / Secret into `.env`.

## Docker (recommended local host)

Runs on **127.0.0.1:3847** so it does not collide with apps on port 3000.

```bash
cd /Users/bobbyg/Projects/DEV/freeagent-agent
cp .env.example .env   # if needed — fill Client ID / Secret
# Ensure FREEAGENT_REDIRECT_URI=http://127.0.0.1:3847/oauth/callback

npm run docker:up
open http://127.0.0.1:3847/auth    # OAuth once
curl http://127.0.0.1:3847/health
curl http://127.0.0.1:3847/api/company

npm run docker:cli -- accounts
npm run docker:logs
npm run docker:down
```

Tokens persist in `./data/.oauth-tokens.json` (gitignored). Drop receipt files in `./receipts/` (mounted read-only).

## CLI (without Docker)

```bash
npm install
npm run auth          # uses PORT / redirect from .env (default 3847)
npm run company
npm run accounts
npm run server        # long-running http://127.0.0.1:3847
```

## Agent tools

See `src/tools.ts` — `agentToolDefinitions` for LLM tool-calling.

## Safety

- Never commit `.env` or token files under `data/`
- Auto-post only exact amount matches; queue ambiguous ones
- Rate limits: 120 req/min, 3600/hour per user
- Container binds **localhost only** (`127.0.0.1:3847`)
