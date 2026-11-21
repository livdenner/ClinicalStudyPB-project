import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { StatusVisitaAgendada } from "../../types/visita-agendada";
import { visitaAgendada } from "../../test/fixtures/agendamento";
import { ListaVisitasAgendadas } from "./ListaVisitasAgendadas";

afterEach(cleanup);

/** Consulta da lista RF12, sem rede ou dados reais. @author Lívia */
describe("RF12 — lista de agendamentos (T18.5)", () => {
    it("RF12-LS01: lista vazia apresenta orientação sem uma tabela fictícia", () => {
        render(<ListaVisitasAgendadas visitas={[]} />);
        expect(
            screen.getByText("Nenhuma visita encontrada para os filtros selecionados.")
        ).toBeInTheDocument();
        expect(screen.queryByRole("grid")).not.toBeInTheDocument();
    });

    it.each<[StatusVisitaAgendada, string]>([
        ["SCHEDULED", "Agendada"],
        ["DONE", "Realizada"],
        ["ABSENT", "Ausente"],
        ["CANCELLED", "Cancelada"],
    ])("RF12-LS02: situação %s da API é exibida como %s", (status, rotulo) => {
        render(<ListaVisitasAgendadas visitas={[{ ...visitaAgendada, status }]} />);
        const tabela = screen.getByRole("grid", { name: "Visitas agendadas do participante" });
        expect(within(tabela).getByText(rotulo)).toBeInTheDocument();
    });

    it("RF12-LS03: instante UTC é apresentado no horário de Fortaleza", () => {
        render(<ListaVisitasAgendadas visitas={[visitaAgendada]} />);
        const horario = screen.getByText(/10\/02\/2027.*09:00/);
        expect(horario).toHaveAttribute("datetime", "2027-02-10T12:00:00.000Z");
    });
});
