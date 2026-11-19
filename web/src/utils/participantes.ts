export const SELOS_PARTICIPANTE = {
    inclusao: {
        rotulo: "Incluído",
        classes: "bg-[var(--color-success-soft)] text-[var(--color-success)]",
    },
    ACTIVE: { rotulo: "Ativo", classes: "bg-[var(--color-info-soft)] text-[var(--color-info)]" },
    WITHDRAWN: {
        rotulo: "Retirado",
        classes: "bg-[var(--color-neutral-soft)] text-[var(--color-neutral)]",
    },
    indisponivel: {
        rotulo: "Situação indisponível",
        classes: "bg-[var(--color-neutral-soft)] text-[var(--color-neutral)]",
    },
};

export function formatarDataInclusao(includedAt: string): string {
    const data = new Date(includedAt);
    return Number.isNaN(data.getTime())
        ? "—"
        : data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}
