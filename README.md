# Boxcade v0.01

A mystery-box midway: browse the market, sweep the floor, spin a practice wheel, and check out with crypto or a card stub.

v0.01 is the prototype look and copy, now running as a Next.js app with Dynamic for login and wallet payments.

## Run locally

```bash
cp .env.example .env.local
npm install
npm run dev      # http://localhost:3000
npm run build
```

## Environment variables

None of these are required for the site to build or render. If the Dynamic environment ID is missing, Sign in falls back to the original demo flow with a short note.

| Variable | What it is |
| --- | --- |
| `NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID` | Dynamic environment ID (Sandbox ID can ship now; swap for Live later). |
| `NEXT_PUBLIC_TREASURY_SOL` | Solana address that receives SOL, USDC, and USDT payments. Unset = labeled demo toast. |
| `NEXT_PUBLIC_TREASURY_EVM` | Ethereum address that receives ETH, USDC, and USDT payments. Unset = labeled demo toast. |
| `NEXT_PUBLIC_ETH_USD` | Optional USD price of 1 ETH, used only when the buyer pays with ETH. |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Optional Solana RPC. Defaults to public mainnet. |

Copy `.env.example` to `.env.local` for local development. On Vercel, set the same keys on the project, then redeploy (`NEXT_PUBLIC_*` values are baked in at build time).

## What is wired

- **Sign in** opens a Boxcade-styled Dynamic flow: email OTP plus detected external wallets (Solana first, then EVM, Bitcoin, and TON). After sign-in, the header shows the user and Log out is available.
- **Embedded wallets** are created after auth via WaaS (`userChanged` → `getChainsMissingWaasWalletAccounts` → `createWaasWalletAccounts`).
- **Crypto Pay** asks the connected wallet to send to the treasury when an address is set: native SOL, Solana USDC/USDT, Ethereum USDC/USDT, and ETH if `NEXT_PUBLIC_ETH_USD` is set. Bitcoin, Zcash, and Robinhood Chain without a matching treasury stay a labeled demo toast.
- **Card Pay** remains a Whop checkout stub.

## Confirm these Dynamic Console settings

In [https://console.dynamic.xyz](https://console.dynamic.xyz), on the environment that matches the ID in `NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID`:

1. **Chains & Networks** — EVM, Solana, Bitcoin, and TON are on.
2. **Sign-in methods** — Email OTP is on (and any social providers you want).
3. **Wallets** — Embedded wallets (WaaS) are on.
4. **Security → Allowed Origins** — add the exact production origin and `http://localhost:3000`.

If you accept API version `2026_04_01`, step-up authentication and device registration may be required for some wallet actions. The app surfaces those errors in a toast; you may still need to complete verification or device registration in Dynamic.

## Stack

- Next.js App Router + TypeScript
- Dynamic JavaScript SDK (`@dynamic-labs-sdk/client`, `@dynamic-labs-sdk/react-hooks`) with EVM, Solana, Bitcoin, and TON extensions
