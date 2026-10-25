import type { Estudo, StatusEstudo } from "../types/estudo";

export type FiltroStatus = "Todos os status" | StatusEstudo;

export const statusDisponiveis: FiltroStatus[] = [
    "Todos os status",
    "Planejamento",
    "Recrutamento",
    "Em execução",
    "Encerrado",
];

const formatterMes = new Intl.DateTimeFormat("pt-BR", { month: "short" }); //abreviar o nome do mês

export function formatarPeriodo(inicio: string, fim: string): string {
    const dataInicio = new Date(`${inicio}T12:00:00`);
    const dataFim = new Date(`${fim}T12:00:00`);
    const mesInicio = formatterMes.format(dataInicio).replace(".", "");
    const mesFim = formatterMes.format(dataFim).replace(".", "");

    return `${mesInicio}–${mesFim} ${dataFim.getFullYear()}`;
}

export function calcularOcupacao(participantes: number, limite: number): number {
    if (limite <= 0) return 0;
    return Math.min((participantes / limite) * 100, 100);
}

export function contarEstudosPorStatus(estudos: Estudo[], status: StatusEstudo): number {
    return estudos.filter((estudo) => estudo.status === status).length;
}

export function filtrarEstudos(
    estudos: Estudo[],
    busca: string,
    filtroStatus: FiltroStatus
): Estudo[] {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");

    return estudos.filter((estudo) => {
        const correspondeTitulo = estudo.titulo.toLocaleLowerCase("pt-BR").includes(termo);
        const correspondeStatus =
            filtroStatus === "Todos os status" || estudo.status === filtroStatus;
        return correspondeTitulo && correspondeStatus;
    });
}
