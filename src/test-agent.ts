import dotenv from "dotenv";
dotenv.config({ override: true });

import { runPaymentAgent } from "./agent";

async function main() {
  const instruction = process.argv[2] ?? "Pay 1 USDC to 0xAd50E849BA79188422F6cED24Cc8A582e81da603 for a test coffee payment";

  const result = await runPaymentAgent(instruction);
  console.log("\n[Result]", JSON.stringify(result, null, 2));
}

main().catch(console.error);
