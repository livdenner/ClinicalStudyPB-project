import { Chip, Table } from "@heroui/react";
import { ClipboardCheck, UserPlus } from "lucide-react";
import {
    ELEGIBILIDADE_LABELS,
    SITUACAO_CANDIDATO_LABELS,
    type CandidatoApi,
    type StatusCandidatoApi,
    type StatusElegibilidadeApi,
} from "../../types/candidato";
import { candidatoPodeSerIncluido } from "../../utils/candidatos";

type Props = {
    candidatos: CandidatoApi[];
    vagasDisponiveis?: number;
    estudoEmRecrutamento?: boolean;
    onSelecionarCandidato?: (candidato: CandidatoApi) => void;
    onIncluirParticipante?: (candidato: CandidatoApi) => void;
};

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
    CANCELLED: "bg-[var(--color-neutral-soft)] text-[var(--color-neutral)]",
};

/** Exibe a situação da API e oferece ações permitidas ao coordenador. @author Lívia */
export function TabelaCandidatos({
    candidatos,
    vagasDisponiveis,
    estudoEmRecrutamento = false,
    onSelecionarCandidato,
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

    const exibirAcoes = Boolean(onSelecionarCandidato || onIncluirParticipante);
    const colunas = [
        "Identificação",
        "Idade",
        "Situação",
        "Elegibilidade",
        ...(exibirAcoes ? ["Ações"] : []),
    ];
    const inclusaoHabilitada =
        estudoEmRecrutamento && vagasDisponiveis !== undefined && vagasDisponiveis > 0;
    const motivoBloqueioInclusao = !estudoEmRecrutamento
        ? "A inclusão só é permitida com o estudo em recrutamento."
        : vagasDisponiveis === undefined
          ? "Consulte as vagas disponíveis antes de incluir o participante."
          : "O estudo atingiu o limite de vagas disponíveis.";

    return (
        <Table variant="secondary">
            <Table.ScrollContainer className="overflow-x-auto">
                <Table.Content
                    aria-label="Lista de candidatos"
                    className="w-full min-w-[620px] text-left text-sm"
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
                    <Table.Body items={candidatos}>
                        {(candidato) => (
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
                                        className={`font-semibold ${SITUACAO_CLASSES[candidato.status] ?? SITUACAO_CLASSES.ACTIVE}`}
                                    >
                                        <Chip.Label>
                                            {SITUACAO_CANDIDATO_LABELS[candidato.status] ??
                                                "Situação indisponível"}
                                        </Chip.Label>
                                    </Chip>
                                    {candidato.status === "DECLINED" && (
                                        <p className="mt-1 text-xs text-[var(--color-muted)]">
                                            Decisão final do candidato.
                                        </p>
                                    )}
                                </Table.Cell>
                                <Table.Cell className="border-[var(--color-border)] px-5 py-4 group-hover:bg-slate-50">
                                    <Chip
                                        size="sm"
                                        variant="soft"
                                        className={`font-semibold ${ELEGIBILIDADE_CLASSES[candidato.eligibilityStatus]}`}
                                    >
                                        <Chip.Label>
                                            {ELEGIBILIDADE_LABELS[candidato.eligibilityStatus]}
                                        </Chip.Label>
                                    </Chip>
                                </Table.Cell>
                                {exibirAcoes && (
                                    <Table.Cell className="border-[var(--color-border)] px-5 py-4 group-hover:bg-slate-50">
                                        <div className="flex flex-wrap items-center gap-2">
                                            {onSelecionarCandidato &&
                                                candidato.status !== "INCLUDED" &&
                                                candidato.status !== "CANCELLED" && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            onSelecionarCandidato(candidato)
                                                        }
                                                        aria-label={`Avaliar elegibilidade: ${candidato.name}`}
                                                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)] transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]"
                                                    >
                                                        <ClipboardCheck
                                                            size={15}
                                                            aria-hidden="true"
                                                        />
                                                        Avaliar elegibilidade
                                                    </button>
                                                )}
                                            {onIncluirParticipante &&
                                                candidatoPodeSerIncluido(candidato) && (
                                                    <button
                                                        type="button"
                                                        disabled={!inclusaoHabilitada}
                                                        title={
                                                            inclusaoHabilitada
                                                                ? "Incluir candidato como participante do estudo"
                                                                : motivoBloqueioInclusao
                                                        }
                                                        onClick={() =>
                                                            onIncluirParticipante(candidato)
                                                        }
                                                        aria-label={`Incluir participante: ${candidato.name}`}
                                                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--color-primary)] bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--color-primary-dark)] disabled:cursor-not-allowed disabled:border-[var(--color-border)] disabled:bg-slate-100 disabled:text-[var(--color-muted)]"
                                                    >
                                                        <UserPlus size={15} aria-hidden="true" />
                                                        Incluir participante
                                                    </button>
                                                )}
                                        </div>
                                    </Table.Cell>
                                )}
                            </Table.Row>
                        )}
                    </Table.Body>
                </Table.Content>
            </Table.ScrollContainer>
        </Table>
    );
}
