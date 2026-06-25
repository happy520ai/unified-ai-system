import fs from "fs/promises";
import path from "path";
import { DATA_DIR, PROVIDERS_CONFIG } from "./commandPaletteConstants.js";

/**
 * Billing command handlers for CommandPaletteService.
 * Extracted from commandPaletteService.js to stay under 500 lines.
 */

export async function billingSummary() {
  const billingFile = path.join(DATA_DIR, "billing", "ledger.json");
  try {
    const raw = await fs.readFile(billingFile, "utf-8");
    const ledger = JSON.parse(raw);
    const entries = Array.isArray(ledger.entries) ? ledger.entries : [];

    const totalCost = entries.reduce((sum, e) => sum + (e.cost ?? 0), 0);
    const totalTokens = entries.reduce((sum, e) => sum + (e.tokens ?? 0), 0);

    return {
      totalCost: totalCost.toFixed(4),
      totalTokens,
      entryCount: entries.length,
      currency: ledger.currency ?? "USD",
    };
  } catch {
    return {
      totalCost: "0.0000",
      totalTokens: 0,
      entryCount: 0,
      hint: "No billing ledger found. Token cost tracking activates on first provider call.",
    };
  }
}

export async function billingInvoice() {
  const billingFile = path.join(DATA_DIR, "billing", "ledger.json");
  try {
    const raw = await fs.readFile(billingFile, "utf-8");
    const ledger = JSON.parse(raw);
    return { invoice: ledger, generatedAt: new Date().toISOString() };
  } catch {
    return {
      invoice: null,
      hint: "No billing data available. Invoice generation requires active provider usage.",
    };
  }
}

export async function billingUsage() {
  const billingFile = path.join(DATA_DIR, "billing", "ledger.json");
  try {
    const raw = await fs.readFile(billingFile, "utf-8");
    const ledger = JSON.parse(raw);
    const entries = Array.isArray(ledger.entries) ? ledger.entries : [];

    // Group by provider
    const byProvider = {};
    for (const e of entries) {
      const key = e.providerId ?? "unknown";
      if (!byProvider[key]) byProvider[key] = { tokens: 0, cost: 0, calls: 0 };
      byProvider[key].tokens += e.tokens ?? 0;
      byProvider[key].cost += e.cost ?? 0;
      byProvider[key].calls += 1;
    }

    return { byProvider, totalEntries: entries.length };
  } catch {
    return { byProvider: {}, totalEntries: 0, hint: "No usage data available." };
  }
}
