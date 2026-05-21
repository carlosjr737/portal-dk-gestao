# Portal DK Gestao - Product Spec

## Visao Geral

O Portal DK Gestao e um sistema interno para o DK Studio, uma escola de danca e producao artistica. O objetivo inicial e centralizar a gestao de alunos, responsaveis, turmas, matriculas e ocupacao das turmas, respeitando a operacao artistica do studio.

O produto nao deve seguir a logica de academia tradicional. A estrutura deve priorizar vinculos artisticos, turmas, processos internos, acompanhamento administrativo e qualidade da base de dados.

## Objetivos do MVP

- Cadastrar e consultar alunos.
- Cadastrar e consultar responsaveis.
- Vincular alunos a um ou mais responsaveis.
- Cadastrar turmas.
- Permitir matricula de alunos em multiplas turmas.
- Exibir dashboard de ocupacao das turmas.
- Importar a base atual de dados.
- Gerar relatorio de inconsistencias da base importada.

## Publico Interno

- Gestao do DK Studio.
- Administracao/secretaria.
- Coordenacao pedagogica ou artistica.

## Principios do Produto

- O aluno e o centro da operacao.
- Um aluno pode participar de varias turmas.
- Um responsavel pode estar vinculado a varios alunos.
- Turmas representam organizacao artistica/pedagogica, nao planos de academia.
- A base de dados deve ser auditavel e corrigivel.
- A importacao deve preservar o maximo possivel dos dados originais.

## Escopo do MVP

### Cadastro de Alunos

Campos esperados:

- Nome completo.
- Nome social ou artistico, quando aplicavel.
- Data de nascimento.
- Documento, quando disponivel.
- Telefone.
- E-mail.
- Observacoes internas.
- Status do aluno: ativo, inativo ou em avaliacao.

Funcionalidades:

- Criar aluno.
- Editar aluno.
- Listar alunos.
- Buscar por nome, telefone, e-mail ou documento.
- Visualizar responsaveis vinculados.
- Visualizar turmas em que o aluno esta matriculado.

### Cadastro de Responsaveis

Campos esperados:

- Nome completo.
- Documento, quando disponivel.
- Telefone.
- E-mail.
- Observacoes internas.

Funcionalidades:

- Criar responsavel.
- Editar responsavel.
- Listar responsaveis.
- Buscar por nome, telefone, e-mail ou documento.
- Visualizar alunos vinculados.

### Vinculo Aluno/Responsavel

Regras:

- Um aluno pode ter nenhum, um ou varios responsaveis.
- Um responsavel pode estar vinculado a um ou varios alunos.
- O vinculo deve permitir informar o tipo de relacao, como mae, pai, familiar, responsavel financeiro, responsavel pedagogico ou outro.
- Um vinculo pode ser marcado como principal.

### Cadastro de Turmas

Campos esperados:

- Nome da turma.
- Modalidade ou categoria artistica.
- Professor ou instrutor responsavel, quando aplicavel.
- Dia(s) e horario(s).
- Capacidade maxima.
- Status da turma: ativa, inativa ou em planejamento.
- Observacoes internas.

Funcionalidades:

- Criar turma.
- Editar turma.
- Listar turmas.
- Buscar por nome, modalidade, professor ou status.
- Visualizar ocupacao da turma.
- Visualizar alunos matriculados.

### Matriculas

Regras:

- Um aluno pode estar matriculado em multiplas turmas.
- A matricula pertence ao par aluno/turma.
- A mesma combinacao aluno/turma nao deve ser duplicada quando ativa.
- A matricula deve possuir status: ativa, pausada, encerrada ou em avaliacao.
- Deve ser possivel registrar data de inicio e data de encerramento.

### Dashboard de Ocupacao

Indicadores iniciais:

- Total de alunos ativos.
- Total de turmas ativas.
- Total de matriculas ativas.
- Ocupacao por turma.
- Turmas lotadas.
- Turmas com baixa ocupacao.
- Alunos em multiplas turmas.

Regras de ocupacao:

- Ocupacao visual = matriculas ativas / capacidade maxima da turma.
- A classificacao de performance da turma usa quantidade absoluta de alunos ativos: 0 a 5 = CTI; 6 a 10 = Em recuperacao; 11 a 15 = Em alta; 16 ou mais = Alta performance.
- Apenas matriculas com `status = active` contam para a classificacao de performance.
- Turmas sem capacidade definida ainda podem aparecer com ocupacao visual incompleta, mas capacidade nao define a classificacao de performance.

### Importacao da Base Atual

Objetivos:

- Permitir entrada da base legada em formato estruturado.
- Preservar dados originais para auditoria.
- Normalizar dados essenciais para o novo modelo.
- Identificar registros incompletos, duplicados ou ambiguos.

Formato inicial esperado:

- CSV ou planilha exportada para CSV.
- Mapeamento manual ou semiautomatico de colunas.

Requisitos:

- Registrar data da importacao.
- Registrar arquivo ou lote de origem.
- Registrar linhas importadas.
- Registrar erros e avisos por linha.
- Evitar criacao silenciosa de duplicidades.

### Relatorio de Inconsistencias

Tipos de inconsistencias esperadas:

- Aluno sem nome.
- Responsavel sem nome.
- Aluno menor de idade sem responsavel.
- Telefone invalido ou ausente.
- E-mail invalido.
- Documento duplicado.
- Possivel aluno duplicado por nome/data de nascimento.
- Matricula duplicada.
- Turma sem capacidade maxima.
- Turma sem horario.
- Matricula vinculada a aluno ou turma inexistente.

O relatorio deve permitir:

- Filtrar por tipo de inconsistencia.
- Filtrar por severidade.
- Visualizar registro de origem.
- Marcar inconsistencia como revisada.

## Fora do Escopo Inicial

- Controle financeiro completo.
- Planos, mensalidades e contratos recorrentes.
- Controle de presenca.
- Portal externo para alunos ou responsaveis.
- Automacoes de WhatsApp ou e-mail.
- Aplicativo mobile.
- Gestao de eventos e espetaculos.
- Controle de figurino, ensaios, elenco ou producao artistica avancada.

## Stack Tecnica

- Next.js.
- TypeScript.
- Supabase.
- Tailwind CSS.
- shadcn/ui.

## Requisitos Nao Funcionais

- Interface responsiva para uso em desktop e tablet.
- Dados sensiveis devem respeitar politicas de acesso interno.
- Operacoes criticas devem ter validacao no frontend e no banco.
- O modelo de dados deve permitir auditoria basica de criacao e atualizacao.
- O sistema deve ser simples de operar por equipe nao tecnica.

## Criterios de Sucesso do MVP

- A equipe consegue consultar alunos e responsaveis em uma unica base.
- Alunos podem ser vinculados corretamente a responsaveis.
- Alunos podem ser matriculados em uma ou mais turmas.
- A ocupacao das turmas pode ser visualizada sem planilhas paralelas.
- A base atual pode ser importada com rastreabilidade.
- Inconsistencias da base ficam visiveis para correcao.
