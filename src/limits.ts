import fs from "fs";
import path from "path";
import { isAddress } from "viem";

// Vercel's filesystem is read-only except /tmp; fall back there in production
const LEDGER_PATH = process.env.VERCEL
  ? "/tmp/daily-spend.json"
  : path.join(process.cwd(), "daily-spend.json");
const MAX_SINGLE_PAYMENT = 20;
const MAX_DAILY_TOTAL = 100;

interface DailyLedger {
  date: string;   // YYYY-MM-DD
  spent: number;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function readLedger(): DailyLedger {
  try {
    const raw = fs.readFileSync(LEDGER_PATH, "utf8");
    const ledger = JSON.parse(raw) as DailyLedger;
    // Reset if it's a new day
    if (ledger.date !== today()) {
      return { date: today(), spent: 0 };
    }
    return ledger;
  } catch {
    return { date: today(), spent: 0 };
  }
}

function writeLedger(ledger: DailyLedger): void {
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2));
}

export interface LimitCheck {
  allowed: boolean;
  error?: string;
}

export function checkLimits(recipient: string, amount: number): LimitCheck {
  // Validate Ethereum address
  if (!isAddress(recipient)) {
    return {
      allowed: false,
      error: `Invalid Ethereum address: "${recipient}"`,
    };
  }

  // Single payment limit
  if (amount > MAX_SINGLE_PAYMENT) {
    return {
      allowed: false,
      error: `Amount $${amount} exceeds single payment limit of $${MAX_SINGLE_PAYMENT} USDC`,
    };
  }

  // Daily cumulative limit
  const ledger = readLedger();
  const projectedSpend = ledger.spent + amount;
  if (projectedSpend > MAX_DAILY_TOTAL) {
    return {
      allowed: false,
      error: `Payment would exceed daily limit. Spent: $${ledger.spent.toFixed(2)}, limit: $${MAX_DAILY_TOTAL} USDC`,
    };
  }

  return { allowed: true };
}

export function recordPayment(amount: number): void {
  const ledger = readLedger();
  ledger.spent = Math.round((ledger.spent + amount) * 1e8) / 1e8;
  writeLedger(ledger);
}

export function getLimitsStatus() {
  const ledger = readLedger();
  return {
    daily: {
      spent: ledger.spent,
      limit: MAX_DAILY_TOTAL,
      remaining: Math.max(0, Math.round((MAX_DAILY_TOTAL - ledger.spent) * 1e8) / 1e8),
      date: ledger.date,
    },
    singlePaymentLimit: MAX_SINGLE_PAYMENT,
  };
}
