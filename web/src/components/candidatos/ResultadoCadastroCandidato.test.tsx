import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Modal } from "@heroui/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cadastroAtivo, cadastroConvidado } from "../../test/fixtures/fluxos-web";
import type { CadastroCandidatoApi } from "../../types/candidato";
import { ResultadoCadastroCandidato } from "./ResultadoCadastroCandidato";

const clipboardOriginal = Object.getOwnPropertyDescriptor(navigator, "clipboard");
afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    if (clipboardOriginal) Object.defineProperty(navigator, "clipboard", clipboardOriginal);
    else Reflect.deleteProperty(navigator, "clipboard");
});

function simularClipboard(writeText: (texto: string) => Promise<void>) {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
}

function mostrar(resultado: CadastroCandidatoApi = cadastroConvidado) {
    const onFechar = vi.fn();
    render(
        <Modal>
            <Modal.Backdrop isOpen>
                <Modal.Container>
                    <Modal.Dialog aria-label="Confirmação de cadastro">
                        <ResultadoCadastroCandidato resultado={resultado} onFechar={onFechar} />
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
    return onFechar;
}

/** O código é apenas demonstrativo: consumo e ativação pertencem ao app/backend. @author Lívia */
describe("RF08 — confirmação do cadastro (T17.8)", () => {
    it("RF08-R01: convite mostra código único, validade e aviso de demonstração sem persistir no navegador", () => {
        const setLocal = vi.spyOn(Storage.prototype, "setItem");
        mostrar();
        expect(screen.getByLabelText("Código de ativação")).toHaveTextContent("DEMO-1234");
        expect(screen.getByText("Recurso de demonstração")).toBeInTheDocument();
        expect(screen.getByText(/não poderá ser reutilizado/)).toBeInTheDocument();
        expect(document.querySelector("time")).toHaveAttribute(
            "datetime",
            cadastroConvidado.activation.expiresAt
        );
        expect(setLocal).not.toHaveBeenCalled();
    });

    it("RF08-R02: copia exatamente o código e confirma a cópia", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        simularClipboard(writeText);
        mostrar();
        fireEvent.click(screen.getByRole("button", { name: "Copiar código" }));
        expect(await screen.findByText("Código copiado.")).toBeInTheDocument();
        expect(writeText).toHaveBeenCalledExactlyOnceWith("DEMO-1234");
    });

    it("RF08-R03: falha na área de transferência orienta a cópia manual e preserva o código", async () => {
        simularClipboard(vi.fn().mockRejectedValue(new Error("Indisponível")));
        mostrar();
        fireEvent.click(screen.getByRole("button", { name: "Copiar código" }));
        expect(
            await screen.findByText(
                "Não foi possível copiar automaticamente. Selecione o código acima para copiá-lo."
            )
        ).toBeInTheDocument();
        expect(screen.getByLabelText("Código de ativação")).toHaveTextContent("DEMO-1234");
    });

    it("RF08-R04: conta vinculada não mostra convite nem código e permite concluir", () => {
        const fechar = mostrar(cadastroAtivo);
        expect(screen.getByText(/já possui uma conta de participante ativa/)).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Copiar código" })).not.toBeInTheDocument();
        expect(screen.queryByText("Recurso de demonstração")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Concluir cadastro" }));
        expect(fechar).toHaveBeenCalledTimes(1);
    });
});
