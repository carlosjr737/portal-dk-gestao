"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { catalogItemFormSchema } from "@/features/class-catalog/schemas";

export type CatalogActionState = {
  errors?: Record<string, string[]>;
  message?: string;
};

type CatalogTable = "modalities" | "levels";

function catalogFormDataToObject(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    status: String(formData.get("status") ?? "active"),
    sort_order: String(formData.get("sort_order") ?? "0"),
  };
}

async function createCatalogItem(
  table: CatalogTable,
  path: string,
  label: string,
  _previousState: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  const parsed = catalogItemFormSchema.safeParse(
    catalogFormDataToObject(formData),
  );

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      message: "Revise os campos destacados.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from(table).insert(parsed.data);

  if (error) {
    console.error(`${table} insert error:`, error);
    return {
      message: `Não foi possível cadastrar ${label}. Verifique se já existe um cadastro com esse nome.`,
    };
  }

  revalidatePath(path);
  revalidatePath("/turmas");
  revalidatePath("/turmas/novo");

  return {
    message: `${label} cadastrado com sucesso.`,
  };
}

async function updateCatalogItem(
  table: CatalogTable,
  path: string,
  label: string,
  itemId: string,
  _previousState: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  const parsed = catalogItemFormSchema.safeParse(
    catalogFormDataToObject(formData),
  );

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      message: "Revise os campos destacados.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from(table)
    .update(parsed.data)
    .eq("id", itemId);

  if (error) {
    console.error(`${table} update error:`, error);
    return {
      message: `Não foi possível atualizar ${label}. Verifique se já existe um cadastro com esse nome.`,
    };
  }

  revalidatePath(path);
  revalidatePath("/turmas");

  return {
    message: `${label} atualizado com sucesso.`,
  };
}

export const createModality = createCatalogItem.bind(
  null,
  "modalities",
  "/modalidades",
  "a modalidade",
);

export const updateModality = updateCatalogItem.bind(
  null,
  "modalities",
  "/modalidades",
  "a modalidade",
);

export const createLevel = createCatalogItem.bind(
  null,
  "levels",
  "/niveis",
  "o nível",
);

export const updateLevel = updateCatalogItem.bind(
  null,
  "levels",
  "/niveis",
  "o nível",
);
