import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModalEstudo } from "./ModalEstudo";
import { ApiClientError } from "../../services/api/apiClient";
import type { EstudoApi } from "../../types/estudo";

const pesquisador = { id: 7, name: "Ana Silva" };
const estudo: EstudoApi = {
    version: 0,
    status: "PLANNING",
    id: 3,
    title: "Estudo do sono",
    objective: "Avaliar hábitos",
    responsibleUserId: 11,
    startDate: "2026-11-01",
    endDate: "2026-12-01",
    participantLimit: 30,
};

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe("ModalEstudo", () => {
    it("valida os campos obrigatórios no cadastro e direciona o foco para o nome", async () => {
        const onSalvar = vi.fn().mockResolvedValue(undefined);
        render(<ModalEstudo responsavel={pesquisador} onFechar={vi.fn()} onSalvar={onSalvar} />);
        const dialog = await screen.findByRole("dialog", { name: "Novo estudo" });
        expect(within(dialog).getByText(pesquisador.name)).toBeInTheDocument();
        fireEvent.click(within(dialog).getByRole("button", { name: "Cadastrar estudo" }));
        expect(await screen.findByText("Informe o nome do estudo.")).toBeInTheDocument();
        expect(screen.getByText("Informe o objetivo do estudo.")).toBeInTheDocument();
        expect(screen.getByText("Informe a data de início.")).toBeInTheDocument();
        expect(screen.getByText("Informe a data de término.")).toBeInTheDocument();
        expect(screen.getByText("Informe um número inteiro maior que zero.")).toBeInTheDocument();
        expect(within(dialog).getByLabelText(/^Nome do estudo/)).toHaveFocus();
        expect(onSalvar).not.toHaveBeenCalled();
    });

    it("envia os dados normalizados e preserva o responsável na edição", async () => {
        const onSalvar = vi.fn().mockResolvedValue(undefined);
        render(
            <ModalEstudo
                estudo={estudo}
                responsavel={{ id: 11, name: "Pesquisador #11" }}
                onFechar={vi.fn()}
                onSalvar={onSalvar}
            />
        );
        const dialog = await screen.findByRole("dialog", { name: "Editar estudo" });
        expect(within(dialog).getByLabelText(/^Nome do estudo/)).toHaveValue(estudo.title);
        expect(within(dialog).getByLabelText(/^Nome do estudo/)).toHaveAttribute(
            "maxlength",
            "200"
        );
        fireEvent.change(within(dialog).getByLabelText(/^Nome do estudo/), {
            target: { value: " Estudo atualizado " },
        });
        fireEvent.change(within(dialog).getByLabelText(/^Objetivo/), {
            target: { value: " Novo objetivo " },
        });
        fireEvent.click(within(dialog).getByRole("button", { name: "Salvar alterações" }));
        const { id: _id, status: _status, version: _version, ...dados } = estudo;
        await waitFor(() =>
            expect(onSalvar).toHaveBeenCalledWith({
                ...dados,
                title: "Estudo atualizado",
                objective: "Novo objetivo",
            })
        );
    });

    it.each([
        ["0", "Informe um número inteiro maior que zero."],
        ["-1", "Informe um número inteiro maior que zero."],
        ["1.5", "Informe um número inteiro maior que zero."],
        ["1000001", "O limite informado excede o valor permitido."],
    ])("impede salvar o limite inválido %s", async (limite, mensagem) => {
        const onSalvar = vi.fn().mockResolvedValue(undefined);
        render(
            <ModalEstudo
                estudo={estudo}
                responsavel={pesquisador}
                onFechar={vi.fn()}
                onSalvar={onSalvar}
            />
        );
        const dialog = await screen.findByRole("dialog");
        fireEvent.change(within(dialog).getByLabelText(/^Limite de participantes/), {
            target: { value: limite },
        });
        fireEvent.click(within(dialog).getByRole("button", { name: "Salvar alterações" }));
        expect(await screen.findByText(mensagem)).toBeInTheDocument();
        expect(onSalvar).not.toHaveBeenCalled();
    });

    it("aceita o limite máximo de 1.000.000 participantes", async () => {
        const onSalvar = vi.fn().mockResolvedValue(undefined);
        render(
            <ModalEstudo
                estudo={estudo}
                responsavel={pesquisador}
                onFechar={vi.fn()}
                onSalvar={onSalvar}
            />
        );
        const dialog = await screen.findByRole("dialog", { name: "Editar estudo" });
        fireEvent.change(within(dialog).getByLabelText(/^Limite de participantes/), {
            target: { value: "1000000" },
        });
        fireEvent.click(within(dialog).getByRole("button", { name: "Salvar alterações" }));
        await waitFor(() =>
            expect(onSalvar).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({ participantLimit: 1000000 })
            )
        );
    });
    it("aceita limite mínimo e datas de início e término iguais", async () => {
        const onSalvar = vi.fn().mockResolvedValue(undefined);
        const estudoMesmoDia = {
            ...estudo,
            participantLimit: 1,
            endDate: estudo.startDate,
        };
        render(
            <ModalEstudo
                estudo={estudoMesmoDia}
                responsavel={pesquisador}
                onFechar={vi.fn()}
                onSalvar={onSalvar}
            />
        );
        const dialog = await screen.findByRole("dialog");
        fireEvent.click(within(dialog).getByRole("button", { name: "Salvar alterações" }));
        expect(onSalvar).toHaveBeenCalledWith(
            expect.objectContaining({
                participantLimit: 1,
                startDate: estudo.startDate,
                endDate: estudo.startDate,
            })
        );
    });

    it.each(["Cancelar", "Fechar modal"])(
        "chama onFechar ao acionar %s sem enviar dados",
        async (botao) => {
            const onFechar = vi.fn();
            const onSalvar = vi.fn().mockResolvedValue(undefined);
            render(
                <ModalEstudo
                    estudo={estudo}
                    responsavel={pesquisador}
                    onFechar={onFechar}
                    onSalvar={onSalvar}
                />
            );
            const dialog = await screen.findByRole("dialog");
            fireEvent.click(within(dialog).getByRole("button", { name: botao }));
            expect(onFechar).toHaveBeenCalledTimes(1);
            expect(onSalvar).not.toHaveBeenCalled();
        }
    );

    it("bloqueia campos, calendários e fechamento enquanto salva", async () => {
        let concluir!: () => void;
        const pendente = new Promise<void>((resolve) => {
            concluir = resolve;
        });
        const onSalvar = vi.fn().mockReturnValue(pendente);
        const onFechar = vi.fn();
        render(
            <ModalEstudo
                estudo={estudo}
                responsavel={pesquisador}
                onFechar={onFechar}
                onSalvar={onSalvar}
            />
        );
        const dialog = await screen.findByRole("dialog");
        fireEvent.click(within(dialog).getByRole("button", { name: "Salvar alterações" }));
        for (const rotulo of [/^Nome do estudo/, /^Objetivo/, /^Limite de participantes/]) {
            expect(within(dialog).getByLabelText(rotulo)).toBeDisabled();
        }
        for (const botao of within(dialog).getAllByRole("button")) expect(botao).toBeDisabled();
        fireEvent.click(within(dialog).getByRole("button", { name: "Salvando..." }));
        fireEvent.keyDown(dialog, { key: "Escape", code: "Escape" });
        expect(onFechar).not.toHaveBeenCalled();
        expect(onSalvar).toHaveBeenCalledTimes(1);
        await act(async () => concluir());
        await waitFor(() =>
            expect(within(dialog).getByRole("button", { name: "Salvar alterações" })).toBeEnabled()
        );
    });

    it("mostra o erro de campo da API sem duplicar o resumo e preserva os valores", async () => {
        const onSalvar = vi.fn().mockRejectedValue(
            new ApiClientError("Dados inválidos.", {
                status: 400,
                fieldErrors: [
                    {
                        field: "objective",
                        message: "Descreva o objetivo com mais detalhes.",
                    },
                ],
            })
        );
        render(
            <ModalEstudo
                estudo={estudo}
                responsavel={pesquisador}
                onFechar={vi.fn()}
                onSalvar={onSalvar}
            />
        );
        const dialog = await screen.findByRole("dialog");
        fireEvent.click(within(dialog).getByRole("button", { name: "Salvar alterações" }));
        expect(
            await screen.findByText("Descreva o objetivo com mais detalhes.")
        ).toBeInTheDocument();
        expect(screen.queryByText("Dados inválidos.")).not.toBeInTheDocument();
        expect(within(dialog).getByLabelText(/^Objetivo/)).toHaveFocus();
        expect(within(dialog).getByLabelText(/^Objetivo/)).toHaveValue(estudo.objective);
    });

    it.each([
        [401, "Sua sessão expirou. Entre novamente."],
        [403, "Você não tem permissão para realizar esta ação."],
    ] as const)("trata HTTP %s e mantém o formulário disponível", async (status, mensagem) => {
        const onSalvar = vi.fn().mockRejectedValue(new ApiClientError("Acesso negado", { status }));
        render(
            <ModalEstudo
                estudo={estudo}
                responsavel={pesquisador}
                onFechar={vi.fn()}
                onSalvar={onSalvar}
            />
        );
        const dialog = await screen.findByRole("dialog");
        fireEvent.click(within(dialog).getByRole("button", { name: "Salvar alterações" }));
        const alerta = await screen.findByRole("alert");
        expect(alerta).toHaveTextContent(mensagem);
        await waitFor(() => expect(alerta).toHaveFocus());
        expect(within(dialog).getByLabelText(/^Nome do estudo/)).toHaveValue(estudo.title);
        expect(within(dialog).getByRole("button", { name: "Salvar alterações" })).toBeEnabled();
    });
});
