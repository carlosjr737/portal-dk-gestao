/**
 * Paleta CATEGÓRICA de gráfico — e a distinção importa.
 *
 * Os tons semânticos (`--success`, `--danger`…) dizem se algo está bom ou
 * ruim. Esta paleta não diz nada: ela só precisa que 14 fatias sejam
 * distinguíveis entre si. São problemas diferentes, e usar um no lugar do
 * outro estraga os dois.
 *
 * Aprendi isso quebrando: ao tokenizar os hex do projeto, troquei quatro
 * cores desta lista por `--info` e duas por `--success`. O arquivo continuou
 * compilando, o gráfico continuou desenhando, e quatro níveis diferentes
 * passaram a ter exatamente a mesma cor. Nenhuma ferramenta acusa isso — só
 * olhando.
 *
 * Fica em `lib` e não num componente para haver um lugar só: a regra do
 * sistema é que não existe `#` dentro de `.tsx`, e a definição de uma paleta
 * é justamente a exceção que precisa morar em algum canto.
 *
 * Se for trocar alguma: o requisito é contraste ENTRE vizinhas na lista, não
 * beleza isolada — fatias adjacentes na rosca recebem cores adjacentes aqui.
 */
export const PALETA_CATEGORICA = [
  "#6366f1",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#a855f7",
  "#ec4899",
  "#84cc16",
  "#f97316",
  "#14b8a6",
  "#eab308",
  "#3b82f6",
  "#d946ef",
  "#10b981",
] as const;

/** Cor da fatia `indice`, dando a volta se houver mais fatias que cores. */
export function corCategorica(indice: number) {
  return PALETA_CATEGORICA[indice % PALETA_CATEGORICA.length];
}
