import type {
  ContractParcela,
  ContractTurma,
  StudentContract,
} from "@/features/contracts/queries";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
function brl(v: number) {
  return currency.format(v ?? 0);
}
function dateBR(iso: string | null) {
  if (!iso) return "____/____/______";
  return iso.split("-").reverse().join("/");
}

// Dados fixos do CONTRATADO (do modelo enviado).
const DK = {
  representanteLegal: "CARLOS ANTONIO DE SOUZA JUNIOR",
  cnpj: "43330929000191",
  enderecoComercial:
    "Av Prof Cristovam do Santos, 43A. Belvedere. Belo Horizonte. MG. CEP: 30320510.",
};

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function ContractView({
  contract,
  emitidoEm,
}: {
  contract: StudentContract;
  emitidoEm: { dia: number; mes: number; ano: number };
}) {
  if (!contract.available) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        Não foi possível montar o contrato: aluno sem matrícula ativa.
      </div>
    );
  }

  const dataExtenso = `BELO HORIZONTE, ${String(emitidoEm.dia).padStart(2, "0")} de ${MESES[emitidoEm.mes - 1]} de ${emitidoEm.ano}.`;

  return (
    <section className="contract-sheet mx-auto max-w-3xl bg-white p-8 text-[12px] leading-relaxed text-black">
      <h1 className="text-center text-sm font-bold uppercase">
        Contrato de prestação de serviços de aula de dança com fundamento no
        Código Civil, Código de Defesa do Consumidor e que será regido pelas
        cláusulas e condições previstas neste instrumento
      </h1>

      <p className="mt-4">
        <strong>CPF:</strong> {contract.guardian?.document ?? "____________"}
      </p>
      <p className="mt-1">
        Para efeitos deste instrumento contratual, doravante serão considerados:
      </p>
      <p>
        <strong>Contratado:</strong> DK Studio
      </p>

      <Clause title="Cláusula Primeira – Das Partes">
        <p>
          <strong>CONTRATANTE / RESPONSÁVEL LEGAL:</strong>{" "}
          {contract.guardian?.fullName ?? "____________"}
        </p>
        <p>
          <strong>Aluno(a):</strong> {contract.student.fullName}
        </p>
        <p>
          <strong>Endereço:</strong>{" "}
          {contract.guardian?.address ?? "________________________________"}
        </p>
        <p>
          <strong>Endereço Comercial:</strong> {DK.enderecoComercial}
        </p>
        <p>
          <strong>REPRESENTANTE LEGAL:</strong> {DK.representanteLegal}
        </p>
        <p>
          <strong>CNPJ:</strong> {DK.cnpj}
        </p>
      </Clause>

      <TurmaTable turmas={contract.turmas} />

      <Clause title="Cláusula Segunda - Do Objeto">
        <p>
          O objeto do presente contrato visa à prestação de serviços de aula de
          dança pelo CONTRATADO ao(a) ALUNO(A), nos termos acima.
        </p>
      </Clause>

      <Clause title="Cláusula Terceira - Do Preço, Condições e Formas de Pagamento">
        <p>
          I - O CONTRATANTE pagará ao CONTRATADO uma matrícula e o valor das
          aulas em mensalidades, vencíveis de acordo com a lista abaixo e
          observadas as disposições previstas neste instrumento.
        </p>
        <ParcelaTable parcelas={contract.payment.parcelas} />
        <p className="mt-2">
          II - A taxa de matrícula será paga como sinal, à vista, como condição
          para concretização e celebração deste contrato.
        </p>
        <p>
          III - Todas as parcelas serão pagas através da plataforma ContaAzul,
          que o CONTRATANTE desde já autoriza emitir em seu nome.
        </p>
        <p>
          V - Após o vencimento, será acrescida ao valor uma multa de 2%, somada
          aos encargos bancários ao dia, até a data do efetivo pagamento.
        </p>
        <p>
          Parágrafo único. O não pagamento da mensalidade acarretará o
          IMPEDIMENTO do aluno nas atividades, bastando um mês em atraso.
        </p>
      </Clause>

      <Clause title="Cláusula Quarta – Do Prazo">
        <p>
          O presente contrato terá início na data de sua assinatura e término ao
          fim de cada matrícula da Cláusula Segunda.
        </p>
      </Clause>

      <Clause title="Cláusula Quinta – Da Desistência">
        <p>
          I – Caso o ALUNO desista das aulas, o CONTRATANTE deverá comunicar ao
          CONTRATADO, por escrito, com antecedência mínima de 30 (trinta) dias.
        </p>
        <p>
          II – Após a comunicação, deverá efetuar o pagamento da mensalidade
          referente ao mês subsequente ao da comunicação.
        </p>
        <p>
          III – A simples infrequência, sem a comunicação, não desobriga o
          CONTRATANTE do pagamento das parcelas vencidas e vincendas.
        </p>
      </Clause>

      <Clause title="Cláusula Sexta - Da Rescisão">
        <p>
          O presente contrato poderá ser rescindido a qualquer tempo, sem ônus
          para as partes, na ocorrência de caso fortuito ou de força maior
          regularmente comprovado.
        </p>
      </Clause>

      <Clause title="Cláusula Sétima – Da Pandemia">
        <p>
          O DK STUDIO cumpre os protocolos de saúde vigentes; o regular
          funcionamento está vinculado às normas dos órgãos competentes, não
          podendo ser responsabilizado por interrupções em razão de agravamento
          pandêmico. As cláusulas serão cumpridas na íntegra.
        </p>
      </Clause>

      <Clause title="Cláusula Oitava - Da Guarda de Objetos">
        <p>
          O DK STUDIO não se responsabiliza por perda, dano, furto ou roubo de
          valores ou bens de alunos ou acompanhantes em suas dependências.
        </p>
      </Clause>

      <Clause title="Cláusula Nona – Dos Direitos Autorais e Uso de Imagem">
        <p>
          O CONTRATANTE autoriza, sem ônus, o uso da imagem do ALUNO para fins
          de identificação, registro de atividades, acervo, uso institucional,
          cultural e social, incluindo redes sociais e eventos do DK STUDIO, com
          alcance global e prazo indeterminado.
        </p>
      </Clause>

      <Clause title="Cláusula Décima – Do Festival Anual">
        <p>
          Ao final de cada ano o DK STUDIO realiza o FESTIVAL ANUAL. Seus custos
          não estão inclusos na matrícula e mensalidades. A participação não é
          obrigatória; o valor pago para custeio não é reembolsável.
        </p>
      </Clause>

      <Clause title="Cláusula Décima Primeira – Da Alteração de Endereço">
        <p>
          O CONTRATANTE se obriga a comunicar ao CONTRATADO sempre que houver
          alteração de seu endereço residencial.
        </p>
      </Clause>

      <Clause title="Cláusula Décima Segunda – Das Disposições Finais">
        <p>
          Em havendo instabilidade econômica com volta de inflação
          significativa, as partes admitem revisão utilizando o índice que
          melhor refletir a evolução dos custos escolares.
        </p>
      </Clause>

      <Clause title="Cláusula Décima Terceira – Do Foro Judicial">
        <p>
          As partes elegem o foro da comarca de Belo Horizonte/MG para dirimir
          quaisquer dúvidas ou litígios decorrentes do presente contrato.
        </p>
      </Clause>

      <p className="mt-6">{dataExtenso}</p>
      <p className="mt-1">
        E, por estarem assim ajustadas, firmam o presente instrumento em 02
        (duas) vias de igual teor e forma, na presença das testemunhas abaixo.
      </p>

      <div className="mt-10 grid grid-cols-2 gap-8 text-center text-[11px]">
        <Signature line={contract.guardian?.fullName ?? "CONTRATANTE"} role="CONTRATANTE" />
        <Signature line={`${DK.representanteLegal} — DK Studio`} role="CONTRATADO" />
      </div>

      <div className="mt-8 grid grid-cols-2 gap-8 text-[11px]">
        <div>
          <p className="font-semibold">TESTEMUNHAS</p>
          <p className="mt-6 border-t border-black pt-1">Nome:</p>
          <p>CPF:</p>
        </div>
        <div>
          <p className="mt-[1.6rem] border-t border-black pt-1">Nome:</p>
          <p>CPF:</p>
        </div>
      </div>
    </section>
  );
}

function Clause({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="clause mt-4">
      <h2 className="text-[12px] font-bold uppercase">{title}</h2>
      <div className="mt-1 space-y-1 text-justify">{children}</div>
    </div>
  );
}

function TurmaTable({ turmas }: { turmas: ContractTurma[] }) {
  return (
    <table className="mt-3 w-full border-collapse text-[10px]">
      <thead>
        <tr className="bg-neutral-100">
          <th className="border border-black px-1 py-1 text-left">Curso / Nível / Professor</th>
          <th className="border border-black px-1 py-1 text-left">Dias e Horário</th>
          <th className="border border-black px-1 py-1 text-left">Início</th>
          <th className="border border-black px-1 py-1 text-left">Término</th>
          <th className="border border-black px-1 py-1 text-left">Matrícula</th>
        </tr>
      </thead>
      <tbody>
        {turmas.map((t, i) => (
          <tr key={i}>
            <td className="border border-black px-1 py-1">
              {t.modalidade} / {t.nivel} — {t.professor}
            </td>
            <td className="border border-black px-1 py-1">{t.diasHorario}</td>
            <td className="border border-black px-1 py-1">{dateBR(t.inicio)}</td>
            <td className="border border-black px-1 py-1">{dateBR(t.termino)}</td>
            <td className="border border-black px-1 py-1">{t.codigo}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ParcelaTable({ parcelas }: { parcelas: ContractParcela[] }) {
  return (
    <table className="mt-2 w-full border-collapse text-[10px]">
      <thead>
        <tr className="bg-neutral-100">
          <th className="border border-black px-1 py-1 text-left">Referente</th>
          <th className="border border-black px-1 py-1 text-left">Vencimento</th>
          <th className="border border-black px-1 py-1 text-right">Valor Bruto</th>
          <th className="border border-black px-1 py-1 text-right">Desconto</th>
          <th className="border border-black px-1 py-1 text-right">Valor a Pagar</th>
        </tr>
      </thead>
      <tbody>
        {parcelas.map((p, i) => (
          <tr key={i}>
            <td className="border border-black px-1 py-1">{p.referente}</td>
            <td className="border border-black px-1 py-1">{p.vencimento ?? "-"}</td>
            <td className="border border-black px-1 py-1 text-right">{brl(p.bruto)}</td>
            <td className="border border-black px-1 py-1 text-right">
              {p.desconto > 0 ? brl(p.desconto) : "-"}
            </td>
            <td className="border border-black px-1 py-1 text-right font-semibold">
              {brl(p.valorPagar)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Signature({ line, role }: { line: string; role: string }) {
  return (
    <div>
      <div className="mt-8 border-t border-black pt-1">{line}</div>
      <p className="text-muted-foreground">{role}</p>
    </div>
  );
}
