import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O SheetJS 0.20.x publica um mapa de "exports" com build ESM (xlsx.mjs).
  // Empacotado pelo webpack no servidor, o chunk das Server Actions quebra no
  // prerender ("Cannot read properties of undefined (reading 'call')").
  // Mantê-lo externo faz o Node carregar o build CJS direto de node_modules.
  serverExternalPackages: ["xlsx"],
};

export default nextConfig;
