"use client";

import { createContext, useContext } from "react";

const CsrfCtx = createContext<string>("");

export function CsrfProvider({ token, children }: { token: string; children: React.ReactNode }) {
  return <CsrfCtx.Provider value={token}>{children}</CsrfCtx.Provider>;
}

export function useCsrf() {
  return useContext(CsrfCtx);
}
