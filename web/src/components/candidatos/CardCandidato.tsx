import { Chip } from "@heroui/react";
import { ClipboardCheck, UserPlus, XCircle } from "lucide-react";
import { CardPadrao } from "../ui/CardPadrao";
import {
    ELEGIBILIDADE_LABELS,
    SITUACAO_CANDIDATO_LABELS,
    type CandidatoApi,
    type StatusCandidatoApi,
    type StatusElegibilidadeApi,
} from "../../types/candidato";
import { candidatoPodeSerCancelado, candidatoPodeSerIncluido } from "../../utils/candidatos";

export type ContextoCandidatos = {
    vagasDisponiveis?: number;
    estudoEmRecrutamento?: boolean;
    onSelecionarCandidato?: (candidato: CandidatoApi) => void;
    onIncluirParticipante?: (candidato: CandidatoApi) => void;
    onCancelarCandidatura?: (candidato: CandidatoApi) => void;
};

type Props = ContextoCandidatos & { candidato: CandidatoApi };

const ELEGIBILIDADE_CLASSES: Record<StatusElegibilidadeApi, string> = {
    PENDING: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
    ELIGIBLE: "bg-[var(--color-success-soft)] text-[var(--color-success)]",
    INELIGIBLE: "bg-[var(--color-neutral-soft)] text-[var(--color-neutral)]",
};

const SITUACAO_CLASSES: Record<StatusCandidatoApi, string> = {
    INVITED: "bg-[var(--color-info-soft)] text-[var(--color-info)]",
    ACTIVE: "bg-[var(--color-neutral-soft)] text-[var(--color-neutral)]",
    CONSENT_PENDING: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
    GRANTED: "bg-[var(--color-success-soft)] text-[var(--color-success)]",
    DECLINED: "bg-[var(--color-neutral-soft)] text-[var(--color-neutral)]",
    INCLUDED: "bg-[var(--color-success-soft)] text-[var(--color-success)]",
    CANCELLED: "bg-[var(--color-error-soft)] text-[var(--color-error)]",
};

function obterMotivoBloqueioInclusao(
    estudoEmRecrutamento: boolean,
    vagasDisponiveis: number | undefined
): string | null {
    if (!estudoEmRecrutamento) return "A inclusão só é permitida com o estudo em recrutamento.";
    if (vagasDisponiveis === undefined)
        return "Consulte as vagas disponíveis antes de incluir o participante.";
    if (vagasDisponiveis <= 0) return "O estudo atingiu o limite de vagas disponíveis.";
    return null;
}

export function CardCandidato({
    candidato,
    vagasDisponiveis,
    estudoEmRecrutamento = false,
    onSelecionarCandidato,
    onIncluirParticipante,
    onCancelarCandidatura,
}: Props) {
    const podeAvaliar = Boolean(onSelecionarCandidato) && candidatoPodeSerCancelado(candidato);
    const podeIncluir = Boolean(onIncluirParticipante) && candidatoPodeSerIncluido(candidato);
    const podeCancelar =
        Boolean(onCancelarCandidatura) &&
        estudoEmRecrutamento &&
        candidatoPodeSerCancelado(candidato);
    const motivoBloqueioInclusao = obterMotivoBloqueioInclusao(
        estudoEmRecrutamento,
        vagasDisponiveis
    );
    const acoes =
        podeAvaliar || podeIncluir || podeCancelar ? (
            <div className="acoes-candidato">
                {podeAvaliar && (
                    <button
                        type="button"
                        onClick={() => onSelecionarCandidato?.(candidato)}
                        aria-label={`Avaliar elegibilidade: ${candidato.name}`}
                        className="acao-candidato"
                    >
                        <ClipboardCheck size={15} aria-hidden="true" />
                        Avaliar elegibilidade
                    </button>
                )}
                {podeIncluir && (
                    <button
                        type="button"
                        disabled={motivoBloqueioInclusao !== null}
                        title={
                            motivoBloqueioInclusao ??
                            "Incluir candidato como participante do estudo"
                        }
                        onClick={() => onIncluirParticipante?.(candidato)}
                        aria-label={`Incluir participante: ${candidato.name}`}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--color-primary)] bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--color-primary-dark)] disabled:cursor-not-allowed disabled:border-[var(--color-border)] disabled:bg-slate-100 disabled:text-[var(--color-muted)]"
                    >
                        <UserPlus size={15} aria-hidden="true" />
                        Incluir participante
                    </button>
                )}
                {podeCancelar && (
                    <button
                        type="button"
                        onClick={() => onCancelarCandidatura?.(candidato)}
                        aria-label={`Cancelar candidatura: ${candidato.name}`}
                        className="acao-candidato acao-candidato--cancelar"
                    >
                        <XCircle size={15} aria-hidden="true" />
                        Cancelar candidatura
                    </button>
                )}
            </div>
        ) : undefined;

    return (
        <CardPadrao
            titulo={candidato.name}
            selo={
                <Chip
                    size="sm"
                    variant="soft"
                    className={SITUACAO_CLASSES[candidato.status] ?? SITUACAO_CLASSES.ACTIVE}
                >
                    <Chip.Label>
                        {SITUACAO_CANDIDATO_LABELS[candidato.status] ?? "Situação indisponível"}
                    </Chip.Label>
                </Chip>
            }
            acoes={acoes}
        >
            <dl className="card-padrao__dados">
                <div>
                    <dt>Idade</dt>
                    <dd>{candidato.age} anos</dd>
                </div>
                <div>
                    <dt>Elegibilidade</dt>
                    <dd>
                        <Chip
                            size="sm"
                            variant="soft"
                            className={ELEGIBILIDADE_CLASSES[candidato.eligibilityStatus]}
                        >
                            <Chip.Label>
                                {ELEGIBILIDADE_LABELS[candidato.eligibilityStatus]}
                            </Chip.Label>
                        </Chip>
                    </dd>
                </div>
            </dl>
            {candidato.status === "DECLINED" && (
                <p className="text-xs text-[var(--color-muted)]">Decisão final do candidato.</p>
            )}
            {candidato.status === "CANCELLED" && candidato.cancellation && (
                <p className="whitespace-pre-wrap text-xs text-[var(--color-muted)]">
                    Motivo: {candidato.cancellation.reason}
                </p>
            )}
        </CardPadrao>
    );
}
