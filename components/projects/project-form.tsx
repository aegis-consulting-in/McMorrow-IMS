"use client";

import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FormError, FormField, FormGrid } from "@/components/ui/form-field";
import { LinkPicker } from "@/components/projects/link-picker";
import { createProjectAction, updateProjectAction } from "@/lib/actions/projects";
import { useAction } from "@/lib/hooks/use-action";
import { humanize } from "@/lib/format";
import type { ProjectMilestoneRow, ProjectRow } from "@/lib/types/database";
import {
  MILESTONE_STATUSES,
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  projectSchema,
} from "@/lib/validation/projects";

type Values = z.input<typeof projectSchema>;

const emptyMilestone = { id: "", name: "", startDate: "", endDate: "", status: "planned" as const };

export function ProjectForm({
  project,
  employees,
  sites,
  assets = [],
  suppliers = [],
  assetIds = [],
  supplierIds = [],
  milestones = [],
}: {
  project?: ProjectRow;
  employees: { id: string; first_name: string; last_name: string; employee_code: string }[];
  /** Site List from Admin → System Settings. Inactive sites are only offered if already on the project. */
  sites: { id: string; name: string; code: string | null; is_active: boolean }[];
  /** Active Preventive Maintenance assets that can be mapped to the project (optional). */
  assets?: { id: string; asset_code: string; name: string; is_active: boolean; site: { name: string } | null }[];
  /** Active suppliers that can be mapped to the project (optional). */
  suppliers?: { id: string; code: string; name: string; status: string; category: string | null }[];
  assetIds?: string[];
  supplierIds?: string[];
  milestones?: Pick<ProjectMilestoneRow, "id" | "name" | "start_date" | "end_date" | "status">[];
}) {
  const router = useRouter();
  const isEdit = Boolean(project);
  const availableSites = sites.filter((s) => s.is_active || s.id === project?.site_id);
  const form = useForm<Values>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      code: project?.code ?? "",
      name: project?.name ?? "",
      description: project?.description ?? "",
      siteId: project?.site_id ?? "",
      managerId: project?.manager_id ?? "",
      actualEndDate: project?.actual_end_date ?? "",
      status: project?.status ?? "planning",
      priority: project?.priority ?? "medium",
      notes: project?.notes ?? "",
      assetIds,
      supplierIds,
      milestones:
        milestones.length > 0
          ? milestones.map((m) => ({
              id: m.id,
              name: m.name,
              startDate: m.start_date ?? "",
              endDate: m.end_date ?? "",
              status: m.status,
            }))
          : [emptyMilestone],
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "milestones" });
  const { run, isPending, error, fieldErrors } = useAction(
    async (values: Values) => (isEdit ? updateProjectAction({ id: project!.id, ...values }) : createProjectAction(values)),
    { successMessage: isEdit ? "Project updated." : "Project created.", onSuccess: (d) => router.push(`/projects/${d.id}`) },
  );
  const err = (k: string) => {
    const fromForm = k.split(".").reduce<unknown>((acc, part) => {
      if (acc && typeof acc === "object" && part in acc) return (acc as Record<string, unknown>)[part];
      return undefined;
    }, form.formState.errors);
    const message =
      fromForm && typeof fromForm === "object" && "message" in fromForm ? String((fromForm as { message?: string }).message ?? "") : "";
    return message || fieldErrors[k]?.[0];
  };

  return (
    <form onSubmit={form.handleSubmit((v) => run(v))} className="flex flex-col gap-5" noValidate>
      <FormError message={error} />
      <FormGrid>
        <FormField label="Project code" htmlFor="code" required error={err("code")}>
          <Input id="code" placeholder="PRJ-001" {...form.register("code")} />
        </FormField>
        <FormField label="Project name" htmlFor="name" required error={err("name")}>
          <Input id="name" {...form.register("name")} />
        </FormField>
        <FormField
          label="Plant location"
          htmlFor="siteId"
          required
          error={err("siteId")}
          hint={availableSites.length ? undefined : "No sites defined yet. Add them in Admin → System Settings → Site List."}
        >
          <NativeSelect id="siteId" {...form.register("siteId")}>
            <option value="">— Select plant location —</option>
            {availableSites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.code ? ` (${s.code})` : ""}
                {s.is_active ? "" : " — inactive"}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="Project manager" htmlFor="managerId" error={err("managerId")}>
          <NativeSelect id="managerId" {...form.register("managerId")}>
            <option value="">— Unassigned —</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.first_name} {e.last_name} ({e.employee_code})
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Status" htmlFor="status" error={err("status")}>
            <NativeSelect id="status" {...form.register("status")}>
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {humanize(s)}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Priority" htmlFor="priority" error={err("priority")}>
            <NativeSelect id="priority" {...form.register("priority")}>
              {PROJECT_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {humanize(p)}
                </option>
              ))}
            </NativeSelect>
          </FormField>
        </div>
        <FormField
          label="Actual end date"
          htmlFor="actualEndDate"
          error={err("actualEndDate")}
          hint="Overall project close-out. Milestone dates are below."
        >
          <Input id="actualEndDate" type="date" {...form.register("actualEndDate")} />
        </FormField>
      </FormGrid>

      <div className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium">Milestones</h2>
            <p className="text-xs text-muted-foreground">
              Start and end dates belong to each milestone, not the project header. Removing a milestone also removes its tasks.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => append(emptyMilestone)}>
            <PlusIcon />
            Add milestone
          </Button>
        </div>
        {fields.map((field, index) => (
          <div key={field.id} className="rounded-lg border bg-card p-3">
            <input type="hidden" {...form.register(`milestones.${index}.id`)} />
            <FormGrid>
              <FormField
                label="Milestone"
                htmlFor={`milestone-name-${index}`}
                required
                error={err(`milestones.${index}.name`)}
                className="md:col-span-2"
              >
                <Input
                  id={`milestone-name-${index}`}
                  placeholder="e.g. Design freeze, FAT, Go-live"
                  {...form.register(`milestones.${index}.name`)}
                />
              </FormField>
              <FormField label="Start date" htmlFor={`milestone-start-${index}`} error={err(`milestones.${index}.startDate`)}>
                <Input id={`milestone-start-${index}`} type="date" {...form.register(`milestones.${index}.startDate`)} />
              </FormField>
              <FormField label="End date" htmlFor={`milestone-end-${index}`} error={err(`milestones.${index}.endDate`)}>
                <Input id={`milestone-end-${index}`} type="date" {...form.register(`milestones.${index}.endDate`)} />
              </FormField>
              <FormField label="Status" htmlFor={`milestone-status-${index}`} error={err(`milestones.${index}.status`)}>
                <NativeSelect id={`milestone-status-${index}`} {...form.register(`milestones.${index}.status`)}>
                  {MILESTONE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {humanize(s)}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={fields.length <= 1}
                  onClick={() => remove(index)}
                >
                  <Trash2Icon />
                  Remove
                </Button>
              </div>
            </FormGrid>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <LinkPicker
          label="Assets"
          options={assets.map((a) => ({
            id: a.id,
            label: `${a.asset_code} · ${a.name}`,
            hint: a.site?.name,
            inactive: !a.is_active,
          }))}
          value={form.watch("assetIds") ?? []}
          onChange={(ids) => form.setValue("assetIds", ids, { shouldDirty: true })}
          emptyText="No active assets yet. Register them under Preventive Maintenance."
        />
        <LinkPicker
          label="Suppliers"
          options={suppliers.map((s) => ({
            id: s.id,
            label: `${s.code} · ${s.name}`,
            hint: s.category ?? undefined,
            inactive: s.status !== "active",
          }))}
          value={form.watch("supplierIds") ?? []}
          onChange={(ids) => form.setValue("supplierIds", ids, { shouldDirty: true })}
          emptyText="No active suppliers yet. Add them under Supplier Management."
        />
      </div>

      <FormField label="Description" htmlFor="description" error={err("description")}>
        <Textarea id="description" rows={4} {...form.register("description")} />
      </FormField>
      <FormField label="Notes" htmlFor="notes" error={err("notes")}>
        <Textarea id="notes" rows={3} {...form.register("notes")} />
      </FormField>
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2Icon className="animate-spin" /> : null}
          {isEdit ? "Save changes" : "Create project"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
