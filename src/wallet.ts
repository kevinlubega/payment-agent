import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

const USDC_ADDRESS: Address = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const USDC_DECIMALS = 6;

const USDC_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

function loadAccount() {
  const raw = process.env.WALLET_PRIVATE_KEY;
  if (!raw) throw new Error("WALLET_PRIVATE_KEY is not set in .env");

  const key = raw.startsWith("0x") ? raw : `0x${raw}`;
  return privateKeyToAccount(key as `0x${string}`);
}

const account = loadAccount();

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(),
});

function log(message: string) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

export async function getUSDCBalance(address: Address): Promise<string> {
  const raw = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: [address],
  });

  const balance = formatUnits(raw, USDC_DECIMALS);
  log(`Balance of ${address}: ${balance} USDC`);
  return balance;
}

export async function sendUSDC(
  toAddress: Address,
  amountInDollars: number
): Promise<string> {
  const amount = parseUnits(amountInDollars.toString(), USDC_DECIMALS);

  log(`Sending ${amountInDollars} USDC to ${toAddress}...`);

  const txHash = await walletClient.writeContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "transfer",
    args: [toAddress, amount],
  });

  log(`Transaction submitted: txHash=${txHash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  log(
    `Transaction confirmed: txHash=${txHash} block=${receipt.blockNumber} status=${receipt.status}`
  );

  return txHash;
}

export { account };
