import type { Metadata } from "next";
import "./globals.css";
import "katex/dist/katex.min.css";
import { SITE_DESCRIPTION, SITE_NAME } from "../lib/site-config";

const configuredSiteUrl = process.env.PUBLIC_SITE_URL?.trim();

export const metadata: Metadata = {
  title: {
    default: `${SITE_NAME} — 公开写作与教程`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  ...(configuredSiteUrl ? { metadataBase: new URL(configuredSiteUrl) } : {}),
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  robots: { index: true, follow: true },
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
      <body>{children}<script src="/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js" defer /></body>
    </html>
  );
}
