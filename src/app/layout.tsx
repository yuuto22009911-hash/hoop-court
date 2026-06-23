import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP, Zen_Maru_Gothic } from "next/font/google";
import "./globals.css";

// 見出し・本文＝Noto Sans JP、ロゴ社名＝Zen Maru Gothic（コーポレートサイトと統一）
const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-sans",
  display: "swap"
});

const zenMaru = Zen_Maru_Gothic({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-logo",
  display: "swap"
});

export const metadata: Metadata = {
  title: "向日葵株式会社 体育館予約",
  description: "向日葵株式会社 バスケ体育館（ハーフコート1面）のコート予約・フリーゴール予約",
  robots: { index: false, follow: false }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#D86A3C"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className={`${notoSansJP.variable} ${zenMaru.variable}`}>
      <body>
        <div className="app-frame">{children}</div>
      </body>
    </html>
  );
}

export const runtime = 'edge';
