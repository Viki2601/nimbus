import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display font — available anywhere as `var(--font-display)`.
// Static OTF at weight 400, so only use it where 400 is enough (no synthetic bold).
const nclGasdrifo = localFont({
  src: "../../public/font/NCLGasdrifo-Demo.otf",
  weight: "400",
  display: "swap",
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Nimbot | Nimbus Support",
  description: "Get quick answers and helpful support for your Nimbus workspace.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${nclGasdrifo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}