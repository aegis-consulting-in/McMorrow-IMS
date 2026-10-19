import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ProjectForm } from "@/components/projects/project-form";
import { PageHeader, Section } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getEmployeeOptions, getSites } from "@/lib/data/master";
import { getProject } from "@/lib/data/projects";

export const metadata: Metadata = { title: "Edit project" };

export default async function EditProjectPage({ params }: PageProps<"/projects/[id]/edit">) {
  const user = await requireUser();
  const { id } = await params;
  const [project, employees, sites] = await Promise.all([getProject(id), getEmployeeOptions(), getSites(true)]);
  if (!project) notFound();
  const canEdit = user.can(PERMISSIONS.project.edit) || (user.employee && project.manager_id === user.employee.id);
  if (!canEdit) redirect("/unauthorized");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={`Edit ${project.name}`} crumbs={[{ label: "Projects", href: "/projects" }, { label: project.name, href: `/projects/${project.id}` }, { label: "Edit" }]} />
      <Section>
        <ProjectForm project={project} employees={employees} sites={sites} milestones={project.milestones ?? []} />
      </Section>
    </div>
  );
}
