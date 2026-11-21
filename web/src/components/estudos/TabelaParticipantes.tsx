import { Chip, Table } from "@heroui/react";
import type { ParticipanteApi } from "../../types/participante";
import { SELOS_PARTICIPANTE, formatarDataInclusao } from "../../utils/participantes";

export function TabelaParticipantes({ participantes }: { participantes: ParticipanteApi[] }) {
    return (
        <Table
            variant="secondary"
            className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white"
        >
            <Table.ScrollContainer className="w-full overflow-x-auto">
                <Table.Content
                    aria-label="Participantes do estudo"
                    className="w-full table-fixed text-left text-sm"
                >
                    <Table.Header>
                        <Table.Column
                            id="nome"
                            isRowHeader
                            className="w-1/2 rounded-none border-b border-[var(--color-border)] bg-[var(--color-neutral-soft)] px-5 py-3 font-semibold text-[var(--color-neutral)] after:hidden"
                        >
                            Nome
                        </Table.Column>
                        <Table.Column
                            id="data-inclusao"
                            className="rounded-none border-b border-[var(--color-border)] bg-[var(--color-neutral-soft)] px-5 py-3 font-semibold text-[var(--color-neutral)] after:hidden"
                        >
                            Data de inclusão
                        </Table.Column>
                        <Table.Column
                            id="situacao"
                            className="rounded-none border-b border-[var(--color-border)] bg-[var(--color-neutral-soft)] px-5 py-3 font-semibold text-[var(--color-neutral)] after:hidden"
                        >
                            Situação
                        </Table.Column>
                    </Table.Header>
                    <Table.Body items={participantes}>
                        {(participante) => {
                            const selo =
                                SELOS_PARTICIPANTE[participante.status] ??
                                SELOS_PARTICIPANTE.indisponivel;
                            return (
                                <Table.Row
                                    id={participante.id}
                                    textValue={participante.candidateName}
                                    className="group border-b border-[var(--color-border)] last:border-b-0"
                                >
                                    <Table.Cell className="border-[var(--color-border)] px-5 py-4 font-semibold text-[var(--color-title)] group-hover:bg-[var(--color-row-hover)] [overflow-wrap:anywhere]">
                                        {participante.candidateName}
                                    </Table.Cell>
                                    <Table.Cell className="border-[var(--color-border)] px-5 py-4 text-[var(--color-text)] group-hover:bg-[var(--color-row-hover)]">
                                        {formatarDataInclusao(participante.includedAt)}
                                    </Table.Cell>
                                    <Table.Cell className="border-[var(--color-border)] px-5 py-4 group-hover:bg-[var(--color-row-hover)]">
                                        <Chip size="sm" variant="soft" className={selo.classes}>
                                            <Chip.Label>{selo.rotulo}</Chip.Label>
                                        </Chip>
                                    </Table.Cell>
                                </Table.Row>
                            );
                        }}
                    </Table.Body>
                </Table.Content>
            </Table.ScrollContainer>
        </Table>
    );
}
