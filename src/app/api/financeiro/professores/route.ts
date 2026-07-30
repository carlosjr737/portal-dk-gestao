import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedUser, getProfileByUserId } from "@/features/auth/session";
import { getTeacherPaymentData } from "@/features/teacher-payments/queries";
import { buildTeacherPaymentsWorkbook } from "@/features/teacher-payments/xlsx";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  const profile = user ? await getProfileByUserId(user.id) : null;
  if (!profile || !["admin", "equipe"].includes(profile.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const month = request.nextUrl.searchParams.get("month") ?? "";
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) {
    return NextResponse.json({ error: "month inválido (use AAAA-MM)" }, { status: 400 });
  }

  const year = Number(m[1]);
  const mon = Number(m[2]);
  const data = await getTeacherPaymentData(year, mon);
  const buffer = await buildTeacherPaymentsWorkbook(data);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="FINANCEIRO-DK-${year}-${String(mon).padStart(2, "0")}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
