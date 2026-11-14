import { Chip, Table } from "@heroui/react";
import { CheckCircle2, ClipboardCheck, FileSignature, UserPlus } from "lucide-react";
import {
    ELEGIBILIDADE_LABELS,
    type CandidatoApi,
    type StatusElegibilidadeApi,
} from "../../types/candidato";
import { CONSENTIMENTO_LABELS, type StatusConsentimentoApi } from "../../types/consentimento";

type Props = {
    candidatos: CandidatoApi[];
    participantesCandidatoIds?: ReadonlySet<number>;
    vagasDisponiveis?: number;
    estudoEmRecrutamento?: boolean;
    onSelecionarCandidato?: (candidato: CandidatoApi) => void;
    onAbrirConsentimento?: (candidato: CandidatoApi) => void;
    onIncluirParticipante?: (candidato: CandidatoApi) => void;
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

const CONSENTIMENTO_TABELA_LABELS: Record<StatusConsentimentoApi, string> = {
    ...CONSENTIMENTO_LABELS,
    PENDING: "Não registrado",
};

export function TabelaCandidatos({
    candidatos,
    participantesCandidatoIds,
    vagasDisponiveis,
    estudoEmRecrutamento = true,
    onSelecionarCandidato,
    onAbrirConsentimento,
    onIncluirParticipante,
}: Props) {
    if (candidatos.length === 0) {
        return (
            <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
                <strong className="text-sm font-semibold text-[var(--color-title)]">
                    Nenhum candidato encontrado
                </strong>
                <span className="text-sm text-[var(--color-muted)]">
                    Não há candidatos cadastrados para os critérios selecionados.
                </span>
            </div>
        );
    }

    const exibirConsentimento = Boolean(onAbrirConsentimento);
    const exibirAcoes = Boolean(
        onSelecionarCandidato || onAbrirConsentimento || onIncluirParticipante
    );
    const colunas = [
        "Identificação",
        "Idade",
        "Elegibilidade",
        ...(exibirConsentimento ? ["Consentimento"] : []),
        ...(exibirAcoes ? ["Avaliação"] : []),
    ];

    const itensTabela = candidatos.map((candidato) => ({
        ...candidato,
        jaIncluido: Boolean(participantesCandidatoIds?.has(candidato.id)),
        vagasDisponiveis,
        estudoEmRecrutamento,
    }));

    return (
        <Table variant="secondary">
            <Table.ScrollContainer className="overflow-x-auto">
                <Table.Content
                    aria-label="Lista de candidatos"
                    className="w-full min-w-[520px] text-left text-sm"
                >
                    <Table.Header>
                        {colunas.map((titulo) => (
                            <Table.Column
                                key={titulo}
                                id={titulo}
                                isRowHeader={titulo === "Identificação"}
                                className="rounded-none bg-[var(--color-primary)] px-5 py-3.5 text-xs font-semibold text-white after:hidden"
                            >
                                {titulo}
                            </Table.Column>
                        ))}
                    </Table.Header>
                    <Table.Body items={itensTabela}>
                        {(candidato) => {
                            const candidatoJaIncluido = candidato.jaIncluido;
                            const elegibilidade: StatusElegibilidadeApi =
                                candidato.eligibilityStatus ?? "PENDING";
                            const consentimento: StatusConsentimentoApi = candidatoJaIncluido
                                ? "GRANTED"
                                : (candidato.consentStatus ?? "PENDING");
                            const semVagas =
                                vagasDisponiveis !== undefined && vagasDisponiveis <= 0;
                            const aptoParaInclusao =
                                estudoEmRecrutamento &&
                                elegibilidade === "ELIGIBLE" &&
                                consentimento === "GRANTED" &&
                                !semVagas &&
                                !candidatoJaIncluido;

                            let motivoBloqueioInclusao = "";
                            if (!estudoEmRecrutamento) {
                                motivoBloqueioInclusao =
                                    "A inclusão só é permitida com o estudo em recrutamento.";
                            } else if (semVagas) {
                                motivoBloqueioInclusao =
                                    "O estudo atingiu o limite de vagas disponíveis.";
                            } else if (elegibilidade !== "ELIGIBLE") {
                                motivoBloqueioInclusao =
                                    "Exige candidato com elegibilidade aprovada (Elegível).";
                            } else if (consentimento !== "GRANTED") {
                                motivoBloqueioInclusao =
                                    "Exige consentimento simulado aceito pelo candidato.";
                            }

                            const rotuloAcao = `Avaliar elegibilidade: ${candidato.name}`;
                            const rotuloConsentimento = `Consentimento simulado: ${candidato.name}`;
                            const rotuloInclusao = `Incluir participante: ${candidato.name}`;

                            return (
                                <Table.Row
                                    id={candidato.id}
                                    textValue={candidato.name}
                                    className="group border-b border-[var(--color-border)]"
                                >
                                    <Table.Cell className="break-words border-[var(--color-border)] px-5 py-4 font-semibold text-[var(--color-title)] group-hover:bg-slate-50">
                                        {candidato.name}
                                    </Table.Cell>
                                    <Table.Cell className="border-[var(--color-border)] px-5 py-4 text-[var(--color-text)] group-hover:bg-slate-50">
                                        {candidato.age} anos
                                    </Table.Cell>
                                    <Table.Cell className="border-[var(--color-border)] px-5 py-4 group-hover:bg-slate-50">
                                        <Chip
                                            size="sm"
                                            variant="soft"
                                            className={`font-semibold ${ELEGIBILIDADE_CLASSES[elegibilidade]}`}
                                        >
                                            <Chip.Label>
                                                {ELEGIBILIDADE_LABELS[elegibilidade]}
                                            </Chip.Label>
                                        </Chip>
                                    </Table.Cell>
                                    {exibirConsentimento && (
                                        <Table.Cell className="border-[var(--color-border)] px-5 py-4 group-hover:bg-slate-50">
                                            <Chip
                                                size="sm"
                                                variant="soft"
                                                className={`font-semibold ${CONSENTIMENTO_CLASSES[consentimento]}`}
                                            >
                                                <Chip.Label>
                                                    {CONSENTIMENTO_TABELA_LABELS[consentimento]}
                                                </Chip.Label>
                                            </Chip>
                                        </Table.Cell>
                                    )}
                                    {exibirAcoes && (
                                        <Table.Cell className="border-[var(--color-border)] px-5 py-4 group-hover:bg-slate-50">
                                            <div className="flex flex-wrap items-center gap-2">
                                                {onSelecionarCandidato && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            onSelecionarCandidato(candidato)
                                                        }
                                                        aria-label={rotuloAcao}
                                                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)] transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]"
                                                    >
                                                        <ClipboardCheck
                                                            size={15}
                                                            aria-hidden="true"
                                                        />
                                                        Avaliar elegibilidade
                                                    </button>
                                                )}
                                                {onAbrirConsentimento && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            onAbrirConsentimento(candidato)
                                                        }
                                                        aria-label={rotuloConsentimento}
                                                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)] transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]"
                                                    >
                                                        <FileSignature
                                                            size={15}
                                                            aria-hidden="true"
                                                        />
                                                        Consentimento simulado
                                                    </button>
                                                )}
                                                {onIncluirParticipante &&
                                                    (candidatoJaIncluido ? (
                                                        <span
                                                            aria-label={`Paciente Incluído: ${candidato.name}`}
                                                            className="inline-flex cursor-default select-none items-center gap-1.5 rounded-lg border border-[var(--color-success-border)] bg-[var(--color-success-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--color-success)]"
                                                        >
                                                            <CheckCircle2
                                                                size={15}
                                                                aria-hidden="true"
                                                            />
                                                            Paciente Incluído
                                                        </span>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            disabled={!aptoParaInclusao}
                                                            title={
                                                                aptoParaInclusao
                                                                    ? "Incluir candidato como participante do estudo"
                                                                    : motivoBloqueioInclusao
                                                            }
                                                            onClick={() =>
                                                                onIncluirParticipante(candidato)
                                                            }
                                                            aria-label={rotuloInclusao}
                                                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--color-primary)] bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--color-primary-dark)] disabled:cursor-not-allowed disabled:border-[var(--color-border)] disabled:bg-slate-100 disabled:text-[var(--color-muted)]"
                                                        >
                                                            <UserPlus
                                                                size={15}
                                                                aria-hidden="true"
                                                            />
                                                            Incluir participante
                                                        </button>
                                                    ))}
                                            </div>
                                        </Table.Cell>
                                    )}
                                </Table.Row>
                            );
                        }}
                    </Table.Body>
                </Table.Content>
            </Table.ScrollContainer>
        </Table>
    );
}
