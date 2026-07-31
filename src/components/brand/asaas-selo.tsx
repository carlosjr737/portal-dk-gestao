/**
 * Selo "Serviços financeiros ASAAS" — recriação fiel ao Playbook de BaaS (pág. 8),
 * usada como PLACEHOLDER enquanto o Asaas não envia a URL oficial hospedada no CDN
 * dele (baas.asaas.com/selos/...). Antes de ir pra produção, trocar por:
 *
 *   <img src="<URL enviada pelo suporte Asaas>" alt="Selo Banco Asaas" width={160} height={48} />
 *
 * dentro de um <a href="https://asaas.com" target="_blank" rel="noopener noreferrer">.
 */
export function AsaasSelo({ variant = "azul" }: { variant?: "azul" | "preto" | "branco" }) {
  const cores = {
    azul: { bg: "#EEF1FF", fg: "#2B4EFF" },
    preto: { bg: "#F1F1F1", fg: "#0A0A0A" },
    branco: { bg: "#0A0A0A", fg: "#FFFFFF" },
  }[variant];

  return (
    <div
      className="inline-flex items-center gap-2 rounded-md px-3 py-1.5"
      style={{ backgroundColor: cores.bg }}
      title="Placeholder — trocar pela URL oficial do selo Asaas antes de produção"
    >
      <svg width="18" height="20" viewBox="0 0 18 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M9 0L17.5 3.2V9.4C17.5 14.3 13.9 18.5 9 20C4.1 18.5 0.5 14.3 0.5 9.4V3.2L9 0Z"
          fill={cores.fg}
        />
        <text x="9" y="13.5" textAnchor="middle" fontSize="9" fontWeight="700" fill={cores.bg}>
          A
        </text>
      </svg>
      <span className="leading-tight" style={{ color: cores.fg }}>
        <span className="block text-[9px] font-normal">Serviços financeiros</span>
        <span className="block text-xs font-bold tracking-tight">ASAAS</span>
      </span>
    </div>
  );
}
