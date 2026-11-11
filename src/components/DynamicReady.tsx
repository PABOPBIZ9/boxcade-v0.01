"use client";

import { createContext, useContext } from "react";

export const DynamicReadyCtx = createContext(false);
export const useDynamicReady = () => useContext(DynamicReadyCtx);
