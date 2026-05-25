import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const url = request.nextUrl.clone();
  url.pathname = "/login";

  if (request.nextUrl.searchParams.get("reason") === "inactive") {
    url.searchParams.set("message", "inactive");
  } else {
    url.searchParams.delete("message");
  }

  return NextResponse.redirect(url);
}
