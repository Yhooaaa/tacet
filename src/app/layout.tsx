import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import { SITE_URL } from "@/lib/legal";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const description =
  "Tacet scans data breaches, the open web, web archives and 7,000+ sites for your email, phone number and usernames, then shows you how to remove them.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Tacet", template: "%s — Tacet" },
  description,
  openGraph: { type: "website", siteName: "Tacet", title: "Tacet — See what the internet knows about you", description, url: "/" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} ${plexMono.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
