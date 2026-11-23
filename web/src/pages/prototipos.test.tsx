import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../context/AuthContext";
import { PrototipoBadge, PrototiposProvider } from "../context/PrototiposContext";
import { VisaoGeralPage } from "./dashboard/visao-geral";
import { RelatoriosPage } from "./relatorios/relatorios";
import { VisitasPage } from "./visitas/visitas";
import { AUTH_STORAGE_KEY } from "../services/auth";
import {
    estudoAgendamento,
    participanteAgendamento,
    respostaHttp,
    simularHttp,
    visitaAgendada,
} from "../test/fixtures/agendamento";

function renderWithProviders(ui: React.ReactNode) {
    return render(
        <AuthProvider>
            <PrototiposProvider>
                <MemoryRouter>{ui}</MemoryRouter>
            </PrototiposProvider>
        </AuthProvider>
    );
}

afterEach(() => {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
});

describe("Visão geral e relatórios de demonstração; visitas integradas (T7.2 / RF13)", () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
    });

    it("renderiza a página de Visão geral com indicadores, progresso dos estudos e pendências", () => {
        renderWithProviders(<VisaoGeralPage />);

        expect(
            screen.getByRole("heading", { name: "Visão geral (Protótipo)" })
        ).toBeInTheDocument();
        expect(screen.getByText("Progresso dos estudos")).toBeInTheDocument();
        expect(screen.getByText("2 avaliações de elegibilidade")).toBeInTheDocument();
        expect(screen.getByText("Atividades recentes")).toBeInTheDocument();
    });

    it("RF13: consulta visitas reais e confirma desfecho usando a versão da visita", async () => {
        sessionStorage.setItem(
            AUTH_STORAGE_KEY,
            JSON.stringify({
                accessToken: "token-coordenador-ficticio",
                tokenType: "Bearer",
                expiresAt: Date.now() + 3600000,
                user: {
                    id: 9,
                    name: "Coordenadora de demonstração",
                    email: "coordenadora@example.test",
                    role: "COORDINATOR",
                    active: true,
                },
            })
        );
        const fetchMock = simularHttp({
            "GET /api/studies": respostaHttp([estudoAgendamento]),
            "GET /api/studies/10/participants": respostaHttp([participanteAgendamento]),
            "GET /api/studies/10/visits": respostaHttp([visitaAgendada]),
            "POST /api/studies/10/participants/50/visits/80/outcome": respostaHttp({
                ...visitaAgendada,
                status: "DONE",
                version: 1,
                outcomeByUserId: 9,
                outcomeAt: "2027-02-10T13:00:00Z",
            }),
        });
        renderWithProviders(<VisitasPage />);

        expect(screen.getByRole("heading", { name: "Visitas agendadas" })).toBeInTheDocument();
        const tabela = await screen.findByRole("grid", { name: "Visitas agendadas do estudo" });
        const realizada = await within(tabela).findByRole("button", { name: /^Realizada:/ });
        fireEvent.click(realizada);
        const dialog = await screen.findByRole("dialog", { name: "Confirmar visita realizada" });
        fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar realizada" }));
        expect(await screen.findByText("Desfecho registrado: Realizada.")).toBeInTheDocument();
        const atualizada = await screen.findByRole("grid", { name: "Visitas agendadas do estudo" });
        expect(await within(atualizada).findByText("Realizada")).toBeInTheDocument();
        expect(
            within(atualizada).queryByRole("button", { name: /^(Realizada|Ausente|Cancelar):/ })
        ).not.toBeInTheDocument();
        expect(
            await within(atualizada).findByRole("button", { name: /^Ver resultados:/ })
        ).toBeInTheDocument();
        const chamadas = fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
        expect(chamadas).toHaveLength(1);
        expect(new Headers(chamadas[0][1]?.headers).get("If-Match")).toBe('"0"');
        expect(JSON.parse(String(chamadas[0][1]?.body))).toEqual({ outcome: "DONE" });
        expect(
            fetchMock.mock.calls.filter(([url]) => url === "/api/studies/10/visits")
        ).toHaveLength(1);
    });

    it("renderiza indicadores, funil de recrutamento e resumo por estudo em Relatórios", () => {
        renderWithProviders(<RelatoriosPage />);

        expect(screen.getByRole("heading", { name: "Relatórios (Protótipo)" })).toBeInTheDocument();
        expect(screen.getByText("Funil de recrutamento")).toBeInTheDocument();
        expect(screen.getByText("Situação das visitas")).toBeInTheDocument();
        expect(screen.getByText("Resumo por estudo")).toBeInTheDocument();
    });
});

it("T24.2: acompanhamento concluído usa a cor de sucesso", () => {
    render(<PrototipoBadge>Acompanhamento concluído</PrototipoBadge>);
    expect(screen.getByText("Acompanhamento concluído")).toHaveClass(
        "bg-[var(--color-success-soft)]",
        "text-[var(--color-success)]"
    );
});
