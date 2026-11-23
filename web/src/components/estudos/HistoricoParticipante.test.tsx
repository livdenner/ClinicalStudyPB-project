import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { HistoricoParticipante } from "./HistoricoParticipante";

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

const participant = { id: 1, studyId: 3, candidateName: "Ana Silva", status: "ACTIVE" };
const resposta = (dados: unknown, status = 200) => new Response(JSON.stringify(dados), { status });
const abrir = () =>
    render(
        <HistoricoParticipante
            estudoId={3}
            participanteId={1}
            token="token-teste"
            onVoltar={vi.fn()}
        />
    );

it("exibe visita realizada, resultados e retirada recebidos da T21.1", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        resposta({
            participant: {
                ...participant,
                status: "WITHDRAWN",
                withdrawal: {
                    reason: "Solicitação do participante",
                    withdrawnAt: "2026-11-20T12:00:00Z",
                    cancelledVisitCount: 2,
                },
            },
            visits: [
                {
                    id: 8,
                    plannedVisitName: "Visita inicial",
                    scheduledAt: "2026-11-18T12:00:00Z",
                    status: "DONE",
                    outcomeAt: "2026-11-18T13:00:00Z",
                    outcomeNote: "Visita concluída",
                    results: [
                        {
                            activityId: 4,
                            value: "120/80",
                            note: "Em repouso",
                            recordedAt: "2026-11-18T13:00:00Z",
                        },
                    ],
                },
            ],
        })
    );
    abrir();
    expect(await screen.findByText("Visita inicial")).toBeInTheDocument();
    expect(screen.getByText("Realizada")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Ver detalhes e resultados"));
    expect(screen.getByText("120/80")).toBeVisible();
    expect(screen.getByText("Em repouso")).toBeVisible();
    fireEvent.click(screen.getByText("Ver detalhes da retirada"));
    expect(screen.getByText("Motivo: Solicitação do participante")).toBeVisible();
    expect(screen.getByText("Visitas canceladas: 2")).toBeVisible();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/studies/3/participants/1/history");
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("Authorization")).toBe(
        "Bearer token-teste"
    );
});

it("permite tentar novamente após erro e orienta sobre histórico vazio", async () => {
    const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(resposta({ detail: "Serviço indisponível." }, 500))
        .mockResolvedValueOnce(resposta({ participant, visits: [] }));
    abrir();
    expect(await screen.findByRole("alert")).toHaveTextContent("Serviço indisponível.");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Nenhuma visita no histórico")).toBeInTheDocument();
    expect(screen.getByText(/As visitas aparecerão aqui após o agendamento/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("cancela a consulta ao sair do histórico", () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise(() => {}));
    const { unmount } = abrir();
    const signal = fetchMock.mock.calls[0][1]?.signal;
    unmount();
    expect(signal?.aborted).toBe(true);
});
