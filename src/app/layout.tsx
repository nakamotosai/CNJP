import type { Metadata, Viewport } from "next";
import {
  Noto_Sans_SC,
  Noto_Serif_SC,
  Noto_Sans_TC,
  Noto_Serif_TC
} from "next/font/google";
import "./globals.css";
import { Providers } from "../components/Providers";

const notoSansSC = Noto_Sans_SC({
  variable: "--font-noto-sans-sc",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const notoSerifSC = Noto_Serif_SC({
  variable: "--font-noto-serif-sc",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
});

const notoSansTC = Noto_Sans_TC({
  variable: "--font-noto-sans-tc",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const notoSerifTC = Noto_Serif_TC({
  variable: "--font-noto-serif-tc",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "China News from Japan | 从日本看中国",
  description: "100条日媒最新发布的中国新闻聚合",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
      className={`
        ${notoSansSC.variable} ${notoSansSC.className}
        ${notoSerifSC.variable} ${notoSerifSC.className}
        ${notoSansTC.variable} ${notoSansTC.className}
        ${notoSerifTC.variable} ${notoSerifTC.className}
      `}
    >
      <body className="antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}