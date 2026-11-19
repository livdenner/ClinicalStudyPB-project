import { Chip } from "@heroui/react";
import { CheckCircle2, ClipboardCheck, FileSignature, UserPlus } from "lucide-react";
import { CardPadrao } from "../ui/CardPadrao";
import {
    ELEGIBILIDADE_LABELS,
    type CandidatoApi,
    type StatusElegibilidadeApi,
} from "../../types/candidato";
import { CONSENTIMENTO_LABELS, type StatusConsentimentoApi } from "../../types/consentimento";

export type ContextoCandidatos = {
    vagasDisponiveis?: number;
    estudoEmRecrutamento?: boolean;
    onSelecionarCandidato?: (candidato: CandidatoApi) => void;
    onAbrirConsentimento?: (candidato: CandidatoApi) => void;
    onIncluirParticipante?: (candidato: CandidatoApi) => void;
};

type Props = ContextoCandidatos & {
    candidato: CandidatoApi;
    jaIncluido: boolean;
};

const ELEGIBILIDADE_CLASSES: Record<StatusElegibilidadeApi, string> = {
    PENDING: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
    ELIGIBLE: "bg-[var(--color-success-soft)] text-[var(--color-success)]",
    INELIGIBLE: "bg-[var(--color-neutral-soft)] text-[var(--color-neutral)]",
};

const CONSENTIMENTO_CLASSES: Record<StatusConsentimentoApi, string> = {
    PENDING: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
    GRANTED: "bg-[var(--color-success-soft)] text-[var(--color-success)]",
    DECLINED: "bg-[var(--color-neutral-soft)] text-[var(--color-neutral)]",
};

const CONSENTIMENTO_EXIBICAO_LABELS: Record<StatusConsentimentoApi, string> = {
    ...CONSENTIMENTO_LABELS,
    PENDING: "Não registrado",
};

function obterMotivoBloqueioInclusao(
    estudoEmRecrutamento: boolean,
    vagasDisponiveis: number | undefined,
    elegibilidade: StatusElegibilidadeApi,
    consentimento: StatusConsentimentoApi
): string | null {
    if (!estudoEmRecrutamento) return "A inclusão só é permitida com o estudo em recrutamento.";
    if (vagasDisponiveis !== undefined && vagasDisponiveis <= 0)
        return "O estudo atingiu o limite de vagas disponíveis.";
    if (elegibilidade !== "ELIGIBLE")
        return "Exige candidato com elegibilidade aprovada (Elegível).";
    if (consentimento !== "GRANTED") return "Exige consentimento simulado aceito pelo candidato.";
    return null;
}

export function CardCandidato({
    candidato,
    jaIncluido,
    vagasDisponiveis,
    estudoEmRecrutamento = true,
    onSelecionarCandidato,
    onAbrirConsentimento,
    onIncluirParticipante,
}: Props) {
    const elegibilidade = candidato.eligibilityStatus ?? "PENDING";
    const consentimento = jaIncluido ? "GRANTED" : (candidato.consentStatus ?? "PENDING");
    const motivoBloqueioInclusao = obterMotivoBloqueioInclusao(
        estudoEmRecrutamento,
        vagasDisponiveis,
        elegibilidade,
        consentimento
    );
    const aptoParaInclusao = motivoBloqueioInclusao === null;
    const exibirConsentimento = Boolean(onAbrirConsentimento);
    const exibirAcoes = Boolean(
        onSelecionarCandidato || onAbrirConsentimento || onIncluirParticipante
    );
    const rotuloAcao = `Avaliar elegibilidade: ${candidato.name}`;
    const rotuloConsentimento = `Consentimento simulado: ${candidato.name}`;
    const rotuloInclusao = `Incluir participante: ${candidato.name}`;

    const acoes = exibirAcoes ? (
        <div>
            {onSelecionarCandidato && (
                <button
                    type="button"
                    onClick={() => onSelecionarCandidato(candidato)}
                    aria-label={rotuloAcao}
                    className="acao-candidato"
                >
                    <ClipboardCheck size={15} aria-hidden="true" />
                    Avaliar elegibilidade
                </button>
            )}
            {onAbrirConsentimento && (
                <button
                    type="button"
                    onClick={() => onAbrirConsentimento(candidato)}
                    aria-label={rotuloConsentimento}
                    className="acao-candidato"
                >
                    <FileSignature size={15} aria-hidden="true" />
                    Consentimento simulado
                </button>
            )}
            {onIncluirParticipante &&
                (jaIncluido ? (
                    <span
                        data-acao-concluida
                        aria-label={`Paciente Incluído: ${candidato.name}`}
                        className="inline-flex cursor-default select-none items-center gap-1.5 rounded-lg border border-[var(--color-success-border)] bg-[var(--color-success-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--color-success)]"
                    >
                        <CheckCircle2 size={15} aria-hidden="true" />
                        Paciente Incluído
                    </span>
                ) : (
                    <button
                        type="button"
                        disabled={!aptoParaInclusao}
                        title={
                            aptoParaInclusao
                                ? "Incluir candidato como participante do estudo"
                                : (motivoBloqueioInclusao ?? undefined)
                        }
                        onClick={() => onIncluirParticipante(candidato)}
                        aria-label={rotuloInclusao}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--color-primary)] bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--color-primary-dark)] disabled:cursor-not-allowed disabled:border-[var(--color-border)] disabled:bg-slate-100 disabled:text-[var(--color-muted)]"
                    >
                        <UserPlus size={15} aria-hidden="true" />
                        Incluir participante
                    </button>
                ))}
        </div>
    ) : undefined;
    return (
        <CardPadrao
            titulo={candidato.name}
            selo={
                <Chip size="sm" variant="soft" className={ELEGIBILIDADE_CLASSES[elegibilidade]}>
                    <Chip.Label>{ELEGIBILIDADE_LABELS[elegibilidade]}</Chip.Label>
                </Chip>
            }
            acoes={acoes}
        >
            <dl className="card-padrao__dados">
                <div>
                    <dt>Idade</dt>
                    <dd>{candidato.age} anos</dd>
                </div>
                {exibirConsentimento && (
                    <div>
                        <dt>Consentimento</dt>
                        <dd>
                            <Chip
                                size="sm"
                                variant="soft"
                                className={CONSENTIMENTO_CLASSES[consentimento]}
                            >
                                <Chip.Label>
                                    {CONSENTIMENTO_EXIBICAO_LABELS[consentimento]}
                                </Chip.Label>
                            </Chip>
                        </dd>
                    </div>
                )}
            </dl>
        </CardPadrao>
    );
}
