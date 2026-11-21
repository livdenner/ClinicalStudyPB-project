import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { UserRole } from "../../types/auth";
import type { EstudoComStatusApi } from "../../types/candidato";
import {
    caminhoAgenda,
    dataHoraFormulario,
    estudoAgendamento,
    participanteAgendamento,
    preencherAgendamento,
    respostaHttp,
    rotasAgenda,
    simularHttp,
    visitaAgendada,
} from "../../test/fixtures/agendamento";
import { VisitasParticipante } from "./VisitasParticipante";

function renderAgenda({
    estudo = estudoAgendamento,
    participante = participanteAgendamento,
    role = "COORDINATOR" as UserRole,
    abrirAgendamento = false,
} = {}) {
    const onVoltar = vi.fn();
    render(
        <VisitasParticipante
            estudo={estudo}
            participante={participante}
            token="token-ficticio"
            role={role}
            abrirAgendamento={abrirAgendamento}
            onVoltar={onVoltar}
        />
    );
    return { onVoltar };
}

async function abrirFormulario() {
    const botao = screen.getByRole("button", { name: "Agendar visita" });
    await waitFor(() => expect(botao).toBeEnabled());
    fireEvent.click(botao);
    return screen.findByRole("dialog", { name: "Agendar visita" });
}

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

/** Regras de interação da agenda RF12 com o cliente HTTP real e fetch simulado. @author Lívia */
describe("RF12 — agenda por participante (T18.5)", () => {
    it("RF12-AP01: envio válido usa POST do estudo e participante corretos com JSON e token", async () => {
        const fetchMock = simularHttp({
            ...rotasAgenda(),
            [`POST ${caminhoAgenda}`]: respostaHttp(visitaAgendada, 201),
        });
        renderAgenda();
        const dialog = await abrirFormulario();
        await preencherAgendamento(dialog);
        fireEvent.click(within(dialog).getByRole("button", { name: "Agendar visita" }));
        await screen.findByText("Visita Avaliação fictícia agendada com sucesso.");
        const chamadas = fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
        expect(chamadas).toHaveLength(1);
        const [url, init] = chamadas[0];
        expect(url).toBe(caminhoAgenda);
        expect(JSON.parse(String(init?.body))).toEqual({
            plannedVisitId: 7,
            scheduledAt: "2027-02-10T12:00:00.000Z",
        });
        expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer token-ficticio");
    });

    it("RF12-AP02: criação aparece na lista existente em ordem cronológica sem nova consulta", async () => {
        const existente = {
            ...visitaAgendada,
            id: 90,
            plannedVisitId: 8,
            plannedVisitName: "Retorno fictício",
            scheduledAt: "2027-03-10T12:00:00.000Z",
        };
        const fetchMock = simularHttp({
            ...rotasAgenda([existente]),
            [`POST ${caminhoAgenda}`]: respostaHttp(visitaAgendada, 201),
        });
        renderAgenda();
        await screen.findByText("Retorno fictício");
        const dialog = await abrirFormulario();
        await preencherAgendamento(dialog);
        fireEvent.click(within(dialog).getByRole("button", { name: "Agendar visita" }));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        const tabela = await screen.findByRole("grid", {
            name: "Visitas agendadas do participante",
        });
        await within(tabela).findByText(visitaAgendada.plannedVisitName);
        const linhas = within(tabela).getAllByRole("row");
        expect(linhas[1]).toHaveTextContent("Avaliação fictícia");
        expect(linhas[2]).toHaveTextContent("Retorno fictício");
        expect(screen.getByText("Exibindo 2 de 2 visitas.")).toBeInTheDocument();
        expect(
            fetchMock.mock.calls.filter(([url, init]) => url === caminhoAgenda && !init?.method)
        ).toHaveLength(1);
    });

    it("RF12-AP03: filtro de situação apresenta somente os agendamentos correspondentes", async () => {
        simularHttp(
            rotasAgenda([
                visitaAgendada,
                {
                    ...visitaAgendada,
                    id: 81,
                    plannedVisitId: 8,
                    plannedVisitName: "Visita realizada fictícia",
                    status: "DONE",
                },
            ])
        );
        renderAgenda();
        await screen.findByText(visitaAgendada.plannedVisitName);
        fireEvent.change(screen.getByLabelText("Filtrar por situação"), {
            target: { value: "DONE" },
        });
        expect(screen.getByText("Visita realizada fictícia")).toBeInTheDocument();
        expect(screen.queryByText(visitaAgendada.plannedVisitName)).not.toBeInTheDocument();
        expect(screen.getByText("Exibindo 1 de 2 visitas.")).toBeInTheDocument();
    });

    it("RF12-AP04: novo agendamento fica visível mesmo se havia outro filtro selecionado", async () => {
        simularHttp({
            ...rotasAgenda(),
            [`POST ${caminhoAgenda}`]: respostaHttp(visitaAgendada, 201),
        });
        renderAgenda();
        await screen.findByText("Exibindo 0 de 0 visitas.");
        fireEvent.change(screen.getByLabelText("Filtrar por situação"), {
            target: { value: "DONE" },
        });
        const dialog = await abrirFormulario();
        await preencherAgendamento(dialog);
        fireEvent.click(within(dialog).getByRole("button", { name: "Agendar visita" }));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        const tabela = await screen.findByRole("grid", {
            name: "Visitas agendadas do participante",
        });
        expect(
            await within(tabela).findByText(visitaAgendada.plannedVisitName)
        ).toBeInTheDocument();
        expect(screen.getByLabelText("Filtrar por situação")).toHaveValue("ALL");
    });

    it.each([
        {
            status: 409,
            code: "VISIT_ALREADY_SCHEDULED",
            message: "O participante já possui essa visita agendada ou realizada.",
            data: dataHoraFormulario,
        },
        {
            status: 400,
            code: "VISIT_DATE_NOT_FUTURE",
            message: "A data da visita deve ser futura.",
            data: "2020-01-01T09:00",
        },
    ])(
        "RF12-AP05: $code mantém mensagem literal, formulário e campos sem inserir registro",
        async ({ status, code, message, data }) => {
            simularHttp({
                ...rotasAgenda(),
                [`POST ${caminhoAgenda}`]: respostaHttp({ code, message }, status),
            });
            renderAgenda();
            const dialog = await abrirFormulario();
            await preencherAgendamento(dialog, data);
            fireEvent.click(within(dialog).getByRole("button", { name: "Agendar visita" }));
            expect((await within(dialog).findByRole("alert")).textContent).toBe(message);
            expect(within(dialog).getByLabelText(/Visita prevista/)).toHaveValue("7");
            expect(within(dialog).getByLabelText(/Data e hora/)).toHaveValue(data);
            expect(dialog).toBeInTheDocument();
            expect(screen.getByText("Exibindo 0 de 0 visitas.")).toBeInTheDocument();
            expect(screen.queryByRole("grid")).not.toBeInTheDocument();
        }
    );

    it("RF12-AP06: participante retirado permite consulta sem ação ou formulário de agendamento", async () => {
        const fetchMock = simularHttp(rotasAgenda([visitaAgendada]));
        renderAgenda({
            participante: { ...participanteAgendamento, status: "WITHDRAWN" },
            abrirAgendamento: true,
        });
        await screen.findByText(visitaAgendada.plannedVisitName);
        expect(screen.getByRole("note")).toHaveTextContent("Participante retirado.");
        expect(screen.queryByRole("button", { name: "Agendar visita" })).not.toBeInTheDocument();
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
    });

    it("RF12-AP07: pesquisador consulta a agenda sem ação de criar agendamento", async () => {
        simularHttp(rotasAgenda([visitaAgendada]));
        renderAgenda({ role: "RESEARCHER", abrirAgendamento: true });
        await screen.findByText(visitaAgendada.plannedVisitName);
        expect(screen.queryByRole("button", { name: "Agendar visita" })).not.toBeInTheDocument();
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it.each<EstudoComStatusApi["status"]>(["PLANNING", "CLOSED", "CANCELLED"])(
        "RF12-AP08: estudo %s não oferece agendamento",
        async (status) => {
            simularHttp(rotasAgenda());
            renderAgenda({ estudo: { ...estudoAgendamento, status } });
            await screen.findByText("Exibindo 0 de 0 visitas.");
            expect(
                screen.queryByRole("button", { name: "Agendar visita" })
            ).not.toBeInTheDocument();
            expect(screen.getByRole("note")).toHaveTextContent(
                "somente durante o recrutamento ou a execução"
            );
        }
    );

    it("RF12-AP09: estudo em execução também oferece agendamento ao coordenador", async () => {
        simularHttp(rotasAgenda());
        renderAgenda({ estudo: { ...estudoAgendamento, status: "EXECUTION" } });
        await waitFor(() =>
            expect(screen.getByRole("button", { name: "Agendar visita" })).toBeEnabled()
        );
    });

    it("RF12-AP10: erro da consulta é exibido literalmente e a lista pode ser consultada de novo", async () => {
        simularHttp({
            ...rotasAgenda(),
            [`GET ${caminhoAgenda}`]: [
                respostaHttp({ message: "Consulta recusada pelo serviço." }, 409),
                respostaHttp([visitaAgendada]),
            ],
        });
        renderAgenda();
        expect((await screen.findByRole("alert")).textContent).toBe(
            "Consulta recusada pelo serviço."
        );
        expect(screen.getByRole("button", { name: "Agendar visita" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
        expect(await screen.findByText(visitaAgendada.plannedVisitName)).toBeInTheDocument();
    });

    it("RF12-AP11: atualizar visitas reflete a situação nova recebida pela API", async () => {
        const fetchMock = simularHttp({
            ...rotasAgenda(),
            [`GET ${caminhoAgenda}`]: [
                respostaHttp([visitaAgendada]),
                respostaHttp([{ ...visitaAgendada, status: "DONE" }]),
            ],
        });
        renderAgenda();
        await screen.findByText(visitaAgendada.plannedVisitName);
        fireEvent.click(screen.getByRole("button", { name: "Atualizar visitas" }));
        const tabela = await screen.findByRole("grid");
        await waitFor(() => expect(within(tabela).getByText("Realizada")).toBeInTheDocument());
        expect(fetchMock.mock.calls.filter(([url]) => url === caminhoAgenda)).toHaveLength(2);
    });

    it("RF12-AP12: durante o carregamento não é possível iniciar agendamento", async () => {
        let concluir!: (resposta: Response) => void;
        const pendente = new Promise<Response>((resolve) => {
            concluir = resolve;
        });
        simularHttp({ [`GET ${caminhoAgenda}`]: pendente });
        renderAgenda();
        expect(screen.getByText("Carregando agendamentos...")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Agendar visita" })).toBeDisabled();
        await act(async () => concluir(respostaHttp([])));
    });

    it("RF12-AP13: voltar retorna ao painel de participantes", async () => {
        simularHttp(rotasAgenda());
        const { onVoltar } = renderAgenda();
        await screen.findByText("Exibindo 0 de 0 visitas.");
        fireEvent.click(screen.getByRole("button", { name: "Voltar para participantes" }));
        expect(onVoltar).toHaveBeenCalledOnce();
    });
});
