import { useEffect, useRef, useState } from "react";
import { Button, FieldError, Label, Modal, TextArea, TextField } from "@heroui/react";
import { ApiClientError } from "../../services/api/apiClient";
import type { ParticipanteApi } from "../../types/participante";

type Props = {
    participante: ParticipanteApi;
    estudoTitulo: string;
    onFechar: () => void;
    onConfirmar: (motivo: string) => Promise<void>;
};

export function ModalRegistrarRetirada({
    participante,
    estudoTitulo,
    onFechar,
    onConfirmar,
}: Props) {
    const [motivo, setMotivo] = useState("");
    const [erroCampo, setErroCampo] = useState("");
    const [erro, setErro] = useState("");
    const [salvando, setSalvando] = useState(false);
    const enviando = useRef(false);
    const motivoRef = useRef<HTMLTextAreaElement>(null);
    const erroRef = useRef<HTMLParagraphElement>(null);

    useEffect(() => {
        if (salvando) return;
        if (erroCampo) motivoRef.current?.focus();
        else if (erro) erroRef.current?.focus();
    }, [erroCampo, erro, salvando]);

    async function confirmar() {
        if (enviando.current) return;
        setErro("");
        const motivoNormalizado = motivo.trim();
        if (!motivoNormalizado || motivoNormalizado.length > 500) {
            setErroCampo("Informe o motivo da retirada com 1 a 500 caracteres.");
            motivoRef.current?.focus();
            return;
        }
        setErroCampo("");
        enviando.current = true;
        setSalvando(true);
        try {
            await onConfirmar(motivoNormalizado);
        } catch (error) {
            if (error instanceof ApiClientError) {
                setErro(error.message);
                setErroCampo(
                    error.fieldErrors.find(({ field }) => field === "reason")?.message ?? ""
                );
            } else {
                setErro("Não foi possível registrar a retirada. Tente novamente.");
            }
        } finally {
            enviando.current = false;
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
                    if (!aberto && !enviando.current) onFechar();
                }}
                className="bg-black/40"
            >
                <Modal.Container placement="center" scroll="inside" className="p-4">
                    <Modal.Dialog
                        aria-labelledby="titulo-registrar-retirada"
                        aria-busy={salvando}
                        className="max-h-[90dvh] w-full max-w-lg rounded-xl border-0 bg-white p-0 text-[var(--color-text)] shadow-xl"
                    >
                        <Modal.Header className="shrink-0 border-b border-[var(--color-border)] px-5 py-4">
                            <Modal.Heading
                                id="titulo-registrar-retirada"
                                className="text-xl font-bold text-[var(--color-title)]"
                            >
                                Registrar retirada
                            </Modal.Heading>
                        </Modal.Header>
                        <Modal.Body className="flex flex-col gap-4 p-5">
                            <p className="text-sm [overflow-wrap:anywhere]">
                                Participante: <strong>{participante.candidateName}</strong>
                                <br />
                                Estudo: <strong>{estudoTitulo}</strong>
                            </p>
                            <p className="rounded-lg border border-[var(--color-warning-border)] bg-[var(--color-warning-soft)] p-3 text-sm text-[var(--color-warning)]">
                                A retirada é definitiva. As visitas futuras agendadas serão
                                canceladas. A vaga continuará ocupada e este candidato não poderá
                                ser reincluído no estudo.
                            </p>
                            <TextField
                                name="reason"
                                isRequired
                                isDisabled={salvando}
                                isInvalid={Boolean(erroCampo)}
                            >
                                <Label>Motivo da retirada</Label>
                                <TextArea
                                    ref={motivoRef}
                                    autoFocus
                                    value={motivo}
                                    onChange={(event) => setMotivo(event.target.value)}
                                    rows={4}
                                    className="w-full resize-y"
                                    aria-describedby="limite-motivo-retirada"
                                />
                                <p
                                    id="limite-motivo-retirada"
                                    className="text-xs text-[var(--color-muted)]"
                                >
                                    Informe de 1 a 500 caracteres.
                                </p>
                                <FieldError>{erroCampo}</FieldError>
                            </TextField>
                            {erro && (
                                <p
                                    ref={erroRef}
                                    role="alert"
                                    tabIndex={-1}
                                    className="rounded-lg bg-[var(--color-error-soft)] p-3 text-sm text-[var(--color-error)]"
                                >
                                    {erro}
                                </p>
                            )}
                        </Modal.Body>
                        <Modal.Footer className="shrink-0 flex-wrap justify-end gap-3 border-t border-[var(--color-border)] px-5 py-4">
                            <Button variant="secondary" isDisabled={salvando} onPress={onFechar}>
                                Voltar
                            </Button>
                            <Button variant="primary" isDisabled={salvando} onPress={confirmar}>
                                {salvando ? "Registrando..." : "Confirmar retirada"}
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}
