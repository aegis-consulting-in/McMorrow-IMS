import type { Metadata } from "next";
import Link from "next/link";
import { BriefcaseIcon, CheckCircle2Icon, PlayIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectGantt } from "@/components/projects/project-gantt";
import { ProjectsViewToggle } from "@/components/projects/projects-view-toggle";
import { DataTable, type Column } from "@/components/shared/data-table";
import { ClearFilters, FilterSelect, ListToolbar, SearchInput, SortSelect } from "@/components/shared/list-toolbar";
import { PageHeader, Section } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { StatCard, StatGrid } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { requireUser } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getProjectStats, listGanttProjects, listProjects } from "@/lib/data/projects";
import { formatDate, humanize } from "@/lib/format";
import { paginationSchema } from "@/lib/validation/common";
import { PROJECT_PRIORITIES, PROJECT_STATUSES } from "@/lib/validation/projects";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage({ searchParams }: PageProps<"/projects">) {
  const user = await requireUser();
  const params = await searchParams;
  const filters = paginationSchema.parse(params);
  const status = typeof params.status === "string" ? params.status : undefined;
  const priority = typeof params.priority === "string" ? params.priority : undefined;
  const isGantt = params.view === "gantt";

  const [list, ganttRows, stats] = await Promise.all([
    isGantt ? Promise.resolve(null) : listProjects({ ...filters, status, priority }),
    isGantt ? listGanttProjects({ ...filters, status, priority }) : Promise.resolve(null),
    getProjectStats(),
  ]);

  type Project = NonNullable<typeof list>["rows"][number];
  const columns: Column<Project>[] = [
    {
      key: "name",
      header: "Project",
      cell: (p) => (
        <div className="min-w-0">
          <Link href={`/projects/${p.id}`} className="font-medium hover:underline">
            {p.name}
          </Link>
          <p className="text-xs text-muted-foreground">{p.code}</p>
        </div>
      ),
    },
    { key: "manager", header: "Manager", cell: (p) => (p.manager ? `${p.manager.first_name} ${p.manager.last_name}` : "—"), hideBelow: "md" },
    { key: "site", header: "Plant location", cell: (p) => p.site?.name ?? "—", hideBelow: "md" },
    { key: "dates", header: "Timeline", cell: (p) => `${formatDate(p.start_date)} → ${formatDate(p.expected_end_date)}`, hideBelow: "lg" },
    { key: "priority", header: "Priority", cell: (p) => <StatusBadge status={p.priority} />, hideBelow: "sm" },
    { key: "status", header: "Status", cell: (p) => <StatusBadge status={p.status} /> },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Project Management"
        description={user.can(PERMISSIONS.project.view) ? "All projects across the organisation." : "Projects you manage or are a member of."}
        crumbs={[{ label: "Projects" }]}
        actions={
          user.can(PERMISSIONS.project.create) ? (
            <Button render={<Link href="/projects/new" />}>
              <PlusIcon /> New project
            </Button>
          ) : null
        }
      />
      <StatGrid className="lg:grid-cols-3">
        <StatCard label="Projects" value={stats.total} icon={BriefcaseIcon} />
        <StatCard label="Active" value={stats.active} icon={PlayIcon} tone="success" />
        <StatCard label="Completed" value={stats.completed} icon={CheckCircle2Icon} />
      </StatGrid>
      <Section>
        <div className="flex flex-col gap-3">
          <ListToolbar>
            <SearchInput placeholder="Search projects…" className="w-full sm:w-72" />
            <FilterSelect param="status" placeholder="All status" options={PROJECT_STATUSES.map((s) => ({ value: s, label: humanize(s) }))} ariaLabel="Status" />
            <FilterSelect param="priority" placeholder="All priorities" options={PROJECT_PRIORITIES.map((p) => ({ value: p, label: humanize(p) }))} ariaLabel="Priority" />
            {!isGantt ? (
              <SortSelect
                options={[
                  { value: "name", label: "Name" },
                  { value: "code", label: "Code" },
                  { value: "start", label: "Start date" },
                  { value: "status", label: "Status" },
                  { value: "priority", label: "Priority" },
                ]}
              />
            ) : null}
            <ClearFilters keys={["q", "status", "priority", "sort", "dir"]} />
            <ProjectsViewToggle className="ml-auto" />
          </ListToolbar>
          {isGantt ? (
            <ProjectGantt projects={ganttRows ?? []} />
          ) : (
            <>
              <DataTable columns={columns} rows={list?.rows ?? []} rowKey={(r) => r.id} emptyTitle="No projects found" />
              <Pagination page={filters.page} pageSize={filters.pageSize} total={list?.total ?? 0} />
            </>
          )}
        </div>
      </Section>
    </div>
  );
}
