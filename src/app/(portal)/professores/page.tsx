import { PageHeader } from "@/components/layout/page-header";
import { createClient } from "@/lib/supabase/server";
import {
  createStaffMember,
  updateStaffMember,
} from "@/features/staff/actions";
import {
  formatStaffRole,
  formatStaffStatus,
  getStaffDisplayName,
} from "@/features/staff/formatters";
import { StaffMemberForm } from "@/features/staff/staff-member-form";
import { TeacherAvatar } from "@/features/staff/teacher-avatar";
import type { StaffMember } from "@/features/staff/types";
import { formatText } from "@/features/students/formatters";

export const dynamic = "force-dynamic";

export default async function ProfessoresPage() {
  const staffMembers = await getStaffMembers();

  return (
    <div>
      <PageHeader
        title="Professores"
        description="Cadastro de professores e equipe interna do DK Studio."
      />

      <section className="mt-6 rounded-md border border-border bg-white p-5">
        <h2 className="text-base font-semibold text-foreground">
          Novo professor/equipe
        </h2>
        <StaffMemberForm
          action={createStaffMember}
          submitLabel="Cadastrar professor/equipe"
        />
      </section>

      <section className="mt-6 overflow-hidden rounded-md border border-border bg-white">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">
            Professores e equipe cadastrados
          </h2>
        </div>

        <div className="divide-y divide-border">
          {staffMembers.length > 0 ? (
            staffMembers.map((staffMember) => {
              const updateStaffMemberWithId = updateStaffMember.bind(
                null,
                staffMember.id,
              );

              return (
                <details key={staffMember.id} className="group">
                  <summary className="grid cursor-pointer gap-3 px-5 py-4 text-sm marker:hidden md:grid-cols-[1.5fr_1fr_1fr_auto] md:items-center">
                    <div className="flex items-center gap-3">
                      <TeacherAvatar
                        name={getStaffDisplayName(staffMember)}
                        photoPath={staffMember.photo_path}
                        size="md"
                      />
                      <div>
                        <p className="font-medium text-foreground">
                          {getStaffDisplayName(staffMember)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {staffMember.artistic_name
                            ? staffMember.full_name
                            : formatText(staffMember.email)}
                        </p>
                      </div>
                    </div>
                    <span className="text-muted-foreground">
                      {formatStaffRole(staffMember.role)}
                    </span>
                    <span className="text-muted-foreground">
                      {formatStaffStatus(staffMember.status)}
                    </span>
                    <span className="text-sm font-medium text-primary group-open:hidden">
                      Editar
                    </span>
                  </summary>
                  <div className="bg-muted/40 px-5 pb-5">
                    <StaffMemberForm
                      action={updateStaffMemberWithId}
                      defaultValues={staffMember}
                      submitLabel="Salvar alterações"
                      compact
                    />
                  </div>
                </details>
              );
            })
          ) : (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              Nenhum professor cadastrado.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

async function getStaffMembers(): Promise<StaffMember[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("staff_members")
      .select(
        "id, full_name, artistic_name, email, phone, photo_path, role, status, created_at, updated_at",
      )
      .order("full_name", { ascending: true });

    if (error) {
      console.error("Staff members list load error:", error.message);
      return [];
    }

    return (data ?? []) as StaffMember[];
  } catch (error) {
    console.error(
      "Staff members list load error:",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}
