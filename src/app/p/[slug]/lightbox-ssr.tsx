"use client";

import { useRouter } from "next/navigation";
import { Lightbox, type LightboxContent } from "@/components/lightbox/Lightbox";

// To'g'ridan-to'g'ri kirilganda: to'liq SSR sahifa, X yopish tugmasi → galereyaga.
export function LightboxSSR({ content }: { content: LightboxContent }) {
  const router = useRouter();
  return <Lightbox content={content} onClose={() => router.push("/")} overlay={false} />;
}
