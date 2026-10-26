import { Input, Label, TextField } from "@heroui/react";

type BuscaFiltroEstudosProps = {
  busca: string;
  aoMudarBusca: (valor: string) => void;
};

export function BuscaFiltroEstudos({ busca, aoMudarBusca }: BuscaFiltroEstudosProps) {
  return (
    <TextField type="search" value={busca} onChange={aoMudarBusca}
      className="w-[260px] max-[600px]:w-full">
      <Label className="sr-only">Buscar por nome do estudo</Label>
      <Input placeholder="Buscar estudo..."
        className="h-10 text-sm text-[var(--color-text)] focus-within:ring-1 focus-within:ring-[var(--color-primary)]" />
    </TextField>
  );
}
