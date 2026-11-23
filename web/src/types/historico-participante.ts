import type { ParticipanteApi } from "./participante";
import type { ResultadoAtividade } from "./resultado-atividade";
import type { VisitaAgendada } from "./visita-agendada";

export type VisitaHistoricoParticipante = VisitaAgendada & {
    results: ResultadoAtividade[];
};

export interface HistoricoParticipanteApi {
    participant: ParticipanteApi;
    visits: VisitaHistoricoParticipante[];
}
