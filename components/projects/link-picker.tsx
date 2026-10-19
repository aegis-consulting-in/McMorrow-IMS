"use client";

import { useState } from "react";
import { SearchIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

export type LinkOption = { id: string; label: string; hint?: string; inactive?: boolean };

/**
 * Optional multi-select for mapping records (assets, suppliers) onto a project.
 * A filter box plus a scrollable checklist keeps long lists usable.
 */
export function LinkPicker({
  label,
  options,
  value,
  onChange,
  emptyText,
}: {
  label: string;
  options: LinkOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  emptyText: string;
}) {
  const [query, setQuery] = useState("");
  const selected = new Set(value);
  const q = query.trim().toLowerCase();
  const visible = q ? options.filter((o) => `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(q)) : options;

  const toggle = (id: string) => onChange(selected.has(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {label} <span className="font-normal text-muted-foreground">(optional)</span>
        </p>
        <span className="text-xs text-muted-foreground tabular-nums">{value.length} selected</span>
      </div>
      {options.length ? (
        <>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault(); // don't submit the project form
              }}
              placeholder={`Filter ${label.toLowerCase()}…`}
              className="pl-8"
              aria-label={`Filter ${label.toLowerCase()}`}
            />
          </div>
          <ul className="max-h-48 divide-y overflow-y-auto rounded-md border">
            {visible.length ? (
              visible.map((o) => (
                <li key={o.id}>
                  <label className="flex cursor-pointer items-start gap-2 px-2.5 py-1.5 text-sm hover:bg-muted/40">
                    <Checkbox checked={selected.has(o.id)} onCheckedChange={() => toggle(o.id)} aria-label={`${label}: ${o.label}`} />
                    <span className="min-w-0">
                      <span className="block truncate">
                        {o.label}
                        {o.inactive ? <span className="ml-1.5 text-xs text-muted-foreground">(inactive)</span> : null}
                      </span>
                      {o.hint ? <span className="block truncate text-xs text-muted-foreground">{o.hint}</span> : null}
                    </span>
                  </label>
                </li>
              ))
            ) : (
              <li className="px-2.5 py-3 text-sm text-muted-foreground">No matches.</li>
            )}
          </ul>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      )}
    </div>
  );
}
