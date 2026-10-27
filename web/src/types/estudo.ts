export type DadosEstudoApi = {
    title: string;
    objective: string;
    responsibleUserId: number;
    startDate: string;
    endDate: string;
    participantLimit: number;
};

export type EstudoApi = DadosEstudoApi & { id: number };
