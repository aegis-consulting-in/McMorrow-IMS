import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileList } from "@/components/documents/file-list";
import { FileUpload } from "@/components/documents/file-upload";
import { ProjectDocuments } from "@/components/projects/project-documents";
import { PageHeader, Section } from "@/components/shared/page-header";
import { getProjectMilestones } from "@/lib/data/projects";
import { requirePagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getEntityDocuments, resolveEntityNames } from "@/lib/data/documents";
import { folderForModule, parseDocumentModule } from "@/lib/documents/modules";
import { entityHref } from "@/lib/documents/storage";

export const metadata: Metadata = { title: "Documents" };

export default async function DocumentEntityPage({ params }: PageProps<"/documents/[module]/[entityId]">) {
  const user = await requirePagePermission(PERMISSIONS.documents.view);
  const { module: slug, entityId } = await params;
  const docModule = parseDocumentModule(slug);
  if (!docModule) notFound();
  const folder = folderForModule(docModule);

  const [files, names] = await Promise.all([getEntityDocuments(docModule, entityId), resolveEntityNames(docModule, [entityId])]);
  const name = names[entityId];
  if (!name && files.length === 0) notFound();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={name ?? "Documents"}
        description={folder?.label}
        crumbs={[
          { label: "Documents", href: "/documents" },
          { label: folder?.label ?? docModule, href: `/documents/${docModule}` },
          { label: name ?? "Files" },
        ]}
        actions={
          <Link href={entityHref(docModule, entityId)} className="text-sm text-brand hover:underline">
            Open record
          </Link>
        }
      />
      {docModule === "project" ? (
        <ProjectDocuments projectId={entityId} milestones={await getProjectMilestones(entityId)} title="Files" />
      ) : (
        <Section>
          <div className="flex flex-col gap-4">
            {user.can(PERMISSIONS.documents.upload) ? <FileUpload module={docModule} entityId={entityId} compact /> : null}
            <FileList files={files} canDownload={user.can(PERMISSIONS.documents.download)} canDelete={user.can(PERMISSIONS.documents.delete)} />
          </div>
        </Section>
      )}
    </div>
  );
}
