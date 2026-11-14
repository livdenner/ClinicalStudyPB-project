import { useEffect, useRef, useState } from "react";
import { Button, Modal } from "@heroui/react";
import { obterMensagemErroApi } from "../../../utils/erros-api";
import type { VisitaPrevista } from "../../../types/visita-prevista";

type Props = {
    visita: VisitaPrevista;
    onFechar: () => void;
    onConfirmar: () => Promise<void>;
    onAtualizar: () => void;
};

export function ModalExcluirVisitaPrevista({ visita, onFechar, onConfirmar, onAtualizar }: Props) {
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState("");
    const erroRef = useRef<HTMLParagraphElement>(null);
    useEffect(() => {
        if (erro && !salvando) erroRef.current?.focus();
    }, [erro, salvando]);

    async function confirmar() {
        if (salvando || erro) return;
        setSalvando(true);
        try {
            await onConfirmar();
        } catch (error) {
            setErro(
                obterMensagemErroApi(
                    error,
                    "Não foi possível excluir a visita. Atualize os dados para conferir o resultado."
                )
            );
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
            >
                <Modal.Container placement="center" scroll="inside">
                    <Modal.Dialog className="w-full max-w-md rounded-2xl bg-white p-0 text-[var(--color-text)]">
                        <Modal.Header className="border-b border-[var(--color-border)] p-5">
                            <Modal.Heading className="text-lg font-semibold text-[var(--color-title)]">
                                Excluir visita prevista?
                            </Modal.Heading>
                        </Modal.Header>
                        <Modal.Body className="p-5">
                            <p className="break-words">
                                <strong>{visita.name}</strong> e suas atividades serão excluídas.
                            </p>
                            {erro && (
                                <p
                                    ref={erroRef}
                                    role="alert"
                                    tabIndex={-1}
                                    className="mt-4 rounded-lg bg-[var(--color-error-soft)] p-3 text-sm text-[var(--color-error)]"
                                >
                                    {erro}
                                </p>
                            )}
                        </Modal.Body>
                        <Modal.Footer className="flex justify-end gap-3 border-t border-[var(--color-border)] p-5">
                            <Button variant="secondary" isDisabled={salvando} onPress={onFechar}>
                                Cancelar
                            </Button>
                            {erro ? (
                                <Button variant="primary" onPress={onAtualizar}>
                                    Atualizar dados
                                </Button>
                            ) : (
                                <Button
                                    variant="primary"
                                    className="bg-[var(--color-error)] text-white"
                                    isPending={salvando}
                                    onPress={confirmar}
                                >
                                    {salvando ? "Excluindo..." : "Excluir visita"}
                                </Button>
                            )}
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}
