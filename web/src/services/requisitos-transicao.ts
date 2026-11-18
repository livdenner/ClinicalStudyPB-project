import { apiRequest } from "./api/apiClient";
import { listarCriteriosEstudo } from "./criterios-estudo";
import { listarParticipantesPorEstudo } from "./participantes";
import { listarVisitasPrevistas } from "./visitas-previstas";
import type { EstadoEstudo } from "../types/estudo";

export async function verificarRequisitosTransicao(
    studyId: number,
    estado: EstadoEstudo,
    token: string,
    signal: AbortSignal
): Promise<string | null> {
    if (estado === "PLANNING") {
        const [criterios, visitas] = await Promise.all([
            listarCriteriosEstudo(studyId, token, signal),
            listarVisitasPrevistas(studyId, token, signal),
        ]);
        const motivos: string[] = [];
        if (!criterios.some((item) => item.type === "INCLUSION"))
            motivos.push("Cadastre ao menos um critério de inclusão.");
        if (!criterios.some((item) => item.type === "EXCLUSION"))
            motivos.push("Cadastre ao menos um critério de exclusão.");
        if (!visitas.some((item) => item.activities.length > 0))
            motivos.push("Cadastre uma visita prevista com atividade.");
        return motivos.length ? motivos.join(" ") : null;
    }
    if (estado === "RECRUITMENT") {
        const participantes = await listarParticipantesPorEstudo(studyId, token, signal);
        return participantes.length
            ? null
            : "Inclua ao menos um participante antes de iniciar a execução.";
    }
    if (estado === "EXECUTION") {
        const visitas = await apiRequest<unknown[]>(
            `/api/studies/${studyId}/visits?status=SCHEDULED`,
            { token, signal }
        );
        return visitas.length
            ? "Registre o desfecho das visitas agendadas antes de encerrar o estudo."
            : null;
    }
    return null;
}
