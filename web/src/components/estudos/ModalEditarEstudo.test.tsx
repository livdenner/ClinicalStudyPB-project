import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

afterEach(cleanup);

describe("ModalEditarEstudo", () => {
    it.each([
        {
            id: 7,
            name: "Dra. Helena Costa",
            nomeExibido: "Dra. Helena Costa",
        },
        {
            id: 11,
            name: "Ana Silva",
            nomeExibido: "Pesquisador #7",
        },
    ])("preserva o responsável ao editar como $name", async (usuario) => {
        const onSalvar = vi.fn().mockResolvedValue(undefined);

        render(
            <ModalEditarEstudo
                estudo={estudo}
                pesquisador={usuario}
                onFechar={vi.fn()}
                onSalvar={onSalvar}
            />
        );

        const dialog = await screen.findByRole("dialog", {
            name: "Editar estudo",
        });

        expect(within(dialog).getByText(usuario.nomeExibido)).toBeInTheDocument();

        fireEvent.change(within(dialog).getByLabelText(/^Nome do estudo/), {
            target: { value: "Estudo atualizado" },
        });

        fireEvent.click(
            within(dialog).getByRole("button", {
                name: "Salvar alterações",
            })
        );

        const { id: _id, ...dados } = estudo;

        await waitFor(() =>
            expect(onSalvar).toHaveBeenCalledExactlyOnceWith({
                ...dados,
                title: "Estudo atualizado",
            })
        );
    });

    it("impede salvar limite de participantes igual a zero", async () => {
        const onSalvar = vi.fn().mockResolvedValue(undefined);

        render(
            <ModalEditarEstudo
                estudo={estudo}
                pesquisador={pesquisador}
                onFechar={vi.fn()}
                onSalvar={onSalvar}
            />
        );

        const dialog = await screen.findByRole("dialog", {
            name: "Editar estudo",
        });

        fireEvent.change(within(dialog).getByLabelText(/^Limite de participantes/), {
            target: { value: "0" },
        });

        fireEvent.click(
            within(dialog).getByRole("button", {
                name: "Salvar alterações",
            })
        );

        expect(
            await within(dialog).findByText("Informe um limite inteiro entre 1 e 2147483647.")
        ).toBeInTheDocument();

        expect(onSalvar).not.toHaveBeenCalled();
    });

    it("salva o novo limite mantendo o responsável original do estudo", async () => {
        const onSalvar = vi.fn().mockResolvedValue(undefined);
        const estudoOutroResponsavel = {
            ...estudo,
            responsibleUserId: 9,
        };

        render(
            <ModalEditarEstudo
                estudo={estudoOutroResponsavel}
                pesquisador={pesquisador}
                onFechar={vi.fn()}
                onSalvar={onSalvar}
            />
        );

        const dialog = await screen.findByRole("dialog", {
            name: "Editar estudo",
        });

        expect(within(dialog).getByText("Pesquisador #9")).toBeInTheDocument();

        fireEvent.change(within(dialog).getByLabelText(/^Limite de participantes/), {
            target: { value: "150" },
        });

        fireEvent.click(
            within(dialog).getByRole("button", {
                name: "Salvar alterações",
            })
        );

        const { id: _id, ...dados } = estudoOutroResponsavel;

        await waitFor(() =>
            expect(onSalvar).toHaveBeenCalledExactlyOnceWith({
                ...dados,
                participantLimit: 150,
            })
        );
    });
});
