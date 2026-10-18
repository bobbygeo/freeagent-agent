/**
 * Agent-facing FreeAgent tools for bank reconciliation.
 * Wire these into an LLM tool-calling runtime or call from the CLI.
 */
import { freeagentJson } from "./client.js";

export type BankAccount = {
  url: string;
  name: string;
  current_balance?: string;
  type?: string;
  status?: string;
  currency?: string;
};

export type BankTransaction = {
  url: string;
  amount: string;
  bank_account: string;
  dated_on: string;
  description: string;
  unexplained_amount: string;
  full_description?: string;
};

export type BankFeed = {
  url: string;
  bank_account: string;
  state: string;
  feed_type: string;
  bank_service_name?: string;
  sca_expires_at?: string;
};

export type Invoice = {
  url: string;
  reference?: string;
  status?: string;
  due_value?: string;
  total_value?: string;
  dated_on?: string;
  contact?: string;
};

export async function getCompany() {
  return freeagentJson<{ company: Record<string, unknown> }>("/company");
}

export async function listBankAccounts(): Promise<BankAccount[]> {
  const data = await freeagentJson<{ bank_accounts: BankAccount[] }>("/bank_accounts");
  return data.bank_accounts ?? [];
}

export async function listBankFeeds(): Promise<BankFeed[]> {
  const data = await freeagentJson<{ bank_feeds: BankFeed[] }>("/bank_feeds");
  return data.bank_feeds ?? [];
}

export async function listUnexplainedTransactions(
  bankAccountUrl: string,
): Promise<BankTransaction[]> {
  const params = new URLSearchParams({
    bank_account: bankAccountUrl,
    view: "unexplained",
    per_page: "100",
  });
  const data = await freeagentJson<{ bank_transactions: BankTransaction[] }>(
    `/bank_transactions?${params}`,
  );
  return data.bank_transactions ?? [];
}

export async function listOpenInvoices(): Promise<Invoice[]> {
  const params = new URLSearchParams({ view: "open", per_page: "100" });
  const data = await freeagentJson<{ invoices: Invoice[] }>(`/invoices?${params}`);
  return data.invoices ?? [];
}

export type ExplainInvoicePaymentInput = {
  bankTransactionUrl: string;
  paidInvoiceUrl: string;
  datedOn: string;
  grossValue: string;
};

/** Reconcile a bank credit as payment against an invoice. */
export async function explainAsInvoicePayment(input: ExplainInvoicePaymentInput) {
  return freeagentJson("/bank_transaction_explanations", {
    method: "POST",
    body: JSON.stringify({
      bank_transaction_explanation: {
        bank_transaction: input.bankTransactionUrl,
        paid_invoice: input.paidInvoiceUrl,
        dated_on: input.datedOn,
        gross_value: input.grossValue,
      },
    }),
  });
}

export type ExplainWithCategoryInput = {
  bankTransactionUrl: string;
  categoryUrl: string;
  datedOn: string;
  grossValue: string;
  description?: string;
};

/** Categorise a transaction (expense/income) without linking an invoice. */
export async function explainWithCategory(input: ExplainWithCategoryInput) {
  return freeagentJson("/bank_transaction_explanations", {
    method: "POST",
    body: JSON.stringify({
      bank_transaction_explanation: {
        bank_transaction: input.bankTransactionUrl,
        category: input.categoryUrl,
        dated_on: input.datedOn,
        gross_value: input.grossValue,
        description: input.description,
      },
    }),
  });
}

/** Suggest invoice matches by exact amount — agent should confirm before writing. */
export function proposeInvoiceMatches(
  transactions: BankTransaction[],
  invoices: Invoice[],
) {
  const proposals = [];
  for (const tx of transactions) {
    const amount = Math.abs(Number(tx.unexplained_amount || tx.amount));
    const matches = invoices.filter((inv) => {
      const due = Math.abs(Number(inv.due_value ?? inv.total_value ?? NaN));
      return Number.isFinite(due) && Math.abs(due - amount) < 0.005;
    });
    if (matches.length) {
      proposals.push({
        transaction: tx,
        candidates: matches,
        confidence: matches.length === 1 ? "high" : "ambiguous",
      });
    }
  }
  return proposals;
}

/** Tool schemas for LLM runtimes (OpenAI / Anthropic / Vercel AI SDK style). */
export const agentToolDefinitions = [
  {
    name: "list_bank_accounts",
    description: "List FreeAgent bank accounts with balances",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_bank_feeds",
    description: "List bank feed status (enabled, Open Banking vs API, SCA expiry)",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_unexplained_transactions",
    description: "List unexplained bank transactions for a bank account URL",
    parameters: {
      type: "object",
      properties: {
        bank_account_url: { type: "string" },
      },
      required: ["bank_account_url"],
      additionalProperties: false,
    },
  },
  {
    name: "list_open_invoices",
    description: "List open (unpaid) FreeAgent invoices",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "propose_invoice_matches",
    description:
      "Suggest matches between unexplained transactions and open invoices by amount. Does not write to FreeAgent.",
    parameters: {
      type: "object",
      properties: {
        bank_account_url: { type: "string" },
      },
      required: ["bank_account_url"],
      additionalProperties: false,
    },
  },
  {
    name: "explain_as_invoice_payment",
    description:
      "Create a bank transaction explanation linking a transaction to a paid invoice. Only use for confirmed matches.",
    parameters: {
      type: "object",
      properties: {
        bank_transaction_url: { type: "string" },
        paid_invoice_url: { type: "string" },
        dated_on: { type: "string", description: "YYYY-MM-DD" },
        gross_value: { type: "string" },
      },
      required: [
        "bank_transaction_url",
        "paid_invoice_url",
        "dated_on",
        "gross_value",
      ],
      additionalProperties: false,
    },
  },
] as const;
