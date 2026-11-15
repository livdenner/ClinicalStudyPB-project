import { Chip } from "@heroui/react";
import { CirclePlay, CircleX, Lock, Pencil, UserPlus, type LucideIcon } from "lucide-react";
import { ehEstadoEstudo, ESTADOS_ESTUDO } from "../../config/estados-estudo";
import type { EstadoEstudo } from "../../types/estudo";

const ICONES_ESTADO: Record<EstadoEstudo, LucideIcon> = {
    PLANNING: Pencil,
    RECRUITMENT: UserPlus,
    EXECUTION: CirclePlay,
    CLOSED: Lock,
    CANCELLED: CircleX,
};

export function SeloEstadoEstudo({ estado }: { estado: EstadoEstudo }) {
    const configuracao = ehEstadoEstudo(estado) ? ESTADOS_ESTUDO[estado] : null;
    const Icone = configuracao ? ICONES_ESTADO[estado] : null;

    return (
        <Chip
            size="md"
            variant="soft"
            className={`whitespace-nowrap font-semibold ${configuracao?.classes ?? "bg-[var(--color-neutral-soft)] text-[var(--color-neutral)]"}`}
        >
            <Chip.Label>
                <span className="inline-flex items-center gap-1.5">
                    {Icone && <Icone size={13} strokeWidth={2} aria-hidden="true" />}
                    {configuracao?.rotulo ?? "Estado indisponível"}
                </span>
            </Chip.Label>
        </Chip>
    );
}
