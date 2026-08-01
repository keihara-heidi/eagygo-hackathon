import type { Metadata } from "next";
import localFont from "next/font/local";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = localFont({
  src: "./fonts/inter-variable-latin.woff2",
  variable: "--font-inter",
  display: "swap",
  style: "normal",
  weight: "100 900",
});

const booster = localFont({
  src: "./fonts/booster-polygonal-bold.woff2",
  variable: "--font-booster",
  display: "swap",
  style: "normal",
  weight: "700",
});

export const metadata: Metadata = {
  title: "Chat Insights & Engagement",
  description: "Turn live chat into useful insight and meaningful participation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${booster.variable} dark h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
