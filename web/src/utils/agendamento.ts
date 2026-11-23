import { parseDateTime, toZoned } from "@internationalized/date";
import type { UserRole } from "../types/auth";
import type { StatusEstudoCandidato } from "../types/candidato";
import type { ParticipanteApi } from "../types/participante";

export const FUSO_AGENDAMENTO = "America/Fortaleza";

/** Confere as condições públicas para oferecer o agendamento ao coordenador. @author Lívia */
export function podeAgendarVisita(
    role: UserRole,
    statusEstudo: StatusEstudoCandidato | undefined,
    participante: ParticipanteApi
): boolean {
    return (
        role === "COORDINATOR" &&
        participante.status === "ACTIVE" &&
        (statusEstudo === "RECRUITMENT" || statusEstudo === "EXECUTION")
    );
}

/** Converte o horário de Fortaleza em um instante ISO, sem usar o fuso do dispositivo. @author Lívia */
export function converterHorarioAgendamento(valor: string): string {
    return toZoned(parseDateTime(valor), FUSO_AGENDAMENTO, "reject").toAbsoluteString();
}

/** Apresenta o instante da API no mesmo fuso adotado pelo contrato. @author Lívia */
export function formatarHorarioAgendamento(iso: string): string {
    const data = new Date(iso);
    if (Number.isNaN(data.getTime())) return "Data indisponível";
    return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: FUSO_AGENDAMENTO,
    }).format(data);
}
