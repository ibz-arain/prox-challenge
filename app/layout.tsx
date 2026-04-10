import type { Metadata } from "next";
import { Inter, Syne } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-brand",
  display: "swap",
  weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
  title: "OmniPro",
  description:
    "AI-powered technical support for the Vulcan OmniPro 220 multiprocess welder",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${syne.variable}`}>
      <body className="flex h-dvh flex-col overflow-hidden antialiased text-neutral-200 bg-black leading-relaxed">
        {children}
      </body>
    </html>
  );
}
