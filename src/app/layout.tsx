import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { PLATFORM_DESCRIPTION, PLATFORM_NAME } from "@/lib/branding";
import "./globals.css";

/*
 * Família única, como manda a direção. `display: swap` para o texto
 * aparecer antes da fonte chegar — num sistema de trabalho, esperar fonte
 * para ler um número é pior que ler o número na fonte errada por 200ms.
 */
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: PLATFORM_NAME,
  description: PLATFORM_DESCRIPTION,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
