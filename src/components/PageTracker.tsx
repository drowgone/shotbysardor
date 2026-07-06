"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// Sahifa navigatsiyasini analitikaga yozadi
export function PageTracker() {
  const path = usePathname();
  useEffect(() => {
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
      keepalive: true,
    }).catch(() => {});
  }, [path]);
  return null;
}
