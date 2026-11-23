import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    estudoAgendamento,
    respostaHttp,
    simularHttp,
    visitaAgendada,
} from "../../test/fixtures/agendamento";
import { promessaControlada, resultadosFluxo } from "../../test/fixtures/fluxos-web";
import type { EstadoEstudo } from "../../types/estudo";
import type { ResultadosVisita } from "../../types/resultado-atividade";
import type { UserRole } from "../../types/auth";
import { ModalResultadosVisita } from "./ModalResultadosVisita";

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});
const path = "/api/studies/10/participants/50/visits/80/results";
const resultado = {
    activityId: 11,
    visitId: 80,
    value: "Valor confirmado",
    recordedByUserId: 2,
    recordedAt: "2027-02-10T13:00:00Z",
};
const visita = { ...visitaAgendada, status: "DONE" as const };
function rotas(dados: ResultadosVisita = resultadosFluxo) {
    return {
        [`GET ${path}`]: respostaHttp(dados),
        "GET /api/studies/10": respostaHttp(estudoAgendamento),
    };
}
function abrir(role: UserRole = "RESEARCHER", id = 2) {
    const props = {
        visita,
        usuario: { id, role },
        token: "token-ficticio",
        onFechar: vi.fn(),
        onEstudoAtualizado: vi.fn(),
    };
    return { ...render(<ModalResultadosVisita {...props} />), props };
}
async function primeira() {
    return screen.findByRole("region", { name: "1. Primeira atividade fictícia" });
}
function preencher(region: HTMLElement, value = "Valor fictício") {
    fireEvent.change(within(region).getByLabelText(/^Resultado/), { target: { value } });
}
function enviar(region: HTMLElement) {
    fireEvent.click(within(region).getByRole("button", { name: /^Salvar resultado:/ }));
}

/** Consulta, gravação e recuperação RF14 usando os serviços reais sobre HTTP simulado. @author Lívia */
describe("RF14 — resultados da visita (T20.5)", () => {
    it("RF14-M16: sessão rejeitada impede novas gravações sem repetir o PUT", async () => {
        const http = simularHttp({
            ...rotas(),
            [`PUT ${path}/11`]: respostaHttp({ message: "Sessão expirada na API." }, 401),
        });
        abrir();
        const region = await primeira();
        preencher(region, "Rascunho fictício");
        enviar(region);
        expect(await within(region).findByRole("alert")).toHaveTextContent(
            "Sessão expirada na API."
        );
        expect(within(region).getByLabelText(/^Resultado/)).toHaveAttribute("readonly");
        expect(
            screen.queryByRole("button", { name: /^Salvar resultado:/ })
        ).not.toBeInTheDocument();
        expect(http.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(1);
        expect(http.mock.calls.filter(([url]) => url === path)).toHaveLength(1);
    });

    it("RF14-M01: apresenta um campo por atividade na ordem do protocolo", async () => {
        simularHttp(rotas());
        abrir();
        await primeira();
        expect(
            screen.getAllByRole("heading", { level: 3 }).map((item) => item.textContent)
        ).toEqual(["1. Primeira atividade fictícia", "2. Segunda atividade fictícia"]);
        expect(screen.getAllByRole("textbox", { name: /^Resultado/ })).toHaveLength(2);
        expect(screen.getAllByRole("button", { name: /^Salvar resultado:/ })).toHaveLength(2);
    });

    it("RF14-M02: criação 201 atualiza somente a atividade confirmada pela API", async () => {
        const http = simularHttp({ ...rotas(), [`PUT ${path}/11`]: respostaHttp(resultado, 201) });
        abrir();
        const region = await primeira();
        preencher(region, "  Valor fictício  ");
        enviar(region);
        expect(await within(region).findByText("Resultado salvo.")).toBeInTheDocument();
        expect(within(region).getByLabelText(/^Resultado/)).toHaveValue("Valor confirmado");
        expect(within(region).getByText("Registrado")).toBeInTheDocument();
        expect(
            within(screen.getByRole("region", { name: /Segunda atividade/ })).getByLabelText(
                /^Resultado/
            )
        ).toHaveValue("");
        const put = http.mock.calls.find(([, init]) => init?.method === "PUT")!;
        expect(put[0]).toBe(`${path}/11`);
        expect(JSON.parse(String(put[1]?.body))).toEqual({ value: "Valor fictício" });
        expect(new Headers(put[1]?.headers).get("Authorization")).toBe("Bearer token-ficticio");
    });

    it("RF14-M03: edição 200 substitui resultado e remove observação omitida", async () => {
        const dados: ResultadosVisita = {
            ...resultadosFluxo,
            activities: [
                {
                    ...resultadosFluxo.activities[1],
                    result: { ...resultado, value: "Valor anterior", note: "Observação anterior" },
                },
            ],
        };
        const http = simularHttp({ ...rotas(dados), [`PUT ${path}/11`]: respostaHttp(resultado) });
        abrir();
        const region = await primeira();
        expect(within(region).getByLabelText(/^Resultado/)).toHaveValue("Valor anterior");
        preencher(region, "Valor revisado");
        fireEvent.change(within(region).getByLabelText("Observação"), { target: { value: "" } });
        enviar(region);
        expect(await within(region).findByText("Resultado salvo.")).toBeInTheDocument();
        expect(within(region).getByLabelText("Observação")).toHaveValue("");
        const put = http.mock.calls.find(([, init]) => init?.method === "PUT")!;
        expect(JSON.parse(String(put[1]?.body))).toEqual({ value: "Valor revisado" });
    });

    it("RF14-M04: reabrir consulta novamente o resultado persistido", async () => {
        const registrado = {
            ...resultadosFluxo,
            activities: [{ ...resultadosFluxo.activities[1], result: resultado }],
        };
        const http = simularHttp({
            ...rotas(),
            [`GET ${path}`]: [respostaHttp(resultadosFluxo), respostaHttp(registrado)],
            [`PUT ${path}/11`]: respostaHttp(resultado, 201),
        });
        const primeiraAbertura = abrir();
        const region = await primeira();
        preencher(region);
        enviar(region);
        expect(await within(region).findByText("Resultado salvo.")).toBeInTheDocument();
        primeiraAbertura.unmount();
        abrir();
        expect(within(await primeira()).getByLabelText(/^Resultado/)).toHaveValue(
            "Valor confirmado"
        );
        expect(
            http.mock.calls.filter(
                ([url, init]) => url === path && (!init?.method || init.method === "GET")
            )
        ).toHaveLength(2);
    });

    it.each(["SCHEDULED", "ABSENT", "CANCELLED"] as const)(
        "RF14-M05: situação atual %s mantém resultados em consulta",
        async (status) => {
            const http = simularHttp(rotas({ ...resultadosFluxo, status }));
            abrir();
            expect(within(await primeira()).getByLabelText(/^Resultado/)).toHaveAttribute(
                "readonly"
            );
            expect(
                screen.queryByRole("button", { name: /^Salvar resultado:/ })
            ).not.toBeInTheDocument();
            expect(http.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(false);
        }
    );

    it.each<[UserRole, number]>([
        ["COORDINATOR", 9],
        ["RESEARCHER", 999],
    ])(
        "RF14-M06: perfil %s e usuário %i não autorizado consultam sem gravação",
        async (role, id) => {
            simularHttp(rotas());
            abrir(role, id);
            await primeira();
            expect(screen.getByRole("note")).toHaveTextContent("Consulta de resultados.");
            expect(
                screen.queryByRole("button", { name: /^Salvar resultado:/ })
            ).not.toBeInTheDocument();
        }
    );

    it.each<EstadoEstudo>(["CLOSED", "CANCELLED"])(
        "RF14-M07: estudo %s impede edição",
        async (status) => {
            simularHttp({
                ...rotas(),
                "GET /api/studies/10": respostaHttp({ ...estudoAgendamento, status }),
            });
            abrir();
            await primeira();
            expect(
                screen.queryByRole("button", { name: /^Salvar resultado:/ })
            ).not.toBeInTheDocument();
        }
    );

    it("RF14-M08: erro 400 é literal e mantém rascunho sem alterar a outra atividade", async () => {
        const http = simularHttp({
            ...rotas(),
            [`PUT ${path}/11`]: respostaHttp(
                { message: "Resultado fictício recusado pela API." },
                400
            ),
        });
        abrir();
        const region = await primeira();
        preencher(region, "Rascunho fictício");
        enviar(region);
        expect(await within(region).findByRole("alert")).toHaveTextContent(
            "Resultado fictício recusado pela API."
        );
        expect(within(region).getByLabelText(/^Resultado/)).toHaveValue("Rascunho fictício");
        expect(http.mock.calls.filter(([url]) => url === `${path}/12`)).toHaveLength(0);
    });

    it.each([403, 404, 409])(
        "RF14-M09: erro %i atualiza contexto e não repete o PUT",
        async (status) => {
            const http = simularHttp({
                ...rotas(),
                [`PUT ${path}/11`]: respostaHttp(
                    { message: `Mensagem literal ${status}.` },
                    status
                ),
                "GET /api/studies/10": [
                    respostaHttp(estudoAgendamento),
                    respostaHttp({ ...estudoAgendamento, status: "CLOSED" }),
                ],
            });
            abrir();
            const region = await primeira();
            preencher(region, "Rascunho preservado");
            enviar(region);
            expect(await within(region).findByRole("alert")).toHaveTextContent(
                `Mensagem literal ${status}.`
            );
            await waitFor(() =>
                expect(within(region).getByLabelText(/^Resultado/)).toHaveAttribute("readonly")
            );
            expect(within(region).getByLabelText(/^Resultado/)).toHaveValue("Rascunho preservado");
            expect(http.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(1);
            expect(http.mock.calls.filter(([url]) => url === "/api/studies/10")).toHaveLength(2);
        }
    );

    it("RF14-M10: falha na recuperação após conflito bloqueia salvar até Atualizar dados", async () => {
        const http = simularHttp({
            ...rotas(),
            [`GET ${path}`]: [
                respostaHttp(resultadosFluxo),
                respostaHttp({ message: "Consulta indisponível." }, 503),
                respostaHttp(resultadosFluxo),
            ],
            [`PUT ${path}/11`]: respostaHttp({ message: "Visita alterada por outra pessoa." }, 409),
        });
        abrir();
        const region = await primeira();
        preencher(region);
        enviar(region);
        expect(await screen.findByText("Consulta indisponível.")).toBeInTheDocument();
        expect(within(region).getByRole("button", { name: /^Salvar resultado:/ })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "Atualizar dados" }));
        await waitFor(() =>
            expect(within(region).getByRole("button", { name: /^Salvar resultado:/ })).toBeEnabled()
        );
        expect(http.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(1);
    });

    it("RF14-M11: erro ao carregar é literal e Tentar novamente refaz a consulta", async () => {
        const http = simularHttp({
            ...rotas(),
            [`GET ${path}`]: [
                respostaHttp({ message: "Resultados temporariamente indisponíveis." }, 503),
                respostaHttp(resultadosFluxo),
            ],
        });
        abrir();
        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Resultados temporariamente indisponíveis."
        );
        fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
        expect(await primeira()).toBeInTheDocument();
        expect(http.mock.calls.filter(([url]) => url === path)).toHaveLength(2);
    });

    it("RF14-M12: visita sem atividades mostra orientação sem formulário fictício", async () => {
        simularHttp(rotas({ ...resultadosFluxo, activities: [] }));
        abrir();
        expect(
            await screen.findByText("Nenhuma atividade disponível nesta visita.")
        ).toBeInTheDocument();
        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("RF14-M13: gravação pendente bloqueia outras atividades e fechamento", async () => {
        const pendente = promessaControlada<Response>();
        const http = simularHttp({ ...rotas(), [`PUT ${path}/11`]: pendente.promessa });
        const { props } = abrir();
        const region = await primeira();
        preencher(region);
        enviar(region);
        for (const button of screen.getAllByRole("button", { name: /^Salvar resultado:/ }))
            expect(button).toBeDisabled();
        expect(screen.getByRole("button", { name: "Fechar resultados" })).toBeDisabled();
        expect(props.onFechar).not.toHaveBeenCalled();
        expect(http.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(1);
        await act(async () => pendente.resolver(respostaHttp(resultado, 201)));
        expect(await within(region).findByText("Resultado salvo.")).toBeInTheDocument();
    });

    it("RF14-M14: atividade removida na recuperação preserva mensagem de erro no modal", async () => {
        simularHttp({
            ...rotas(),
            [`GET ${path}`]: [
                respostaHttp(resultadosFluxo),
                respostaHttp({ ...resultadosFluxo, activities: [] }),
            ],
            [`PUT ${path}/11`]: respostaHttp(
                { message: "A atividade não pertence mais a esta visita." },
                404
            ),
        });
        abrir();
        const region = await primeira();
        preencher(region);
        enviar(region);
        expect(
            await screen.findByText("Nenhuma atividade disponível nesta visita.")
        ).toBeInTheDocument();
        expect(screen.getByRole("alert")).toHaveTextContent(
            "A atividade não pertence mais a esta visita."
        );
    });

    it("RF14-M15: fechar consulta não grava nem modifica o estudo", async () => {
        const http = simularHttp(rotas());
        const { props } = abrir();
        await primeira();
        fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
        expect(props.onFechar).toHaveBeenCalledTimes(1);
        expect(http.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(false);
    });
});
