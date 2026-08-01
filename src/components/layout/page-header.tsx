import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: string;
  /**
   * Botões da página (Novo, Editar, Voltar, Imprimir...).
   *
   * Existe para o cabeçalho inteiro — título, descrição e ações — ser um
   * componente só. Antes cada página montava a linha na mão, num `div` com
   * `border-b pb-6` em volta do PageHeader, que também trazia a própria borda:
   * duas linhas coladas. Com as ações aqui dentro, a borda tem um dono só.
   */
  actions?: ReactNode;
  /** Classes extras do cabeçalho (ex.: `no-print` na tela de rodízio). */
  className?: string;
};

export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <section
      className={`flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between${
        className ? ` ${className}` : ""
      }`}
    >
      <div>
        {/*
          A sobrancelha "PORTAL DK GESTÃO" saiu daqui: o nome já aparece na
          barra lateral e no topo, então era a terceira vez na mesma tela — e
          ocupava a primeira linha da página, o lugar onde o olho procura em
          que tela está. Quem lê agora encontra "Alunos", não a marca.
        */}
        {/*
          24px/700, um tamanho só. Antes era 24 no celular e 30 no desktop —
          e o 24 do celular empatava exatamente com o número de destaque dos
          cartões de indicador, então dado e título competiam. A direção
          define um valor por papel; o peso 700 é o que separa este nível dos
          demais, não o tamanho.
        */}
        <h1 className="text-2xl font-bold leading-8 tracking-tight text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap gap-2">{actions}</div>
      ) : null}
    </section>
  );
}
