import {
    act,
    cleanup,
    fireEvent,
    render,
    renderHook,
    screen,
    waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CabecalhoEstudo } from "../../components/estudos/CabecalhoEstudo";
import { ESTADOS_ESTUDO } from "../../config/estados-estudo";
import type { EstadoEstudo, EstudoApi } from "../../types/estudo";
import { useRequisitosTransicao } from "./useRequisitosTransicao";

const estudo: EstudoApi = {
    id: 3,
    version: 0,
    status: "PLANNING",
    title: "Estudo do sono",
    objective: "Objetivo",
    responsibleUserId: 7,
    participantLimit: 10,
    startDate: "2026-11-01",
    endDate: "2026-12-01",
};
const criterios = [{ type: "INCLUSION" }, { type: "EXCLUSION" }];
const visitas = [{ activities: [{ id: 1 }] }];
function resposta(dados: unknown, status = 200) {
    return new Response(JSON.stringify(dados), { status });
}
type Dados = {
    criterios?: unknown[];
    visitas?: unknown[];
    participantes?: unknown[];
    agendadas?: unknown[];
};
function consultar(dados: Dados = {}) {
    return vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
        const path = String(url);
        if (path.endsWith("/criteria")) return resposta(dados.criterios ?? criterios);
        if (path.endsWith("/planned-visits")) return resposta(dados.visitas ?? visitas);
        if (path.endsWith("/participants")) return resposta(dados.participantes ?? [{ id: 1 }]);
        if (path.endsWith("/visits?status=SCHEDULED")) return resposta(dados.agendadas ?? []);
        throw new Error(`Requisição inesperada: ${path}`);
    });
}
function montar(estado: EstadoEstudo = "PLANNING") {
    const onTransicionar = vi.fn();
    function Tela({ version = 0 }: { version?: number }) {
        const atual = { ...estudo, status: estado, version };
        const requisitos = useRequisitosTransicao(atual, "token-teste", true);
        const config = ESTADOS_ESTUDO[estado];
        return (
            <CabecalhoEstudo
                estudo={atual}
                edicaoPermitida={estado === "PLANNING" || estado === "RECRUITMENT"}
                mensagemBloqueio="Somente leitura"
                emProcessamento={false}
                alteracaoEstadoPermitida
                origemCancelamento="PLANNING"
                proximaTransicao={
                    config.proximo ? { estado: config.proximo, rotulo: config.acao } : null
                }
                requisitosTransicao={requisitos}
                onEditar={vi.fn()}
                onTransicionar={onTransicionar}
            />
        );
    }
    return { ...render(<Tela />), onTransicionar, Tela };
}
function abrirMenu() {
    fireEvent.click(screen.getByRole("button", { name: "Alterar estado" }));
}
async function acaoVerificada(nome: string) {
    const acao = screen.getByRole("menuitem", { name: nome });
    await waitFor(() =>
        expect(screen.queryByText("Verificando requisitos…")).not.toBeInTheDocument()
    );
    return acao;
}
afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

it.each([
    {
        criterios: [],
        visitas: [],
        motivos: ["critério de inclusão", "critério de exclusão", "visita prevista com atividade"],
    },
    { criterios: [{ type: "EXCLUSION" }], visitas, motivos: ["critério de inclusão"] },
    { criterios: [{ type: "INCLUSION" }], visitas, motivos: ["critério de exclusão"] },
    { criterios, visitas: [{ activities: [] }], motivos: ["visita prevista com atividade"] },
])("bloqueia abrir recrutamento e explica os requisitos ausentes: $motivos", async (dados) => {
    const fetchMock = consultar(dados);
    const { onTransicionar } = montar();
    expect(fetchMock).not.toHaveBeenCalled();
    abrirMenu();
    const acao = await acaoVerificada("Abrir recrutamento");
    expect(acao).toHaveAttribute("aria-disabled", "true");
    for (const motivo of dados.motivos)
        expect(acao).toHaveAccessibleDescription(new RegExp(motivo));
    fireEvent.click(acao);
    expect(onTransicionar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("menuitem", { name: "Cancelar estudo" }));
    expect(onTransicionar).toHaveBeenCalledExactlyOnceWith("CANCELLED");
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
        "/api/studies/3/criteria",
        "/api/studies/3/planned-visits",
    ]);
});

it.each([
    { estado: "PLANNING" as const, nome: "Abrir recrutamento", destino: "RECRUITMENT", dados: {} },
    {
        estado: "RECRUITMENT" as const,
        nome: "Iniciar execução",
        destino: "EXECUTION",
        dados: { participantes: [{ id: 1, status: "WITHDRAWN" }] },
    },
    {
        estado: "EXECUTION" as const,
        nome: "Encerrar estudo",
        destino: "CLOSED",
        dados: { agendadas: [] },
    },
])("libera $nome quando os requisitos são atendidos", async ({ estado, nome, destino, dados }) => {
    consultar(dados);
    const { onTransicionar } = montar(estado);
    abrirMenu();
    const acao = await acaoVerificada(nome);
    expect(acao).not.toHaveAttribute("aria-disabled", "true");
    fireEvent.click(acao);
    expect(onTransicionar).toHaveBeenCalledExactlyOnceWith(destino);
});

it.each([
    {
        estado: "RECRUITMENT" as const,
        nome: "Iniciar execução",
        dados: { participantes: [] },
        motivo: /Inclua ao menos um participante/,
        path: "/api/studies/3/participants",
    },
    {
        estado: "EXECUTION" as const,
        nome: "Encerrar estudo",
        dados: { agendadas: [{ id: 1 }] },
        motivo: /Registre o desfecho/,
        path: "/api/studies/3/visits?status=SCHEDULED",
    },
])(
    "bloqueia $nome consultando somente os dados desse estado",
    async ({ estado, nome, dados, motivo, path }) => {
        const fetchMock = consultar(dados);
        const { onTransicionar } = montar(estado);
        abrirMenu();
        const acao = await acaoVerificada(nome);
        expect(acao).toHaveAttribute("aria-disabled", "true");
        expect(acao).toHaveAccessibleDescription(motivo);
        fireEvent.click(acao);
        expect(onTransicionar).not.toHaveBeenCalled();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0][0]).toBe(path);
        expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("Authorization")).toBe(
            "Bearer token-teste"
        );
        if (estado === "RECRUITMENT") {
            fireEvent.click(screen.getByRole("menuitem", { name: "Voltar ao planejamento" }));
            expect(onTransicionar).toHaveBeenCalledExactlyOnceWith("PLANNING");
        }
    }
);

it("mantém cancelar e voltar disponíveis durante a consulta e após erro; permite tentar novamente", async () => {
    let rejeitar!: (error: Error) => void;
    vi.spyOn(globalThis, "fetch")
        .mockImplementationOnce(
            () =>
                new Promise<Response>((_resolve, reject) => {
                    rejeitar = reject;
                })
        )
        .mockResolvedValueOnce(resposta([{ id: 1 }]));
    montar("RECRUITMENT");
    abrirMenu();
    expect(screen.getByRole("menuitem", { name: "Iniciar execução" })).toHaveAttribute(
        "aria-disabled",
        "true"
    );
    expect(screen.getByText("Verificando requisitos…")).toBeVisible();
    for (const nome of ["Cancelar estudo", "Voltar ao planejamento"])
        expect(screen.getByRole("menuitem", { name: nome })).not.toHaveAttribute(
            "aria-disabled",
            "true"
        );
    await act(async () => rejeitar(new Error("Offline")));
    expect(
        screen.getByText("Não foi possível verificar os requisitos. Tente novamente.")
    ).toBeVisible();
    fireEvent.click(screen.getByRole("menuitem", { name: "Verificar requisitos novamente" }));
    expect(await acaoVerificada("Iniciar execução")).not.toHaveAttribute("aria-disabled", "true");
});

it("refaz a consulta ao reabrir o menu e após atualização do protocolo", async () => {
    const fetchMock = consultar();
    const { rerender, Tela } = montar();
    abrirMenu();
    await acaoVerificada("Abrir recrutamento");
    const primeira = fetchMock.mock.calls.length;
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    abrirMenu();
    await acaoVerificada("Abrir recrutamento");
    expect(fetchMock).toHaveBeenCalledTimes(primeira + 2);
    fetchMock.mockImplementation(async () => resposta([]));
    rerender(<Tela version={1} />);
    const acao = await acaoVerificada("Abrir recrutamento");
    expect(acao).toHaveAttribute("aria-disabled", "true");
    expect(acao).toHaveAccessibleDescription(/critério de inclusão/);
    expect(fetchMock).toHaveBeenCalledTimes(primeira + 4);
});

it("cancela consulta ao fechar e ignora resposta antiga após reabrir", async () => {
    let concluir!: (response: Response) => void;
    const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockImplementationOnce(
            () =>
                new Promise<Response>((resolve) => {
                    concluir = resolve;
                })
        )
        .mockResolvedValueOnce(resposta([]));
    const { result, unmount } = renderHook(() =>
        useRequisitosTransicao({ ...estudo, status: "RECRUITMENT" }, "token", true)
    );
    act(() => result.current.onMenuChange(true));
    const signal = fetchMock.mock.calls[0][1]?.signal;
    act(() => result.current.onMenuChange(false));
    expect(signal?.aborted).toBe(true);
    act(() => result.current.onMenuChange(true));
    await waitFor(() => expect(result.current.motivo).toMatch(/Inclua ao menos um participante/));
    await act(async () => concluir(resposta([{ id: 1 }])));
    expect(result.current.motivo).toMatch(/Inclua ao menos um participante/);
    const atual = fetchMock.mock.calls[1][1]?.signal;
    unmount();
    expect(atual?.aborted).toBe(true);
});

it.each(["CLOSED", "CANCELLED", "SEM_PERMISSAO"])("não consulta requisitos em %s", (contexto) => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const { result } = renderHook(() =>
        useRequisitosTransicao(
            {
                ...estudo,
                status: contexto === "SEM_PERMISSAO" ? "PLANNING" : (contexto as EstadoEstudo),
            },
            "token",
            contexto !== "SEM_PERMISSAO"
        )
    );
    act(() => result.current.onMenuChange(true));
    expect(fetchMock).not.toHaveBeenCalled();
});
