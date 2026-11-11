"use client";

import { createDynamicClient, initializeClient } from "@dynamic-labs-sdk/client";
import { addBitcoinExtension } from "@dynamic-labs-sdk/bitcoin";
import { addEvmExtension } from "@dynamic-labs-sdk/evm";
import { addSolanaExtension } from "@dynamic-labs-sdk/solana";
import { addTonExtension } from "@dynamic-labs-sdk/ton";
import { DYNAMIC_ENV_ID, hasDynamicEnv } from "./env";

export { hasDynamicEnv };

export const dynamicClient = hasDynamicEnv
  ? createDynamicClient({
      autoInitialize: false,
      environmentId: DYNAMIC_ENV_ID,
      metadata: {
        name: "Boxcade",
        universalLink: typeof window !== "undefined" ? window.location.origin : "http://localhost:3000",
      },
    })
  : null;

if (hasDynamicEnv && typeof window !== "undefined") {
  addEvmExtension();
  addSolanaExtension();
  addBitcoinExtension();
  addTonExtension();
  void initializeClient();
}
