import type { UserRole } from "../types/auth";
import type { EstadoEstudo } from "../types/estudo";
import type { VisitaAgendada } from "../types/visita-agendada";

/** Oferece desfecho somente ao coordenador, em visita agendada e estudo editável. @author Lívia */
export function podeRegistrarDesfecho(
    role: UserRole,
    estado: EstadoEstudo,
    visita: VisitaAgendada
): boolean {
    return (
        role === "COORDINATOR" &&
        (estado === "PLANNING" || estado === "RECRUITMENT" || estado === "EXECUTION") &&
        visita.status === "SCHEDULED" &&
        Number.isSafeInteger(visita.version) &&
        visita.version >= 0
    );
}
