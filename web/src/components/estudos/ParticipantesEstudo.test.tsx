import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ParticipantesEstudo } from "./ParticipantesEstudo";

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});
const resposta = (dados: unknown, status = 200) => new Response(JSON.stringify(dados), { status });
const estudo = { id: 3, title: "Estudo do sono", status: "RECRUITMENT" } as const;
const contextoConsulta = {
    estudo,
    token: "token-teste",
    perfil: "RESEARCHER",
} as const;

it("não envia retirada sem motivo para a API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        resposta([
            {
                id: 7,
                studyId: 3,
                candidateId: 11,
                candidateName: "Ana Silva",
                includedAt: "2026-11-09T12:00:00Z",
                status: "ACTIVE",
            },
        ])
    );
    render(<ParticipantesEstudo {...contextoConsulta} perfil="COORDINATOR" />);
    fireEvent.click(await screen.findByRole("button", { name: "Registrar retirada: Ana Silva" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar retirada" }));

    expect(
        await screen.findByText("Informe o motivo da retirada com 1 a 500 caracteres.")
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/studies/3/participants");
    expect(screen.getByText("Ativo")).toBeInTheDocument();
});

it("fecha a confirmação sem alterar o participante ao voltar", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        resposta([
            {
                id: 7,
                studyId: 3,
                candidateId: 11,
                candidateName: "Ana Silva",
                includedAt: "2026-11-09T12:00:00Z",
                status: "ACTIVE",
            },
        ])
    );
    render(<ParticipantesEstudo {...contextoConsulta} perfil="COORDINATOR" />);
    fireEvent.click(await screen.findByRole("button", { name: "Registrar retirada: Ana Silva" }));
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText("Ativo")).toBeInTheDocument();
    expect(
        screen.getByRole("button", { name: "Registrar retirada: Ana Silva" })
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledOnce();
});

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
    render(<ParticipantesEstudo {...contextoConsulta} />);
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
    render(<ParticipantesEstudo {...contextoConsulta} />);
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
    render(<ParticipantesEstudo {...contextoConsulta} />);
    expect(await screen.findByText("Nenhum participante incluído")).toBeInTheDocument();
    expect(screen.queryByRole("grid", { name: "Participantes do estudo" })).not.toBeInTheDocument();
});

it("recupera uma consulta após erro usando Tentar novamente", async () => {
    const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(resposta({ detail: "Serviço indisponível." }, 500))
        .mockResolvedValueOnce(resposta([]));
    render(<ParticipantesEstudo {...contextoConsulta} />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Nenhum participante incluído")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("cancela a consulta ao sair do estudo", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise(() => {}));
    const { unmount } = render(<ParticipantesEstudo {...contextoConsulta} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const signal = fetchMock.mock.calls[0][1]?.signal;
    unmount();
    expect(signal?.aborted).toBe(true);
});

it("registra a retirada no estudo, atualiza o selo e remove a ação sem consultar a lista novamente", async () => {
    const participante = {
        id: 7,
        studyId: 3,
        candidateId: 11,
        candidateName: "Ana Silva",
        includedAt: "2026-11-09T12:00:00Z",
        status: "ACTIVE",
    };
    const retirado = {
        ...participante,
        status: "WITHDRAWN",
        withdrawal: {
            reason: "Mudou de cidade",
            withdrawnAt: "2026-11-19T12:00:00Z",
            withdrawnByUserId: 9,
            cancelledVisitCount: 2,
        },
    };
    const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockImplementation(async (input, init) =>
            resposta(
                String(input).endsWith("/history")
                    ? { participant: retirado, visits: [] }
                    : init?.method === "POST"
                      ? retirado
                      : [participante]
            )
        );
    render(
        <ParticipantesEstudo
            token="jwt"

            estudo={{ ...estudo, status: "EXECUTION" }}
            perfil="COORDINATOR"
        />
    );
    expect(
        await screen.findByRole("button", { name: "Ver histórico: Ana Silva" })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Registrar retirada: Ana Silva" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Motivo da retirada" }), {
        target: { value: "Mudou de cidade" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar retirada" }));
    expect(await screen.findByText("Retirado")).toBeInTheDocument();
    expect(
        screen.queryByRole("button", { name: "Registrar retirada: Ana Silva" })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/studies/3/participants/7/withdrawal");
    expect(screen.getByRole("status")).toHaveTextContent("Retirada registrada com sucesso.");
    fireEvent.click(screen.getByRole("button", { name: "Ver histórico: Ana Silva" }));
    expect(
        await screen.findByRole("heading", { name: "Retirada do participante" })
    ).toBeInTheDocument();
    expect(fetchMock.mock.calls[2][0]).toBe("/api/studies/3/participants/7/history");
});

it.each(["CLOSED", "CANCELLED"] as const)("não oferece retirada em estudo %s", async (estado) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
        resposta([
            {
                id: 7,
                studyId: 3,
                candidateId: 11,
                candidateName: "Ana Silva",
                includedAt: "2026-11-09T12:00:00Z",
                status: "ACTIVE",
            },
        ])
    );
    render(
        <ParticipantesEstudo
            token="jwt"

            estudo={{ ...estudo, status: estado }}
            perfil="COORDINATOR"
        />
    );
    await screen.findByRole("grid", { name: "Participantes do estudo" });
    expect(screen.queryByRole("button", { name: /Registrar retirada:/ })).not.toBeInTheDocument();
});

it.each(["RESEARCHER", "ADMINISTRATOR", "PARTICIPANT"] as const)(
    "não oferece retirada ao perfil %s",
    async (perfil) => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            resposta([
                {
                    id: 7,
                    studyId: 3,
                    candidateId: 11,
                    candidateName: "Ana Silva",
                    includedAt: "2026-11-09T12:00:00Z",
                    status: "ACTIVE",
                },
            ])
        );
        render(
            <ParticipantesEstudo
                token="jwt"

                estudo={estudo}
                perfil={perfil}
            />
        );
        await screen.findByRole("grid", { name: "Participantes do estudo" });
        expect(
            screen.queryByRole("button", { name: /Registrar retirada:/ })
        ).not.toBeInTheDocument();
    }
);

it.each(["PLANNING", "RECRUITMENT", "EXECUTION"] as const)(
    "oferece retirada só ao participante ativo no estado %s",
    async (estado) => {
        const participante = {
            id: 7,
            studyId: 3,
            candidateId: 11,
            candidateName: "Ana Silva",
            includedAt: "2026-11-09T12:00:00Z",
            status: "ACTIVE",
        };
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            resposta([
                participante,
                {
                    ...participante,
                    id: 8,
                    candidateId: 12,
                    candidateName: "Bruno Costa",
                    status: "WITHDRAWN",
                },
            ])
        );
        render(
            <ParticipantesEstudo
                token="jwt"

                estudo={{ ...estudo, status: estado }}
                perfil="COORDINATOR"
            />
        );
        expect(
            await screen.findByRole("button", { name: "Registrar retirada: Ana Silva" })
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: "Registrar retirada: Bruno Costa" })
        ).not.toBeInTheDocument();
    }
);
