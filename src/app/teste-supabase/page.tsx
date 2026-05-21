"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type StudentTestRow = {
  id: string;
  full_name: string;
  status: string;
  created_at: string;
};

type TestState = {
  data: StudentTestRow[] | null;
  error: string | null;
  isLoading: boolean;
  isCreating: boolean;
  message: string | null;
};

export default function TesteSupabasePage() {
  const [state, setState] = useState<TestState>({
    data: null,
    error: null,
    isLoading: true,
    isCreating: false,
    message: null,
  });

  async function loadStudents() {
    setState((currentState) => ({
      ...currentState,
      error: null,
      isLoading: true,
    }));

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("students")
        .select("id, full_name, status, created_at")
        .limit(10);

      if (error) {
        setState({
          data: null,
          error: error.message,
          isLoading: false,
          isCreating: false,
          message: null,
        });
        return;
      }

      setState((currentState) => ({
        ...currentState,
        data: (data ?? []) as StudentTestRow[],
        error: null,
        isLoading: false,
      }));
    } catch (error) {
      setState({
        data: null,
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao conectar com o Supabase.",
        isLoading: false,
        isCreating: false,
        message: null,
      });
    }
  }

  useEffect(() => {
    loadStudents();
  }, []);

  async function createTestStudent() {
    setState((currentState) => ({
      ...currentState,
      error: null,
      isCreating: true,
      message: null,
    }));

    try {
      const supabase = createClient();
      const payload = {
        full_name: "Aluno Teste",
        status: "active",
      };

      const { error } = await supabase.from("students").insert(payload);

      if (error) {
        setState((currentState) => ({
          ...currentState,
          error: error.message,
          isCreating: false,
          message: null,
        }));
        return;
      }

      setState((currentState) => ({
        ...currentState,
        isCreating: false,
        message: "Aluno teste criado com sucesso.",
      }));
      await loadStudents();
    } catch (error) {
      setState((currentState) => ({
        ...currentState,
        error:
          error instanceof Error
            ? error.message
            : "Erro inesperado ao inserir aluno teste.",
        isCreating: false,
        message: null,
      }));
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-semibold">Teste Supabase</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Consulta os primeiros 10 registros da tabela students e permite criar
          um aluno de teste.
        </p>

        <section className="mt-6 rounded-md border border-border bg-white p-5">
          <button
            type="button"
            onClick={createTestStudent}
            disabled={state.isCreating}
            className="mb-4 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {state.isCreating ? "Criando..." : "Criar aluno teste"}
          </button>

          {state.message ? (
            <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {state.message}
            </div>
          ) : null}

          {state.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : null}

          {state.error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {state.error}
            </div>
          ) : null}

          {!state.isLoading && !state.error ? (
            <pre className="overflow-auto rounded-md bg-muted p-4 text-xs leading-6 text-foreground">
              {JSON.stringify(state.data, null, 2)}
            </pre>
          ) : null}
        </section>
      </div>
    </main>
  );
}
