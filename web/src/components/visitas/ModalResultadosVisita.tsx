import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Modal } from "@heroui/react";
import { X } from "lucide-react";
import { ApiClientError } from "../../services/api/apiClient";
import { obterEstudo } from "../../services/estudos";
import {
    consultarResultadosVisita,
    salvarResultadoAtividade,
} from "../../services/resultados-atividades";
import type { AuthenticatedUser } from "../../types/auth";
import type { EstudoApi } from "../../types/estudo";
import type {
    DadosResultadoAtividade,
    ResultadoAtividade,
    ResultadosVisita,
} from "../../types/resultado-atividade";
import { STATUS_VISITA_LABELS, type VisitaAgendada } from "../../types/visita-agendada";
import { pesquisadorPodeRegistrarResultados } from "../../utils/resultados-atividades";
import { FormularioResultadoAtividade } from "./FormularioResultadoAtividade";

type Props = {
    visita: VisitaAgendada;
    usuario: Pick<AuthenticatedUser, "id" | "role">;
    token: string;
    onFechar: () => void;
    onEstudoAtualizado: (estudo: EstudoApi) => void;
};

function mensagemErro(error: unknown, padrao: string): string {
    return error instanceof ApiClientError ? error.message : padrao;
}

/** Consulta os dados persistidos e coordena gravações independentes de cada atividade. @author Lívia */
export function ModalResultadosVisita({
    visita,
    usuario,
    token,
    onFechar,
    onEstudoAtualizado,
}: Props) {
    const [dados, setDados] = useState<ResultadosVisita | null>(null);
    const [estudoAtual, setEstudoAtual] = useState<EstudoApi | null>(null);
    const [carregando, setCarregando] = useState(true);
    const [erroCarregamento, setErroCarregamento] = useState("");
    const [tentativa, setTentativa] = useState(0);
    const [atividadeSalvando, setAtividadeSalvando] = useState<number | null>(null);
    const [atualizando, setAtualizando] = useState(false);
    const [requerAtualizacao, setRequerAtualizacao] = useState(false);
    const [erroAtualizacao, setErroAtualizacao] = useState("");
    const [erroOperacao, setErroOperacao] = useState<{
        activityId: number;
        mensagem: string;
    } | null>(null);
    const [acessoNegado, setAcessoNegado] = useState(false);
    const enviandoRef = useRef(false);
    const atualizandoRef = useRef(false);
    const ocupado = atividadeSalvando !== null || atualizando;

    const consultarContexto = useCallback(
        (signal?: AbortSignal) =>
            Promise.all([
                consultarResultadosVisita(visita, token, signal),
                obterEstudo(visita.studyId, token, signal),
            ]),
        [visita, token]
    );

    const aplicarContexto = useCallback(
        ([resultados, estudo]: [ResultadosVisita, EstudoApi]) => {
            setDados(resultados);
            setEstudoAtual(estudo);
            setRequerAtualizacao(false);
            setErroAtualizacao("");
            onEstudoAtualizado(estudo);
        },
        [onEstudoAtualizado]
    );

    useEffect(() => {
        const controller = new AbortController();
        consultarContexto(controller.signal)
            .then((contexto) => {
                if (!controller.signal.aborted) aplicarContexto(contexto);
            })
            .catch((error: unknown) => {
                if (!controller.signal.aborted)
                    setErroCarregamento(
                        mensagemErro(
                            error,
                            "Não foi possível consultar os resultados. Tente novamente."
                        )
                    );
            })
            .finally(() => {
                if (!controller.signal.aborted) setCarregando(false);
            });
        return () => controller.abort();
    }, [consultarContexto, aplicarContexto, tentativa]);

    async function atualizarDados() {
        if (atualizandoRef.current) return;
        atualizandoRef.current = true;
        setAtualizando(true);
        setErroAtualizacao("");
        try {
            aplicarContexto(await consultarContexto());
        } catch (error) {
            setRequerAtualizacao(true);
            setErroAtualizacao(
                mensagemErro(
                    error,
                    "Não foi possível atualizar os dados. Atualize antes de salvar novamente."
                )
            );
        } finally {
            atualizandoRef.current = false;
            setAtualizando(false);
        }
    }

    const podeEditar = Boolean(
        dados &&
        estudoAtual &&
        dados.status === "DONE" &&
        !acessoNegado &&
        pesquisadorPodeRegistrarResultados(usuario, estudoAtual)
    );

    async function salvar(
        activityId: number,
        formulario: DadosResultadoAtividade
    ): Promise<ResultadoAtividade> {
        if (
            !dados ||
            !podeEditar ||
            ocupado ||
            enviandoRef.current ||
            atualizandoRef.current ||
            requerAtualizacao ||
            !dados.activities.some((atividade) => atividade.activityId === activityId)
        ) {
            throw new ApiClientError(
                "O registro de resultados não está disponível. Confira os dados atuais da visita.",
                { status: 409 }
            );
        }
        enviandoRef.current = true;
        setAtividadeSalvando(activityId);
        setErroOperacao(null);
        try {
            const resultado = await salvarResultadoAtividade(visita, activityId, formulario, token);
            setDados((anteriores) =>
                anteriores
                    ? {
                          ...anteriores,
                          activities: anteriores.activities.map((atividade) =>
                              atividade.activityId === resultado.activityId
                                  ? { ...atividade, result: resultado }
                                  : atividade
                          ),
                      }
                    : anteriores
            );
            return resultado;
        } catch (error) {
            setErroOperacao({
                activityId,
                mensagem: mensagemErro(
                    error,
                    "Não foi possível salvar o resultado. Tente novamente."
                ),
            });
            if (error instanceof ApiClientError) {
                if (error.status === 401 || error.status === 403) setAcessoNegado(true);
                if (error.status === 409 || error.status === 404 || error.status === 403) {
                    setRequerAtualizacao(true);
                    await atualizarDados();
                }
            }
            throw error;
        } finally {
            enviandoRef.current = false;
            setAtividadeSalvando(null);
        }
    }

    const atividades = dados
        ? [...dados.activities].sort(
              (a, b) => a.position - b.position || a.activityId - b.activityId
          )
        : [];
    const erroSemAtividade =
        erroOperacao &&
        !atividades.some((atividade) => atividade.activityId === erroOperacao.activityId);

    return (
        <Modal>
            <Modal.Backdrop
                isOpen
                isDismissable={!ocupado}
                isKeyboardDismissDisabled={ocupado}
                onOpenChange={(aberto) => {
                    if (!aberto && !ocupado) onFechar();
                }}
                className="bg-black/45"
            >
                <Modal.Container placement="center" scroll="inside" className="p-4">
                    <Modal.Dialog
                        aria-labelledby="resultados-visita-heading"
                        className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-0 text-[var(--color-text)] shadow-xl"
                    >
                        <Modal.Header className="shrink-0 flex-row items-start justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
                            <Modal.Heading
                                id="resultados-visita-heading"
                                className="text-xl font-bold text-[var(--color-title)]"
                            >
                                Resultados da visita
                            </Modal.Heading>
                            <Button
                                type="button"
                                variant="ghost"
                                isIconOnly
                                aria-label="Fechar resultados"
                                isDisabled={ocupado}
                                onPress={onFechar}
                            >
                                <X size={20} aria-hidden="true" />
                            </Button>
                        </Modal.Header>
                        <Modal.Body
                            className="mx-0 flex w-full min-w-0 flex-col gap-4 p-5"
                            aria-busy={carregando || ocupado}
                        >
                            <p className="break-words text-sm">
                                <strong>
                                    {dados?.plannedVisitName ?? visita.plannedVisitName}
                                </strong>{" "}
                                · {visita.participantName}
                                <br />
                                Situação: {STATUS_VISITA_LABELS[dados?.status ?? visita.status]}
                            </p>
                            {carregando ? (
                                <p role="status" className="text-sm text-[var(--color-muted)]">
                                    Consultando atividades e resultados...
                                </p>
                            ) : erroCarregamento ? (
                                <div className="flex flex-col items-start gap-2">
                                    <p role="alert" className="text-sm text-[var(--color-error)]">
                                        {erroCarregamento}
                                    </p>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onPress={() => {
                                            setCarregando(true);
                                            setErroCarregamento("");
                                            setTentativa((atual) => atual + 1);
                                        }}
                                    >
                                        Tentar novamente
                                    </Button>
                                </div>
                            ) : (
                                dados && (
                                    <>
                                        {podeEditar ? (
                                            <p className="text-sm text-[var(--color-muted)]">
                                                Resultados fictícios em texto livre. Salve cada
                                                atividade separadamente; fechar descarta os campos
                                                não salvos.
                                            </p>
                                        ) : (
                                            <p
                                                role="note"
                                                className="rounded-lg bg-[var(--color-neutral-soft)] p-3 text-sm text-[var(--color-neutral)]"
                                            >
                                                Consulta de resultados. O registro exige o
                                                pesquisador responsável, uma visita realizada e um
                                                estudo que permita alterações.
                                            </p>
                                        )}
                                        {atualizando && (
                                            <p
                                                role="status"
                                                className="text-sm text-[var(--color-muted)]"
                                            >
                                                Atualizando os dados da visita e do estudo...
                                            </p>
                                        )}
                                        {erroAtualizacao && (
                                            <div className="flex flex-col items-start gap-2">
                                                <p
                                                    role="alert"
                                                    className="text-sm text-[var(--color-error)]"
                                                >
                                                    {erroAtualizacao}
                                                </p>
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    isDisabled={ocupado}
                                                    onPress={() => void atualizarDados()}
                                                >
                                                    Atualizar dados
                                                </Button>
                                            </div>
                                        )}
                                        {erroOperacao && erroSemAtividade && (
                                            <p
                                                role="alert"
                                                className="rounded-lg border border-[var(--color-error-border)] bg-[var(--color-error-soft)] p-3 text-sm text-[var(--color-error)]"
                                            >
                                                {erroOperacao.mensagem}
                                            </p>
                                        )}
                                        {atividades.length === 0 ? (
                                            <p
                                                role="status"
                                                className="text-sm text-[var(--color-muted)]"
                                            >
                                                Nenhuma atividade disponível nesta visita.
                                            </p>
                                        ) : (
                                            atividades.map((atividade) => (
                                                <FormularioResultadoAtividade
                                                    key={atividade.activityId}
                                                    atividade={atividade}
                                                    podeEditar={podeEditar}
                                                    ocupado={ocupado || requerAtualizacao}
                                                    onSalvar={salvar}
                                                />
                                            ))
                                        )}
                                    </>
                                )
                            )}
                        </Modal.Body>
                        <Modal.Footer className="mt-0 shrink-0 justify-end border-t border-[var(--color-border)] px-5 py-4">
                            <Button
                                type="button"
                                variant="secondary"
                                isDisabled={ocupado}
                                onPress={onFechar}
                            >
                                Fechar
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}
