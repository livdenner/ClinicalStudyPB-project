import type { StatusElegibilidadeApi } from "./candidato";

export type TipoCriterioApi = "INCLUSION" | "EXCLUSION";

export type CriterioEstudoApi = {
    id: number;
    studyId: number;
    type: TipoCriterioApi;
    description: string;
};

export type RespostaElegibilidadeApi = {
    criterionId: number;
    matches: boolean;
};

export type DadosAvaliacaoElegibilidadeApi = {
    answers: RespostaElegibilidadeApi[];
};

export type AvaliacaoElegibilidadeApi = {
    studyId: number;
    candidateId: number;
    status: StatusElegibilidadeApi;
    answers: RespostaElegibilidadeApi[];
    evaluatedAt?: string;
};

export const TIPO_CRITERIO_LABELS: Record<TipoCriterioApi, string> = {
    INCLUSION: "Critério de inclusão",
    EXCLUSION: "Critério de exclusão",
};
