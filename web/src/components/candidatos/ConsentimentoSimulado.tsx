import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, Clock, FileSignature, XCircle } from "lucide-react";
import { ApiClientError } from "../../services/api/apiClient";
import {
    obterConsentimentoSimulado,
    registrarConsentimentoSimulado,
} from "../../services/consentimento";
import type { UserRole } from "../../types/auth";
import {
    ELEGIBILIDADE_LABELS,
    STATUS_ESTUDO_LABELS,
    type CandidatoApi,
    type EstudoComStatusApi,
    type StatusEstudoCandidato,
} from "../../types/candidato";
import {
    CONSENTIMENTO_LABELS,
    type DecisaoConsentimentoApi,
    type StatusConsentimentoApi,
} from "../../types/consentimento";
import { Button } from "../ui/Button";
import { ErrorMessage } from "../ui/ErrorMessage";
import { FormField } from "../ui/FormField";
import { Input } from "../ui/Input";

type Props = {
    estudo: EstudoComStatusApi;
    candidato: CandidatoApi;
    token: string;
    role: UserRole;
    responsavelNome: string;
    termoInicial?: string;
    onVoltar: () => void;
    onAtualizarConsentimentoCandidato: (
        candidateId: number,
        novoStatus: StatusConsentimentoApi,
        termoIdentificacao: string
    ) => void;
};

const CONSENTIMENTO_CARD_CLASSES: Record<StatusConsentimentoApi, string> = {
    PENDING: "border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]",
    GRANTED: "border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46]",
    DECLINED: "border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]",
};

const CONSENTIMENTO_DESCRICOES: Record<StatusConsentimentoApi, string> = {
    PENDING: "Nenhuma decisão de consentimento simulado foi registrada para este candidato.",
    GRANTED: "O candidato manifestou aceite ao termo de consentimento simulado.",
    DECLINED: "O candidato recusou o termo de consentimento simulado.",
};

function formatarDataHora(iso?: string): { data: string; hora: string; completo: string } | null {
    if (!iso) return null;
    const dataObj = new Date(iso);
    if (Number.isNaN(dataObj.getTime())) return null;
    const data = dataObj.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
    const hora = dataObj.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
    });
    return {
        data,
        hora,
        completo: `${data} às ${hora}`,
    };
}

export function ConsentimentoSimulado({
    estudo,
    candidato,
    token,
    role,
    responsavelNome,
    termoInicial,
    onVoltar,
    onAtualizarConsentimentoCandidato,
}: Props) {
    const termoPadrao = termoInicial?.trim() || `TCLE-SIMULADO-ESTUDO-${estudo.id}-v1`;
    const [statusConsentimento, setStatusConsentimento] = useState<StatusConsentimentoApi>(
        candidato.consentStatus ?? "PENDING"
    );
    const [registradoEm, setRegistradoEm] = useState<string | undefined>(undefined);
    const [termoRegistrado, setTermoRegistrado] = useState<string>(termoPadrao);

    const [termoInput, setTermoInput] = useState<string>(termoPadrao);
    const [decisao, setDecisao] = useState<"" | DecisaoConsentimentoApi>("");
    const [errosCampos, setErrosCampos] = useState<{ termo?: string; decisao?: string }>({});

    const [carregando, setCarregando] = useState(true);
    const [erroCarregamento, setErroCarregamento] = useState("");
    const [tentativa, setTentativa] = useState(0);

    const [salvando, setSalvando] = useState(false);
    const [erroSalvar, setErroSalvar] = useState("");
    const [mensagemSucesso, setMensagemSucesso] = useState("");

    const termoRef = useRef<HTMLInputElement>(null);
    const decisaoRef = useRef<HTMLSelectElement>(null);

    const statusEstudo: StatusEstudoCandidato = estudo.status ?? "PLANNING";
    const estudoEmRecrutamento = statusEstudo === "RECRUITMENT";
    const perfilAutorizado = role === "COORDINATOR";
    const candidatoValido = candidato.id > 0 && candidato.eligibilityStatus !== "INELIGIBLE";
    const podeRegistrar = perfilAutorizado && estudoEmRecrutamento && candidatoValido;

    useEffect(() => {
        const controller = new AbortController();

        obterConsentimentoSimulado(estudo.id, candidato.id, token, controller.signal)
            .then((dados) => {
                if (controller.signal.aborted) return;
                setStatusConsentimento(dados.status);
                setRegistradoEm(dados.recordedAt);
                if (dados.status === "GRANTED" || dados.status === "DECLINED") {
                    setDecisao(dados.status);
                    onAtualizarConsentimentoCandidato(candidato.id, dados.status, termoPadrao);
                } else {
                    setDecisao("");
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
                        "Você não tem permissão para consultar ou registrar o consentimento simulado."
                    );
                } else if (error instanceof ApiClientError && error.status === 404) {
                    setErroCarregamento("Candidato ou estudo não encontrado para consentimento.");
                } else {
                    setErroCarregamento(
                        "Não foi possível carregar os dados do consentimento simulado."
                    );
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setCarregando(false);
                }
            });

        return () => controller.abort();
    }, [estudo.id, candidato.id, token, tentativa, onAtualizarConsentimentoCandidato, termoPadrao]);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (salvando || !podeRegistrar) return;

        setErroSalvar("");
        setMensagemSucesso("");

        const novosErros: { termo?: string; decisao?: string } = {};
        const termoLimpo = termoInput.trim();

        if (!termoLimpo) {
            novosErros.termo = "Informe a identificação do termo simulado.";
        } else if (termoLimpo.length > 120) {
            novosErros.termo = "A identificação do termo deve ter até 120 caracteres.";
        }

        if (decisao !== "GRANTED" && decisao !== "DECLINED") {
            novosErros.decisao = "Selecione a decisão do consentimento (aceite ou recusa).";
        }

        setErrosCampos(novosErros);

        if (novosErros.termo) {
            termoRef.current?.focus();
            return;
        }

        if (novosErros.decisao) {
            decisaoRef.current?.focus();
            return;
        }

        const decisaoValida = decisao as DecisaoConsentimentoApi;
        setSalvando(true);

        try {
            const resultado = await registrarConsentimentoSimulado(
                estudo.id,
                candidato.id,
                { status: decisaoValida },
                token
            );

            setStatusConsentimento(resultado.status);
            setRegistradoEm(resultado.recordedAt);
            setTermoRegistrado(termoLimpo);
            onAtualizarConsentimentoCandidato(candidato.id, resultado.status, termoLimpo);
            setMensagemSucesso("Consentimento simulado registrado com sucesso.");
        } catch (error) {
            if (error instanceof ApiClientError) {
                if (error.status === 401) {
                    setErroSalvar(
                        "Sua sessão expirou. Entre novamente para registrar o consentimento."
                    );
                } else if (error.status === 403) {
                    setErroSalvar(
                        "Você não tem permissão para registrar o consentimento simulado."
                    );
                } else if (error.status === 409) {
                    setErroSalvar(
                        error.message && !error.message.startsWith("A requisição falhou")
                            ? error.message
                            : "Não foi possível alterar o consentimento no estado atual do estudo ou do candidato."
                    );
                } else {
                    setErroSalvar(error.message);
                }
            } else {
                setErroSalvar(
                    "Não foi possível registrar o consentimento simulado. Tente novamente."
                );
            }
        } finally {
            setSalvando(false);
        }
    }

    const dataHoraFormatada = formatarDataHora(registradoEm);

    return (
        <section className="flex flex-col gap-6" aria-labelledby="consentimento-heading">
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

            <div
                role="note"
                aria-label="Aviso de consentimento simulado"
                className="flex items-start gap-3 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3.5 text-sm text-[#1E3A8A]"
            >
                <FileSignature size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                    <strong className="font-bold">
                        Aviso importante — Consentimento Simulado (RF10):
                    </strong>{" "}
                    Este registro de consentimento é estritamente simulado e utiliza apenas dados
                    fictícios para fins acadêmicos e operacionais do sistema, sem assinatura real ou
                    validade clínica/jurídica.
                </div>
            </div>

            <header className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-[var(--color-border)] bg-white p-5">
                <div>
                    <span className="text-xs font-bold tracking-wider text-[var(--color-primary)] uppercase">
                        Termo de Consentimento Simulado (RF10)
                    </span>
                    <h1
                        id="consentimento-heading"
                        className="mt-1 text-[26px] font-bold tracking-tight text-[var(--color-title)]"
                    >
                        {candidato.name}
                    </h1>
                    <p className="mt-1 text-sm text-[var(--color-muted)]">
                        Idade informada: <strong>{candidato.age} anos</strong> • Elegibilidade:{" "}
                        <strong>
                            {ELEGIBILIDADE_LABELS[candidato.eligibilityStatus ?? "PENDING"]}
                        </strong>{" "}
                        • Estudo: <strong>{estudo.title}</strong> (
                        {STATUS_ESTUDO_LABELS[statusEstudo]})
                    </p>
                </div>

                <div
                    role="status"
                    aria-label="Situação atual do consentimento"
                    className={`flex min-w-[260px] flex-col gap-1 rounded-xl border px-4 py-3 ${CONSENTIMENTO_CARD_CLASSES[statusConsentimento]}`}
                >
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase">
                            Situação do consentimento
                        </span>
                        {statusConsentimento === "GRANTED" ? (
                            <CheckCircle2 size={18} aria-hidden="true" />
                        ) : statusConsentimento === "DECLINED" ? (
                            <XCircle size={18} aria-hidden="true" />
                        ) : (
                            <Clock size={18} aria-hidden="true" />
                        )}
                    </div>
                    <strong className="text-lg font-bold">
                        {CONSENTIMENTO_LABELS[statusConsentimento]}
                    </strong>
                    <span className="text-xs opacity-90">
                        {CONSENTIMENTO_DESCRICOES[statusConsentimento]}
                    </span>
                </div>
            </header>

            {!perfilAutorizado && (
                <p
                    role="note"
                    className="rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-4 py-3 text-xs font-medium text-[var(--color-text)]"
                >
                    Visualização em modo somente leitura. Apenas o coordenador pode registrar ou
                    alterar a decisão de consentimento simulado.
                </p>
            )}

            {perfilAutorizado && !estudoEmRecrutamento && (
                <p
                    role="note"
                    className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-xs font-medium text-[#92400E]"
                >
                    O estudo está em <strong>{STATUS_ESTUDO_LABELS[statusEstudo]}</strong>. O
                    registro ou alteração de consentimento simulado só é permitido com o estudo em
                    recrutamento.
                </p>
            )}

            {perfilAutorizado && estudoEmRecrutamento && !candidatoValido && (
                <p
                    role="note"
                    className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-xs font-medium text-[#991B1B]"
                >
                    Candidato inelegível. O registro de consentimento simulado está habilitado
                    apenas para candidatos válidos (elegíveis ou em avaliação).
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
                        Carregando dados do consentimento simulado...
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
            ) : (
                <div className="grid grid-cols-2 gap-6 max-[920px]:grid-cols-1">
                    <section
                        aria-labelledby="resumo-consentimento-heading"
                        className="flex flex-col gap-4 rounded-xl border border-[var(--color-border)] bg-white p-5"
                    >
                        <header className="border-b border-[var(--color-border)] pb-3">
                            <h2
                                id="resumo-consentimento-heading"
                                className="text-base font-bold text-[var(--color-title)]"
                            >
                                Resumo do consentimento gravado
                            </h2>
                            <p className="mt-1 text-xs text-[var(--color-muted)]">
                                Dados persistidos na API e identificação do registro simulado.
                            </p>
                        </header>

                        <dl className="grid grid-cols-1 gap-3 text-sm">
                            <div className="rounded-lg border border-[var(--color-border)] bg-[#F8FAFC] p-3.5">
                                <dt className="text-xs font-medium text-[var(--color-muted)]">
                                    Decisão registrada
                                </dt>
                                <dd className="mt-1 font-bold text-[var(--color-title)]">
                                    {CONSENTIMENTO_LABELS[statusConsentimento]}
                                </dd>
                            </div>

                            <div className="rounded-lg border border-[var(--color-border)] bg-[#F8FAFC] p-3.5">
                                <dt className="text-xs font-medium text-[var(--color-muted)]">
                                    Identificação do termo simulado
                                </dt>
                                <dd className="mt-1 font-semibold text-[var(--color-title)]">
                                    {statusConsentimento === "PENDING"
                                        ? "Aguardando registro"
                                        : termoRegistrado}
                                </dd>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-lg border border-[var(--color-border)] bg-[#F8FAFC] p-3.5">
                                    <dt className="text-xs font-medium text-[var(--color-muted)]">
                                        Data do registro
                                    </dt>
                                    <dd className="mt-1 font-semibold text-[var(--color-title)]">
                                        {dataHoraFormatada ? dataHoraFormatada.data : "—"}
                                    </dd>
                                </div>

                                <div className="rounded-lg border border-[var(--color-border)] bg-[#F8FAFC] p-3.5">
                                    <dt className="text-xs font-medium text-[var(--color-muted)]">
                                        Hora do registro
                                    </dt>
                                    <dd className="mt-1 font-semibold text-[var(--color-title)]">
                                        {dataHoraFormatada ? dataHoraFormatada.hora : "—"}
                                    </dd>
                                </div>
                            </div>

                            <div className="rounded-lg border border-[var(--color-border)] bg-[#F8FAFC] p-3.5">
                                <dt className="text-xs font-medium text-[var(--color-muted)]">
                                    Responsável pelo registro
                                </dt>
                                <dd className="mt-1 font-semibold text-[var(--color-title)]">
                                    {statusConsentimento === "PENDING"
                                        ? "Não registrado"
                                        : responsavelNome}
                                </dd>
                            </div>
                        </dl>
                    </section>

                    <section
                        aria-labelledby="formulario-consentimento-heading"
                        className="flex flex-col gap-4 rounded-xl border border-[var(--color-border)] bg-white p-5"
                    >
                        <header className="border-b border-[var(--color-border)] pb-3">
                            <h2
                                id="formulario-consentimento-heading"
                                className="text-base font-bold text-[var(--color-title)]"
                            >
                                Registrar decisão simulada
                            </h2>
                            <p className="mt-1 text-xs text-[var(--color-muted)]">
                                Informe a identificação do termo simulado e a decisão (aceite ou
                                recusa) do candidato.
                            </p>
                        </header>

                        <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
                            <FormField
                                label="Identificação do termo simulado"
                                htmlFor="consentimento-termo"
                                error={errosCampos.termo}
                            >
                                <Input
                                    ref={termoRef}
                                    id="consentimento-termo"
                                    name="termo"
                                    type="text"
                                    maxLength={120}
                                    value={termoInput}
                                    onChange={(event) => {
                                        setTermoInput(event.target.value);
                                        if (errosCampos.termo) {
                                            setErrosCampos((atual) => ({
                                                ...atual,
                                                termo: undefined,
                                            }));
                                        }
                                    }}
                                    disabled={!podeRegistrar || salvando}
                                    hasError={Boolean(errosCampos.termo)}
                                    placeholder="Ex.: TCLE-SIMULADO-v1"
                                />
                            </FormField>

                            <FormField
                                label="Decisão do consentimento"
                                htmlFor="consentimento-decisao"
                                error={errosCampos.decisao}
                            >
                                <select
                                    ref={decisaoRef}
                                    id="consentimento-decisao"
                                    name="status"
                                    aria-label="Decisão do consentimento"
                                    value={decisao}
                                    disabled={!podeRegistrar || salvando}
                                    onChange={(event) => {
                                        const valor = event.target.value as
                                            "" | DecisaoConsentimentoApi;
                                        setDecisao(valor);
                                        if (errosCampos.decisao) {
                                            setErrosCampos((atual) => ({
                                                ...atual,
                                                decisao: undefined,
                                            }));
                                        }
                                    }}
                                    className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-text)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-60"
                                >
                                    <option value="">Selecione uma decisão...</option>
                                    <option value="GRANTED">
                                        Aceito — candidato concedeu o consentimento simulado
                                    </option>
                                    <option value="DECLINED">
                                        Recusado — candidato recusou o consentimento simulado
                                    </option>
                                </select>
                            </FormField>

                            {podeRegistrar && (
                                <footer className="mt-2 flex items-center justify-end gap-3 border-t border-[var(--color-border)] pt-4">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        disabled={salvando}
                                        onClick={onVoltar}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button type="submit" variant="primary" loading={salvando}>
                                        Salvar consentimento
                                    </Button>
                                </footer>
                            )}
                        </form>
                    </section>
                </div>
            )}
        </section>
    );
}
