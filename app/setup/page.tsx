import type { Metadata } from "next";
import { DatabaseZapIcon } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/env";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Setup required" };

/**
 * Shown by the proxy whenever the Supabase environment variables are missing,
 * so a fresh clone explains itself instead of crashing.
 */
export default function SetupPage() {
  if (isSupabaseConfigured()) redirect("/");

  return (
    <div className="flex min-h-full items-center justify-center bg-background p-4">
      <div className="w-full max-w-xl rounded-lg border bg-card p-6">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-md bg-brand/10 text-brand">
            <DatabaseZapIcon className="size-5" />
          </span>
          <div>
            <h1 className="font-heading text-lg font-semibold">Supabase is not configured</h1>
            <p className="text-sm text-muted-foreground">McMorrow IMS needs a Supabase project before it can start.</p>
          </div>
        </div>

        <ol className="mt-5 flex flex-col gap-3 text-sm">
          <li className="rounded-lg border bg-muted/40 p-3">
            <p className="font-medium">1. Create a Supabase project</p>
            <p className="text-muted-foreground">Follow <code className="rounded bg-muted px-1">docs/SUPABASE_SETUP.md</code> in this repository.</p>
          </li>
          <li className="rounded-lg border bg-muted/40 p-3">
            <p className="font-medium">2. Copy the environment file</p>
            <pre className="mt-1 overflow-x-auto rounded bg-foreground/90 p-2 text-xs text-white">cp .env.example .env.local</pre>
          </li>
          <li className="rounded-lg border bg-muted/40 p-3">
            <p className="font-medium">3. Fill in the keys</p>
            <pre className="mt-1 overflow-x-auto rounded bg-foreground/90 p-2 text-xs text-white">{`NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # server only`}</pre>
          </li>
          <li className="rounded-lg border bg-muted/40 p-3">
            <p className="font-medium">4. Run migrations + seed, then restart the dev server</p>
            <pre className="mt-1 overflow-x-auto rounded bg-foreground/90 p-2 text-xs text-white">{`# Apply supabase/migrations/*.sql then supabase/seed.sql in the SQL editor
npm run seed
npm run dev`}</pre>
          </li>
        </ol>
      </div>
    </div>
  );
}
