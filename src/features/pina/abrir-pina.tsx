"use client";

import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

/**
 * Abre o Pina sem espetáculo escolhido — a entrada geral do professor.
 *
 * Irmão do `OpenInPinaButton`, que leva para UM espetáculo a partir da tela
 * dele. Aqui não há espetáculo a apontar: a pessoa vai ver a lista dela.
 * Poderiam ser um componente só com tudo opcional, e aí a assinatura teria
 * três parâmetros que quase nunca vêm juntos — dois botões pequenos se leem
 * melhor que um genérico.
 */
export function AbrirPina({ pinaUrl }: { pinaUrl: string }) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function abrir() {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch("/api/pina/sso-token", { method: "POST" });
      if (!res.ok) {
        const corpo = (await res.json().catch(() => null)) as { error?: string } | null;
        setErro(
          corpo?.error === "firebase_not_configured"
            ? "A integração com o Pina ainda não foi configurada no servidor."
            : corpo?.error === "forbidden"
              ? "Seu acesso ao Pina ainda não foi liberado pela secretaria."
              : "Não foi possível abrir o Pina agora. Tente de novo em instantes.",
        );
        return;
      }

      const { token } = (await res.json()) as { token: string };
      const url = new URL(pinaUrl);
      url.searchParams.set("token", token);

      /*
       * `noopener` não é detalhe: sem ele a aba do Pina recebe uma referência
       * de volta para esta janela e pode navegá-la. O token vai na URL, então
       * a aba aberta é justamente a que não deve ganhar poder sobre a origem.
       */
      window.open(url.toString(), "_blank", "noopener,noreferrer");
    } catch {
      setErro("Não foi possível abrir o Pina agora. Tente de novo em instantes.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button type="button" onClick={abrir} disabled={carregando} size="lg">
        {carregando ? "Abrindo…" : "Abrir o Pina"}
        {!carregando ? <ArrowUpRight className="ml-2 h-4 w-4" /> : null}
      </Button>
      {erro ? <Alert tone="danger">{erro}</Alert> : null}
    </div>
  );
}
