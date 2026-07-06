/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // SSRF himoyasi: next/image optimizer istalgan tashqi hostdan fetch qila oladi.
    // Wildcard `**` — hujumchi ichki metadata endpoint yoki xususiy adminlar hostiga
    // yo'l ko'rsatsa server-side fetch amalga oshadi. Faqat aniq hostlarni yozamiz.
    // Build-time'da R2 CDN URL berilgan bo'lsa, uni ham ro'yxatga qo'shamiz.
    remotePatterns: (() => {
      const patterns = [];
      const cdn = process.env.R2_PUBLIC_CDN_URL;
      if (cdn) {
        try {
          const u = new URL(cdn);
          patterns.push({
            protocol: u.protocol.replace(":", ""),
            hostname: u.hostname,
            pathname: "/**",
          });
        } catch {
          // ignore invalid env
        }
      }
      return patterns;
    })(),
  },
  // tesseract.js worker skripti webpack bundle'iga tushmasligi kerak — aks holda
  // ".next/worker-script/node/index.js" yo'lini topa olmaydi. sharp ham native binding.
  serverExternalPackages: ["tesseract.js", "sharp"],
  experimental: {
    serverActions: { bodySizeLimit: "2gb" },
    // Next 15.5+: middleware default 1MB body limit — upload uchun oshiramiz
    // (matcher orqali middleware /api yo'llarga tegmasa ham).
    middlewareClientMaxBodySize: "2gb",
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          // Admin sahifalari (va login) hech qanday keshda saqlanmasin.
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, private" },
          { key: "Pragma", value: "no-cache" },
          // Ba'zi brauzer funksiyalarini o'chirib qo'yamiz — reklama/analytics injektidan himoya.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
          },
          // Cross-origin izolyatsiya — begona window/iframe'lardan foydalanish oldini oladi.
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
      {
        // Login/logout API'lari ham keshdan tashqarida bo'lsin.
        source: "/api/admin/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, private" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
    ];
  },
};

export default nextConfig;
