import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CabecalhoEstudo } from "./CabecalhoEstudo";
import { ESTADOS_ESTUDO } from "../../config/estados-estudo";
import { podeAlterarEstadoEstudo, podeEditarEstudo } from "../../utils/estudos";
import type { EstadoEstudo, EstudoApi } from "../../types/estudo";
import type { UserRole } from "../../types/auth";

afterEach(cleanup);
function montar(
    estado: EstadoEstudo,
    role: UserRole = "RESEARCHER",
    id = 7,
    ocupado = false,
    origem: EstadoEstudo | null = "PLANNING",
    motivo: string | null = null
) {
    const estudo: EstudoApi = {
        id: 3,
        title: "Estudo do sono",
        objective: "Objetivo",
        responsibleUserId: 7,
        status: estado,
        startDate: "2026-11-01",
        endDate: "2026-12-01",
        participantLimit: 10,
        version: 0,
    };
    const config = ESTADOS_ESTUDO[estado];
    const onTransicionar = vi.fn();
    render(
        <CabecalhoEstudo
            estudo={estudo}
            edicaoPermitida={podeEditarEstudo(estudo, { role, id })}
            mensagemBloqueio="Edição indisponível neste contexto."
            emProcessamento={ocupado}
            alteracaoEstadoPermitida={podeAlterarEstadoEstudo(estudo, { role, id })}
            origemCancelamento={origem}
            proximaTransicao={
                config.proximo ? { estado: config.proximo, rotulo: config.acao } : null
            }
            requisitosTransicao={{
                motivo,
                falhou: false,
                onMenuChange: vi.fn(),
                onReverificar: vi.fn(),
            }}
            onEditar={vi.fn()}
            onTransicionar={onTransicionar}
        />
    );
    return onTransicionar;
}

it.each<[EstadoEstudo, string[]]>([
    ["PLANNING", ["Abrir recrutamento", "Cancelar estudo"]],
    ["RECRUITMENT", ["Iniciar execução", "Voltar ao planejamento", "Cancelar estudo"]],
    ["EXECUTION", ["Encerrar estudo", "Cancelar estudo"]],
    ["CANCELLED", ["Restaurar estudo"]],
    ["CLOSED", []],
])("T24.5 — Botões do estudo: agrupa apenas as transições permitidas em %s", (estado, rotulos) => {
    montar(estado);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    if (rotulos.length === 0) {
        expect(screen.queryByRole("button", { name: "Alterar estado" })).not.toBeInTheDocument();
    } else {
        fireEvent.click(screen.getByRole("button", { name: "Alterar estado" }));
        const grupo = screen.getByRole("menu");
        expect(grupo.querySelectorAll('[role="menuitem"]')).toHaveLength(rotulos.length);
        for (const rotulo of rotulos)
            expect(screen.getByRole("menuitem", { name: rotulo })).toBeInTheDocument();
    }
    const primarios = screen
        .queryAllByRole("button")
        .filter((b) => b.classList.contains("button--primary"));
    expect(primarios.length).toBeLessThanOrEqual(1);
});

it.each<[UserRole, number]>([
    ["COORDINATOR", 7],
    ["RESEARCHER", 99],
])("T24.5 — Permissões: oculta ações de alteração para %s de id %s", (role, id) => {
    montar("RECRUITMENT", role, id);
    expect(screen.queryByRole("button", { name: "Editar estudo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Alterar estado" })).not.toBeInTheDocument();
    expect(screen.getByText("Edição indisponível neste contexto.")).toBeInTheDocument();
});

it("T24.5 — Botões do estudo: recolhe o menu ao solicitar uma transição", () => {
    const callback = montar("RECRUITMENT");
    fireEvent.click(screen.getByRole("button", { name: "Alterar estado" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Cancelar estudo" }));
    expect(callback).toHaveBeenCalledExactlyOnceWith("CANCELLED");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
});

it("T24.5 — Envio em andamento: bloqueia alterações duplicadas", () => {
    montar("PLANNING", "RESEARCHER", 7, true);
    expect(screen.getByRole("button", { name: "Editar estudo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Alterar estado" })).toBeDisabled();
});

it.each(["EXECUTION", null] as const)(
    "T24.5 — Restauração: não oferece ação com origem %s",
    (origem) => {
        montar("CANCELLED", "RESEARCHER", 7, false, origem);
        expect(screen.queryByRole("button", { name: "Alterar estado" })).not.toBeInTheDocument();
    }
);

it("T24.5 — Ação indisponível: explica o bloqueio sem impedir o cancelamento", () => {
    const motivo = "Cadastre ao menos um critério de inclusão antes de abrir o recrutamento.";
    const transicionar = montar("PLANNING", "RESEARCHER", 7, false, "PLANNING", motivo);
    fireEvent.click(screen.getByRole("button", { name: "Alterar estado" }));
    const menu = screen.getByRole("menu");
    const abrir = within(menu).getByRole("menuitem", { name: "Abrir recrutamento" });

    expect(abrir).toHaveAttribute("aria-disabled", "true");
    expect(abrir).toHaveAccessibleDescription(motivo);
    fireEvent.click(abrir);
    expect(transicionar).not.toHaveBeenCalled();

    fireEvent.click(within(menu).getByRole("menuitem", { name: "Cancelar estudo" }));
    expect(transicionar).toHaveBeenCalledExactlyOnceWith("CANCELLED");
});
