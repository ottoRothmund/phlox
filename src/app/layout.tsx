import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";

import { AppShell } from "@/components/app-shell";
import { CollectionsProvider } from "@/components/collections-provider";
import { currentUser } from "@/lib/session";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Phlox - Discover remarkable repositories",
    template: "%s | Phlox",
  },
  description:
    "A modern discovery platform for rising, unusual, and useful GitHub repositories.",
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
