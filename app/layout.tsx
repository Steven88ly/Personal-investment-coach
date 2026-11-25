import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import "./globals.css";

// Self-hosted (OFL-1.1, licences in app/fonts/): builds never fetch fonts,
// so a bad Google Fonts response can't break a deploy.
const inter = localFont({
  src: "./fonts/inter-latin-wght-normal.woff2",
  variable: "--font-inter",
  display: "swap",
  weight: "100 900",
});
const newsreader = localFont({
  src: "./fonts/newsreader-latin-wght-normal.woff2",
  variable: "--font-newsreader",
  display: "swap",
  weight: "200 800",
});

export const metadata: Metadata = {
  title: "FinCoach",
  description: "Personal investment coach — mock data, educational only.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-CA" className={`${inter.variable} ${newsreader.variable}`}>
      <body>{children}</body>
    </html>
  );
}
