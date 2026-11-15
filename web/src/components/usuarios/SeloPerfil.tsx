import { Chip } from "@heroui/react";
import { ROLE_LABELS, type UserRole } from "../../types/auth";

export function SeloPerfil({
    perfil,
    sobreFundoEscuro = false,
}: {
    perfil: UserRole;
    sobreFundoEscuro?: boolean;
}) {
    return (
        <Chip
            size="lg"
            variant="secondary"
            className={`border font-semibold ${sobreFundoEscuro ? "border-[var(--color-sidebar-border)] bg-[var(--color-sidebar-hover)] text-[var(--color-sidebar-text)]" : "border-[var(--color-neutral-border)] bg-[var(--color-neutral-soft)] text-[var(--color-neutral)]"}`}
        >
            <Chip.Label>{ROLE_LABELS[perfil] ?? perfil}</Chip.Label>
        </Chip>
    );
}
