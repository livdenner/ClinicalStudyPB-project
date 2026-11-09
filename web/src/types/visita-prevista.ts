export type DadosAtividadePrevista = {
    id?: number;
    name: string;
    description: string;
};

export type AtividadePrevista = DadosAtividadePrevista & {
    id: number;
    position: number;
};

export type DadosVisitaPrevista = {
    name: string;
    plannedDate: string;
    position: number;
    activities: DadosAtividadePrevista[];
};

export type VisitaPrevista = Omit<DadosVisitaPrevista, "activities"> & {
    id: number;
    studyId: number;
    activities: AtividadePrevista[];
};
