import type { StatusMensalidade } from "@/features/mensalidades/types";
import { Badge, type BadgeProps } from "@/components/ui/badge";

const rotulos: Record<StatusMensalidade, string> = {
  pago: "Pago",
  pendente: "Pendente",
  atrasado: "Atrasado",
  cancelado: "Cancelado",
  estornado: "Estornado",
};

/*
 * Os tons vêm do <Badge> e são nomeados pelo SIGNIFICADO, não pela cor. Pago é
 * o mesmo verde de "Ativo" na ficha do aluno e de "Em dia" na lista de
 * matrículas — é isso que faz a pessoa ler a cor sem precisar ler o texto.
 *
 * Estornado fica em `warning`, e não em `danger`: dinheiro devolvido é um fato
 * a conferir, não uma dívida. Vermelho aqui competiria com o atraso, que é a
 * única linha em que alguém precisa agir hoje.
 */
const tons: Record<StatusMensalidade, NonNullable<BadgeProps["tone"]>> = {
  pago: "success",
  pendente: "warning",
  atrasado: "danger",
  cancelado: "neutral",
  estornado: "warning",
};

export function StatusMensalidadeBadge({
  status,
}: {
  status: StatusMensalidade;
}) {
  return <Badge tone={tons[status]}>{rotulos[status]}</Badge>;
}
