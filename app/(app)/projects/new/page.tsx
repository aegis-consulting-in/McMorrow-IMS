import type { Metadata } from "next";
import { ProjectForm } from "@/components/projects/project-form";
import { PageHeader, Section } from "@/components/shared/page-header";
import { requirePagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getEmployeeOptions, getSites } from "@/lib/data/master";
import { getAssetPickerOptions, getSupplierPickerOptions } from "@/lib/data/projects";

export const metadata: Metadata = { title: "New project" };

export default async function NewProjectPage() {
  await requirePagePermission(PERMISSIONS.project.create);
  const [employees, sites, assets, suppliers] = await Promise.all([
    getEmployeeOptions(),
    getSites(true),
    getAssetPickerOptions(),
    getSupplierPickerOptions(),
  ]);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="New project" crumbs={[{ label: "Projects", href: "/projects" }, { label: "New" }]} />
      <Section>
        <ProjectForm employees={employees} sites={sites} assets={assets} suppliers={suppliers} />
      </Section>
    </div>
  );
}
