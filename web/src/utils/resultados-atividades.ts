import type { AuthenticatedUser } from "../types/auth";
import type { EstudoApi } from "../types/estudo";

/** Confere perfil, responsabilidade e estado do estudo para oferecer escrita RF14. @author Lívia */
export function pesquisadorPodeRegistrarResultados(
    usuario: Pick<AuthenticatedUser, "id" | "role">,
    estudo: EstudoApi
): boolean {
    return (
        usuario.role === "RESEARCHER" &&
        estudo.responsibleUserId === usuario.id &&
        (estudo.status === "PLANNING" ||
            estudo.status === "RECRUITMENT" ||
            estudo.status === "EXECUTION")
    );
}
