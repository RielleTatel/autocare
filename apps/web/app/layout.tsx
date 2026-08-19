import type { Metadata } from "next";
import { Barlow_Semi_Condensed, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const display = Barlow_Semi_Condensed({ subsets: ["latin"], weight: ["600"], variable: "--font-display" });
const body = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["500"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "AutoCare+",
  description: "AutoCare+ staff console",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="bg-chassis text-ink font-body antialiased">{children}</body>
    </html>
  );
}
