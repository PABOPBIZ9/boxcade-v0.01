"use client";

import { useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DynamicProvider } from "@dynamic-labs-sdk/react-hooks";
import { dynamicClient, hasDynamicEnv } from "@/lib/dynamicClient";
import { DynamicReadyCtx } from "./DynamicReady";
import { WaasBootstrap } from "./WaasBootstrap";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!hasDynamicEnv || !dynamicClient || !mounted) {
    return <DynamicReadyCtx.Provider value={false}>{children}</DynamicReadyCtx.Provider>;
  }
  return (
    <QueryClientProvider client={queryClient}>
      <DynamicProvider client={dynamicClient}>
        <DynamicReadyCtx.Provider value={true}>
          <WaasBootstrap />
          {children}
        </DynamicReadyCtx.Provider>
      </DynamicProvider>
    </QueryClientProvider>
  );
}
