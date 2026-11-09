import { useEffect, useRef, useState } from "react";
import { Button, FieldError, Label, Modal, TextArea, TextField } from "@heroui/react";
import { ESTADOS_ESTUDO } from "../../config/estados-estudo";
import { ApiClientError } from "../../services/api/apiClient";
import type { EstadoEstudo, EstudoApi } from "../../types/estudo";
import { obterMensagemErroAcesso } from "../../utils/erros-api";
import { SeloEstadoEstudo } from "./SeloEstadoEstudo";

type Props = {
    estudo: EstudoApi;
    destino: EstadoEstudo;
    onFechar: () => void;
    onConfirmar: (justificativa?: string) => Promise<void>;
    onAtualizar: () => void;
};

const TEXTOS_TRANSICAO: Partial<Record<EstadoEstudo, { acao: string; pergunta: string }>> = {
    PLANNING: {
        acao: "Voltar ao planejamento",
        pergunta: "Deseja retornar este estudo ao planejamento?",
    },
    CANCELLED: {
        acao: "Cancelar estudo",
        pergunta: "Deseja cancelar este estudo? Informe a justificativa.",
    },
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
    const textos =
        estudo.status === "CANCELLED"
            ? {
                  acao: "Restaurar estudo",
                  pergunta: `Deseja restaurar este estudo para ${ESTADOS_ESTUDO[destino].rotulo}?`,
              }
            : TEXTOS_TRANSICAO[destino];
    const [justificativa, setJustificativa] = useState("");
    const [erroJustificativa, setErroJustificativa] = useState("");
    const justificativaRef = useRef<HTMLTextAreaElement>(null);

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
            setConflito(error.code === "STUDY_REFRESH_REQUIRED");
            setErro(error.message.trim() || "A transição não é permitida no estado atual.");
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
        setErroJustificativa("");
        if (
            destino === "CANCELLED" &&
            (!justificativa.trim() || justificativa.trim().length > 1000)
        ) {
            setErroJustificativa("Informe uma justificativa de até 1000 caracteres.");
            justificativaRef.current?.focus();
            return;
        }
        setSalvando(true);
        try {
            await onConfirmar(destino === "CANCELLED" ? justificativa.trim() : undefined);
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
                                    <dt className="mb-2 text-sm">Estado de destino</dt>
                                    <dd>
                                        <SeloEstadoEstudo estado={destino} />
                                    </dd>
                                </div>
                            </dl>
                            <p className="text-sm text-[var(--color-muted)]">
                                {textos?.pergunta ??
                                    `Confirma a mudança para ${ESTADOS_ESTUDO[destino].rotulo}?`}
                            </p>
                            {destino === "CANCELLED" && (
                                <TextField
                                    name="reason"
                                    isRequired
                                    isDisabled={salvando}
                                    isInvalid={Boolean(erroJustificativa)}
                                >
                                    <Label>Justificativa</Label>
                                    <TextArea
                                        ref={justificativaRef}
                                        value={justificativa}
                                        onChange={(event) => setJustificativa(event.target.value)}
                                        maxLength={1000}
                                        rows={3}
                                    />
                                    <FieldError>{erroJustificativa}</FieldError>
                                </TextField>
                            )}
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
                                Voltar
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
