import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CalendarPlus, RefreshCw } from "lucide-react";
import { ApiClientError } from "../../services/api/apiClient";
import { agendarVisita, listarVisitasAgendadas } from "../../services/visitas-agendadas";
import type { UserRole } from "../../types/auth";
import type { EstudoComStatusApi } from "../../types/candidato";
import type { ParticipanteApi } from "../../types/participante";
import {
    STATUS_VISITA_LABELS,
    type DadosAgendamentoVisita,
    type StatusVisitaAgendada,
    type VisitaAgendada,
} from "../../types/visita-agendada";
import { podeAgendarVisita } from "../../utils/agendamento";
import { Button } from "../ui/Button";
import { ListaVisitasAgendadas } from "./ListaVisitasAgendadas";
import { ModalAgendarVisita } from "./ModalAgendarVisita";

type Props = {
    estudo: EstudoComStatusApi;
    participante: ParticipanteApi;
    token: string;
    role: UserRole;
    abrirAgendamento: boolean;
    onVoltar: () => void;
};

/** Acompanha e agenda visitas reais do participante no estudo selecionado. @author Lívia */
export function VisitasParticipante({
    estudo,
    participante,
    token,
    role,
    abrirAgendamento,
    onVoltar,
}: Props) {
    const permitido = podeAgendarVisita(role, estudo.status, participante);
    const [visitas, setVisitas] = useState<VisitaAgendada[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");
    const [tentativa, setTentativa] = useState(0);
    const [filtro, setFiltro] = useState<StatusVisitaAgendada | "ALL">("ALL");
    const [modalAberto, setModalAberto] = useState(abrirAgendamento && permitido);
    const [salvando, setSalvando] = useState(false);
    const [mensagem, setMensagem] = useState("");
    const tituloRef = useRef<HTMLHeadingElement>(null);

    useEffect(() => {
        tituloRef.current?.focus();
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        listarVisitasAgendadas(estudo.id, participante.id, token, controller.signal)
            .then((dados) => {
                if (!controller.signal.aborted) setVisitas(dados);
            })
            .catch((error: unknown) => {
                if (controller.signal.aborted) return;
                setErro(
                    error instanceof ApiClientError
                        ? error.message
                        : "Não foi possível carregar os agendamentos. Tente novamente."
                );
            })
            .finally(() => {
                if (!controller.signal.aborted) setCarregando(false);
            });
        return () => controller.abort();
    }, [estudo.id, participante.id, token, tentativa]);

    function atualizarLista() {
        setErro("");
        setCarregando(true);
        setTentativa((atual) => atual + 1);
    }

    async function handleAgendar(dados: DadosAgendamentoVisita) {
        if (!permitido || participante.studyId !== estudo.id) {
            throw new ApiClientError(
                "O participante não está disponível para agendamento neste estudo.",
                { status: 409 }
            );
        }
        if (carregando || erro || salvando) {
            throw new ApiClientError("Atualize a lista de visitas antes de agendar.", {
                status: 409,
            });
        }
        setSalvando(true);
        try {
            const nova = await agendarVisita(estudo.id, participante.id, dados, token);
            setVisitas((atuais) =>
                [...atuais.filter((visita) => visita.id !== nova.id), nova].sort(
                    (a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt) || a.id - b.id
                )
            );
            setFiltro("ALL");
            setModalAberto(false);
            setMensagem(`Visita ${nova.plannedVisitName} agendada com sucesso.`);
        } finally {
            setSalvando(false);
        }
    }

    const filtradas = visitas.filter((visita) => filtro === "ALL" || visita.status === filtro);

    return (
        <section className="flex flex-col gap-6" aria-labelledby="agenda-participante-heading">
            <button
                type="button"
                onClick={onVoltar}
                className="inline-flex w-fit cursor-pointer items-center gap-1.5 text-sm font-semibold text-[var(--color-primary)] hover:underline"
            >
                <ArrowLeft size={16} aria-hidden="true" /> Voltar para participantes
            </button>
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                    <h1
                        ref={tituloRef}
                        tabIndex={-1}
                        id="agenda-participante-heading"
                        className="text-2xl font-bold text-[var(--color-title)]"
                    >
                        Visitas de {participante.candidateName}
                    </h1>
                    <p className="mt-1 text-sm text-[var(--color-muted)]">
                        {estudo.title} · Horário de Fortaleza
                    </p>
                </div>
                {permitido && (
                    <Button
                        type="button"
                        className="btn button--create inline-flex items-center gap-2"
                        disabled={carregando || Boolean(erro) || salvando}
                        onClick={() => {
                            setMensagem("");
                            setModalAberto(true);
                        }}
                    >
                        <CalendarPlus size={18} aria-hidden="true" />
                        Agendar visita
                    </Button>
                )}
            </header>
            {participante.status === "WITHDRAWN" && (
                <p
                    role="note"
                    className="rounded-lg border border-[var(--color-neutral-border)] bg-[var(--color-neutral-soft)] p-3 text-sm text-[var(--color-neutral)]"
                >
                    Participante retirado. As visitas permanecem disponíveis para consulta.
                </p>
            )}
            {role === "COORDINATOR" && participante.status === "ACTIVE" && !permitido && (
                <p
                    role="note"
                    className="rounded-lg border border-[var(--color-warning-border)] bg-[var(--color-warning-soft)] p-3 text-sm text-[var(--color-warning)]"
                >
                    O agendamento está disponível somente durante o recrutamento ou a execução do
                    estudo.
                </p>
            )}
            {mensagem && (
                <p
                    role="status"
                    className="rounded-lg border border-[var(--color-success-border)] bg-[var(--color-success-soft)] p-3 text-sm text-[var(--color-success)]"
                >
                    {mensagem}
                </p>
            )}
            <section
                className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"
                aria-label="Agenda do participante"
            >
                <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--color-border)] p-5">
                    <div className="flex flex-col gap-1.5">
                        <label
                            htmlFor="agenda-situacao-filtro"
                            className="text-sm font-medium text-[var(--color-title)]"
                        >
                            Filtrar por situação
                        </label>
                        <select
                            id="agenda-situacao-filtro"
                            value={filtro}
                            onChange={(event) =>
                                setFiltro(event.target.value as StatusVisitaAgendada | "ALL")
                            }
                            className="h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
                        >
                            <option value="ALL">Todas as situações</option>
                            {Object.entries(STATUS_VISITA_LABELS).map(([valor, rotulo]) => (
                                <option key={valor} value={valor}>
                                    {rotulo}
                                </option>
                            ))}
                        </select>
                    </div>
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={carregando || salvando}
                        onClick={atualizarLista}
                        className="btn btn-secondary inline-flex items-center gap-2"
                    >
                        <RefreshCw size={16} aria-hidden="true" />
                        Atualizar visitas
                    </Button>
                </div>
                {carregando ? (
                    <p role="status" className="p-8 text-center text-sm text-[var(--color-muted)]">
                        Carregando agendamentos...
                    </p>
                ) : erro ? (
                    <div className="flex flex-col items-center gap-3 p-6">
                        <p role="alert" className="text-sm text-[var(--color-error)]">
                            {erro}
                        </p>
                        <Button type="button" variant="secondary" onClick={atualizarLista}>
                            Tentar novamente
                        </Button>
                    </div>
                ) : (
                    <>
                        <ListaVisitasAgendadas visitas={filtradas} />
                        <p className="border-t border-[var(--color-border)] px-5 py-3 text-xs text-[var(--color-muted)]">
                            Exibindo {filtradas.length} de {visitas.length} visitas.
                        </p>
                    </>
                )}
            </section>
            {modalAberto && !carregando && !erro && (
                <ModalAgendarVisita
                    studyId={estudo.id}
                    estudoTitulo={estudo.title}
                    inicioEstudo={estudo.startDate}
                    fimEstudo={estudo.endDate}
                    participanteNome={participante.candidateName}
                    token={token}
                    podeAgendar={permitido}
                    onFechar={() => setModalAberto(false)}
                    onSalvar={handleAgendar}
                />
            )}
        </section>
    );
}
