import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "../../services/api/apiClient";
import type { DadosAgendamentoVisita } from "../../types/visita-agendada";
import {
    caminhoPrevistas,
    dataHoraFormulario,
    estudoAgendamento,
    participanteAgendamento,
    preencherAgendamento,
    respostaHttp,
    simularHttp,
    visitaPrevistaAgendamento,
} from "../../test/fixtures/agendamento";
import { ModalAgendarVisita } from "./ModalAgendarVisita";

function renderModal({
    podeAgendar = true,
    onSalvar = vi
        .fn<(dados: DadosAgendamentoVisita) => Promise<void>>()
        .mockResolvedValue(undefined),
} = {}) {
    const onFechar = vi.fn();
    render(
        <ModalAgendarVisita
            studyId={estudoAgendamento.id}
            estudoTitulo={estudoAgendamento.title}
            inicioEstudo={estudoAgendamento.startDate}
            fimEstudo={estudoAgendamento.endDate}
            participanteNome={participanteAgendamento.candidateName}
            token="token-ficticio"
            podeAgendar={podeAgendar}
            onFechar={onFechar}
            onSalvar={onSalvar}
        />
    );
    return { onSalvar, onFechar, dialog: screen.getByRole("dialog", { name: "Agendar visita" }) };
}

function previstas() {
    return simularHttp({ [`GET ${caminhoPrevistas}`]: respostaHttp([visitaPrevistaAgendamento]) });
}

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

/** Regras do formulário RF12 com respostas de API simuladas. @author Lívia */
describe("RF12 — formulário de agendamento (T18.5)", () => {
    it("RF12-AG01: campos obrigatórios impedem envio e recebem indicação de erro", async () => {
        previstas();
        const { dialog, onSalvar } = renderModal();
        await within(dialog).findByRole("option", { name: visitaPrevistaAgendamento.name });
        fireEvent.click(within(dialog).getByRole("button", { name: "Agendar visita" }));
        expect(
            await within(dialog).findByText("Selecione uma visita prevista do estudo.")
        ).toBeInTheDocument();
        expect(within(dialog).getByText("Informe a data e a hora da visita.")).toBeInTheDocument();
        expect(within(dialog).getByLabelText(/Visita prevista/)).toHaveAttribute(
            "aria-invalid",
            "true"
        );
        expect(within(dialog).getByLabelText(/Data e hora/)).toHaveAttribute(
            "aria-invalid",
            "true"
        );
        expect(onSalvar).not.toHaveBeenCalled();
    });

    it("RF12-AG02: envio válido usa o identificador da visita e o instante de Fortaleza em ISO", async () => {
        previstas();
        const { dialog, onSalvar } = renderModal();
        await preencherAgendamento(dialog);
        fireEvent.click(within(dialog).getByRole("button", { name: "Agendar visita" }));
        await waitFor(() =>
            expect(onSalvar).toHaveBeenCalledExactlyOnceWith({
                plannedVisitId: 7,
                scheduledAt: "2027-02-10T12:00:00.000Z",
            })
        );
    });

    it.each([400, 409])("RF12-AG03: mensagem HTTP %i é exibida literalmente", async (status) => {
        previstas();
        const mensagem = `Mensagem original ${status}: a visita não pode ser agendada.`;
        const onSalvar = vi
            .fn<(dados: DadosAgendamentoVisita) => Promise<void>>()
            .mockRejectedValue(new ApiClientError(mensagem, { status }));
        const { dialog } = renderModal({ onSalvar });
        await preencherAgendamento(dialog);
        fireEvent.click(within(dialog).getByRole("button", { name: "Agendar visita" }));
        expect(await within(dialog).findByRole("alert")).toHaveTextContent(mensagem, {
            normalizeWhitespace: false,
        });
        expect(within(dialog).getByRole("alert").textContent).toBe(mensagem);
    });

    it("RF12-AG04: conflito mantém formulário aberto e preserva visita e data preenchidas", async () => {
        previstas();
        const onSalvar = vi
            .fn<(dados: DadosAgendamentoVisita) => Promise<void>>()
            .mockRejectedValue(
                new ApiClientError("O participante já possui essa visita agendada.", {
                    status: 409,
                })
            );
        const { dialog, onFechar } = renderModal({ onSalvar });
        await preencherAgendamento(dialog);
        fireEvent.click(within(dialog).getByRole("button", { name: "Agendar visita" }));
        await within(dialog).findByRole("alert");
        expect(dialog).toBeInTheDocument();
        expect(within(dialog).getByLabelText(/Visita prevista/)).toHaveValue("7");
        expect(within(dialog).getByLabelText(/Data e hora/)).toHaveValue(dataHoraFormulario);
        expect(onFechar).not.toHaveBeenCalled();
    });

    it("RF12-AG05: erros de campo da API ficam associados aos respectivos controles", async () => {
        previstas();
        const onSalvar = vi
            .fn<(dados: DadosAgendamentoVisita) => Promise<void>>()
            .mockRejectedValue(
                new ApiClientError("Dados inválidos.", {
                    status: 400,
                    fieldErrors: [{ field: "scheduledAt", message: "Horário recusado pela API." }],
                })
            );
        const { dialog } = renderModal({ onSalvar });
        await preencherAgendamento(dialog);
        fireEvent.click(within(dialog).getByRole("button", { name: "Agendar visita" }));
        await within(dialog).findByText("Horário recusado pela API.");
        const campo = within(dialog).getByLabelText(/Data e hora/);
        expect(campo).toHaveAttribute("aria-invalid", "true");
        expect(campo).toHaveAccessibleDescription(/Horário recusado pela API\./);
    });

    it("RF12-AG06: nova tentativa consulta as visitas previstas após erro de carregamento", async () => {
        simularHttp({
            [`GET ${caminhoPrevistas}`]: [
                respostaHttp({ message: "Consulta temporariamente indisponível." }, 500),
                respostaHttp([visitaPrevistaAgendamento]),
            ],
        });
        const { dialog } = renderModal();
        expect(await within(dialog).findByRole("alert")).toHaveTextContent(
            "Consulta temporariamente indisponível."
        );
        fireEvent.click(within(dialog).getByRole("button", { name: "Tentar novamente" }));
        expect(
            await within(dialog).findByRole("option", { name: visitaPrevistaAgendamento.name })
        ).toBeInTheDocument();
        expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
    });

    it("RF12-AG07: estudo sem visitas previstas mantém o envio bloqueado", async () => {
        simularHttp({ [`GET ${caminhoPrevistas}`]: respostaHttp([]) });
        const { dialog, onSalvar } = renderModal();
        expect(await within(dialog).findByRole("note")).toHaveTextContent(
            "cadastrar uma visita prevista"
        );
        expect(within(dialog).getByRole("button", { name: "Agendar visita" })).toBeDisabled();
        expect(onSalvar).not.toHaveBeenCalled();
    });

    it("RF12-AG08: condição de agendamento indisponível bloqueia os campos e o envio", async () => {
        previstas();
        const { dialog, onSalvar } = renderModal({ podeAgendar: false });
        await within(dialog).findByRole("option", { name: visitaPrevistaAgendamento.name });
        expect(within(dialog).getByLabelText(/Data e hora/)).toBeDisabled();
        expect(within(dialog).getByRole("button", { name: "Agendar visita" })).toBeDisabled();
        expect(onSalvar).not.toHaveBeenCalled();
    });

    it("RF12-AG09: confirmação pendente impede envio duplicado e fechamento", async () => {
        previstas();
        let concluir!: () => void;
        const onSalvar = vi.fn<(dados: DadosAgendamentoVisita) => Promise<void>>(
            () =>
                new Promise<void>((resolve) => {
                    concluir = resolve;
                })
        );
        const { dialog } = renderModal({ onSalvar });
        await preencherAgendamento(dialog);
        const botao = within(dialog).getByRole("button", { name: "Agendar visita" });
        fireEvent.click(botao);
        fireEvent.click(botao);
        expect(onSalvar).toHaveBeenCalledTimes(1);
        expect(within(dialog).getByRole("button", { name: "Cancelar" })).toBeDisabled();
        expect(within(dialog).getByRole("button", { name: "Fechar agendamento" })).toBeDisabled();
        await act(async () => concluir());
    });

    it("RF12-AG10: cancelar fecha o formulário sem enviar agendamento", async () => {
        previstas();
        const { dialog, onSalvar, onFechar } = renderModal();
        await within(dialog).findByRole("option", { name: visitaPrevistaAgendamento.name });
        fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
        expect(onFechar).toHaveBeenCalledOnce();
        expect(onSalvar).not.toHaveBeenCalled();
    });

    it("RF12-AG11: falha sem resposta HTTP exibe orientação e permite tentar novamente", async () => {
        previstas();
        const onSalvar = vi
            .fn<(dados: DadosAgendamentoVisita) => Promise<void>>()
            .mockRejectedValue(new Error("Falha simulada"));
        const { dialog } = renderModal({ onSalvar });
        await preencherAgendamento(dialog);
        fireEvent.click(within(dialog).getByRole("button", { name: "Agendar visita" }));
        expect(await within(dialog).findByRole("alert")).toHaveTextContent(
            "Não foi possível agendar a visita. Tente novamente."
        );
        expect(within(dialog).getByRole("button", { name: "Agendar visita" })).toBeEnabled();
        expect(within(dialog).getByLabelText(/Data e hora/)).toHaveValue(dataHoraFormulario);
    });
});
