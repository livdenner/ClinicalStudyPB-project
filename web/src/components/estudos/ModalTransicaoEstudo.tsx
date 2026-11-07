import { useEffect, useRef, useState } from "react";
import { Button, Modal } from "@heroui/react";
import { ESTADOS_ESTUDO } from "../../config/estados-estudo";
import { ApiClientError } from "../../services/api/apiClient";
import type { EstadoEstudo, EstudoApi } from "../../types/estudo";
import { obterMensagemErroAcesso } from "../../utils/erros-api";
import { SeloEstadoEstudo } from "./SeloEstadoEstudo";

type Props = {
    estudo: EstudoApi;
    destino: EstadoEstudo;
    onFechar: () => void;
    onConfirmar: () => Promise<void>;
    onAtualizar: () => void;
};

const TEXTOS_TRANSICAO: Partial<Record<EstadoEstudo, { acao: string; pergunta: string }>> = {
    RECRUITMENT: {
        acao: "Abrir recrutamento",
        pergunta: "Deseja abrir o recrutamento deste estudo?",
    },
    EXECUTION: {
        acao: "Iniciar execução",
        pergunta: "Deseja iniciar a execução deste estudo?",
    },
    CLOSED: {
        acao: "Encerrar estudo",
        pergunta: "Deseja encerrar este estudo? O encerramento é definitivo.",
    },
};

export function ModalTransicaoEstudo({
    estudo,
    destino,
    onFechar,
    onConfirmar,
    onAtualizar,
}: Props) {
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState("");
    const [conflito, setConflito] = useState(false);
    const erroRef = useRef<HTMLParagraphElement>(null);
    const textos = TEXTOS_TRANSICAO[destino];

    useEffect(() => {
        if (erro) erroRef.current?.focus();
    }, [erro]);

    function tratarErroAoConfirmar(error: unknown) {
        if (!(error instanceof ApiClientError)) {
            setErro("Não foi possível alterar o estado. Tente novamente.");
            return;
        }
        const mensagemAcesso = obterMensagemErroAcesso(error);
        if (mensagemAcesso) {
            setErro(mensagemAcesso);
            return;
        }
        if (error.status === 409) {
            setConflito(true);
            const motivo = error.message.trim() || "A transição não é mais permitida.";
            setErro(`${motivo} Atualize o estudo para conferir o estado atual.`);
            return;
        }
        if (error.status === 400) {
            setErro(
                `Não foi possível alterar o estado: ${error.fieldErrors[0]?.message ?? error.message}`
            );
            return;
        }
        setErro(error.message);
    }

    async function confirmar() {
        if (salvando || conflito) return;
        setErro("");
        setSalvando(true);
        try {
            await onConfirmar();
        } catch (error) {
            tratarErroAoConfirmar(error);
        } finally {
            setSalvando(false);
        }
    }

    return (
        <Modal>
            <Modal.Backdrop
                isOpen
                isDismissable={!salvando}
                isKeyboardDismissDisabled={salvando}
                onOpenChange={(aberto) => {
                    if (!aberto && !salvando) onFechar();
                }}
                className="bg-black/40"
            >
                <Modal.Container placement="center" scroll="inside" className="p-4">
                    <Modal.Dialog
                        aria-labelledby="titulo-transicao-estudo"
                        className="max-h-[90dvh] max-w-md rounded-xl border-0 bg-white p-0 text-[var(--color-text)] shadow-xl"
                    >
                        <Modal.Header className="shrink-0 border-b border-[var(--color-border)] px-5 py-4">
                            <Modal.Heading
                                id="titulo-transicao-estudo"
                                className="text-xl font-bold text-[var(--color-title)]"
                            >
                                {textos?.acao ?? "Alterar estado do estudo"}
                            </Modal.Heading>
                        </Modal.Header>
                        <Modal.Body className="flex flex-col gap-4 p-5">
                            <p className="break-words font-semibold">{estudo.title}</p>
                            <dl className="grid grid-cols-2 gap-4">
                                <div>
                                    <dt className="mb-2 text-sm">Estado atual</dt>
                                    <dd>
                                        <SeloEstadoEstudo estado={estudo.status} />
                                    </dd>
                                </div>
                                <div>
                                    <dt className="mb-2 text-sm">Próximo estado</dt>
                                    <dd>
                                        <SeloEstadoEstudo estado={destino} />
                                    </dd>
                                </div>
                            </dl>
                            <p className="text-sm text-[var(--color-muted)]">
                                {textos?.pergunta ??
                                    `Confirma a mudança para ${ESTADOS_ESTUDO[destino].rotulo}?`}
                            </p>
                            {erro && (
                                <p
                                    ref={erroRef}
                                    role="alert"
                                    tabIndex={-1}
                                    className="rounded-lg bg-[#FDEAEA] p-3 text-sm text-[#B42318]"
                                >
                                    {erro}
                                </p>
                            )}
                        </Modal.Body>
                        <Modal.Footer className="shrink-0 justify-end gap-3 border-t border-[var(--color-border)] px-5 py-4">
                            <Button variant="secondary" isDisabled={salvando} onPress={onFechar}>
                                Cancelar
                            </Button>
                            {conflito ? (
                                <Button variant="primary" onPress={onAtualizar}>
                                    Atualizar estudo
                                </Button>
                            ) : (
                                <Button variant="primary" isDisabled={salvando} onPress={confirmar}>
                                    {salvando
                                        ? "Alterando..."
                                        : (textos?.acao ?? "Confirmar alteração")}
                                </Button>
                            )}
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}
