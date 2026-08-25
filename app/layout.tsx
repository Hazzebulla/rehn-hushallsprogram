import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RVM Husrapport | Husrapport och VVS-data",
  description:
    "Svensk arbetsyta för RVM Husstatus med kunddata, fastigheter, VVS-register, bilder och digital husrapport.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="sv">
      <body>{children}</body>
    </html>
  );
}


