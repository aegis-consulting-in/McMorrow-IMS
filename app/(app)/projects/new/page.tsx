import type { Metadata } from "next";
import { ProjectForm } from "@/components/projects/project-form";
import { PageHeader, Section } from "@/components/shared/page-header";
import { requirePagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getEmployeeOptions, getSites } from "@/lib/data/master";

export const metadata: Metadata = { title: "New project" };

export default async function NewProjectPage() {
  await requirePagePermission(PERMISSIONS.project.create);
  const [employees, sites] = await Promise.all([getEmployeeOptions(), getSites(true)]);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="New project" crumbs={[{ label: "Projects", href: "/projects" }, { label: "New" }]} />
      <Section>
        <ProjectForm employees={employees} sites={sites} />
      </Section>
    </div>
  );
}
