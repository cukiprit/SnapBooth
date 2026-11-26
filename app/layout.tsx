import type { Metadata } from "next";
import { Silkscreen, Space_Mono } from "next/font/google";
import "./globals.css";

const silkscreen = Silkscreen({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-pixel",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "SNAPBOOTH // 8-BIT PHOTO TERMINAL",
  description: "Retro neo-brutalist browser photo booth with live filters & grids",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${silkscreen.variable} ${spaceMono.variable}`}>
      <body className="min-h-screen bg-[#fffbeb] font-mono text-zinc-950 antialiased selection:bg-[#facc15] selection:text-zinc-950">
        {children}
      </body>
    </html>
  );
}
