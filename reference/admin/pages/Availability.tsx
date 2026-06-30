import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Check, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { useAvailability, type AvailabilityInput } from "@/hooks/useAvailability";
import { generateDaySlots } from "@/lib/slots";
import { cn } from "@/lib/utils";

// Reference admin screen — the pattern every other screen follows: a _kit primitive header,
// a contract-bound hook for all data, theme tokens for styling. External deps the consuming
// app supplies (standard shadcn-style): Button, Modal, FormField (forms). Swap them for your
// own equivalents. No client specifics here — availability fields match the contract 1:1.
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FormField, fieldClassName } from "@/components/forms/FormField";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const schema = z
  .object({
    weekday: z.coerce.number().min(0).max(6),
    start_time: z.string().min(1, "Required"),
    end_time: z.string().min(1, "Required"),
    slot_minutes: z.coerce.number().min(5).max(480),
  })
  .refine((v) => v.end_time > v.start_time, { message: "End must be after start", path: ["end_time"] });

type FormValues = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

function AddWindowModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (input: AvailabilityInput) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { weekday: 1, start_time: "15:00", end_time: "18:00", slot_minutes: 60 },
  });

  const preview = generateDaySlots(
    watch("start_time") || "00:00",
    watch("end_time") || "00:00",
    Number(watch("slot_minutes")) || 60,
  );

  async function onSubmit(values: FormOutput) {
    await onSave(values);
    reset();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose(); }}
      title="Add availability window"
      description="Visitors can book any free slot inside this window."
      footer={
        <>
          <Button variant="secondary" onClick={() => { reset(); onClose(); }} disabled={isSubmitting}>Cancel</Button>
          <Button type="submit" form="availability-form" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Add window"}
          </Button>
        </>
      }
    >
      <form id="availability-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField label="Day of week" htmlFor="weekday" error={errors.weekday?.message} required>
          <select id="weekday" className={fieldClassName(!!errors.weekday)} {...register("weekday")}>
            {WEEKDAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Start" htmlFor="start_time" error={errors.start_time?.message} required>
            <input id="start_time" type="time" className={fieldClassName(!!errors.start_time)} {...register("start_time")} />
          </FormField>
          <FormField label="End" htmlFor="end_time" error={errors.end_time?.message} required>
            <input id="end_time" type="time" className={fieldClassName(!!errors.end_time)} {...register("end_time")} />
          </FormField>
        </div>

        <FormField label="Slot length (minutes)" htmlFor="slot_minutes" error={errors.slot_minutes?.message} required>
          <input id="slot_minutes" type="number" min={5} max={480} step={5}
                 className={fieldClassName(!!errors.slot_minutes)} {...register("slot_minutes")} />
        </FormField>

        <div className="rounded-lg border border-border bg-background p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Preview — {preview.length} slot{preview.length === 1 ? "" : "s"}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {preview.length === 0 ? (
              <span className="text-xs text-muted-foreground">No slots — widen the window.</span>
            ) : (
              preview.map((t) => (
                <span key={t} className="rounded bg-surface px-2 py-1 text-xs text-foreground">{t}</span>
              ))
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
}

export function Availability() {
  const { windows, isLoading, create, toggle, remove } = useAvailability();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Availability"
        description="Define the weekly windows visitors can book consultations in."
        actions={<Button onClick={() => setModalOpen(true)}><Plus className="h-3.5 w-3.5" /> Add window</Button>}
      />

      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Loading availability…</div>
      ) : windows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          No availability yet. Add a window so visitors can book.
        </div>
      ) : (
        <div className="space-y-6">
          {WEEKDAYS.map((dayName, day) => {
            const dayWindows = windows.filter((w) => w.weekday === day);
            if (dayWindows.length === 0) return null;
            return (
              <div key={day} className="rounded-xl border border-border bg-surface p-4 shadow-card">
                <h3 className="mb-3 text-sm font-semibold text-foreground">{dayName}</h3>
                <ul className="space-y-2">
                  {dayWindows.map((w) => (
                    <li key={w.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2">
                      <div className="flex items-center gap-3 text-sm">
                        <span className="font-medium text-foreground">{w.start_time.slice(0, 5)} – {w.end_time.slice(0, 5)}</span>
                        <span className="text-muted-foreground">{w.slot_minutes} min slots</span>
                        <StatusBadge label={w.active ? "Active" : "Off"} tone={w.active ? "green" : "gray"} />
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => toggle({ id: w.id, active: !w.active })}
                          className={cn("rounded-md p-1.5 transition-colors hover:bg-surface",
                            w.active ? "text-muted-foreground hover:text-danger" : "text-muted-foreground hover:text-green-600")}
                          aria-label={w.active ? "Disable" : "Enable"}>
                          {w.active ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                        </button>
                        <button type="button" onClick={() => remove(w.id)}
                          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface hover:text-danger"
                          aria-label="Remove">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      <AddWindowModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={create} />
    </div>
  );
}
