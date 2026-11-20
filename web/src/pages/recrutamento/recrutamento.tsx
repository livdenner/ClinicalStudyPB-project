import { calcularVagasDisponiveis } from "../../utils/estudos";
import { SeloEstadoEstudo } from "../../components/estudos/SeloEstadoEstudo";
import { useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { AvaliacaoElegibilidade } from "../../components/candidatos/AvaliacaoElegibilidade";
import { ModalConfirmarInclusao } from "../../components/candidatos/ModalConfirmarInclusao";
import { ModalCancelarCandidatura } from "../../components/candidatos/ModalCancelarCandidatura";
import { ModalNovoCandidato } from "../../components/candidatos/ModalNovoCandidato";
import { PainelParticipantesVagas } from "../../components/candidatos/PainelParticipantesVagas";
import { ListaCandidatos } from "../../components/candidatos/ListaCandidatos";
import { Button } from "../../components/ui/Button";
import { ErrorMessage } from "../../components/ui/ErrorMessage";
import { useAuth } from "../../context/AuthContext";
import { ApiClientError } from "../../services/api/apiClient";
import {
    cadastrarCandidato,
    cancelarCandidatura,
    listarCandidatosPorEstudo,
    obterCandidato,
} from "../../services/candidatos";
import { listarEstudos, obterEstudo } from "../../services/estudos";
import {
    incluirParticipanteNoEstudo,
    listarParticipantesPorEstudo,
} from "../../services/participantes";
import type { UserRole } from "../../types/auth";
import {
    STATUS_ESTUDO_LABELS,
    type CandidatoApi,
    type DadosCandidatoApi,
    type EstudoComStatusApi,
    type StatusEstudoCandidato,
} from "../../types/candidato";
import type { ParticipanteApi } from "../../types/participante";
import { candidatoPodeSerCancelado, candidatoPodeSerIncluido } from "../../utils/candidatos";

const PERFIS_PERMITIDOS: UserRole[] = ["COORDINATOR", "RESEARCHER"];

/** Abre o acompanhamento de candidatos conforme o perfil autenticado. @author Lívia */
export function RecrutamentoPage() {
    const { session, logout } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const estudoSolicitado = searchParams.get("studyId");

    if (!session) {
        return <Navigate to="/login" replace />;
    }

    if (!PERFIS_PERMITIDOS.includes(session.user.role)) {
        return (
            <section className="py-12 text-center">
                <h1 className="text-2xl font-bold text-[var(--color-title)]">Acesso restrito</h1>
                <p className="my-4">
                    A gestão de candidatos está disponível apenas para coordenadores e
                    pesquisadores.
                </p>
                {session.user.role === "ADMINISTRATOR" && (
                    <Link className="text-[var(--color-primary)] underline" to="/usuarios">
                        Ir para usuários e acessos
                    </Link>
                )}
            </section>
        );
    }

    async function handleIrParaLogin() {
        await logout();
        navigate("/login", { replace: true });
    }

    return (
        <GestaoCandidatos
            key={`${session.accessToken}:${estudoSolicitado ?? ""}`}
            token={session.accessToken}
            estudoSolicitado={estudoSolicitado}
            role={session.user.role}
            onIrParaLogin={handleIrParaLogin}
        />
    );
}

function GestaoCandidatos({
    estudoSolicitado,
    token,
    role,
    onIrParaLogin,
}: {
    token: string;
    estudoSolicitado: string | null;
    role: UserRole;
    onIrParaLogin: () => Promise<void>;
}) {
    const [estudos, setEstudos] = useState<EstudoComStatusApi[]>([]);
    const [estudoSelecionadoId, setEstudoSelecionadoId] = useState<number | null>(null);
    const [carregandoEstudos, setCarregandoEstudos] = useState(true);
    const [erroEstudos, setErroEstudos] = useState("");
    const [tentativaEstudos, setTentativaEstudos] = useState(0);

    const [candidatos, setCandidatos] = useState<CandidatoApi[]>([]);
    const [carregandoCandidatos, setCarregandoCandidatos] = useState(false);
    const [erroCandidatos, setErroCandidatos] = useState("");
    const [tentativaCandidatos, setTentativaCandidatos] = useState(0);
    const [incluirCancelados, setIncluirCancelados] = useState(false);

    const [participantes, setParticipantes] = useState<ParticipanteApi[]>([]);
    const [carregandoParticipantes, setCarregandoParticipantes] = useState(false);
    const [erroParticipantes, setErroParticipantes] = useState("");
    const [tentativaParticipantes, setTentativaParticipantes] = useState(0);

    const [busca, setBusca] = useState("");
    const [modalAberto, setModalAberto] = useState(false);
    const [mensagemSucesso, setMensagemSucesso] = useState("");
    const [candidatoAvaliandoId, setCandidatoAvaliandoId] = useState<number | null>(null);
    const [candidatoIncluindo, setCandidatoIncluindo] = useState<CandidatoApi | null>(null);
    const [candidatoCancelando, setCandidatoCancelando] = useState<CandidatoApi | null>(null);

    useEffect(() => {
        const controller = new AbortController();

        listarEstudos(token, controller.signal)
            .then((dados) => {
                if (controller.signal.aborted) return;
                const lista = dados as EstudoComStatusApi[];
                setEstudos(lista);
                const idSolicitado =
                    estudoSolicitado !== null &&
                    /^[1-9]\d*$/.test(estudoSolicitado) &&
                    Number.isSafeInteger(Number(estudoSolicitado))
                        ? Number(estudoSolicitado)
                        : null;
                const primeiroId =
                    estudoSolicitado === null
                        ? (lista[0]?.id ?? null)
                        : (lista.find((item) => item.id === idSolicitado)?.id ?? null);
                setEstudoSelecionadoId(primeiroId);
                if (primeiroId !== null) {
                    setCarregandoCandidatos(true);
                    setErroCandidatos("");
                    setCarregandoParticipantes(true);
                    setErroParticipantes("");
                }
            })
            .catch((error: unknown) => {
                if (controller.signal.aborted) return;
                if (error instanceof ApiClientError && error.status === 401) {
                    setErroEstudos("Sua sessão não é mais válida. Entre novamente para continuar.");
                } else if (error instanceof ApiClientError && error.status === 403) {
                    setErroEstudos("Você não tem permissão para consultar estudos.");
                } else {
                    setErroEstudos(
                        "Não foi possível carregar os estudos. Verifique a conexão e tente novamente."
                    );
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setCarregandoEstudos(false);
                }
            });

        return () => controller.abort();
    }, [token, tentativaEstudos, estudoSolicitado]);

    useEffect(() => {
        if (estudoSelecionadoId === null) {
            return;
        }

        const controller = new AbortController();

        listarCandidatosPorEstudo(estudoSelecionadoId, token, controller.signal, incluirCancelados)
            .then((dados) => {
                if (controller.signal.aborted) return;
                setCandidatos(dados);
            })
            .catch((error: unknown) => {
                if (controller.signal.aborted) return;
                if (error instanceof ApiClientError && error.status === 401) {
                    setErroCandidatos(
                        "Sua sessão não é mais válida. Entre novamente para continuar."
                    );
                } else if (error instanceof ApiClientError && error.status === 403) {
                    setErroCandidatos(
                        "Você não tem permissão para consultar os candidatos deste estudo."
                    );
                } else if (error instanceof ApiClientError && error.status === 404) {
                    setErroCandidatos("O estudo selecionado não foi encontrado.");
                } else {
                    setErroCandidatos(
                        "Não foi possível carregar os candidatos. Verifique a conexão e tente novamente."
                    );
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setCarregandoCandidatos(false);
                }
            });

        return () => controller.abort();
    }, [estudoSelecionadoId, token, tentativaCandidatos, incluirCancelados]);

    useEffect(() => {
        if (estudoSelecionadoId === null) {
            return;
        }

        const controller = new AbortController();

        listarParticipantesPorEstudo(estudoSelecionadoId, token, controller.signal)
            .then((dados) => {
                if (!controller.signal.aborted) {
                    setParticipantes(Array.isArray(dados) ? dados : []);
                }
            })
            .catch((error: unknown) => {
                if (controller.signal.aborted) return;
                if (error instanceof ApiClientError && error.status === 401) {
                    setErroParticipantes(
                        "Sua sessão não é mais válida. Entre novamente para continuar."
                    );
                } else if (error instanceof ApiClientError && error.status === 403) {
                    setErroParticipantes(
                        "Você não tem permissão para consultar os participantes deste estudo."
                    );
                } else if (error instanceof ApiClientError && error.status === 404) {
                    setErroParticipantes("O estudo selecionado não foi encontrado.");
                } else {
                    setErroParticipantes(
                        "Não foi possível carregar os participantes do estudo. Tente novamente."
                    );
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setCarregandoParticipantes(false);
                }
            });

        return () => controller.abort();
    }, [estudoSelecionadoId, token, tentativaParticipantes]);

    const estudoSelecionado =
        estudoSelecionadoId !== null
            ? (estudos.find((estudo) => estudo.id === estudoSelecionadoId) ?? null)
            : null;

    const statusEstudo: StatusEstudoCandidato = estudoSelecionado?.status ?? "PLANNING";
    const estudoEmRecrutamento = statusEstudo === "RECRUITMENT";
    const podeCadastrar = role === "COORDINATOR";
    const botaoCadastroHabilitado =
        podeCadastrar &&
        Boolean(estudoSelecionado) &&
        estudoEmRecrutamento &&
        !carregandoEstudos &&
        !erroEstudos;

    const limiteVagas = estudoSelecionado?.participantLimit ?? 0;
    const vagasOcupadas = participantes.length;
    const vagasDisponiveis = calcularVagasDisponiveis(limiteVagas, vagasOcupadas);
    const vagasConhecidas = !carregandoParticipantes && !erroParticipantes;

    function atualizarCandidatos() {
        setCarregandoCandidatos(true);
        setErroCandidatos("");
        setTentativaCandidatos((atual) => atual + 1);
    }

    function atualizarListas() {
        atualizarCandidatos();
        setCarregandoParticipantes(true);
        setErroParticipantes("");
        setTentativaParticipantes((atual) => atual + 1);
    }

    function handleAbrirInclusao(candidato: CandidatoApi) {
        if (
            !podeCadastrar ||
            !candidatoPodeSerIncluido(candidato) ||
            !estudoEmRecrutamento ||
            !vagasConhecidas ||
            vagasDisponiveis <= 0
        )
            return;
        setMensagemSucesso("");
        setCandidatoIncluindo(candidato);
    }

    function handleAbrirCancelamento(candidato: CandidatoApi) {
        if (
            !podeCadastrar ||
            !estudoSelecionado ||
            !estudoEmRecrutamento ||
            carregandoEstudos ||
            erroEstudos ||
            carregandoCandidatos ||
            erroCandidatos ||
            candidato.studyId !== estudoSelecionado.id ||
            !candidatoPodeSerCancelado(candidato)
        )
            return;
        setMensagemSucesso("");
        setCandidatoCancelando(candidato);
    }

    async function handleCancelarCandidatura(reason: string) {
        if (
            !podeCadastrar ||
            !estudoSelecionado ||
            !candidatoCancelando ||
            !estudoEmRecrutamento ||
            candidatoCancelando.studyId !== estudoSelecionado.id ||
            !candidatoPodeSerCancelado(candidatoCancelando)
        ) {
            throw new ApiClientError("A candidatura não está disponível para cancelamento.", {
                status: 409,
            });
        }
        await cancelarCandidatura(estudoSelecionado.id, candidatoCancelando.id, { reason }, token);
        setCandidatoCancelando(null);
        setMensagemSucesso("Candidatura cancelada com sucesso. O histórico foi preservado.");
        atualizarListas();
    }

    async function handleAtualizarCancelamento() {
        if (!estudoSelecionado || !candidatoCancelando) {
            throw new Error("Selecione uma candidatura para atualizar os dados.");
        }
        try {
            const [candidatoAtual, estudoAtual] = await Promise.all([
                obterCandidato(estudoSelecionado.id, candidatoCancelando.id, token),
                obterEstudo(estudoSelecionado.id, token),
            ]);
            setCandidatoCancelando(candidatoAtual);
            setEstudos((atuais) =>
                atuais.map((estudo) => (estudo.id === estudoAtual.id ? estudoAtual : estudo))
            );
        } finally {
            atualizarListas();
        }
    }

    async function handleCadastrar(dados: DadosCandidatoApi) {
        if (!estudoSelecionado) throw new Error("Selecione um estudo para cadastrar o candidato.");
        const novo = await cadastrarCandidato(estudoSelecionado.id, dados, token);
        const { activation, ...candidato } = novo;
        setCandidatos((atuais) => [
            ...atuais,
            {
                ...candidato,
                ...(activation
                    ? {
                          activation: {
                              expiresAt: activation.expiresAt,
                              expired: activation.expired,
                          },
                      }
                    : {}),
            },
        ]);
        setMensagemSucesso(
            novo.status === "INVITED"
                ? "Candidato cadastrado. Convite emitido."
                : "Candidato cadastrado. Vinculado a conta existente."
        );
        return novo;
    }

    async function handleConfirmarInclusao() {
        if (!estudoSelecionado || !candidatoIncluindo) return;
        if (
            !podeCadastrar ||
            !candidatoPodeSerIncluido(candidatoIncluindo) ||
            !estudoEmRecrutamento ||
            !vagasConhecidas ||
            vagasDisponiveis <= 0
        ) {
            throw new ApiClientError("O candidato não atende às condições para inclusão.", {
                status: 409,
            });
        }
        await incluirParticipanteNoEstudo(estudoSelecionado.id, candidatoIncluindo.id, token);
        setCandidatoIncluindo(null);
        setMensagemSucesso("Participante incluído no estudo com sucesso.");
        atualizarListas();
    }

    function handleAtualizarStatusCandidato() {
        atualizarCandidatos();
    }

    const candidatoAvaliando =
        candidatoAvaliandoId !== null
            ? (candidatos.find((c) => c.id === candidatoAvaliandoId) ?? null)
            : null;

    if (candidatoAvaliando && estudoSelecionado) {
        return (
            <AvaliacaoElegibilidade
                estudo={estudoSelecionado}
                candidato={candidatoAvaliando}
                token={token}
                role={role}
                onVoltar={() => setCandidatoAvaliandoId(null)}
                onAtualizarStatusCandidato={handleAtualizarStatusCandidato}
            />
        );
    }

    const termoBusca = busca.trim().toLocaleLowerCase("pt-BR");
    const candidatosFiltrados = candidatos.filter(
        (candidato) => !termoBusca || candidato.name.toLocaleLowerCase("pt-BR").includes(termoBusca)
    );

    return (
        <section className="flex flex-col gap-6" aria-labelledby="recrutamento-heading">
            <header className="flex items-center justify-between gap-5 max-[760px]:flex-col max-[760px]:items-start">
                <div>
                    <h1
                        id="recrutamento-heading"
                        className="text-[28px] font-bold tracking-tight text-[var(--color-title)]"
                    >
                        Candidatos e recrutamento
                    </h1>
                    <p className="mt-2 text-sm text-[var(--color-muted)]">
                        Acompanhe a situação dos candidatos. O consentimento é decidido pelo próprio
                        candidato no aplicativo; atualize a lista para consultar mudanças.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={
                            !estudoSelecionado ||
                            carregandoEstudos ||
                            carregandoCandidatos ||
                            carregandoParticipantes
                        }
                        onClick={atualizarListas}
                    >
                        Atualizar lista
                    </Button>
                    {podeCadastrar && (
                        <Button
                            type="button"
                            variant="primary"
                            disabled={!botaoCadastroHabilitado}
                            onClick={() => {
                                setMensagemSucesso("");
                                setModalAberto(true);
                            }}
                            className="btn button--create"
                        >
                            <Plus aria-hidden="true" size={18} />
                            Novo candidato
                        </Button>
                    )}
                </div>
            </header>

            {mensagemSucesso && (
                <div
                    role="status"
                    className="rounded-xl border border-[var(--color-success-border)] bg-[var(--color-success-soft)] px-4 py-3 text-sm font-medium text-[var(--color-success)]"
                >
                    {mensagemSucesso}
                </div>
            )}

            <section
                className="flex flex-col gap-4 rounded-xl border border-[var(--color-border)] bg-white p-5"
                aria-label="Seleção de estudo e filtros"
            >
                {estudoSolicitado !== null &&
                    !carregandoEstudos &&
                    !erroEstudos &&
                    estudoSelecionadoId === null && (
                        <p
                            role="alert"
                            className="rounded-lg bg-[var(--color-warning-soft)] p-3 text-sm text-[var(--color-warning)]"
                        >
                            O estudo solicitado não está disponível. Selecione outro estudo para
                            continuar.
                        </p>
                    )}
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div className="flex min-w-0 basis-full flex-1 flex-col min-[761px]:basis-[260px] gap-1.5">
                        <label
                            htmlFor="seletor-estudo-candidatos"
                            className="text-sm font-medium text-[var(--color-title)]"
                        >
                            Estudo clínico
                        </label>
                        <select
                            id="seletor-estudo-candidatos"
                            aria-label="Estudo clínico"
                            value={estudoSelecionadoId ?? ""}
                            disabled={
                                carregandoEstudos ||
                                estudos.length === 0 ||
                                Boolean(candidatoCancelando)
                            }
                            onChange={(event) => {
                                const valor = Number(event.target.value);
                                const novoId = Number.isNaN(valor) ? null : valor;
                                setMensagemSucesso("");
                                setCandidatoAvaliandoId(null);
                                setCandidatoIncluindo(null);
                                setCandidatoCancelando(null);
                                setEstudoSelecionadoId(novoId);
                                if (novoId !== null) {
                                    setCarregandoCandidatos(true);
                                    setErroCandidatos("");
                                    setCarregandoParticipantes(true);
                                    setErroParticipantes("");
                                } else {
                                    setCandidatos([]);
                                    setCarregandoCandidatos(false);
                                    setErroCandidatos("");
                                    setParticipantes([]);
                                    setCarregandoParticipantes(false);
                                    setErroParticipantes("");
                                }
                            }}
                            className="h-10 w-full min-w-0 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-text)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-60"
                        >
                            {estudoSelecionadoId === null && estudos.length > 0 && (
                                <option value="" disabled>
                                    Selecione um estudo
                                </option>
                            )}
                            {estudos.length === 0 ? (
                                <option value="">Nenhum estudo disponível</option>
                            ) : (
                                estudos.map((estudo) => (
                                    <option key={estudo.id} value={estudo.id}>
                                        {estudo.title}
                                    </option>
                                ))
                            )}
                        </select>
                    </div>

                    {estudoSelecionado && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-[var(--color-muted)]">
                                Estado do estudo:
                            </span>
                            <SeloEstadoEstudo estado={statusEstudo} />
                        </div>
                    )}

                    <div className="relative min-w-0 basis-full flex-1 min-[761px]:basis-[240px]">
                        <Search
                            size={16}
                            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--color-muted)]"
                            aria-hidden="true"
                        />
                        <input
                            type="search"
                            value={busca}
                            onChange={(event) => setBusca(event.target.value)}
                            placeholder="Buscar candidato por identificação..."
                            aria-label="Buscar candidato por identificação"
                            disabled={carregandoEstudos || estudoSelecionado === null}
                            className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-white pr-3 pl-9 text-sm text-[var(--color-text)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-60"
                        />
                    </div>
                </div>

                <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text)]">
                    <input
                        type="checkbox"
                        checked={incluirCancelados}
                        disabled={
                            !estudoSelecionado ||
                            carregandoEstudos ||
                            Boolean(erroEstudos) ||
                            Boolean(candidatoCancelando)
                        }
                        onChange={(event) => {
                            if (event.target.checked === incluirCancelados) return;
                            setIncluirCancelados(event.target.checked);
                            setCarregandoCandidatos(true);
                            setErroCandidatos("");
                        }}
                        className="h-4 w-4 accent-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
                    />
                    Exibir candidaturas canceladas
                </label>

                {estudoSelecionado && !estudoEmRecrutamento && podeCadastrar && (
                    <p
                        role="note"
                        className="rounded-lg border border-[var(--color-warning-border)] bg-[var(--color-warning-soft)] px-3.5 py-2.5 text-xs font-medium text-[var(--color-warning)]"
                    >
                        O cadastro de novos candidatos só é permitido quando o estudo está em
                        recrutamento. Estado atual:{" "}
                        <strong>{STATUS_ESTUDO_LABELS[statusEstudo]}</strong>.
                    </p>
                )}
            </section>

            <section
                className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white"
                aria-labelledby="lista-candidatos-heading"
            >
                <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border)] px-5 py-4">
                    <div>
                        <h2
                            id="lista-candidatos-heading"
                            className="text-base font-bold text-[var(--color-title)]"
                        >
                            Candidatos do estudo
                        </h2>
                        <p className="mt-1 text-xs text-[var(--color-muted)]">
                            {estudoSelecionado
                                ? `Acompanhamento de candidatos vinculados a ${estudoSelecionado.title}`
                                : "Selecione um estudo para visualizar seus candidatos"}
                        </p>
                    </div>
                </div>

                {carregandoEstudos ? (
                    <p role="status" className="p-8 text-center text-sm text-[var(--color-muted)]">
                        Carregando estudos...
                    </p>
                ) : erroEstudos ? (
                    <div className="flex flex-col items-center gap-3 p-8 text-center">
                        <ErrorMessage message={erroEstudos} />
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                                setCarregandoEstudos(true);
                                setErroEstudos("");
                                setTentativaEstudos((atual) => atual + 1);
                            }}
                        >
                            Tentar novamente
                        </Button>
                        <button
                            type="button"
                            onClick={() => void onIrParaLogin()}
                            className="cursor-pointer text-sm text-[var(--color-primary)] underline"
                        >
                            Ir para o login
                        </button>
                    </div>
                ) : estudos.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
                        <strong className="text-sm font-semibold text-[var(--color-title)]">
                            Nenhum estudo cadastrado
                        </strong>
                        <span className="text-sm text-[var(--color-muted)]">
                            Cadastre um estudo clínico para iniciar o recrutamento de candidatos.
                        </span>
                    </div>
                ) : carregandoCandidatos ? (
                    <p role="status" className="p-8 text-center text-sm text-[var(--color-muted)]">
                        Carregando candidatos...
                    </p>
                ) : erroCandidatos ? (
                    <div className="flex flex-col items-center gap-3 p-8 text-center">
                        <ErrorMessage message={erroCandidatos} />
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                                setCarregandoCandidatos(true);
                                setErroCandidatos("");
                                setTentativaCandidatos((atual) => atual + 1);
                            }}
                        >
                            Tentar novamente
                        </Button>
                    </div>
                ) : (
                    <>
                        <ListaCandidatos
                            candidatos={candidatosFiltrados}
                            vagasDisponiveis={vagasConhecidas ? vagasDisponiveis : undefined}
                            estudoEmRecrutamento={estudoEmRecrutamento}
                            onSelecionarCandidato={
                                podeCadastrar
                                    ? (candidato) => setCandidatoAvaliandoId(candidato.id)
                                    : undefined
                            }
                            onIncluirParticipante={podeCadastrar ? handleAbrirInclusao : undefined}
                            onCancelarCandidatura={
                                podeCadastrar ? handleAbrirCancelamento : undefined
                            }
                        />
                        <footer className="border-t border-[var(--color-border)] px-5 py-4 text-xs text-[var(--color-muted)]">
                            Exibindo {candidatosFiltrados.length} de {candidatos.length} candidatos
                        </footer>
                    </>
                )}
            </section>

            {estudoSelecionado && !carregandoEstudos && !erroEstudos && (
                <PainelParticipantesVagas
                    estudoTitulo={estudoSelecionado.title}
                    limiteVagas={limiteVagas}
                    participantes={participantes}
                    carregando={carregandoParticipantes}
                    erro={erroParticipantes}
                    onTentarNovamente={() => {
                        setCarregandoParticipantes(true);
                        setErroParticipantes("");
                        setTentativaParticipantes((atual) => atual + 1);
                    }}
                />
            )}

            {modalAberto && estudoSelecionado && (
                <ModalNovoCandidato
                    estudoTitulo={estudoSelecionado.title}
                    onFechar={() => setModalAberto(false)}
                    onCadastrar={handleCadastrar}
                />
            )}

            {candidatoCancelando && estudoSelecionado && (
                <ModalCancelarCandidatura
                    key={`${estudoSelecionado.id}:${candidatoCancelando.id}`}
                    estudoTitulo={estudoSelecionado.title}
                    candidato={candidatoCancelando}
                    permitido={
                        podeCadastrar &&
                        estudoEmRecrutamento &&
                        candidatoPodeSerCancelado(candidatoCancelando)
                    }
                    onFechar={() => setCandidatoCancelando(null)}
                    onConfirmar={handleCancelarCandidatura}
                    onAtualizar={handleAtualizarCancelamento}
                />
            )}

            {candidatoIncluindo && estudoSelecionado && (
                <ModalConfirmarInclusao
                    estudoTitulo={estudoSelecionado.title}
                    candidato={candidatoIncluindo}
                    vagasOcupadas={vagasOcupadas}
                    limiteVagas={limiteVagas}
                    onFechar={() => setCandidatoIncluindo(null)}
                    onConfirmar={handleConfirmarInclusao}
                />
            )}
        </section>
    );
}
