import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ModalEditarEstudo } from "./ModalEditarEstudo";
import type { Estudo } from "../../types/estudo";

const estudo: Estudo = {
    id: "1",
    titulo: "Acompanhamento cardiovascular",
    responsavel: "Dra. Helena Costa",
    participantes: 84,
    limiteParticipantes: 120,
    dataInicio: "2026-01-01",
    dataFim: "2026-12-31",
    status: "Em execução",
};

describe("ModalEditarEstudo", () => {
    it("impede salvar limite menor que os participantes alocados", () => {
        const onSalvar = vi.fn();

        render(<ModalEditarEstudo estudo={estudo} onFechar={vi.fn()} onSalvar={onSalvar} />);

        fireEvent.change(screen.getByLabelText("Limite de participantes"), {
            target: { value: "20" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

        expect(
            screen.getByText("O limite não pode ser menor que os 84 participantes já alocados.")
        ).toBeInTheDocument();
        expect(onSalvar).not.toHaveBeenCalled();
    });
});
