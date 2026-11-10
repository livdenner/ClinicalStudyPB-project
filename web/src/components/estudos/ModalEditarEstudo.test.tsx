import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModalEditarEstudo } from "./ModalEditarEstudo";
import type { EstadoEstudo, EstudoApi } from "../../types/estudo";

const estudo: EstudoApi = {
    version: 0,
    id: 1,
    status: "RECRUITMENT",
    title: "Acompanhamento cardiovascular",
    objective: "Avaliar a resposta ao tratamento em 12 meses.",
    responsibleUserId: 7,
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    participantLimit: 120,
};
const pesquisador = { id: 7, name: "Helena Costa", role: "RESEARCHER" as const };
afterEach(cleanup);

describe("permissões de edição do estudo", () => {
    it("permite ao responsável salvar em recrutamento sem enviar estado", async () => {
        const onSalvar = vi.fn().mockResolvedValue(undefined);
        render(
            <ModalEditarEstudo
                estudo={estudo}
                pesquisador={pesquisador}
                onFechar={vi.fn()}
                onSalvar={onSalvar}
            />
        );
        await screen.findByRole("dialog", { name: "Editar estudo" });
        expect(screen.getByText(pesquisador.name)).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText(/^Limite de participantes/), {
            target: { value: "150" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
        const { id: _id, status: _status, version: _version, ...dados } = estudo;
        await waitFor(() =>
            expect(onSalvar).toHaveBeenCalledExactlyOnceWith({ ...dados, participantLimit: 150 })
        );
    });

    it("bloqueia a edição por outro pesquisador, inclusive o envio direto do formulário", async () => {
        const onSalvar = vi.fn();
        render(
            <ModalEditarEstudo
                estudo={estudo}
                pesquisador={{ ...pesquisador, id: 9 }}
                onFechar={vi.fn()}
                onSalvar={onSalvar}
            />
        );
        await screen.findByRole("dialog", { name: "Consultar estudo" });
        expect(screen.getByText("Pesquisador #7")).toBeInTheDocument();
        const campo = screen.getByLabelText(/^Nome do estudo/);
        expect(campo).toBeDisabled();
        expect(screen.queryByRole("button", { name: "Salvar alterações" })).not.toBeInTheDocument();
        fireEvent.submit(campo.closest("form")!);
        expect(onSalvar).not.toHaveBeenCalled();
    });

    it("mantém execução, encerrado e cancelado somente leitura para o próprio responsável", async () => {
        const onSalvar = vi.fn();
        const props = { pesquisador, onFechar: vi.fn(), onSalvar };
        const estados: EstadoEstudo[] = ["EXECUTION", "CLOSED", "CANCELLED"];
        const { rerender } = render(
            <ModalEditarEstudo {...props} estudo={{ ...estudo, status: "EXECUTION" }} />
        );
        for (const status of estados) {
            rerender(<ModalEditarEstudo {...props} estudo={{ ...estudo, status }} />);
            await screen.findByRole("dialog", { name: "Consultar estudo" });
            const campo = screen.getByLabelText(/^Nome do estudo/);
            expect(campo).toBeDisabled();
            expect(
                screen.queryByRole("button", { name: "Salvar alterações" })
            ).not.toBeInTheDocument();
            fireEvent.submit(campo.closest("form")!);
        }
        expect(onSalvar).not.toHaveBeenCalled();
    });
});
