import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/admin-nav";
import { ProjectRoleManager, SiteManager } from "@/components/admin/system-lists";
import { SystemSettingsForm } from "@/components/admin/settings-form";
import { PageHeader, Section } from "@/components/shared/page-header";
import { requirePagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getAllSettings } from "@/lib/data/admin";
import { getProjectRoles, getSites } from "@/lib/data/master";

export const metadata: Metadata = { title: "System settings" };

function asString(value: unknown, fallback: string) {
  if (typeof value === "string") return value;
  if (value == null) return fallback;
  return String(value);
}

export default async function AdminSettingsPage() {
  const user = await requirePagePermission(PERMISSIONS.admin.settings);
  const [rows, sites, projectRoles] = await Promise.all([getAllSettings(), getSites(true), getProjectRoles(true)]);
  const map: Record<string, unknown> = {};
  for (const r of rows) map[r.key] = r.value;

  // One lead-day list drives every reminder. Fall back to the legacy training-only key.
  const leadDaysRaw = map["reminders.lead_days"] ?? map["reminders.training_due_days"];
  const leadDays = Array.isArray(leadDaysRaw)
    ? [...new Set(leadDaysRaw.map(Number).filter((n) => Number.isFinite(n)))].sort((a, b) => b - a).join(", ")
    : asString(leadDaysRaw, "14, 7");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="System Settings"
        description="Application identity, reminders, site list and project roles."
        crumbs={[{ label: "Admin", href: "/admin" }, { label: "Settings" }]}
      />
      <AdminNav can={(k) => user.can(k)} current="settings" />
      <Section title="General and reminders">
        <SystemSettingsForm
          defaults={{
            appName: asString(map["app.name"], "McMorrow IMS"),
            organisation: asString(map["app.organisation"], "Northwind Labs"),
            reminderFromEmail: asString(map["reminders.from_email"], "no-reply@example.com"),
            equipmentReminderEmail: asString(map["reminders.equipment_email"], "maintenance@example.com"),
            supplierReminderEmail: asString(map["reminders.supplier_email"], "procurement@example.com"),
            reminderLeadDays: leadDays,
          }}
        />
      </Section>
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Site List" description="Sites that can be selected on projects and assigned to assets.">
          <SiteManager sites={sites} />
        </Section>
        <Section title="Project roles" description="Roles a team member can hold on a project.">
          <ProjectRoleManager roles={projectRoles} />
        </Section>
      </div>
    </div>
  );
}
