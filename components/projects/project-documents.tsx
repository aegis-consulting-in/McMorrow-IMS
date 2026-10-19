import { ChevronRightIcon, FolderIcon, FolderOpenIcon, PaperclipIcon } from "lucide-react";
import { FileList } from "@/components/documents/file-list";
import { FileUpload } from "@/components/documents/file-upload";
import { Section } from "@/components/shared/page-header";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { getEntityDocuments } from "@/lib/data/documents";
import { formatDate } from "@/lib/format";

type MilestoneFolder = { id: string; name: string; start_date: string | null; end_date: string | null };

/**
 * Project documents with a subfolder per milestone. Files uploaded at project
 * level sit in the root folder; milestone files live under that milestone's
 * folder (storage: project/{id}/milestones/{milestone_id}/...).
 */
export async function ProjectDocuments({
  projectId,
  milestones,
  title = "Project documents",
}: {
  projectId: string;
  milestones: MilestoneFolder[];
  title?: string;
}) {
  const user = await getCurrentUser();
  if (!user || !user.can(PERMISSIONS.documents.view)) return null;

  const files = await getEntityDocuments("project", projectId);
  const canUpload = user.can(PERMISSIONS.documents.upload);
  const canDownload = user.can(PERMISSIONS.documents.download);
  const canDelete = user.can(PERMISSIONS.documents.delete);

  const milestoneIds = new Set(milestones.map((m) => m.id));
  const rootFiles = files.filter((f) => !f.milestone_id || !milestoneIds.has(f.milestone_id));
  const byMilestone = new Map<string, typeof files>();
  for (const f of files) {
    if (f.milestone_id && milestoneIds.has(f.milestone_id)) {
      const list = byMilestone.get(f.milestone_id) ?? [];
      list.push(f);
      byMilestone.set(f.milestone_id, list);
    }
  }

  return (
    <Section
      title={
        <span className="inline-flex items-center gap-1.5">
          <PaperclipIcon className="size-4 text-muted-foreground" /> {title}
          <span className="rounded-full bg-muted px-1.5 text-xs font-normal text-muted-foreground tabular-nums">{files.length}</span>
        </span>
      }
      description="Files at project level, plus a subfolder for each milestone."
    >
      <div className="flex flex-col gap-3">
        <FolderBlock name="Project files" subtitle="Root folder" count={rootFiles.length} defaultOpen>
          <div className="flex flex-col gap-3">
            {canUpload ? <FileUpload module="project" entityId={projectId} compact /> : null}
            <FileList files={rootFiles} canDownload={canDownload} canDelete={canDelete} emptyTitle="No project-level files" />
          </div>
        </FolderBlock>

        {milestones.map((m) => {
          const list = byMilestone.get(m.id) ?? [];
          const dates = [m.start_date, m.end_date].some(Boolean) ? `${formatDate(m.start_date)} → ${formatDate(m.end_date)}` : "No dates";
          return (
            <FolderBlock key={m.id} name={m.name} subtitle={`Milestone · ${dates}`} count={list.length} defaultOpen={list.length > 0}>
              <div className="flex flex-col gap-3">
                {canUpload ? <FileUpload module="project" entityId={projectId} milestoneId={m.id} compact /> : null}
                <FileList files={list} canDownload={canDownload} canDelete={canDelete} emptyTitle="No files in this milestone" />
              </div>
            </FolderBlock>
          );
        })}
      </div>
    </Section>
  );
}

function FolderBlock({
  name,
  subtitle,
  count,
  defaultOpen,
  children,
}: {
  name: string;
  subtitle: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group rounded-lg border bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 select-none [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
        <FolderIcon className="size-4 shrink-0 text-brand group-open:hidden" />
        <FolderOpenIcon className="hidden size-4 shrink-0 text-brand group-open:block" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{name}</span>
          <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
        </span>
        <span className="rounded-full bg-muted px-2 text-xs text-muted-foreground tabular-nums">
          {count} file{count === 1 ? "" : "s"}
        </span>
      </summary>
      <div className="border-t p-3">{children}</div>
    </details>
  );
}
