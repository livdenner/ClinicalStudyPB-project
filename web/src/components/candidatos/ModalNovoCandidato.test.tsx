import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cadastrarCandidato } from "../../services/candidatos";
import { respostaHttp, simularHttp } from "../../test/fixtures/agendamento";
import {
    cadastroAtivo,
    cadastroConvidado,
    promessaControlada,
} from "../../test/fixtures/fluxos-web";
import { ModalNovoCandidato } from "./ModalNovoCandidato";

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

function abrirCadastro() {
    const onFechar = vi.fn();
    const onCadastrar = vi.fn((dados: Parameters<typeof cadastrarCandidato>[1]) =>
        cadastrarCandidato(10, dados, "token-ficticio")
    );
    render(
        <ModalNovoCandidato
            estudoTitulo="Estudo fictício"
            onFechar={onFechar}
            onCadastrar={onCadastrar}
        />
    );
    return { onCadastrar, onFechar };
}

function preencher(dados: Partial<Record<"name" | "email" | "phone" | "age", string>> = {}) {
    const valores = {
        name: "  Pessoa fictícia  ",
        email: "PESSOA@example.test",
        phone: "83999990000",
        age: "42",
        ...dados,
    };
    for (const [campo, rotulo] of Object.entries({
        name: "Nome do candidato",
        email: "E-mail",
        phone: "Telefone",
        age: "Idade",
    })) {
        fireEvent.change(screen.getByLabelText(new RegExp(rotulo)), {
            target: { value: valores[campo as keyof typeof valores] },
        });
    }
}

function enviar() {
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar candidato" }));
}

/** Validações e resultados RF08 sem backend real. @author Lívia */
describe("RF08 — cadastro e convite (T17.8)", () => {
    it("RF08-C01: obrigatórios destacam os quatro campos e focam o primeiro sem HTTP", async () => {
        const http = simularHttp({});
        abrirCadastro();
        enviar();
        for (const rotulo of ["Nome do candidato", "E-mail", "Telefone", "Idade"]) {
            expect(screen.getByLabelText(new RegExp(rotulo))).toHaveAttribute(
                "aria-invalid",
                "true"
            );
        }
        await waitFor(() => expect(screen.getByLabelText(/Nome do candidato/)).toHaveFocus());
        expect(http).not.toHaveBeenCalled();
    });

    it.each([
        ["e-mail malformado", { email: "sem-arroba" }, /Informe um e-mail válido/],
        ["telefone com letras", { phone: "telefone" }, /Informe um telefone válido/],
        ["telefone com poucos dígitos", { phone: "(83) --" }, /Informe um telefone válido/],
        ["idade zero", { age: "0" }, /Informe uma idade inteira/],
        ["idade acima do limite", { age: "131" }, /Informe uma idade inteira/],
        ["idade fracionária", { age: "1.5" }, /Informe uma idade inteira/],
        ["nome longo", { name: "a".repeat(121) }, /O nome deve ter até/],
        ["e-mail longo", { email: `${"a".repeat(250)}@example.test` }, /Informe um e-mail válido/],
    ] as const)("RF08-C02: bloqueia %s antes do cadastro", async (_cenario, dados, erro) => {
        const http = simularHttp({});
        abrirCadastro();
        preencher(dados);
        enviar();
        expect(await screen.findByText(erro)).toBeInTheDocument();
        expect(http).not.toHaveBeenCalled();
    });

    it.each([1, 130])("RF08-C03: aceita idade limite %i e normaliza o payload", async (age) => {
        const http = simularHttp({
            "POST /api/studies/10/candidates": respostaHttp(cadastroConvidado, 201),
        });
        abrirCadastro();
        preencher({ age: String(age) });
        fireEvent.blur(screen.getByLabelText(/Telefone/));
        expect(screen.getByLabelText(/Telefone/)).toHaveValue("(83) 99999-0000");
        enviar();
        expect(await screen.findByRole("heading", { name: "Convite emitido" })).toBeInTheDocument();
        expect(JSON.parse(String(http.mock.calls[0][1]?.body))).toEqual({
            name: "Pessoa fictícia",
            email: "pessoa@example.test",
            phone: "(83) 99999-0000",
            age,
        });
        expect(new Headers(http.mock.calls[0][1]?.headers).get("Authorization")).toBe(
            "Bearer token-ficticio"
        );
    });

    it("RF08-C04: e-mail de conta existente mostra vínculo sem código de ativação", async () => {
        simularHttp({ "POST /api/studies/10/candidates": respostaHttp(cadastroAtivo, 201) });
        const { onFechar } = abrirCadastro();
        preencher({ phone: "+55 83 99999-0000" });
        enviar();
        expect(
            await screen.findByRole("heading", { name: "Vinculado a conta existente" })
        ).toBeInTheDocument();
        expect(screen.queryByLabelText("Código de ativação")).not.toBeInTheDocument();
        expect(screen.getByText(/já possui uma conta de participante ativa/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Concluir cadastro" }));
        expect(onFechar).toHaveBeenCalledTimes(1);
    });

    it("RF08-C05: mantém campos e exibe literalmente erro geral e de campo da API", async () => {
        simularHttp({
            "POST /api/studies/10/candidates": respostaHttp(
                {
                    message: "E-mail já vinculado neste estudo.",
                    fieldErrors: [
                        { field: "email", message: "Escolha outro e-mail para esta candidatura." },
                    ],
                },
                409
            ),
        });
        abrirCadastro();
        preencher();
        enviar();
        expect(await screen.findByRole("alert")).toHaveTextContent(
            "E-mail já vinculado neste estudo."
        );
        expect(screen.getByText("Escolha outro e-mail para esta candidatura.")).toBeInTheDocument();
        expect(screen.getByLabelText(/E-mail/)).toHaveValue("PESSOA@example.test");
        expect(screen.getByRole("button", { name: "Cadastrar candidato" })).toBeEnabled();
    });

    it("RF08-C06: bloqueia envios e fechamento durante o cadastro pendente", async () => {
        const pendente = promessaControlada<Response>();
        const http = simularHttp({ "POST /api/studies/10/candidates": pendente.promessa });
        const { onFechar } = abrirCadastro();
        preencher();
        const form = screen.getByRole("button", { name: "Cadastrar candidato" }).closest("form")!;
        fireEvent.submit(form);
        fireEvent.submit(form);
        expect(screen.getByRole("button", { name: "Cadastrando..." })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Fechar modal" })).toBeDisabled();
        expect(http).toHaveBeenCalledTimes(1);
        expect(onFechar).not.toHaveBeenCalled();
        await act(async () => pendente.resolver(respostaHttp(cadastroConvidado, 201)));
        expect(await screen.findByRole("heading", { name: "Convite emitido" })).toBeInTheDocument();
    });

    it("RF08-C07: cancelar ou fechar antes do envio não cadastra", () => {
        const http = simularHttp({});
        const { onFechar } = abrirCadastro();
        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
        fireEvent.click(screen.getByRole("button", { name: "Fechar modal" }));
        expect(onFechar).toHaveBeenCalledTimes(2);
        expect(http).not.toHaveBeenCalled();
    });
});
