"use client";

import { useLiveRefresh } from "./use-live";

// Server (RSC) sahifa/layoutga qo'shiladigan kichik client komponent.
// Berilgan topic'larga obuna bo'ladi va event kelganda `router.refresh()` chaqiradi
// — natijada RSC qayta render qilinadi va yangilangan props tarqaladi.
//
// Foydalanish: <LiveRefresh topics={["orders","comments"]} /> — hech qanday UI chiqarmaydi.
export function LiveRefresh({ topics }: { topics: string | string[] }) {
  useLiveRefresh(topics);
  return null;
}
