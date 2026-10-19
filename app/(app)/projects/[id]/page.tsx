import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MilestoneTasks } from "@/components/projects/milestone-tasks";
import { ProjectDocuments } from "@/components/projects/project-documents";
import { ProjectGantt } from "@/components/projects/project-gantt";
import { ProjectMembers } from "@/components/projects/project-members";
import { ProjectsViewToggle } from "@/components/projects/projects-view-toggle";
import { DetailList } from "@/components/shared/data-table";
import { EntityActions } from "@/components/shared/entity-actions";
import { PageHeader, Section } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { deleteProjectAction } from "@/lib/actions/projects";
import { requireUser } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getEmployeeOptions, getProjectRoles } from "@/lib/data/master";
import { getProject, getProjectAssets, getProjectMembers, getProjectSuppliers, getProjectTasks } from "@/lib/data/projects";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectDetailPage({ params, searchParams }: PageProps<"/projects/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const isGantt = query.view === "gantt";
  const project = await getProject(id);
  if (!project) notFound();

  const isPM = Boolean(user.employee && project.manager_id === user.employee.id);
  const canEdit = user.can(PERMISSIONS.project.edit) || isPM;
  const [members, employees, projectRoles, tasks, projectAssets, projectSuppliers] = await Promise.all([
    getProjectMembers(id),
    canEdit ? getEmployeeOptions() : Promise.resolve([]),
    canEdit ? getProjectRoles() : Promise.resolve([]),
    getProjectTasks(id),
    getProjectAssets(id),
    getProjectSuppliers(id),
  ]);
  const milestones = [...(project.milestones ?? [])].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            {project.name}
            <StatusBadge status={project.status} />
            <StatusBadge status={project.priority} />
          </span>
        }
        description={project.code}
        crumbs={[{ label: "Projects", href: "/projects" }, { label: project.name }]}
        actions={
          <EntityActions
            id={project.id}
            editHref={`/projects/${project.id}/edit`}
            canEdit={canEdit}
            canDelete={user.can(PERMISSIONS.project.delete)}
            deleteAction={deleteProjectAction}
            deleteTitle="Delete this project?"
            deleteDescription="The project will be archived and hidden. Documents and members are kept."
            afterDeleteHref="/projects"
          />
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Section title="Overview" className="lg:col-span-2">
          {project.description ? <p className="mb-4 text-sm whitespace-pre-line">{project.description}</p> : null}
          <DetailList
            items={[
              {
                label: "Project manager",
                value: project.manager ? (
                  <Link href={`/employees/${project.manager.id}`} className="hover:underline">
                    {project.manager.first_name} {project.manager.last_name}
                  </Link>
                ) : (
                  "Unassigned"
                ),
              },
              {
                label: "Plant location",
                value: project.site ? `${project.site.name}${project.site.code ? ` (${project.site.code})` : ""}` : "—",
              },
              { label: "Timeline", value: `${formatDate(project.start_date)} → ${formatDate(project.expected_end_date)}` },
              { label: "Actual end", value: formatDate(project.actual_end_date) },
              { label: "Created", value: formatDateTime(project.created_at) },
              { label: "Updated", value: formatDateTime(project.updated_at) },
              { label: "Notes", value: project.notes ?? "—" },
            ]}
          />
        </Section>
        <Section title="Team" description={`${members.length} member${members.length === 1 ? "" : "s"}`}>
          <ProjectMembers projectId={project.id} members={members} employees={employees} projectRoles={projectRoles} canManage={canEdit} />
        </Section>
      </div>

      <Section
        title="Milestones"
        description={
          milestones.length
            ? `${milestones.length} milestone${milestones.length === 1 ? "" : "s"}`
            : "Start and end dates are tracked per milestone."
        }
        actions={<ProjectsViewToggle />}
      >
        {isGantt ? (
          <ProjectGantt
            variant="project"
            projects={[
              {
                id: project.id,
                name: project.name,
                code: project.code,
                status: project.status,
                start_date: project.start_date,
                expected_end_date: project.expected_end_date,
                milestones,
              },
            ]}
          />
        ) : (
          <MilestoneTasks
            projectId={project.id}
            milestones={milestones}
            tasks={tasks}
            employees={employees}
            canEdit={canEdit}
            currentEmployeeId={user.employee?.id ?? null}
          />
        )}
      </Section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Assets" description="Preventive Maintenance assets used on this project.">
          {projectAssets.length ? (
            <ul className="divide-y rounded-lg border text-sm">
              {projectAssets.map((pa) => (
                <li key={pa.asset_id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {pa.asset ? (
                        user.can(PERMISSIONS.maintenance.view) ? (
                          <Link href={`/maintenance?tab=assets&q=${encodeURIComponent(pa.asset.asset_code)}`} className="hover:underline">
                            {pa.asset.name}
                          </Link>
                        ) : (
                          pa.asset.name
                        )
                      ) : (
                        "Asset"
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[pa.asset?.asset_code, pa.asset?.site?.name].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {pa.asset && !pa.asset.is_active ? <StatusBadge status="inactive" /> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No assets mapped.{canEdit ? " Choose assets when you edit this project." : ""}
            </p>
          )}
        </Section>
        <Section title="Suppliers" description="Suppliers working on this project.">
          {projectSuppliers.length ? (
            <ul className="divide-y rounded-lg border text-sm">
              {projectSuppliers.map((ps) => (
                <li key={ps.supplier_id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {ps.supplier ? (
                        user.can(PERMISSIONS.supplier.view) ? (
                          <Link href={`/suppliers/${ps.supplier.id}`} className="hover:underline">
                            {ps.supplier.name}
                          </Link>
                        ) : (
                          ps.supplier.name
                        )
                      ) : (
                        "Supplier"
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{ps.supplier?.code}</p>
                  </div>
                  {ps.supplier && ps.supplier.status !== "active" ? <StatusBadge status={ps.supplier.status} /> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              No suppliers mapped.{canEdit ? " Choose suppliers when you edit this project." : ""}
            </p>
          )}
        </Section>
      </div>

      <ProjectDocuments
        projectId={project.id}
        milestones={milestones.map((m) => ({ id: m.id, name: m.name, start_date: m.start_date, end_date: m.end_date }))}
      />
    </div>
  );
}
