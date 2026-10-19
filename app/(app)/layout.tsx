import { AppHeader } from "@/components/layout/app-header";
import { requireUser } from "@/lib/auth/guards";
import { getPublicSettings } from "@/lib/data/master";
import { EMPLOYEE_MODULE, MODULES } from "@/lib/navigation";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const [user, settings] = await Promise.all([requireUser(), getPublicSettings()]);
  const appName = typeof settings["app.name"] === "string" ? (settings["app.name"] as string) : "McMorrow IMS";

  const visibleModules = MODULES.filter((m) => m.permissions.length === 0 || user.canAny(m.permissions)).map((m) => ({
    key: m.key,
    label: m.label,
    href: m.href,
  }));
  // Employee directory is nested under HR; still expose it in the header/mobile nav when permitted.
  if (user.canAny(EMPLOYEE_MODULE.permissions) && !visibleModules.some((m) => m.key === "employees")) {
    visibleModules.splice(1, 0, { key: EMPLOYEE_MODULE.key, label: EMPLOYEE_MODULE.label, href: EMPLOYEE_MODULE.href });
  }

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader
        appName={appName}
        user={{
          name: user.profile.full_name ?? user.email,
          email: user.email,
          roles: user.roles.map((r) => r.name),
        }}
        modules={visibleModules}
      />
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 sm:px-6 sm:py-7">{children}</main>
      <footer className="border-t py-2.5 text-center text-[11px] text-muted-foreground">
        {appName} · Quality Management
      </footer>
    </div>
  );
}
