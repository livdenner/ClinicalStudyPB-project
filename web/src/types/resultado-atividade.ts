import type { StatusVisitaAgendada } from "./visita-agendada";

/** Dados fictícios enviados ao registrar ou substituir o resultado de uma atividade. @author Lívia */
export type DadosResultadoAtividade = {
    value: string;
    note?: string;
};

/** Resultado persistido e identificação da última gravação retornados pela API. @author Lívia */
export type ResultadoAtividade = DadosResultadoAtividade & {
    visitId: number;
    activityId: number;
    recordedByUserId: number;
    recordedAt: string;
};

/** Atividade na ordem do protocolo, acompanhada do resultado quando existir. @author Lívia */
export type AtividadeComResultado = {
    activityId: number;
    name: string;
    description: string;
    position: number;
    result?: ResultadoAtividade;
};

/** Consulta RF14 das atividades e dos resultados de uma visita agendada. @author Lívia */
export type ResultadosVisita = {
    visitId: number;
    plannedVisitId: number;
    plannedVisitName: string;
    status: StatusVisitaAgendada;
    activities: AtividadeComResultado[];
};
