import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cancelarCandidatura } from "../../services/candidatos";
import { ApiClientError } from "../../services/api/apiClient";
import { respostaHttp, simularHttp } from "../../test/fixtures/agendamento";
import { candidatoFluxo, promessaControlada } from "../../test/fixtures/fluxos-web";
import type { CandidatoApi } from "../../types/candidato";
import { ModalCancelarCandidatura } from "./ModalCancelarCandidatura";

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

function abrir(
    opcoes: {
        permitido?: boolean;
        candidato?: CandidatoApi;
        onAtualizar?: () => Promise<void>;
    } = {}
) {
    const onFechar = vi.fn();
    const onAtualizar = opcoes.onAtualizar ?? vi.fn().mockResolvedValue(undefined);
    const onConfirmar = vi.fn(async (reason: string) => {
        await cancelarCandidatura(10, 101, { reason }, "token-ficticio");
    });
    const props = {
        estudoTitulo: "Estudo fictício",
        candidato: candidatoFluxo,
        permitido: true,
        onFechar,
        onConfirmar,
        onAtualizar,
        ...opcoes,
    };
    return { ...render(<ModalCancelarCandidatura {...props} />), props, onFechar, onConfirmar };
}

function motivo(valor: string) {
    fireEvent.change(screen.getByLabelText(/Motivo do cancelamento/), { target: { value: valor } });
}
function confirmar() {
    fireEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));
}

/** Cancelamento da candidatura preserva histórico e mensagens do contrato. @author Lívia */
describe("RF08 / OBS-CANCELAMENTO — T17.8", () => {
    it.each([
        ["vazio", ""],
        ["espaços", "   "],
        ["acima de 500", "a".repeat(501)],
    ])("OBS-C01: motivo %s não envia POST", async (_cenario, valor) => {
        const http = simularHttp({});
        abrir();
        motivo(valor);
        confirmar();
        expect(
            await screen.findByText(
                valor.trim()
                    ? "O motivo deve ter até 500 caracteres."
                    : "Informe o motivo do cancelamento."
            )
        ).toBeInTheDocument();
        expect(screen.getByLabelText(/Motivo do cancelamento/)).toHaveAttribute(
            "aria-invalid",
            "true"
        );
        expect(http).not.toHaveBeenCalled();
    });

    it.each([
        ["mínimo", "x"],
        ["máximo", "x".repeat(500)],
    ])("OBS-C02: aceita limite %s do motivo sem espaços externos", async (_cenario, reason) => {
        const http = simularHttp({
            "POST /api/studies/10/candidates/101/cancellation": respostaHttp({
                ...candidatoFluxo,
                status: "CANCELLED",
            }),
        });
        const { onConfirmar } = abrir();
        motivo(`  ${reason}  `);
        confirmar();
        await waitFor(() => expect(onConfirmar).toHaveBeenCalledExactlyOnceWith(reason));
        expect(JSON.parse(String(http.mock.calls[0][1]?.body))).toEqual({ reason });
        await waitFor(() =>
            expect(screen.getByRole("button", { name: "Confirmar cancelamento" })).toBeEnabled()
        );
    });

    it.each([
        ["CANDIDATE_ALREADY_INCLUDED", "Candidato já incluído. Utilize a retirada."],
        ["CANDIDATE_ALREADY_CANCELLED", "Candidatura já cancelada."],
        ["STUDY_NOT_RECRUITING", "O estudo não está mais em recrutamento."],
    ])(
        "OBS-C03: conflito %s é literal e atualiza o contexto sem repetir POST",
        async (code, message) => {
            const http = simularHttp({
                "POST /api/studies/10/candidates/101/cancellation": respostaHttp(
                    { code, message },
                    409
                ),
            });
            const onAtualizar = vi.fn().mockResolvedValue(undefined);
            abrir({ onAtualizar });
            motivo("E-mail incorreto");
            confirmar();
            expect(await screen.findByRole("alert")).toHaveTextContent(message);
            await waitFor(() => expect(onAtualizar).toHaveBeenCalledTimes(1));
            expect(
                await screen.findByText(/Dados atualizados. Situação da candidatura:/)
            ).toBeInTheDocument();
            expect(screen.getByLabelText(/Motivo do cancelamento/)).toHaveValue("E-mail incorreto");
            expect(http).toHaveBeenCalledTimes(1);
        }
    );

    it("OBS-C04: atualização falha bloqueia confirmação e o botão de recuperação não repete POST", async () => {
        const http = simularHttp({
            "POST /api/studies/10/candidates/101/cancellation": respostaHttp(
                { message: "Conflito de candidatura." },
                409
            ),
        });
        const onAtualizar = vi
            .fn()
            .mockRejectedValueOnce(new ApiClientError("Consulta temporariamente indisponível."))
            .mockResolvedValue(undefined);
        abrir({ onAtualizar });
        motivo("Correção de e-mail");
        confirmar();
        expect(
            await screen.findByText("Consulta temporariamente indisponível.")
        ).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Confirmar cancelamento" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "Atualizar dados" }));
        await waitFor(() =>
            expect(screen.getByRole("button", { name: "Confirmar cancelamento" })).toBeEnabled()
        );
        expect(onAtualizar).toHaveBeenCalledTimes(2);
        expect(http).toHaveBeenCalledTimes(1);
    });

    it("OBS-C05: erro de campo da API é literal e mantém o motivo", async () => {
        simularHttp({
            "POST /api/studies/10/candidates/101/cancellation": respostaHttp(
                {
                    message: "Motivo recusado pelo serviço.",
                    fieldErrors: [{ field: "reason", message: "Informe um motivo diferente." }],
                },
                400
            ),
        });
        abrir();
        motivo("Motivo fictício");
        confirmar();
        expect(await screen.findByRole("alert")).toHaveTextContent("Motivo recusado pelo serviço.");
        expect(screen.getByText("Informe um motivo diferente.")).toBeInTheDocument();
        expect(screen.getByLabelText(/Motivo do cancelamento/)).toHaveValue("Motivo fictício");
    });

    it.each(["INCLUDED", "CANCELLED", "ACTIVE"] as const)(
        "OBS-C06: contexto não permitido (%s) impede confirmação",
        (status) => {
            const http = simularHttp({});
            abrir({ permitido: false, candidato: { ...candidatoFluxo, status } });
            expect(screen.getByRole("note")).toBeInTheDocument();
            expect(screen.getByLabelText(/Motivo do cancelamento/)).toBeDisabled();
            const button = screen.getByRole("button", { name: "Confirmar cancelamento" });
            expect(button).toBeDisabled();
            fireEvent.submit(button.closest("form")!);
            expect(http).not.toHaveBeenCalled();
        }
    );

    it("OBS-C07: envio pendente impede envio duplicado e fechamento", async () => {
        const pendente = promessaControlada<Response>();
        const http = simularHttp({
            "POST /api/studies/10/candidates/101/cancellation": pendente.promessa,
        });
        const { onFechar } = abrir();
        motivo("Desistência fictícia");
        const form = screen
            .getByRole("button", { name: "Confirmar cancelamento" })
            .closest("form")!;
        fireEvent.submit(form);
        fireEvent.submit(form);
        expect(screen.getByRole("button", { name: "Cancelando..." })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Voltar" })).toBeDisabled();
        expect(http).toHaveBeenCalledTimes(1);
        expect(onFechar).not.toHaveBeenCalled();
        await act(async () => pendente.resolver(respostaHttp(candidatoFluxo)));
        await waitFor(() => expect(screen.getByRole("button", { name: "Voltar" })).toBeEnabled());
    });

    it("OBS-C08: voltar ou fechar não envia cancelamento", () => {
        const http = simularHttp({});
        const { onFechar } = abrir();
        const dialog = screen.getByRole("dialog");
        fireEvent.click(within(dialog).getByRole("button", { name: "Voltar" }));
        fireEvent.click(within(dialog).getByRole("button", { name: "Fechar cancelamento" }));
        expect(onFechar).toHaveBeenCalledTimes(2);
        expect(http).not.toHaveBeenCalled();
    });
});
