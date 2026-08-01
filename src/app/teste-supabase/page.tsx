"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

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

        <Card className="mt-6 p-5">
          <Button
            className="mb-4"
            type="button"
            onClick={createTestStudent}
            disabled={state.isCreating}
          >
            {state.isCreating ? "Criando..." : "Criar aluno teste"}
          </Button>

          {state.message ? (
            <Alert tone="success" className="mb-4">
              {state.message}
            </Alert>
          ) : null}

          {state.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : null}

          {state.error ? (
            <Alert tone="danger">
              {state.error}
            </Alert>
          ) : null}

          {!state.isLoading && !state.error ? (
            <pre className="overflow-auto rounded-md bg-muted p-4 text-xs leading-6 text-foreground">
              {JSON.stringify(state.data, null, 2)}
            </pre>
          ) : null}
        </Card>
      </div>
    </main>
  );
}
