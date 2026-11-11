"use client";

import { useOnEvent } from "@dynamic-labs-sdk/react-hooks";
import { createWaasWalletAccounts, getChainsMissingWaasWalletAccounts } from "@dynamic-labs-sdk/client/waas";

export function WaasBootstrap() {
  useOnEvent({
    event: "userChanged",
    listener: async ({ user }) => {
      if (!user) return;
      try {
        const missingChains = getChainsMissingWaasWalletAccounts();
        if (missingChains.length === 0) return;
        await createWaasWalletAccounts({ chains: missingChains });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn("Boxcade could not create an embedded wallet:", message);
      }
    },
  });
  return null;
}
