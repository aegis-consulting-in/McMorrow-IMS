"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2Icon, UserMinusIcon, UserPlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { ConfirmButton } from "@/components/shared/confirm-dialog";
import { addProjectMemberAction, removeProjectMemberAction } from "@/lib/actions/projects";
import { useAction } from "@/lib/hooks/use-action";

type Member = {
  employee_id: string;
  role_in_project: string | null;
  employee: { id: string; employee_code: string; first_name: string; last_name: string; email: string; job_title: { name: string } | null } | null;
};

export function ProjectMembers({
  projectId,
  members,
  employees,
  projectRoles = [],
  canManage,
}: {
  projectId: string;
  members: Member[];
  employees: { id: string; first_name: string; last_name: string; employee_code: string }[];
  /** Active roles from Admin → System Settings → Project roles. */
  projectRoles?: { id: string; name: string }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState("");
  const [role, setRole] = useState("");
  const memberIds = new Set(members.map((m) => m.employee_id));
  const candidates = employees.filter((e) => !memberIds.has(e.id));

  const { run, isPending } = useAction(addProjectMemberAction, {
    successMessage: "Member added.",
    onSuccess: () => {
      setEmployeeId("");
      setRole("");
      router.refresh();
    },
  });

  const remove = async (id: string) => {
    const res = await removeProjectMemberAction({ projectId, employeeId: id });
    if (res.ok) {
      toast.success("Member removed.");
      router.refresh();
    } else toast.error(res.error);
  };

  return (
    <div className="flex flex-col gap-3">
      {canManage ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (employeeId) void run({ projectId, employeeId, roleInProject: role });
          }}
          className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-2 sm:flex-row"
        >
          <NativeSelect value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="sm:flex-1" aria-label="Employee">
            <option value="">Select an employee…</option>
            {candidates.map((e) => (
              <option key={e.id} value={e.id}>
                {e.first_name} {e.last_name} ({e.employee_code})
              </option>
            ))}
          </NativeSelect>
          {projectRoles.length ? (
            <NativeSelect value={role} onChange={(e) => setRole(e.target.value)} className="sm:w-56" aria-label="Role in project">
              <option value="">Role in project (optional)</option>
              {projectRoles.map((r) => (
                <option key={r.id} value={r.name}>
                  {r.name}
                </option>
              ))}
            </NativeSelect>
          ) : (
            <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role in project (optional)" className="sm:w-56" />
          )}
          <Button type="submit" disabled={!employeeId || isPending}>
            {isPending ? <Loader2Icon className="animate-spin" /> : <UserPlusIcon />} Add
          </Button>
        </form>
      ) : null}

      {members.length ? (
        <ul className="divide-y rounded-lg border text-sm">
          {members.map((m) => (
            <li key={m.employee_id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <Link href={`/employees/${m.employee_id}`} className="block truncate font-medium hover:underline">
                  {m.employee ? `${m.employee.first_name} ${m.employee.last_name}` : "—"}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {[m.role_in_project, m.employee?.job_title?.name, m.employee?.employee_code].filter(Boolean).join(" · ")}
                </p>
              </div>
              {canManage ? (
                <ConfirmButton
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive hover:text-destructive"
                  title="Remove this member?"
                  confirmLabel="Remove"
                  destructive
                  onConfirm={() => remove(m.employee_id)}
                  aria-label="Remove member"
                >
                  <UserMinusIcon />
                </ConfirmButton>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No members yet.</p>
      )}
    </div>
  );
}
