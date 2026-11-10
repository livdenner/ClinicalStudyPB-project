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

        const lista = screen.getByRole("grid", { name: "Lista de participantes incluídos" });
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
