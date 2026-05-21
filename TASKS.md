# Portal DK Gestao - Tasks

## Status

Legenda:

- `[ ]` Pendente.
- `[~]` Em andamento.
- `[x]` Concluido.

## 1. Produto e Regras

- [ ] Validar escopo do MVP com a equipe DK Studio.
- [ ] Confirmar que o sistema nao seguira modelo de academia tradicional.
- [ ] Definir status oficiais de aluno.
- [ ] Definir status oficiais de turma.
- [ ] Definir status oficiais de matricula.
- [ ] Definir tipos de vinculo entre aluno e responsavel.
- [ ] Definir criterio para aluno ativo.
- [ ] Definir criterio para matricula ativa.
- [ ] Definir criterio de turma lotada.
- [ ] Definir criterio de baixa ocupacao.

## 2. Dados Atuais

- [ ] Obter base atual em formato editavel.
- [ ] Identificar origem da base atual.
- [ ] Mapear colunas existentes.
- [ ] Identificar campos de aluno.
- [ ] Identificar campos de responsavel.
- [ ] Identificar campos de turma.
- [ ] Identificar campos de matricula.
- [ ] Levantar exemplos reais de registros inconsistentes.
- [ ] Definir regras de deduplicacao.
- [ ] Definir se documentos serao obrigatorios ou opcionais.

## 3. Banco de Dados

- [ ] Criar tabela `students`.
- [ ] Criar tabela `guardians`.
- [ ] Criar tabela `student_guardians`.
- [ ] Criar tabela `classes`.
- [ ] Criar tabela `enrollments`.
- [ ] Criar tabela `import_batches`.
- [ ] Criar tabela `import_rows`.
- [ ] Criar tabela `data_inconsistencies`.
- [ ] Criar indices principais.
- [ ] Criar constraints de status.
- [ ] Criar constraints de unicidade quando aplicavel.
- [ ] Criar view de ocupacao por turma.
- [ ] Criar view de resumo de aluno.
- [ ] Definir politicas de Row Level Security.

## 4. Fundacao da Aplicacao

- [ ] Criar projeto Next.js com TypeScript.
- [ ] Configurar Tailwind CSS.
- [ ] Configurar shadcn/ui.
- [ ] Configurar cliente Supabase.
- [ ] Configurar variaveis de ambiente.
- [ ] Criar layout administrativo base.
- [ ] Criar navegacao principal.
- [ ] Criar padrao de tabela/listagem.
- [ ] Criar padrao de formulario.
- [ ] Criar padrao de feedback de erro e sucesso.

## 5. Alunos

- [ ] Criar tela de listagem de alunos.
- [ ] Criar busca de alunos.
- [ ] Criar formulario de cadastro de aluno.
- [ ] Criar formulario de edicao de aluno.
- [ ] Criar tela de detalhe do aluno.
- [ ] Exibir responsaveis vinculados no detalhe do aluno.
- [ ] Exibir turmas vinculadas no detalhe do aluno.
- [ ] Validar nome obrigatorio.
- [ ] Validar status do aluno.

## 6. Responsaveis

- [ ] Criar tela de listagem de responsaveis.
- [ ] Criar busca de responsaveis.
- [ ] Criar formulario de cadastro de responsavel.
- [ ] Criar formulario de edicao de responsavel.
- [ ] Criar tela de detalhe do responsavel.
- [ ] Exibir alunos vinculados no detalhe do responsavel.
- [ ] Validar nome obrigatorio.

## 7. Vinculos Aluno/Responsavel

- [ ] Criar acao para vincular responsavel existente a aluno.
- [ ] Criar acao para criar responsavel durante cadastro ou detalhe do aluno.
- [ ] Permitir definir tipo de relacao.
- [ ] Permitir marcar responsavel principal.
- [ ] Impedir duplicidade do mesmo responsavel para o mesmo aluno.
- [ ] Permitir remover ou desativar vinculo.

## 8. Turmas

- [ ] Criar tela de listagem de turmas.
- [ ] Criar busca de turmas.
- [ ] Criar formulario de cadastro de turma.
- [ ] Criar formulario de edicao de turma.
- [ ] Criar tela de detalhe da turma.
- [ ] Exibir alunos matriculados no detalhe da turma.
- [ ] Validar nome obrigatorio.
- [ ] Validar capacidade maior que zero quando preenchida.
- [ ] Validar status da turma.

## 9. Matriculas

- [ ] Criar acao para matricular aluno em turma.
- [ ] Permitir aluno em multiplas turmas.
- [ ] Impedir matricula ativa duplicada no mesmo aluno/turma.
- [ ] Permitir alterar status da matricula.
- [ ] Permitir registrar data de inicio.
- [ ] Permitir registrar data de encerramento.
- [ ] Exibir historico de matriculas do aluno.
- [ ] Exibir matriculas ativas por turma.

## 10. Dashboard de Ocupacao

- [ ] Exibir total de alunos ativos.
- [ ] Exibir total de turmas ativas.
- [ ] Exibir total de matriculas ativas.
- [ ] Exibir ocupacao por turma.
- [ ] Destacar turmas lotadas.
- [ ] Destacar turmas com baixa ocupacao.
- [ ] Destacar turmas sem capacidade definida.
- [ ] Exibir alunos em multiplas turmas.

## 11. Importacao

- [ ] Definir formato inicial aceito para importacao.
- [ ] Criar fluxo de criacao de lote de importacao.
- [ ] Criar leitura de CSV.
- [ ] Criar mapeamento de colunas.
- [ ] Salvar linhas originais em `import_rows`.
- [ ] Normalizar nomes.
- [ ] Normalizar telefones.
- [ ] Normalizar e-mails.
- [ ] Criar alunos a partir da importacao.
- [ ] Criar responsaveis a partir da importacao.
- [ ] Criar turmas a partir da importacao.
- [ ] Criar matriculas a partir da importacao.
- [ ] Registrar erros por linha.
- [ ] Registrar resumo do lote.

## 12. Inconsistencias

- [ ] Criar regras para aluno sem nome.
- [ ] Criar regras para responsavel sem nome.
- [ ] Criar regras para menor de idade sem responsavel.
- [ ] Criar regras para telefone invalido ou ausente.
- [ ] Criar regras para e-mail invalido.
- [ ] Criar regras para documento duplicado.
- [ ] Criar regras para possivel aluno duplicado.
- [ ] Criar regras para matricula duplicada.
- [ ] Criar regras para turma sem capacidade.
- [ ] Criar regras para turma sem horario.
- [ ] Criar tela de relatorio de inconsistencias.
- [ ] Criar filtros por tipo.
- [ ] Criar filtros por severidade.
- [ ] Criar filtros por status.
- [ ] Permitir marcar inconsistencia como revisada.
- [ ] Permitir marcar inconsistencia como resolvida.
- [ ] Permitir ignorar inconsistencia.

## 13. Qualidade e Validacao

- [ ] Criar validacoes compartilhadas entre formulario e banco quando possivel.
- [ ] Testar cadastro de aluno.
- [ ] Testar cadastro de responsavel.
- [ ] Testar vinculo aluno/responsavel.
- [ ] Testar cadastro de turma.
- [ ] Testar matricula em multiplas turmas.
- [ ] Testar calculo de ocupacao.
- [ ] Testar importacao com arquivo valido.
- [ ] Testar importacao com dados incompletos.
- [ ] Testar relatorio de inconsistencias.

## 14. Antes da Entrega do MVP

- [ ] Revisar textos da interface com a equipe.
- [ ] Validar dados importados por amostragem.
- [ ] Validar permissoes de acesso.
- [ ] Validar dashboard com dados reais.
- [ ] Documentar processo de importacao.
- [ ] Documentar principais regras de negocio.
- [ ] Registrar pendencias pos-MVP.
