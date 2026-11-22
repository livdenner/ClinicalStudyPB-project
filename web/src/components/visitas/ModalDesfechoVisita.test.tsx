import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registrarDesfechoVisita } from "../../services/visitas-agendadas";
import { ApiClientError } from "../../services/api/apiClient";
import { respostaHttp, simularHttp, visitaAgendada } from "../../test/fixtures/agendamento";
import { promessaControlada } from "../../test/fixtures/fluxos-web";
import type { DesfechoVisita } from "../../types/visita-agendada";
import { ModalDesfechoVisita } from "./ModalDesfechoVisita";

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});
const endpoint = "/api/studies/10/participants/50/visits/80/outcome";

function abrir(
    outcome: DesfechoVisita = "CANCELLED",
    onAtualizar = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
) {
    const props = {
        visita: visitaAgendada,
        outcome,
        permitido: true,
        onFechar: vi.fn(),
        onAtualizar,
        onConfirmar: vi.fn(async (dados: Parameters<typeof registrarDesfechoVisita>[1]) => {
            await registrarDesfechoVisita(visitaAgendada, dados, "token-ficticio");
        }),
    };
    return { ...render(<ModalDesfechoVisita {...props} />), props };
}
function justificar(value: string) {
    fireEvent.change(screen.getByLabelText(/Justificativa do cancelamento/), { target: { value } });
}
function confirmar() {
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));
}

/** Confirmações RF13 com HTTP simulado e sem efeitos reais. @author Lívia */
describe("RF13 — confirmação do desfecho (T19.4)", () => {
    it.each(["", "   "])(
        "RF13-D01: cancelar com justificativa vazia (%s) é bloqueado",
        async (value) => {
            const http = simularHttp({});
            abrir();
            justificar(value);
            confirmar();
            expect(
                await screen.findByText("Informe a justificativa do cancelamento.")
            ).toBeInTheDocument();
            expect(screen.getByLabelText(/Justificativa do cancelamento/)).toHaveAttribute(
                "aria-invalid",
                "true"
            );
            await waitFor(() =>
                expect(screen.getByLabelText(/Justificativa do cancelamento/)).toHaveFocus()
            );
            expect(http).not.toHaveBeenCalled();
        }
    );

    it("RF13-D02: justificativa acima de 500 caracteres não é enviada", async () => {
        const http = simularHttp({});
        abrir();
        justificar("x".repeat(501));
        confirmar();
        expect(
            await screen.findByText("A justificativa deve ter até 500 caracteres.")
        ).toBeInTheDocument();
        expect(http).not.toHaveBeenCalled();
    });

    it("RF13-D03: cancelar envia justificativa aparada com a versão da visita", async () => {
        const http = simularHttp({
            [`POST ${endpoint}`]: respostaHttp({
                ...visitaAgendada,
                status: "CANCELLED",
                version: 1,
            }),
        });
        abrir();
        justificar("  Desistência fictícia  ");
        confirmar();
        await waitFor(() => expect(http).toHaveBeenCalledTimes(1));
        expect(JSON.parse(String(http.mock.calls[0][1]?.body))).toEqual({
            outcome: "CANCELLED",
            note: "Desistência fictícia",
        });
        expect(new Headers(http.mock.calls[0][1]?.headers).get("If-Match")).toBe('"0"');
        await waitFor(() =>
            expect(screen.getByRole("button", { name: "Confirmar cancelamento" })).toBeEnabled()
        );
    });

    it.each([
        ["DONE", "Confirmar realizada"],
        ["ABSENT", "Confirmar ausência"],
    ] as const)(
        "RF13-D04: desfecho %s só envia após confirmação explícita",
        async (outcome, label) => {
            const http = simularHttp({
                [`POST ${endpoint}`]: respostaHttp({
                    ...visitaAgendada,
                    status: outcome,
                    version: 1,
                }),
            });
            abrir(outcome);
            expect(http).not.toHaveBeenCalled();
            expect(screen.queryByLabelText(/Justificativa/)).not.toBeInTheDocument();
            fireEvent.click(screen.getByRole("button", { name: label }));
            await waitFor(() => expect(http).toHaveBeenCalledTimes(1));
            expect(JSON.parse(String(http.mock.calls[0][1]?.body))).toEqual({ outcome });
            await waitFor(() => expect(screen.getByRole("button", { name: label })).toBeEnabled());
        }
    );

    it("RF13-D05: erro 400 e erro de campo são literais e mantêm o formulário", async () => {
        simularHttp({
            [`POST ${endpoint}`]: respostaHttp(
                {
                    message: "Justificativa recusada pela API.",
                    fieldErrors: [{ field: "note", message: "Informe outra justificativa." }],
                },
                400
            ),
        });
        abrir();
        justificar("Justificativa fictícia");
        confirmar();
        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Justificativa recusada pela API."
        );
        expect(screen.getByText("Informe outra justificativa.")).toBeInTheDocument();
        expect(screen.getByLabelText(/Justificativa do cancelamento/)).toHaveValue(
            "Justificativa fictícia"
        );
    });

    it("RF13-D06: conflito 409 exibe mensagem e consulta sem repetir a gravação", async () => {
        const http = simularHttp({
            [`POST ${endpoint}`]: respostaHttp(
                { message: "A visita já recebeu outro desfecho.", code: "VISIT_OUTCOME_FINAL" },
                409
            ),
        });
        const onAtualizar = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
        abrir("CANCELLED", onAtualizar);
        justificar("Motivo fictício");
        confirmar();
        expect(await screen.findByRole("alert")).toHaveTextContent(
            "A visita já recebeu outro desfecho."
        );
        expect(await screen.findByText(/Dados atualizados. Situação atual:/)).toBeInTheDocument();
        expect(onAtualizar).toHaveBeenCalledTimes(1);
        expect(http).toHaveBeenCalledTimes(1);
    });

    it("RF13-D07: falha ao atualizar mantém confirmação bloqueada até recuperação", async () => {
        const http = simularHttp({
            [`POST ${endpoint}`]: respostaHttp({ message: "Versão desatualizada." }, 409),
        });
        const atualizar = vi
            .fn<() => Promise<void>>()
            .mockRejectedValueOnce(new ApiClientError("Não foi possível consultar esta visita."))
            .mockResolvedValue(undefined);
        abrir("CANCELLED", atualizar);
        justificar("Motivo fictício");
        confirmar();
        expect(
            await screen.findByText("Não foi possível consultar esta visita.")
        ).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Confirmar cancelamento" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "Atualizar visita" }));
        await waitFor(() =>
            expect(screen.getByRole("button", { name: "Confirmar cancelamento" })).toBeEnabled()
        );
        expect(atualizar).toHaveBeenCalledTimes(2);
        expect(http).toHaveBeenCalledTimes(1);
    });

    it("RF13-D08: visita finalizada após atualização fica somente em consulta", () => {
        const http = simularHttp({});
        const { rerender, props } = abrir();
        rerender(
            <ModalDesfechoVisita
                {...props}
                permitido={false}
                visita={{ ...visitaAgendada, status: "DONE", version: 1 }}
            />
        );
        expect(
            screen.getByText("Esta visita já foi finalizada e não permite outro desfecho.")
        ).toBeInTheDocument();
        const button = screen.getByRole("button", { name: "Confirmar cancelamento" });
        expect(button).toBeDisabled();
        fireEvent.submit(button.closest("form")!);
        expect(http).not.toHaveBeenCalled();
    });

    it("RF13-D09: envio pendente não duplica gravação nem permite fechar", async () => {
        const pendente = promessaControlada<Response>();
        const http = simularHttp({ [`POST ${endpoint}`]: pendente.promessa });
        const { props } = abrir();
        justificar("Motivo fictício");
        const form = screen
            .getByRole("button", { name: "Confirmar cancelamento" })
            .closest("form")!;
        fireEvent.submit(form);
        fireEvent.submit(form);
        expect(screen.getByRole("button", { name: "Registrando..." })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Fechar confirmação" })).toBeDisabled();
        expect(http).toHaveBeenCalledTimes(1);
        expect(props.onFechar).not.toHaveBeenCalled();
        await act(async () => pendente.resolver(respostaHttp(visitaAgendada)));
        await waitFor(() => expect(screen.getByRole("button", { name: "Voltar" })).toBeEnabled());
    });

    it("RF13-D10: voltar ou fechar abandona confirmação sem registrar desfecho", () => {
        const http = simularHttp({});
        const { props } = abrir();
        fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
        fireEvent.click(screen.getByRole("button", { name: "Fechar confirmação" }));
        expect(props.onFechar).toHaveBeenCalledTimes(2);
        expect(http).not.toHaveBeenCalled();
    });
});
