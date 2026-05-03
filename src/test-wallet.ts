import dotenv from "dotenv";
dotenv.config();

import { account, getUSDCBalance } from "./wallet";

async function main() {
  console.log("Wallet address:", account.address);
  await getUSDCBalance(account.address);
}

main().catch(console.error);
