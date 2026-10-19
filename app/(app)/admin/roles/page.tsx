import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/admin-nav";
import { RoleDialog, RolesAndPermissionsList } from "@/components/admin/role-forms";
import { PageHeader } from "@/components/shared/page-header";
import { requirePagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getRolesWithPermissions } from "@/lib/data/admin";
import { getPermissions } from "@/lib/data/master";

export const metadata: Metadata = { title: "Roles & Permissions" };

export default async function AdminRolesPage() {
  const user = await requirePagePermission(PERMISSIONS.admin.roles);
  const [roles, permissions] = await Promise.all([getRolesWithPermissions(), getPermissions()]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Roles & Permissions"
        description="Create roles and choose the permissions each one grants. Users inherit every permission of their roles. Expand a role to edit its permissions."
        crumbs={[{ label: "Admin", href: "/admin" }, { label: "Roles & Permissions" }]}
        actions={<RoleDialog />}
      />
      <AdminNav can={(k) => user.can(k)} current="roles" />
      <RolesAndPermissionsList roles={roles} permissions={permissions} />
    </div>
  );
}
