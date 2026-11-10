import type { EstadoEstudo } from "../types/estudo";

export const ESTADOS_ESTUDO: Record<
    EstadoEstudo,
    { rotulo: string; classes: string; proximo: EstadoEstudo | null; acao: string | null }
> = {
    PLANNING: {
        rotulo: "Planejamento",
        classes: "bg-[#E9F2FD] text-[#245A91]",
        proximo: "RECRUITMENT",
        acao: "Abrir recrutamento",
    },
    RECRUITMENT: {
        rotulo: "Recrutamento",
        classes: "bg-[#FEF2DA] text-[#946200]",
        proximo: "EXECUTION",
        acao: "Iniciar execução",
    },
    EXECUTION: {
        rotulo: "Em execução",
        classes: "bg-[#E6F4F2] text-[#126966]",
        proximo: "CLOSED",
        acao: "Encerrar estudo",
    },
    CLOSED: {
        rotulo: "Encerrado",
        classes: "bg-[#E4F4E9] text-[#16804B]",
        proximo: null,
        acao: null,
    },
    CANCELLED: {
        rotulo: "Cancelado",
        classes: "bg-[#FDEAEA] text-[#B42318]",
        proximo: null,
        acao: null,
    },
};

export function ehEstadoEstudo(valor: unknown): valor is EstadoEstudo {
    return typeof valor === "string" && Object.keys(ESTADOS_ESTUDO).includes(valor);
}
