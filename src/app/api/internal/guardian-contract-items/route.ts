import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addEnrollmentToGuardianFinancialContract } from "@/features/finance/guardian-contracts/contracts";
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

  const result = await addEnrollmentToGuardianFinancialContract(
    parsed.data.enrollmentId,
  );

  return NextResponse.json(result, {
    status: result.status === "created" ? 200 : 422,
  });
}
