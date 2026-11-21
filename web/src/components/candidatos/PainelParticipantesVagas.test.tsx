import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ParticipanteApi } from "../../types/participante";
import { PainelParticipantesVagas } from "./PainelParticipantesVagas";

function participante(id: number, nome: string): ParticipanteApi {
    return {
        id,
        studyId: 10,
        candidateId: 100 + id,
        candidateName: nome,
        includedAt: "2026-11-09T12:00:00Z",
        status: "ACTIVE",
    };
}

function renderPainel(props: Partial<Parameters<typeof PainelParticipantesVagas>[0]> = {}) {
    const onTentarNovamente = vi.fn();
    render(
        <PainelParticipantesVagas
            estudoTitulo="Estudo Cardiovascular Fase II"
            limiteVagas={3}
            participantes={[]}
            carregando={false}
            erro=""
            onTentarNovamente={onTentarNovamente}
            {...props}
        />
    );
    return { onTentarNovamente };
}

function indicador() {
    return screen.getByRole("status", { name: "Indicador de vagas do estudo" });
}

afterEach(() => {
    cleanup();
});

describe("Participantes e vagas (RF11)", () => {
    it("mostra o estudo sem participantes e com todas as vagas livres", () => {
        renderPainel();

        expect(screen.getByText("Nenhum participante incluído")).toBeInTheDocument();
        expect(indicador()).toHaveTextContent("0 de 3");
        expect(indicador()).toHaveTextContent("3 vagas");
        expect(indicador()).toHaveTextContent("Vagas disponíveis");
    });

    it("lista os participantes e desconta as vagas ocupadas", () => {
        renderPainel({
            participantes: [
                participante(1, "Tereza Azevedo Cunha"),
                participante(2, "Ubirajara Santos Melo"),
            ],
        });

        const lista = screen.getByRole("list", { name: "Lista de participantes incluídos" });
        expect(within(lista).getByText("Tereza Azevedo Cunha")).toBeInTheDocument();
        expect(within(lista).getByText("Ubirajara Santos Melo")).toBeInTheDocument();
        expect(within(lista).getByText("Participante #1")).toBeInTheDocument();
        expect(indicador()).toHaveTextContent("2 de 3");
        expect(indicador()).toHaveTextContent("1 vaga");
    });

    it("avisa quando o limite de vagas foi atingido", () => {
        renderPainel({
            limiteVagas: 2,
            participantes: [
                participante(1, "Tereza Azevedo Cunha"),
                participante(2, "Ubirajara Santos Melo"),
            ],
        });

        expect(indicador()).toHaveTextContent("2 de 2");
        expect(indicador()).toHaveTextContent("0 vagas");
        expect(indicador()).toHaveTextContent("Limite de vagas atingido");
    });

    it("mostra o carregamento", () => {
        renderPainel({ carregando: true });

        expect(screen.getByText("Carregando participantes...")).toBeInTheDocument();
    });

    it("mostra o erro e permite tentar novamente", () => {
        const { onTentarNovamente } = renderPainel({
            erro: "Não foi possível carregar os participantes do estudo. Tente novamente.",
        });

        expect(
            screen.getByText(
                "Não foi possível carregar os participantes do estudo. Tente novamente."
            )
        ).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

        expect(onTentarNovamente).toHaveBeenCalledTimes(1);
    });
});

/** Acesso à agenda de participantes incluídos conforme RF12. @author Lívia */
describe("RF12 — ações da agenda no painel (T18.5)", () => {
    it("RF12-PV01: participante ativo oferece agendamento para o participante selecionado", () => {
        const onAgendarVisita = vi.fn();
        renderPainel({
            participantes: [participante(1, "Pessoa fictícia ativa")],
            onAgendarVisita,
        });
        fireEvent.click(
            screen.getByRole("button", { name: "Agendar visita: Pessoa fictícia ativa" })
        );
        expect(onAgendarVisita).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({ id: 1, studyId: 10, status: "ACTIVE" })
        );
    });

    it("RF12-PV02: participante retirado não recebe ação de agendar e mantém consulta do histórico", () => {
        const onAgendarVisita = vi.fn();
        const onVerVisitas = vi.fn();
        renderPainel({
            participantes: [
                { ...participante(1, "Pessoa fictícia retirada"), status: "WITHDRAWN" },
            ],
            onAgendarVisita,
            onVerVisitas,
        });
        expect(screen.getByText("Retirado")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Agendar visita:/ })).not.toBeInTheDocument();
        fireEvent.click(
            screen.getByRole("button", { name: "Ver visitas: Pessoa fictícia retirada" })
        );
        expect(onVerVisitas).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({ id: 1, status: "WITHDRAWN" })
        );
        expect(onAgendarVisita).not.toHaveBeenCalled();
    });

    it("RF12-PV03: ausência de autorização para agendar mantém somente a consulta", () => {
        renderPainel({
            participantes: [participante(1, "Pessoa fictícia em consulta")],
            onVerVisitas: vi.fn(),
        });
        expect(
            screen.getByRole("button", { name: "Ver visitas: Pessoa fictícia em consulta" })
        ).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Agendar visita:/ })).not.toBeInTheDocument();
    });
});
