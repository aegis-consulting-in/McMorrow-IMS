"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import type { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormError, FormField } from "@/components/ui/form-field";
import { ConfirmButton } from "@/components/shared/confirm-dialog";
import { DataTable, type Column } from "@/components/shared/data-table";
import { BooleanBadge } from "@/components/shared/status-badge";
import {
  createProjectRoleAction,
  createSiteAction,
  deleteProjectRoleAction,
  deleteSiteAction,
  updateProjectRoleAction,
  updateSiteAction,
} from "@/lib/actions/admin";
import { useAction } from "@/lib/hooks/use-action";
import { projectRoleSchema, siteSchema } from "@/lib/validation/admin";

type SiteValues = z.input<typeof siteSchema>;
type RoleValues = z.input<typeof projectRoleSchema>;

type Site = { id: string; name: string; code: string | null; address: string | null; is_active: boolean };
type ProjectRole = { id: string; name: string; description: string | null; sort_order: number; is_active: boolean };

// ---------------------------------------------------------------- sites ----
export function SiteManager({ sites }: { sites: Site[] }) {
  const columns: Column<Site>[] = [
    {
      key: "name",
      header: "Site",
      cell: (s) => (
        <div className="min-w-0">
          <span className="font-medium">{s.name}</span>
          {s.address ? <p className="truncate text-xs text-muted-foreground">{s.address}</p> : null}
        </div>
      ),
    },
    { key: "code", header: "Code", cell: (s) => s.code ?? "—", hideBelow: "sm" },
    { key: "active", header: "Active", cell: (s) => <BooleanBadge value={s.is_active} /> },
    {
      key: "actions",
      header: "",
      className: "w-24 text-right",
      cell: (s) => (
        <div className="flex justify-end gap-1">
          <SiteDialog site={s} />
          <DeleteButton
            name={s.name}
            description="This fails if projects still use this site. Deactivate it instead when it is in use."
            onDelete={() => deleteSiteAction({ id: s.id })}
          />
        </div>
      ),
    },
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <SiteDialog />
      </div>
      <DataTable columns={columns} rows={sites} rowKey={(r) => r.id} emptyTitle="No sites yet" emptyDescription="Add the sites your projects and assets belong to." />
    </div>
  );
}

function SiteDialog({ site }: { site?: Site }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const isEdit = Boolean(site);
  const form = useForm<SiteValues>({
    resolver: zodResolver(siteSchema),
    defaultValues: { name: site?.name ?? "", code: site?.code ?? "", address: site?.address ?? "", isActive: site?.is_active ?? true },
  });
  const { run, isPending, error, fieldErrors } = useAction(
    async (values: SiteValues) => (isEdit ? updateSiteAction({ id: site!.id, ...values }) : createSiteAction(values)),
    {
      successMessage: isEdit ? "Site saved." : "Site created.",
      onSuccess: () => {
        setOpen(false);
        if (!isEdit) form.reset({ name: "", code: "", address: "", isActive: true });
        router.refresh();
      },
    },
  );
  const err = (k: keyof SiteValues) => form.formState.errors[k]?.message ?? fieldErrors[k];

  return (
    <>
      {isEdit ? (
        <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)} aria-label="Edit site">
          <PencilIcon />
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <PlusIcon /> New site
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit site" : "New site"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((v) => run(v))} className="flex flex-col gap-3" noValidate>
            <FormError message={error} />
            <FormField label="Name" htmlFor={`site-name-${site?.id ?? "new"}`} required error={err("name")}>
              <Input id={`site-name-${site?.id ?? "new"}`} {...form.register("name")} />
            </FormField>
            <FormField label="Code" htmlFor={`site-code-${site?.id ?? "new"}`} error={err("code")}>
              <Input id={`site-code-${site?.id ?? "new"}`} {...form.register("code")} />
            </FormField>
            <FormField label="Address" htmlFor={`site-address-${site?.id ?? "new"}`} error={err("address")}>
              <Textarea id={`site-address-${site?.id ?? "new"}`} rows={2} {...form.register("address")} />
            </FormField>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.watch("isActive") as boolean} onCheckedChange={(c) => form.setValue("isActive", Boolean(c))} />
              Active
            </label>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2Icon className="animate-spin" /> : null} Save
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// -------------------------------------------------------- project roles ----
export function ProjectRoleManager({ roles }: { roles: ProjectRole[] }) {
  const columns: Column<ProjectRole>[] = [
    {
      key: "name",
      header: "Project role",
      cell: (r) => (
        <div className="min-w-0">
          <span className="font-medium">{r.name}</span>
          {r.description ? <p className="truncate text-xs text-muted-foreground">{r.description}</p> : null}
        </div>
      ),
    },
    { key: "order", header: "Order", cell: (r) => `#${r.sort_order}`, hideBelow: "sm" },
    { key: "active", header: "Active", cell: (r) => <BooleanBadge value={r.is_active} /> },
    {
      key: "actions",
      header: "",
      className: "w-24 text-right",
      cell: (r) => (
        <div className="flex justify-end gap-1">
          <ProjectRoleDialog role={r} nextOrder={roles.length + 1} />
          <DeleteButton
            name={r.name}
            description="Existing project members keep the role name they were given. Deactivate it instead to stop offering it."
            onDelete={() => deleteProjectRoleAction({ id: r.id })}
          />
        </div>
      ),
    },
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <ProjectRoleDialog nextOrder={roles.length + 1} />
      </div>
      <DataTable
        columns={columns}
        rows={roles}
        rowKey={(r) => r.id}
        emptyTitle="No project roles yet"
        emptyDescription="Define the roles team members can hold on a project."
      />
    </div>
  );
}

function ProjectRoleDialog({ role, nextOrder }: { role?: ProjectRole; nextOrder: number }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const isEdit = Boolean(role);
  const blank: RoleValues = { name: "", description: "", sortOrder: nextOrder, isActive: true };
  const form = useForm<RoleValues>({
    resolver: zodResolver(projectRoleSchema),
    defaultValues: role
      ? { name: role.name, description: role.description ?? "", sortOrder: role.sort_order, isActive: role.is_active }
      : blank,
  });
  const { run, isPending, error, fieldErrors } = useAction(
    async (values: RoleValues) => (isEdit ? updateProjectRoleAction({ id: role!.id, ...values }) : createProjectRoleAction(values)),
    {
      successMessage: isEdit ? "Project role saved." : "Project role created.",
      onSuccess: () => {
        setOpen(false);
        if (!isEdit) form.reset({ ...blank, sortOrder: nextOrder + 1 });
        router.refresh();
      },
    },
  );
  const err = (k: keyof RoleValues) => form.formState.errors[k]?.message ?? fieldErrors[k];
  const idp = `prole-${role?.id ?? "new"}`;

  return (
    <>
      {isEdit ? (
        <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)} aria-label="Edit project role">
          <PencilIcon />
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <PlusIcon /> New project role
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit project role" : "New project role"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((v) => run(v))} className="flex flex-col gap-3" noValidate>
            <FormError message={error} />
            <FormField label="Name" htmlFor={`${idp}-name`} required error={err("name")}>
              <Input id={`${idp}-name`} placeholder="e.g. Site Supervisor" {...form.register("name")} />
            </FormField>
            <FormField label="Description" htmlFor={`${idp}-desc`} error={err("description")} hint="What this role is responsible for on a project.">
              <Textarea id={`${idp}-desc`} rows={2} {...form.register("description")} />
            </FormField>
            <FormField label="Sort order" htmlFor={`${idp}-order`} error={err("sortOrder")}>
              <Input id={`${idp}-order`} type="number" {...form.register("sortOrder")} />
            </FormField>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.watch("isActive") as boolean} onCheckedChange={(c) => form.setValue("isActive", Boolean(c))} />
              Active
            </label>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2Icon className="animate-spin" /> : null} Save
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// --------------------------------------------------------------- shared ----
function DeleteButton({
  name,
  description,
  onDelete,
}: {
  name: string;
  description: string;
  onDelete: () => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const router = useRouter();
  const remove = async () => {
    const res = await onDelete();
    if (res.ok) {
      toast.success("Deleted.");
      router.refresh();
    } else toast.error(res.error);
  };
  return (
    <ConfirmButton
      variant="ghost"
      size="icon-sm"
      className="text-destructive hover:text-destructive"
      title={`Delete ${name}?`}
      description={description}
      confirmLabel="Delete"
      destructive
      onConfirm={remove}
      aria-label={`Delete ${name}`}
    >
      <Trash2Icon />
    </ConfirmButton>
  );
}
