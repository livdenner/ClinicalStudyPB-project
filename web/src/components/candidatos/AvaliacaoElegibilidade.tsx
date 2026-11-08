import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, Clock, XCircle } from "lucide-react";
import { ApiClientError } from "../../services/api/apiClient";
import {
    listarCriteriosPorEstudo,
    obterAvaliacaoElegibilidade,
    salvarAvaliacaoElegibilidade,
} from "../../services/elegibilidade";
import type { UserRole } from "../../types/auth";
import {
    ELEGIBILIDADE_LABELS,
    STATUS_ESTUDO_LABELS,
    type CandidatoApi,
    type EstudoComStatusApi,
    type StatusElegibilidadeApi,
    type StatusEstudoCandidato,
} from "../../types/candidato";
import type { CriterioEstudoApi, RespostaElegibilidadeApi } from "../../types/elegibilidade";
import { Button } from "../ui/Button";
import { ErrorMessage } from "../ui/ErrorMessage";

type Props = {
    estudo: EstudoComStatusApi;
    candidato: CandidatoApi;
    token: string;
    role: UserRole;
    onVoltar: () => void;
    onAtualizarStatusCandidato: (candidateId: number, novoStatus: StatusElegibilidadeApi) => void;
};

const PARECER_CARD_CLASSES: Record<StatusElegibilidadeApi, string> = {
    PENDING: "border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]",
    ELIGIBLE: "border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46]",
    INELIGIBLE: "border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]",
};

const PARECER_DESCRICOES: Record<StatusElegibilidadeApi, string> = {
    PENDING:
        "Existem critérios pendentes de resposta ou a avaliação completa ainda não foi concluída.",
    ELIGIBLE:
        "Todos os critérios de inclusão foram atendidos e nenhum critério de exclusão se aplica ao candidato.",
    INELIGIBLE:
        "Ao menos um critério de inclusão não foi atendido ou um critério de exclusão se aplica ao candidato.",
};

function formatarDataHora(iso?: string): string | null {
    if (!iso) return null;
    const data = new Date(iso);
    if (Number.isNaN(data.getTime())) return null;
    return data.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function AvaliacaoElegibilidade({
    estudo,
    candidato,
    token,
    role,
    onVoltar,
    onAtualizarStatusCandidato,
}: Props) {
    const [criterios, setCriterios] = useState<CriterioEstudoApi[]>([]);
    const [respostas, setRespostas] = useState<Record<number, boolean | undefined>>({});
    const [statusParecer, setStatusParecer] = useState<StatusElegibilidadeApi>(
        candidato.eligibilityStatus ?? "PENDING"
    );
    const [avaliadoEm, setAvaliadoEm] = useState<string | undefined>(undefined);

    const [carregando, setCarregando] = useState(true);
    const [erroCarregamento, setErroCarregamento] = useState("");
    const [tentativa, setTentativa] = useState(0);

    const [salvando, setSalvando] = useState(false);
    const [erroSalvar, setErroSalvar] = useState("");
    const [mensagemSucesso, setMensagemSucesso] = useState("");

    const statusEstudo: StatusEstudoCandidato = estudo.status ?? "PLANNING";
    const estudoEmRecrutamento = statusEstudo === "RECRUITMENT";
    const podeEditar = role === "COORDINATOR" && estudoEmRecrutamento;

    useEffect(() => {
        const controller = new AbortController();

        const promessaCriterios = listarCriteriosPorEstudo(estudo.id, token, controller.signal);
        const promessaAvaliacao =
            role === "COORDINATOR"
                ? obterAvaliacaoElegibilidade(estudo.id, candidato.id, token, controller.signal)
                : obterAvaliacaoElegibilidade(
                      estudo.id,
                      candidato.id,
                      token,
                      controller.signal
                  ).catch(() => null);

        Promise.all([promessaCriterios, promessaAvaliacao])
            .then(([listaCriterios, avaliacao]) => {
                if (controller.signal.aborted) return;
                setCriterios(listaCriterios);

                if (avaliacao) {
                    setStatusParecer(avaliacao.status);
                    setAvaliadoEm(avaliacao.evaluatedAt);
                    const mapaRespostas: Record<number, boolean | undefined> = {};
                    for (const item of avaliacao.answers) {
                        mapaRespostas[item.criterionId] = item.matches;
                    }
                    setRespostas(mapaRespostas);
                }
            })
            .catch((error: unknown) => {
                if (controller.signal.aborted) return;
                if (error instanceof ApiClientError && error.status === 401) {
                    setErroCarregamento(
                        "Sua sessão não é mais válida. Entre novamente para continuar."
                    );
                } else if (error instanceof ApiClientError && error.status === 403) {
                    setErroCarregamento(
                        "Você não tem permissão para consultar a avaliação de elegibilidade."
                    );
                } else if (error instanceof ApiClientError && error.status === 404) {
                    setErroCarregamento("Candidato ou estudo não encontrado para avaliação.");
                } else {
                    setErroCarregamento(
                        "Não foi possível carregar os critérios e a avaliação de elegibilidade."
                    );
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setCarregando(false);
                }
            });

        return () => controller.abort();
    }, [estudo.id, candidato.id, token, role, tentativa]);

    const criteriosInclusao = criterios.filter((c) => c.type === "INCLUSION");
    const criteriosExclusao = criterios.filter((c) => c.type === "EXCLUSION");

    const respostasPreenchidas: RespostaElegibilidadeApi[] = criterios.flatMap((criterio) => {
        const valor = respostas[criterio.id];
        if (typeof valor === "boolean") {
            return [{ criterionId: criterio.id, matches: valor }];
        }
        return [];
    });

    const totalCriterios = criterios.length;
    const totalRespondidos = respostasPreenchidas.length;
    const totalPendentes = totalCriterios - totalRespondidos;

    function alterarResposta(criterionId: number, valor: string) {
        setErroSalvar("");
        setMensagemSucesso("");
        setRespostas((atuais) => {
            const proximo = { ...atuais };
            if (valor === "true") {
                proximo[criterionId] = true;
            } else if (valor === "false") {
                proximo[criterionId] = false;
            } else {
                delete proximo[criterionId];
            }
            return proximo;
        });
    }

    async function handleSalvar(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (salvando || !podeEditar || criterios.length === 0) return;

        setErroSalvar("");
        setMensagemSucesso("");

        if (respostasPreenchidas.length === 0) {
            setErroSalvar("Responda ao menos um critério antes de salvar a avaliação.");
            return;
        }

        setSalvando(true);
        try {
            const resultado = await salvarAvaliacaoElegibilidade(
                estudo.id,
                candidato.id,
                { answers: respostasPreenchidas },
                token
            );

            setStatusParecer(resultado.status);
            setAvaliadoEm(resultado.evaluatedAt);
            const mapaAtualizado: Record<number, boolean | undefined> = {};
            for (const item of resultado.answers) {
                mapaAtualizado[item.criterionId] = item.matches;
            }
            setRespostas(mapaAtualizado);
            onAtualizarStatusCandidato(candidato.id, resultado.status);
            setMensagemSucesso("Avaliação de elegibilidade registrada com sucesso.");
        } catch (error) {
            if (error instanceof ApiClientError) {
                if (error.status === 401) {
                    setErroSalvar("Sua sessão expirou. Entre novamente para salvar a avaliação.");
                } else if (error.status === 403) {
                    setErroSalvar(
                        "Você não tem permissão para registrar a avaliação de elegibilidade."
                    );
                } else if (error.status === 409) {
                    setErroSalvar(
                        error.message && !error.message.startsWith("A requisição falhou")
                            ? error.message
                            : "Não foi possível registrar a avaliação devido ao estado atual do candidato ou do estudo."
                    );
                } else {
                    setErroSalvar(error.message);
                }
            } else {
                setErroSalvar(
                    "Não foi possível salvar a avaliação de elegibilidade. Tente novamente."
                );
            }
        } finally {
            setSalvando(false);
        }
    }

    const dataAvaliacaoFormatada = formatarDataHora(avaliadoEm);

    return (
        <section className="flex flex-col gap-6" aria-labelledby="elegibilidade-heading">
            <div>
                <button
                    type="button"
                    onClick={onVoltar}
                    className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-[var(--color-primary)] hover:underline"
                >
                    <ArrowLeft size={16} aria-hidden="true" />
                    Voltar para candidatos
                </button>
            </div>

            <header className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-[var(--color-border)] bg-white p-5">
                <div>
                    <span className="text-xs font-bold tracking-wider text-[var(--color-primary)] uppercase">
                        Avaliação de Elegibilidade (RF09)
                    </span>
                    <h1
                        id="elegibilidade-heading"
                        className="mt-1 text-[26px] font-bold tracking-tight text-[var(--color-title)]"
                    >
                        {candidato.name}
                    </h1>
                    <p className="mt-1 text-sm text-[var(--color-muted)]">
                        Idade informada: <strong>{candidato.age} anos</strong> • Estudo:{" "}
                        <strong>{estudo.title}</strong> ({STATUS_ESTUDO_LABELS[statusEstudo]})
                    </p>
                </div>

                <div
                    role="status"
                    aria-label="Parecer resultante do candidato"
                    className={`flex min-w-[260px] flex-col gap-1 rounded-xl border px-4 py-3 ${PARECER_CARD_CLASSES[statusParecer]}`}
                >
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase">Parecer resultante</span>
                        {statusParecer === "ELIGIBLE" ? (
                            <CheckCircle2 size={18} aria-hidden="true" />
                        ) : statusParecer === "INELIGIBLE" ? (
                            <XCircle size={18} aria-hidden="true" />
                        ) : (
                            <Clock size={18} aria-hidden="true" />
                        )}
                    </div>
                    <strong className="text-lg font-bold">
                        {ELEGIBILIDADE_LABELS[statusParecer]}
                    </strong>
                    <span className="text-xs opacity-90">{PARECER_DESCRICOES[statusParecer]}</span>
                    {dataAvaliacaoFormatada && (
                        <span className="mt-1 text-[11px] opacity-80">
                            Última atualização: {dataAvaliacaoFormatada}
                        </span>
                    )}
                </div>
            </header>

            {role !== "COORDINATOR" && (
                <p
                    role="note"
                    className="rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-4 py-3 text-xs font-medium text-[var(--color-text)]"
                >
                    Visualização em modo somente leitura. Apenas o coordenador pode registrar ou
                    alterar respostas de elegibilidade.
                </p>
            )}

            {role === "COORDINATOR" && !estudoEmRecrutamento && (
                <p
                    role="note"
                    className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-xs font-medium text-[#92400E]"
                >
                    O estudo está em <strong>{STATUS_ESTUDO_LABELS[statusEstudo]}</strong>. O
                    registro ou alteração de respostas de elegibilidade só é permitido com o estudo
                    em recrutamento.
                </p>
            )}

            {mensagemSucesso && (
                <div
                    role="status"
                    className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-3 text-sm font-medium text-[#065F46]"
                >
                    {mensagemSucesso}
                </div>
            )}

            {erroSalvar && (
                <div className="rounded-xl border border-[#FECACA] bg-[#FDEAEA] p-3.5 text-sm text-[#B42318]">
                    <ErrorMessage message={erroSalvar} />
                </div>
            )}

            {carregando ? (
                <div className="rounded-xl border border-[var(--color-border)] bg-white p-8 text-center">
                    <p role="status" className="text-sm text-[var(--color-muted)]">
                        Carregando critérios e avaliação de elegibilidade...
                    </p>
                </div>
            ) : erroCarregamento ? (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-[var(--color-border)] bg-white p-8 text-center">
                    <ErrorMessage message={erroCarregamento} />
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                            setCarregando(true);
                            setErroCarregamento("");
                            setTentativa((atual) => atual + 1);
                        }}
                    >
                        Tentar novamente
                    </Button>
                </div>
            ) : criterios.length === 0 ? (
                <section
                    role="note"
                    aria-labelledby="aviso-sem-criterios-heading"
                    className="flex flex-col gap-2 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-6"
                >
                    <h2
                        id="aviso-sem-criterios-heading"
                        className="text-base font-bold text-[#92400E]"
                    >
                        Estudo sem critérios cadastrados
                    </h2>
                    <p className="text-sm text-[#92400E]">
                        Este estudo ainda não possui critérios de inclusão ou exclusão definidos no
                        protocolo. Para avaliar a elegibilidade do candidato, solicite ao
                        pesquisador responsável o cadastro dos critérios do estudo.
                    </p>
                </section>
            ) : (
                <form noValidate onSubmit={handleSalvar} className="flex flex-col gap-6">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-white px-5 py-3.5 text-xs text-[var(--color-muted)]">
                        <span>
                            Critérios respondidos: <strong>{totalRespondidos}</strong> de{" "}
                            <strong>{totalCriterios}</strong>
                        </span>
                        <span>
                            Critérios sem resposta (pendentes): <strong>{totalPendentes}</strong>
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-6 max-[920px]:grid-cols-1">
                        <section
                            aria-labelledby="criterios-inclusao-heading"
                            className="flex flex-col gap-4 rounded-xl border border-[var(--color-border)] bg-white p-5"
                        >
                            <header className="border-b border-[var(--color-border)] pb-3">
                                <div className="flex items-center justify-between gap-2">
                                    <h2
                                        id="criterios-inclusao-heading"
                                        className="text-base font-bold text-[var(--color-title)]"
                                    >
                                        Critérios de inclusão
                                    </h2>
                                    <span className="rounded-full bg-[#E4F4E9] px-2.5 py-0.5 text-xs font-bold text-[#16804B]">
                                        {criteriosInclusao.length}
                                    </span>
                                </div>
                                <p className="mt-1 text-xs text-[var(--color-muted)]">
                                    Condições que o candidato deve atender (Sim) para ser elegível.
                                </p>
                            </header>

                            {criteriosInclusao.length === 0 ? (
                                <p className="py-4 text-xs text-[var(--color-muted)]">
                                    Nenhum critério de inclusão cadastrado neste estudo.
                                </p>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    {criteriosInclusao.map((criterio) => {
                                        const valor = respostas[criterio.id];
                                        const semResposta = typeof valor !== "boolean";

                                        return (
                                            <div
                                                key={criterio.id}
                                                className="flex flex-col gap-2.5 rounded-lg border border-[var(--color-border)] bg-[#F8FAFC] p-4"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <label
                                                        htmlFor={`criterio-${criterio.id}`}
                                                        className="text-sm font-medium text-[var(--color-title)]"
                                                    >
                                                        {criterio.description}
                                                    </label>
                                                    <span
                                                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                                                            semResposta
                                                                ? "bg-[#FEF3C7] text-[#92400E]"
                                                                : valor
                                                                  ? "bg-[#E4F4E9] text-[#16804B]"
                                                                  : "bg-[#FDEAEA] text-[#B42318]"
                                                        }`}
                                                    >
                                                        {semResposta
                                                            ? "Pendente"
                                                            : valor
                                                              ? "Atende"
                                                              : "Não atende"}
                                                    </span>
                                                </div>

                                                <select
                                                    id={`criterio-${criterio.id}`}
                                                    aria-label={criterio.description}
                                                    value={
                                                        typeof valor === "boolean"
                                                            ? String(valor)
                                                            : ""
                                                    }
                                                    disabled={!podeEditar || salvando}
                                                    onChange={(e) =>
                                                        alterarResposta(criterio.id, e.target.value)
                                                    }
                                                    className="h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-text)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-60"
                                                >
                                                    <option value="">
                                                        Sem resposta (Pendente)
                                                    </option>
                                                    <option value="true">
                                                        Sim — atende ao critério de inclusão
                                                    </option>
                                                    <option value="false">
                                                        Não — não atende ao critério de inclusão
                                                    </option>
                                                </select>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </section>

                        <section
                            aria-labelledby="criterios-exclusao-heading"
                            className="flex flex-col gap-4 rounded-xl border border-[var(--color-border)] bg-white p-5"
                        >
                            <header className="border-b border-[var(--color-border)] pb-3">
                                <div className="flex items-center justify-between gap-2">
                                    <h2
                                        id="criterios-exclusao-heading"
                                        className="text-base font-bold text-[var(--color-title)]"
                                    >
                                        Critérios de exclusão
                                    </h2>
                                    <span className="rounded-full bg-[#FDEAEA] px-2.5 py-0.5 text-xs font-bold text-[#B42318]">
                                        {criteriosExclusao.length}
                                    </span>
                                </div>
                                <p className="mt-1 text-xs text-[var(--color-muted)]">
                                    Condições impeditivas que não devem se aplicar (Não) ao
                                    candidato.
                                </p>
                            </header>

                            {criteriosExclusao.length === 0 ? (
                                <p className="py-4 text-xs text-[var(--color-muted)]">
                                    Nenhum critério de exclusão cadastrado neste estudo.
                                </p>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    {criteriosExclusao.map((criterio) => {
                                        const valor = respostas[criterio.id];
                                        const semResposta = typeof valor !== "boolean";

                                        return (
                                            <div
                                                key={criterio.id}
                                                className="flex flex-col gap-2.5 rounded-lg border border-[var(--color-border)] bg-[#F8FAFC] p-4"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <label
                                                        htmlFor={`criterio-${criterio.id}`}
                                                        className="text-sm font-medium text-[var(--color-title)]"
                                                    >
                                                        {criterio.description}
                                                    </label>
                                                    <span
                                                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                                                            semResposta
                                                                ? "bg-[#FEF3C7] text-[#92400E]"
                                                                : valor
                                                                  ? "bg-[#FDEAEA] text-[#B42318]"
                                                                  : "bg-[#E4F4E9] text-[#16804B]"
                                                        }`}
                                                    >
                                                        {semResposta
                                                            ? "Pendente"
                                                            : valor
                                                              ? "Impeditivo (Se aplica)"
                                                              : "Não se aplica"}
                                                    </span>
                                                </div>

                                                <select
                                                    id={`criterio-${criterio.id}`}
                                                    aria-label={criterio.description}
                                                    value={
                                                        typeof valor === "boolean"
                                                            ? String(valor)
                                                            : ""
                                                    }
                                                    disabled={!podeEditar || salvando}
                                                    onChange={(e) =>
                                                        alterarResposta(criterio.id, e.target.value)
                                                    }
                                                    className="h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-text)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-60"
                                                >
                                                    <option value="">
                                                        Sem resposta (Pendente)
                                                    </option>
                                                    <option value="false">
                                                        Não — critério de exclusão não se aplica
                                                    </option>
                                                    <option value="true">
                                                        Sim — critério de exclusão se aplica
                                                    </option>
                                                </select>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    </div>

                    {podeEditar && (
                        <footer className="flex items-center justify-end gap-3 rounded-xl border border-[var(--color-border)] bg-white px-5 py-4">
                            <Button
                                type="button"
                                variant="secondary"
                                disabled={salvando}
                                onClick={onVoltar}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" variant="primary" loading={salvando}>
                                Salvar avaliação
                            </Button>
                        </footer>
                    )}
                </form>
            )}
        </section>
    );
}
