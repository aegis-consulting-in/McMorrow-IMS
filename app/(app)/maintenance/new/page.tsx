import type { Metadata } from "next";
import { MaintenanceRecordForm } from "@/components/maintenance/record-form";
import { PageHeader, Section } from "@/components/shared/page-header";
import { requirePagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { AssetDialog } from "@/components/maintenance/asset-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { getDepartments, getEmployeeOptions, getSites } from "@/lib/data/master";
import { getAssetOptions } from "@/lib/data/maintenance";

export const metadata: Metadata = { title: "New maintenance record" };

export default async function NewMaintenanceRecordPage({ searchParams }: PageProps<"/maintenance/new">) {
  await requirePagePermission(PERMISSIONS.maintenance.create);
  const params = await searchParams;
  const assetId = typeof params.assetId === "string" ? params.assetId : undefined;
  const [assets, employees, departments, sites] = await Promise.all([getAssetOptions(), getEmployeeOptions(), getDepartments(), getSites(true)]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="New maintenance record" crumbs={[{ label: "Maintenance", href: "/maintenance" }, { label: "New" }]} />
      <Section>
        {assets.length ? (
          <MaintenanceRecordForm assets={assets} employees={employees} fixedAssetId={assetId} />
        ) : (
          <EmptyState
            title="Register an asset first"
            description="Maintenance records are attached to an asset. Add equipment, then schedule the job."
            action={<AssetDialog departments={departments} sites={sites} />}
          />
        )}
      </Section>
    </div>
  );
}
