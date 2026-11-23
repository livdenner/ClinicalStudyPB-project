import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { HistoricoParticipanteApi } from "../../types/historico-participante";
import {
    participanteAgendamento,
    respostaHttp,
    visitaAgendada,
} from "../../test/fixtures/agendamento";
import { HistoricoParticipante } from "./HistoricoParticipante";

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

// A T21.1 agora é mostra as visitas em ordem cronológica. Não são masi os IDs que definem a ordem
function historicoCompleto(): HistoricoParticipanteApi {
    return {
        participant: { ...participanteAgendamento },
        visits: [
            {
                ...visitaAgendada,
                id: 90,
                plannedVisitName: "Avaliação inicial fictícia",
                scheduledAt: "2027-02-10T12:00:00Z",
                status: "DONE",
                outcomeByUserId: 9,
                outcomeAt: "2027-02-10T13:00:00Z",
                outcomeNote: "Visita concluída conforme o protocolo fictício.",
                results: [
                    {
                        visitId: 90,
                        activityId: 4,
                        value: "120/80 fictício",
                        note: "Em repouso, dado de demonstração.",
                        recordedByUserId: 2,
                        recordedAt: "2027-02-10T13:10:00Z",
                    },
                    {
                        visitId: 90,
                        activityId: 5,
                        value: "Orientação fictícia concluída",
                        recordedByUserId: 2,
                        recordedAt: "2027-02-10T13:15:00Z",
                    },
                ],
            },
            {
                ...visitaAgendada,
                id: 12,
                plannedVisitName: "Retorno fictício",
                scheduledAt: "2027-03-10T12:00:00Z",
                status: "ABSENT",
                outcomeByUserId: 9,
                outcomeAt: "2027-03-10T13:00:00Z",
                results: [],
            },
            {
                ...visitaAgendada,
                id: 8,
                plannedVisitName: "Visita cancelada fictícia",
                scheduledAt: "2027-04-10T12:00:00Z",
                status: "CANCELLED",
                outcomeByUserId: 9,
                outcomeAt: "2027-04-09T12:00:00Z",
                outcomeNote: "Cancelamento fictício a pedido do participante.",
                results: [],
            },
            {
                ...visitaAgendada,
                id: 45,
                plannedVisitName: "Acompanhamento fictício",
                scheduledAt: "2027-05-10T12:00:00Z",
                results: [],
            },
        ],
    };
}

const caminhoHistorico = "/api/studies/10/participants/50/history";
function abrir(onVoltar = vi.fn()) {
    return render(
        <HistoricoParticipante
            estudoId={10}
            participanteId={50}
            token="token-ficticio"
            onVoltar={onVoltar}
        />
    );
}

it("renderiza histórico completo com visitas, datas, desfechos e resultados sob demanda", async () => {
    const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(respostaHttp(historicoCompleto()));
    abrir();
    expect(await screen.findByText(participanteAgendamento.candidateName)).toBeInTheDocument();
    const linha = screen.getByRole("list", { name: "Linha do tempo do participante" });
    const cards = within(linha).getAllByRole("article");
    expect(cards).toHaveLength(4);
    for (const rotulo of ["Realizada", "Ausente", "Cancelada", "Agendada"])
        expect(within(linha).getByText(rotulo)).toBeVisible();
    expect(within(cards[0]).getByText("10/02/2027, 09:00")).toBeVisible();
    expect(screen.getByText("120/80 fictício")).not.toBeVisible();
    fireEvent.click(within(cards[0]).getByText("Ver detalhes e resultados"));
    expect(screen.getByText("120/80 fictício")).toBeVisible();
    expect(screen.getByText("Em repouso, dado de demonstração.")).toBeVisible();
    expect(screen.getByText("Orientação fictícia concluída")).toBeVisible();
    expect(screen.getByText(/Visita concluída conforme o protocolo fictício/)).toBeVisible();
    fireEvent.click(within(cards[1]).getByText("Ver detalhes e resultados"));
    expect(
        within(cards[1]).getByText("Nenhum resultado registrado para esta visita.")
    ).toBeVisible();
    expect(screen.queryByText("Retirada do participante")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe(caminhoHistorico);
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("Authorization")).toBe(
        "Bearer token-ficticio"
    );
});

it("orienta quando o histórico está vazio", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
        respostaHttp({ participant: participanteAgendamento, visits: [] })
    );
    abrir();
    expect(
        await screen.findByRole("heading", { name: "Nenhuma visita no histórico" })
    ).toBeVisible();
    expect(screen.getByText(/As visitas aparecerão aqui após o agendamento/)).toBeVisible();
    expect(
        screen.queryByRole("heading", { name: "Retirada do participante" })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("exibe a mensagem de erro da API e a opção de tentar novamente", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
        respostaHttp({ detail: "Serviço fictício indisponível." }, 500)
    );
    abrir();
    expect(await screen.findByRole("alert")).toHaveTextContent("Serviço fictício indisponível.");
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeEnabled();
    expect(
        screen.queryByRole("list", { name: "Linha do tempo do participante" })
    ).not.toBeInTheDocument();
});

it("recupera o histórico ao tentar novamente após falha", async () => {
    const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(respostaHttp({ detail: "Falha temporária fictícia." }, 503))
        .mockResolvedValueOnce(respostaHttp(historicoCompleto()));
    abrir();
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
        await screen.findByRole("heading", { name: "Avaliação inicial fictícia" })
    ).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([caminhoHistorico, caminhoHistorico]);
});

it("preserva a ordem cronológica recebida da API, independentemente dos IDs", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(respostaHttp(historicoCompleto()));
    abrir();
    await screen.findByText(participanteAgendamento.candidateName);
    const linha = screen.getByRole("list", { name: "Linha do tempo do participante" });
    expect(
        within(linha)
            .getAllByRole("heading")
            .map((titulo) => titulo.textContent)
    ).toEqual([
        "Avaliação inicial fictícia",
        "Retorno fictício",
        "Visita cancelada fictícia",
        "Acompanhamento fictício",
    ]);
    expect(Array.from(linha.querySelectorAll("time")).map((data) => data.dateTime)).toEqual([
        "2027-02-10T12:00:00Z",
        "2027-03-10T12:00:00Z",
        "2027-04-10T12:00:00Z",
        "2027-05-10T12:00:00Z",
    ]);
});

it("apresenta a retirada como último evento mesmo com visita futura cancelada", async () => {
    const dados = historicoCompleto();
    dados.participant = {
        ...dados.participant,
        status: "WITHDRAWN",
        withdrawal: {
            reason: "Mudança de cidade fictícia",
            withdrawnAt: "2027-04-20T12:00:00Z",
            withdrawnByUserId: 9,
            cancelledVisitCount: 1,
        },
    };
    dados.visits[3] = {
        ...dados.visits[3],
        status: "CANCELLED",
        outcomeAt: "2027-04-20T12:00:00Z",
        outcomeByUserId: 9,
        outcomeNote: "Cancelada pela retirada.",
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(respostaHttp(dados));
    abrir();
    await screen.findByText("Retirada do participante");
    const eventos = within(
        screen.getByRole("list", { name: "Linha do tempo do participante" })
    ).getAllByRole("article");
    expect(eventos).toHaveLength(5);
    const retirada = eventos[eventos.length - 1];
    expect(
        within(retirada).getByRole("heading", { name: "Retirada do participante" })
    ).toBeVisible();
    expect(within(retirada).getByText("Retirado")).toBeVisible();
    expect(within(retirada).getByText("20/04/2027, 09:00")).toBeVisible();
    fireEvent.click(within(retirada).getByText("Ver detalhes da retirada"));
    expect(within(retirada).getByText("Motivo: Mudança de cidade fictícia")).toBeVisible();
    expect(within(retirada).getByText("Visitas canceladas: 1")).toBeVisible();
});

it("informa o carregamento e cancela a consulta ao sair do histórico", () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise(() => {}));
    const { unmount } = abrir();
    expect(screen.getByRole("status")).toHaveTextContent("Carregando histórico...");
    const signal = fetchMock.mock.calls[0][1]?.signal;
    unmount();
    expect(signal?.aborted).toBe(true);
});

it("permite voltar à lista pelo botão de navegação", () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise(() => {}));
    const onVoltar = vi.fn();
    abrir(onVoltar);
    fireEvent.click(screen.getByRole("button", { name: "Voltar para participantes" }));
    expect(onVoltar).toHaveBeenCalledOnce();
});
