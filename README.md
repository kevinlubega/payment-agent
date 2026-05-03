# Payment Agent

An AI payment agent that can autonomously pay for items using USDC stablecoins on the Base testnet.

## Overview

This agent uses an AI model to make payment decisions and executes on-chain USDC transfers on Base testnet — Coinbase's Ethereum L2 — without requiring manual approval for each transaction.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in your values:
   ```bash
   cp .env.example .env
   ```

3. Run in development mode:
   ```bash
   npm run dev
   ```

4. Build and run for production:
   ```bash
   npm run build
   npm start
   ```

## Environment Variables

| Variable | Description |
|---|---|
| `WALLET_PRIVATE_KEY` | Private key of the wallet used to sign USDC transactions on Base testnet |
| `ANTHROPIC_API_KEY` | API key for Claude (used for AI payment decisions) |
| `PORT` | Server port (default: 3000) |

## Endpoints

- `GET /health` — Returns `{ status: "ok" }` to confirm the server is running

## Network

All transactions run on **Base Sepolia testnet**. Use a testnet wallet and obtain test USDC from a Base Sepolia faucet before running the agent.
