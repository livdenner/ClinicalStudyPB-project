import { useEffect, useState } from "react";
import { toast } from "@heroui/react";
import { ApiClientError } from "../../services/api/apiClient";
import {
    alterarEstadoEstudo,
    editarEstudo,
    obterEstudo,
    obterHistoricoEstadoEstudo,
} from "../../services/estudos";
import type { AuthenticatedUser } from "../../types/auth";
import type { DadosEstudoApi, EstadoEstudo, EstudoApi } from "../../types/estudo";
import { podeEditarEstudo, podeAlterarEstadoEstudo } from "../../utils/estudos";
import { obterMensagemErroAcesso } from "../../utils/erros-api";

type Props = {
    id: number;
    token: string;
    pesquisador: AuthenticatedUser;
};

export function useDetalhesEstudo({ id, token, pesquisador }: Props) {
    const [estudo, setEstudo] = useState<EstudoApi | null>(null);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState<{
        mensagem: string;
        status: number | null;
    } | null>(null);
    const [origemCancelamento, setOrigemCancelamento] = useState<EstadoEstudo | null>(null);
    const [tentativa, setTentativa] = useState(0);
    const [editando, setEditando] = useState(false);
    const [transicao, setTransicao] = useState<EstadoEstudo | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        obterEstudo(id, token, controller.signal)
            .then(async (dados) => {
                let origem: EstadoEstudo | null = null;
                if (dados.status === "CANCELLED" && podeAlterarEstadoEstudo(dados, pesquisador)) {
                    const historico = await obterHistoricoEstadoEstudo(
                        id,
                        token,
                        controller.signal
                    );
                    const ultimo = historico[historico.length - 1];
                    if (ultimo?.toStatus === "CANCELLED") origem = ultimo.fromStatus;
                }
                if (!controller.signal.aborted) {
                    setOrigemCancelamento(origem);
                    setEstudo(dados);
                }
            })
            .catch((error: unknown) => {
                if (controller.signal.aborted) return;
                const status = error instanceof ApiClientError ? error.status : null;
                const mensagem =
                    obterMensagemErroAcesso(error) ??
                    "Não foi possível carregar o estudo. Verifique a conexão e tente novamente.";
                setErro({ mensagem, status });
            })
            .finally(() => {
                if (!controller.signal.aborted) setCarregando(false);
            });
        return () => controller.abort();
    }, [id, token, tentativa, pesquisador]);

    async function salvar(dados: DadosEstudoApi) {
        if (!estudo) return;
        if (!podeEditarEstudo(estudo, pesquisador)) {
            throw new ApiClientError(
                "Não é permitido editar este estudo com o usuário ou estado atual.",
                { status: 403 }
            );
        }
        const atualizado = await editarEstudo(
            estudo.id,
            {
                ...dados,
                responsibleUserId: estudo.responsibleUserId,
            },
            token
        );
        setEstudo(atualizado);
        setEditando(false);
        toast.success("Estudo atualizado com sucesso.");
    }

    async function transicionar(justificativa?: string) {
        if (!estudo || !transicao) return;
        if (!podeAlterarEstadoEstudo(estudo, pesquisador)) {
            throw new ApiClientError("Você não tem permissão para alterar o estado deste estudo.", {
                status: 403,
            });
        }
        let atualizado: EstudoApi;
        try {
            atualizado = await alterarEstadoEstudo(
                estudo.id,
                {
                    status: transicao,
                    expectedStatus: estudo.status,
                    ...(transicao === "CANCELLED" ? { reason: justificativa } : {}),
                },
                token
            );
        } catch (error) {
            if (!(error instanceof ApiClientError) || error.status !== 409) throw error;
            let atual: EstudoApi;
            try {
                atual = await obterEstudo(estudo.id, token);
            } catch {
                throw new ApiClientError(
                    "Não foi possível conferir o estado atual. Atualize o estudo antes de tentar novamente.",
                    { status: 409, code: "STUDY_REFRESH_REQUIRED" }
                );
            }
            if (atual.status !== estudo.status || atual.version !== estudo.version) {
                throw new ApiClientError(
                    "O estudo foi alterado. Atualize os dados antes de tentar novamente.",
                    { status: 409, code: "STUDY_REFRESH_REQUIRED" }
                );
            }
            throw error;
        }
        setOrigemCancelamento(transicao === "CANCELLED" ? estudo.status : null);
        setEstudo(atualizado);
        setTransicao(null);
        toast.success("Estado do estudo atualizado com sucesso.");
    }

    function atualizarEstudo() {
        setTransicao(null);
        setCarregando(true);
        setErro(null);
        setTentativa((atual) => atual + 1);
    }

    return {
        estudo,
        carregando,
        erro,
        origemCancelamento,
        editando,
        setEditando,
        transicao,
        setTransicao,
        salvar,
        transicionar,
        atualizarEstudo,
    };
}
