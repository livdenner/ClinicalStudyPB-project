export type EstudoPrototipo = {
  id: number;
  title: string;
  objective: string;
  lead: string;
  dates: string;
  limit: number;
  participants: number;
  status: string;
};

export type StatusCandidato = "Pendente" | "Elegível" | "Não elegível";

export type CandidatoPrototipo = {
  id: number;
  name: string;
  studyId: number;
  age: number;
  status: StatusCandidato;
  notes: string;
};

export type ParticipantePrototipo = {
  id: number;
  name: string;
  studyId: number;
  status: string;
  origin: string;
};

export type StatusVisita = "Agendada" | "Realizada" | "Pendente";

export type VisitaPrototipo = {
  id: number;
  participantId: number;
  studyId: number;
  date: string;
  type: string;
  status: StatusVisita;
  notes?: string;
};

export const initialStudies: EstudoPrototipo[] = [
  {
    id: 1,
    title: "Acompanhamento cardiovascular",
    objective:
      "Acompanhar indicadores cardiovasculares e a adesão ao plano de acompanhamento.",
    lead: "Dra. Helena Costa",
    dates: "Jan–Dez 2026",
    limit: 120,
    participants: 84,
    status: "Em execução",
  },
  {
    id: 2,
    title: "Avaliação de hábitos de sono",
    objective:
      "Avaliar hábitos de sono por meio dos registros previstos no protocolo.",
    lead: "Dr. Marcos Oliveira",
    dates: "Fev–Nov 2026",
    limit: 60,
    participants: 36,
    status: "Recrutamento",
  },
  {
    id: 3,
    title: "Bem-estar e qualidade de vida",
    objective:
      "Acompanhar indicadores declarados de bem-estar e qualidade de vida.",
    lead: "Dra. Camila Mendes",
    dates: "Mar–Dez 2026",
    limit: 80,
    participants: 18,
    status: "Planejamento",
  },
  {
    id: 4,
    title: "Rotina e saúde preventiva",
    objective:
      "Registrar o acompanhamento preventivo conforme protocolo aprovado.",
    lead: "Dr. Paulo Nunes",
    dates: "Jan–Ago 2026",
    limit: 60,
    participants: 60,
    status: "Encerrado",
  },
];

export const initialCandidates: CandidatoPrototipo[] = [
  {
    id: 1,
    name: "Candidato 014",
    studyId: 2,
    age: 42,
    status: "Pendente",
    notes: "Aguardando confirmação das informações cadastrais.",
  },
  {
    id: 2,
    name: "Candidato 021",
    studyId: 1,
    age: 51,
    status: "Elegível",
    notes: "Critérios documentados atendidos.",
  },
  {
    id: 3,
    name: "Candidato 027",
    studyId: 2,
    age: 35,
    status: "Não elegível",
    notes: "Um critério previsto no protocolo não foi atendido.",
  },
  {
    id: 4,
    name: "Candidato 031",
    studyId: 1,
    age: 47,
    status: "Pendente",
    notes: "Avaliação ainda não registrada.",
  },
];

export const initialParticipants: ParticipantePrototipo[] = [
  {
    id: 1,
    name: "Participante 001",
    studyId: 1,
    status: "Em acompanhamento",
    origin: "Candidato 002",
  },
  {
    id: 2,
    name: "Participante 018",
    studyId: 2,
    status: "Em acompanhamento",
    origin: "Candidato 019",
  },
  {
    id: 3,
    name: "Participante 034",
    studyId: 1,
    status: "Acompanhamento concluído",
    origin: "Candidato 041",
  },
];

export const initialVisits: VisitaPrototipo[] = [
  {
    id: 1,
    participantId: 1,
    studyId: 1,
    date: "2026-05-18",
    type: "Visita de acompanhamento",
    status: "Agendada",
  },
  {
    id: 2,
    participantId: 2,
    studyId: 2,
    date: "2026-05-16",
    type: "Avaliação inicial",
    status: "Pendente",
  },
  {
    id: 3,
    participantId: 3,
    studyId: 1,
    date: "2026-05-10",
    type: "Visita de encerramento",
    status: "Realizada",
    notes: "Acompanhamento registrado conforme protocolo.",
  },
];

export function formatarDataPrototipo(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR");
}
