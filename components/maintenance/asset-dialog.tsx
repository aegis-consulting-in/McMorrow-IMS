"use client";

import { useState } from "react";
import { PencilIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { MaintenanceAssetRow } from "@/lib/types/database";
import { AssetForm } from "./asset-form";

export function AssetDialog({
  asset,
  departments,
  sites,
  trigger = "button",
}: {
  asset?: MaintenanceAssetRow;
  departments: { id: string; name: string }[];
  sites: { id: string; name: string; is_active: boolean }[];
  trigger?: "button" | "icon";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {trigger === "icon" ? (
        <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)} aria-label="Edit asset">
          <PencilIcon />
        </Button>
      ) : (
        <Button variant={asset ? "outline" : "default"} onClick={() => setOpen(true)}>
          {asset ? <PencilIcon /> : <PlusIcon />} {asset ? "Edit asset" : "New asset"}
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{asset ? `Edit ${asset.name}` : "New asset"}</DialogTitle>
            <DialogDescription>Equipment and instruments that require preventive maintenance.</DialogDescription>
          </DialogHeader>
          <AssetForm asset={asset} departments={departments} sites={sites} onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
