import { Chip, Table } from "@heroui/react";
import { Check, UserX, X } from "lucide-react";
import { STATUS_VISITA_CLASSES } from "../../config/visitas";
import {
    STATUS_VISITA_LABELS,
    type VisitaAgendada,
    type DesfechoVisita,
} from "../../types/visita-agendada";
import { formatarHorarioAgendamento } from "../../utils/agendamento";

type Props = {
    visitas: VisitaAgendada[];
    exibirParticipante?: boolean;
    onDesfecho?: (visita: VisitaAgendada, outcome: DesfechoVisita) => void;
};

const ACOES = [
    { outcome: "DONE", label: "Realizada", Icone: Check },
    { outcome: "ABSENT", label: "Ausente", Icone: UserX },
    { outcome: "CANCELLED", label: "Cancelar", Icone: X },
] as const;

/** Lista as visitas com situação da API e ações de desfecho quando autorizadas. @author Lívia */
export function ListaVisitasAgendadas({ visitas, exibirParticipante = false, onDesfecho }: Props) {
    if (visitas.length === 0) {
        return (
            <p className="p-8 text-center text-sm text-[var(--color-muted)]">
                Nenhuma visita encontrada para os filtros selecionados.
            </p>
        );
    }

    const colunas = [
        ...(exibirParticipante ? ["Participante"] : []),
        "Visita prevista",
        "Data e hora — Fortaleza",
        "Situação",
        ...(onDesfecho ? ["Desfecho"] : []),
    ];
    const itens = visitas.map((visita) => ({
        ...visita,
        podeRegistrar: Boolean(onDesfecho) && visita.status === "SCHEDULED",
    }));

    return (
        <Table variant="secondary">
            <Table.ScrollContainer className="overflow-x-auto">
                <Table.Content
                    aria-label={
                        exibirParticipante
                            ? "Visitas agendadas do estudo"
                            : "Visitas agendadas do participante"
                    }
                    className={`w-full text-left text-sm ${exibirParticipante ? "min-w-[760px]" : "min-w-[540px]"}`}
                >
                    <Table.Header>
                        {colunas.map((titulo) => (
                            <Table.Column
                                key={titulo}
                                id={titulo}
                                isRowHeader={titulo === "Visita prevista"}
                                className="rounded-none bg-[var(--color-primary)] px-5 py-3 text-xs font-semibold text-white after:hidden"
                            >
                                {titulo}
                            </Table.Column>
                        ))}
                    </Table.Header>
                    <Table.Body items={itens}>
                        {(visita) => (
                            <Table.Row id={visita.id} textValue={visita.plannedVisitName}>
                                {exibirParticipante && (
                                    <Table.Cell className="break-words border-b border-[var(--color-border)] px-5 py-4 text-[var(--color-text)]">
                                        {visita.participantName}
                                    </Table.Cell>
                                )}
                                <Table.Cell className="break-words border-b border-[var(--color-border)] px-5 py-4 font-semibold text-[var(--color-title)]">
                                    {visita.plannedVisitName}
                                </Table.Cell>
                                <Table.Cell className="border-b border-[var(--color-border)] px-5 py-4 text-[var(--color-text)]">
                                    <time dateTime={visita.scheduledAt}>
                                        {formatarHorarioAgendamento(visita.scheduledAt)}
                                    </time>
                                </Table.Cell>
                                <Table.Cell className="border-b border-[var(--color-border)] px-5 py-4">
                                    <Chip
                                        size="sm"
                                        variant="soft"
                                        className={`font-semibold ${STATUS_VISITA_CLASSES[visita.status] ?? STATUS_VISITA_CLASSES.SCHEDULED}`}
                                    >
                                        <Chip.Label>
                                            {STATUS_VISITA_LABELS[visita.status] ??
                                                "Situação indisponível"}
                                        </Chip.Label>
                                    </Chip>
                                </Table.Cell>
                                {onDesfecho && (
                                    <Table.Cell className="border-b border-[var(--color-border)] px-5 py-4">
                                        {visita.podeRegistrar && (
                                            <div className="flex flex-wrap gap-2">
                                                {ACOES.map(({ outcome, label, Icone }) => (
                                                    <button
                                                        key={outcome}
                                                        type="button"
                                                        aria-label={`${label}: ${visita.plannedVisitName} — ${visita.participantName}`}
                                                        onClick={() => onDesfecho(visita, outcome)}
                                                        className={`inline-flex cursor-pointer items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${outcome === "CANCELLED" ? "border-[var(--color-error)] text-[var(--color-error)] hover:bg-[var(--color-error-soft)]" : "border-[var(--color-border)] text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]"}`}
                                                    >
                                                        <Icone size={14} aria-hidden="true" />
                                                        {label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
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
