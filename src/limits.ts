import { isAddress } from "viem";
import { getSupabase } from "./db/supabase";

const MAX_SINGLE_PAYMENT = 20;
const MAX_DAILY_TOTAL = 100;

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// ── Types ────────────────────────────────────────────────────

export interface LimitCheck {
  allowed: boolean;
  error?: string;
}

export interface TransactionRecord {
  amount: number;
  recipient: string;
  memo: string;
  txHash: string;
  success: boolean;
}

// ── Internal helpers ─────────────────────────────────────────

async function getDailySpend(date: string): Promise<number> {
  try {
    const { data, error } = await getSupabase()
      .from("daily_limits")
      .select("total_spent")
      .eq("date", date)
      .maybeSingle();

    if (error) {
      console.error("[Limits] Error reading daily spend:", error.message);
      return 0; // fail-open so DB issues don't block all payments
    }

    return Number(data?.total_spent ?? 0);
  } catch (err) {
    console.error("[Limits] Unexpected error:", err);
    return 0;
  }
}

// ── Public API ───────────────────────────────────────────────

/** Validate address, single-payment cap, and daily cumulative cap. */
export async function checkLimits(
  recipient: string,
  amount: number
): Promise<LimitCheck> {
  if (!isAddress(recipient)) {
    return {
      allowed: false,
      error: `Invalid Ethereum address: "${recipient}"`,
    };
  }

  if (amount > MAX_SINGLE_PAYMENT) {
    return {
      allowed: false,
      error: `Amount $${amount} exceeds single payment limit of $${MAX_SINGLE_PAYMENT} USDC`,
    };
  }

  const spent = await getDailySpend(todayUTC());
  const projected = spent + amount;
  if (projected > MAX_DAILY_TOTAL) {
    return {
      allowed: false,
      error: `Payment would exceed daily limit. Spent: $${spent.toFixed(2)}, limit: $${MAX_DAILY_TOTAL} USDC`,
    };
  }

  return { allowed: true };
}

/**
 * Persist a completed (or failed) payment:
 *  1. Insert a row into `transactions`
 *  2. Upsert today's cumulative spend in `daily_limits`
 */
export async function recordPayment(params: TransactionRecord): Promise<void> {
  const supabase = getSupabase();
  const date = todayUTC();

  // 1. Transaction log
  const { error: txError } = await supabase.from("transactions").insert({
    recipient: params.recipient,
    amount_usdc: params.amount,
    memo: params.memo,
    tx_hash: params.txHash || null,
    success: params.success,
  });

  if (txError) {
    console.error("[Limits] Error recording transaction:", txError.message);
  }

  // 2. Daily spend — only count successful payments
  if (params.success) {
    const currentSpent = await getDailySpend(date);
    const newSpent =
      Math.round((currentSpent + params.amount) * 1_000_000) / 1_000_000;

    const { error: limitError } = await supabase
      .from("daily_limits")
      .upsert(
        { date, total_spent: newSpent, last_updated: new Date().toISOString() },
        { onConflict: "date" }
      );

    if (limitError) {
      console.error("[Limits] Error updating daily limit:", limitError.message);
    }
  }
}

/** Returns current daily spend vs limits — used by GET /limits. */
export async function getLimitsStatus() {
  const date = todayUTC();
  const spent = await getDailySpend(date);

  return {
    daily: {
      spent,
      limit: MAX_DAILY_TOTAL,
      remaining: Math.max(
        0,
        Math.round((MAX_DAILY_TOTAL - spent) * 1_000_000) / 1_000_000
      ),
      date,
    },
    singlePaymentLimit: MAX_SINGLE_PAYMENT,
  };
}
