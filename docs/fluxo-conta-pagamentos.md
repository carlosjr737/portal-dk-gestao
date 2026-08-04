# Fluxo — Criação da conta de pagamentos

Especificação de produto. Segue `docs/identidade-visual.md`.
Mockup: `docs/mockups/conta-pagamentos.html`.

| | |
|---|---|
| Tela | **`/financeiro/conta-pagamentos`** — uma página só |
| Arquivos | `src/features/baas/conta-pagamentos-card.tsx` · `subconta-actions.ts` · `onboarding-actions.ts` |
| Base | documentação Asaas, consultada em ago/2026 |

---

## 00 • O que a API permite e o que não permite

Verificado na documentação, não presumido.

| Etapa | Pelo portal? |
|---|---|
| Criar a subconta (`POST /accounts`) | ✅ |
| Receber `apiKey` e `walletId` | ✅ — **devolvidos uma única vez**, na resposta |
| Configurar webhook | ✅ |
| Listar documentos pendentes (`GET /myAccount/documents`) | ✅ |
| Documento **com** `onboardingUrl` | ❌ pelo portal — **link externo obrigatório** |
| Documento **sem** `onboardingUrl` (selfie, identificação) | ❌ **não tem caminho nenhum** — é o suporte do Asaas |
| Acompanhar status e aprovação | ✅ |

**A resposta curta:** o portal cria a conta e acompanha. **Envio de documento ele não faz, em nenhum dos dois casos.**

**A leitura errada que já custou duas implementações.** "Documento sem `onboardingUrl`" não significa "envie por API". Para selfie e identificação a API responde:

> Esse tipo de documento não pode ser enviado via API. Por favor, entre em contato com o suporte.

E, sem `onboardingUrl`, também não há link. Para esses tipos **não existe caminho self-service nenhum**. Um campo de arquivo ali só entrega uma recusa depois de a pessoa escolher o arquivo e clicar. Foi tentado em `27a35ad` e `5dc63e7`, e revertido em `4ea40eb`.

**Consequência de produto — e é a razão de o fluxo ter três etapas e não quatro.** Documento não é etapa da escola, porque não há o que ela faça. É pendência do Asaas, e o lugar dela é dentro da análise. Uma etapa numerada chamada "Enviar documentos" afirma "esta parte é com você"; como não era, a pessoa ficava procurando um botão que nunca existiu — e quem lia o código concluía que faltava implementar o upload.

### Restrições que precisam de decisão fora do design

**Período de avaliação regulatória.** Máximo de 10 subcontas de titulares diferentes, R$ 2.000,00 em cobranças por subconta, 60 dias a partir da primeira subconta criada. Ao bater qualquer limite, criação e emissão travam até o Asaas concluir o checklist.

Enquanto isso valer, a plataforma comporta 10 escolas cobrando R$ 2 mil cada. **Resolver com o gerente de contas antes de vender para a décima primeira.** Nenhuma tela conserta isso.

**Modo BaaS exige liberação prévia do gerente.** Sem ela, as contas nascem fora da estrutura BaaS — e aí o Asaas manda e-mail direto para a escola, que redefine senha e envia documentos pela interface dele. O portal deixa de ser o dono da jornada. Confirmar que o BaaS está habilitado **antes** de criar qualquer conta em produção.

---

## 01 • O problema do fluxo atual

Um cartão só, com tudo dentro: status, lista de campos faltando, botão de criar, botão de verificar, lista de documentos. Três problemas:

**Não dá para consertar o que falta.** A tela diz "Complete o cadastro da escola" e lista `Razão social · CNPJ · CEP`, mas os campos vivem em outra tela. A pessoa lê o diagnóstico e tem que ir procurar a cura.

**Não há noção de onde se está.** O processo tem quatro fases e duas delas são espera. Sem trilha, a pessoa não sabe se travou, se é com ela, ou se é só demorado.

**Verificar é manual.** `consultarOnboarding` só roda se alguém clicar. Quem sai para enviar documento e volta depois vê a tela velha, e conclui que não funcionou.

---

## 02 • Uma página, três blocos, tudo visível

**Não é wizard.** Nada de trocar de página entre etapas, nada de rota nova por passo. Uma página com três blocos empilhados: o atual aberto, os concluídos colapsados, **os futuros visíveis dizendo o que vão pedir**.

**Três, e não quatro.** A versão anterior tinha "Enviar documentos" como etapa própria entre criar e analisar. Não existe tarefa ali (seção 00), e etapa sem tarefa é promessa falsa. O pedido de documento vive dentro da análise.

```
Conta de pagamentos                                     [ Não iniciada ]
Para cobrar as mensalidades pelo sistema e dar baixa sozinho.

⏱  Leva cerca de 2 minutos.
    Tenha o CNPJ da escola em mãos — é dele que o resto se preenche.

┌─ ①  Dados da escola                            [Você está aqui] ─┐
│    (formulário aberto)                                           │
└──────────────────────────────────────────────────────────────────┘
┌─ ②  Criar a conta                          cerca de 15 segundos ─┐
│    Automático. Criamos a conta, configuramos os avisos e o       │
│    Asaas valida o CNPJ na Receita.                               │
└──────────────────────────────────────────────────────────────────┘
┌─ ③  Análise do Asaas                             até 1 dia útil ─┐
│    O Asaas confere o cadastro. Se ele precisar de algum          │
│    documento, o pedido aparece aqui — e avisamos quando sair.    │
└──────────────────────────────────────────────────────────────────┘

Serviços de pagamento prestados por
Asaas Gestão Financeira Instituição de Pagamento S.A.
```

**Por que fica em `/financeiro/`.** A conta existe para cobrar mensalidade. Todo o resto do dinheiro mora no Financeiro. Jogar isso em Configurações separa em dois menus um assunto só, e é onde a pessoa não procura.

**Cada bloco futuro carrega duas informações:** quanto tempo leva e o que vai ser pedido. É isso que responde "e depois?" sem a pessoa precisar avançar para descobrir.

**"Tenha em mãos" só pede o que o formulário aceita.** Era CNPJ + RG/CNH + selfie, preparo para a etapa que não existia — e que ainda fazia parecer que o portal ia pedir a selfie. Agora é só o CNPJ. Documento, quando o Asaas pede, é assunto dele e é depois.

**Estimativas de tempo só quando forem verdade.** `15 segundos` é a espera obrigatória da API. `até 1 dia útil` é análise humana e precisa ser confirmado com o gerente de contas antes de ir para produção — prometer 5 minutos e levar um dia é pior do que não prometer nada.

**Rodapé regulatório em todas as telas do fluxo.** Texto pequeno, centralizado, com a razão social completa do Asaas. Não é opcional: a Resolução Conjunta 16 exige evidenciar a instituição prestadora em cada ponto de contato.

### Estados do bloco

| Estado | Aparência |
|---|---|
| Concluído | borda normal, marca verde com check, chip `Concluído`, ação `Editar` |
| Atual | **borda de 2px em `--primary`**, chip `Você está aqui`, conteúdo aberto |
| Futuro | borda normal, número em círculo vazado, rótulo em `muted-foreground`, faixa de prévia em `bg-muted/40` |

Um bloco atual por vez. Concluído pode reabrir por `Editar`, mas volta a colapsar ao sair.

## 03 • Etapa 1 — dados da escola, editáveis aqui

Hoje o erro lista o que falta. **A tela passa a mostrar os campos e permitir preencher.**

```
① Dados da escola

  Razão social *          [ DK Online Ltda                      ]
  CNPJ *                  [ 00.000.000/0001-00                  ]
  E-mail *                [ contato@escola.com.br               ]
  Telefone celular *      [ (31) 99999-0000                     ]
  CEP *                   [ 30000-000 ]  ⟳ busca automática
  Logradouro *            [ Rua Exemplo                         ]
  Número *   [ 100 ]      Complemento [ Sala 2 ]
  Bairro *                [ Centro                              ]

  Tipo de empresa *       ( ) MEI   (•) LTDA   ( ) Individual   ( ) Associação
  Data de nascimento *    [ 16/05/1994 ]   ← só para MEI e Individual
  Faturamento mensal *    [ R$ 25.000,00 ]  estimativa, usada na análise

  [ Criar conta de pagamentos ]
```

**Regras:**

- **Não existe formulário paralelo.** Esta tela é uma vista recortada do cadastro da escola, mostrando só os campos que o Asaas exige. Editar aqui é editar `school`. O payload do Asaas é montado a partir dele no momento do envio, nunca guardado à parte.

- **Três campos precisam virar coluna.** `company_type`, `faturamento` e `birthDate` são lidos do `formData` em `subconta-actions.ts:57-58` e nunca persistidos. Se o Asaas recusar, a pessoa redigita — e como só aparecem neste fluxo, ninguém nota que sumiram até tentar de novo. Criar `school.company_type`, `school.faturamento_estimado` e `school.data_nascimento_responsavel`.

- **Salvar no `school` primeiro, chamar o Asaas depois.** Nessa ordem, erro do provedor não custa o formulário: os dados ficam, a pessoa corrige um campo e tenta de novo. Quem abandona no meio deixa o cadastro mais completo do que estava. Na ordem inversa, toda recusa apaga o trabalho.

- **Salvamento no envio, não a cada tecla.** Autosave reescreveria a razão social no meio de uma digitação. Abaixo do formulário, uma linha: `Estes dados também atualizam o cadastro da escola` — senão a pessoa acha que preencheu formulário descartável.

- Link discreto para `/configuracoes/escola`, para quem quiser editar o cadastro inteiro em vez do recorte.

- **CNPJ preenche o resto.** Digitou o CNPJ, busca na Receita e preenche razão social. A pessoa confere, não digita. Enquanto busca, os campos ficam em skeleton — nunca em branco, que parece travado.

- **Máscara enquanto digita** em CNPJ, telefone e CEP. `inputMode="numeric"` nos três, para abrir teclado numérico no celular.

- **Erro embaixo do campo, na hora.** CNPJ inválido aparece ao sair do campo, não depois de clicar em criar.

- **Altura de controle 44px neste fluxo**, não 40px. É o único da plataforma que alguém preenche do celular segurando com uma mão.
- `CEP` busca o resto do endereço. O Asaas identifica a cidade pelo `postalCode`, então errar o CEP contamina o cadastro inteiro.
- **`birthDate` é obrigatório para `MEI` e `INDIVIDUAL`** (pessoa física) e o payload atual não manda. Aparece condicionalmente ao tipo escolhido.
- `Faturamento mensal` leva a nota `estimativa, usada na análise do Asaas` — hoje o campo aparece sem explicação de para que serve.
- O botão fica desabilitado com o motivo ao lado: `Faltam 3 campos obrigatórios`. Nunca habilitado para depois recusar.

---

## 04 • Etapa 2 — criar, e a espera de 15 segundos

A documentação exige aguardar no mínimo 15 segundos entre criar a conta e checar documentos, senão a lista de pendências vem errada.

**Transformar a restrição em feedback honesto em vez de esconder atrás de um spinner:**

```
② Criando a conta

  ✓ Conta criada no Asaas
  ✓ Webhook configurado
  ⟳ Validando o CNPJ na Receita Federal…   ~15 segundos

  Isso costuma levar meia dúzia de segundos. Não feche a página.
```

Três marcas de verdade, na ordem em que acontecem. A terceira é a espera obrigatória, nomeada pelo que ela é.

**Regra crítica de implementação:** a `apiKey` é devolvida **uma única vez**, na resposta da criação. Se a gravação em `school_payment_credentials` falhar depois de a conta existir, a escola fica com subconta órfã e sem credencial — irrecuperável pelo portal. Gravar antes de qualquer outra coisa, e se falhar, mostrar erro com o `accountId` para suporte manual.

---

## 05 • Etapa 3 — análise, pendências e os finais

Um bloco só, com três desfechos e as pendências dentro. Espera sem ação é o caso normal, e a tela precisa dizer isso com todas as letras — senão a pessoa fica procurando o que fazer.

```
③ Em análise

  A conta foi criada e o Asaas está conferindo o cadastro.
  Você é avisado aqui quando sair o resultado.

  O Asaas precisa de:
  ┌──────────────────────────────────────────────────────────┐
  │ ○ Foto do documento de identificação   [ Abrir no Asaas ↗]│  <- tem onboardingUrl
  │ ○ Selfie                        o Asaas trata direto com você│  <- não tem
  │ ✓ Ata de eleição                                   aprovado │
  └──────────────────────────────────────────────────────────┘

  acc_000…                                 [ Verificar novamente ]
```

**Regras:**

- **A lista de documentos NÃO é uma etapa.** É pendência do provedor dentro da análise. Ver seção 00 para o porquê — e para as duas implementações que essa distinção já custou.
- **Documento com `onboardingUrl`** → botão externo com ícone de saída. **Sem `onboardingUrl`** → texto dizendo que o Asaas trata direto. **Nunca um campo de arquivo**, em nenhum dos dois casos.
- **A explicação da saída só aparece quando existe saída.** A caixa "o envio acontece numa página do Asaas" só faz sentido se algum documento tiver link; sem isso, ela descreve uma página que nunca abre.
- `Ata de eleição` só aparece para `ASSOCIATION`.
- **Conta aprovada ou revogada não lista pendência.** Nos dois casos a lista só ocuparia espaço com informação que não muda mais nada.
- **Reconsultar ao voltar:** revalidar na volta do foco da janela, com limite de uma consulta a cada 30 segundos. Quem sai para resolver documento e volta não pode encontrar a tela velha.
- `Verificar novamente` continua existindo como saída manual.

| Resultado | Tela |
|---|---|
| **Em análise** | texto de espera + pendências, se houver |
| **Aprovada** | selo `success`, e o próximo passo real: `Ativar cobrança pelo sistema →` levando à conciliação |
| **Recusada** | selo `danger` com o motivo do Asaas **literal**, e o caminho de correção |
| **Revogada** | selo `danger`, sem oferta de "criar outra" — ver seção 07 |

Recusa nunca aparece só como "recusada". Sem o motivo, a pessoa abre chamado — e você vira o suporte do Asaas.

---

## 06 • Onde o status vive depois

Criada a conta, este fluxo some e vira uma linha no `/configuracoes/escola`:

```
Conta de pagamentos    ● Aprovada · Asaas          [ Ver detalhes ]
```

Enquanto **não** estiver aprovada, o estado aparece também no topo do Financeiro — é o que bloqueia a cobrança automática, e esconder isso num submenu de configuração faz a pessoa procurar bug onde não tem.

---

## 07 • Estados de erro

| Situação | O que mostrar |
|---|---|
| CNPJ recusado na Receita | mensagem do Asaas literal + link para corrigir o cadastro |
| Conta já existe | `Esta escola já tem conta criada` + status atual, **sem botão de criar** |
| Limite do período de avaliação | `O provedor limitou temporariamente novas contas` + orientação de contato. Não expor a regra dos 10/R$ 2 mil para a escola cliente — é assunto entre a plataforma e o Asaas |
| Falha ao gravar a credencial | erro grave, com `accountId` visível e instrução de acionar o suporte. **Nunca oferecer "tentar de novo"** — criaria uma segunda subconta |

---

## 08 • Critério de pronto

- [ ] Campos obrigatórios são editáveis na própria tela e escrevem em `school` — sem armazenamento paralelo
- [ ] `company_type`, `faturamento` e `birthDate` persistidos: recusa do Asaas não faz ninguém redigitar
- [ ] `school` é gravado antes da chamada ao Asaas, nunca depois
- [ ] `birthDate` enviado para `MEI` e `INDIVIDUAL`
- [ ] Botão desabilitado mostra o motivo
- [ ] A espera de 15s é nomeada, não escondida em spinner
- [ ] `apiKey` gravada antes de qualquer chamada seguinte
- [ ] Falha de gravação nunca oferece "tentar de novo"
- [ ] A saída para o Asaas é explicada antes do botão, **e só existe quando há botão**
- [ ] **Nenhum campo de arquivo em lugar nenhum do fluxo** — não há documento enviável pelo portal
- [ ] Documento sem `onboardingUrl` mostra que o Asaas trata direto, e não um upload
- [ ] Volta do foco reconsulta o status, com limite de 1 a cada 30s
- [ ] Recusa mostra o motivo do provedor, literal
- [ ] Enquanto não aprovada, o estado aparece no topo do Financeiro
- [ ] Nenhuma tela expõe os limites do período de avaliação ao cliente final
- [ ] Uma página só — nenhuma etapa em rota separada
- [ ] **Três etapas.** Nenhuma etapa numerada sem tarefa da escola dentro
- [ ] Etapas futuras visíveis, dizendo tempo e o que vão pedir
- [ ] "Tenha em mãos" antes do primeiro campo, pedindo só o que o formulário aceita
- [ ] Rodapé com a razão social do Asaas em todas as telas do fluxo
- [ ] Nenhuma estimativa de tempo sem base — `até 1 dia útil` confirmado com o gerente
- [ ] Controles com 44px de altura; teclado numérico em CNPJ, telefone e CEP
