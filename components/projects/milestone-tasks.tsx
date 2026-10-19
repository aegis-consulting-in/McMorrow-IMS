"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon, ChevronRightIcon, ListChecksIcon, Loader2Icon, PencilIcon, PlusIcon, Trash2Icon, UserIcon } from "lucide-react";
import type { z } from "zod";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FormError, FormField, FormGrid } from "@/components/ui/form-field";
import { ConfirmButton } from "@/components/shared/confirm-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  createProjectTaskAction,
  deleteProjectTaskAction,
  setProjectTaskStatusAction,
  updateProjectTaskAction,
} from "@/lib/actions/projects";
import { useAction } from "@/lib/hooks/use-action";
import { formatDate, fullName, humanize, isOverdue } from "@/lib/format";
import { TASK_STATUSES, projectTaskSchema, updateProjectTaskSchema } from "@/lib/validation/projects";

type Milestone = { id: string; name: string; start_date: string | null; end_date: string | null; status: string };
type Employee = { id: string; first_name: string; last_name: string; employee_code: string };
export type TaskItem = {
  id: string;
  milestone_id: string;
  title: string;
  description: string | null;
  status: (typeof TASK_STATUSES)[number];
  due_date: string | null;
  assignee_id: string | null;
  assignee: { id: string; first_name: string; last_name: string; employee_code: string } | null;
};

/**
 * Milestones with their tasks. Editors add / edit / delete tasks and tag an
 * employee on each; the tagged employee can also move their own task's status.
 */
export function MilestoneTasks({
  projectId,
  milestones,
  tasks,
  employees,
  canEdit,
  currentEmployeeId,
}: {
  projectId: string;
  milestones: Milestone[];
  tasks: TaskItem[];
  employees: Employee[];
  canEdit: boolean;
  currentEmployeeId: string | null;
}) {
  if (!milestones.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No milestones yet. Add milestones when you edit this project, then create tasks under each one.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {milestones.map((m) => {
        const list = tasks.filter((t) => t.milestone_id === m.id);
        const done = list.filter((t) => t.status === "completed").length;
        const dates = [m.start_date, m.end_date].some(Boolean) ? `${formatDate(m.start_date)} → ${formatDate(m.end_date)}` : "No dates";
        return (
          <details key={m.id} open={list.length > 0} className="group rounded-lg border bg-card">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 select-none [&::-webkit-details-marker]:hidden">
              <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {m.name}
                  <StatusBadge status={m.status} />
                </span>
                <span className="block text-xs text-muted-foreground">{dates}</span>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 text-xs text-muted-foreground tabular-nums">
                <ListChecksIcon className="size-3.5" />
                {done}/{list.length} task{list.length === 1 ? "" : "s"}
              </span>
            </summary>
            <div className="flex flex-col gap-2 border-t p-3">
              {list.length ? (
                <ul className="divide-y rounded-lg border">
                  {list.map((t) => (
                    <TaskRow key={t.id} task={t} employees={employees} canEdit={canEdit} isAssignee={Boolean(currentEmployeeId && t.assignee_id === currentEmployeeId)} />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No tasks under this milestone yet.</p>
              )}
              {canEdit ? (
                <div>
                  <TaskDialog projectId={projectId} milestoneId={m.id} milestoneName={m.name} employees={employees} />
                </div>
              ) : null}
            </div>
          </details>
        );
      })}
    </div>
  );
}

function TaskRow({ task, employees, canEdit, isAssignee }: { task: TaskItem; employees: Employee[]; canEdit: boolean; isAssignee: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const closed = task.status === "completed" || task.status === "cancelled";

  const setStatus = async (status: string) => {
    setBusy(true);
    const res = await setProjectTaskStatusAction({ id: task.id, status });
    setBusy(false);
    if (res.ok) router.refresh();
    else toast.error(res.error);
  };

  const remove = async () => {
    const res = await deleteProjectTaskAction({ id: task.id });
    if (res.ok) {
      toast.success("Task deleted.");
      router.refresh();
    } else toast.error(res.error);
  };

  return (
    <li className="flex flex-col gap-2 px-3 py-2.5 text-sm sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className={cn("font-medium", closed && "text-muted-foreground line-through")}>{task.title}</p>
        {task.description ? <p className="text-xs whitespace-pre-line text-muted-foreground">{task.description}</p> : null}
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <UserIcon className="size-3.5" />
            {task.assignee ? `${fullName(task.assignee)} (${task.assignee.employee_code})` : task.assignee_id ? "Employee" : "Unassigned"}
          </span>
          {task.due_date ? (
            <span className={cn("inline-flex items-center gap-1", !closed && isOverdue(task.due_date) && "font-medium text-destructive")}>
              <CalendarIcon className="size-3.5" />
              Due {formatDate(task.due_date)}
            </span>
          ) : null}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {canEdit || isAssignee ? (
          <NativeSelect
            value={task.status}
            disabled={busy}
            onChange={(e) => void setStatus(e.target.value)}
            aria-label={`Status of ${task.title}`}
            className="h-7 w-36 text-xs"
          >
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </NativeSelect>
        ) : (
          <StatusBadge status={task.status} />
        )}
        {canEdit ? (
          <>
            <TaskDialog task={task} employees={employees} />
            <ConfirmButton
              variant="ghost"
              size="icon-sm"
              className="text-destructive hover:text-destructive"
              title={`Delete "${task.title}"?`}
              confirmLabel="Delete"
              destructive
              onConfirm={remove}
              aria-label="Delete task"
            >
              <Trash2Icon />
            </ConfirmButton>
          </>
        ) : null}
      </div>
    </li>
  );
}

type NewValues = z.input<typeof projectTaskSchema>;
type EditValues = z.input<typeof updateProjectTaskSchema>;
type FormValues = Omit<NewValues, "projectId" | "milestoneId">;

/** Create (pass projectId + milestoneId) or edit (pass task) a task. */
function TaskDialog({
  projectId,
  milestoneId,
  milestoneName,
  task,
  employees,
}: {
  projectId?: string;
  milestoneId?: string;
  milestoneName?: string;
  task?: TaskItem;
  employees: Employee[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const isEdit = Boolean(task);
  const blank: FormValues = { title: "", description: "", assigneeId: "", dueDate: "", status: "open" };
  const form = useForm<FormValues>({
    resolver: zodResolver(updateProjectTaskSchema.omit({ id: true })),
    defaultValues: task
      ? {
          title: task.title,
          description: task.description ?? "",
          assigneeId: task.assignee_id ?? "",
          dueDate: task.due_date ?? "",
          status: task.status,
        }
      : blank,
  });
  const { run, isPending, error, fieldErrors } = useAction(
    async (values: FormValues) =>
      isEdit
        ? updateProjectTaskAction({ id: task!.id, ...values } satisfies EditValues)
        : createProjectTaskAction({ projectId, milestoneId, ...values } satisfies Partial<NewValues>),
    {
      successMessage: isEdit ? "Task updated." : "Task created.",
      onSuccess: () => {
        setOpen(false);
        if (!isEdit) form.reset(blank);
        router.refresh();
      },
    },
  );
  const err = (k: keyof FormValues) => form.formState.errors[k]?.message ?? fieldErrors[k]?.[0];
  const idp = `task-${task?.id ?? milestoneId}`;

  return (
    <>
      {isEdit ? (
        <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)} aria-label="Edit task">
          <PencilIcon />
        </Button>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          <PlusIcon /> Add task
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit task" : "New task"}</DialogTitle>
            <DialogDescription>{isEdit ? "Update the task, or tag a different employee." : `Under milestone: ${milestoneName ?? ""}`}</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((v) => run(v))} className="flex flex-col gap-3" noValidate>
            <FormError message={error} />
            <FormField label="Task" htmlFor={`${idp}-title`} required error={err("title")}>
              <Input id={`${idp}-title`} placeholder="e.g. Submit method statement" {...form.register("title")} />
            </FormField>
            <FormGrid>
              <FormField label="Tag employee" htmlFor={`${idp}-assignee`} error={err("assigneeId")}>
                <NativeSelect id={`${idp}-assignee`} {...form.register("assigneeId")}>
                  <option value="">— Unassigned —</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.first_name} {e.last_name} ({e.employee_code})
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField label="Due date" htmlFor={`${idp}-due`} error={err("dueDate")}>
                <Input id={`${idp}-due`} type="date" {...form.register("dueDate")} />
              </FormField>
              <FormField label="Status" htmlFor={`${idp}-status`} error={err("status")}>
                <NativeSelect id={`${idp}-status`} {...form.register("status")}>
                  {TASK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {humanize(s)}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
            </FormGrid>
            <FormField label="Description" htmlFor={`${idp}-desc`} error={err("description")}>
              <Textarea id={`${idp}-desc`} rows={3} {...form.register("description")} />
            </FormField>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2Icon className="animate-spin" /> : null}
              {isEdit ? "Save task" : "Create task"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
