import { DIAS_DE_CARENCIA } from "@/features/plataforma/assinatura-guard";

/**
 * Aviso exibido enquanto a assinatura está vencida mas ainda dentro da
 * carência. O objetivo é a escola não ser pega de surpresa pelo bloqueio.
 */
export function AvisoAssinatura({
  diasDeAtraso,
  vencimento,
}: {
  diasDeAtraso: number;
  vencimento: string | null;
}) {
  const restantes = Math.max(0, DIAS_DE_CARENCIA - diasDeAtraso + 1);

  return (
    <div className="mb-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p className="font-medium">
        Assinatura vencida
        {vencimento ? ` em ${vencimento.split("-").reverse().join("/")}` : ""}.
      </p>
      <p className="mt-0.5 text-amber-800">
        O acesso ao sistema será suspenso em{" "}
        {restantes === 1 ? "1 dia" : `${restantes} dias`} caso o pagamento não
        seja confirmado. Se já pagou, aguarde a confirmação.
      </p>
    </div>
  );
}
