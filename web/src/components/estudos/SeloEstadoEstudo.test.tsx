import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { EstadoEstudo } from "../../types/estudo";
import { SeloEstadoEstudo } from "./SeloEstadoEstudo";

afterEach(cleanup);

it.each<[EstadoEstudo, string, string, string]>([
    ["PLANNING", "Planejamento", "surface", "neutral"],
    ["RECRUITMENT", "Recrutamento", "study-recruitment-soft", "study-recruitment"],
    ["EXECUTION", "Em execução", "study-execution-soft", "study-execution"],
    ["CLOSED", "Encerrado", "study-closed-soft", "study-closed"],
    ["CANCELLED", "Cancelado", "error-soft", "error"],
])(
    "T24.5 — Cores dos estudos: %s mantém texto, ícone e tokens documentados",
    (estado, rotulo, fundo, texto) => {
        const { container } = render(<SeloEstadoEstudo estado={estado} />);
        expect(screen.getByText(rotulo)).toBeInTheDocument();
        expect(container.firstElementChild).toHaveClass(
            `bg-[var(--color-${fundo})]`,
            `text-[var(--color-${texto})]`
        );
        expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
        if (estado === "PLANNING") {
            expect(container.firstElementChild).toHaveClass(
                "border",
                "border-[var(--color-neutral-border)]"
            );
        }
    }
);

it("T24.5 — Estado desconhecido: informa indisponibilidade em tom neutro", () => {
    const { container } = render(<SeloEstadoEstudo estado={"UNKNOWN" as EstadoEstudo} />);
    expect(screen.getByText("Estado indisponível")).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass(
        "bg-[var(--color-neutral-soft)]",
        "text-[var(--color-neutral)]"
    );
    expect(container.querySelector("svg")).not.toBeInTheDocument();
});
