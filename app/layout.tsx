import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "회복 루틴 트래커",
  description: "과로, 건강 루틴, 가족 시간을 함께 기록하는 모바일 트래커",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "회복 루틴",
  },
  icons: {
    icon: "/icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#25352d",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
