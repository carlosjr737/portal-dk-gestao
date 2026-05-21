# Portal DK Gestao - Roadmap

## Direcao do Produto

O Portal DK Gestao deve evoluir de uma base operacional confiavel para uma plataforma interna de gestao artistica, pedagogica e administrativa do DK Studio.

O MVP deve resolver primeiro organizacao de dados, matriculas e visibilidade de ocupacao. Funcionalidades financeiras, presenca e producao artistica avancada devem ser consideradas depois que a base principal estiver estabilizada.

## Fase 0 - Preparacao

Objetivo: alinhar escopo, dados atuais e criterios de entrega.

Entregas:

- Definicao do modelo inicial de dados.
- Levantamento da base atual.
- Identificacao das colunas existentes na planilha ou sistema legado.
- Definicao dos status permitidos para alunos, turmas e matriculas.
- Definicao de perfis internos de acesso.
- Priorizacao das inconsistencias que bloqueiam o uso do sistema.

Resultado esperado:

- Escopo do MVP fechado.
- Base atual compreendida.
- Riscos de importacao mapeados.

## Fase 1 - Estrutura do MVP

Objetivo: criar a fundacao tecnica e telas principais.

Entregas:

- Projeto Next.js com TypeScript.
- Configuracao de Tailwind CSS e shadcn/ui.
- Projeto Supabase configurado.
- Schema inicial do banco.
- Autenticacao interna basica.
- Layout administrativo base.
- Navegacao principal.

Resultado esperado:

- Aplicacao interna acessivel por usuarios autorizados.
- Banco pronto para receber cadastros do MVP.

## Fase 2 - Cadastros Operacionais

Objetivo: permitir gestao manual da base principal.

Entregas:

- Cadastro de alunos.
- Listagem e busca de alunos.
- Cadastro de responsaveis.
- Listagem e busca de responsaveis.
- Vinculo aluno/responsavel.
- Cadastro de turmas.
- Listagem e busca de turmas.

Resultado esperado:

- Equipe consegue manter alunos, responsaveis e turmas dentro do portal.

## Fase 3 - Matriculas e Ocupacao

Objetivo: organizar alunos em turmas e visualizar capacidade.

Entregas:

- Matricula de aluno em uma turma.
- Matricula de aluno em multiplas turmas.
- Controle de status da matricula.
- Visualizacao de alunos por turma.
- Visualizacao de turmas por aluno.
- Dashboard de ocupacao.
- Indicadores de turmas lotadas e turmas com baixa ocupacao.

Resultado esperado:

- Gestao consegue acompanhar distribuicao de alunos sem depender de planilhas paralelas.

## Fase 4 - Importacao da Base Atual

Objetivo: migrar dados existentes com rastreabilidade.

Entregas:

- Upload ou processamento de CSV.
- Mapeamento de colunas.
- Criacao de lote de importacao.
- Preservacao dos dados originais.
- Normalizacao inicial de alunos, responsaveis, turmas e matriculas.
- Registro de erros por linha.

Resultado esperado:

- Base atual importada para o novo modelo com rastreabilidade.

## Fase 5 - Relatorio de Inconsistencias

Objetivo: tornar problemas da base visiveis e corrigiveis.

Entregas:

- Geracao de inconsistencias durante importacao.
- Tela de listagem de inconsistencias.
- Filtros por tipo, severidade e status.
- Visualizacao do registro de origem.
- Marcacao como revisada, resolvida ou ignorada.
- Indicadores de qualidade da base.

Resultado esperado:

- Equipe consegue corrigir a base de forma progressiva e controlada.

## Pos-MVP

Possiveis evolucoes:

- Controle de presenca.
- Historico de aulas e frequencia.
- Controle financeiro interno.
- Comunicacao com alunos e responsaveis.
- Relatorios pedagogicos ou artisticos.
- Gestao de eventos, espetaculos e ensaios.
- Gestao de elenco e producao.
- Portal externo para responsaveis.
- Exportacao de relatorios.
- Auditoria completa de alteracoes.

## Marcos de Entrega

### Marco 1 - Base Cadastral

Inclui:

- Alunos.
- Responsaveis.
- Vinculos.
- Turmas.

Criterio de aceite:

- Usuario interno consegue cadastrar e consultar dados principais.

### Marco 2 - Matriculas e Dashboard

Inclui:

- Matriculas.
- Multiplas turmas por aluno.
- Ocupacao por turma.

Criterio de aceite:

- Usuario interno consegue entender a ocupacao das turmas pelo portal.

### Marco 3 - Importacao

Inclui:

- Lotes de importacao.
- Linhas importadas.
- Erros de processamento.

Criterio de aceite:

- Base atual pode ser processada sem perda dos dados originais.

### Marco 4 - Qualidade da Base

Inclui:

- Inconsistencias.
- Filtros.
- Revisao e resolucao.

Criterio de aceite:

- Problemas da base importada ficam claros e acompanhaveis.

## Riscos

- Base atual pode conter duplicidades dificeis de resolver automaticamente.
- Dados de responsaveis podem estar misturados aos dados dos alunos.
- Turmas podem estar descritas de forma inconsistente.
- Horarios podem exigir modelagem mais detalhada depois do MVP.
- Regras internas podem variar conforme modalidade, professor ou projeto artistico.

## Prioridade Tecnica

1. Modelagem correta de alunos, responsaveis, turmas e matriculas.
2. Importacao rastreavel da base atual.
3. Relatorio claro de inconsistencias.
4. Interface simples para operacao diaria.
5. Base preparada para evolucoes sem reescrita estrutural.
