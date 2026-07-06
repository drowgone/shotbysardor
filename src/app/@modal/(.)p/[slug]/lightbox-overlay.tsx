"use client";

import { useRouter } from "next/navigation";
import { Lightbox, type LightboxContent } from "@/components/lightbox/Lightbox";

export function LightboxOverlay({ content }: { content: LightboxContent }) {
  const router = useRouter();
  return <Lightbox content={content} onClose={() => router.back()} overlay />;
}
