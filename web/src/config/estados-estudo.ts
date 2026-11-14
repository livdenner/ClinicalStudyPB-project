import type { EstadoEstudo } from "../types/estudo";

export const ESTADOS_ESTUDO: Record<
    EstadoEstudo,
    { rotulo: string; classes: string; proximo: EstadoEstudo | null; acao: string | null }
> = {
    PLANNING: {
        rotulo: "Planejamento",
        classes:
            "border border-[var(--color-neutral-border)] bg-[var(--color-surface)] text-[var(--color-neutral)]",
        proximo: "RECRUITMENT",
        acao: "Abrir recrutamento",
    },
    RECRUITMENT: {
        rotulo: "Recrutamento",
        classes: "bg-[var(--color-study-recruitment-soft)] text-[var(--color-study-recruitment)]",
        proximo: "EXECUTION",
        acao: "Iniciar execução",
    },
    EXECUTION: {
        rotulo: "Em execução",
        classes: "bg-[var(--color-study-execution-soft)] text-[var(--color-study-execution)]",
        proximo: "CLOSED",
        acao: "Encerrar estudo",
    },
    CLOSED: {
        rotulo: "Encerrado",
        classes: "bg-[var(--color-study-closed-soft)] text-[var(--color-study-closed)]",
        proximo: null,
        acao: null,
    },
    CANCELLED: {
        rotulo: "Cancelado",
        classes: "bg-[var(--color-error-soft)] text-[var(--color-error)]",
        proximo: null,
        acao: null,
    },
};

export function ehEstadoEstudo(valor: unknown): valor is EstadoEstudo {
    return typeof valor === "string" && Object.keys(ESTADOS_ESTUDO).includes(valor);
}
