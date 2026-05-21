# Portal DK Gestao - Database Schema

## Visao Geral

Banco previsto em Supabase/PostgreSQL. O modelo inicial prioriza cadastro, vinculos, matriculas, importacao e auditoria basica.

Convencoes:

- Chaves primarias com `uuid`.
- Timestamps `created_at` e `updated_at`.
- Exclusao logica quando fizer sentido operacional.
- Campos textuais livres para observacoes internas.
- Validacoes criticas tambem devem existir no banco.

## Entidades Principais

### integration_connections

Armazena conexoes server-side com provedores externos, como a Conta Azul. Esta
tabela contem tokens sensiveis e nao deve ser exposta para client components.

| Campo | Tipo | Obrigatorio | Observacao |
| --- | --- | --- | --- |
| id | uuid | sim | PK |
| provider | text | sim | Identificador unico do provedor, hoje `conta_azul` |
| access_token | text | nao | Token de acesso OAuth, sensivel |
| refresh_token | text | nao | Token de renovacao OAuth, sensivel |
| expires_at | timestamptz | nao | Expiracao calculada a partir de `expires_in` |
| status | text | sim | connected, expired, disconnected |
| created_at | timestamptz | sim | Criacao |
| updated_at | timestamptz | sim | Ultima atualizacao |

Indices e constraints:

- `provider` deve ser unico.
- `idx_integration_connections_status` em `status`.
- `provider` aceita `conta_azul`.
- `status` aceita `connected`, `expired` ou `disconnected`.

Seguranca:

- RLS fica habilitado.
- Em producao, manter a tabela protegida e acessar apenas server-side com
  `SUPABASE_SERVICE_ROLE_KEY`.
- Nao criar policies publicas para `anon`, pois `access_token` e
  `refresh_token` sao segredos.

### students

Representa alunos do DK Studio.

| Campo | Tipo | Obrigatorio | Observacao |
| --- | --- | --- | --- |
| id | uuid | sim | PK |
| full_name | text | sim | Nome completo |
| display_name | text | nao | Nome social ou artistico |
| birth_date | date | nao | Data de nascimento |
| document | text | nao | CPF/RG ou outro documento |
| phone | text | nao | Telefone principal |
| email | text | nao | E-mail principal |
| status | text | sim | active, inactive, evaluation |
| notes | text | nao | Observacoes internas |
| created_at | timestamptz | sim | Criacao |
| updated_at | timestamptz | sim | Ultima atualizacao |

Indices sugeridos:

- `students_full_name_idx` em `full_name`.
- `students_document_idx` em `document`.
- `students_status_idx` em `status`.

Regras:

- `full_name` nao pode ser vazio.
- `status` deve aceitar apenas valores controlados.
- `document` deve ser unico quando preenchido, se a qualidade da base permitir.

### guardians

Representa responsaveis, clientes e/ou pagadores vinculados a alunos.

| Campo | Tipo | Obrigatorio | Observacao |
| --- | --- | --- | --- |
| id | uuid | sim | PK |
| full_name | text | sim | Nome completo |
| document | text | nao | CPF/RG ou outro documento |
| phone | text | nao | Telefone principal |
| email | text | nao | E-mail principal |
| notes | text | nao | Observacoes internas |
| created_at | timestamptz | sim | Criacao |
| updated_at | timestamptz | sim | Ultima atualizacao |

Indices sugeridos:

- `guardians_full_name_idx` em `full_name`.
- `guardians_document_idx` em `document`.

Regras:

- `full_name` nao pode ser vazio.
- `document` deve ser unico quando preenchido, se a qualidade da base permitir.
- Um responsavel pode estar ligado a varios alunos.

### staff_members

Representa professores e equipe interna do DK Studio. Esta entidade e usada para
selecionar o professor principal de uma turma sem depender de texto livre.

| Campo | Tipo | Obrigatorio | Observacao |
| --- | --- | --- | --- |
| id | uuid | sim | PK |
| full_name | text | sim | Nome completo |
| artistic_name | text | nao | Nome artistico ou nome de exibicao |
| email | text | nao | E-mail |
| phone | text | nao | Telefone |
| role | text | sim | professor, coordenador, financeiro, secretaria, admin |
| status | text | sim | active, inactive |
| created_at | timestamptz | sim | Criacao |
| updated_at | timestamptz | sim | Ultima atualizacao |

Indices:

- `idx_staff_members_role` em `role`.
- `idx_staff_members_status` em `status`.
- `idx_staff_members_full_name` em `full_name`.

Regras:

- `full_name` nao pode ser vazio.
- `role` deve aceitar apenas valores controlados.
- `status` deve aceitar apenas valores controlados.

Politicas temporarias de desenvolvimento:

- RLS deve estar habilitado.
- `anon` pode selecionar, inserir, atualizar e excluir durante o desenvolvimento local.
- Essas policies sao temporarias e devem ser substituidas antes de producao.

### modalities

Representa o cadastro controlado de modalidades artisticas usadas nas turmas.
Evita variacoes de texto livre como "Danças Urbanas", "DU" ou "Urbanas".

| Campo | Tipo | Obrigatorio | Observacao |
| --- | --- | --- | --- |
| id | uuid | sim | PK |
| name | text | sim | Nome da modalidade |
| description | text | nao | Descricao interna |
| status | text | sim | active, inactive |
| sort_order | integer | sim | Ordem de exibicao |
| created_at | timestamptz | sim | Criacao |
| updated_at | timestamptz | sim | Ultima atualizacao |

Indices:

- `idx_modalities_status` em `status`.
- `idx_modalities_name` em `name`.
- `idx_modalities_sort_order` em `sort_order`.

Regras:

- `name` nao pode ser vazio.
- `status` deve aceitar apenas `active` ou `inactive`.
- O nome deve ser unico sem diferenciar maiusculas/minusculas.

Politicas temporarias de desenvolvimento:

- RLS deve estar habilitado.
- `anon` pode selecionar, inserir, atualizar e excluir durante o desenvolvimento local.
- Essas policies sao temporarias e devem ser substituidas antes de producao.

### levels

Representa o cadastro controlado de niveis pedagogicos usados nas turmas.

| Campo | Tipo | Obrigatorio | Observacao |
| --- | --- | --- | --- |
| id | uuid | sim | PK |
| name | text | sim | Nome do nivel |
| description | text | nao | Descricao interna |
| status | text | sim | active, inactive |
| sort_order | integer | sim | Ordem de exibicao |
| created_at | timestamptz | sim | Criacao |
| updated_at | timestamptz | sim | Ultima atualizacao |

Indices:

- `idx_levels_status` em `status`.
- `idx_levels_name` em `name`.
- `idx_levels_sort_order` em `sort_order`.

Regras:

- `name` nao pode ser vazio.
- `status` deve aceitar apenas `active` ou `inactive`.
- O nome deve ser unico sem diferenciar maiusculas/minusculas.

Politicas temporarias de desenvolvimento:

- RLS deve estar habilitado.
- `anon` pode selecionar, inserir, atualizar e excluir durante o desenvolvimento local.
- Essas policies sao temporarias e devem ser substituidas antes de producao.

### student_guardians

Tabela de relacionamento entre alunos e responsaveis.

| Campo | Tipo | Obrigatorio | Observacao |
| --- | --- | --- | --- |
| id | uuid | sim | PK |
| student_id | uuid | sim | FK para students |
| guardian_id | uuid | sim | FK para guardians |
| relationship_type | text | nao | Valor legado/controlado do parentesco |
| relationship | text | nao | Parentesco/relacao em texto livre |
| is_primary | boolean | sim | Indica responsavel principal legado |
| is_financial_responsible | boolean | sim | Indica responsavel financeiro daquele aluno |
| is_primary_contact | boolean | sim | Indica contato principal daquele aluno |
| is_emergency_contact | boolean | sim | Indica contato de emergencia |
| notes | text | nao | Observacoes do vinculo |
| created_at | timestamptz | sim | Criacao |
| updated_at | timestamptz | sim | Ultima atualizacao |

Indices sugeridos:

- `student_guardians_student_id_idx` em `student_id`.
- `student_guardians_guardian_id_idx` em `guardian_id`.
- `idx_student_guardians_student_id` em `student_id`.
- `idx_student_guardians_guardian_id` em `guardian_id`.
- `idx_student_guardians_financial` em vinculos financeiros.
- Unico composto em `student_id, guardian_id`.

Regras:

- Um mesmo responsavel nao deve ser vinculado duas vezes ao mesmo aluno.
- Um responsavel pode estar ligado a varios alunos.
- Um aluno pode ter varios responsaveis.
- `is_financial_responsible` indica o responsavel financeiro daquele aluno.
- `is_primary_contact` indica o contato principal daquele aluno.
- Pode existir mais de um responsavel principal apenas se o produto permitir explicitamente; recomendacao inicial: no maximo um principal por aluno.

### classes

Representa turmas do DK Studio.

| Campo | Tipo | Obrigatorio | Observacao |
| --- | --- | --- | --- |
| id | uuid | sim | PK |
| name | text | sim | Nome da turma |
| category | text | nao | Modalidade ou categoria artistica legado |
| level | text | nao | Nivel legado |
| modality_id | uuid | nao | FK para modalities |
| level_id | uuid | nao | FK para levels |
| teacher_id | uuid | nao | FK para staff_members |
| instructor_name | text | nao | Professor/instrutor responsavel |
| schedule_description | text | nao | Texto legivel de dias e horarios |
| capacity | integer | nao | Capacidade maxima |
| status | text | sim | active, inactive, planning |
| notes | text | nao | Observacoes internas |
| created_at | timestamptz | sim | Criacao |
| updated_at | timestamptz | sim | Ultima atualizacao |

Indices sugeridos:

- `classes_name_idx` em `name`.
- `classes_status_idx` em `status`.
- `classes_category_idx` em `category`.
- `classes_teacher_id_idx` em `teacher_id`.
- `idx_classes_modality_id` em `modality_id`.
- `idx_classes_level_id` em `level_id`.

Regras:

- `name` nao pode ser vazio.
- `capacity` deve ser maior que zero quando preenchida.
- `status` deve aceitar apenas valores controlados.
- `teacher_id` referencia `staff_members.id` e representa o professor principal da turma.
- `modality_id` referencia `modalities.id` e e a fonte principal da modalidade.
- `level_id` referencia `levels.id` e e a fonte principal do nivel.

Observacao:

- `schedule_description` permanece apenas por compatibilidade com dados antigos. A agenda operacional deve ser registrada em `class_schedules`.
- `instructor_name` permanece apenas como campo legado temporario. Novas turmas devem usar `teacher_id` como fonte principal do professor.
- `category` e `level` permanecem apenas como campos legados temporarios. Novas turmas devem usar `modality_id` e `level_id` como fontes principais.
- Uma turma pertence a um professor principal. Futuramente, professores auxiliares podem ser modelados em uma tabela propria de relacionamento entre turmas e equipe.

### class_schedules

Representa os horarios estruturados de uma turma.

Relacionamento:

- Uma turma pode ter varios horarios.
- Cada horario pertence a uma unica turma.

| Campo | Tipo | Obrigatorio | Observacao |
| --- | --- | --- | --- |
| id | uuid | sim | PK |
| class_id | uuid | sim | FK para classes |
| weekday | text | sim | segunda, terca, quarta, quinta, sexta, sabado, domingo |
| start_time | time | sim | Horario de inicio |
| end_time | time | sim | Horario de fim |
| room | text | nao | Sala do horario |
| created_at | timestamptz | sim | Criacao |
| updated_at | timestamptz | sim | Ultima atualizacao |

Indices sugeridos:

- `class_schedules_class_id_idx` em `class_id`.
- `class_schedules_weekday_idx` em `weekday`.
- `class_schedules_start_time_idx` em `start_time`.

Regras:

- `weekday` deve aceitar apenas valores controlados.
- `end_time` deve ser maior que `start_time`.
- Ao excluir uma turma, seus horarios devem ser excluidos em cascata.

Politicas temporarias de desenvolvimento:

- RLS deve estar habilitado.
- `anon` pode selecionar, inserir, atualizar e excluir durante o desenvolvimento local.
- Essas policies devem ser substituidas antes de producao.

### enrollments

Representa matriculas de alunos em turmas.

| Campo | Tipo | Obrigatorio | Observacao |
| --- | --- | --- | --- |
| id | uuid | sim | PK |
| student_id | uuid | sim | FK para students |
| class_id | uuid | sim | FK para classes |
| status | text | sim | active, paused, ended, evaluation, cancelled |
| start_date | date | nao | Inicio da vigencia da matricula |
| end_date | date | nao | Fim previsto da vigencia/contrato |
| financial_guardian_id | uuid | nao | FK opcional para guardians |
| monthly_amount | numeric(10,2) | nao | Valor mensal combinado |
| discount_amount | numeric(10,2) | nao | Valor de desconto |
| discount_reason | text | nao | Motivo do desconto |
| cancellation_reason | text | nao | Motivo do cancelamento |
| cancellation_notes | text | nao | Observacao complementar do cancelamento |
| cancelled_at | timestamptz | nao | Data/hora real do cancelamento |
| notes | text | nao | Observacoes internas |
| created_at | timestamptz | sim | Criacao |
| updated_at | timestamptz | sim | Ultima atualizacao |

Indices sugeridos:

- `enrollments_student_id_idx` em `student_id`.
- `enrollments_class_id_idx` em `class_id`.
- `enrollments_status_idx` em `status`.
- `idx_enrollments_financial_guardian_id` em `financial_guardian_id`.
- `idx_enrollments_end_date` em `end_date`.

Regras:

- Um aluno nao deve ter duas matriculas ativas na mesma turma.
- `end_date` nao deve ser anterior a `start_date`.
- `start_date` e `end_date` sao obrigatorios no formulario de nova matricula.
- `end_date` permanece nullable no banco para compatibilidade com dados existentes.
- `financial_guardian_id` referencia `guardians.id` e representa o responsavel financeiro daquela matricula.
- `financial_guardian_id` pode ser nulo no MVP, mas a interface deve destacar matriculas sem responsavel financeiro.
- `monthly_amount` e `discount_amount` devem ser maiores ou iguais a zero quando preenchidos.
- Matriculas ativas contam para ocupacao.
- Cancelar uma matricula nao exclui o registro. O historico permanece com `status = 'cancelled'`, `cancellation_reason` e `cancelled_at`.
- `end_date` permanece como data final prevista/contratual; `cancelled_at` registra a data real do cancelamento.
- `cancellation_reason` deve usar motivo padronizado. `cancellation_notes` armazena complemento opcional, obrigatorio quando o motivo for "Outro".

Politicas temporarias de desenvolvimento:

- RLS deve estar habilitado.
- `anon` pode selecionar, inserir, atualizar e excluir durante o desenvolvimento local.
- Essas policies devem ser substituidas antes de producao.

### enrollment_logs

Registra eventos importantes da matricula para historico operacional e
relatorios de gestao. `enrollments` mantem o estado atual da matricula;
`enrollment_logs` mantem o historico dos eventos. Cancelamentos ficam
registrados para analise de churn e gestao.

| Campo | Tipo | Obrigatorio | Observacao |
| --- | --- | --- | --- |
| id | uuid | sim | PK |
| enrollment_id | uuid | sim | FK para enrollments |
| student_id | uuid | nao | FK para students |
| class_id | uuid | nao | FK para classes |
| event_type | text | sim | enrollment_created, enrollment_cancelled, enrollment_updated, enrollment_reactivated, class_changed |
| reason | text | nao | Motivo do evento |
| notes | text | nao | Observacao complementar |
| previous_status | text | nao | Status anterior |
| new_status | text | nao | Novo status |
| created_at | timestamptz | sim | Data/hora do evento |
| created_by | uuid | nao | Usuario que registrou o evento, quando houver autenticacao |

Indices:

- `idx_enrollment_logs_enrollment_id` em `enrollment_id`.
- `idx_enrollment_logs_student_id` em `student_id`.
- `idx_enrollment_logs_class_id` em `class_id`.
- `idx_enrollment_logs_event_type` em `event_type`.
- `idx_enrollment_logs_created_at` em `created_at`.

Politicas temporarias de desenvolvimento:

- RLS deve estar habilitado.
- `anon` pode selecionar, inserir, atualizar e excluir durante o desenvolvimento local.
- Essas policies devem ser substituidas antes de producao.

## Importacao e Auditoria

### import_batches

Representa um lote de importacao da base atual.

| Campo | Tipo | Obrigatorio | Observacao |
| --- | --- | --- | --- |
| id | uuid | sim | PK |
| source_name | text | nao | Nome do arquivo ou origem |
| source_type | text | sim | csv, spreadsheet, manual |
| status | text | sim | pending, processing, completed, failed |
| total_rows | integer | nao | Total de linhas |
| imported_rows | integer | nao | Linhas importadas |
| failed_rows | integer | nao | Linhas com erro |
| started_at | timestamptz | nao | Inicio do processamento |
| completed_at | timestamptz | nao | Fim do processamento |
| created_at | timestamptz | sim | Criacao |

### import_rows

Preserva dados originais de cada linha importada.

| Campo | Tipo | Obrigatorio | Observacao |
| --- | --- | --- | --- |
| id | uuid | sim | PK |
| import_batch_id | uuid | sim | FK para import_batches |
| row_number | integer | sim | Numero da linha no arquivo |
| raw_data | jsonb | sim | Dados originais |
| normalized_data | jsonb | nao | Dados tratados |
| status | text | sim | pending, imported, skipped, error |
| error_message | text | nao | Erro principal, se houver |
| created_student_id | uuid | nao | FK opcional para students |
| created_guardian_id | uuid | nao | FK opcional para guardians |
| created_class_id | uuid | nao | FK opcional para classes |
| created_enrollment_id | uuid | nao | FK opcional para enrollments |
| created_at | timestamptz | sim | Criacao |

Indices sugeridos:

- `import_rows_import_batch_id_idx` em `import_batch_id`.
- `import_rows_status_idx` em `status`.

### data_inconsistencies

Registra inconsistencias encontradas na base.

| Campo | Tipo | Obrigatorio | Observacao |
| --- | --- | --- | --- |
| id | uuid | sim | PK |
| import_batch_id | uuid | nao | FK para import_batches |
| import_row_id | uuid | nao | FK para import_rows |
| entity_type | text | sim | student, guardian, class, enrollment, relationship |
| entity_id | uuid | nao | ID do registro afetado |
| type | text | sim | Codigo da inconsistencia |
| severity | text | sim | info, warning, critical |
| message | text | sim | Descricao legivel |
| status | text | sim | open, reviewed, resolved, ignored |
| metadata | jsonb | nao | Dados auxiliares |
| created_at | timestamptz | sim | Criacao |
| reviewed_at | timestamptz | nao | Revisao |
| resolved_at | timestamptz | nao | Resolucao |

Indices sugeridos:

- `data_inconsistencies_status_idx` em `status`.
- `data_inconsistencies_type_idx` em `type`.
- `data_inconsistencies_severity_idx` em `severity`.
- `data_inconsistencies_entity_idx` em `entity_type, entity_id`.

## Views Sugeridas

### class_occupancy_view

Exibe ocupacao por turma.

Campos:

- `class_id`
- `class_name`
- `status`
- `capacity`
- `active_enrollments_count`
- `occupancy_rate`
- `is_full`
- `has_missing_capacity`

Regra:

- `active_enrollments_count` considera apenas matriculas com `status = 'active'`.
- `occupancy_rate` deve ser nulo quando `capacity` for nula ou menor/igual a zero.

### student_summary_view

Exibe resumo operacional de alunos.

Campos:

- `student_id`
- `full_name`
- `status`
- `guardians_count`
- `active_enrollments_count`
- `classes_names`

## Politicas de Acesso

Supabase Row Level Security deve ser ativado antes de producao.

Perfis iniciais sugeridos:

- `admin`: acesso total.
- `staff`: acesso operacional a cadastros e matriculas.
- `viewer`: acesso somente leitura a dashboards e consultas.

Para o MVP, as politicas podem ser simples, mas devem impedir acesso publico anonimo aos dados.

## Decisoes Pendentes

- Validacao e formato oficial de documentos.
- Necessidade de responsavel financeiro separado do responsavel pedagogico.
- Modelagem normalizada de horarios de turmas.
- Controle de historico completo de alteracoes.
- Regras de privacidade e retencao de dados.
