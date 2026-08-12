import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hantverksnav | SaaS för VVS och hantverk",
  description:
    "Modern svensk SaaS-prototyp för hantverksföretag med projekt, arbetsorder, tid, fakturaunderlag och digital fastighetsjournal.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sv">
      <body>{children}</body>
    </html>
  );
}
