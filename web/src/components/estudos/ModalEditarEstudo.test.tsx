import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModalEditarEstudo } from "./ModalEditarEstudo";
import type { EstudoApi } from "../../types/estudo";

const estudo: EstudoApi = {
  id: 3,
  title: "Acompanhamento cardiovascular",
  objective: "Acompanhar indicadores cardiovasculares",
  responsibleUserId: 11,
  participantLimit: 120,
  startDate: "2026-01-01",
  endDate: "2026-12-31",
};

afterEach(cleanup);

describe("ModalEditarEstudo", () => {
  it.each([
    { id: 11, name: "Helena Costa", nomeExibido: "Helena Costa" },
    { id: 7, name: "Ana Silva", nomeExibido: "Pesquisador #11" },
  ])("preserva o responsável ao editar como $name", async (pesquisador) => {
    const onSalvar = vi.fn().mockResolvedValue(undefined);
    render(
      <ModalEditarEstudo
        estudo={estudo}
        pesquisador={pesquisador}
        onFechar={vi.fn()}
        onSalvar={onSalvar}
      />,
    );
    const dialog = await screen.findByRole("dialog", { name: "Editar estudo" });
    expect(within(dialog).getByText(pesquisador.nomeExibido)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/^Nome do estudo/), {
      target: { value: "Estudo atualizado" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar alterações" }));
    const { id: _id, ...dados } = estudo;
    await waitFor(() => expect(onSalvar).toHaveBeenCalledExactlyOnceWith({
      ...dados,
      title: "Estudo atualizado",
    }));
  });
});
