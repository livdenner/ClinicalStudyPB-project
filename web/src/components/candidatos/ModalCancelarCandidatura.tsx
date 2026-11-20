import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, Modal } from "@heroui/react";
import { X } from "lucide-react";
import { ApiClientError } from "../../services/api/apiClient";
import { SITUACAO_CANDIDATO_LABELS, type CandidatoApi } from "../../types/candidato";

type Props = {
    estudoTitulo: string;
    candidato: CandidatoApi;
    permitido: boolean;
    onFechar: () => void;
    onConfirmar: (reason: string) => Promise<void>;
    onAtualizar: () => Promise<void>;
};

/** Confirma o cancelamento com motivo e consulta os dados atuais após HTTP 409. @author Lívia */
export function ModalCancelarCandidatura({
    estudoTitulo,
    candidato,
    permitido,
    onFechar,
    onConfirmar,
    onAtualizar,
}: Props) {
    const [motivo, setMotivo] = useState("");
    const [erro, setErro] = useState("");
    const [erroCampo, setErroCampo] = useState("");
    const [erroAtualizacao, setErroAtualizacao] = useState("");
    const [salvando, setSalvando] = useState(false);
    const [atualizando, setAtualizando] = useState(false);
    const [requerAtualizacao, setRequerAtualizacao] = useState(false);
    const [dadosAtualizados, setDadosAtualizados] = useState(false);
    const enviandoRef = useRef(false);
    const atualizandoRef = useRef(false);
    const motivoRef = useRef<HTMLTextAreaElement>(null);
    const erroRef = useRef<HTMLParagraphElement>(null);
    const ocupado = salvando || atualizando;

    useEffect(() => {
        if (ocupado) return;
        if (erro) erroRef.current?.focus();
        else if (erroCampo) motivoRef.current?.focus();
    }, [erro, erroCampo, ocupado]);

    async function atualizarDados() {
        if (atualizandoRef.current) return;
        atualizandoRef.current = true;
        setAtualizando(true);
        setErroAtualizacao("");
        setDadosAtualizados(false);
        try {
            await onAtualizar();
            setRequerAtualizacao(false);
            setDadosAtualizados(true);
        } catch (error) {
            setRequerAtualizacao(true);
            setErroAtualizacao(
                error instanceof ApiClientError
                    ? error.message
                    : "Não foi possível atualizar os dados. Tente novamente antes de confirmar."
            );
        } finally {
            atualizandoRef.current = false;
            setAtualizando(false);
        }
    }

    async function confirmar(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (enviandoRef.current || ocupado || requerAtualizacao || !permitido) return;
        const reason = motivo.trim();
        setErro("");
        setErroCampo("");
        if (!reason || reason.length > 500) {
            setErroCampo(
                !reason
                    ? "Informe o motivo do cancelamento."
                    : "O motivo deve ter até 500 caracteres."
            );
            return;
        }
        enviandoRef.current = true;
        setSalvando(true);
        try {
            await onConfirmar(reason);
        } catch (error) {
            if (error instanceof ApiClientError) {
                setErro(error.message);
                setErroCampo(
                    error.fieldErrors.find((campo) => campo.field === "reason")?.message ?? ""
                );
                if (error.status === 409) {
                    setRequerAtualizacao(true);
                    await atualizarDados();
                }
            } else {
                setErro("Não foi possível cancelar a candidatura. Tente novamente.");
            }
        } finally {
            enviandoRef.current = false;
            setSalvando(false);
        }
    }

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
                        aria-labelledby="cancelar-candidatura-heading"
                        className="max-h-[calc(100dvh-2rem)] w-full max-w-lg rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-0 text-[var(--color-text)] shadow-xl"
                    >
                        <Modal.Header className="shrink-0 flex-row items-start justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
                            <Modal.Heading
                                id="cancelar-candidatura-heading"
                                className="text-xl font-bold text-[var(--color-title)]"
                            >
                                Cancelar candidatura
                            </Modal.Heading>
                            <Button
                                type="button"
                                variant="ghost"
                                isIconOnly
                                aria-label="Fechar cancelamento"
                                isDisabled={ocupado}
                                onPress={onFechar}
                            >
                                <X size={20} aria-hidden="true" />
                            </Button>
                        </Modal.Header>
                        <form
                            noValidate
                            onSubmit={confirmar}
                            aria-busy={ocupado}
                            className="flex min-h-0 flex-col overflow-hidden"
                        >
                            <Modal.Body className="mx-0 flex w-full min-w-0 flex-col gap-4 p-5">
                                <p className="break-words text-sm">
                                    <strong>{candidato.name}</strong>
                                    <br />
                                    Estudo: {estudoTitulo}
                                </p>
                                <p className="text-sm text-[var(--color-muted)]">
                                    A candidatura será cancelada e sairá da lista padrão. O
                                    histórico será preservado e poderá ser consultado pelo filtro de
                                    cancelados.
                                </p>
                                {erro && (
                                    <p
                                        ref={erroRef}
                                        tabIndex={-1}
                                        role="alert"
                                        className="rounded-lg border border-[var(--color-error-border)] bg-[var(--color-error-soft)] p-3 text-sm text-[var(--color-error)]"
                                    >
                                        {erro}
                                    </p>
                                )}
                                {atualizando && (
                                    <p role="status" className="text-sm text-[var(--color-muted)]">
                                        Atualizando candidato e estudo...
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
                                {dadosAtualizados && (
                                    <p role="status" className="text-sm text-[var(--color-muted)]">
                                        Dados atualizados. Situação da candidatura:{" "}
                                        <strong>
                                            {SITUACAO_CANDIDATO_LABELS[candidato.status]}
                                        </strong>
                                        . Confira a situação antes de continuar.
                                    </p>
                                )}
                                {!permitido && (
                                    <p role="note" className="text-sm text-[var(--color-warning)]">
                                        {candidato.status === "INCLUDED"
                                            ? "Este candidato já foi incluído. A saída do estudo deve ser registrada como retirada do participante."
                                            : candidato.status === "CANCELLED"
                                              ? "Esta candidatura já foi cancelada."
                                              : "O cancelamento só está disponível para o coordenador com o estudo em recrutamento."}
                                    </p>
                                )}
                                <div className="flex flex-col gap-1.5">
                                    <label
                                        htmlFor="motivo-cancelamento-candidatura"
                                        className="text-sm font-medium"
                                    >
                                        Motivo do cancelamento *
                                    </label>
                                    <textarea
                                        ref={motivoRef}
                                        autoFocus
                                        id="motivo-cancelamento-candidatura"
                                        required
                                        rows={3}
                                        maxLength={500}
                                        value={motivo}
                                        onChange={(event) => {
                                            setMotivo(event.target.value);
                                            setErroCampo("");
                                        }}
                                        disabled={ocupado || !permitido}
                                        aria-invalid={Boolean(erroCampo)}
                                        aria-describedby={`motivo-cancelamento-ajuda${erroCampo ? " motivo-cancelamento-erro" : ""}`}
                                        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] aria-invalid:border-[var(--color-error)] disabled:opacity-60"
                                    />
                                    <p
                                        id="motivo-cancelamento-ajuda"
                                        className="text-xs text-[var(--color-muted)]"
                                    >
                                        De 1 a 500 caracteres. Espaços nas extremidades são
                                        desconsiderados.
                                    </p>
                                    {erroCampo && (
                                        <p
                                            id="motivo-cancelamento-erro"
                                            className="text-sm text-[var(--color-error)]"
                                        >
                                            {erroCampo}
                                        </p>
                                    )}
                                </div>
                            </Modal.Body>
                            <Modal.Footer className="mt-0 shrink-0 flex-wrap justify-end gap-3 border-t border-[var(--color-border)] px-5 py-4">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    isDisabled={ocupado}
                                    onPress={onFechar}
                                >
                                    Voltar
                                </Button>
                                <Button
                                    type="submit"
                                    variant="danger"
                                    className="btn btn-danger"
                                    isDisabled={ocupado || requerAtualizacao || !permitido}
                                >
                                    {salvando ? "Cancelando..." : "Confirmar cancelamento"}
                                </Button>
                            </Modal.Footer>
                        </form>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}
