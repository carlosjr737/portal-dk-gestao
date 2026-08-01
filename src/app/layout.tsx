import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

/**
 * Inter, pesos 400/500/600/700 — os quatro que o sistema usa.
 *
 * Antes não havia fonte escolhida: o produto rodava na fonte padrão de cada
 * sistema operacional, então tinha cara diferente no Mac, no Windows e no
 * Android. Não era uma decisão de usar fonte de sistema; era a ausência de
 * decisão.
 *
 * `display: swap` para o texto aparecer na fonte de sistema enquanto a Inter
 * carrega, em vez de a tela ficar em branco — numa escola com internet ruim
 * isso é a diferença entre lento e quebrado.
 */
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Portal DK Gestao",
  description: "Sistema interno de gestao do DK Studio.",
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
