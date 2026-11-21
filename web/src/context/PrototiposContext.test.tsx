import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { PrototipoBadge } from "./PrototiposContext";

afterEach(cleanup);

it.each([
    ["Planejamento", "surface", "neutral"],
    ["Recrutamento", "study-recruitment-soft", "study-recruitment"],
    ["Em execução", "study-execution-soft", "study-execution"],
    ["Encerrado", "study-closed-soft", "study-closed"],
    ["Cancelado", "error-soft", "error"],
    ["Pendente", "warning-soft", "warning"],
    ["Agendada", "neutral-soft", "neutral"],
    ["Realizada", "success-soft", "success"],
    ["Ativo", "info-soft", "info"],
    ["Inativo", "neutral-soft", "neutral"],
    ["Estado novo", "neutral-soft", "neutral"],
])("T24.5 — Cores das telas acessíveis: %s segue a tabela semântica", (rotulo, fundo, texto) => {
    render(<PrototipoBadge>{rotulo}</PrototipoBadge>);
    expect(screen.getByText(rotulo)).toHaveClass(
        `bg-[var(--color-${fundo})]`,
        `text-[var(--color-${texto})]`
    );
});
