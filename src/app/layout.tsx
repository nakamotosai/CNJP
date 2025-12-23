import type { Metadata, Viewport } from "next";
// Local font hosting via fontsource - better performance for CN users
import "@fontsource/noto-sans-sc/400.css";
import "@fontsource/noto-sans-sc/500.css";
import "@fontsource/noto-sans-sc/700.css";
import "@fontsource/noto-serif-sc/400.css";
import "@fontsource/noto-serif-sc/500.css";
import "@fontsource/noto-serif-sc/700.css";
import "@fontsource/noto-serif-sc/900.css";
import "@fontsource/noto-sans-tc/400.css";
import "@fontsource/noto-sans-tc/500.css";
import "@fontsource/noto-sans-tc/700.css";
import "@fontsource/noto-serif-tc/400.css";
import "@fontsource/noto-serif-tc/500.css";
import "@fontsource/noto-serif-tc/700.css";
import "@fontsource/noto-serif-tc/900.css";
import "./globals.css";
import { Providers } from "../components/Providers";

export const metadata: Metadata = {
  title: "China News from Japan | 从日本看中国",
  description: "100条日媒最新发布的中国新闻聚合",
  manifest: "/manifest.json",

  // ✅ iOS 桌面标题配置
  appleWebApp: {
    capable: true,
    title: "从日本看中国",
    statusBarStyle: "black-translucent",
  },

  // ✅ iOS 图标配置：直接指向 logo.png
  icons: {
    icon: "/favicon.ico",
    apple: [
      { url: "/logo.png" }, // iPhone 会自动把大图缩放成适合它的大小
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#050608",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning
    >
      <body className="antialiased bg-background text-main">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}