import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

    it.each<[StatusVisitaAgendada, string, string | undefined]>([
        ["SCHEDULED", "Agendada", undefined],
        ["DONE", "Realizada", "Observação fictícia da visita realizada."],
        ["ABSENT", "Ausente", "Observação fictícia da ausência."],
        ["CANCELLED", "Cancelada", "Participante solicitou remarcar a visita."],
    ])("RF12-LS02: situação %s da API é exibida como %s", (status, rotulo, outcomeNote) => {
        render(<ListaVisitasAgendadas visitas={[{ ...visitaAgendada, status, outcomeNote }]} />);
        const tabela = screen.getByRole("grid", { name: "Visitas agendadas do participante" });
        expect(within(tabela).getByText(rotulo)).toBeInTheDocument();
        if (outcomeNote) {
            const prefixo = status === "CANCELLED" ? "Justificativa" : "Observação";
            expect(within(tabela).getByText(`${prefixo}: ${outcomeNote}`)).toBeInTheDocument();
        } else {
            expect(
                within(tabela).queryByText(/^(Justificativa|Observação):/)
            ).not.toBeInTheDocument();
        }
    });

    it("RF12-LS03: instante UTC é apresentado no horário de Fortaleza", () => {
        render(<ListaVisitasAgendadas visitas={[visitaAgendada]} />);
        const horario = screen.getByText(/10\/02\/2027.*09:00/);
        expect(horario).toHaveAttribute("datetime", "2027-02-10T12:00:00.000Z");
    });
});

/** Ações RF13 e RF14 compartilham a lista sem confundir seus estados. @author Lívia */
describe("RF13 / RF14 — ações da lista (T19.4 / T20.5)", () => {
    it.each(["SCHEDULED", "DONE", "ABSENT", "CANCELLED"] as const)(
        "RF13-L01: somente SCHEDULED oferece desfecho (%s)",
        (status) => {
            render(
                <ListaVisitasAgendadas
                    visitas={[{ ...visitaAgendada, status }]}
                    exibirParticipante
                    onDesfecho={vi.fn()}
                />
            );
            const tabela = screen.getByRole("grid", { name: "Visitas agendadas do estudo" });
            expect(within(tabela).getByText(visitaAgendada.participantName)).toBeInTheDocument();
            const buttons = within(tabela).queryAllByRole("button", {
                name: /^(Realizada|Ausente|Cancelar):/,
            });
            expect(buttons).toHaveLength(status === "SCHEDULED" ? 3 : 0);
        }
    );

    it.each([
        ["Realizada", "DONE"],
        ["Ausente", "ABSENT"],
        ["Cancelar", "CANCELLED"],
    ] as const)("RF13-L02: ação %s encaminha a visita e o desfecho corretos", (label, outcome) => {
        const onDesfecho = vi.fn();
        render(<ListaVisitasAgendadas visitas={[visitaAgendada]} onDesfecho={onDesfecho} />);
        fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}:`) }));
        expect(onDesfecho).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining(visitaAgendada),
            outcome
        );
    });

    it.each(["SCHEDULED", "DONE", "ABSENT", "CANCELLED"] as const)(
        "RF14-L01: somente DONE oferece acesso aos resultados (%s)",
        (status) => {
            render(
                <ListaVisitasAgendadas
                    visitas={[{ ...visitaAgendada, status }]}
                    onResultados={vi.fn()}
                    resultadosEditaveis
                />
            );
            expect(
                screen.queryAllByRole("button", { name: /^Registrar resultados:/ })
            ).toHaveLength(status === "DONE" ? 1 : 0);
        }
    );

    it.each([true, false])(
        "RF14-L02: ação de resultados respeita modo de edição (%s)",
        (editavel) => {
            const visita = { ...visitaAgendada, status: "DONE" as const };
            const onResultados = vi.fn();
            render(
                <ListaVisitasAgendadas
                    visitas={[visita]}
                    onResultados={onResultados}
                    resultadosEditaveis={editavel}
                />
            );
            fireEvent.click(
                screen.getByRole("button", {
                    name: new RegExp(editavel ? "^Registrar resultados:" : "^Ver resultados:"),
                })
            );
            expect(onResultados).toHaveBeenCalledExactlyOnceWith(expect.objectContaining(visita));
        }
    );
});
