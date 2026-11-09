import type { EstudoApi, FiltroEstadoEstudo } from "../types/estudo";
import type { AuthenticatedUser } from "../types/auth";
import { ehEstadoEstudo } from "../config/estados-estudo";

type UsuarioEstudo = Pick<AuthenticatedUser, "id" | "role">;

export function podeEditarEstudo(estudo: EstudoApi, usuario: UsuarioEstudo): boolean {
    return (
        usuario.role === "RESEARCHER" &&
        usuario.id === estudo.responsibleUserId &&
        (estudo.status === "PLANNING" || estudo.status === "RECRUITMENT")
    );
}

export function podeAlterarEstadoEstudo(estudo: EstudoApi, usuario: UsuarioEstudo): boolean {
    return (
        usuario.role === "RESEARCHER" &&
        usuario.id === estudo.responsibleUserId &&
        ehEstadoEstudo(estudo.status) &&
        estudo.status !== "CLOSED"
    );
}

const formatterMes = new Intl.DateTimeFormat("pt-BR", { month: "short" });

export function formatarMes(data: Date): string {
    return formatterMes.format(data).replace(".", "");
}

export function formatarPeriodo(inicio: string, fim: string): string {
    const dataInicio = new Date(`${inicio}T12:00:00`);
    const dataFim = new Date(`${fim}T12:00:00`);
    const mesInicio = formatarMes(dataInicio);
    const mesFim = formatarMes(dataFim);
    const anoInicio = dataInicio.getFullYear();
    const anoFim = dataFim.getFullYear();

    return anoInicio === anoFim
        ? `${mesInicio}–${mesFim} ${anoFim}`
        : `${mesInicio} ${anoInicio}–${mesFim} ${anoFim}`;
}

export function calcularOcupacao(participantes: number, limite: number): number {
    if (limite <= 0) return 0;
    return Math.min((participantes / limite) * 100, 100);
}

export function filtrarEstudos(
    estudos: EstudoApi[],
    busca: string,
    estado: FiltroEstadoEstudo = ""
): EstudoApi[] {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return estudos.filter(
        (estudo) =>
            estudo.title.toLocaleLowerCase("pt-BR").includes(termo) &&
            (!estado || estudo.status === estado)
    );
}
