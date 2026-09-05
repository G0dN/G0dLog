import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "一页 YiYe Notes — 把复杂的事，写清楚",
    template: "%s · 一页 YiYe Notes",
  },
  description: "一个关于软件、设计、阅读与生活的公开写作空间。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
