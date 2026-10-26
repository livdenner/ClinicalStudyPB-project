import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TabelaEstudos } from "./TabelaEstudos";
import type { EstudoApi } from "../../types/estudo";

const pesquisador = { id: 7, name: "Ana Silva" };
const estudos: EstudoApi[] = [
  {
    id: 3,
    title: "Estudo do sono",
    objective: "Avaliar hábitos",
    responsibleUserId: 7,
    startDate: "2026-11-01",
    endDate: "2026-12-01",
    participantLimit: 30,
  },
  {
    id: 4,
    title: "Estudo cardiovascular",
    objective: "Acompanhar indicadores",
    responsibleUserId: 11,
    startDate: "2026-11-01",
    endDate: "2027-02-01",
    participantLimit: 50,
  },
];

afterEach(cleanup);

describe("TabelaEstudos", () => {
  it("mostra responsáveis, limites e períodos inclusive quando atravessam o ano", () => {
    render(
      <MemoryRouter>
        <TabelaEstudos
          estudos={estudos}
          pesquisador={pesquisador}
          onEditar={vi.fn()}
        />
      </MemoryRouter>,
    );
    const tabela = screen.getByRole("grid", {
      name: "Lista de estudos clínicos",
    });
    const primeiraLinha = within(tabela)
      .getByRole("rowheader", { name: "Estudo do sono" })
      .closest("tr")!;
    const segundaLinha = within(tabela)
      .getByRole("rowheader", { name: "Estudo cardiovascular" })
      .closest("tr")!;
    expect(within(primeiraLinha).getByText("Ana Silva")).toBeInTheDocument();
    expect(within(primeiraLinha).getByText("30")).toBeInTheDocument();
    expect(within(primeiraLinha).getByText("nov–dez 2026")).toBeInTheDocument();
    expect(
      within(segundaLinha).getByText("Pesquisador #11"),
    ).toBeInTheDocument();
    expect(within(segundaLinha).getByText("50")).toBeInTheDocument();
    expect(
      within(segundaLinha).getByText("nov 2026–fev 2027"),
    ).toBeInTheDocument();
  });

  it("encaminha o registro correto ao callback de edição", () => {
    const onEditar = vi.fn();
    render(
      <MemoryRouter>
        <TabelaEstudos
          estudos={estudos}
          pesquisador={pesquisador}
          onEditar={onEditar}
        />
      </MemoryRouter>,
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Editar estudo: Estudo cardiovascular",
      }),
    );
    expect(onEditar).toHaveBeenCalledTimes(1);
    expect(onEditar).toHaveBeenCalledWith(estudos[1]);
    expect(
      screen.getByRole("button", {
        name: "Visualizar estudo: Estudo cardiovascular",
      }),
    ).toBeInTheDocument();
  });

  it("orienta o usuário quando não existem estudos para exibir", () => {
    render(
      <MemoryRouter>
        <TabelaEstudos
          estudos={[]}
          pesquisador={pesquisador}
          onEditar={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("Nenhum estudo encontrado")).toBeInTheDocument();
    expect(
      screen.getByText("Ajuste a busca ou cadastre um novo estudo."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Editar estudo:/ }),
    ).not.toBeInTheDocument();
  });
});
