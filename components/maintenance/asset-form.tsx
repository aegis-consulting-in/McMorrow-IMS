"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FormError, FormField, FormGrid } from "@/components/ui/form-field";
import { createAssetAction, updateAssetAction } from "@/lib/actions/maintenance";
import { useAction } from "@/lib/hooks/use-action";
import type { MaintenanceAssetRow } from "@/lib/types/database";
import { assetSchema } from "@/lib/validation/maintenance";

type Values = z.input<typeof assetSchema>;

type SiteOption = { id: string; name: string; is_active: boolean };

export function AssetForm({
  asset,
  departments,
  sites,
  onDone,
}: {
  asset?: MaintenanceAssetRow;
  departments: { id: string; name: string }[];
  /** Site List (Admin → System Settings). Inactive sites are only offered if already on the asset. */
  sites: SiteOption[];
  onDone?: () => void;
}) {
  const availableSites = sites.filter((s) => s.is_active || s.id === asset?.site_id);
  const router = useRouter();
  const isEdit = Boolean(asset);
  const form = useForm<Values>({
    resolver: zodResolver(assetSchema),
    defaultValues: {
      assetCode: asset?.asset_code ?? "",
      name: asset?.name ?? "",
      description: asset?.description ?? "",
      serialNumber: asset?.serial_number ?? "",
      manufacturer: asset?.manufacturer ?? "",
      location: asset?.location ?? "",
      departmentId: asset?.department_id ?? "",
      siteId: asset?.site_id ?? "",
      purchaseDate: asset?.purchase_date ?? "",
      isActive: asset?.is_active ?? true,
    },
  });
  const { run, isPending, error, fieldErrors } = useAction(
    async (values: Values) => (isEdit ? updateAssetAction({ id: asset!.id, ...values }) : createAssetAction(values)),
    {
      successMessage: isEdit ? "Asset updated." : "Asset created.",
      onSuccess: () => {
        onDone?.();
        router.refresh();
      },
    },
  );
  const err = (k: keyof Values) => form.formState.errors[k]?.message ?? fieldErrors[k];

  return (
    <form onSubmit={form.handleSubmit((v) => run(v))} className="flex flex-col gap-4" noValidate>
      <FormError message={error} />
      <FormGrid>
        <FormField label="Asset code" htmlFor="assetCode" required error={err("assetCode")}>
          <Input id="assetCode" placeholder="AST-001" {...form.register("assetCode")} />
        </FormField>
        <FormField label="Asset name" htmlFor="name" required error={err("name")}>
          <Input id="name" {...form.register("name")} />
        </FormField>
        <FormField label="Serial number" htmlFor="serialNumber" error={err("serialNumber")}>
          <Input id="serialNumber" {...form.register("serialNumber")} />
        </FormField>
        <FormField label="Manufacturer" htmlFor="manufacturer" error={err("manufacturer")}>
          <Input id="manufacturer" {...form.register("manufacturer")} />
        </FormField>
        <FormField label="Location" htmlFor="location" error={err("location")}>
          <Input id="location" {...form.register("location")} />
        </FormField>
        <FormField label="Department" htmlFor="departmentId" error={err("departmentId")}>
          <NativeSelect id="departmentId" {...form.register("departmentId")}>
            <option value="">— None —</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="Site" htmlFor="siteId" error={err("siteId")}>
          <NativeSelect id="siteId" {...form.register("siteId")}>
            <option value="">— None —</option>
            {availableSites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.is_active ? "" : " — inactive"}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="Purchase date" htmlFor="purchaseDate" error={err("purchaseDate")}>
          <Input id="purchaseDate" type="date" {...form.register("purchaseDate")} />
        </FormField>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.watch("isActive") as boolean} onCheckedChange={(c) => form.setValue("isActive", Boolean(c), { shouldDirty: true })} />
            Asset in service
          </label>
        </div>
      </FormGrid>
      <FormField label="Description" htmlFor="description" error={err("description")}>
        <Textarea id="description" rows={3} {...form.register("description")} />
      </FormField>
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2Icon className="animate-spin" /> : null}
          {isEdit ? "Save changes" : "Create asset"}
        </Button>
      </div>
    </form>
  );
}
