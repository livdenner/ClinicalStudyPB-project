import { useEffect, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { ListaVisitasAgendadas } from "../../components/visitas/ListaVisitasAgendadas";
import { ModalDesfechoVisita } from "../../components/visitas/ModalDesfechoVisita";
import { Button } from "../../components/ui/Button";
import { STATUS_VISITA_CLASSES } from "../../config/visitas";
import { useAuth } from "../../context/AuthContext";
import { ApiClientError } from "../../services/api/apiClient";
import { listarEstudos, obterEstudo } from "../../services/estudos";
import { listarParticipantesPorEstudo } from "../../services/participantes";
import {
    listarVisitasDoEstudo,
    obterVisitaAgendada,
    registrarDesfechoVisita,
} from "../../services/visitas-agendadas";
import type { UserRole } from "../../types/auth";
import type { EstudoApi } from "../../types/estudo";
import type { ParticipanteApi } from "../../types/participante";
import {
    STATUS_VISITA_LABELS,
    type DadosDesfechoVisita,
    type DesfechoVisita,
    type StatusVisitaAgendada,
    type VisitaAgendada,
} from "../../types/visita-agendada";
import { podeRegistrarDesfecho } from "../../utils/desfecho-visita";

function mensagemErro(error: unknown, padrao: string): string {
    return error instanceof ApiClientError ? error.message : padrao;
}

/** Consulta visitas reais por estudo e permite desfechos ao coordenador. @author Lívia */
export function VisitasPage() {
    const { session } = useAuth();
    const [params] = useSearchParams();
    if (!session) return <Navigate to="/login" replace />;
    if (session.user.role !== "COORDINATOR" && session.user.role !== "RESEARCHER") {
        return (
            <section className="p-8">
                <h1 className="text-2xl font-bold text-[var(--color-title)]">Acesso restrito</h1>
                <p className="mt-2">
                    As visitas estão disponíveis para coordenadores e pesquisadores autorizados.
                </p>
            </section>
        );
    }
    return (
        <EstudosVisitas
            key={`${session.accessToken}:${params.get("studyId") ?? ""}`}
            token={session.accessToken}
            role={session.user.role}
            estudoSolicitado={params.get("studyId")}
        />
    );
}

function EstudosVisitas({
    token,
    role,
    estudoSolicitado,
}: {
    token: string;
    role: UserRole;
    estudoSolicitado: string | null;
}) {
    const [estudos, setEstudos] = useState<EstudoApi[]>([]);
    const [studyId, setStudyId] = useState<number | null>(null);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");
    const [tentativa, setTentativa] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        listarEstudos(token, controller.signal)
            .then((dados) => {
                if (controller.signal.aborted) return;
                setEstudos(dados);
                const solicitado =
                    estudoSolicitado &&
                    /^[1-9]\d*$/.test(estudoSolicitado) &&
                    Number.isSafeInteger(Number(estudoSolicitado))
                        ? Number(estudoSolicitado)
                        : null;
                setStudyId(
                    estudoSolicitado === null
                        ? (dados[0]?.id ?? null)
                        : (dados.find((estudo) => estudo.id === solicitado)?.id ?? null)
                );
            })
            .catch((error: unknown) => {
                if (!controller.signal.aborted)
                    setErro(
                        mensagemErro(
                            error,
                            "Não foi possível carregar os estudos. Tente novamente."
                        )
                    );
            })
            .finally(() => {
                if (!controller.signal.aborted) setCarregando(false);
            });
        return () => controller.abort();
    }, [token, estudoSolicitado, tentativa]);

    const selecionado = estudos.find((estudo) => estudo.id === studyId);

    return (
        <section className="flex flex-col gap-5" aria-labelledby="visitas-heading">
            <header>
                <h1
                    id="visitas-heading"
                    className="text-[28px] font-bold text-[var(--color-title)]"
                >
                    Visitas agendadas
                </h1>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                    Consulte a agenda e confirme os desfechos. Realizada, ausente e cancelada são
                    situações finais.
                </p>
            </header>
            <div className="flex flex-col gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                <label
                    htmlFor="visitas-estudo"
                    className="text-sm font-medium text-[var(--color-title)]"
                >
                    Estudo
                </label>
                <select
                    id="visitas-estudo"
                    value={studyId ?? ""}
                    disabled={carregando || estudos.length === 0}
                    onChange={(event) =>
                        setStudyId(event.target.value ? Number(event.target.value) : null)
                    }
                    className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
                >
                    {studyId === null && (
                        <option value="">
                            {estudos.length ? "Selecione um estudo" : "Nenhum estudo disponível"}
                        </option>
                    )}
                    {estudos.map((estudo) => (
                        <option key={estudo.id} value={estudo.id}>
                            {estudo.title}
                        </option>
                    ))}
                </select>
            </div>
            {carregando ? (
                <p role="status" className="text-sm text-[var(--color-muted)]">
                    Carregando estudos...
                </p>
            ) : erro ? (
                <div className="flex flex-col items-start gap-2">
                    <p role="alert" className="text-sm text-[var(--color-error)]">
                        {erro}
                    </p>
                    <Button
                        variant="secondary"
                        type="button"
                        onClick={() => {
                            setErro("");
                            setCarregando(true);
                            setTentativa((atual) => atual + 1);
                        }}
                    >
                        Tentar novamente
                    </Button>
                </div>
            ) : selecionado ? (
                <AgendaEstudo
                    key={selecionado.id}
                    estudo={selecionado}
                    role={role}
                    token={token}
                    onEstudoAtualizado={(atual) =>
                        setEstudos((anteriores) =>
                            anteriores.map((estudo) => (estudo.id === atual.id ? atual : estudo))
                        )
                    }
                />
            ) : (
                <p
                    role={estudoSolicitado !== null ? "alert" : "status"}
                    className="text-sm text-[var(--color-muted)]"
                >
                    {estudoSolicitado !== null
                        ? "O estudo solicitado não está disponível."
                        : "Nenhum estudo disponível para consultar visitas."}
                </p>
            )}
        </section>
    );
}

function AgendaEstudo({
    estudo,
    role,
    token,
    onEstudoAtualizado,
}: {
    estudo: EstudoApi;
    role: UserRole;
    token: string;
    onEstudoAtualizado: (estudo: EstudoApi) => void;
}) {
    const [status, setStatus] = useState<StatusVisitaAgendada | "">("");
    const [participantId, setParticipantId] = useState("");
    const [participantes, setParticipantes] = useState<ParticipanteApi[]>([]);
    const [carregandoParticipantes, setCarregandoParticipantes] = useState(true);
    const [erroParticipantes, setErroParticipantes] = useState("");
    const [tentativaParticipantes, setTentativaParticipantes] = useState(0);
    const [visitas, setVisitas] = useState<VisitaAgendada[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");
    const [tentativa, setTentativa] = useState(0);
    const [selecao, setSelecao] = useState<{
        visita: VisitaAgendada;
        outcome: DesfechoVisita;
    } | null>(null);
    const [registrando, setRegistrando] = useState(false);
    const [feedback, setFeedback] = useState<{
        texto: string;
        status: StatusVisitaAgendada;
    } | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        listarParticipantesPorEstudo(estudo.id, token, controller.signal)
            .then((dados) => {
                if (!controller.signal.aborted) setParticipantes(dados);
            })
            .catch((error: unknown) => {
                if (!controller.signal.aborted)
                    setErroParticipantes(
                        mensagemErro(error, "Não foi possível carregar os participantes.")
                    );
            })
            .finally(() => {
                if (!controller.signal.aborted) setCarregandoParticipantes(false);
            });
        return () => controller.abort();
    }, [estudo.id, token, tentativaParticipantes]);

    useEffect(() => {
        const controller = new AbortController();
        listarVisitasDoEstudo(
            estudo.id,
            {
                ...(status ? { status } : {}),
                ...(participantId ? { participantId: Number(participantId) } : {}),
            },
            token,
            controller.signal
        )
            .then((dados) => {
                if (!controller.signal.aborted) setVisitas(dados);
            })
            .catch((error: unknown) => {
                if (!controller.signal.aborted)
                    setErro(
                        mensagemErro(
                            error,
                            "Não foi possível carregar as visitas. Tente novamente."
                        )
                    );
            })
            .finally(() => {
                if (!controller.signal.aborted) setCarregando(false);
            });
        return () => controller.abort();
    }, [estudo.id, token, status, participantId, tentativa]);

    function prepararConsulta() {
        setCarregando(true);
        setErro("");
        setFeedback(null);
    }

    function atualizarLinha(atual: VisitaAgendada) {
        setVisitas((anteriores) => {
            const outras = anteriores.filter((visita) => visita.id !== atual.id);
            const corresponde =
                (!status || atual.status === status) &&
                (!participantId || atual.participantId === Number(participantId));
            return (corresponde ? [...outras, atual] : outras).sort(
                (a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt) || a.id - b.id
            );
        });
        setSelecao((anterior) =>
            anterior?.visita.id === atual.id ? { ...anterior, visita: atual } : anterior
        );
    }

    function abrirDesfecho(visita: VisitaAgendada, outcome: DesfechoVisita) {
        if (!podeRegistrarDesfecho(role, estudo.status, visita) || visita.studyId !== estudo.id)
            return;
        setFeedback(null);
        setSelecao({ visita, outcome });
    }

    async function confirmarDesfecho(dados: DadosDesfechoVisita) {
        if (
            !selecao ||
            registrando ||
            dados.outcome !== selecao.outcome ||
            !podeRegistrarDesfecho(role, estudo.status, selecao.visita)
        ) {
            throw new ApiClientError("A visita não está disponível para registrar esse desfecho.", {
                status: 409,
            });
        }
        setRegistrando(true);
        try {
            const atual = await registrarDesfechoVisita(selecao.visita, dados, token);
            atualizarLinha(atual);
            setSelecao(null);
            setFeedback({
                texto: `Desfecho registrado: ${STATUS_VISITA_LABELS[atual.status]}.`,
                status: atual.status,
            });
        } finally {
            setRegistrando(false);
        }
    }

    async function atualizarItem() {
        if (!selecao) return;
        const visita = selecao.visita;
        const [atual, estudoAtual] = await Promise.all([
            obterVisitaAgendada(estudo.id, visita.participantId, visita.id, token),
            obterEstudo(estudo.id, token),
        ]);
        atualizarLinha(atual);
        onEstudoAtualizado(estudoAtual);
    }

    const estudoEditavel = estudo.status !== "CLOSED" && estudo.status !== "CANCELLED";
    const filtrosBloqueados = registrando || Boolean(selecao);

    return (
        <section className="flex flex-col gap-4" aria-label="Agenda do estudo">
            {!estudoEditavel && (
                <p
                    role="note"
                    className="rounded-lg bg-[var(--color-neutral-soft)] p-3 text-sm text-[var(--color-neutral)]"
                >
                    Estudo em consulta: novos desfechos estão indisponíveis.
                </p>
            )}
            {feedback && (
                <p
                    role="status"
                    className={`rounded-lg p-3 text-sm font-medium ${STATUS_VISITA_CLASSES[feedback.status]}`}
                >
                    {feedback.texto}
                </p>
            )}
            <div className="flex flex-wrap items-end gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                <div className="flex min-w-[160px] flex-1 flex-col gap-1.5">
                    <label htmlFor="visitas-status" className="text-sm font-medium">
                        Situação
                    </label>
                    <select
                        id="visitas-status"
                        value={status}
                        disabled={filtrosBloqueados}
                        onChange={(event) => {
                            prepararConsulta();
                            setStatus(event.target.value as StatusVisitaAgendada | "");
                        }}
                        className="h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
                    >
                        <option value="">Todas as situações</option>
                        {Object.entries(STATUS_VISITA_LABELS).map(([valor, rotulo]) => (
                            <option key={valor} value={valor}>
                                {rotulo}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
                    <label htmlFor="visitas-participante" className="text-sm font-medium">
                        Participante
                    </label>
                    <select
                        id="visitas-participante"
                        value={participantId}
                        disabled={
                            filtrosBloqueados ||
                            carregandoParticipantes ||
                            Boolean(erroParticipantes)
                        }
                        onChange={(event) => {
                            prepararConsulta();
                            setParticipantId(event.target.value);
                        }}
                        className="h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
                    >
                        <option value="">Todos os participantes</option>
                        {participantes.map((participante) => (
                            <option key={participante.id} value={participante.id}>
                                {participante.candidateName}
                                {participante.status === "WITHDRAWN" ? " — Retirado" : ""}
                            </option>
                        ))}
                    </select>
                </div>
                <Button
                    type="button"
                    variant="secondary"
                    disabled={filtrosBloqueados || carregando}
                    onClick={() => {
                        prepararConsulta();
                        setTentativa((atual) => atual + 1);
                    }}
                    className="btn btn-secondary inline-flex items-center gap-2"
                >
                    <RefreshCw size={16} aria-hidden="true" />
                    Atualizar visitas
                </Button>
            </div>
            {erroParticipantes && (
                <div className="flex flex-wrap items-center gap-3">
                    <p role="alert" className="text-sm text-[var(--color-error)]">
                        {erroParticipantes}
                    </p>
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={carregandoParticipantes || filtrosBloqueados}
                        onClick={() => {
                            setErroParticipantes("");
                            setCarregandoParticipantes(true);
                            setTentativaParticipantes((atual) => atual + 1);
                        }}
                    >
                        Consultar participantes novamente
                    </Button>
                </div>
            )}
            <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                {carregando ? (
                    <p role="status" className="p-8 text-center text-sm text-[var(--color-muted)]">
                        Carregando visitas...
                    </p>
                ) : erro ? (
                    <div className="flex flex-col items-center gap-3 p-6">
                        <p role="alert" className="text-sm text-[var(--color-error)]">
                            {erro}
                        </p>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                                prepararConsulta();
                                setTentativa((atual) => atual + 1);
                            }}
                        >
                            Tentar novamente
                        </Button>
                    </div>
                ) : (
                    <>
                        <ListaVisitasAgendadas
                            visitas={visitas}
                            exibirParticipante
                            onDesfecho={
                                role === "COORDINATOR" && estudoEditavel ? abrirDesfecho : undefined
                            }
                        />
                        <p className="border-t border-[var(--color-border)] px-5 py-3 text-xs text-[var(--color-muted)]">
                            {visitas.length}{" "}
                            {visitas.length === 1 ? "visita encontrada" : "visitas encontradas"}.
                            Horários de Fortaleza.
                        </p>
                    </>
                )}
            </div>
            {selecao && (
                <ModalDesfechoVisita
                    key={`${selecao.visita.id}:${selecao.outcome}`}
                    visita={selecao.visita}
                    outcome={selecao.outcome}
                    permitido={podeRegistrarDesfecho(role, estudo.status, selecao.visita)}
                    onFechar={() => setSelecao(null)}
                    onConfirmar={confirmarDesfecho}
                    onAtualizar={atualizarItem}
                />
            )}
        </section>
    );
}
