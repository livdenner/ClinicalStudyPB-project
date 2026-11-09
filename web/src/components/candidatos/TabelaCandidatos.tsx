import { Chip, Table } from "@heroui/react";
import { ClipboardCheck } from "lucide-react";
import {
    ELEGIBILIDADE_LABELS,
    type CandidatoApi,
    type StatusElegibilidadeApi,
} from "../../types/candidato";

type Props = {
    candidatos: CandidatoApi[];
    onSelecionarCandidato?: (candidato: CandidatoApi) => void;
};

const ELEGIBILIDADE_CLASSES: Record<StatusElegibilidadeApi, string> = {
    PENDING: "bg-[#FEF3C7] text-[#92400E]",
    ELIGIBLE: "bg-[#E4F4E9] text-[#16804B]",
    INELIGIBLE: "bg-[#FDEAEA] text-[#B42318]",
};

export function TabelaCandidatos({ candidatos, onSelecionarCandidato }: Props) {
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

    const colunas = onSelecionarCandidato
        ? ["Identificação", "Idade", "Elegibilidade", "Avaliação"]
        : ["Identificação", "Idade", "Elegibilidade"];

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
                    <Table.Body items={candidatos}>
                        {(candidato) => {
                            const elegibilidade: StatusElegibilidadeApi =
                                candidato.eligibilityStatus ?? "PENDING";
                            const rotuloAcao = `Avaliar elegibilidade: ${candidato.name}`;

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
                                    {onSelecionarCandidato && (
                                        <Table.Cell className="border-[var(--color-border)] px-5 py-4 group-hover:bg-slate-50">
                                            <button
                                                type="button"
                                                onClick={() => onSelecionarCandidato(candidato)}
                                                aria-label={rotuloAcao}
                                                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)] transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]"
                                            >
                                                <ClipboardCheck size={15} aria-hidden="true" />
                                                Avaliar elegibilidade
                                            </button>
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
