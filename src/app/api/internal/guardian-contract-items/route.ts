import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  enrollmentId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Informe enrollmentId válido." },
      { status: 400 },
    );
  }

  console.log("[GUARDIAN CONTRACT RPC] calling", {
    enrollmentId: parsed.data.enrollmentId,
  });

  const { data, error } = await supabase.rpc(
    "ensure_guardian_financial_contract_item",
    {
      p_enrollment_id: parsed.data.enrollmentId,
    },
  );

  if (error) {
    console.error("[GUARDIAN CONTRACT RPC] error", {
      enrollmentId: parsed.data.enrollmentId,
      error,
    });

    return NextResponse.json(
      { status: "failed", error },
      { status: 422 },
    );
  }

  console.log("[GUARDIAN CONTRACT RPC] success", { itemId: data });

  return NextResponse.json({ status: "created", itemId: data });
}
