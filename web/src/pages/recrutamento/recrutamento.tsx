import { SeloEstadoEstudo } from "../../components/estudos/SeloEstadoEstudo";
import { useCallback, useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AvaliacaoElegibilidade } from "../../components/candidatos/AvaliacaoElegibilidade";
import { ConsentimentoSimulado } from "../../components/candidatos/ConsentimentoSimulado";
import { ModalConfirmarInclusao } from "../../components/candidatos/ModalConfirmarInclusao";
import { ModalNovoCandidato } from "../../components/candidatos/ModalNovoCandidato";
import { PainelParticipantesVagas } from "../../components/candidatos/PainelParticipantesVagas";
import { TabelaCandidatos } from "../../components/candidatos/TabelaCandidatos";
import { Button } from "../../components/ui/Button";
import { ErrorMessage } from "../../components/ui/ErrorMessage";
import { useAuth } from "../../context/AuthContext";
import { ApiClientError } from "../../services/api/apiClient";
import { cadastrarCandidato, listarCandidatosPorEstudo } from "../../services/candidatos";
import { obterConsentimentoSimulado } from "../../services/consentimento";
import { listarEstudos } from "../../services/estudos";
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
    type StatusElegibilidadeApi,
    type StatusEstudoCandidato,
} from "../../types/candidato";
import type { StatusConsentimentoApi } from "../../types/consentimento";
import type { ParticipanteApi } from "../../types/participante";

const PERFIS_PERMITIDOS: UserRole[] = ["COORDINATOR", "RESEARCHER"];
const CONSENTIMENTO_CACHE_KEY = "clinicalstudypb.consentimentos";

/**
 * Guarda só a identificação do termo, que a API não armazena. A decisão do consentimento
 * vem sempre da API: o cache local não vale em outro navegador nem para dados do seed.
 */
type CacheConsentimentoItem = {
    termo: string;
};

/**
 * Consulta a decisão de consentimento de cada candidato. Uma falha isolada não esconde a
 * lista: o candidato fica sem decisão conhecida, e a inclusão continua bloqueada para ele.
 */
async function carregarConsentimentos(
    studyId: number,
    candidatos: CandidatoApi[],
    token: string,
    signal: AbortSignal
): Promise<{ lista: CandidatoApi[]; falhou: boolean }> {
    const resultados = await Promise.allSettled(
        candidatos.map((candidato) =>
            obterConsentimentoSimulado(studyId, candidato.id, token, signal)
        )
    );
    let falhou = false;
    const lista = candidatos.map((candidato, indice) => {
        const resultado = resultados[indice];
        if (resultado.status === "fulfilled") {
            return { ...candidato, consentStatus: resultado.value.status };
        }
        falhou = true;
        return candidato;
    });
    return { lista, falhou };
}

function lerCacheConsentimentos(): Record<number, CacheConsentimentoItem> {
    try {
        const bruto = localStorage.getItem(CONSENTIMENTO_CACHE_KEY);
        if (!bruto) return {};
        return JSON.parse(bruto) as Record<number, CacheConsentimentoItem>;
    } catch {
        return {};
    }
}

function salvarCacheConsentimento(candidateId: number, termo: string) {
    try {
        const atual = lerCacheConsentimentos();
        atual[candidateId] = { termo };
        localStorage.setItem(CONSENTIMENTO_CACHE_KEY, JSON.stringify(atual));
    } catch {
        // Ignora falha de armazenamento local
    }
}

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
            responsavelNome={session.user.name}
            onIrParaLogin={handleIrParaLogin}
        />
    );
}

function GestaoCandidatos({
    token,
    role,
    responsavelNome,
    onIrParaLogin,
}: {
    token: string;
    role: UserRole;
    responsavelNome: string;
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
    const [avisoConsentimentos, setAvisoConsentimentos] = useState("");

    const [participantes, setParticipantes] = useState<ParticipanteApi[]>([]);
    const [carregandoParticipantes, setCarregandoParticipantes] = useState(false);
    const [erroParticipantes, setErroParticipantes] = useState("");
    const [tentativaParticipantes, setTentativaParticipantes] = useState(0);

    const [busca, setBusca] = useState("");
    const [modalAberto, setModalAberto] = useState(false);
    const [mensagemSucesso, setMensagemSucesso] = useState("");
    const [candidatoAvaliandoId, setCandidatoAvaliandoId] = useState<number | null>(null);
    const [candidatoConsentimentoId, setCandidatoConsentimentoId] = useState<number | null>(null);
    const [candidatoIncluindo, setCandidatoIncluindo] = useState<CandidatoApi | null>(null);
    const [termosConsentimento, setTermosConsentimento] = useState<Record<number, string>>(() => {
        const cache = lerCacheConsentimentos();
        const inicial: Record<number, string> = {};
        for (const [idStr, item] of Object.entries(cache)) {
            inicial[Number(idStr)] = item.termo;
        }
        return inicial;
    });

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
    }, [token, tentativaEstudos]);

    useEffect(() => {
        if (estudoSelecionadoId === null) {
            return;
        }

        const controller = new AbortController();

        listarCandidatosPorEstudo(estudoSelecionadoId, token, controller.signal)
            .then(async (dados) => {
                if (controller.signal.aborted) return;
                // Só o coordenador consulta o consentimento; para os outros perfis a API responde 403.
                const resultado =
                    role === "COORDINATOR"
                        ? await carregarConsentimentos(
                              estudoSelecionadoId,
                              dados,
                              token,
                              controller.signal
                          )
                        : { lista: dados, falhou: false };
                if (controller.signal.aborted) return;
                setCandidatos(resultado.lista);
                setAvisoConsentimentos(
                    resultado.falhou
                        ? "Não foi possível consultar o consentimento de alguns candidatos. A inclusão deles fica bloqueada até uma nova consulta."
                        : ""
                );
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
    }, [estudoSelecionadoId, token, role, tentativaCandidatos]);

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
    const vagasDisponiveis = Math.max(0, limiteVagas - vagasOcupadas);
    const participantesCandidatoIds = new Set(participantes.map((p) => p.candidateId));

    async function handleCadastrar(dados: DadosCandidatoApi) {
        if (!estudoSelecionado) return;
        const novo = await cadastrarCandidato(estudoSelecionado.id, dados, token);
        setCandidatos((atuais) => [...atuais, novo]);
        setModalAberto(false);
        setMensagemSucesso("Candidato cadastrado com sucesso.");
    }

    async function handleConfirmarInclusao() {
        if (!estudoSelecionado || !candidatoIncluindo) return;
        const novoParticipante = await incluirParticipanteNoEstudo(
            estudoSelecionado.id,
            candidatoIncluindo.id,
            token
        );
        setParticipantes((atuais) =>
            atuais.some((p) => p.id === novoParticipante.id)
                ? atuais
                : [...atuais, novoParticipante]
        );
        setCandidatoIncluindo(null);
        setMensagemSucesso("Participante incluído no estudo com sucesso.");
    }

    function handleAtualizarStatusCandidato(
        candidateId: number,
        novoStatus: StatusElegibilidadeApi
    ) {
        setCandidatos((atuais) =>
            atuais.map((c) => (c.id === candidateId ? { ...c, eligibilityStatus: novoStatus } : c))
        );
    }

    const handleAtualizarConsentimentoCandidato = useCallback(
        (candidateId: number, novoStatus: StatusConsentimentoApi, termoIdentificacao: string) => {
            salvarCacheConsentimento(candidateId, termoIdentificacao);
            setCandidatos((atuais) =>
                atuais.map((c) => (c.id === candidateId ? { ...c, consentStatus: novoStatus } : c))
            );
            setTermosConsentimento((atuais) => ({
                ...atuais,
                [candidateId]: termoIdentificacao,
            }));
        },
        []
    );

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

    const candidatoConsentimento =
        candidatoConsentimentoId !== null
            ? (candidatos.find((c) => c.id === candidatoConsentimentoId) ?? null)
            : null;

    if (candidatoConsentimento && estudoSelecionado) {
        return (
            <ConsentimentoSimulado
                estudo={estudoSelecionado}
                candidato={candidatoConsentimento}
                token={token}
                role={role}
                responsavelNome={responsavelNome}
                termoInicial={termosConsentimento[candidatoConsentimento.id]}
                onVoltar={() => setCandidatoConsentimentoId(null)}
                onAtualizarConsentimentoCandidato={handleAtualizarConsentimentoCandidato}
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
                        className="btn button--create"
                    >
                        <Plus aria-hidden="true" size={18} />
                        Novo candidato
                    </Button>
                )}
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
                                setCandidatoConsentimentoId(null);
                                setCandidatoIncluindo(null);
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
                            <SeloEstadoEstudo estado={statusEstudo} />
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
                        {avisoConsentimentos && (
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-3">
                                <ErrorMessage message={avisoConsentimentos} />
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => {
                                        setCarregandoCandidatos(true);
                                        setAvisoConsentimentos("");
                                        setTentativaCandidatos((atual) => atual + 1);
                                    }}
                                >
                                    Consultar novamente
                                </Button>
                            </div>
                        )}
                        <TabelaCandidatos
                            candidatos={candidatosFiltrados}
                            participantesCandidatoIds={participantesCandidatoIds}
                            vagasDisponiveis={vagasDisponiveis}
                            estudoEmRecrutamento={estudoEmRecrutamento}
                            onSelecionarCandidato={
                                podeCadastrar
                                    ? (candidato) => setCandidatoAvaliandoId(candidato.id)
                                    : undefined
                            }
                            onAbrirConsentimento={
                                podeCadastrar
                                    ? (candidato) => setCandidatoConsentimentoId(candidato.id)
                                    : undefined
                            }
                            onIncluirParticipante={
                                podeCadastrar
                                    ? (candidato) => {
                                          setMensagemSucesso("");
                                          setCandidatoIncluindo(candidato);
                                      }
                                    : undefined
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
