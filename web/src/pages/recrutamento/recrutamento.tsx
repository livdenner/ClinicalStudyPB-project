import { useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AvaliacaoElegibilidade } from "../../components/candidatos/AvaliacaoElegibilidade";
import { ModalNovoCandidato } from "../../components/candidatos/ModalNovoCandidato";
import { TabelaCandidatos } from "../../components/candidatos/TabelaCandidatos";
import { Button } from "../../components/ui/Button";
import { ErrorMessage } from "../../components/ui/ErrorMessage";
import { useAuth } from "../../context/AuthContext";
import { ApiClientError } from "../../services/api/apiClient";
import { cadastrarCandidato, listarCandidatosPorEstudo } from "../../services/candidatos";
import { listarEstudos } from "../../services/estudos";
import type { UserRole } from "../../types/auth";
import {
    STATUS_ESTUDO_LABELS,
    type CandidatoApi,
    type DadosCandidatoApi,
    type EstudoComStatusApi,
    type StatusElegibilidadeApi,
    type StatusEstudoCandidato,
} from "../../types/candidato";

const PERFIS_PERMITIDOS: UserRole[] = ["COORDINATOR", "RESEARCHER"];

const STATUS_ESTUDO_CLASSES: Record<StatusEstudoCandidato, string> = {
    PLANNING: "bg-[#FEF3C7] text-[#92400E]",
    RECRUITMENT: "bg-[#E4F4E9] text-[#16804B]",
    EXECUTION: "bg-[#E9F2FD] text-[#245A91]",
    CLOSED: "bg-[#F1F5F9] text-[#475569]",
    CANCELLED: "bg-[#FDEAEA] text-[#B42318]",
};

export function RecrutamentoPage() {
    const { session, logout } = useAuth();
    const navigate = useNavigate();

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
            key={session.accessToken}
            token={session.accessToken}
            role={session.user.role}
            onIrParaLogin={handleIrParaLogin}
        />
    );
}

function GestaoCandidatos({
    token,
    role,
    onIrParaLogin,
}: {
    token: string;
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

    const [busca, setBusca] = useState("");
    const [modalAberto, setModalAberto] = useState(false);
    const [mensagemSucesso, setMensagemSucesso] = useState("");
    const [candidatoAvaliandoId, setCandidatoAvaliandoId] = useState<number | null>(null);

    useEffect(() => {
        const controller = new AbortController();

        listarEstudos(token, controller.signal)
            .then((dados) => {
                if (controller.signal.aborted) return;
                const lista = dados as EstudoComStatusApi[];
                setEstudos(lista);
                const primeiroId = lista[0]?.id ?? null;
                setEstudoSelecionadoId(primeiroId);
                if (primeiroId !== null) {
                    setCarregandoCandidatos(true);
                    setErroCandidatos("");
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
    }, [token, tentativaEstudos]);

    useEffect(() => {
        if (estudoSelecionadoId === null) {
            return;
        }

        const controller = new AbortController();

        listarCandidatosPorEstudo(estudoSelecionadoId, token, controller.signal)
            .then((dados) => {
                if (!controller.signal.aborted) {
                    setCandidatos(dados);
                }
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
    }, [estudoSelecionadoId, token, tentativaCandidatos]);

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

    async function handleCadastrar(dados: DadosCandidatoApi) {
        if (!estudoSelecionado) return;
        const novo = await cadastrarCandidato(estudoSelecionado.id, dados, token);
        setCandidatos((atuais) => [...atuais, novo]);
        setModalAberto(false);
        setMensagemSucesso("Candidato cadastrado com sucesso.");
    }

    function handleAtualizarStatusCandidato(
        candidateId: number,
        novoStatus: StatusElegibilidadeApi
    ) {
        setCandidatos((atuais) =>
            atuais.map((c) => (c.id === candidateId ? { ...c, eligibilityStatus: novoStatus } : c))
        );
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
                        Filtre por estudo, acompanhe a situação de elegibilidade e cadastre novos
                        candidatos.
                    </p>
                </div>

                {podeCadastrar && (
                    <Button
                        type="button"
                        variant="primary"
                        disabled={!botaoCadastroHabilitado}
                        onClick={() => {
                            setMensagemSucesso("");
                            setModalAberto(true);
                        }}
                        className="inline-flex items-center gap-2 font-semibold"
                    >
                        <Plus aria-hidden="true" size={18} />
                        Novo candidato
                    </Button>
                )}
            </header>

            {mensagemSucesso && (
                <div
                    role="status"
                    className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-3 text-sm font-medium text-[#065F46]"
                >
                    {mensagemSucesso}
                </div>
            )}

            <section
                className="flex flex-col gap-4 rounded-xl border border-[var(--color-border)] bg-white p-5"
                aria-label="Seleção de estudo e filtros"
            >
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div className="flex min-w-[260px] flex-1 flex-col gap-1.5">
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
                            disabled={carregandoEstudos || estudos.length === 0}
                            onChange={(event) => {
                                const valor = Number(event.target.value);
                                const novoId = Number.isNaN(valor) ? null : valor;
                                setMensagemSucesso("");
                                setCandidatoAvaliandoId(null);
                                setEstudoSelecionadoId(novoId);
                                if (novoId !== null) {
                                    setCarregandoCandidatos(true);
                                    setErroCandidatos("");
                                } else {
                                    setCandidatos([]);
                                    setCarregandoCandidatos(false);
                                    setErroCandidatos("");
                                }
                            }}
                            className="h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-text)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-60"
                        >
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
                            <span
                                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${STATUS_ESTUDO_CLASSES[statusEstudo]}`}
                            >
                                {STATUS_ESTUDO_LABELS[statusEstudo]}
                            </span>
                        </div>
                    )}

                    <div className="relative min-w-[240px] flex-1">
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

                {estudoSelecionado && !estudoEmRecrutamento && podeCadastrar && (
                    <p
                        role="note"
                        className="rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3.5 py-2.5 text-xs font-medium text-[#92400E]"
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
                        <TabelaCandidatos
                            candidatos={candidatosFiltrados}
                            onSelecionarCandidato={
                                podeCadastrar
                                    ? (candidato) => setCandidatoAvaliandoId(candidato.id)
                                    : undefined
                            }
                        />
                        <footer className="border-t border-[var(--color-border)] px-5 py-4 text-xs text-[var(--color-muted)]">
                            Exibindo {candidatosFiltrados.length} de {candidatos.length} candidatos
                        </footer>
                    </>
                )}
            </section>

            {modalAberto && estudoSelecionado && (
                <ModalNovoCandidato
                    estudoTitulo={estudoSelecionado.title}
                    onFechar={() => setModalAberto(false)}
                    onCadastrar={handleCadastrar}
                />
            )}
        </section>
    );
}
