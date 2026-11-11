import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import type { WalletAccount } from "@dynamic-labs-sdk/client";
import { switchActiveNetwork } from "@dynamic-labs-sdk/client";
import { isEvmWalletAccount } from "@dynamic-labs-sdk/evm";
import { createWalletClientForWalletAccount } from "@dynamic-labs-sdk/evm/viem";
import { isSolanaWalletAccount, signAndSendTransaction } from "@dynamic-labs-sdk/solana";
import { erc20Abi, parseEther, parseUnits } from "viem";
import { SOL } from "./catalog";
import type { PublicConfig } from "./config";

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const ETHEREUM_CHAIN_ID = 1;
const STABLE_DECIMALS = 6;

export const USDC_SOLANA = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const USDT_SOLANA = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
export const USDC_ETHEREUM = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
export const USDT_ETHEREUM = "0xdAC17F958D2ee523a2206206994597C13D831ec7";

export type PayOutcome =
  | { kind: "demo"; message: string }
  | { kind: "need-sign-in" }
  | { kind: "need-wallet"; message: string }
  | { kind: "sent"; txId: string; message: string };

export function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return String(err);
}

export function friendlyError(err: unknown): string {
  const message = errorMessage(err);
  const lower = message.toLowerCase();
  if (lower.includes("step-up") || lower.includes("step up") || lower.includes("elevated")) {
    return "Additional verification is required (step-up auth). Complete it in Dynamic and try again. " + message;
  }
  if (lower.includes("device registration") || lower.includes("register this device")) {
    return "This device may need to be registered in Dynamic before continuing. " + message;
  }
  return message;
}

function solTreasury(config: PublicConfig) {
  const raw = config.treasurySol.trim();
  if (!raw) return null;
  try {
    return new PublicKey(raw);
  } catch {
    return null;
  }
}

function evmTreasury(config: PublicConfig) {
  const raw = config.treasuryEvm.trim();
  if (!raw || !EVM_ADDRESS.test(raw)) return null;
  return raw as `0x${string}`;
}

function usdAmount(solAmount: number) {
  return solAmount * SOL;
}

async function paySolana(params: {
  token: string;
  solAmount: number;
  config: PublicConfig;
  walletAccount: WalletAccount;
}): Promise<PayOutcome> {
  const to = solTreasury(params.config);
  if (!to) {
    return {
      kind: "demo",
      message: `Demo: set NEXT_PUBLIC_TREASURY_SOL to send a real ${params.token} payment on Solana.`,
    };
  }
  if (!isSolanaWalletAccount(params.walletAccount)) {
    return { kind: "need-wallet", message: "Connect a Solana wallet to pay on Solana." };
  }
  const from = new PublicKey(params.walletAccount.address);
  const connection = new Connection(params.config.solanaRpc, "confirmed");
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const transaction = new Transaction({ feePayer: from, blockhash, lastValidBlockHeight });

  if (params.token === "SOL") {
    const lamports = Math.round(params.solAmount * LAMPORTS_PER_SOL);
    if (lamports <= 0) throw new Error("Amount must be greater than zero.");
    transaction.add(SystemProgram.transfer({ fromPubkey: from, toPubkey: to, lamports }));
  } else {
    const mint = new PublicKey(params.token === "USDT" ? USDT_SOLANA : USDC_SOLANA);
    const units = BigInt(Math.round(usdAmount(params.solAmount) * 10 ** STABLE_DECIMALS));
    if (units <= BigInt(0)) throw new Error("Amount must be greater than zero.");
    const fromAta = await getAssociatedTokenAddress(mint, from);
    const toAta = await getAssociatedTokenAddress(mint, to);
    transaction.add(createAssociatedTokenAccountIdempotentInstruction(from, toAta, to, mint));
    transaction.add(createTransferInstruction(fromAta, toAta, from, units, [], TOKEN_PROGRAM_ID));
  }

  const { signature } = await signAndSendTransaction({
    sponsorshipMode: "off",
    transaction,
    walletAccount: params.walletAccount,
  });
  return { kind: "sent", txId: signature, message: `Payment sent. Transaction ${signature}` };
}

async function payEvm(params: {
  token: string;
  solAmount: number;
  config: PublicConfig;
  walletAccount: WalletAccount;
}): Promise<PayOutcome> {
  const to = evmTreasury(params.config);
  if (!to) {
    return {
      kind: "demo",
      message: `Demo: set NEXT_PUBLIC_TREASURY_EVM to send a real ${params.token} payment on Ethereum.`,
    };
  }
  if (!isEvmWalletAccount(params.walletAccount)) {
    return { kind: "need-wallet", message: "Connect an Ethereum wallet to pay on this network." };
  }

  if (params.token === "ETH" && !params.config.ethUsd) {
    return {
      kind: "demo",
      message: "Demo: set NEXT_PUBLIC_ETH_USD to convert the cart total into ETH before sending.",
    };
  }

  await switchActiveNetwork({ networkId: String(ETHEREUM_CHAIN_ID), walletAccount: params.walletAccount });
  const walletClient = await createWalletClientForWalletAccount({ walletAccount: params.walletAccount });
  let hash: `0x${string}`;
  if (params.token === "ETH") {
    const eth = usdAmount(params.solAmount) / Number(params.config.ethUsd);
    hash = await walletClient.sendTransaction({ to, value: parseEther(eth.toFixed(8)) });
  } else {
    const units = parseUnits(usdAmount(params.solAmount).toFixed(STABLE_DECIMALS), STABLE_DECIMALS);
    const token = (params.token === "USDT" ? USDT_ETHEREUM : USDC_ETHEREUM) as `0x${string}`;
    hash = await walletClient.writeContract({
      address: token,
      abi: erc20Abi,
      functionName: "transfer",
      args: [to, units],
    });
  }
  return { kind: "sent", txId: hash, message: `Payment sent. Transaction ${hash}` };
}

export async function payCrypto(params: {
  chain: string;
  token: string;
  solAmount: number;
  signedIn: boolean;
  dynamicEnabled: boolean;
  accounts: WalletAccount[];
  config: PublicConfig;
}): Promise<PayOutcome> {
  if (!params.signedIn) return { kind: "need-sign-in" };
  if (!params.dynamicEnabled) {
    return { kind: "demo", message: `Demo: Dynamic would sign this ${params.token} payment` };
  }

  if (params.chain === "Bitcoin" || params.chain === "Zcash") {
    return {
      kind: "demo",
      message: `Demo: no treasury is configured for ${params.chain} yet. Payment was not sent.`,
    };
  }

  if (params.chain === "Solana") {
    const wallet = params.accounts.find(isSolanaWalletAccount);
    if (!wallet) return { kind: "need-wallet", message: "Connect a Solana wallet to pay." };
    return paySolana({ ...params, walletAccount: wallet });
  }

  if (params.chain === "Ethereum" || params.chain === "Robinhood Chain") {
    const wallet = params.accounts.find(isEvmWalletAccount);
    if (!wallet) return { kind: "need-wallet", message: "Connect an Ethereum wallet to pay." };
    return payEvm({ ...params, walletAccount: wallet });
  }

  return { kind: "demo", message: `Demo: ${params.chain} checkout is not wired yet.` };
}
