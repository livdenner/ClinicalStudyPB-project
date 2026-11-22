import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "../../services/api/apiClient";
import { promessaControlada } from "../../test/fixtures/fluxos-web";
import type { AtividadeComResultado, ResultadoAtividade } from "../../types/resultado-atividade";
import { FormularioResultadoAtividade } from "./FormularioResultadoAtividade";

const atividade: AtividadeComResultado = {
    activityId: 11,
    name: "Atividade fictícia",
    description: "Dados de demonstração",
    position: 1,
};
const resultado: ResultadoAtividade = {
    activityId: 11,
    visitId: 80,
    value: "Valor fictício",
    note: "Observação anterior",
    recordedByUserId: 2,
    recordedAt: "2027-02-10T13:00:00Z",
};
afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

function abrir(dados: Partial<Parameters<typeof FormularioResultadoAtividade>[0]> = {}) {
    const props = {
        atividade,
        podeEditar: true,
        ocupado: false,
        onSalvar: vi
            .fn<Parameters<typeof FormularioResultadoAtividade>[0]["onSalvar"]>()
            .mockResolvedValue(resultado),
        ...dados,
    };
    return { ...render(<FormularioResultadoAtividade {...props} />), props };
}
function valor(value: string) {
    fireEvent.change(screen.getByLabelText(/^Resultado/), { target: { value } });
}
function observacao(value: string) {
    fireEvent.change(screen.getByLabelText("Observação"), { target: { value } });
}
function salvar() {
    fireEvent.click(screen.getByRole("button", { name: "Salvar resultado: Atividade fictícia" }));
}

/** Validações locais isoladas por atividade RF14. @author Lívia */
describe("RF14 — campos do resultado (T20.5)", () => {
    it("RF14-F01: resultado obrigatório bloqueia gravação e recebe foco", async () => {
        const { props } = abrir();
        valor("   ");
        salvar();
        expect(await screen.findByText("Informe o resultado da atividade.")).toBeInTheDocument();
        await waitFor(() => expect(screen.getByLabelText(/^Resultado/)).toHaveFocus());
        expect(props.onSalvar).not.toHaveBeenCalled();
    });

    it("RF14-F02: resultado acima de 200 caracteres impede envio", async () => {
        const { props } = abrir();
        valor("x".repeat(201));
        salvar();
        expect(
            await screen.findByText("O resultado deve ter até 200 caracteres.")
        ).toBeInTheDocument();
        expect(props.onSalvar).not.toHaveBeenCalled();
    });

    it("RF14-F03: observação acima de 500 caracteres impede envio", async () => {
        const { props } = abrir();
        valor("Valor fictício");
        observacao("x".repeat(501));
        salvar();
        expect(
            await screen.findByText("A observação deve ter até 500 caracteres.")
        ).toBeInTheDocument();
        expect(screen.getByLabelText("Observação")).toHaveAttribute("aria-invalid", "true");
        expect(props.onSalvar).not.toHaveBeenCalled();
    });

    it("RF14-F04: aceita os limites de 200 e 500 caracteres", async () => {
        const { props } = abrir();
        valor("x".repeat(200));
        observacao("y".repeat(500));
        salvar();
        await waitFor(() =>
            expect(props.onSalvar).toHaveBeenCalledExactlyOnceWith(11, {
                value: "x".repeat(200),
                note: "y".repeat(500),
            })
        );
        expect(await screen.findByText("Resultado salvo.")).toBeInTheDocument();
    });

    it("RF14-F05: limpar observação existente omite note na substituição completa", async () => {
        const { props } = abrir({ atividade: { ...atividade, result: resultado } });
        expect(screen.getByText("Registrado")).toBeInTheDocument();
        expect(document.querySelector("time")).toHaveAttribute("datetime", resultado.recordedAt);
        valor("  Valor revisado  ");
        observacao("   ");
        salvar();
        await waitFor(() =>
            expect(props.onSalvar).toHaveBeenCalledExactlyOnceWith(11, { value: "Valor revisado" })
        );
    });

    it("RF14-F06: erros de valor e observação da API aparecem literalmente com rascunho intacto", async () => {
        const onSalvar = vi.fn().mockRejectedValue(
            new ApiClientError("Resultado não aceito.", {
                status: 400,
                fieldErrors: [
                    { field: "value", message: "Valor inválido na API." },
                    { field: "note", message: "Observação inválida na API." },
                ],
            })
        );
        abrir({ onSalvar });
        valor("Rascunho fictício");
        observacao("Nota fictícia");
        salvar();
        expect(await screen.findByRole("alert")).toHaveTextContent("Resultado não aceito.");
        expect(screen.getByText("Valor inválido na API.")).toBeInTheDocument();
        expect(screen.getByText("Observação inválida na API.")).toBeInTheDocument();
        expect(screen.getByLabelText(/^Resultado/)).toHaveValue("Rascunho fictício");
        expect(screen.getByLabelText("Observação")).toHaveValue("Nota fictícia");
    });

    it("RF14-F07: perda de permissão preserva rascunho e distingue o registro confirmado", () => {
        const { rerender, props } = abrir({ atividade: { ...atividade, result: resultado } });
        valor("Não salvo");
        observacao("Nota não salva");
        rerender(<FormularioResultadoAtividade {...props} podeEditar={false} />);
        expect(screen.getByText("Resultado registrado: Valor fictício")).toBeInTheDocument();
        expect(screen.getByText("Observação registrada: Observação anterior")).toBeInTheDocument();
        expect(screen.getByLabelText(/^Resultado/)).toHaveValue("Não salvo");
        expect(screen.getByLabelText(/^Resultado/)).toHaveAttribute("readonly");
        expect(screen.queryByRole("button", { name: /Salvar resultado/ })).not.toBeInTheDocument();
    });

    it("RF14-F08: gravação pendente bloqueia duplicidade", async () => {
        const pendente = promessaControlada<ResultadoAtividade>();
        const onSalvar = vi.fn().mockReturnValue(pendente.promessa);
        abrir({ onSalvar });
        valor("Valor fictício");
        const form = screen.getByRole("button", { name: /Salvar resultado/ }).closest("form")!;
        fireEvent.submit(form);
        fireEvent.submit(form);
        expect(screen.getByRole("button", { name: /Salvar resultado/ })).toBeDisabled();
        expect(onSalvar).toHaveBeenCalledTimes(1);
        await act(async () => pendente.resolver(resultado));
        expect(await screen.findByText("Resultado salvo.")).toBeInTheDocument();
    });

    it("RF14-F09: falha inesperada permite nova tentativa sem apagar o valor", async () => {
        abrir({ onSalvar: vi.fn().mockRejectedValue(new Error("Falha fictícia")) });
        valor("Rascunho fictício");
        salvar();
        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Não foi possível salvar o resultado. Tente novamente."
        );
        expect(screen.getByLabelText(/^Resultado/)).toHaveValue("Rascunho fictício");
        expect(screen.getByRole("button", { name: /Salvar resultado/ })).toBeEnabled();
    });

    it.each([true, false])(
        "RF14-F10: consulta sem resultado prévio respeita ocupado=%s e não grava",
        (ocupado) => {
            const { props } = abrir({ podeEditar: false, ocupado });
            expect(screen.getByText("Resultado ainda não registrado.")).toBeInTheDocument();
            expect(
                screen.queryByRole("button", { name: /Salvar resultado/ })
            ).not.toBeInTheDocument();
            fireEvent.submit(screen.getByLabelText(/^Resultado/).closest("form")!);
            expect(props.onSalvar).not.toHaveBeenCalled();
        }
    );
});
