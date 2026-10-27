import { Button, Table } from "@heroui/react";
import { Eye, Pencil } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { EstudoApi } from "../../types/estudo";
import { formatarPeriodo } from "../../utils/estudos";

type TabelaEstudosProps = {
    estudos: EstudoApi[];
    pesquisador: { id: number; name: string };
    onEditar: (estudo: EstudoApi) => void;
};

export function TabelaEstudos({ estudos, pesquisador, onEditar }: TabelaEstudosProps) {
    const navigate = useNavigate();
    if (estudos.length === 0) {
        return (
            <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
                <strong className="text-sm font-semibold text-[var(--color-title)]">
                    Nenhum estudo encontrado
                </strong>
                <span className="text-sm text-[var(--color-muted)]">
                    Ajuste a busca ou cadastre um novo estudo.
                </span>
            </div>
        );
    }

    return (
        <Table variant="secondary">
            <Table.ScrollContainer>
                <Table.Content
                    aria-label="Lista de estudos clínicos"
                    className="w-full min-w-[820px] text-left text-sm"
                >
                    <Table.Header>
                        {[
                            "Estudo",
                            "Responsável",
                            "Limite de participantes",
                            "Período",
                            "Visualizar",
                            "Editar",
                        ].map((titulo) => (
                            <Table.Column
                                key={titulo}
                                id={titulo}
                                isRowHeader={titulo === "Estudo"}
                                className="rounded-none bg-[var(--color-primary)] px-5 py-3.5 text-xs font-semibold text-white after:hidden"
                            >
                                {titulo}
                            </Table.Column>
                        ))}
                    </Table.Header>
                    <Table.Body items={estudos}>
                        {(estudo) => (
                            <Table.Row
                                id={estudo.id}
                                textValue={estudo.title}
                                className="group border-b border-[var(--color-border)]"
                            >
                                <Table.Cell className="break-words border-[var(--color-border)] px-5 py-4 font-semibold text-[var(--color-title)] group-hover:bg-slate-50">
                                    {estudo.title}
                                </Table.Cell>
                                <Table.Cell className="border-[var(--color-border)] px-5 py-4 text-[var(--color-text)] group-hover:bg-slate-50">
                                    {estudo.responsibleUserId === pesquisador.id
                                        ? pesquisador.name
                                        : `Pesquisador #${estudo.responsibleUserId}`}
                                </Table.Cell>
                                <Table.Cell className="border-[var(--color-border)] px-5 py-4 text-[var(--color-text)] group-hover:bg-slate-50">
                                    {estudo.participantLimit}
                                </Table.Cell>
                                <Table.Cell className="whitespace-nowrap border-[var(--color-border)] px-5 py-4 text-[var(--color-text)] group-hover:bg-slate-50">
                                    {formatarPeriodo(estudo.startDate, estudo.endDate)}
                                </Table.Cell>
                                <Table.Cell className="border-[var(--color-border)] px-5 py-4 group-hover:bg-slate-50">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        isIconOnly
                                        aria-label={`Visualizar estudo: ${estudo.title}`}
                                        onPress={() => navigate(`/estudos/${estudo.id}`)}
                                        className="h-10 w-10 rounded-lg text-[var(--color-primary)] hover:bg-white"
                                    >
                                        <Eye size={18} aria-hidden="true" />
                                    </Button>
                                </Table.Cell>
                                <Table.Cell className="border-[var(--color-border)] px-5 py-4 group-hover:bg-slate-50">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        isIconOnly
                                        aria-label={`Editar estudo: ${estudo.title}`}
                                        onPress={() => onEditar(estudo)}
                                        className="h-10 w-10 rounded-lg text-[var(--color-primary)] hover:bg-white"
                                    >
                                        <Pencil size={18} aria-hidden="true" />
                                    </Button>
                                </Table.Cell>
                            </Table.Row>
                        )}
                    </Table.Body>
                </Table.Content>
            </Table.ScrollContainer>
        </Table>
    );
}
