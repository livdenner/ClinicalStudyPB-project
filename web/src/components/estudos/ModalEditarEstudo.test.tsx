import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ModalEditarEstudo } from "./ModalEditarEstudo";
import type { EstudoApi } from "../../types/estudo";

const estudo: EstudoApi = {
    id: 1,
    title: "Acompanhamento cardiovascular",
    objective: "Avaliar a resposta ao tratamento em 12 meses.",
    responsibleUserId: 7,
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    participantLimit: 120,
};

const pesquisador = { id: 7, name: "Dra. Helena Costa" };

describe("ModalEditarEstudo", () => {
    it("mostra o nome do pesquisador logado quando ele é o responsável", () => {
        render(
            <ModalEditarEstudo
                estudo={estudo}
                pesquisador={pesquisador}
                onFechar={vi.fn()}
                onSalvar={vi.fn()}
            />
        );

        expect(screen.getByText("Dra. Helena Costa")).toBeInTheDocument();
    });

    it("identifica o responsável pelo id quando ele não é o pesquisador logado", () => {
        render(
            <ModalEditarEstudo
                estudo={{ ...estudo, responsibleUserId: 9 }}
                pesquisador={pesquisador}
                onFechar={vi.fn()}
                onSalvar={vi.fn()}
            />
        );

        expect(screen.getByText("Pesquisador #9")).toBeInTheDocument();
    });

    it("impede salvar limite de participantes menor ou igual a zero", () => {
        const onSalvar = vi.fn();

        render(
            <ModalEditarEstudo
                estudo={estudo}
                pesquisador={pesquisador}
                onFechar={vi.fn()}
                onSalvar={onSalvar}
            />
        );

        fireEvent.change(screen.getByLabelText("Limite de participantes"), {
            target: { value: "0" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

        expect(
            screen.getByText("Informe um limite inteiro entre 1 e 2147483647.")
        ).toBeInTheDocument();
        expect(onSalvar).not.toHaveBeenCalled();
    });

    it("salva as alterações mantendo o responsável original do estudo", async () => {
        const onSalvar = vi.fn().mockResolvedValue(undefined);

        render(
            <ModalEditarEstudo
                estudo={{ ...estudo, responsibleUserId: 9 }}
                pesquisador={pesquisador}
                onFechar={vi.fn()}
                onSalvar={onSalvar}
            />
        );

        fireEvent.change(screen.getByLabelText("Limite de participantes"), {
            target: { value: "150" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));

        await waitFor(() =>
            expect(onSalvar).toHaveBeenCalledWith({
                title: "Acompanhamento cardiovascular",
                objective: "Avaliar a resposta ao tratamento em 12 meses.",
                responsibleUserId: 9,
                startDate: "2026-01-01",
                endDate: "2026-12-31",
                participantLimit: 150,
            })
        );
    });
});
