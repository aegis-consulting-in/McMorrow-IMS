import { ShieldCheckIcon } from "lucide-react";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-full lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-brand px-10 py-12 text-brand-foreground lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-md bg-white/15">
            <ShieldCheckIcon className="size-5" />
          </span>
          <span className="font-heading text-lg font-semibold tracking-tight">McMorrow IMS</span>
        </div>
        <div>
          <p className="text-xs font-medium tracking-[0.14em] text-white/60 uppercase">Quality Management</p>
          <h1 className="font-heading mt-3 max-w-sm text-3xl font-semibold tracking-tight">
            Training, compliance and records in one place.
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/75">
            Sign in with your organisation account. Access is limited to the modules your role allows.
          </p>
        </div>
        <p className="text-xs text-white/50">Internal use only</p>
      </div>
      <main className="flex items-center justify-center bg-background p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <p className="font-heading text-lg font-semibold">McMorrow IMS</p>
            <p className="text-sm text-muted-foreground">Quality Management System</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
