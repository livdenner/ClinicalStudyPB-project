import type { DadosEstudoApi, EstudoApi } from "../../types/estudo";
import { ModalEstudo } from "./ModalEstudo";

type ModalEditarEstudoProps = {
    estudo: EstudoApi;
    pesquisador: { id: number; name: string };
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
        />
    );
}
