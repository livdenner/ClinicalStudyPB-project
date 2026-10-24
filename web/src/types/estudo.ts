export type StatusEstudo =
  | "Planejamento"
  | "Recrutamento"
  | "Em execução"
  | "Encerrado";

export type Estudo = {
  id: string;
  titulo: string;
  responsavel: string;
  participantes: number;
  limiteParticipantes: number;
  dataInicio: string;
  dataFim: string;
  status: StatusEstudo;
};
