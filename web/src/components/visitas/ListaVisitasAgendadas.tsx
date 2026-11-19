import { Chip, Table } from "@heroui/react";
import {
    STATUS_VISITA_LABELS,
    type StatusVisitaAgendada,
    type VisitaAgendada,
} from "../../types/visita-agendada";
import { formatarHorarioAgendamento } from "../../utils/agendamento";

const STATUS_CLASSES: Record<StatusVisitaAgendada, string> = {
    SCHEDULED: "bg-[var(--color-info-soft)] text-[var(--color-info)]",
    DONE: "bg-[var(--color-success-soft)] text-[var(--color-success)]",
    ABSENT: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
    CANCELLED: "bg-[var(--color-neutral-soft)] text-[var(--color-neutral)]",
};

/** Lista os agendamentos do participante com situação e horário retornados pela API. @author Lívia */
export function ListaVisitasAgendadas({ visitas }: { visitas: VisitaAgendada[] }) {
    if (visitas.length === 0) {
        return (
            <p className="p-8 text-center text-sm text-[var(--color-muted)]">
                Nenhuma visita encontrada para os filtros selecionados.
            </p>
        );
    }

    return (
        <Table variant="secondary">
            <Table.ScrollContainer className="overflow-x-auto">
                <Table.Content
                    aria-label="Visitas agendadas do participante"
                    className="w-full min-w-[540px] text-left text-sm"
                >
                    <Table.Header>
                        {["Visita prevista", "Data e hora — Fortaleza", "Situação"].map(
                            (titulo) => (
                                <Table.Column
                                    key={titulo}
                                    id={titulo}
                                    isRowHeader={titulo === "Visita prevista"}
                                    className="rounded-none bg-[var(--color-primary)] px-5 py-3 text-xs font-semibold text-white after:hidden"
                                >
                                    {titulo}
                                </Table.Column>
                            )
                        )}
                    </Table.Header>
                    <Table.Body items={visitas}>
                        {(visita) => (
                            <Table.Row id={visita.id} textValue={visita.plannedVisitName}>
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
                                        className={`font-semibold ${STATUS_CLASSES[visita.status] ?? STATUS_CLASSES.CANCELLED}`}
                                    >
                                        <Chip.Label>
                                            {STATUS_VISITA_LABELS[visita.status] ??
                                                "Situação indisponível"}
                                        </Chip.Label>
                                    </Chip>
                                </Table.Cell>
                            </Table.Row>
                        )}
                    </Table.Body>
                </Table.Content>
            </Table.ScrollContainer>
        </Table>
    );
}
