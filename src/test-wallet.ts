import dotenv from "dotenv";
dotenv.config();

import { account, getUSDCBalance } from "./wallet";

async function main() {
  const acc = account();
  console.log("Wallet address:", acc.address);
  await getUSDCBalance(acc.address);
}

main().catch(console.error);
