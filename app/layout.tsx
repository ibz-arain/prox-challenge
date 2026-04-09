import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TARA — OmniPro 220 Support",
  description:
    "AI-powered technical support for the Vulcan OmniPro 220 multiprocess welder",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased text-neutral-200 bg-black leading-relaxed">
        {children}
      </body>
    </html>
  );
}
