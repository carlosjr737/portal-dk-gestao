import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Tabela.
 *
 * O portal tem 25 tabelas, todas com a mesma estrutura repetida à mão: uma
 * moldura com `overflow-hidden`, dentro dela um `overflow-x-auto`, e dentro
 * a tabela com largura mínima. Quem copiava às vezes esquecia o
 * `overflow-x-auto`, e a tabela vazava da tela no celular sem poder rolar.
 *
 * `<Table>` já vem com os dois contêineres. `minWidth` continua por tabela,
 * porque depende de quantas colunas ela tem.
 */
type TableProps = React.TableHTMLAttributes<HTMLTableElement> & {
  /** Largura mínima antes de a rolagem horizontal entrar (ex.: "820px"). */
  minWidth?: string;
  /** Classes da moldura externa (para margem, por exemplo). */
  containerClassName?: string;
};

export function Table({
  className,
  containerClassName,
  minWidth,
  style,
  ...props
}: TableProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card",
        containerClassName,
      )}
    >
      <div className="overflow-x-auto">
        <table
          className={cn("w-full border-collapse text-left text-sm", className)}
          style={minWidth ? { minWidth, ...style } : style}
          {...props}
        />
      </div>
    </div>
  );
}

export function TableHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        "bg-muted text-xs uppercase tracking-wide text-muted-foreground",
        // A linha do cabeçalho usa o mesmo <TableRow> das linhas de dados,
        // mas não deve acender ao passar o mouse: não há o que clicar nela.
        "[&_tr:hover]:bg-transparent",
        className,
      )}
      {...props}
    />
  );
}

export function TableBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-border", className)} {...props} />;
}

export function TableRow({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("transition hover:bg-muted/50", className)} {...props} />;
}

export function TableHead({
  className,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("px-4 py-3 font-semibold", className)} {...props} />;
}

export function TableCell({
  className,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-4 py-3", className)} {...props} />;
}

/**
 * Linha de "nenhum resultado".
 *
 * Existe para a tabela vazia não ficar sendo um retângulo mudo — hoje algumas
 * telas simplesmente não desenham linha nenhuma, e quem filtrou não sabe se
 * não há resultado ou se a página quebrou.
 */
export function TableEmpty({
  colSpan,
  children = "Nenhum resultado encontrado.",
}: {
  colSpan: number;
  children?: React.ReactNode;
}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-4 py-8 text-center text-sm text-muted-foreground"
      >
        {children}
      </td>
    </tr>
  );
}
