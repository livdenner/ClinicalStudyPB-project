import { Input, Label, ListBox, Select, TextField } from "@heroui/react";
import { ehEstadoEstudo, ESTADOS_ESTUDO } from "../../config/estados-estudo";
import type { FiltroEstadoEstudo } from "../../types/estudo";

type BuscaFiltroEstudosProps = {
    busca: string;
    aoMudarBusca: (valor: string) => void;
    estado: FiltroEstadoEstudo;
    aoMudarEstado: (valor: FiltroEstadoEstudo) => void;
};

export function BuscaFiltroEstudos({
    busca,
    aoMudarBusca,
    estado,
    aoMudarEstado,
}: BuscaFiltroEstudosProps) {
    return (
        <div className="flex items-center gap-3 max-[600px]:flex-col max-[600px]:items-stretch">
            <TextField
                type="search"
                value={busca}
                onChange={aoMudarBusca}
                className="w-[260px] max-[600px]:w-full"
            >
                <Label className="sr-only">Buscar por nome do estudo</Label>
                <Input
                    placeholder="Buscar estudo..."
                    className="h-10 text-sm text-[var(--color-text)] focus-within:ring-1 focus-within:ring-[var(--color-primary)]"
                />
            </TextField>
            <Select
                selectedKey={estado || "todos"}
                onSelectionChange={(valor) => {
                    if (valor === "todos") aoMudarEstado("");
                    else if (ehEstadoEstudo(valor)) aoMudarEstado(valor);
                }}
                className="w-[190px] max-[600px]:w-full"
            >
                <Label className="sr-only">Filtrar por estado</Label>
                <Select.Trigger className="h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-text)] shadow-none">
                    <Select.Value />
                    <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                    <ListBox>
                        <ListBox.Item id="todos" textValue="Todos os estados">
                            Todos os estados
                            <ListBox.ItemIndicator />
                        </ListBox.Item>
                        {Object.entries(ESTADOS_ESTUDO).map(([valor, configuracao]) => (
                            <ListBox.Item key={valor} id={valor} textValue={configuracao.rotulo}>
                                {configuracao.rotulo}
                                <ListBox.ItemIndicator />
                            </ListBox.Item>
                        ))}
                    </ListBox>
                </Select.Popover>
            </Select>
        </div>
    );
}
