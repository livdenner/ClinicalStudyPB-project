import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, Modal } from "@heroui/react";
import { X } from "lucide-react";
import { ApiClientError } from "../../services/api/apiClient";
import {
    STATUS_VISITA_LABELS,
    type DadosDesfechoVisita,
    type DesfechoVisita,
    type VisitaAgendada,
} from "../../types/visita-agendada";
import { formatarHorarioAgendamento } from "../../utils/agendamento";

type Props = {
    visita: VisitaAgendada;
    outcome: DesfechoVisita;
    permitido: boolean;
    onFechar: () => void;
    onConfirmar: (dados: DadosDesfechoVisita) => Promise<void>;
    onAtualizar: () => Promise<void>;
};

const TITULOS: Record<DesfechoVisita, string> = {
    DONE: "Confirmar visita realizada",
    ABSENT: "Confirmar ausência",
    CANCELLED: "Cancelar visita",
};
const CONFIRMACOES: Record<DesfechoVisita, string> = {
    DONE: "Confirmar realizada",
    ABSENT: "Confirmar ausência",
    CANCELLED: "Confirmar cancelamento",
};

/** Confirma o desfecho e recupera dados após conflito sem repetir a gravação. @author Lívia */
export function ModalDesfechoVisita({
    visita,
    outcome,
    permitido,
    onFechar,
    onConfirmar,
    onAtualizar,
}: Props) {
    const [justificativa, setJustificativa] = useState("");
    const [erro, setErro] = useState("");
    const [erroCampo, setErroCampo] = useState("");
    const [erroAtualizacao, setErroAtualizacao] = useState("");
    const [salvando, setSalvando] = useState(false);
    const [atualizando, setAtualizando] = useState(false);
    const [requerAtualizacao, setRequerAtualizacao] = useState(false);
    const [dadosAtualizados, setDadosAtualizados] = useState(false);
    const notaRef = useRef<HTMLTextAreaElement>(null);
    const erroRef = useRef<HTMLParagraphElement>(null);
    const processandoRef = useRef(false);
    const ocupado = salvando || atualizando;

    useEffect(() => {
        if (ocupado) return;
        if (erro) erroRef.current?.focus();
        else if (erroCampo) notaRef.current?.focus();
    }, [erro, erroCampo, ocupado]);

    async function atualizarDados() {
        setAtualizando(true);
        setErroAtualizacao("");
        try {
            await onAtualizar();
            setRequerAtualizacao(false);
            setDadosAtualizados(true);
        } catch (error) {
            setRequerAtualizacao(true);
            setErroAtualizacao(
                error instanceof ApiClientError
                    ? error.message
                    : "Não foi possível atualizar a visita. Tente novamente antes de confirmar."
            );
        } finally {
            setAtualizando(false);
        }
    }

    async function confirmar(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (
            processandoRef.current ||
            ocupado ||
            requerAtualizacao ||
            !permitido ||
            visita.status !== "SCHEDULED"
        )
            return;
        const note = justificativa.trim();
        setErro("");
        setErroCampo("");
        if (outcome === "CANCELLED" && !note) {
            setErroCampo("Informe a justificativa do cancelamento.");
            return;
        }
        if (note.length > 500) {
            setErroCampo("A justificativa deve ter até 500 caracteres.");
            return;
        }
        processandoRef.current = true;
        setSalvando(true);
        try {
            await onConfirmar({ outcome, ...(outcome === "CANCELLED" ? { note } : {}) });
        } catch (error) {
            if (error instanceof ApiClientError) {
                setErro(error.message);
                setErroCampo(
                    error.fieldErrors.find((campo) => campo.field === "note")?.message ?? ""
                );
                if (error.status === 409) {
                    setRequerAtualizacao(true);
                    await atualizarDados();
                }
            } else {
                setErro("Não foi possível registrar o desfecho. Tente novamente.");
            }
        } finally {
            processandoRef.current = false;
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
                        aria-labelledby="desfecho-visita-heading"
                        className="max-h-[calc(100dvh-2rem)] w-full max-w-lg rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-0 text-[var(--color-text)] shadow-xl"
                    >
                        <Modal.Header className="shrink-0 flex-row items-start justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
                            <Modal.Heading
                                id="desfecho-visita-heading"
                                className="text-xl font-bold text-[var(--color-title)]"
                            >
                                {TITULOS[outcome]}
                            </Modal.Heading>
                            <Button
                                type="button"
                                variant="ghost"
                                isIconOnly
                                aria-label="Fechar confirmação"
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
                                    <strong>{visita.plannedVisitName}</strong> ·{" "}
                                    {visita.participantName}
                                    <br />
                                    <time dateTime={visita.scheduledAt}>
                                        {formatarHorarioAgendamento(visita.scheduledAt)}
                                    </time>{" "}
                                    (Fortaleza)
                                </p>
                                <p className="text-sm text-[var(--color-muted)]">
                                    Você confirma o desfecho{" "}
                                    <strong>{STATUS_VISITA_LABELS[outcome]}</strong>? O desfecho é
                                    final.
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
                                        Atualizando a visita...
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
                                            Atualizar visita
                                        </Button>
                                    </div>
                                )}
                                {dadosAtualizados && (
                                    <p role="status" className="text-sm text-[var(--color-muted)]">
                                        Dados atualizados. Situação atual:{" "}
                                        <strong>{STATUS_VISITA_LABELS[visita.status]}</strong>.
                                        {permitido
                                            ? "Confira antes de confirmar novamente."
                                            : "A lista foi atualizada."}
                                    </p>
                                )}
                                {!permitido && (
                                    <p role="note" className="text-sm text-[var(--color-warning)]">
                                        {visita.status !== "SCHEDULED"
                                            ? "Esta visita já foi finalizada e não permite outro desfecho."
                                            : "Esta visita não está disponível para alterações."}
                                    </p>
                                )}
                                {outcome === "CANCELLED" && (
                                    <div className="flex flex-col gap-1.5">
                                        <label
                                            htmlFor="justificativa-cancelamento"
                                            className="text-sm font-medium"
                                        >
                                            Justificativa do cancelamento *
                                        </label>
                                        <textarea
                                            ref={notaRef}
                                            autoFocus
                                            id="justificativa-cancelamento"
                                            required
                                            rows={3}
                                            maxLength={500}
                                            value={justificativa}
                                            onChange={(event) => {
                                                setJustificativa(event.target.value);
                                                setErroCampo("");
                                            }}
                                            disabled={ocupado || !permitido}
                                            aria-invalid={Boolean(erroCampo)}
                                            aria-describedby={`justificativa-ajuda${erroCampo ? " justificativa-erro" : ""}`}
                                            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] aria-invalid:border-[var(--color-error)] disabled:opacity-60"
                                        />
                                        <p
                                            id="justificativa-ajuda"
                                            className="text-xs text-[var(--color-muted)]"
                                        >
                                            Até 500 caracteres.
                                        </p>
                                        {erroCampo && (
                                            <p
                                                id="justificativa-erro"
                                                className="text-sm text-[var(--color-error)]"
                                            >
                                                {erroCampo}
                                            </p>
                                        )}
                                    </div>
                                )}
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
                                    variant={outcome === "CANCELLED" ? "danger" : "primary"}
                                    className={
                                        outcome === "CANCELLED"
                                            ? "btn btn-danger"
                                            : "btn btn-primary"
                                    }
                                    isDisabled={ocupado || requerAtualizacao || !permitido}
                                >
                                    {salvando ? "Registrando..." : CONFIRMACOES[outcome]}
                                </Button>
                            </Modal.Footer>
                        </form>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}
