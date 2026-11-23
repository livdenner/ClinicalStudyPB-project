import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecrutamentoPage } from "../../pages/recrutamento/recrutamento";
import { respostaHttp, simularHttp, estudoAgendamento } from "../../test/fixtures/agendamento";
import { candidatoFluxo, renderFluxo } from "../../test/fixtures/fluxos-web";

afterEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
    vi.restoreAllMocks();
});

/** Suíte legada recuperada e adaptada: decisão somente no app, sem formulário Web. @author Lívia */
describe("RF10 — ConsentimentoSimulado adaptado ao andamento da API (T17.8)", () => {
    it.each([
        ["CONSENT_PENDING", "PENDING", "Aguardando decisão"],
        ["GRANTED", "GRANTED", "Aceitou"],
        ["DECLINED", "DECLINED", "Recusou"],
    ] as const)(
        "RF10-CS01: decisão %s é consultada sem ação de registrar ou reverter consentimento",
        async (status, consentStatus, label) => {
            const http = simularHttp({
                "GET /api/studies": respostaHttp([estudoAgendamento]),
                "GET /api/studies/10/candidates": respostaHttp([
                    { ...candidatoFluxo, status, consentStatus },
                ]),
                "GET /api/studies/10/participants": respostaHttp([]),
            });
            renderFluxo(<RecrutamentoPage />);
            const lista = await screen.findByRole("list", { name: "Lista de candidatos" });
            expect(within(lista).getByText(label)).toBeInTheDocument();
            expect(
                screen.queryByRole("button", {
                    name: /consentimento|reverter|registrar aceite|registrar recusa/i,
                })
            ).not.toBeInTheDocument();
            if (status === "DECLINED")
                expect(within(lista).getByText("Decisão final do candidato.")).toBeInTheDocument();
            if (status !== "GRANTED")
                expect(
                    within(lista).queryByRole("button", { name: /Incluir participante:/ })
                ).not.toBeInTheDocument();
            expect(
                http.mock.calls.every(([, init]) => !init?.method || init.method === "GET")
            ).toBe(true);
            expect(http.mock.calls.some(([url]) => String(url).includes("/consent"))).toBe(false);
        }
    );

    it("RF10-CS02: atualizar consulta aceite registrado no app e então libera inclusão", async () => {
        const http = simularHttp({
            "GET /api/studies": respostaHttp([estudoAgendamento]),
            "GET /api/studies/10/candidates": [
                respostaHttp([candidatoFluxo]),
                respostaHttp([{ ...candidatoFluxo, status: "GRANTED", consentStatus: "GRANTED" }]),
            ],
            "GET /api/studies/10/participants": respostaHttp([]),
        });
        renderFluxo(<RecrutamentoPage />);
        const lista = await screen.findByRole("list", { name: "Lista de candidatos" });
        expect(within(lista).getByText("Aguardando decisão")).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: /Incluir participante:/ })
        ).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Atualizar lista" }));
        await waitFor(() =>
            expect(
                screen.getByRole("button", { name: `Incluir participante: ${candidatoFluxo.name}` })
            ).toBeEnabled()
        );
        expect(
            http.mock.calls.filter(([url]) => url === "/api/studies/10/candidates")
        ).toHaveLength(2);
        expect(http.mock.calls.some(([url]) => String(url).includes("/consent"))).toBe(false);
    });

    it("RF10-CS03: pesquisador consulta a decisão final sem controles de escrita", async () => {
        simularHttp({
            "GET /api/studies": respostaHttp([estudoAgendamento]),
            "GET /api/studies/10/candidates": respostaHttp([
                { ...candidatoFluxo, status: "DECLINED", consentStatus: "DECLINED" },
            ]),
            "GET /api/studies/10/participants": respostaHttp([]),
        });
        renderFluxo(<RecrutamentoPage />, "RESEARCHER");
        const lista = await screen.findByRole("list", { name: "Lista de candidatos" });
        expect(within(lista).getByText("Recusou")).toBeInTheDocument();
        expect(within(lista).queryByRole("button")).not.toBeInTheDocument();
    });
});
