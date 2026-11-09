import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { toast } from "@heroui/react";
import type { CalendarDate } from "@internationalized/date";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedUser } from "../../types/auth";
import type { EstudoApi } from "../../types/estudo";
import type { VisitaPrevista } from "../../types/visita-prevista";
import { VisitasPrevistasEstudo } from "./visitas-previstas";

// O calendário possui testes próprios. Aqui exercitamos o valor ISO no formulário.
vi.mock("../../components/estudos/CampoData", async () => {
    const { parseDate } = await import("@internationalized/date");
    return {
        CampoData: ({
            label,
            value,
            onChange,
            isDisabled,
            errorMessage,
        }: {
            label: string;
            value: CalendarDate | null;
            onChange: (value: CalendarDate | null) => void;
            isDisabled?: boolean;
            errorMessage?: string;
        }) => (
            <label>
                {label}
                <input
                    type="date"
                    aria-label={label}
                    value={value?.toString() ?? ""}
                    disabled={isDisabled}
                    onChange={(event) =>
                        onChange(event.target.value ? parseDate(event.target.value) : null)
                    }
                />
                {errorMessage && <span>{errorMessage}</span>}
            </label>
        ),
    };
});

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
const visita: VisitaPrevista = {
    id: 11,
    studyId: 3,
    name: "Avaliação inicial",
    plannedDate: "2026-11-10",
    position: 1,
    activities: [
        { id: 21, name: "Entrevista", description: "Registrar os hábitos de sono.", position: 1 },
        {
            id: 22,
            name: "Questionário",
            description: "Aplicar o questionário inicial.",
            position: 2,
        },
    ],
};

function resposta(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status });
}

function prepararConsulta(visitas: VisitaPrevista[] = [], atual: EstudoApi = estudo) {
    return vi
        .spyOn(globalThis, "fetch")
        .mockRejectedValue(new Error("Requisição inesperada no teste."))
        .mockResolvedValueOnce(resposta(atual))
        .mockResolvedValueOnce(resposta(visitas));
}

function renderVisitas(atual: EstudoApi = estudo, usuario: AuthenticatedUser = pesquisador) {
    const onProcessamentoChange = vi.fn();
    function Tela() {
        const [dados, setDados] = useState(atual);
        return (
            <VisitasPrevistasEstudo
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
    const botao = await screen.findByRole("button", { name: "Nova visita" });
    await waitFor(() => expect(botao).toBeEnabled());
    fireEvent.click(botao);
    return screen.findByRole("dialog", { name: "Nova visita prevista" });
}

function preencherCadastro(dialog: HTMLElement) {
    fireEvent.change(within(dialog).getByLabelText(/^Nome da visita/), {
        target: { value: "Retorno" },
    });
    fireEvent.change(within(dialog).getByLabelText(/^Nome da atividade/), {
        target: { value: "Entrevista" },
    });
    fireEvent.change(within(dialog).getByLabelText(/^Descrição/), {
        target: { value: "Registrar a evolução." },
    });
}

beforeEach(() => {
    vi.spyOn(toast, "success").mockReturnValue("toast-teste");
});
afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe("visitas previstas e atividades — RF06", () => {
    it("cadastra após adicionar e remover atividades e atualiza a lista pela API", async () => {
        const criada: VisitaPrevista = {
            ...visita,
            name: "Retorno",
            activities: [
                { id: 31, name: "Entrevista", description: "Registrar a evolução.", position: 1 },
            ],
        };
        const fetchMock = prepararConsulta()
            .mockResolvedValueOnce(resposta(criada, 201))
            .mockResolvedValueOnce(resposta({ ...estudo, version: 1 }))
            .mockResolvedValueOnce(resposta([criada]));
        renderVisitas();
        expect(
            await screen.findByRole("heading", { name: "Nenhuma visita prevista" })
        ).toBeInTheDocument();
        const dialog = await abrirCadastro();
        preencherCadastro(dialog);
        expect(within(dialog).getByRole("button", { name: "Remover atividade 1" })).toBeDisabled();
        fireEvent.click(within(dialog).getByRole("button", { name: "Adicionar atividade" }));
        expect(within(dialog).getAllByLabelText(/^Nome da atividade/)).toHaveLength(2);
        fireEvent.click(within(dialog).getByRole("button", { name: "Remover atividade 2" }));
        fireEvent.change(within(dialog).getByLabelText("Data prevista"), {
            target: { value: "2026-11-10" },
        });
        fireEvent.click(within(dialog).getByRole("button", { name: "Cadastrar visita" }));
        expect(await screen.findByRole("heading", { name: "Retorno" })).toBeInTheDocument();
        const [url, options] = fetchMock.mock.calls[2];
        expect(url).toBe("/api/studies/3/planned-visits");
        expect(options?.method).toBe("POST");
        expect(new Headers(options?.headers).get("If-Match")).toBe('"0"');
        expect(JSON.parse(String(options?.body))).toEqual({
            name: "Retorno",
            plannedDate: "2026-11-10",
            position: 1,
            activities: [{ name: "Entrevista", description: "Registrar a evolução." }],
        });
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    it("lista atividades e edita durante o recrutamento preservando o ID da atividade restante", async () => {
        const atual: EstudoApi = { ...estudo, status: "RECRUITMENT" };
        const editada = {
            ...visita,
            name: "Avaliação revisada",
            activities: [visita.activities[0]],
        };
        const fetchMock = prepararConsulta([visita], atual)
            .mockResolvedValueOnce(resposta(editada))
            .mockResolvedValueOnce(resposta({ ...atual, version: 1 }))
            .mockResolvedValueOnce(resposta([editada]));
        renderVisitas(atual);
        fireEvent.click(await screen.findByRole("button", { expanded: false }));
        expect(screen.getByText("Aplicar o questionário inicial.")).toBeVisible();
        fireEvent.click(screen.getByRole("button", { name: "Editar visita: Avaliação inicial" }));
        const dialog = await screen.findByRole("dialog", { name: "Editar visita prevista" });
        fireEvent.change(within(dialog).getByLabelText(/^Nome da visita/), {
            target: { value: editada.name },
        });
        fireEvent.click(within(dialog).getByRole("button", { name: "Remover atividade 2" }));
        fireEvent.click(within(dialog).getByRole("button", { name: "Salvar alterações" }));
        expect(await screen.findByRole("heading", { name: editada.name })).toBeInTheDocument();
        const [url, options] = fetchMock.mock.calls[2];
        expect(url).toBe("/api/studies/3/planned-visits/11");
        expect(options?.method).toBe("PUT");
        expect(JSON.parse(String(options?.body))).toEqual({
            name: editada.name,
            plannedDate: visita.plannedDate,
            position: 1,
            activities: [
                { id: 21, name: "Entrevista", description: "Registrar os hábitos de sono." },
            ],
        });
    });

    it("bloqueia visita sem data e atividade sem descrição antes de enviar", async () => {
        const fetchMock = prepararConsulta();
        renderVisitas();
        const dialog = await abrirCadastro();
        preencherCadastro(dialog);
        fireEvent.click(within(dialog).getByRole("button", { name: "Cadastrar visita" }));
        expect(await within(dialog).findByText("Informe a data prevista.")).toBeInTheDocument();
        fireEvent.change(within(dialog).getByLabelText("Data prevista"), {
            target: { value: "2026-11-10" },
        });
        fireEvent.change(within(dialog).getByLabelText(/^Descrição/), { target: { value: "" } });
        fireEvent.click(within(dialog).getByRole("button", { name: "Cadastrar visita" }));
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(dialog).toBeInTheDocument();
    });

    it("apresenta o erro HTTP no campo e conserva os dados digitados", async () => {
        const fetchMock = prepararConsulta().mockResolvedValueOnce(
            resposta(
                {
                    detail: "Revise os campos.",
                    fieldErrors: [{ field: "name", message: "Nome da visita recusado pela API." }],
                },
                400
            )
        );
        renderVisitas();
        const dialog = await abrirCadastro();
        preencherCadastro(dialog);
        fireEvent.change(within(dialog).getByLabelText("Data prevista"), {
            target: { value: "2026-11-10" },
        });
        fireEvent.click(within(dialog).getByRole("button", { name: "Cadastrar visita" }));
        expect(
            await within(dialog).findByText("Nome da visita recusado pela API.")
        ).toBeInTheDocument();
        expect(within(dialog).getByLabelText(/^Nome da visita/)).toHaveValue("Retorno");
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it.each([
        {
            motivo: "execução",
            atual: { ...estudo, status: "EXECUTION" } as EstudoApi,
            usuario: pesquisador,
        },
        {
            motivo: "encerrado",
            atual: { ...estudo, status: "CLOSED" } as EstudoApi,
            usuario: pesquisador,
        },
        {
            motivo: "coordenador",
            atual: estudo,
            usuario: { ...pesquisador, role: "COORDINATOR" } as AuthenticatedUser,
        },
        { motivo: "outro pesquisador", atual: estudo, usuario: { ...pesquisador, id: 8 } },
    ])("permite apenas consulta para $motivo", async ({ atual, usuario }) => {
        const fetchMock = prepararConsulta([visita], atual);
        renderVisitas(atual, usuario);
        expect(await screen.findByRole("heading", { name: visita.name })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Nova visita" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /^Editar visita:/ })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /^Excluir visita:/ })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { expanded: false }));
        expect(screen.getByText("Registrar os hábitos de sono.")).toBeVisible();
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("exclui somente após confirmação e recarrega a lista", async () => {
        const fetchMock = prepararConsulta([visita])
            .mockResolvedValueOnce(new Response(null, { status: 204 }))
            .mockResolvedValueOnce(resposta({ ...estudo, version: 1 }))
            .mockResolvedValueOnce(resposta([]));
        renderVisitas();
        fireEvent.click(
            await screen.findByRole("button", { name: "Excluir visita: Avaliação inicial" })
        );
        let dialog = await screen.findByRole("dialog", { name: "Excluir visita prevista?" });
        fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
        expect(fetchMock).toHaveBeenCalledTimes(2);
        fireEvent.click(screen.getByRole("button", { name: "Excluir visita: Avaliação inicial" }));
        dialog = await screen.findByRole("dialog", { name: "Excluir visita prevista?" });
        fireEvent.click(within(dialog).getByRole("button", { name: "Excluir visita" }));
        expect(
            await screen.findByRole("heading", { name: "Nenhuma visita prevista" })
        ).toBeInTheDocument();
        expect(fetchMock.mock.calls[2][1]?.method).toBe("DELETE");
    });
});
