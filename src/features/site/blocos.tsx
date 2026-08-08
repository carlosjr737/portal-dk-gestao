import Image from "next/image";

/**
 * Peças de composição do site público.
 *
 * Ficam fora de `page.tsx` porque a home passou a ter treze seções: com tudo
 * num arquivo só, achar a seção de preço virava rolagem de 800 linhas.
 *
 * Nenhuma delas é "componente de UI" no sentido de `src/components/ui` — são
 * arranjos de página, usados uma ou quatro vezes, e por isso moram aqui em
 * `features/site` e não no sistema de componentes.
 */

/**
 * Moldura de captura de tela.
 *
 * A barra de três pontos no topo não é enfeite gratuito: sem ela, um PNG de
 * interface clara sobre fundo claro não se lê como "tela de software", e o
 * visitante passa direto achando que é mais um card. É a menor pista possível
 * — sem simular navegador, sem sombra pesada, sem gradiente.
 *
 * `width`/`height` sempre explícitos e iguais ao arquivo: é o que reserva o
 * espaço antes da imagem chegar e mantém o CLS em zero.
 */
export function Moldura({
  src,
  alt,
  width,
  height,
  priority = false,
  className = "",
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
  className?: string;
}) {
  return (
    <figure
      className={`overflow-hidden rounded-xl border border-border bg-card shadow-sm ${className}`}
    >
      <div
        className="flex items-center gap-1.5 border-b border-border px-4 py-2.5"
        aria-hidden
      >
        <span className="h-2 w-2 rounded-full bg-border" />
        <span className="h-2 w-2 rounded-full bg-border" />
        <span className="h-2 w-2 rounded-full bg-border" />
      </div>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        /*
          `sizes` evita que o celular baixe a versão de 1200px. Sem isto o
          next/image assume 100vw e serve a maior variante para todo mundo.
        */
        sizes="(min-width: 1024px) 560px, 100vw"
        className="h-auto w-full"
      />
    </figure>
  );
}

/**
 * Bloco de benefício: texto de um lado, tela do produto do outro.
 *
 * `inverter` troca os lados a cada bloco. A troca acontece só a partir de
 * `lg`: no celular tudo empilha, e é a ORDEM DO DOM que manda — por isso o
 * texto vem primeiro no markup. Uma versão anterior invertia com
 * `flex-row-reverse`, e no celular a tela aparecia antes do título que a
 * explica.
 */
export function BlocoProduto({
  indice,
  titulo,
  texto,
  imagem,
  inverter = false,
}: {
  indice: number;
  titulo: string;
  texto: string;
  imagem: { src: string; alt: string; width: number; height: number };
  inverter?: boolean;
}) {
  return (
    <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-16">
      <div className={inverter ? "lg:order-2" : undefined}>
        {/*
          O número não é decoração: com quatro blocos alternando lado, ele é a
          única pista de que existe uma sequência e de onde a pessoa está
          dentro dela.
        */}
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold tabular-nums text-primary">
          {indice}
        </span>
        <h3 className="mt-4 text-2xl font-bold leading-snug tracking-tight text-foreground sm:text-3xl">
          {titulo}
        </h3>
        <p className="mt-3 max-w-lg text-base leading-relaxed text-muted-foreground">
          {texto}
        </p>
      </div>

      <Moldura
        {...imagem}
        className={inverter ? "lg:order-1" : undefined}
      />
    </div>
  );
}
