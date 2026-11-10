import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { toast } from "@heroui/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "../../types/auth";
import type { EstudoApi } from "../../types/estudo";
import {
    TIPOS_CRITERIO_ESTUDO,
    type CriterioEstudo,
    type TipoCriterioEstudo,
} from "../../types/criterio-estudo";
import { CriteriosEstudo } from "./criterios";

const estudo: EstudoApi = {
    id: 3,
    version: 0,
    status: "PLANNING",
    title: "Estudo do sono",
    objective: "Avaliar hábitos de sono",
    responsibleUserId: 7,
    participantLimit: 30,
    startDate: "2026-11-01",
    endDate: "2026-12-01",
};
const pesquisador: AuthenticatedUser = {
    id: 7,
    name: "Ana Silva",
    email: "ana@example.test",
    role: "RESEARCHER",
    active: true,
};
const criterios: CriterioEstudo[] = [
    { id: 11, studyId: 3, type: "INCLUSION", description: "Idade mínima de 18 anos." },
    { id: 12, studyId: 3, type: "EXCLUSION", description: "Alergia ao medicamento do estudo." },
];

function resposta(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status });
}

function prepararConsulta(lista: CriterioEstudo[] = [], atual: EstudoApi = estudo) {
    return vi
        .spyOn(globalThis, "fetch")
        .mockRejectedValue(new Error("Requisição inesperada no teste."))
        .mockResolvedValueOnce(resposta(atual))
        .mockResolvedValueOnce(resposta(lista));
}

function renderCriterios(atual: EstudoApi = estudo, usuario: AuthenticatedUser = pesquisador) {
    const onProcessamentoChange = vi.fn();
    function Tela() {
        const [dados, setDados] = useState(atual);
        return (
            <CriteriosEstudo
                estudo={dados}
                usuario={usuario}
                token="token-teste"
                onAtualizarEstudo={setDados}
                onProcessamentoChange={onProcessamentoChange}
            />
        );
    }
    return render(<Tela />);
}

async function abrirCadastro() {
    const botao = await screen.findByRole("button", { name: "Novo critério" });
    await waitFor(() => expect(botao).toBeEnabled());
    fireEvent.click(botao);
    return screen.findByRole("dialog", { name: "Novo critério" });
}

async function selecionarTipo(dialog: HTMLElement, tipo: TipoCriterioEstudo) {
    fireEvent.click(within(dialog).getByRole("button", { name: /Tipo de critério/ }));
    fireEvent.click(await screen.findByRole("option", { name: TIPOS_CRITERIO_ESTUDO[tipo] }));
}

beforeEach(() => {
    vi.spyOn(toast, "success").mockReturnValue("toast-teste");
});

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe("critérios de inclusão e exclusão — RF05", () => {
    it.each([
        { tipo: "INCLUSION" as const, estado: "PLANNING" as const, grupo: "inclusão" },
        { tipo: "EXCLUSION" as const, estado: "RECRUITMENT" as const, grupo: "exclusão" },
    ])(
        "cadastra $grupo em $estado e recarrega a lista pela API",
        async ({ tipo, estado, grupo }) => {
            const atual: EstudoApi = { ...estudo, status: estado };
            const criado: CriterioEstudo = {
                id: 21,
                studyId: 3,
                type: tipo,
                description: "Condição de participação.",
            };
            let concluir!: (response: Response) => void;
            const pendente = new Promise<Response>((resolve) => {
                concluir = resolve;
            });
            const fetchMock = prepararConsulta([], atual)
                .mockReturnValueOnce(pendente)
                .mockResolvedValueOnce(resposta({ ...atual, version: 1 }))
                .mockResolvedValueOnce(resposta([criado]));
            renderCriterios(atual);
            expect(
                await screen.findByText("Nenhum critério de inclusão cadastrado.")
            ).toBeInTheDocument();
            expect(screen.getByText("Nenhum critério de exclusão cadastrado.")).toBeInTheDocument();
            const dialog = await abrirCadastro();
            await selecionarTipo(dialog, tipo);
            fireEvent.change(within(dialog).getByRole("textbox", { name: /Descrição/ }), {
                target: { value: "  Condição de participação.  " },
            });
            fireEvent.click(within(dialog).getByRole("button", { name: "Cadastrar critério" }));
            await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
            expect(within(dialog).getByRole("textbox", { name: /Descrição/ })).toBeDisabled();
            for (const botao of within(dialog).getAllByRole("button")) expect(botao).toBeDisabled();
            fireEvent.click(within(dialog).getByRole("button", { name: "Cadastrando..." }));
            expect(fetchMock).toHaveBeenCalledTimes(3);
            const [url, options] = fetchMock.mock.calls[2];
            expect(url).toBe("/api/studies/3/criteria");
            expect(options?.method).toBe("POST");
            expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer token-teste");
            expect(JSON.parse(String(options?.body))).toEqual({
                type: tipo,
                description: criado.description,
            });
            await act(async () => concluir(resposta(criado, 201)));
            expect(
                await within(
                    screen.getByRole("region", { name: `Critérios de ${grupo}` })
                ).findByText(criado.description)
            ).toBeInTheDocument();
            await waitFor(() =>
                expect(screen.getByRole("button", { name: "Novo critério" })).toBeEnabled()
            );
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
            expect(fetchMock.mock.calls.slice(3).map(([endereco]) => endereco)).toEqual([
                "/api/studies/3",
                "/api/studies/3/criteria",
            ]);
            expect(toast.success).toHaveBeenCalledWith("Critério cadastrado com sucesso.");
        }
    );

    it("bloqueia tipo ausente e descrição vazia ou composta de espaços", async () => {
        const fetchMock = prepararConsulta();
        renderCriterios();
        const dialog = await abrirCadastro();
        fireEvent.click(within(dialog).getByRole("button", { name: "Cadastrar critério" }));
        expect(
            await within(dialog).findByText("Selecione o tipo de critério.")
        ).toBeInTheDocument();
        expect(within(dialog).getByText("Informe a descrição do critério.")).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledTimes(2);
        await selecionarTipo(dialog, "INCLUSION");
        fireEvent.change(within(dialog).getByRole("textbox", { name: /Descrição/ }), {
            target: { value: "   " },
        });
        fireEvent.click(within(dialog).getByRole("button", { name: "Cadastrar critério" }));
        expect(
            await within(dialog).findByText("Informe a descrição do critério.")
        ).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("exibe o erro HTTP 400 no campo e preserva os dados do formulário", async () => {
        const mensagem = "Descreva melhor a condição de participação.";
        const fetchMock = prepararConsulta().mockResolvedValueOnce(
            resposta(
                {
                    detail: "Dados inválidos.",
                    fieldErrors: [{ field: "description", message: mensagem }],
                },
                400
            )
        );
        renderCriterios();
        const dialog = await abrirCadastro();
        await selecionarTipo(dialog, "EXCLUSION");
        fireEvent.change(within(dialog).getByRole("textbox", { name: /Descrição/ }), {
            target: { value: "Condição de exclusão." },
        });
        fireEvent.click(within(dialog).getByRole("button", { name: "Cadastrar critério" }));
        expect(await within(dialog).findByText(mensagem)).toBeInTheDocument();
        expect(within(dialog).queryByText("Dados inválidos.")).not.toBeInTheDocument();
        expect(within(dialog).getByRole("textbox", { name: /Descrição/ })).toHaveValue(
            "Condição de exclusão."
        );
        expect(within(dialog).getByRole("button", { name: /Tipo de critério/ })).toHaveTextContent(
            "Exclusão"
        );
        expect(within(dialog).getByRole("button", { name: "Cadastrar critério" })).toBeEnabled();
        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(toast.success).not.toHaveBeenCalled();
    });

    it("exibe o bloqueio HTTP 409 e exige atualizar antes de outra submissão", async () => {
        const mensagem = "O protocolo só pode ser alterado em PLANNING ou RECRUITMENT.";
        const fetchMock = prepararConsulta(criterios)
            .mockResolvedValueOnce(resposta({ detail: mensagem }, 409))
            .mockResolvedValueOnce(resposta({ ...estudo, status: "EXECUTION", version: 1 }))
            .mockResolvedValueOnce(resposta(criterios));
        renderCriterios();
        const dialog = await abrirCadastro();
        await selecionarTipo(dialog, "INCLUSION");
        fireEvent.change(within(dialog).getByRole("textbox", { name: /Descrição/ }), {
            target: { value: "Disponibilidade para visitas." },
        });
        fireEvent.click(within(dialog).getByRole("button", { name: "Cadastrar critério" }));
        expect(await within(dialog).findByRole("alert")).toHaveTextContent(mensagem);
        expect(within(dialog).getByRole("textbox", { name: /Descrição/ })).toBeDisabled();
        expect(within(dialog).getByRole("button", { name: "Cadastrar critério" })).toBeDisabled();
        fireEvent.click(within(dialog).getByRole("button", { name: "Cadastrar critério" }));
        expect(fetchMock).toHaveBeenCalledTimes(3);
        fireEvent.click(within(dialog).getByRole("button", { name: "Atualizar dados" }));
        await screen.findByText("Somente leitura");
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Novo critério" })).not.toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledTimes(5);
    });

    it.each([
        {
            motivo: "coordenador",
            atual: estudo,
            usuario: { ...pesquisador, role: "COORDINATOR" as const },
        },
        { motivo: "outro pesquisador", atual: estudo, usuario: { ...pesquisador, id: 8 } },
        {
            motivo: "estudo em execução",
            atual: { ...estudo, status: "EXECUTION" as const },
            usuario: pesquisador,
        },
    ])("permite somente consulta para $motivo", async ({ atual, usuario }) => {
        const fetchMock = prepararConsulta(criterios, atual);
        renderCriterios(atual, usuario);
        expect(await screen.findByText(criterios[0].description)).toBeInTheDocument();
        expect(screen.getByText(criterios[1].description)).toBeInTheDocument();
        expect(screen.getByText("Somente leitura")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Novo critério" })).not.toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("recupera falha de consulta e separa os critérios de inclusão e exclusão", async () => {
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockRejectedValue(new Error("Requisição inesperada no teste."))
            .mockResolvedValueOnce(resposta(estudo))
            .mockResolvedValueOnce(resposta({ detail: "Critérios indisponíveis no momento." }, 500))
            .mockResolvedValueOnce(resposta(estudo))
            .mockResolvedValueOnce(resposta(criterios));
        renderCriterios();
        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Critérios indisponíveis no momento."
        );
        expect(screen.getByRole("button", { name: "Novo critério" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
        const inclusao = await screen.findByRole("region", { name: "Critérios de inclusão" });
        const exclusao = screen.getByRole("region", { name: "Critérios de exclusão" });
        expect(within(inclusao).getByText(criterios[0].description)).toBeInTheDocument();
        expect(within(inclusao).queryByText(criterios[1].description)).not.toBeInTheDocument();
        expect(within(exclusao).getByText(criterios[1].description)).toBeInTheDocument();
        expect(within(exclusao).queryByText(criterios[0].description)).not.toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledTimes(4);
    });
});
