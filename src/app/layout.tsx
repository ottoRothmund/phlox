import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";

import { AppShell } from "@/components/app-shell";
import { CollectionsProvider } from "@/components/collections-provider";
import { currentUser } from "@/lib/session";
import { siteUrl } from "@/lib/site";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description =
  "Find good GitHub repositories before everyone else. Sort by real growth, not lifetime stars, and filter by size, age, license, and language.";

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: {
    default: "Phlox - Find good repositories early",
    template: "%s | Phlox",
  },
  description,
  applicationName: "Phlox",
  openGraph: {
    type: "website",
    siteName: "Phlox",
    title: "Phlox - Find good repositories early",
    description,
    images: [{ url: "/phlox-logo.png", width: 512, height: 505, alt: "Phlox" }],
  },
  twitter: {
    card: "summary",
    title: "Phlox - Find good repositories early",
    description,
    images: ["/phlox-logo.png"],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f5" },
    { media: "(prefers-color-scheme: dark)", color: "#111110" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await currentUser();
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <Script id="phlox-theme" strategy="beforeInteractive">
          {`try{const saved=localStorage.getItem("phlox-theme");const theme=saved==="light"||saved==="dark"?saved:matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme}catch{}`}
        </Script>
        <CollectionsProvider>
          <AppShell user={user}>{children}</AppShell>
        </CollectionsProvider>
      </body>
    </html>
  );
}
