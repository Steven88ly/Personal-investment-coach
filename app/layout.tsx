import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
  weight: ["400", "600"],
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
