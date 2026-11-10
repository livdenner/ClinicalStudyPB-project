import type { DadosEstudoApi, EstudoApi } from "../../types/estudo";
import { ModalEstudo } from "./ModalEstudo";
import type { AuthenticatedUser } from "../../types/auth";
import { podeEditarEstudo } from "../../utils/estudos";

type ModalEditarEstudoProps = {
    estudo: EstudoApi;
    pesquisador: Pick<AuthenticatedUser, "id" | "name" | "role">;
    onFechar: () => void;
    onSalvar: (dados: DadosEstudoApi) => Promise<void>;
};

export function ModalEditarEstudo({
    estudo,
    pesquisador,
    onFechar,
    onSalvar,
}: ModalEditarEstudoProps) {
    const responsavel = {
        id: estudo.responsibleUserId,
        name:
            estudo.responsibleUserId === pesquisador.id
                ? pesquisador.name
                : `Pesquisador #${estudo.responsibleUserId}`,
    };

    return (
        <ModalEstudo
            estudo={estudo}
            responsavel={responsavel}
            onFechar={onFechar}
            onSalvar={onSalvar}
            somenteLeitura={!podeEditarEstudo(estudo, pesquisador)}
        />
    );
}
