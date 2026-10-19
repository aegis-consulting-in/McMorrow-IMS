import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangleIcon, CheckCircle2Icon, PlusIcon, WrenchIcon } from "lucide-react";
import { AssetDialog } from "@/components/maintenance/asset-dialog";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/shared/data-table";
import { ClearFilters, FilterSelect, ListToolbar, SearchInput, SortSelect } from "@/components/shared/list-toolbar";
import { PageHeader, Section } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { StatCard, StatGrid } from "@/components/shared/stat-card";
import { BooleanBadge, StatusBadge } from "@/components/shared/status-badge";
import { requirePagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getDepartments, getSites } from "@/lib/data/master";
import { getAssetOptions, getMaintenanceStats, listAssets, listMaintenanceRecords } from "@/lib/data/maintenance";
import { formatDate, fullName, humanize, isOverdue } from "@/lib/format";
import { paginationSchema } from "@/lib/validation/common";
import { MAINTENANCE_SOURCES, MAINTENANCE_STATUSES, MAINTENANCE_TYPES } from "@/lib/validation/maintenance";

export const metadata: Metadata = { title: "Preventive Maintenance" };

export default async function MaintenancePage({ searchParams }: PageProps<"/maintenance">) {
  const user = await requirePagePermission(PERMISSIONS.maintenance.view);
  const params = await searchParams;
  const filters = paginationSchema.parse(params);
  const status = typeof params.status === "string" ? params.status : undefined;
  const type = typeof params.type === "string" ? params.type : undefined;
  const source = typeof params.source === "string" ? params.source : undefined;
  const assetId = typeof params.asset === "string" ? params.asset : undefined;
  const tab = params.tab === "assets" ? "assets" : "records";
  const assetStatus = (typeof params.assetStatus === "string" ? params.assetStatus : "active") as "active" | "inactive" | "all";
  const departmentId = typeof params.department === "string" ? params.department : undefined;

  const siteId = typeof params.site === "string" ? params.site : undefined;

  const [stats, departments, sites, records, assets, assetOptions] = await Promise.all([
    getMaintenanceStats(),
    getDepartments(),
    getSites(true),
    tab === "records" ? listMaintenanceRecords({ ...filters, status, type, source, assetId }) : Promise.resolve({ rows: [], total: 0 }),
    tab === "assets" ? listAssets({ ...filters, departmentId, siteId, status: assetStatus }) : Promise.resolve({ rows: [], total: 0 }),
    tab === "records" ? getAssetOptions() : Promise.resolve([]),
  ]);

  type RecordRow = (typeof records.rows)[number];
  const recordColumns: Column<RecordRow>[] = [
    {
      key: "title",
      header: "Record",
      cell: (r) => (
        <div className="min-w-0">
          <Link href={`/maintenance/${r.id}`} className="font-medium hover:underline">
            {r.title}
          </Link>
          <p className="truncate text-xs text-muted-foreground">
            {r.asset ? `${r.asset.asset_code} · ${r.asset.name}` : "—"}
          </p>
        </div>
      ),
    },
    { key: "type", header: "Type", cell: (r) => humanize(r.maintenance_type), hideBelow: "md" },
    { key: "source", header: "Source", cell: (r) => <StatusBadge status={r.source} />, hideBelow: "md" },
    {
      key: "due",
      header: "Due",
      cell: (r) => (
        <span className={isOverdue(r.due_date) && r.status !== "completed" && r.status !== "cancelled" ? "font-medium text-destructive" : undefined}>
          {formatDate(r.due_date)}
        </span>
      ),
      hideBelow: "sm",
    },
    { key: "assignee", header: "Assigned", cell: (r) => fullName(r.assignee), hideBelow: "lg" },
    { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
  ];

  type AssetRow = (typeof assets.rows)[number];
  const assetColumns: Column<AssetRow>[] = [
    {
      key: "name",
      header: "Asset",
      cell: (a) => (
        <div className="min-w-0">
          <p className="font-medium">{a.name}</p>
          <p className="text-xs text-muted-foreground">{a.asset_code}</p>
        </div>
      ),
    },
    { key: "site", header: "Site", cell: (a) => a.site?.name ?? "—", hideBelow: "sm" },
    { key: "location", header: "Location", cell: (a) => a.location ?? "—", hideBelow: "md" },
    { key: "department", header: "Department", cell: (a) => a.department?.name ?? "—", hideBelow: "lg" },
    { key: "active", header: "In service", cell: (a) => <BooleanBadge value={a.is_active} trueLabel="In service" falseLabel="Out of service" />, hideBelow: "sm" },
    {
      key: "actions",
      header: "",
      className: "w-28 text-right",
      cell: (a) =>
        user.can(PERMISSIONS.maintenance.edit) ? (
          <div className="flex justify-end">
            <AssetDialog asset={a} departments={departments} sites={sites} trigger="icon" />
          </div>
        ) : null,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Preventive Maintenance"
        description="Assets, schedules and maintenance records."
        crumbs={[{ label: "Maintenance" }]}
        actions={
          <>
            {user.can(PERMISSIONS.maintenance.create) ? <AssetDialog departments={departments} sites={sites} /> : null}
            {user.can(PERMISSIONS.maintenance.create) ? (
              <Button render={<Link href="/maintenance/new" />}>
                <PlusIcon /> New record
              </Button>
            ) : null}
          </>
        }
      />
      <StatGrid>
        <StatCard label="Assets" value={stats.assets} icon={WrenchIcon} />
        <StatCard label="Open jobs" value={stats.open} icon={WrenchIcon} />
        <StatCard label="Overdue" value={stats.overdue} icon={AlertTriangleIcon} tone={stats.overdue ? "danger" : "default"} />
        <StatCard label="Completed" value={stats.completed} icon={CheckCircle2Icon} tone="success" />
      </StatGrid>

      <div className="flex gap-2">
        <Button variant={tab === "records" ? "default" : "outline"} size="sm" render={<Link href="/maintenance" />}>
          Records
        </Button>
        <Button variant={tab === "assets" ? "default" : "outline"} size="sm" render={<Link href="/maintenance?tab=assets" />}>
          Assets
        </Button>
      </div>

      {tab === "records" ? (
        <Section>
          <div className="flex flex-col gap-3">
            <ListToolbar>
              <SearchInput placeholder="Search records…" className="w-full sm:w-72" />
              <FilterSelect param="status" placeholder="All status" options={MAINTENANCE_STATUSES.map((s) => ({ value: s, label: humanize(s) }))} ariaLabel="Status" />
              <FilterSelect param="type" placeholder="All types" options={MAINTENANCE_TYPES.map((t) => ({ value: t, label: humanize(t) }))} ariaLabel="Type" />
              <FilterSelect param="source" placeholder="All sources" options={MAINTENANCE_SOURCES.map((s) => ({ value: s, label: humanize(s) }))} ariaLabel="Source" />
              {assetOptions.length ? (
                <FilterSelect
                  param="asset"
                  placeholder="All assets"
                  options={assetOptions.map((a) => ({ value: a.id, label: `${a.asset_code} · ${a.name}` }))}
                  ariaLabel="Asset"
                />
              ) : null}
              <SortSelect
                options={[
                  { value: "due", label: "Due date" },
                  { value: "title", label: "Title" },
                  { value: "status", label: "Status" },
                  { value: "scheduled", label: "Scheduled" },
                ]}
              />
              <ClearFilters keys={["q", "status", "type", "source", "asset", "sort", "dir"]} />
            </ListToolbar>
            <DataTable columns={recordColumns} rows={records.rows} rowKey={(r) => r.id} emptyTitle="No maintenance records" emptyDescription="Create an asset, then schedule a job." />
            <Pagination page={filters.page} pageSize={filters.pageSize} total={records.total} />
          </div>
        </Section>
      ) : (
        <Section>
          <div className="flex flex-col gap-3">
            <ListToolbar>
              <SearchInput placeholder="Search assets…" className="w-full sm:w-72" />
              <FilterSelect
                param="assetStatus"
                placeholder="In service"
                options={[
                  { value: "active", label: "In service" },
                  { value: "inactive", label: "Out of service" },
                  { value: "all", label: "All" },
                ]}
                ariaLabel="Asset status"
              />
              <FilterSelect param="department" placeholder="All departments" options={departments.map((d) => ({ value: d.id, label: d.name }))} ariaLabel="Department" />
              <FilterSelect param="site" placeholder="All sites" options={sites.map((s) => ({ value: s.id, label: s.name }))} ariaLabel="Site" />
              <SortSelect
                options={[
                  { value: "name", label: "Name" },
                  { value: "code", label: "Code" },
                  { value: "location", label: "Location" },
                ]}
              />
              <ClearFilters keys={["q", "assetStatus", "department", "site", "sort", "dir"]} />
            </ListToolbar>
            <DataTable columns={assetColumns} rows={assets.rows} rowKey={(r) => r.id} emptyTitle="No assets" emptyDescription="Register equipment that needs preventive maintenance." />
            <Pagination page={filters.page} pageSize={filters.pageSize} total={assets.total} />
          </div>
        </Section>
      )}
    </div>
  );
}
