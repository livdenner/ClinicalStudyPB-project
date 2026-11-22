import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ParticipantesEstudo } from "./ParticipantesEstudo";

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});
const resposta = (dados: unknown, status = 200) => new Response(JSON.stringify(dados), { status });

it("abre o histórico pela lista e retorna sem recarregar os participantes", async () => {
    const participante = {
        id: 1,
        studyId: 3,
        candidateId: 10,
        candidateName: "Ana Silva",
        includedAt: "2026-11-12T12:00:00Z",
        status: "ACTIVE",
    };
    const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(resposta([participante]))
        .mockResolvedValueOnce(resposta({ participant: participante, visits: [] }));
    render(<ParticipantesEstudo estudoId={3} token="token-teste" />);
    fireEvent.click(await screen.findByRole("button", { name: "Ver histórico: Ana Silva" }));
    expect(await screen.findByText("Nenhuma visita no histórico")).toBeInTheDocument();
    expect(fetchMock.mock.calls[1][0]).toBe("/api/studies/3/participants/1/history");
    fireEvent.click(screen.getByRole("button", { name: "Voltar para participantes" }));
    expect(
        await screen.findByRole("button", { name: "Ver histórico: Ana Silva" })
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("consulta apenas o estudo solicitado e diferencia participantes ativos e retirados", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        resposta([
            {
                id: 1,
                studyId: 3,
                candidateId: 10,
                candidateName: "Ana Silva",
                includedAt: "2026-11-12T12:00:00Z",
                status: "ACTIVE",
            },
            {
                id: 2,
                studyId: 3,
                candidateId: 11,
                candidateName: "Bruno Costa",
                includedAt: "2026-11-11T12:00:00Z",
                status: "WITHDRAWN",
            },
        ])
    );
    render(<ParticipantesEstudo estudoId={3} token="token-teste" />);
    expect(screen.getByRole("status")).toHaveTextContent("Carregando participantes");
    expect(
        await screen.findByRole("grid", { name: "Participantes do estudo" })
    ).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "Ana Silva" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Participantes do estudo" })).not.toBeInTheDocument();
    expect(screen.getByText("Bruno Costa")).toBeInTheDocument();
    expect(screen.getByText("Ativo")).toBeInTheDocument();
    expect(screen.getByText("Retirado")).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/studies/3/participants");
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("Authorization")).toBe(
        "Bearer token-teste"
    );
    expect(
        screen.queryByRole("button", { name: /Retirar participante|Incluir participante/ })
    ).not.toBeInTheDocument();
});

it("orienta quando o estudo não tem participantes", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(resposta([]));
    render(<ParticipantesEstudo estudoId={3} token="token-teste" />);
    expect(await screen.findByText("Nenhum participante incluído")).toBeInTheDocument();
    expect(screen.queryByRole("grid", { name: "Participantes do estudo" })).not.toBeInTheDocument();
});

it("recupera uma consulta após erro usando Tentar novamente", async () => {
    const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(resposta({ detail: "Serviço indisponível." }, 500))
        .mockResolvedValueOnce(resposta([]));
    render(<ParticipantesEstudo estudoId={3} token="token-teste" />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Nenhum participante incluído")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("cancela a consulta ao sair do estudo", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise(() => {}));
    const { unmount } = render(<ParticipantesEstudo estudoId={3} token="token-teste" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const signal = fetchMock.mock.calls[0][1]?.signal;
    unmount();
    expect(signal?.aborted).toBe(true);
});
