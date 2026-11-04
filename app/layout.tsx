import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RSBUILD | Gestão Financeira",
  description: "Gestão financeira e visão operacional da RSBUILD."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
