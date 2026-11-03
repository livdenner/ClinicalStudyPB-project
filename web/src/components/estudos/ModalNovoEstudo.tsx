import type { DadosEstudoApi } from "../../types/estudo";
import { ModalEstudo } from "./ModalEstudo";

type ModalNovoEstudoProps = {
    pesquisador: { id: number; name: string };
    onFechar: () => void;
    onCadastrar: (dados: DadosEstudoApi) => Promise<void>;
};

export function ModalNovoEstudo({ pesquisador, onFechar, onCadastrar }: ModalNovoEstudoProps) {
    return <ModalEstudo responsavel={pesquisador} onFechar={onFechar} onSalvar={onCadastrar} />;
}
