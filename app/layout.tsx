import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OmniPro 220 Technical Support",
  description:
    "AI-powered technical support for the Vulcan OmniPro 220 multiprocess welder",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
