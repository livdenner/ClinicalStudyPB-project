import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BuscaFiltroEstudos } from "./BuscaFiltroEstudos";

afterEach(cleanup);

describe("BuscaFiltroEstudos", () => {
  it("exibe a busca atual e informa a digitação e a limpeza pelo callback", () => {
    const aoMudarBusca = vi.fn();
    render(<BuscaFiltroEstudos busca="sono" aoMudarBusca={aoMudarBusca} />);
    const busca = screen.getByRole("searchbox", {
      name: "Buscar por nome do estudo",
    });
    expect(busca).toHaveValue("sono");
    fireEvent.change(busca, { target: { value: "cardiovascular" } });
    expect(aoMudarBusca).toHaveBeenLastCalledWith("cardiovascular");
    fireEvent.change(busca, { target: { value: "" } });
    expect(aoMudarBusca).toHaveBeenLastCalledWith("");
  });
});
