# freeagent-agent

Connect an AI agent to the [FreeAgent API](https://dev.freeagent.com/docs) for bank feed monitoring and payment reconciliation.

FreeAgent bank feeds stay connected inside FreeAgent (Open Banking). This project authenticates via OAuth and exposes tools to:

- list bank accounts and feed status
- pull **unexplained** transactions
- propose invoice matches (read-only)
- create **bank transaction explanations** (reconcile / mark invoice paid)

## FreeAgent developer app form

When creating the app at [dev.freeagent.com](https://dev.freeagent.com/apps):

| Field | Suggested value |
|---|---|
| **Name** | `freeagent-agent` |
| **Description** | Personal agent for bank reconciliation via the FreeAgent API |
| **App Homepage URL** | `https://github.com/bobbygeo/freeagent-agent` |
| **OAuth Redirect URIs** | `http://localhost:3000/oauth/callback` |
| **Enable Accountancy Practice API** | **Off** (unless you are an accountant managing clients) |

After create, copy the **OAuth identifier** and **OAuth secret** into `.env`.

Use the **sandbox** dashboard + `FREEAGENT_ENV=sandbox` while testing.

## Setup

```bash
cd /Users/bobbyg/Projects/DEV/freeagent-agent
cp .env.example .env
# fill FREEAGENT_CLIENT_ID and FREEAGENT_CLIENT_SECRET
npm install
npm run auth          # browser OAuth → saves .oauth-tokens.json
npm run company       # smoke test
npm run accounts
```

## CLI

```bash
npm run accounts
npm run feeds
npm run unexplained -- "https://api.sandbox.freeagent.com/v2/bank_accounts/1"
npm run dev -- propose "https://api.sandbox.freeagent.com/v2/bank_accounts/1"
```

Writes that create explanations should be confirmed by a human — wrong explanations feed VAT and year-end.

## Agent tools

See `src/tools.ts`:

- `list_bank_accounts`
- `list_bank_feeds`
- `list_unexplained_transactions`
- `list_open_invoices`
- `propose_invoice_matches` (no write)
- `explain_as_invoice_payment` (write)
- `explain_with_category` (write)

`agentToolDefinitions` is ready to plug into an LLM tool-calling runtime.

## API references

- [OAuth](https://dev.freeagent.com/docs/oauth)
- [Bank transactions](https://dev.freeagent.com/docs/bank_transactions) (`view=unexplained`)
- [Bank transaction explanations](https://dev.freeagent.com/docs/bank_transaction_explanations)
- [Bank feeds](https://dev.freeagent.com/docs/bank_feeds) (read status only)

## Safety

- Never commit `.env` or `.oauth-tokens.json`
- Auto-post only exact amount matches; queue ambiguous ones
- Rate limits: 120 req/min, 3600/hour per user
