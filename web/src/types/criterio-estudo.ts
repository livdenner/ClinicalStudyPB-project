export type TipoCriterioEstudo = "INCLUSION" | "EXCLUSION";

export type DadosCriterioEstudo = {
    type: TipoCriterioEstudo;
    description: string;
};

export type CriterioEstudo = DadosCriterioEstudo & {
    id: number;
    studyId: number;
};

export const TIPOS_CRITERIO_ESTUDO: Record<TipoCriterioEstudo, string> = {
    INCLUSION: "Inclusão",
    EXCLUSION: "Exclusão",
};
