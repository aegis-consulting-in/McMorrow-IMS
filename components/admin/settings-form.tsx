"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormError, FormField, FormGrid } from "@/components/ui/form-field";
import { saveSystemSettingsAction } from "@/lib/actions/admin";
import { useAction } from "@/lib/hooks/use-action";
import { systemSettingsSchema } from "@/lib/validation/admin";

type Values = z.input<typeof systemSettingsSchema>;

export function SystemSettingsForm({ defaults }: { defaults: Values }) {
  const router = useRouter();
  const form = useForm<Values>({ resolver: zodResolver(systemSettingsSchema), defaultValues: defaults });
  const { run, isPending, error, fieldErrors } = useAction(saveSystemSettingsAction, {
    successMessage: "Settings saved.",
    onSuccess: () => router.refresh(),
  });
  const err = (k: keyof Values) => form.formState.errors[k]?.message ?? fieldErrors[k];

  return (
    <form onSubmit={form.handleSubmit((v) => run(v))} className="flex flex-col gap-5" noValidate>
      <FormError message={error} />
      <FormGrid>
        <FormField label="Application name" htmlFor="appName" required error={err("appName")}>
          <Input id="appName" {...form.register("appName")} />
        </FormField>
        <FormField label="Organisation" htmlFor="organisation" required error={err("organisation")}>
          <Input id="organisation" {...form.register("organisation")} />
        </FormField>
        <FormField
          label="Reminder email: From"
          htmlFor="reminderFromEmail"
          required
          error={err("reminderFromEmail")}
          hint="Sender address shown on every reminder email."
          className="md:col-span-2"
        >
          <Input id="reminderFromEmail" type="email" placeholder="no-reply@example.com" {...form.register("reminderFromEmail")} />
        </FormField>
        <FormField label="Equipment reminder email" htmlFor="equipmentReminderEmail" required error={err("equipmentReminderEmail")}>
          <Input id="equipmentReminderEmail" type="email" {...form.register("equipmentReminderEmail")} />
        </FormField>
        <FormField label="Supplier reminder email" htmlFor="supplierReminderEmail" required error={err("supplierReminderEmail")}>
          <Input id="supplierReminderEmail" type="email" {...form.register("supplierReminderEmail")} />
        </FormField>
        <FormField
          label="Reminder lead days"
          htmlFor="reminderLeadDays"
          required
          error={err("reminderLeadDays")}
          hint="Applies to all reminders (training, equipment, supplier). Comma-separated days before the due date, saved in descending order, e.g. 14, 7"
          className="md:col-span-2"
        >
          <Input id="reminderLeadDays" {...form.register("reminderLeadDays")} />
        </FormField>
      </FormGrid>
      <div>
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2Icon className="animate-spin" /> : null} Save settings
        </Button>
      </div>
    </form>
  );
}
