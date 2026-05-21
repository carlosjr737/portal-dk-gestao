import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="pt-BR">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
