export const SOL_USD = 180;

function pick(...values: Array<string | undefined>) {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

export function getPublicConfig() {
  return {
    dynamicEnvId: pick(process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID),
    treasurySol: pick(process.env.NEXT_PUBLIC_TREASURY_SOL),
    treasuryEvm: pick(process.env.NEXT_PUBLIC_TREASURY_EVM),
    ethUsd: pick(process.env.NEXT_PUBLIC_ETH_USD),
    solanaRpc: pick(process.env.NEXT_PUBLIC_SOLANA_RPC_URL) || "https://api.mainnet-beta.solana.com",
  };
}

export type PublicConfig = ReturnType<typeof getPublicConfig>;
