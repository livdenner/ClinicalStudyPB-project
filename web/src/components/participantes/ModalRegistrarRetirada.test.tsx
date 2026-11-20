import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ModalRegistrarRetirada } from "./ModalRegistrarRetirada";
import { ApiClientError } from "../../services/api/apiClient";
import type { ParticipanteApi } from "../../types/participante";

const participante: ParticipanteApi = {
    id: 7,
    studyId: 3,
    candidateId: 11,
    candidateName: "Ana Silva",
    includedAt: "2026-11-09T12:00:00Z",
    status: "ACTIVE",
};
afterEach(cleanup);

function abrir(onConfirmar = vi.fn<(_: string) => Promise<void>>().mockResolvedValue(undefined)) {
    const onFechar = vi.fn();
    render(
        <ModalRegistrarRetirada
            participante={participante}
            estudoTitulo="Estudo do sono"
            onFechar={onFechar}
            onConfirmar={onConfirmar}
        />
    );
    return { onConfirmar, onFechar };
}

it.each(["", "   ", "a".repeat(501)])(
    "bloqueia motivo inválido e destaca o campo (%s)",
    async (motivo) => {
        const { onConfirmar } = abrir();
        fireEvent.change(screen.getByRole("textbox", { name: "Motivo da retirada" }), {
            target: { value: motivo },
        });
        fireEvent.click(screen.getByRole("button", { name: "Confirmar retirada" }));
        expect(
            await screen.findByText("Informe o motivo da retirada com 1 a 500 caracteres.")
        ).toBeInTheDocument();
        expect(screen.getByRole("textbox", { name: "Motivo da retirada" })).toHaveAttribute(
            "aria-invalid",
            "true"
        );
        expect(onConfirmar).not.toHaveBeenCalled();
    }
);

it("confirma com o motivo sem espaços nas extremidades e informa o efeito nas vagas", async () => {
    const { onConfirmar } = abrir();
    expect(screen.getByText(/A vaga continuará ocupada/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Motivo da retirada" }), {
        target: { value: "  Mudança de cidade  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar retirada" }));
    await waitFor(() => expect(onConfirmar).toHaveBeenCalledWith("Mudança de cidade"));
});

it("mantém o modal aberto e mostra a mensagem exata da API", async () => {
    const { onFechar } = abrir(
        vi
            .fn()
            .mockRejectedValue(
                new ApiClientError("O estudo está encerrado ou cancelado e não aceita retiradas.", {
                    status: 409,
                    code: "STUDY_READ_ONLY",
                })
            )
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Motivo da retirada" }), {
        target: { value: "Desistência" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar retirada" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
        "O estudo está encerrado ou cancelado e não aceita retiradas."
    );
    expect(onFechar).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Registrar retirada" })).toBeInTheDocument();
});

it("impede envio duplicado e fechamento enquanto aguarda a API", async () => {
    let concluir!: () => void;
    const { onConfirmar, onFechar } = abrir(
        vi.fn().mockImplementation(
            () =>
                new Promise<void>((resolve) => {
                    concluir = resolve;
                })
        )
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Motivo da retirada" }), {
        target: { value: "Desistência" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar retirada" }));
    const enviando = await screen.findByRole("button", { name: "Registrando..." });
    expect(enviando).toBeDisabled();
    fireEvent.click(enviando);
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(onConfirmar).toHaveBeenCalledTimes(1);
    expect(onFechar).not.toHaveBeenCalled();
    await act(async () => concluir());
});

it("permite voltar sem registrar a retirada", () => {
    const { onConfirmar, onFechar } = abrir();
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(onFechar).toHaveBeenCalledOnce();
    expect(onConfirmar).not.toHaveBeenCalled();
});
