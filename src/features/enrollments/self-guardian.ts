/**
 * Rótulo do vínculo quando o próprio aluno banca a mensalidade.
 *
 * Mora aqui, e não em `self-guardian-actions.ts`, porque arquivo `"use server"`
 * só pode exportar função async — a constante ficava presa lá dentro e quem
 * precisava dela repetia a string à mão. Rótulo de vínculo repetido em dois
 * lugares é rótulo que um dia diverge, e aí a busca por "Próprio aluno"
 * simplesmente não acha o registro.
 */
export const RELACAO_PROPRIO_ALUNO = "Próprio aluno";
