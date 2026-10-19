import { z } from "zod";
import { optionalDate, optionalText, optionalUuid, requiredText, uuid } from "./common";

export const PROJECT_STATUSES = ["planning", "active", "on_hold", "completed", "cancelled"] as const;
export const PROJECT_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export const MILESTONE_STATUSES = ["planned", "in_progress", "completed", "cancelled"] as const;

export const milestoneSchema = z
  .object({
    id: optionalUuid,
    name: z.string().trim().max(200, "Milestone must be 200 characters or fewer."),
    startDate: optionalDate,
    endDate: optionalDate,
    status: z.enum(MILESTONE_STATUSES).default("planned"),
  })
  .refine((d) => !d.startDate || !d.endDate || d.endDate >= d.startDate, {
    message: "End date cannot be before the start date.",
    path: ["endDate"],
  })
  .refine((d) => !((d.startDate || d.endDate) && !d.name), {
    message: "Milestone is required.",
    path: ["name"],
  });
export type MilestoneInput = z.infer<typeof milestoneSchema>;

export const projectSchema = z.object({
  code: requiredText("Project code", 30),
  name: requiredText("Project name", 200),
  description: optionalText(5000),
  siteId: z.string().trim().min(1, "Select a plant location.").pipe(uuid),
  managerId: optionalUuid,
  actualEndDate: optionalDate,
  status: z.enum(PROJECT_STATUSES).default("planning"),
  priority: z.enum(PROJECT_PRIORITIES).default("medium"),
  notes: optionalText(5000),
  milestones: z.array(milestoneSchema).default([]),
  /** Active preventive-maintenance assets used on this project (optional). */
  assetIds: z.array(uuid).default([]),
  /** Active suppliers working on this project (optional). */
  supplierIds: z.array(uuid).default([]),
});
export type ProjectInput = z.infer<typeof projectSchema>;
export const updateProjectSchema = z.object({ id: uuid }).and(projectSchema);

export const TASK_STATUSES = ["open", "in_progress", "completed", "cancelled"] as const;

export const projectTaskSchema = z.object({
  projectId: uuid,
  milestoneId: uuid,
  title: requiredText("Task", 200),
  description: optionalText(2000),
  /** The employee tagged on the task. */
  assigneeId: optionalUuid,
  dueDate: optionalDate,
  status: z.enum(TASK_STATUSES).default("open"),
});
export const updateProjectTaskSchema = projectTaskSchema.omit({ projectId: true, milestoneId: true }).extend({ id: uuid });
export const setTaskStatusSchema = z.object({ id: uuid, status: z.enum(TASK_STATUSES) });

export const projectMemberSchema = z.object({
  projectId: uuid,
  employeeId: uuid,
  roleInProject: optionalText(80),
});
export const removeProjectMemberSchema = z.object({ projectId: uuid, employeeId: uuid });
