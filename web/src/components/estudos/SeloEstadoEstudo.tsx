import { Chip } from "@heroui/react";
import { ehEstadoEstudo, ESTADOS_ESTUDO } from "../../config/estados-estudo";
import type { EstadoEstudo } from "../../types/estudo";

export function SeloEstadoEstudo({ estado }: { estado: EstadoEstudo }) {
    const configuracao = ehEstadoEstudo(estado) ? ESTADOS_ESTUDO[estado] : null;

    return (
        <Chip
            size="md"
            variant="soft"
            className={`whitespace-nowrap font-semibold ${configuracao?.classes ?? "bg-slate-100 text-slate-700"}`}
        >
            <Chip.Label>{configuracao?.rotulo ?? "Estado indisponível"}</Chip.Label>
        </Chip>
    );
}
