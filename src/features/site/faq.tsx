import { ChevronDown } from "lucide-react";

/**
 * Dúvidas do site público.
 *
 * `<details>` e não estado de React: o acordeão é a única interação da página
 * inteira, e resolvê-lo em HTML mantém a home como server component — zero
 * JavaScript enviado para abrir um parágrafo. É o mesmo padrão já usado em
 * Professores, Salas, Níveis e Modalidades. De quebra, o navegador entrega de
 * graça o que um acordeão feito à mão costuma esquecer: foco, Enter/Espaço,
 * estado anunciado por leitor de tela e busca do Ctrl+F encontrando texto
 * dentro do bloco fechado.
 *
 * TODA RESPOSTA AQUI É VERIFICÁVEL NO PRODUTO. Onde a informação não existe
 * no código nem no material do projeto — prazo de suporte, condição de saída
 * do plano anual —, a resposta diz o que é certo e manda o resto para a
 * conversa, em vez de inventar um número que não sobrevive à primeira
 * reunião.
 *
 * FALTA UMA PERGUNTA DE PROPÓSITO: "a Ale está adequada à LGPD?". Não há no
 * projeto política de privacidade, termos de uso nem contrato de tratamento
 * de dados, e declarar adequação sem esses documentos é afirmação jurídica
 * sem lastro — exatamente o tipo de frase que se paga caro depois. A pergunta
 * entra assim que os documentos existirem.
 */

const DUVIDAS = [
  {
    pergunta: "A Ale funciona para quais tipos de escola?",
    resposta:
      "Para escolas de dança, música e teatro — escolas que trabalham com turmas recorrentes, matrícula por modalidade e mensalidade. As modalidades e os níveis são cadastrados por cada escola, então a estrutura acompanha a grade que a sua já usa em vez de impor uma pronta.",
  },
  {
    pergunta: "Preciso usar o Asaas?",
    resposta:
      "Não. A conta de pagamentos é opcional. Quem prefere continuar recebendo por fora usa o sistema do mesmo jeito: o faturamento e a inadimplência aparecem igual, com a baixa registrada à mão em uma tela própria.",
  },
  {
    pergunta: "O dinheiro das mensalidades passa pela Ale?",
    resposta:
      "Não. A conta de pagamentos é aberta no CNPJ da própria escola, junto ao Asaas. O responsável paga, o valor cai nessa conta e a Ale não entra no caminho do dinheiro em momento nenhum. Não há comissão nossa sobre a mensalidade dos alunos.",
  },
  {
    pergunta: "Como meus dados atuais são importados?",
    resposta:
      "Por planilha. A Ale lê arquivos .xls, .xlsx e .csv com alunos, responsáveis e turmas e, antes de gravar qualquer coisa, mostra um relatório linha a linha: o que vai entrar, o que já existe e o que ficou com dado faltando. Você confere e só então confirma. O relatório pode ser baixado em CSV.",
  },
  {
    pergunta: "Existe implantação ou treinamento?",
    resposta:
      "Não há taxa de implantação: o plano é um preço só, sem cobrança separada para começar. Como a sua base entra e em que ordem é o que a gente combina na demonstração — depende do tamanho da escola e de como os dados estão hoje.",
  },
  {
    pergunta: "Como funciona o suporte?",
    resposta:
      "O canal direto é o WhatsApp — o mesmo número dos botões desta página. Horário de atendimento e prazo de resposta ficam registrados no contrato; vale perguntar na demonstração se atende a rotina da sua escola.",
  },
  {
    pergunta: "Os professores conseguem fazer chamada pelo celular?",
    resposta:
      "Sim. A chamada foi desenhada para o celular do professor, em pé no meio da sala: um dia por vez, alvos de toque grandes e “marcar todos presentes” como primeiro gesto — na maioria das aulas quase todo mundo veio, e é mais rápido desmarcar dois do que marcar dezoito. Quem está faltando demais aparece num alerta antes de desistir.",
  },
  {
    pergunta: "Posso cancelar o serviço?",
    resposta:
      "O plano mensal é cancelado quando você quiser. O plano anual tem o desconto amarrado ao período, e a condição de saída está no contrato — vale ler antes de escolher entre os dois.",
  },
  {
    pergunta: "Posso exportar meus dados?",
    resposta:
      "Em parte, hoje: as métricas da escola saem em Excel, o cálculo de pagamento dos professores sai em xlsx e o relatório de importação sai em CSV. Uma exportação completa da base em um clique ainda não existe como botão no sistema — se isso for requisito da sua escola, diga na demonstração.",
  },
  {
    pergunta: "Como a Ale protege os dados da escola?",
    resposta:
      "O acesso é individual, por login, e o que cada pessoa enxerga depende do perfil: administração, secretaria e professor não veem as mesmas telas — o professor entra na chamada das turmas dele, não no financeiro. As telas mostradas nesta página usam nomes fictícios de propósito: print é público, e nome de aluno é dado pessoal.",
  },
] as const;

export function Faq() {
  return (
    <div className="mt-8 divide-y divide-border border-y border-border">
      {DUVIDAS.map((d) => (
        <details key={d.pergunta} className="group">
          <summary
            /*
              `list-none` + `[&::-webkit-details-marker]:hidden`: o triângulo
              padrão do navegador tem cor, tamanho e alinhamento diferentes em
              cada sistema. Quem indica o estado é o chevron do lucide, que é
              componente e obedece ao traço da interface.
            */
            className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-base font-semibold text-foreground [&::-webkit-details-marker]:hidden"
          >
            {d.pergunta}
            <ChevronDown
              className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <p className="max-w-3xl pb-5 text-base leading-relaxed text-muted-foreground">
            {d.resposta}
          </p>
        </details>
      ))}
    </div>
  );
}
