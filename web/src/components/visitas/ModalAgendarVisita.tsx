import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, Modal } from "@heroui/react";
import { X } from "lucide-react";
import { ApiClientError } from "../../services/api/apiClient";
import { listarVisitasPrevistas } from "../../services/visitas-previstas";
import type { DadosAgendamentoVisita } from "../../types/visita-agendada";
import type { VisitaPrevista } from "../../types/visita-prevista";
import { converterHorarioAgendamento } from "../../utils/agendamento";
import { obterErrosCampos } from "../../utils/erros-api";

type Props = {
    studyId: number;
    estudoTitulo: string;
    inicioEstudo: string;
    fimEstudo: string;
    participanteNome: string;
    token: string;
    podeAgendar: boolean;
    onFechar: () => void;
    onSalvar: (dados: DadosAgendamentoVisita) => Promise<void>;
};

type ErrosCampos = Partial<Record<keyof DadosAgendamentoVisita, string>>;

/** Agenda uma visita mantendo os dados preenchidos quando a API recusa a operação. @author Lívia */
export function ModalAgendarVisita({
    studyId,
    estudoTitulo,
    inicioEstudo,
    fimEstudo,
    participanteNome,
    token,
    podeAgendar,
    onFechar,
    onSalvar,
}: Props) {
    const [visitasPrevistas, setVisitasPrevistas] = useState<VisitaPrevista[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [erroConsulta, setErroConsulta] = useState("");
    const [tentativa, setTentativa] = useState(0);
    const [visitaId, setVisitaId] = useState("");
    const [dataHora, setDataHora] = useState("");
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState("");
    const [errosCampos, setErrosCampos] = useState<ErrosCampos>({});
    const formRef = useRef<HTMLFormElement>(null);
    const selectRef = useRef<HTMLSelectElement>(null);
    const erroRef = useRef<HTMLParagraphElement>(null);
    const enviandoRef = useRef(false);

    useEffect(() => {
        const controller = new AbortController();
        listarVisitasPrevistas(studyId, token, controller.signal)
            .then((dados) => {
                if (controller.signal.aborted) return;
                setVisitasPrevistas(dados);
            })
            .catch((error: unknown) => {
                if (controller.signal.aborted) return;
                setErroConsulta(
                    error instanceof ApiClientError
                        ? error.message
                        : "Não foi possível carregar as visitas previstas. Tente novamente."
                );
            })
            .finally(() => {
                if (!controller.signal.aborted) setCarregando(false);
            });
        return () => controller.abort();
    }, [studyId, token, tentativa]);

    useEffect(() => {
        if (!carregando && !erroConsulta && visitasPrevistas.length > 0) {
            selectRef.current?.focus();
        }
    }, [carregando, erroConsulta, visitasPrevistas]);

    useEffect(() => {
        if (salvando) return;
        if (erro) erroRef.current?.focus();
        else if (Object.keys(errosCampos).length > 0) {
            formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
        }
    }, [erro, errosCampos, salvando]);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (enviandoRef.current || carregando || erroConsulta || !podeAgendar) return;
        setErro("");
        const erros: ErrosCampos = {};
        const plannedVisitId = Number(visitaId);
        if (!visitasPrevistas.some((visita) => visita.id === plannedVisitId)) {
            erros.plannedVisitId = "Selecione uma visita prevista do estudo.";
        }
        let scheduledAt = "";
        if (!dataHora) erros.scheduledAt = "Informe a data e a hora da visita.";
        else {
            try {
                scheduledAt = converterHorarioAgendamento(dataHora);
            } catch {
                erros.scheduledAt = "Informe uma data e hora válidas.";
            }
        }
        setErrosCampos(erros);
        if (Object.keys(erros).length > 0) return;

        enviandoRef.current = true;
        setSalvando(true);
        try {
            await onSalvar({ plannedVisitId, scheduledAt });
        } catch (error) {
            if (error instanceof ApiClientError) {
                setErro(error.message);
                setErrosCampos(
                    obterErrosCampos(error.fieldErrors, ["plannedVisitId", "scheduledAt"])
                );
            } else {
                setErro("Não foi possível agendar a visita. Tente novamente.");
            }
        } finally {
            enviandoRef.current = false;
            setSalvando(false);
        }
    }

    const camposBloqueados = salvando || !podeAgendar;

    return (
        <Modal>
            <Modal.Backdrop
                isOpen
                isDismissable={!salvando}
                isKeyboardDismissDisabled={salvando}
                onOpenChange={(aberto) => {
                    if (!aberto && !salvando) onFechar();
                }}
                className="bg-black/45"
            >
                <Modal.Container placement="center" scroll="inside" className="p-4">
                    <Modal.Dialog
                        aria-labelledby="agendar-visita-heading"
                        className="max-h-[calc(100dvh-2rem)] w-full max-w-lg rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-0 text-[var(--color-text)] shadow-xl [--color-error:#a62a25]"
                    >
                        <Modal.Header className="shrink-0 flex-row items-start justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
                            <div className="min-w-0">
                                <Modal.Heading
                                    id="agendar-visita-heading"
                                    className="text-xl font-bold text-[var(--color-title)]"
                                >
                                    Agendar visita
                                </Modal.Heading>
                                <p className="mt-1 break-words text-sm text-[var(--color-muted)]">
                                    {participanteNome} · {estudoTitulo}
                                </p>
                            </div>
                            <Button
                                type="button"
                                isIconOnly
                                variant="ghost"
                                aria-label="Fechar agendamento"
                                isDisabled={salvando}
                                onPress={onFechar}
                            >
                                <X size={20} aria-hidden="true" />
                            </Button>
                        </Modal.Header>
                        <form
                            ref={formRef}
                            noValidate
                            onSubmit={handleSubmit}
                            className="flex min-h-0 flex-col overflow-hidden"
                            aria-busy={salvando || carregando}
                        >
                            <Modal.Body className="mx-0 flex w-full min-w-0 flex-col gap-4 p-5">
                                {erro && (
                                    <p
                                        ref={erroRef}
                                        role="alert"
                                        tabIndex={-1}
                                        className="rounded-lg border border-[var(--color-error-border)] bg-[var(--color-error-soft)] p-3 text-sm text-[var(--color-error)]"
                                    >
                                        {erro}
                                    </p>
                                )}
                                {carregando ? (
                                    <p role="status" className="text-sm text-[var(--color-muted)]">
                                        Carregando visitas previstas...
                                    </p>
                                ) : erroConsulta ? (
                                    <div className="flex flex-col items-start gap-2">
                                        <p
                                            role="alert"
                                            className="text-sm text-[var(--color-error)]"
                                        >
                                            {erroConsulta}
                                        </p>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            onPress={() => {
                                                setErroConsulta("");
                                                setCarregando(true);
                                                setTentativa((atual) => atual + 1);
                                            }}
                                        >
                                            Tentar novamente
                                        </Button>
                                    </div>
                                ) : visitasPrevistas.length === 0 ? (
                                    <p role="note" className="text-sm text-[var(--color-muted)]">
                                        O pesquisador responsável precisa cadastrar uma visita
                                        prevista neste estudo antes do agendamento.
                                    </p>
                                ) : null}
                                {!podeAgendar && (
                                    <p role="note" className="text-sm text-[var(--color-warning)]">
                                        O agendamento está indisponível para a situação atual do
                                        estudo ou participante.
                                    </p>
                                )}
                                <div className="flex flex-col gap-1.5">
                                    <label
                                        htmlFor="agendamento-visita-prevista"
                                        className="text-sm font-medium"
                                    >
                                        Visita prevista *
                                    </label>
                                    <select
                                        ref={selectRef}
                                        id="agendamento-visita-prevista"
                                        value={visitaId}
                                        onChange={(event) => setVisitaId(event.target.value)}
                                        required
                                        disabled={
                                            camposBloqueados ||
                                            carregando ||
                                            Boolean(erroConsulta) ||
                                            visitasPrevistas.length === 0
                                        }
                                        aria-invalid={Boolean(errosCampos.plannedVisitId)}
                                        aria-describedby={
                                            errosCampos.plannedVisitId
                                                ? "agendamento-visita-erro"
                                                : undefined
                                        }
                                        className="h-10 w-full min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] aria-invalid:border-[var(--color-error)] disabled:opacity-60"
                                    >
                                        <option value="">Selecione uma visita prevista</option>
                                        {visitasPrevistas.map((visita) => (
                                            <option key={visita.id} value={visita.id}>
                                                {visita.name}
                                            </option>
                                        ))}
                                    </select>
                                    {errosCampos.plannedVisitId && (
                                        <p
                                            id="agendamento-visita-erro"
                                            className="text-sm text-[var(--color-error)]"
                                        >
                                            {errosCampos.plannedVisitId}
                                        </p>
                                    )}
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label
                                        htmlFor="agendamento-data-hora"
                                        className="text-sm font-medium"
                                    >
                                        Data e hora — Fortaleza *
                                    </label>
                                    <input
                                        id="agendamento-data-hora"
                                        type="datetime-local"
                                        value={dataHora}
                                        onChange={(event) => setDataHora(event.target.value)}
                                        required
                                        disabled={camposBloqueados}
                                        aria-invalid={Boolean(errosCampos.scheduledAt)}
                                        aria-describedby={`agendamento-data-ajuda${errosCampos.scheduledAt ? " agendamento-data-erro" : ""}`}
                                        className="h-10 w-full min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] aria-invalid:border-[var(--color-error)] disabled:opacity-60"
                                    />
                                    <p
                                        id="agendamento-data-ajuda"
                                        className="text-xs text-[var(--color-muted)]"
                                    >
                                        Escolha uma data futura entre{" "}
                                        {inicioEstudo.split("-").reverse().join("/")} e{" "}
                                        {fimEstudo.split("-").reverse().join("/")}. O horário
                                        informado é o de Fortaleza.
                                    </p>
                                    {errosCampos.scheduledAt && (
                                        <p
                                            id="agendamento-data-erro"
                                            className="text-sm text-[var(--color-error)]"
                                        >
                                            {errosCampos.scheduledAt}
                                        </p>
                                    )}
                                </div>
                            </Modal.Body>
                            <Modal.Footer className="mt-0 shrink-0 flex-wrap justify-end gap-3 border-t border-[var(--color-border)] px-5 py-4">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    isDisabled={salvando}
                                    onPress={onFechar}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    isDisabled={
                                        camposBloqueados ||
                                        carregando ||
                                        Boolean(erroConsulta) ||
                                        visitasPrevistas.length === 0
                                    }
                                    className="button--create"
                                >
                                    {salvando ? "Agendando..." : "Agendar visita"}
                                </Button>
                            </Modal.Footer>
                        </form>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}
