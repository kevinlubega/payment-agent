import dotenv from "dotenv";
dotenv.config({ override: true });

import Anthropic from "@anthropic-ai/sdk";
import { sendUSDC } from "./wallet";
import { checkLimits, recordPayment } from "./limits";
import type { Address } from "viem";

const MODEL = "claude-sonnet-4-6";

const PAY_TOOL: Anthropic.Tool = {
  name: "pay",
  description:
    "Send USDC to a recipient. Use this when the user wants to pay someone.",
  input_schema: {
    type: "object",
    properties: {
      recipient: {
        type: "string",
        description: "The wallet address to send USDC to (0x...)",
      },
      amount: {
        type: "number",
        description: "The amount in USD to send as USDC",
      },
      memo: {
        type: "string",
        description: "A short description of what the payment is for",
      },
    },
    required: ["recipient", "amount", "memo"],
  },
};

export interface PaymentResult {
  success: boolean;
  txHash?: string;
  amount?: number;
  recipient?: string;
  memo?: string;
  error?: string;
}

export async function runPaymentAgent(
  instruction: string
): Promise<PaymentResult> {
  const client = new Anthropic();

  console.log(`\n[Agent] Instruction: "${instruction}"`);

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: instruction,
    },
  ];

  // First call: let Claude parse the instruction and decide to call the pay tool
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system:
      "You are a payment agent that processes USDC payment instructions. " +
      "When the user gives you a payment instruction, use the pay tool to execute it. " +
      "Always use the pay tool — never respond with plain text for payment requests.",
    tools: [PAY_TOOL],
    tool_choice: { type: "auto" },
    messages,
  });

  // Find the tool use block
  const toolUseBlock = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
  );

  if (!toolUseBlock || toolUseBlock.name !== "pay") {
    // Claude didn't call the tool — return its text response as an error
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join(" ");
    return { success: false, error: text || "Agent did not parse a payment." };
  }

  const { recipient, amount, memo } = toolUseBlock.input as {
    recipient: string;
    amount: number;
    memo: string;
  };

  // Confirm parsed details before executing
  console.log(`[Agent] Parsed payment details:`);
  console.log(`  Recipient : ${recipient}`);
  console.log(`  Amount    : $${amount} USDC`);
  console.log(`  Memo      : ${memo}`);

  // Safety checks — address validity, single-payment cap, daily cap
  const check = await checkLimits(recipient, amount);
  if (!check.allowed) {
    console.warn(`[Agent] Blocked: ${check.error}`);
    return { success: false, error: check.error };
  }

  console.log(`[Agent] Limits OK — executing transfer...`);

  try {
    const txHash = await sendUSDC(recipient as Address, amount);

    await recordPayment({ amount, recipient, memo, txHash, success: true });

    const result: PaymentResult = {
      success: true,
      txHash,
      amount,
      recipient,
      memo,
    };

    // Feed the tool result back to Claude to produce a natural language confirmation
    messages.push({ role: "assistant", content: response.content });
    messages.push({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: toolUseBlock.id,
          content: JSON.stringify(result),
        },
      ],
    });

    const confirmation = await client.messages.create({
      model: MODEL,
      max_tokens: 256,
      system:
        "You are a payment agent. Summarize the completed payment in one sentence.",
      tools: [PAY_TOOL],
      messages,
    });

    const confirmText = confirmation.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join(" ");

    console.log(`[Agent] ${confirmText}`);
    return result;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[Agent] Payment failed: ${error}`);
    return { success: false, error };
  }
}
