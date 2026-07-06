"use client";

import { useEffect, useRef, useState } from "react";
import { decode } from "blurhash";

// Blurhash placeholder + fade-in
export function BlurImage({
  src,
  alt,
  blurhash,
  width,
  height,
  className,
  eager = false,
  sizes,
}: {
  src: string;
  alt: string;
  blurhash: string;
  width: number;
  height: number;
  className?: string;
  eager?: boolean;
  sizes?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!blurhash || !canvasRef.current) return;
    try {
      const px = decode(blurhash, 32, 32);
      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;
      const imageData = ctx.createImageData(32, 32);
      imageData.data.set(px);
      ctx.putImageData(imageData, 0, 0);
    } catch {
      // ignore
    }
  }, [blurhash]);

  // Cache'dan yuklangan rasmlar uchun `onLoad` ishga tushmasligi mumkin —
  // mount paytida `complete` bo'lsa darhol reveal qilamiz.
  // Fallback timeout: 1.2s dan keyin har qanday holatda blur ko'tariladi
  // (video preview 1-2s da ijro etilgani kabi).
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true);
      return;
    }
    const t = setTimeout(() => setLoaded(true), 1200);
    return () => clearTimeout(t);
  }, [src]);

  return (
    <div className={`relative overflow-hidden ${className ?? ""}`} style={{ aspectRatio: `${width} / ${height}` }}>
      <canvas
        ref={canvasRef}
        width={32}
        height={32}
        className="absolute inset-0 w-full h-full"
        style={{ filter: "blur(0)" }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        sizes={sizes}
        onLoad={() => setLoaded(true)}
        onContextMenu={(e) => e.preventDefault()}
        draggable={false}
        className="relative w-full h-full object-cover"
        style={{
          opacity: loaded ? 1 : 0,
          filter: loaded ? "blur(0px)" : "blur(12px)",
          transform: loaded ? "scale(1)" : "scale(1.02)",
          transition:
            "opacity 700ms cubic-bezier(0.22, 1, 0.36, 1), filter 700ms cubic-bezier(0.22, 1, 0.36, 1), transform 900ms cubic-bezier(0.22, 1, 0.36, 1)",
          willChange: "opacity, filter, transform",
        }}
      />
    </div>
  );
}
