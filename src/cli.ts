#!/usr/bin/env node
import { runInteractiveAuth } from "./oauth.js";
import {
  getCompany,
  listBankAccounts,
  listBankFeeds,
  listOpenInvoices,
  listUnexplainedTransactions,
  proposeInvoiceMatches,
} from "./tools.js";

function usage() {
  console.log(`freeagent-agent

Commands:
  auth                         OAuth login (localhost callback)
  company                      Show company profile
  accounts                     List bank accounts
  feeds                        List bank feed status
  unexplained <bankAccountUrl> List unexplained transactions
  propose <bankAccountUrl>     Propose invoice matches (read-only)
  help                         Show this help
`);
}

async function main() {
  const [cmd, arg] = process.argv.slice(2);

  switch (cmd) {
    case undefined:
    case "help":
    case "-h":
    case "--help":
      usage();
      return;

    case "auth": {
      const tokens = await runInteractiveAuth();
      console.log("Saved tokens. Access token expires in", tokens.expires_in ?? 3600, "seconds.");
      return;
    }

    case "company": {
      console.log(JSON.stringify(await getCompany(), null, 2));
      return;
    }

    case "accounts": {
      console.log(JSON.stringify(await listBankAccounts(), null, 2));
      return;
    }

    case "feeds": {
      console.log(JSON.stringify(await listBankFeeds(), null, 2));
      return;
    }

    case "unexplained": {
      if (!arg) throw new Error("Usage: unexplained <bankAccountUrl>");
      console.log(JSON.stringify(await listUnexplainedTransactions(arg), null, 2));
      return;
    }

    case "propose": {
      if (!arg) throw new Error("Usage: propose <bankAccountUrl>");
      const [txs, invoices] = await Promise.all([
        listUnexplainedTransactions(arg),
        listOpenInvoices(),
      ]);
      console.log(JSON.stringify(proposeInvoiceMatches(txs, invoices), null, 2));
      return;
    }

    default:
      usage();
      throw new Error(`Unknown command: ${cmd}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
