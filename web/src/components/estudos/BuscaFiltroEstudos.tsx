import { Input, Select, ListBox } from "@heroui/react";
import { statusDisponiveis, type FiltroStatus } from "../../utils/estudos";

type BuscaFiltroEstudosProps = {
  busca: string;
  filtroStatus: FiltroStatus;
  aoMudarBusca: (valor: string) => void;
  aoMudarStatus: (status: FiltroStatus) => void;
};

export function BuscaFiltroEstudos({
  busca,
  filtroStatus,
  aoMudarBusca,
  aoMudarStatus,
}: BuscaFiltroEstudosProps) {
  return (
    <div className="flex items-center justify-end gap-3 max-[600px]:w-full max-[600px]:flex-col max-[600px]:items-stretch">
      <div className="w-[220px] shrink-0 max-[600px]:w-full">
        <Input
          aria-label="Buscar por nome do estudo"
          type="search"
          placeholder="Buscar estudo..."
          value={busca}
          onChange={(event) => aoMudarBusca(event.target.value)}
          className="h-10 text-sm text-[var(--color-text)] focus-within:ring-1 focus-within:ring-[var(--color-primary)] "
        />
      </div>

      <div className="w-[180px] shrink-0 max-[600px]:w-full">
        <Select
          aria-label="Filtrar por status"
          selectedKey={filtroStatus}
          onSelectionChange={(valor) => {
            if (valor !== null) {
              aoMudarStatus(valor as FiltroStatus);
            }
          }}
          className="text-sm text-[var(--color-text)]"
        >
          <Select.Trigger className="h-10 rounded-lg border border-[var(--color-border)] bg-white shadow-none text-sm text-[var(--color-text)]">
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>

          <Select.Popover>
            <ListBox>
              {statusDisponiveis.map((status) => (
                <ListBox.Item
                  key={status}
                  id={status}
                  textValue={status}
                  className="hover:bg-[var(--color-hover)]"
                >
                  {status}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>
    </div>
  );
}
