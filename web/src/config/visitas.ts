import type { StatusVisitaAgendada } from "../types/visita-agendada";

/** Cores semânticas compartilhadas pelas listas e pelo feedback de visitas. @author Lívia */
export const STATUS_VISITA_CLASSES: Record<StatusVisitaAgendada, string> = {
    SCHEDULED: "bg-[var(--color-neutral-soft)] text-[var(--color-neutral)]",
    DONE: "bg-[var(--color-success-soft)] text-[var(--color-success)]",
    ABSENT: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
    CANCELLED: "bg-[var(--color-error-soft)] text-[var(--color-error)]",
};
