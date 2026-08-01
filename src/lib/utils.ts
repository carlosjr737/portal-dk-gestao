import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Junta classes CSS.
 *
 * A versão anterior era um `filter(Boolean).join(" ")`. Resolvia condicional
 * simples, mas não resolvia CONFLITO: `cn("px-4", "px-2")` devolvia as duas, e
 * quem vencia era a ordem no CSS gerado pelo Tailwind, não a ordem escrita
 * aqui. Na prática, passar `className="px-2"` para um componente que já tem
 * `px-4` às vezes pegava e às vezes não.
 *
 * Com `twMerge`, a última classe do mesmo grupo vence — que é o que se espera
 * ao sobrescrever. É isso que torna o `className` dos componentes de UI
 * confiável, e sem isso metade das customizações de página falharia em
 * silêncio.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
