import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BuscaFiltroUsuarios } from "./BuscaFiltroUsuarios";
import type { UserRole } from "../../types/auth";
import type { FiltroSituacaoUsuario } from "../../types/usuario";

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

function renderFiltros(perfil: UserRole | "" = "", situacao: FiltroSituacaoUsuario = "") {
    const callbacks = {
        aoMudarBusca: vi.fn(),
        aoMudarPerfil: vi.fn(),
        aoMudarSituacao: vi.fn(),
    };
    render(<BuscaFiltroUsuarios busca="" perfil={perfil} situacao={situacao} {...callbacks} />);
    return callbacks;
}

describe("BuscaFiltroUsuarios", () => {
    it("envia o texto digitado para o callback de busca", () => {
        const { aoMudarBusca } = renderFiltros();
        fireEvent.change(screen.getByLabelText("Buscar por nome ou e-mail"), {
            target: { value: "ana@example.test" },
        });
        expect(aoMudarBusca).toHaveBeenCalledWith("ana@example.test");
    });

    it.each([
        ["Administrador", "ADMINISTRATOR"],
        ["Coordenador", "COORDINATOR"],
        ["Pesquisador", "RESEARCHER"],
        ["Participante", "PARTICIPANT"],
    ])("converte a seleção de %s para o perfil esperado", async (rotulo, perfil) => {
        const { aoMudarPerfil } = renderFiltros();
        fireEvent.click(screen.getByRole("button", { name: /Perfil/ }));
        fireEvent.click(await screen.findByRole("option", { name: rotulo }));
        expect(aoMudarPerfil).toHaveBeenCalledWith(perfil);
    });

    it.each([
        ["Ativo", "ativo"],
        ["Inativo", "inativo"],
    ])("converte a seleção de %s para a situação esperada", async (rotulo, situacao) => {
        const { aoMudarSituacao } = renderFiltros();
        fireEvent.click(screen.getByRole("button", { name: /Situação/ }));
        fireEvent.click(await screen.findByRole("option", { name: rotulo }));
        expect(aoMudarSituacao).toHaveBeenCalledWith(situacao);
    });

    it("limpa os filtros com Todos os perfis e Todas as situações", async () => {
        const { aoMudarPerfil, aoMudarSituacao } = renderFiltros("RESEARCHER", "inativo");
        fireEvent.click(screen.getByRole("button", { name: /Perfil/ }));
        fireEvent.click(await screen.findByRole("option", { name: "Todos os perfis" }));
        expect(aoMudarPerfil).toHaveBeenCalledWith("");
        fireEvent.click(screen.getByRole("button", { name: /Situação/ }));
        fireEvent.click(await screen.findByRole("option", { name: "Todas as situações" }));
        expect(aoMudarSituacao).toHaveBeenCalledWith("");
    });
});
