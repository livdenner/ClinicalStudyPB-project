import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    estudoAgendamento,
    participanteAgendamento,
    respostaHttp,
    simularHttp,
    visitaAgendada,
} from "../../test/fixtures/agendamento";
import { renderFluxo } from "../../test/fixtures/fluxos-web";
import { VisitasPage } from "./visitas";

afterEach(() => {
    cleanup();
    sessionStorage.clear();
    vi.restoreAllMocks();
});
const outcomePath = "/api/studies/10/participants/50/visits/80/outcome";
const visitPath = "/api/studies/10/participants/50/visits/80";
function rotas() {
    return {
        "GET /api/studies": respostaHttp([estudoAgendamento]),
        "GET /api/studies/10/participants": respostaHttp([participanteAgendamento]),
        "GET /api/studies/10/visits": respostaHttp([visitaAgendada]),
    };
}
async function lista() {
    return screen.findByRole("grid", { name: "Visitas agendadas do estudo" });
}
async function abrirDesfecho(label: string) {
    fireEvent.click(
        await within(await lista()).findByRole("button", { name: new RegExp(`^${label}:`) })
    );
    return screen.findByRole("dialog");
}

/** Integra a lista, o formulário e os serviços reais sobre fetch simulado. @author Lívia */
describe("RF13 — desfechos e atualização da lista (T19.4)", () => {
    it("RF13-P07: conflito de versão exige nova confirmação e usa a versão atualizada da visita", async () => {
        const http = simularHttp({
            ...rotas(),
            [`POST ${outcomePath}`]: [
                respostaHttp(
                    { code: "VERSION_MISMATCH", message: "A versão da visita mudou." },
                    409
                ),
                respostaHttp({ ...visitaAgendada, status: "DONE", version: 8 }),
            ],
            [`GET ${visitPath}`]: respostaHttp({ ...visitaAgendada, version: 7 }),
            "GET /api/studies/10": respostaHttp({ ...estudoAgendamento, version: 99 }),
        });
        renderFluxo(<VisitasPage />);
        const dialog = await abrirDesfecho("Realizada");
        fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar realizada" }));
        expect(
            await within(dialog).findByText(/Dados atualizados. Situação atual:/)
        ).toBeInTheDocument();
        await waitFor(() =>
            expect(
                within(dialog).getByRole("button", { name: "Confirmar realizada" })
            ).toBeEnabled()
        );
        expect(http.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
        fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar realizada" }));
        expect(await screen.findByText("Desfecho registrado: Realizada.")).toBeInTheDocument();
        const envios = http.mock.calls.filter(([, init]) => init?.method === "POST");
        expect(envios).toHaveLength(2);
        expect(new Headers(envios[1][1]?.headers).get("If-Match")).toBe('"7"');
    });

    it.each([
        ["Realizada", "DONE", "Confirmar realizada", "Realizada"],
        ["Ausente", "ABSENT", "Confirmar ausência", "Ausente"],
        ["Cancelar", "CANCELLED", "Confirmar cancelamento", "Cancelada"],
    ] as const)(
        "RF13-P01: confirmar %s atualiza o selo sem recarregar a página",
        async (action, status, confirm, selo) => {
            const http = simularHttp({
                ...rotas(),
                "GET /api/studies": respostaHttp([{ ...estudoAgendamento, version: 99 }]),
                "GET /api/studies/10/visits": respostaHttp([{ ...visitaAgendada, version: 3 }]),
                [`POST ${outcomePath}`]: respostaHttp({
                    ...visitaAgendada,
                    status,
                    version: 4,
                    ...(status === "CANCELLED" ? { outcomeNote: "Motivo fictício" } : {}),
                }),
            });
            renderFluxo(<VisitasPage />);
            const dialog = await abrirDesfecho(action);
            expect(http.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
            if (status === "CANCELLED")
                fireEvent.change(within(dialog).getByLabelText(/Justificativa/), {
                    target: { value: "Motivo fictício" },
                });
            fireEvent.click(within(dialog).getByRole("button", { name: confirm }));
            expect(await screen.findByText(`Desfecho registrado: ${selo}.`)).toBeInTheDocument();
            const tabela = await lista();
            expect(await within(tabela).findByText(selo)).toBeInTheDocument();
            expect(
                within(tabela).queryByRole("button", { name: /^(Realizada|Ausente|Cancelar):/ })
            ).not.toBeInTheDocument();
            if (status === "CANCELLED")
                expect(
                    within(tabela).getByText("Justificativa: Motivo fictício")
                ).toBeInTheDocument();
            expect(
                http.mock.calls.filter(([url]) => url === "/api/studies/10/visits")
            ).toHaveLength(1);
            expect(http.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
            const envio = http.mock.calls.find(([, init]) => init?.method === "POST")!;
            expect(new Headers(envio[1]?.headers).get("If-Match")).toBe('"3"');
        }
    );

    it("RF13-P02: conflito 409 consulta a visita atual e remove as ações quando já finalizada", async () => {
        const http = simularHttp({
            ...rotas(),
            [`POST ${outcomePath}`]: respostaHttp(
                {
                    code: "VISIT_OUTCOME_FINAL",
                    message: "Outro coordenador já finalizou esta visita.",
                },
                409
            ),
            [`GET ${visitPath}`]: respostaHttp({ ...visitaAgendada, status: "ABSENT", version: 1 }),
            "GET /api/studies/10": respostaHttp(estudoAgendamento),
        });
        renderFluxo(<VisitasPage />);
        const dialog = await abrirDesfecho("Realizada");
        fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar realizada" }));
        expect(await within(dialog).findByRole("alert")).toHaveTextContent(
            "Outro coordenador já finalizou esta visita."
        );
        expect(
            await within(dialog).findByText(/Esta visita já foi finalizada/)
        ).toBeInTheDocument();
        expect(within(dialog).getByRole("button", { name: "Confirmar realizada" })).toBeDisabled();
        expect(http.mock.calls.filter(([url]) => url === visitPath)).toHaveLength(1);
        expect(http.mock.calls.filter(([url]) => url === "/api/studies/10")).toHaveLength(1);
        expect(http.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
        fireEvent.click(within(dialog).getByRole("button", { name: "Voltar" }));
        const tabela = await lista();
        expect(await within(tabela).findByText("Ausente")).toBeInTheDocument();
        expect(
            within(tabela).queryByRole("button", { name: /^(Realizada|Ausente|Cancelar):/ })
        ).not.toBeInTheDocument();
    });

    it("RF13-P03: filtros de situação e participante são enviados à API e mantidos após o desfecho", async () => {
        const http = simularHttp({
            ...rotas(),
            "GET /api/studies/10/visits?status=SCHEDULED": respostaHttp([visitaAgendada]),
            "GET /api/studies/10/visits?status=SCHEDULED&participantId=50": respostaHttp([
                visitaAgendada,
            ]),
            [`POST ${outcomePath}`]: respostaHttp({
                ...visitaAgendada,
                status: "DONE",
                version: 1,
            }),
        });
        renderFluxo(<VisitasPage />);
        await lista();
        fireEvent.change(screen.getByLabelText("Situação"), { target: { value: "SCHEDULED" } });
        await lista();
        await screen.findByRole("option", { name: participanteAgendamento.candidateName });
        fireEvent.change(screen.getByLabelText("Participante"), { target: { value: "50" } });
        const dialog = await abrirDesfecho("Realizada");
        fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar realizada" }));
        expect(
            await screen.findByText("Nenhuma visita encontrada para os filtros selecionados.")
        ).toBeInTheDocument();
        await waitFor(() => expect(screen.getByLabelText("Situação")).toHaveValue("SCHEDULED"));
        expect(screen.getByLabelText("Participante")).toHaveValue("50");
        expect(
            http.mock.calls.some(
                ([url]) => url === "/api/studies/10/visits?status=SCHEDULED&participantId=50"
            )
        ).toBe(true);
    });

    it.each(["CLOSED", "CANCELLED"] as const)(
        "RF13-P04: estudo %s mantém consulta sem ações de desfecho",
        async (status) => {
            simularHttp({
                ...rotas(),
                "GET /api/studies": respostaHttp([{ ...estudoAgendamento, status }]),
            });
            renderFluxo(<VisitasPage />);
            expect(
                within(await lista()).queryByRole("button", {
                    name: /^(Realizada|Ausente|Cancelar):/,
                })
            ).not.toBeInTheDocument();
            expect(screen.getByText(/Estudo em consulta:/)).toBeInTheDocument();
        }
    );

    it("RF13-P05: pesquisador consulta visitas sem ações de desfecho", async () => {
        simularHttp(rotas());
        renderFluxo(<VisitasPage />, "RESEARCHER");
        expect(
            within(await lista()).queryByRole("button", { name: /^(Realizada|Ausente|Cancelar):/ })
        ).not.toBeInTheDocument();
    });

    it("RF13-P06: erro na listagem é literal e pode ser recuperado", async () => {
        const http = simularHttp({
            ...rotas(),
            "GET /api/studies/10/visits": [
                respostaHttp({ message: "Agenda indisponível para este estudo." }, 503),
                respostaHttp([visitaAgendada]),
            ],
        });
        renderFluxo(<VisitasPage />);
        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Agenda indisponível para este estudo."
        );
        fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
        expect(
            await within(await lista()).findByText(visitaAgendada.plannedVisitName)
        ).toBeInTheDocument();
        expect(http.mock.calls.filter(([url]) => url === "/api/studies/10/visits")).toHaveLength(2);
    });

    it.each([
        ["RESEARCHER", "Registrar resultados"],
        ["COORDINATOR", "Ver resultados"],
    ] as const)("RF14-P01: %s recebe a ação de resultados adequada", async (role, action) => {
        simularHttp({
            ...rotas(),
            "GET /api/studies/10/visits": respostaHttp([{ ...visitaAgendada, status: "DONE" }]),
        });
        renderFluxo(<VisitasPage />, role);
        expect(
            await within(await lista()).findByRole("button", { name: new RegExp(`^${action}:`) })
        ).toBeInTheDocument();
    });
});
