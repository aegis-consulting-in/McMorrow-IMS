import type { LucideIcon } from "lucide-react";
import {
  BriefcaseIcon,
  ClipboardCheckIcon,
  FileTextIcon,
  FolderIcon,
  GraduationCapIcon,
  ScrollTextIcon,
  SettingsIcon,
  ShieldIcon,
  TruckIcon,
  UsersIcon,
  WrenchIcon,
} from "lucide-react";
import { MODULE_ACCESS, PERMISSIONS, type PermissionKey } from "@/lib/auth/permissions";

export type ModuleDef = {
  key: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  /** Any-of permissions. Empty array → every signed-in user. */
  permissions: PermissionKey[];
};

/** Full-width module buttons on the home page (order matches qms_mock/home.png). */
export const MODULES: ModuleDef[] = [
  {
    key: "training",
    label: "HR",
    description: "People, training and HR records",
    href: "/training",
    icon: GraduationCapIcon,
    permissions: [], // everyone has "My Trainings"
  },
  {
    key: "maintenance",
    label: "Preventive Maintenance",
    description: "Assets, schedules and maintenance records",
    href: "/maintenance",
    icon: WrenchIcon,
    permissions: MODULE_ACCESS.maintenance,
  },
  {
    key: "suppliers",
    label: "Supplier Management",
    description: "Supplier register, evaluations and reviews",
    href: "/suppliers",
    icon: TruckIcon,
    permissions: MODULE_ACCESS.suppliers,
  },
  {
    key: "projects",
    label: "Project Management",
    description: "Projects, members and milestones",
    href: "/projects",
    icon: BriefcaseIcon,
    permissions: [], // members / PMs can see their own projects
  },
  {
    key: "audits",
    label: "Audit Process",
    description: "Audit plans, findings and corrective actions",
    href: "/audits",
    icon: ClipboardCheckIcon,
    permissions: [], // auditors see their own audits
  },
  {
    key: "admin",
    label: "Admin Settings",
    description: "Users, roles, permissions and settings",
    href: "/admin",
    icon: SettingsIcon,
    permissions: MODULE_ACCESS.admin,
  },
];

/** Secondary module (reached from HR → Employee Details). Not on the home list. */
export const EMPLOYEE_MODULE: ModuleDef = {
  key: "employees",
  label: "Employee Management",
  description: "People, departments and reporting lines",
  href: "/employees",
  icon: UsersIcon,
  permissions: MODULE_ACCESS.employees,
};

export type FolderDef = {
  key: "training" | "project" | "supplier" | "preventive-maintenance" | "audit" | "employee";
  label: string;
  href: string;
  icon: LucideIcon;
  home?: boolean;
};

/** Folder shortcuts. `home: true` appears on the dashboard row (matches the mock). */
export const FOLDERS: FolderDef[] = [
  { key: "training", label: "HR Documents", href: "/documents/training", icon: FolderIcon, home: true },
  { key: "project", label: "Project Documents", href: "/documents/project", icon: FolderIcon, home: true },
  { key: "supplier", label: "Supplier Documents", href: "/documents/supplier", icon: FolderIcon, home: true },
  { key: "preventive-maintenance", label: "Preventive Maintenance", href: "/documents/preventive-maintenance", icon: FolderIcon, home: true },
  { key: "audit", label: "Audit Documents", href: "/documents/audit", icon: FolderIcon },
  { key: "employee", label: "Employee Documents", href: "/documents/employee", icon: FolderIcon },
];

export type AdminSection = {
  key: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  permissions: PermissionKey[];
};

/** Admin dashboard tiles. Extra settings can be added here without restructuring routes. */
export const ADMIN_SECTIONS: AdminSection[] = [
  {
    key: "users",
    label: "User Management",
    description: "Create accounts, assign roles, activate or deactivate users",
    href: "/admin/users",
    icon: UsersIcon,
    permissions: [PERMISSIONS.admin.users],
  },
  {
    key: "roles",
    label: "Roles & Permissions",
    description: "Create roles and choose the permissions each role grants",
    href: "/admin/roles",
    icon: ShieldIcon,
    permissions: [PERMISSIONS.admin.roles],
  },
  {
    key: "departments",
    label: "Departments",
    description: "Organisation units used across employees, audits and assets",
    href: "/admin/departments",
    icon: BriefcaseIcon,
    permissions: [PERMISSIONS.admin.settings],
  },
  {
    key: "job-titles",
    label: "Job Titles",
    description: "Master list of job titles for employee records",
    href: "/admin/job-titles",
    icon: UsersIcon,
    permissions: [PERMISSIONS.admin.settings],
  },
  {
    key: "training-config",
    label: "Training Configuration",
    description: "Training levels and status used in the catalogue",
    href: "/admin/training-config",
    icon: GraduationCapIcon,
    permissions: [PERMISSIONS.admin.settings],
  },
  {
    key: "documents",
    label: "Document Management",
    description: "Search files across modules the admin is authorised to see",
    href: "/admin/documents",
    icon: FileTextIcon,
    permissions: [PERMISSIONS.admin.documents],
  },
  {
    key: "audit-logs",
    label: "Audit Logs",
    description: "Who did what, when, and to which record",
    href: "/admin/audit-logs",
    icon: ScrollTextIcon,
    permissions: [PERMISSIONS.admin.auditLogs],
  },
  {
    key: "settings",
    label: "System Settings",
    description: "Application name, reminders, sites (plants) and project roles",
    href: "/admin/settings",
    icon: SettingsIcon,
    permissions: [PERMISSIONS.admin.settings],
  },
];
